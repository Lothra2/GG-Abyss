import { OLFATO } from '../config/balance'
import type { Punto } from './grilla'

export interface Pista {
  llave: string
  x: number
  y: number
  secreto: boolean
}

/** Las pistas candidatas de la más cercana a la más lejana (en línea recta), sin las que quedan fuera de alcance */
export function ordenarPistas(pistas: readonly Pista[], desde: Punto, max = OLFATO.maxDistancia): Pista[] {
  return pistas
    .map((p) => ({ p, d: Math.hypot(p.x - desde.x, p.y - desde.y) }))
    .filter((o) => o.d <= max)
    .sort((a, b) => a.d - b.d)
    .map((o) => o.p)
}

export type EstadoGuia = 'ladrar' | 'guiar' | 'esperar' | 'llego' | 'listo'

export interface PasoGuia {
  /** adónde correr ahora (null = quedarse) */
  meta: Punto | null
  /** lo que hace al entrar en un estado */
  accion: 'ladrar' | 'cavar' | null
  /** dejar una huella donde está */
  huella: boolean
}

/**
 * Thor guía a la heroína por un camino (los puntos de A*): ladra, corre un tramo adelante dejando huellas, la espera,
 * y al llegar cava y ladra. Sin Phaser: Mundo le da las posiciones y mueve a Thor hacia `meta`.
 */
export class Guia {
  estado: EstadoGuia = 'ladrar'
  private t = 0
  private i = 0
  private recorrido = 0
  private ultima: Punto | null = null
  private entro = true

  constructor(
    private camino: readonly Punto[],
    private cfg: typeof OLFATO = OLFATO,
  ) {}

  get destino(): Punto | null {
    return this.camino[this.camino.length - 1] ?? null
  }

  private pasar(e: EstadoGuia): void {
    this.estado = e
    this.t = 0
    this.entro = true
  }

  tick(dt: number, thor: Punto, heroe: Punto): PasoGuia {
    this.t += dt
    const entro = this.entro
    this.entro = false
    // huellas: cuenta lo que Thor avanzó de verdad
    let huella = false
    if (this.ultima) {
      this.recorrido += Math.hypot(thor.x - this.ultima.x, thor.y - this.ultima.y)
      if (this.recorrido >= this.cfg.huellaCada) {
        this.recorrido -= this.cfg.huellaCada
        huella = this.estado === 'guiar'
      }
    }
    this.ultima = { x: thor.x, y: thor.y }
    const fin = this.destino
    switch (this.estado) {
      case 'ladrar':
        if (this.t >= this.cfg.ladrarS) this.pasar(fin ? 'guiar' : 'listo')
        return { meta: null, accion: entro ? 'ladrar' : null, huella: false }
      case 'guiar': {
        if (!fin || Math.hypot(thor.x - fin.x, thor.y - fin.y) <= this.cfg.llegada) {
          this.pasar('llego')
          return { meta: null, accion: 'cavar', huella }
        }
        if (Math.hypot(thor.x - heroe.x, thor.y - heroe.y) > this.cfg.adelanto) {
          this.pasar('esperar')
          return { meta: null, accion: 'ladrar', huella }
        }
        // el siguiente punto del camino que todavía no alcanzó
        while (this.i < this.camino.length - 1 && Math.hypot(thor.x - this.camino[this.i]!.x, thor.y - this.camino[this.i]!.y) < 10) this.i++
        return { meta: this.camino[this.i]!, accion: null, huella }
      }
      case 'esperar':
        if (Math.hypot(thor.x - heroe.x, thor.y - heroe.y) <= this.cfg.cerca) this.pasar('guiar')
        else if (this.t >= this.cfg.esperaMaxS) this.pasar('listo')
        return { meta: null, accion: null, huella: false }
      case 'llego':
        if (this.t >= this.cfg.llegoS) this.pasar('listo')
        return { meta: null, accion: null, huella: false }
      default:
        return { meta: null, accion: null, huella: false }
    }
  }
}
