import { DUREZA, type EnemigoBalance } from '../config/balance'

/**
 * Cuánto más duro es un enemigo en este piso: la base de siempre (DUREZA.vidaBase) y un poco más con cada bajada. En el
 * Ciclo 2 en adelante todo se multiplica otra vez por cada ciclo extra.
 */
export function durezaDePiso(piso: number, ciclo = 1): { vida: number; dano: number } {
  const p = Math.max(1, Math.floor(piso)) - 1
  const c = Math.max(0, Math.floor(ciclo) - 1)
  return {
    vida: DUREZA.vidaBase * (1 + DUREZA.vidaPorPiso * p) * Math.pow(DUREZA.ciclo.vida, c),
    dano: DUREZA.danoBase * (1 + DUREZA.danoPorPiso * p) * Math.pow(DUREZA.ciclo.dano, c),
  }
}

/** La vida de un jefe: más que antes (DUREZA.jefeVida) y más en cada ciclo extra */
export function vidaDeJefe(base: number, ciclo = 1): number {
  return Math.round(base * DUREZA.jefeVida * Math.pow(DUREZA.ciclo.vida, Math.max(0, Math.floor(ciclo) - 1)))
}

/**
 * Desde DUREZA.refuerzoDesde, cada enemigo común puede traer un compañero (los grupos crecen al bajar). Determinista por
 * la entidad: el mismo mapa da siempre los mismos refuerzos. `h` es un número de 0 a 1 propio de esa entidad.
 */
export function traeRefuerzo(piso: number, h: number, ciclo = 1): boolean {
  if (piso < DUREZA.refuerzoDesde) return false
  const prob = Math.min(0.9, DUREZA.refuerzoPorPiso * (piso - DUREZA.refuerzoDesde + 1) + 0.15 * Math.max(0, Math.floor(ciclo) - 1))
  return h < prob
}

const escalar = (r: readonly [number, number], k: number): [number, number] => [Math.max(1, Math.round(r[0] * k)), Math.max(1, Math.round(r[1] * k))]

/** El balance de un enemigo para su piso: más vida y más daño (también el del golpe pesado). No toca el original */
export function enemigoDelPiso(base: EnemigoBalance, piso: number, ciclo = 1): EnemigoBalance {
  const d = durezaDePiso(piso, ciclo)
  if (d.vida === 1 && d.dano === 1) return base
  return {
    ...base,
    vida: Math.round(base.vida * d.vida),
    dano: escalar(base.dano, d.dano),
    ...(base.pesado ? { pesado: { ...base.pesado, dano: escalar(base.pesado.dano, d.dano) } } : {}),
  }
}
