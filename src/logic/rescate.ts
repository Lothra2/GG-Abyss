import type { Partida } from './guardado'

export interface PuntoRescate {
  x: number
  y: number
}

/**
 * El rescate de Thor (PLAN.md F2, tarea 8): al llegar la vida a 0 la heroína reaparece en la última fogata con vida y
 * maná llenos. No se pierde nada: ni oro, ni equipo, ni XP, ni lo descubierto. Solo cambian posición, vida y maná.
 */
export function rescatar(p: Partida, destino: PuntoRescate, vidaMax: number, manaMax: number): Partida {
  return { ...p, vida: vidaMax, mana: manaMax, posicion: { x: Math.round(destino.x), y: Math.round(destino.y) } }
}
