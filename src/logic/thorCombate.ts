import { THOR } from '../config/balance'

export interface EntradaThor {
  dt: number
  /** vida de la heroína de 0 a 1 */
  vidaPct: number
  /** hay un enemigo a menos de THOR.mordidaRadio de la heroína */
  enemigoCerca: boolean
  heroeVivo: boolean
}

export type AccionThor = 'morder' | 'aullar' | null

/**
 * Los relojes de Thor en combate (PLAN.md 4): muerde cada 2 s a lo que esté cerca de la heroína y aúlla si su vida
 * baja de 30 %, con recarga de 20 s. Sin Phaser.
 */
export class RelojesThor {
  private mordida = 0
  private aullido = 0

  tick(e: EntradaThor): AccionThor {
    this.mordida = Math.max(0, this.mordida - e.dt)
    this.aullido = Math.max(0, this.aullido - e.dt)
    if (!e.heroeVivo) return null
    if (e.vidaPct * 100 < THOR.aullidoVidaPct && this.aullido <= 0) {
      this.aullido = THOR.aullidoRecargaS
      return 'aullar'
    }
    if (e.enemigoCerca && this.mordida <= 0) {
      this.mordida = THOR.mordidaCadaS
      return 'morder'
    }
    return null
  }

  get aullidoRestante(): number {
    return this.aullido
  }

  /** Llamar a Thor (habilidad de Alana) reinicia la mordida para que no se junten */
  reiniciarMordida(): void {
    this.mordida = THOR.mordidaCadaS
  }
}

/** Mordida de Thor: 3 a 5 más 1 por nivel */
export function rangoMordida(nivel: number): [number, number] {
  const extra = THOR.mordidaPorNivel * (nivel - 1)
  return [THOR.mordidaBase[0] + extra, THOR.mordidaBase[1] + extra]
}
