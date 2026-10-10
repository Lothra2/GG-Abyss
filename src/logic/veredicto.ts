import type { ClaseId } from '../config/balance'
import { esEquipable, esPocion, itemDe, ranuraDe, type Catalogo, type ItemCat, type Ranura } from './catalogo'
import { comparar, type DiferenciaStat } from './equipo'

export type Juicio = 'mejor' | 'peor' | 'igual'

export interface Veredicto {
  juicio: Juicio
  /** contra qué se compara (null = el casillero está vacío) */
  contra: string | null
  ranura: Ranura
  dif: DiferenciaStat[]
  puntaje: number
}

/** Cuánto pesa cada estadística para decidir si algo es mejor (lo que más cambia la pelea pesa más) */
const PESO: Record<string, number> = {
  'Daño mín': 1,
  'Daño máx': 1,
  Defensa: 0.6,
  Vida: 0.35,
  Maná: 0.25,
  'Daño %': 0.6,
  'Velocidad ataque %': 0.5,
  'Crítico %': 0.6,
  'Velocidad %': 0.3,
  'Vida por s': 1,
  'Mascota daño %': 0.2,
}

/**
 * ¿Conviene ponerse esto? Lo compara con lo que lleva puesto en su casillero (en los anillos, con el más flojo o con
 * el hueco libre) y da un juicio simple para una niña: mejor, peor o igual. Sin Phaser.
 * null si no se equipa (pociones, cosas que no van puestas).
 */
export function veredicto(cat: Catalogo, equipo: Record<string, string>, id: string, clase: ClaseId): Veredicto | null {
  const nuevo = itemDe(cat, id)
  if (!nuevo || !esEquipable(nuevo) || esPocion(nuevo)) return null
  const r = ranuraDe(nuevo)
  if (!r) return null
  let ranura: Ranura
  if (r === 'anillo') {
    if (!equipo.anillo_1) ranura = 'anillo_1'
    else if (!equipo.anillo_2) ranura = 'anillo_2'
    else {
      const p = (k: 'anillo_1' | 'anillo_2') => puntaje(comparar(itemDe(cat, equipo[k])!, null, clase))
      ranura = p('anillo_1') <= p('anillo_2') ? 'anillo_1' : 'anillo_2'
    }
  } else ranura = r
  const actualId = equipo[ranura] ?? null
  const actual: ItemCat | null = actualId ? itemDe(cat, actualId) : null
  const dif = comparar(nuevo, actual, clase)
  const pt = puntaje(dif)
  // con el casillero vacío siempre suma; si es el mismo objeto, igual
  const juicio: Juicio = actualId === id ? 'igual' : !actual ? 'mejor' : pt > 0.05 ? 'mejor' : pt < -0.05 ? 'peor' : 'igual'
  return { juicio, contra: actualId, ranura, dif, puntaje: Math.round(pt * 100) / 100 }
}

function puntaje(dif: readonly DiferenciaStat[]): number {
  return dif.reduce((t, d) => t + d.delta * (PESO[d.etiqueta] ?? 0.3), 0)
}
