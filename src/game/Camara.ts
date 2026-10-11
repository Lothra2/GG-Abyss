import Phaser from 'phaser'
import { CAMARA } from '../config/balance'

/**
 * Cámara del mundo: sigue a la heroína con un lerp suave y se adelanta hacia donde camina.
 * No se sale del mapa (igual que el visor) y siempre cae en pixeles enteros.
 */
export class Camara {
  cx = 0
  cy = 0
  private adelX = 0
  private adelY = 0
  private libre = false
  readonly cam: Phaser.Cameras.Scene2D.Camera

  constructor(escena: Phaser.Scene, private anchoMundo: number, private altoMundo: number) {
    this.cam = escena.cameras.main
    this.cam.setRoundPixels(true)
    this.cam.setBackgroundColor(0x0a1418)
  }

  /** Aumento entero del mundo sobre la vista lógica (ver `zoomCamara`). El HUD va en otra escena y no se agranda. */
  get zoom(): number {
    return this.cam.zoom
  }

  set zoom(z: number) {
    const n = Math.max(1, Math.round(z))
    if (n === this.cam.zoom) return
    this.cam.setZoom(n)
    this.aplicar()
  }

  /** Lo que se ve del mundo, en pixeles del arte */
  get ancho(): number {
    return this.cam.width / this.cam.zoom
  }

  get alto(): number {
    return this.cam.height / this.cam.zoom
  }

  /** Lo que se ve, en coordenadas del mundo. Phaser agranda desde el centro: el centro es scroll + mitad de la cámara */
  get vista(): Phaser.Geom.Rectangle {
    const w = this.ancho
    const h = this.alto
    return new Phaser.Geom.Rectangle(this.cam.scrollX + (this.cam.width - w) / 2, this.cam.scrollY + (this.cam.height - h) / 2, w, h)
  }

  /**
   * Las cosas pegadas a la pantalla (oscuridad, bruma) también se agrandan desde el centro. Para que cubran justo la
   * pantalla miden lo que se ve del mundo y van en este punto: así un pixel suyo es un pixel del mundo.
   */
  get origenPantalla(): { x: number; y: number } {
    const z = this.cam.zoom
    return { x: (this.cam.width / 2) * (1 - 1 / z), y: (this.cam.height / 2) * (1 - 1 / z) }
  }

  private limitar(): void {
    const w = this.ancho
    const h = this.alto
    this.cx = this.anchoMundo <= w ? this.anchoMundo / 2 : Phaser.Math.Clamp(this.cx, w / 2, this.anchoMundo - w / 2)
    this.cy = this.altoMundo <= h ? this.altoMundo / 2 : Phaser.Math.Clamp(this.cy, h / 2, this.altoMundo - h / 2)
  }

  private aplicar(): void {
    this.limitar()
    this.cam.setScroll(Math.round(this.cx - this.cam.width / 2), Math.round(this.cy - this.cam.height / 2))
  }

  /** Centra de golpe (al aparecer, al saltar a una postal) */
  centrarEn(x: number, y: number): void {
    this.cx = x
    this.cy = y
    this.adelX = 0
    this.adelY = 0
    this.aplicar()
  }

  /** Mientras es true la cámara no sigue a nadie (paneo de presentación, capturas) */
  set manual(v: boolean) {
    this.libre = v
  }

  get manual(): boolean {
    return this.libre
  }

  seguir(dt: number, x: number, y: number, vx: number, vy: number): void {
    if (this.libre) return this.aplicar()
    const k = Math.min(1, dt * 3)
    this.adelX += (vx * CAMARA.adelanto - this.adelX) * k
    this.adelY += (vy * CAMARA.adelanto - this.adelY) * k
    const f = 1 - Math.pow(1 - CAMARA.lerp, dt * 60)
    this.cx += (x + this.adelX - this.cx) * f
    this.cy += (y + this.adelY - this.cy) * f
    this.aplicar()
  }
}
