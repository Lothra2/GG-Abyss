import Phaser from 'phaser'
import type { Manifest, Personaje } from '../kit/tipos'
import { K } from '../kit/claves'
import type { Grilla, Punto } from '../logic/grilla'
import { buscarCamino, largoCamino, RADIO_HEROINA } from '../logic/camino'
import { caminarDireccion, seguirCamino } from '../logic/movimiento'
import { DIRECCIONES, indiceDireccion } from '../logic/direccion'
import { COMBATE } from '../config/balance'
import { PROF } from '../config/juego'
import { Sombra } from './Sombras'

export type EstadoHeroina = 'idle' | 'walk' | 'run'

export interface OpcionesAccion {
  /** segundos que dura. Por defecto lo que dura la animación del manifest. Infinity hasta `liberar()`. */
  dur?: number
  /** momento del golpe, de 0 a 1 de la duración */
  fraccion?: number
  enGolpe?: () => void
  alTerminar?: () => void
  /** otro ataque puede cortarla (el ataque básico sí, las habilidades no) */
  interrumpible?: boolean
  /** dirección fija (índice de DIRECCIONES). Por defecto la que mira. */
  dir?: number
}

export interface EventosHeroina {
  /** un pie toca el suelo */
  paso?: (x: number, y: number, corriendo: boolean) => void
}

/**
 * La heroína del mundo: sprite de 48 px en 8 direcciones, sombra, y el movimiento que
 * mandan las órdenes de Entrada (camino por A*, mantener presionado, teclado).
 */
export class Heroina {
  readonly sprite: Phaser.GameObjects.Sprite
  readonly sombra: Sombra
  readonly personaje: Personaje
  x: number
  y: number
  dir = 0
  estado: EstadoHeroina = 'idle'
  /** vector unitario de la última marcha, para que la cámara se adelante */
  vx = 0
  vy = 0
  /** segundos que lleva quieta */
  quietaS = 0
  private camino: Punto[] = []
  private destino: Punto | null = null
  private corriendo = false
  private teclado: { x: number; y: number } | null = null
  private animActual = ''
  /** tiempo sin avanzar con orden de camino, para recalcular o rendirse */
  private trabadaS = 0
  /** movimiento temporal que otra cosa le impone (esquiva, embestida): px/s */
  private forzado: { vx: number; vy: number; resta: number } | null = null
  /** acción en curso (ataque, habilidad, morir): el tiempo corre con el reloj del juego, no con el de la animación */
  private accionActual: { resta: number; golpeEn: number; enGolpe?: () => void; alTerminar?: () => void; interrumpible: boolean; anim: string } | null = null
  private tinteS = 0

  constructor(
    private escena: Phaser.Scene,
    m: Manifest,
    private grilla: Grilla,
    readonly id: string,
    x: number,
    y: number,
    private ev: EventosHeroina = {},
  ) {
    this.personaje = m.personajes[id]!
    this.x = x
    this.y = y
    const p = this.personaje
    this.sprite = escena.add.sprite(x, y, K.pers(id, 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda)
    this.sombra = new Sombra(escena, 22)
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, frame: Phaser.Animations.AnimationFrame) => {
      if (this.estado === 'idle') return
      // los pies tocan en los cuadros 1 y 5 de 8
      if (frame.index % 4 === 1) this.ev.paso?.(this.x, this.y, this.estado === 'run')
    })
    this.aplicarAnim(true)
    this.colocar()
  }

  /** hace una acción y no camina mientras dura */
  get ocupada(): boolean {
    return this.accionActual !== null
  }

  get accionInterrumpible(): boolean {
    return this.accionActual?.interrumpible ?? true
  }

  get animAccion(): string | null {
    return this.accionActual?.anim ?? null
  }

  /**
   * Reproduce una animación de acción (ataque, habilidad, morir). Mientras dura no obedece órdenes de camino.
   * El golpe y el final se miden con el reloj del juego para que las pruebas con `avanzar()` sean exactas.
   */
  accion(anim: string, op: OpcionesAccion = {}): boolean {
    if (this.accionActual && !this.accionActual.interrumpible) return false
    this.cancelarAccion()
    const dirIdx = op.dir ?? this.dir
    this.dir = dirIdx
    const key = K.anim(this.id, anim, DIRECCIONES[dirIdx]!)
    const def = this.personaje.anims[anim]
    if (!def || !this.escena.anims.exists(key)) {
      op.enGolpe?.()
      op.alTerminar?.()
      return false
    }
    const dur = op.dur ?? def.cuadros / def.fps
    this.parar()
    this.estado = 'idle'
    this.accionActual = { resta: dur, golpeEn: dur * (op.fraccion ?? 0.5), enGolpe: op.enGolpe, alTerminar: op.alTerminar, interrumpible: op.interrumpible ?? false, anim }
    this.sprite.play(key)
    this.animActual = key
    return true
  }

  /** Corta la acción en curso y vuelve a caminar o quedarse quieta */
  liberar(): void {
    const a = this.accionActual
    if (!a) return
    this.accionActual = null
    this.aplicarAnim(true)
    a.alTerminar?.()
  }

  private cancelarAccion(): void {
    this.accionActual = null
  }

  /** Un destello de color (daño recibido) */
  destello(color: number, seg = 0.14): void {
    this.sprite.setTint(color)
    this.tinteS = seg
  }

  get moviendo(): boolean {
    return this.estado !== 'idle'
  }

  get tieneOrden(): boolean {
    return this.camino.length > 0 || this.teclado !== null
  }

  get destinoActual(): Punto | null {
    return this.destino
  }

  /** Va a un punto del mundo por el camino más corto. false si no hay camino. */
  irA(x: number, y: number): boolean {
    const c = buscarCamino(this.grilla, this.x, this.y, x, y, { radio: RADIO_HEROINA })
    if (!c || c.length === 0) return false
    this.camino = c
    this.destino = c[c.length - 1]!
    this.corriendo = largoCamino({ x: this.x, y: this.y }, c) > COMBATE.correrSiCaminoMayorA
    this.teclado = null
    this.trabadaS = 0
    return true
  }

  /** Mantener presionado: se actualiza el camino sin cambiar entre caminar y correr a cada rato */
  seguirPunto(x: number, y: number): boolean {
    const c = buscarCamino(this.grilla, this.x, this.y, x, y, { radio: RADIO_HEROINA })
    if (!c || c.length === 0) return false
    this.camino = c
    this.destino = c[c.length - 1]!
    this.corriendo = largoCamino({ x: this.x, y: this.y }, c) > COMBATE.correrSiCaminoMayorA
    this.teclado = null
    return true
  }

  /** Teclado: dirección directa. (0, 0) la suelta. */
  caminarDir(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) {
      this.teclado = null
      return
    }
    this.teclado = { x: dx, y: dy }
    this.camino = []
    this.destino = null
    this.corriendo = false
  }

  parar(): void {
    this.camino = []
    this.destino = null
    this.teclado = null
  }

  /** Mira hacia un punto sin moverse (para atacar, lanzar...) */
  mirarA(x: number, y: number): void {
    const dx = x - this.x
    const dy = y - this.y
    if (Math.abs(dx) + Math.abs(dy) > 0.5) this.dir = indiceDireccion(dx, dy)
  }

  /** Un empujón que ignora las órdenes por un rato (esquiva) */
  impulso(vx: number, vy: number, dur: number): void {
    this.forzado = { vx, vy, resta: dur }
  }

  teleport(x: number, y: number): void {
    this.accionActual = null
    this.forzado = null
    this.x = x
    this.y = y
    this.parar()
    this.estado = 'idle'
    this.colocar()
    this.aplicarAnim(true)
  }

  update(dt: number): void {
    if (this.tinteS > 0) {
      this.tinteS -= dt
      if (this.tinteS <= 0) this.sprite.clearTint()
    }
    const ac = this.accionActual
    if (ac) {
      // en acción: solo se mueve si algo la empuja (esquiva)
      if (this.forzado) {
        const f = this.forzado
        const r = caminarDireccion(this.grilla, { x: this.x, y: this.y, radio: RADIO_HEROINA }, f.vx, f.vy, Math.hypot(f.vx, f.vy), dt)
        this.x = r.x
        this.y = r.y
        f.resta -= dt
        if (f.resta <= 0) this.forzado = null
      }
      this.estado = 'idle'
      this.quietaS = 0
      const antes = ac.resta
      ac.resta -= dt
      if (ac.enGolpe && antes > ac.golpeEn && ac.resta <= ac.golpeEn) {
        const g = ac.enGolpe
        ac.enGolpe = undefined
        g()
      }
      if (ac.resta <= 0 && this.accionActual === ac) {
        this.accionActual = null
        this.aplicarAnim(true)
        ac.alTerminar?.()
      }
      this.colocar()
      return
    }
    let vx = 0
    let vy = 0
    let movio = false
    const c = { x: this.x, y: this.y, radio: RADIO_HEROINA }

    if (this.forzado) {
      const f = this.forzado
      const r = caminarDireccion(this.grilla, c, f.vx, f.vy, Math.hypot(f.vx, f.vy), dt)
      this.x = r.x
      this.y = r.y
      f.resta -= dt
      if (f.resta <= 0) this.forzado = null
      movio = false
    } else if (this.teclado) {
      const r = caminarDireccion(this.grilla, c, this.teclado.x, this.teclado.y, COMBATE.velocidadHeroe, dt)
      this.x = r.x
      this.y = r.y
      vx = r.vx
      vy = r.vy
      movio = r.vx !== 0 || r.vy !== 0
    } else if (this.camino.length > 0) {
      const v = this.corriendo ? COMBATE.velocidadHeroeCorrer : COMBATE.velocidadHeroe
      const r = seguirCamino(this.grilla, c, this.camino, v, dt)
      this.x = r.x
      this.y = r.y
      vx = r.vx
      vy = r.vy
      movio = r.vx !== 0 || r.vy !== 0
      if (r.llego) {
        this.destino = null
        this.corriendo = false
      }
      if (r.trabado) {
        this.trabadaS += dt
        if (this.trabadaS > 0.4) this.parar()
      } else this.trabadaS = 0
    }

    if (movio) {
      this.vx = vx
      this.vy = vy
      this.dir = indiceDireccion(vx, vy)
      this.estado = this.corriendo && this.camino.length > 0 ? 'run' : 'walk'
      this.quietaS = 0
    } else {
      this.estado = 'idle'
      this.vx *= 0.9
      this.vy *= 0.9
      this.quietaS += dt
    }

    this.aplicarAnim(false)
    this.colocar()
  }

  private colocar(): void {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y))
    this.sprite.setDepth(PROF.OBJETOS + this.y)
    this.sombra.poner(this.x, this.y)
  }

  /** Pone la animación de la dirección y el estado actuales, sin saltar de cuadro al girar */
  private aplicarAnim(forzar: boolean): void {
    if (this.accionActual) return
    const key = K.anim(this.id, this.estado, DIRECCIONES[this.dir]!)
    if (key === this.animActual && !forzar) return
    const mismoEstado = this.animActual.startsWith(`${this.id}_${this.estado}_`)
    const idx = mismoEstado ? Math.max(0, (this.sprite.anims.currentFrame?.index ?? 1) - 1) : 0
    this.animActual = key
    if (this.escena.anims.exists(key)) this.sprite.play({ key, startFrame: idx })
  }

  destroy(): void {
    this.sprite.destroy()
    this.sombra.destroy()
  }
}
