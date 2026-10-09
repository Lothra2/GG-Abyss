import Phaser from 'phaser'
import { Bloqueo } from './ui/Bloqueo'

/** Las órdenes que sale de tocar, mantener o teclear */
export interface OrdenesEntrada {
  /** devuelve true si el toque lo usó algo del mundo (un cuervo, un cofre) y no hay que caminar */
  tocarMundo(x: number, y: number): boolean
  irA(x: number, y: number): void
  /** mantener presionado: ir hacia el dedo */
  seguir(x: number, y: number): void
  /** teclado: dirección directa, (0, 0) al soltar */
  direccion(dx: number, dy: number): void
}

const MANTENER_MS = 250
const TOQUE_MAX_PX = 14
const RECALCULAR_MS = 100

/**
 * Un solo módulo convierte todo (dedo, mouse, teclado) a órdenes (PLAN.md 6, "Tacto contra clic").
 * Toque corto: ir hasta ahí. Mantener más de 250 ms: caminar hacia el dedo, recalculando cada 100 ms.
 */
export class Entrada {
  private pulsado: { id: number; t0: number; x0: number; y0: number; hold: boolean; acum: number } | null = null
  private teclas?: Record<string, Phaser.Input.Keyboard.Key>
  private tecladoActivo = false
  private bloqueada = false

  constructor(
    private escena: Phaser.Scene,
    private o: OrdenesEntrada,
  ) {
    const inp = escena.input
    inp.on('pointerdown', this.alBajar, this)
    inp.on('pointerup', this.alSubir, this)
    inp.on('pointerupoutside', this.alSubir, this)
    if (inp.keyboard) {
      this.teclas = inp.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>
    }
  }

  get estaPausada(): boolean {
    return this.bloqueada
  }

  /** Mientras está bloqueada ignora todo (cuadros de diálogo, pausa) */
  set pausada(v: boolean) {
    this.bloqueada = v
    if (v) {
      this.pulsado = null
      if (this.tecladoActivo) {
        this.tecladoActivo = false
        this.o.direccion(0, 0)
      }
    }
  }

  private mundo(p: Phaser.Input.Pointer): { x: number; y: number } {
    const w = this.escena.cameras.main.getWorldPoint(p.x, p.y)
    return { x: w.x, y: w.y }
  }

  private alBajar(p: Phaser.Input.Pointer): void {
    if (this.bloqueada) return
    if (p.button !== 0 && !p.wasTouch) return
    if (this.pulsado) return
    this.pulsado = { id: p.id, t0: performance.now(), x0: p.x, y0: p.y, hold: false, acum: 0 }
  }

  private alSubir(p: Phaser.Input.Pointer): void {
    const s = this.pulsado
    if (!s || s.id !== p.id) return
    this.pulsado = null
    if (this.bloqueada || Bloqueo.tomado(p.id)) return
    const dur = performance.now() - s.t0
    if (s.hold) return
    if (dur < MANTENER_MS || Math.hypot(p.x - s.x0, p.y - s.y0) < TOQUE_MAX_PX) {
      const w = this.mundo(p)
      if (!this.o.tocarMundo(w.x, w.y)) this.o.irA(w.x, w.y)
    }
  }

  /** Lo mismo que un toque, para las pruebas y otros sistemas (coordenadas del mundo) */
  tocar(x: number, y: number): void {
    if (!this.o.tocarMundo(x, y)) this.o.irA(x, y)
  }

  /** El mantener presionado se mide con el reloj de verdad, no con el de juego: así no depende de los cuadros por segundo */
  update(): void {
    const ahora = performance.now()
    const s = this.pulsado
    if (s && !this.bloqueada) {
      const p = this.escena.input.manager.pointers.find((q) => q.id === s.id) ?? this.escena.input.activePointer
      if (!s.hold && ahora - s.t0 >= MANTENER_MS && !Bloqueo.tomado(s.id)) {
        s.hold = true
        s.acum = ahora - RECALCULAR_MS
      }
      if (s.hold && ahora - s.acum >= RECALCULAR_MS) {
        s.acum = ahora
        const w = this.mundo(p)
        this.o.seguir(w.x, w.y)
      }
    }

    const t = this.teclas
    if (t && !this.bloqueada) {
      const dx = (t.D!.isDown || t.RIGHT!.isDown ? 1 : 0) - (t.A!.isDown || t.LEFT!.isDown ? 1 : 0)
      const dy = (t.S!.isDown || t.DOWN!.isDown ? 1 : 0) - (t.W!.isDown || t.UP!.isDown ? 1 : 0)
      if (dx !== 0 || dy !== 0) {
        this.tecladoActivo = true
        this.o.direccion(dx, dy)
      } else if (this.tecladoActivo) {
        this.tecladoActivo = false
        this.o.direccion(0, 0)
      }
    }
  }

  destroy(): void {
    const inp = this.escena.input
    inp.off('pointerdown', this.alBajar, this)
    inp.off('pointerup', this.alSubir, this)
    inp.off('pointerupoutside', this.alSubir, this)
  }
}
