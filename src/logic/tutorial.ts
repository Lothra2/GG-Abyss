import type { Punto } from './grilla'

export type PasoTutorial = 'caminar' | 'pegar' | 'abrir'
export const PASOS_TUTORIAL: readonly PasoTutorial[] = ['caminar', 'pegar', 'abrir']

export interface ContextoTutorial {
  hechos: readonly string[]
  heroe: Punto
  /** el enemigo vivo más cercano a menos de 260 px, o null */
  enemigo: Punto | null
  /** el cofre sin abrir más cercano a menos de 280 px, o null */
  cofre: Punto | null
  /** no mostrar nada (presentación, pelea con el jefe, caída, un panel abierto) */
  ocupada: boolean
}

export interface Demostracion {
  paso: PasoTutorial
  /** dónde va la mano, en el mundo */
  donde: Punto
}

/**
 * Qué demostración mostrar ahora (una por vez): primero caminar (la mano toca el piso delante de ella), después pegar
 * cuando hay un enemigo cerca y abrir cuando hay un cofre cerca. Cada una se muestra hasta que la hace. Sin Phaser.
 */
export function demostracion(c: ContextoTutorial): Demostracion | null {
  if (c.ocupada) return null
  const falta = (p: PasoTutorial) => !c.hechos.includes(p)
  if (falta('caminar')) return { paso: 'caminar', donde: { x: c.heroe.x + 64, y: c.heroe.y + 24 } }
  if (falta('pegar') && c.enemigo) return { paso: 'pegar', donde: { x: c.enemigo.x, y: c.enemigo.y - 12 } }
  if (falta('abrir') && c.cofre) return { paso: 'abrir', donde: { x: c.cofre.x, y: c.cofre.y - 14 } }
  return null
}

/** Lo que cuenta como hecho: caminar un poco, pegarle o vencer a un enemigo, abrir un cofre */
export function pasoCumplido(p: PasoTutorial, h: { movido: number; golpes: number; cofresAbiertos: number }): boolean {
  if (p === 'caminar') return h.movido >= 80
  if (p === 'pegar') return h.golpes >= 1
  return h.cofresAbiertos >= 1
}
