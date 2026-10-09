import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { Entidad } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { fx, hash2 } from '../logic/azar'
import { Sombra } from './Sombras'

type EstadoCuervo = 'quieto' | 'picotear' | 'volar'

interface Cuervo {
  hx: number
  hy: number
  x: number
  y: number
  st: EstadoCuervo
  vx: number
  vy: number
  t0: number
  left: boolean
  back: number
  s: Phaser.GameObjects.Sprite
  sombra: Sombra
  tex: string
  fr: number
}

interface Ojos {
  x: number
  y: number
  blinkAt: number
  blinkT: number
  ph: number
  s: Phaser.GameObjects.Sprite
  tex: string
  fr: number
}

/** Radio al que la heroína asusta a un cuervo (PLAN.md 2.5) */
const RADIO_SUSTO = 46

/**
 * Criaturas del mapa (entidades `criatura`): cuervos que picotean y huyen, y ojos entre los arbustos
 * del bosque oscuro. Lo de PLAN.md 2.5, igual que el visor.
 */
export class Criaturas {
  readonly cuervos: Cuervo[] = []
  readonly ojos: Ojos[] = []

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    entidades: readonly Entidad[],
  ) {
    for (const e of entidades) {
      if (e.tipo !== 'criatura') continue
      const especie = String(e.props.especie ?? '')
      if (especie === 'cuervo') {
        const left = hash2(e.y, e.x) < 0.5
        const nombre = left ? 'cuervo_izq' : 'cuervo'
        const s = escena.add.sprite(e.x, e.y, K.cri(nombre, 'quieto'), 0).setOrigin(0.5, 15 / 16)
        this.cuervos.push({
          hx: e.x, hy: e.y, x: e.x, y: e.y, st: 'quieto', vx: 0, vy: 0, t0: hash2(e.x, e.y) * 5, left, back: 0, s,
          sombra: new Sombra(escena, 9, 0.28), tex: K.cri(nombre, 'quieto'), fr: -1,
        })
      } else if (especie === 'ojos') {
        const s = escena.add.sprite(e.x, e.y, K.cri('ojos', 'mirar'), 0).setDepth(PROF.BRILLA_EN_OSCURO).setOrigin(0.5, 0.5)
        this.ojos.push({ x: e.x, y: e.y, blinkAt: hash2(e.x, 3) * 6, blinkT: -1, ph: hash2(e.x, e.y), s, tex: K.cri('ojos', 'mirar'), fr: -1 })
      }
    }
  }

  private nombreCuervo(c: Cuervo): string {
    return c.left ? 'cuervo_izq' : 'cuervo'
  }

  /** La asusta alguien parado en `desdeX` */
  asustar(c: Cuervo, desdeX: number): void {
    c.st = 'volar'
    c.left = desdeX > c.x
    c.vx = (c.left ? -1 : 1) * (50 + fx().next() * 40)
    c.vy = -55 - fx().next() * 30
    c.back = 14 + fx().next() * 10
    this.escena.events.emit('cuervo-huye', c.x, c.y)
  }

  /** Un toque en el mundo: si cae sobre un cuervo lo asusta y devuelve true */
  tocar(x: number, y: number): boolean {
    for (const c of this.cuervos) {
      if (c.st !== 'volar' && Math.hypot(c.x - x, c.y - 8 - y) < 26) {
        this.asustar(c, x)
        return true
      }
    }
    return false
  }

  /** Cuervos que están volando (para las pruebas) */
  get volando(): number {
    return this.cuervos.filter((c) => c.st === 'volar').length
  }

  update(t: number, dt: number, heroe: { x: number; y: number }, vista: Phaser.Geom.Rectangle, oscuridad: number): void {
    const margen = 48
    for (const c of this.cuervos) {
      if (c.st === 'volar') {
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.vy -= 6 * dt
        c.back -= dt
        if (c.back <= 0) {
          // vuelve a su rama solo si nadie lo está mirando
          const visible = c.hx > vista.x - 96 && c.hx < vista.right + 96 && c.hy > vista.y - 96 && c.hy < vista.bottom + 96
          if (!visible) {
            c.st = 'quieto'
            c.x = c.hx
            c.y = c.hy
            c.t0 = t
          } else c.back = 2
        }
      } else {
        if (Math.hypot(c.x - heroe.x, c.y - heroe.y) < RADIO_SUSTO) this.asustar(c, heroe.x)
        else if (c.st === 'quieto' && fx().next() < dt * 0.25) {
          c.st = 'picotear'
          c.t0 = t
        } else if (c.st === 'picotear' && t - c.t0 > 0.65) c.st = 'quieto'
      }

      const visible = c.x > vista.x - margen && c.x < vista.right + margen && c.y > vista.y - margen - 64 && c.y < vista.bottom + margen
      c.s.setVisible(visible)
      c.sombra.setVisible(visible && c.st !== 'volar')
      if (!visible) continue
      const nombre = this.nombreCuervo(c)
      const a = this.m.mundo.criaturas[nombre]!.anims[c.st]!
      const tex = K.cri(nombre, c.st)
      const f = c.st === 'picotear' ? Math.min(a.cuadros - 1, Math.floor((t - c.t0) * a.fps)) : Math.floor(t * a.fps + c.t0) % a.cuadros
      if (tex !== c.tex) {
        c.tex = tex
        c.fr = f
        c.s.setTexture(tex, f)
      } else if (f !== c.fr) {
        c.fr = f
        c.s.setFrame(f)
      }
      c.s.setPosition(Math.round(c.x), Math.round(c.y))
      c.s.setDepth(PROF.OBJETOS + c.y + (c.st === 'volar' ? 400 : 0))
      c.sombra.poner(c.x, c.y)
    }

    const o = this.m.mundo.criaturas.ojos!.anims
    const alfa = Phaser.Math.Clamp(0.35 + oscuridad, 0, 1)
    for (const e of this.ojos) {
      if (t > e.blinkAt && e.blinkT < 0) {
        e.blinkT = t
        e.blinkAt = t + 2 + fx().next() * 6
      }
      const visible = Math.abs(e.x - (vista.x + vista.width / 2)) < vista.width / 2 + 24 && Math.abs(e.y - (vista.y + vista.height / 2)) < vista.height / 2 + 24
      e.s.setVisible(visible)
      if (!visible) continue
      let anim = 'mirar'
      let f: number
      if (e.blinkT >= 0 && t - e.blinkT < 0.36) {
        anim = 'parpadeo'
        f = Math.min(o.parpadeo!.cuadros - 1, Math.floor((t - e.blinkT) * o.parpadeo!.fps))
      } else {
        e.blinkT = -1
        f = Math.floor(t * o.mirar!.fps + e.ph * 4) % o.mirar!.cuadros
      }
      const tex = K.cri('ojos', anim)
      if (tex !== e.tex) {
        e.tex = tex
        e.fr = f
        e.s.setTexture(tex, f)
      } else if (f !== e.fr) {
        e.fr = f
        e.s.setFrame(f)
      }
      e.s.setAlpha(alfa)
    }
  }
}
