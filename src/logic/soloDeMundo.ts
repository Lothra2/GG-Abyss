/**
 * Lo del kit que usa un solo mundo (su música, sus ambientes, los sonidos y los efectos de sus enemigos y su jefe).
 * Fuera de ese mundo no se carga y, si quedó en memoria de antes, se suelta: en el iPad cada sonido cargado ocupa el
 * doble de lo que pesa el archivo. Los sonidos `cine_*` son de la escena Cine, que los carga sola.
 */
export interface SoloDeMundo {
  audio: readonly string[]
  fx: readonly string[]
}

/** Un nombre es de la lista si es igual o si es esa base con algo más (los proyectiles traen `_<dirección>`) */
const coincide = (nombre: string, lista: readonly string[]) => lista.some((x) => nombre === x || nombre.startsWith(`${x}_`))

/** ¿Este sonido o efecto es de otro mundo (o de las cinemáticas) y no hace falta en `mundo`? */
export function esDeOtroMundo(nombre: string, tipo: keyof SoloDeMundo, mundo: string, solo: Readonly<Record<string, SoloDeMundo>>): boolean {
  if (tipo === 'audio' && nombre.startsWith('cine_')) return true
  return Object.entries(solo).some(([id, s]) => id !== mundo && coincide(nombre, s[tipo]))
}

/** De una lista de nombres, los que sí hacen falta en `mundo` */
export function delMundo(nombres: Iterable<string>, tipo: keyof SoloDeMundo, mundo: string, solo: Readonly<Record<string, SoloDeMundo>>): string[] {
  return [...nombres].filter((n) => !esDeOtroMundo(n, tipo, mundo, solo))
}
