import { DUREZA, type EnemigoBalance } from '../config/balance'

/** Cuánto más duro es un enemigo en este piso: x1 en el Bosque y un poco más con cada bajada */
export function durezaDePiso(piso: number): { vida: number; dano: number } {
  const p = Math.max(1, Math.floor(piso)) - 1
  return { vida: 1 + DUREZA.vidaPorPiso * p, dano: 1 + DUREZA.danoPorPiso * p }
}

const escalar = (r: readonly [number, number], k: number): [number, number] => [Math.max(1, Math.round(r[0] * k)), Math.max(1, Math.round(r[1] * k))]

/** El balance de un enemigo para su piso: más vida y más daño (también el del golpe pesado). No toca el original */
export function enemigoDelPiso(base: EnemigoBalance, piso: number): EnemigoBalance {
  const d = durezaDePiso(piso)
  if (d.vida === 1 && d.dano === 1) return base
  return {
    ...base,
    vida: Math.round(base.vida * d.vida),
    dano: escalar(base.dano, d.dano),
    ...(base.pesado ? { pesado: { ...base.pesado, dano: escalar(base.pesado.dano, d.dano) } } : {}),
  }
}
