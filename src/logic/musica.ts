import { MUSICA_ESTADOS } from '../config/balance'

export type EstadoMusica = 'explorar' | 'amenaza' | 'combate' | 'descanso'

export interface SituacionMusica {
  /** enemigos que vieron a la heroína y están cerca */
  alertas: number
  /** entre ellos hay un élite (el trol) */
  elite: boolean
  /** está al lado de una fogata y sin enemigos alrededor */
  fogata: boolean
}

const NIVEL: Record<EstadoMusica, number> = { descanso: 0, explorar: 1, amenaza: 2, combate: 3 }

/** Lo que pediría la música si no hubiera retardo */
export function estadoPedido(s: SituacionMusica): EstadoMusica {
  if (s.elite || s.alertas >= MUSICA_ESTADOS.combateDesde) return 'combate'
  if (s.alertas >= 1) return 'amenaza'
  if (s.fogata) return 'descanso'
  return 'explorar'
}

/**
 * La música por estados con histéresis, sin Phaser: subir de intensidad pide que la situación dure un poco (una rata
 * que pasa no cambia nada), bajar pide calma un rato más largo, y después de un cambio la música se queda un mínimo.
 */
export class DirectorMusica {
  estado: EstadoMusica = 'explorar'
  private pedido: EstadoMusica = 'explorar'
  private durante = 0
  private desdeCambio = 99

  constructor(private cfg: typeof MUSICA_ESTADOS = MUSICA_ESTADOS) {}

  tick(dt: number, s: SituacionMusica): EstadoMusica {
    const p = estadoPedido(s)
    if (p !== this.pedido) {
      this.pedido = p
      this.durante = 0
    } else this.durante += dt
    this.desdeCambio += dt
    if (p !== this.estado && this.desdeCambio >= this.cfg.minimoS) {
      const sube = NIVEL[p] > NIVEL[this.estado]
      const espera = p === 'descanso' ? this.cfg.descansoS : sube ? (p === 'combate' ? this.cfg.subirCombateS : this.cfg.subirAmenazaS) : this.cfg.bajarS
      if (this.durante >= espera) {
        this.estado = p
        this.desdeCambio = 0
      }
    }
    return this.estado
  }
}
