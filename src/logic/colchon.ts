/**
 * El colchón de entrada (F7): una orden que llega mientras la heroína todavía termina su golpe no se pierde. Se
 * guarda un rato corto y se hace apenas puede actuar. Si pasa el rato, se olvida (no sale un golpe viejo). Sin Phaser.
 */
export class Colchon<T> {
  private orden: T | null = null
  private resta = 0

  constructor(private ventanaS: number) {}

  guardar(orden: T): void {
    this.orden = orden
    this.resta = this.ventanaS
  }

  /** Avanza el reloj. Si puede actuar y hay una orden viva, la devuelve (una sola vez). */
  tick(dt: number, puedeActuar: boolean): T | null {
    if (this.orden === null) return null
    if (puedeActuar) {
      const o = this.orden
      this.orden = null
      return o
    }
    this.resta -= dt
    if (this.resta <= 0) this.orden = null
    return null
  }

  get pendiente(): T | null {
    return this.orden
  }

  vaciar(): void {
    this.orden = null
  }
}
