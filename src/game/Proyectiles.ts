import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { crearAnimFx } from '../kit/anims'
import { DIRECCIONES, indiceDireccion } from '../logic/direccion'
import type { Grilla } from '../logic/grilla'
import { PROYECTIL } from '../config/balance'
import { PROF } from '../config/juego'

/** Algo que un proyectil puede golpear */
export interface Blanco {
  x: number
  y: number
  vivo: boolean
  /** radio del cuerpo para el choque */
  radioHit: number
  /** altura del centro del cuerpo sobre los pies */
  altura: number
}

export interface Disparo {
  /** nombre base del fx, por ejemplo `proyectil_flecha` (el kit trae uno por dirección) */
  fx: string
  /** fx del impacto, por ejemplo `impacto_flecha` */
  impacto?: string
  x: number
  y: number
  /** radianes */
  angulo: number
  velocidad?: number
  /** px hasta que se apaga solo */
  alcance: number
  blancos: () => readonly Blanco[]
  alGolpear: (b: Blanco, x: number, y: number) => void
  /** un disparo del jefe o enemigo puede quedar al frente del jugador */
  profundidad?: number
}

interface Activo {
  d: Disparo
  s: Phaser.GameObjects.Sprite
  x: number
  y: number
  vx: number
  vy: number
  recorrido: number
  vidaS: number
}

/** Proyectiles en 8 direcciones del manifest (flecha, naturaleza, fuego, arcano...) con su impacto. */
export class Proyectiles {
  private activos: Activo[] = []

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    _grilla?: Grilla,
  ) {}

  /** F7: los tiros que no pegan dejan su impacto donde terminan */
  impactoAlFallar = true

  get cantidad(): number {
    return this.activos.length
  }

  lanzar(d: Disparo): void {
    const dir = DIRECCIONES[indiceDireccion(Math.cos(d.angulo), Math.sin(d.angulo))]!
    const nombre = `${d.fx}_${dir}`
    const tex = K.fx(nombre)
    if (!this.escena.textures.exists(tex)) return
    const key = crearAnimFx(this.escena, this.m, nombre)
    const v = d.velocidad ?? PROYECTIL.velocidad
    const s = this.escena.add.sprite(Math.round(d.x), Math.round(d.y), tex, 0).setDepth(d.profundidad ?? PROF.OBJETOS + d.y + 400)
    if (key) s.play(key)
    this.activos.push({ d, s, x: d.x, y: d.y, vx: Math.cos(d.angulo) * v, vy: Math.sin(d.angulo) * v, recorrido: 0, vidaS: 0 })
  }

  update(dt: number): void {
    for (let i = this.activos.length - 1; i >= 0; i--) {
      const p = this.activos[i]!
      const px = p.x
      const py = p.y
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.recorrido += Math.hypot(p.x - px, p.y - py)
      p.vidaS += dt
      p.s.setPosition(Math.round(p.x), Math.round(p.y))
      p.s.setDepth(PROF.OBJETOS + p.y + 400)

      let golpeo = false
      for (const b of p.d.blancos()) {
        if (!b.vivo) continue
        if (Math.hypot(b.x - p.x, b.y - b.altura - p.y) <= PROYECTIL.radio + b.radioHit) {
          p.d.alGolpear(b, p.x, p.y)
          this.impacto(p.d.impacto, p.x, p.y)
          golpeo = true
          break
        }
      }
      // los disparos pasan por encima de árboles y arbustos: a las niñas les importa más acertar que el camino del tiro
      // un tiro que no pegó cae en el piso con su impacto: se ve dónde terminó
      if (!golpeo && this.impactoAlFallar && (p.recorrido >= p.d.alcance || p.vidaS > PROYECTIL.vidaMaxS)) this.impacto(p.d.impacto, p.x, p.y)
      if (golpeo || p.recorrido >= p.d.alcance || p.vidaS > PROYECTIL.vidaMaxS) {
        p.s.destroy()
        this.activos.splice(i, 1)
      }
    }
  }

  private impacto(nombre: string | undefined, x: number, y: number): void {
    if (!nombre) return
    this.fxEn(nombre, x, y)
  }

  /** Un fx de una sola pasada en un punto del mundo (impactos, novas, el tajo) */
  fxEn(nombre: string, x: number, y: number, escala = 1, profundidad?: number): Phaser.GameObjects.Sprite | null {
    const tex = K.fx(nombre)
    if (!this.escena.textures.exists(tex)) return null
    const key = crearAnimFx(this.escena, this.m, nombre)
    const s = this.escena.add.sprite(Math.round(x), Math.round(y), tex, 0).setScale(escala).setDepth(profundidad ?? PROF.OBJETOS + y + 600)
    if (key) {
      s.play(key)
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy())
    } else this.escena.time.delayedCall(300, () => s.destroy())
    return s
  }

  limpiar(): void {
    for (const p of this.activos) p.s.destroy()
    this.activos = []
  }
}
