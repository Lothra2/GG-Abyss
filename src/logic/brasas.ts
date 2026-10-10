/**
 * F8, la forja: las tres brasas de la Catedral. Cada brasa que vuelve cambia el mundo de a poco: se prenden braseros,
 * se abren compuertas de raíces y la forja se enciende. Todo depende de cuántas brasas hay. Sin Phaser.
 */

/** Una compuerta o un brasero se abre o se prende cuando hay al menos `requiere` brasas */
export const activo = (requiere: number, brasas: number): boolean => brasas >= requiere

/** Cómo se ve la forja: forja_0 a forja_3 */
export const estadoForja = (brasas: number): 0 | 1 | 2 | 3 => Math.max(0, Math.min(3, Math.floor(brasas))) as 0 | 1 | 2 | 3

/** Lo que cambia al llegar la brasa número `n` (para anunciarlo y animarlo) */
export function cambiosAl(n: number, compuertas: readonly { id: string; requiere: number }[], braseros: readonly { requiere: number }[]): { abre: string[]; prende: number; forjaEncendida: boolean } {
  return {
    abre: compuertas.filter((c) => c.requiere === n).map((c) => c.id),
    prende: braseros.filter((b) => b.requiere === n).length,
    forjaEncendida: n >= 3,
  }
}

/** La brasa sin recoger más cercana a un punto (para Thor y la flecha). null si ya están todas. */
export function brasaMasCercana<T extends { id: string; x: number; y: number }>(brasas: readonly T[], recogidas: readonly string[], x: number, y: number): T | null {
  let mejor: T | null = null
  let d = Infinity
  for (const b of brasas) {
    if (recogidas.includes(b.id)) continue
    const dd = Math.hypot(b.x - x, b.y - y)
    if (dd < d) {
      d = dd
      mejor = b
    }
  }
  return mejor
}
