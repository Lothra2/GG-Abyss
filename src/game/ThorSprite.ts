import Phaser from 'phaser'
import type { Manifest, Personaje } from '../kit/tipos'
import { K } from '../kit/claves'
import type { Grilla, Punto } from '../logic/grilla'
import { moverCuerpo } from '../logic/movimiento'
import { DIRECCIONES, indiceDireccion } from '../logic/direccion'
import { THOR } from '../config/balance'
import { PROF } from '../config/juego'
import { Sombra } from './Sombras'
import { idThor } from '../kit/manifest'
import type { Heroina } from './Heroina'

type EstadoThor = 'idle' | 'walk' | 'run' | 'sit' | 'wag'

const RADIO_THOR = 6
/** distancia por el rastro de la heroína a la que la sigue */
const DISTANCIA_RASTRO = 46
const PASO_RASTRO = 6

/**
 * Thor, el ayudante (PLAN.md 4, tabla de Thor). Sigue el rastro de la heroína, así nunca
 * se mete por donde ella no pasó. Cuando ella se queda quieta se acomoda a su costado,
 * a los 5 s se sienta, y al volver a moverse mueve la cola un momento.
 */
export class ThorSprite {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly sombra: Sombra
  x: number
  y: number
  dir = 0
  estado: EstadoThor = 'idle'
  private personaje: Personaje
  private idPers = 'thor'
  private rastro: Punto[] = []
  private animActual = ''
  private quietoS = 0
  private trabadoS = 0
  private colaS = 0
  private lado = 1

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private grilla: Grilla,
    x: number,
    y: number,
  ) {
    this.x = x
    this.y = y
    this.personaje = m.personajes.thor!
    const p = this.personaje
    this.sprite = escena.add.sprite(x, y, K.pers('thor', 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda)
    this.sombra = new Sombra(escena, 24)
    this.colocar()
    this.poner('idle', true)
  }

  /** Cambia la armadura: `nivel` 0 es Thor sin armadura (F3) */
  ponerArmadura(nivel: number): void {
    const id = idThor(nivel)
    if (!this.m.personajes[id] || id === this.idPers) return
    this.idPers = id
    this.personaje = this.m.personajes[id]!
    this.animActual = ''
  }

  /** Mueve la cola un momento (cuando algo lindo pasa) */
  menearCola(seg = 1.6): void {
    this.estado = 'wag'
    this.colaS = seg
  }

  /** La heroína avisa dónde está para ir dejando rastro */
  registrarRastro(h: Heroina): void {
    const u = this.rastro[this.rastro.length - 1]
    if (!u || Math.hypot(h.x - u.x, h.y - u.y) >= PASO_RASTRO) {
      this.rastro.push({ x: h.x, y: h.y })
      if (this.rastro.length > 60) this.rastro.shift()
    }
  }

  /** Un punto del rastro a `dist` px de la heroína yendo hacia atrás */
  private puntoDelRastro(h: Heroina, dist: number): Punto {
    let acum = Math.hypot(h.x - (this.rastro[this.rastro.length - 1]?.x ?? h.x), h.y - (this.rastro[this.rastro.length - 1]?.y ?? h.y))
    for (let i = this.rastro.length - 1; i > 0; i--) {
      const a = this.rastro[i]!
      const b = this.rastro[i - 1]!
      const seg = Math.hypot(a.x - b.x, a.y - b.y)
      if (acum + seg >= dist) {
        const t = (dist - acum) / seg
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
      acum += seg
    }
    return this.rastro[0] ?? { x: h.x, y: h.y }
  }

  /** Lugar a su costado para cuando ella está quieta */
  private ranuraCostado(h: Heroina): Punto {
    const opciones: Punto[] = [
      { x: h.x + 34 * this.lado, y: h.y + 4 },
      { x: h.x - 34 * this.lado, y: h.y + 4 },
      { x: h.x + 26 * this.lado, y: h.y + 22 },
      { x: h.x, y: h.y + 30 },
    ]
    for (const o of opciones) if (this.grilla.circuloLibre(o.x, o.y, RADIO_THOR)) return o
    return { x: h.x, y: h.y }
  }

  update(dt: number, h: Heroina): void {
    const dh = Math.hypot(h.x - this.x, h.y - this.y)
    let meta: Punto
    if (h.moviendo) meta = dh > DISTANCIA_RASTRO + 10 ? this.puntoDelRastro(h, DISTANCIA_RASTRO) : { x: this.x, y: this.y }
    else {
      // se queda del lado donde ya está
      this.lado = this.x >= h.x ? 1 : -1
      meta = this.ranuraCostado(h)
    }

    const dx = meta.x - this.x
    const dy = meta.y - this.y
    const d = Math.hypot(dx, dy)
    let mueve = false
    if (d > 5) {
      const corre = dh > THOR.distanciaReacomodar || d > 70
      const v = corre ? THOR.correr : THOR.velocidad
      const paso = Math.min(d, v * dt)
      const r = moverCuerpo(this.grilla, { x: this.x, y: this.y, radio: RADIO_THOR }, (dx / d) * paso, (dy / d) * paso)
      if (r.movido > 0.05) {
        this.x = r.x
        this.y = r.y
        this.dir = indiceDireccion(dx, dy)
        mueve = true
        this.estado = corre ? 'run' : 'walk'
        this.trabadoS = 0
      } else if (d > 40) this.trabadoS += dt
    } else this.trabadoS = 0

    // trabado más de 2 s: aparece al lado de ella
    if (this.trabadoS > 2) this.aparecerCerca(h)

    if (mueve) {
      this.quietoS = 0
    } else {
      this.quietoS += dt
      if (this.estado === 'wag') {
        this.colaS -= dt
        if (this.colaS <= 0) this.estado = 'idle'
      } else if (h.quietaS > THOR.sentarseTrasS && this.quietoS > 1) this.estado = 'sit'
      else if (this.estado !== 'sit') this.estado = 'idle'
      // mira a la heroína
      if (this.estado === 'idle' || this.estado === 'wag') this.dir = indiceDireccion(h.x - this.x, h.y - this.y)
    }
    // si estaba sentado y ella empieza a moverse: mueve la cola y se levanta
    if (this.estado === 'sit' && h.moviendo) {
      this.estado = 'wag'
      this.colaS = 0.9
    }

    this.poner(this.estado)
    this.colocar()
  }

  private aparecerCerca(h: Heroina): void {
    const p = this.grilla.puntoLibreCerca(h.x - 24 * (h.vx || 1), h.y - 24 * (h.vy || 0), RADIO_THOR, 96) ?? { x: h.x, y: h.y }
    this.x = p.x
    this.y = p.y
    this.trabadoS = 0
  }

  teleport(x: number, y: number): void {
    this.x = x
    this.y = y
    this.rastro = []
    this.colocar()
  }

  private colocar(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y))
    this.sprite.setDepth(PROF.OBJETOS + this.y)
    this.sombra.poner(this.x, this.y)
  }

  private poner(estado: EstadoThor, forzar = false): void {
    let anim = estado as string
    if (!this.personaje.anims[anim]) anim = this.personaje.anims.idle ? 'idle' : Object.keys(this.personaje.anims)[0]!
    const key = K.anim(this.idPers, anim, DIRECCIONES[this.dir]!)
    if (key === this.animActual && !forzar) return
    this.animActual = key
    if (this.escena.anims.exists(key)) this.sprite.play(key)
  }

  destroy(): void {
    this.sprite.destroy()
    this.sombra.destroy()
  }
}
