/**
 * El medidor de ?medir=1: tiempos de frame (promedio, p95, peor) y la respuesta a la entrada (del toque o la tecla
 * al primer frame dibujado después). Guarda una ventana corta para que los números digan cómo va ahora. Sin Phaser.
 */
export interface Medidas {
  fps: number
  frameMedioMs: number
  frameP95Ms: number
  framePeorMs: number
  /** frames de más de 33 ms (se nota el tirón) */
  tirones: number
  respuestaMedioMs: number | null
  respuestaPeorMs: number | null
  muestras: number
}

export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) return 0
  const o = [...valores].sort((a, b) => a - b)
  const i = Math.min(o.length - 1, Math.max(0, Math.ceil((p / 100) * o.length) - 1))
  return o[i]!
}

export class Medidor {
  private frames: number[] = []
  private respuestas: number[] = []
  private pendiente: number | null = null

  constructor(
    private ventanaFrames = 300,
    private ventanaRespuestas = 30,
  ) {}

  frame(ms: number): void {
    this.frames.push(ms)
    if (this.frames.length > this.ventanaFrames) this.frames.shift()
  }

  /** Llegó un toque o una tecla en el instante `t` (ms). Si ya había uno esperando, cuenta el primero. */
  entrada(t: number): void {
    if (this.pendiente === null) this.pendiente = t
  }

  /** Se dibujó un frame en el instante `t` (ms): cierra la entrada pendiente */
  dibujado(t: number): void {
    if (this.pendiente === null) return
    this.respuestas.push(Math.max(0, t - this.pendiente))
    if (this.respuestas.length > this.ventanaRespuestas) this.respuestas.shift()
    this.pendiente = null
  }

  medidas(): Medidas {
    const f = this.frames
    const medio = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0
    const r = this.respuestas
    const redondo = (v: number) => Math.round(v * 10) / 10
    return {
      fps: medio > 0 ? Math.round(1000 / medio) : 0,
      frameMedioMs: redondo(medio),
      frameP95Ms: redondo(percentil(f, 95)),
      framePeorMs: redondo(f.length ? Math.max(...f) : 0),
      tirones: f.filter((v) => v > 33.4).length,
      respuestaMedioMs: r.length ? redondo(r.reduce((a, b) => a + b, 0) / r.length) : null,
      respuestaPeorMs: r.length ? redondo(Math.max(...r)) : null,
      muestras: f.length,
    }
  }
}
