/**
 * Capas nuevas que el taller va a entregar (PLAN.md F10, encargo parte 2): el primer plano que pasa por delante de la
 * cámara y el fondo de abismo que se ve donde la Catedral no tiene piso. El juego las entiende desde ya: cuando el
 * manifest las traiga, se cargan solas.
 */

export type CapaObjeto = 'suelo' | 'frente' | 'fondo' | 'objetos'

export function capaDe(def: { capa?: string }): CapaObjeto {
  return def.capa === 'suelo' || def.capa === 'frente' || def.capa === 'fondo' ? def.capa : 'objetos'
}

/** Cuánto más rápido que el mundo se mueve el primer plano */
export const PARALAJE_FRENTE = 1.15
/** Las capas del fondo, de la más lejana a la más cercana */
export const PARALAJE_FONDO = [0.6, 0.75, 0.9] as const

/**
 * Posición en el mundo de algo con paralaje: en el centro de la cámara queda donde lo puso el mapa y al alejarse se
 * corre más rápido (frente, k > 1) o más lento (fondo, k < 1). Entero, para no romper los pixeles.
 */
export function posParalaje(x: number, centroCamara: number, k: number): number {
  return Math.round(x + (x - centroCamara) * (k - 1))
}

/** ¿La heroína queda tapada por algo del frente? Entonces se vuelve casi transparente */
export function tapa(rect: { x0: number; y0: number; x1: number; y1: number }, px: number, py: number, margen = 6): boolean {
  return px > rect.x0 - margen && px < rect.x1 + margen && py - 20 > rect.y0 - margen && py - 20 < rect.y1 + margen
}

/**
 * Lo que mide el cuerpo de un jefe. Los números de balance son para la celda 96 de hoy. Cuando el taller entregue
 * jefes nativos de 128 (o 192 el del piso 7) el cuerpo crece igual, así los golpes y los disparos le siguen pegando.
 */
export function cuerpoJefe(celda: number, base: { radio: number; alto: number }): { radio: number; alto: number } {
  const k = Math.max(0.5, celda / 96)
  return { radio: Math.round(base.radio * k), alto: Math.round(base.alto * k) }
}
