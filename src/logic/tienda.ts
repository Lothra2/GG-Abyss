import { TIENDA } from '../config/balance'
import { esPocion, itemDe, type Catalogo } from './catalogo'
import type { Inv } from './inventario'

export type EstadoOferta = 'ok' | 'caro' | 'lleno' | 'tiene'

export interface Oferta {
  id: string
  precio: number
  estado: EstadoOferta
}

export type Compra = { ok: true; donde: 'cinturon' | 'bolsa' | 'thor'; oro: number } | { ok: false; motivo: EstadoOferta | 'no-vende' }

type Lista = readonly { id: string; precio: number }[]

const nivelThor = (cat: Catalogo, inv: Inv) => {
  const i = itemDe(cat, inv.equipo.mascota)
  return i && i.base.cat === 'pet' ? (i.base.tier ?? 0) : 0
}

/** Lo que se puede comprar y si alcanza el oro, si hay lugar o si Thor ya tiene algo igual o mejor. Sin Phaser. */
function estadoDe(oro: number, inv: Inv, cat: Catalogo, id: string, precio: number): EstadoOferta {
  const i = itemDe(cat, id)
  if (!i) return 'tiene'
  if (i.base.cat === 'pet') {
    if (nivelThor(cat, inv) >= (i.base.tier ?? 0) || inv.bolsa.includes(id)) return 'tiene'
    // la armadura que se saca vuelve a la bolsa: si no hay lugar, no se pierde, no se vende
    if (inv.equipo.mascota && !inv.bolsa.includes(null)) return 'lleno'
  } else if (esPocion(i)) {
    if (!inv.cinturon.includes(null) && !inv.bolsa.includes(null)) return 'lleno'
  } else if (!inv.bolsa.includes(null)) return 'lleno'
  return oro >= precio ? 'ok' : 'caro'
}

export function ofertas(oro: number, inv: Inv, cat: Catalogo, lista: Lista = TIENDA.ofertas): Oferta[] {
  return lista.filter((o) => itemDe(cat, o.id)).map((o) => ({ id: o.id, precio: o.precio, estado: estadoDe(oro, inv, cat, o.id, o.precio) }))
}

/**
 * Compra con el oro de la partida. Las pociones van al cinturón (o a la bolsa si está lleno) y las armaduras de Thor
 * se le ponen enseguida: la que llevaba vuelve a la bolsa. Devuelve el oro que queda.
 */
export function comprar(p: { oro: number }, inv: Inv, cat: Catalogo, id: string, lista: Lista = TIENDA.ofertas): Compra {
  const o = lista.find((x) => x.id === id)
  if (!o) return { ok: false, motivo: 'no-vende' }
  const estado = estadoDe(p.oro, inv, cat, id, o.precio)
  if (estado !== 'ok') return { ok: false, motivo: estado }
  const i = itemDe(cat, id)!
  p.oro -= o.precio
  if (i.base.cat === 'pet') {
    const previo = inv.equipo.mascota
    if (previo) inv.bolsa[inv.bolsa.indexOf(null)] = previo
    inv.equipo.mascota = id
    return { ok: true, donde: 'thor', oro: p.oro }
  }
  if (esPocion(i)) {
    const h = inv.cinturon.indexOf(null)
    if (h >= 0) {
      inv.cinturon[h] = id
      return { ok: true, donde: 'cinturon', oro: p.oro }
    }
  }
  inv.bolsa[inv.bolsa.indexOf(null)] = id
  return { ok: true, donde: 'bolsa', oro: p.oro }
}
