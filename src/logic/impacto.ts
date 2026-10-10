import { IMPACTO } from '../config/balance'

export type TipoImpacto = 'golpe' | 'critico' | 'muerte' | 'jefeGolpe' | 'jefeCritico' | 'jefeFase2' | 'jefeMuerte' | 'recibidoFuerte'

export interface Respuesta {
  /** segundos que el mundo se congela (0 si nada) */
  pausa: number
  /** sacudida de cámara, o null */
  sacudida: { ms: number; fuerza: number } | null
}

/** Los grandes momentos (fase 2 y muerte del jefe) pausan siempre: no gastan del tope */
const SIEMPRE = new Set<TipoImpacto>(['jefeFase2', 'jefeMuerte'])

/**
 * El peso de los golpes sin Phaser: cuánto se congela el mundo y cuánto tiembla la cámara por cada cosa que pasa.
 * Lleva la cuenta de lo que ya se congeló en el último segundo para que los golpes seguidos no traben el juego.
 */
export class Impactos {
  /** pausas dadas en el último segundo: [edad, segundos] */
  private recientes: { edad: number; pausa: number }[] = []

  constructor(private cfg: typeof IMPACTO = IMPACTO) {}

  pedir(tipo: TipoImpacto): Respuesta {
    const c = this.cfg[tipo]
    let pausa = c.pausa
    if (pausa > 0 && !SIEMPRE.has(tipo)) {
      const usado = this.recientes.reduce((n, r) => n + r.pausa, 0)
      pausa = Math.max(0, Math.min(pausa, this.cfg.topePausaPorSeg - usado))
      if (pausa < 0.01) pausa = 0
    }
    if (pausa > 0 && !SIEMPRE.has(tipo)) this.recientes.push({ edad: 0, pausa })
    return { pausa, sacudida: c.sacudidaMs > 0 ? { ms: c.sacudidaMs, fuerza: c.fuerza } : null }
  }

  /** El tiempo real pasa (también durante la pausa) */
  avanzar(dt: number): void {
    for (const r of this.recientes) r.edad += dt
    this.recientes = this.recientes.filter((r) => r.edad < 1)
  }
}
