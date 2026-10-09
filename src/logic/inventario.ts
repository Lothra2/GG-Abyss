import { BOTIN } from '../config/balance'
import { esEquipable, esPocion, itemDe, ranuraDe, type Catalogo, type Ranura } from './catalogo'

/** Lo que guarda la partida del inventario */
export interface Inv {
  equipo: Record<string, string>
  bolsa: (string | null)[]
  cinturon: (string | null)[]
}

export type MotivoNo = 'llena' | 'no-equipable' | 'vacio' | 'desconocido'

export type Resultado = { ok: true; donde: 'bolsa' | 'cinturon' | 'equipo'; ranura?: Ranura } | { ok: false; motivo: MotivoNo }

const no = (motivo: MotivoNo): Resultado => ({ ok: false, motivo })

export function bolsaLlena(inv: Inv): boolean {
  return !inv.bolsa.includes(null)
}

export function cinturonLleno(inv: Inv): boolean {
  return !inv.cinturon.includes(null)
}

export function objetosEnBolsa(inv: Inv): number {
  return inv.bolsa.filter((x) => x !== null).length
}

/** Un objeto recogido: las pociones van al cinturón si hay lugar y si no a la bolsa, lo demás a la bolsa. */
export function recoger(inv: Inv, cat: Catalogo, id: string): Resultado {
  const i = itemDe(cat, id)
  if (!i) return no('desconocido')
  if (esPocion(i)) {
    const h = inv.cinturon.indexOf(null)
    if (h >= 0) {
      inv.cinturon[h] = id
      return { ok: true, donde: 'cinturon' }
    }
  }
  const h = inv.bolsa.indexOf(null)
  if (h < 0) return no('llena')
  inv.bolsa[h] = id
  return { ok: true, donde: 'bolsa' }
}

/** El casillero en el que cae un objeto: los anillos usan el primero libre y si no, el 1 */
function ranuraLibre(inv: Inv, r: Ranura | 'anillo'): Ranura {
  if (r !== 'anillo') return r
  if (!inv.equipo.anillo_1) return 'anillo_1'
  if (!inv.equipo.anillo_2) return 'anillo_2'
  return 'anillo_1'
}

/**
 * Tocar un objeto de la bolsa: se equipa (si ya había algo ahí, vuelve a la bolsa en el mismo hueco) y las pociones van al cinturón.
 * Equipar no pide nivel (PLAN.md 0).
 */
export function equipar(inv: Inv, cat: Catalogo, indiceBolsa: number): Resultado {
  const id = inv.bolsa[indiceBolsa]
  if (!id) return no('vacio')
  const i = itemDe(cat, id)
  if (!i) return no('desconocido')
  if (!esEquipable(i)) return no('no-equipable')
  if (esPocion(i)) {
    const h = inv.cinturon.indexOf(null)
    if (h < 0) return no('llena')
    inv.cinturon[h] = id
    inv.bolsa[indiceBolsa] = null
    return { ok: true, donde: 'cinturon' }
  }
  const r = ranuraLibre(inv, ranuraDe(i)!)
  const previo = inv.equipo[r] ?? null
  inv.equipo[r] = id
  inv.bolsa[indiceBolsa] = previo
  return { ok: true, donde: 'equipo', ranura: r }
}

/** Tocar un objeto puesto: vuelve a la bolsa. Con la bolsa llena se queda puesto. */
export function desequipar(inv: Inv, ranura: Ranura): Resultado {
  const id = inv.equipo[ranura]
  if (!id) return no('vacio')
  const h = inv.bolsa.indexOf(null)
  if (h < 0) return no('llena')
  inv.bolsa[h] = id
  delete inv.equipo[ranura]
  return { ok: true, donde: 'bolsa' }
}

/** Tocar una poción del cinturón en el inventario: vuelve a la bolsa */
export function sacarDelCinturon(inv: Inv, indice: number): Resultado {
  const id = inv.cinturon[indice]
  if (!id) return no('vacio')
  const h = inv.bolsa.indexOf(null)
  if (h < 0) return no('llena')
  inv.bolsa[h] = id
  inv.cinturon[indice] = null
  return { ok: true, donde: 'bolsa' }
}

/** Una poción que se bebe: sale del cinturón y devuelve cuánto restaura */
export function beber(inv: Inv, cat: Catalogo, indice: number): { vidaPct: number; manaPct: number } | null {
  const id = inv.cinturon[indice]
  const i = itemDe(cat, id)
  if (!id || !i || !esPocion(i)) return null
  inv.cinturon[indice] = null
  const vida = i.base.kind === 'health' || i.base.kind === 'rejuv'
  const mana = i.base.kind === 'mana' || i.base.kind === 'rejuv'
  return { vidaPct: vida ? BOTIN.pociones.vidaPct : 0, manaPct: mana ? BOTIN.pociones.manaPct : 0 }
}

/** Una partida vieja puede traer una bolsa de otro tamaño: se normaliza */
export function normalizar(inv: Inv): Inv {
  while (inv.bolsa.length < BOTIN.bolsaCasillas) inv.bolsa.push(null)
  inv.bolsa.length = BOTIN.bolsaCasillas
  while (inv.cinturon.length < BOTIN.cinturonCasillas) inv.cinturon.push(null)
  inv.cinturon.length = BOTIN.cinturonCasillas
  return inv
}
