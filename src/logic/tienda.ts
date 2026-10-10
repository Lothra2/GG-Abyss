import { BOTIN, CLASES, TIENDA } from '../config/balance'
import { Azar } from './azar'
import { tablaMagicos, tablaNormal } from './botin'
import { esPocion, itemDe, type Catalogo, type ItemCat } from './catalogo'
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

/* ---------- el mercader: su equipo, vender y recomprar ---------- */

/** Lo que cuesta un objeto de equipo en el mercader */
export function precioDe(i: ItemCat): number {
  return (TIENDA.precioBase[i.rarity] ?? TIENDA.precioBase.normal!) + i.level * TIENDA.precioPorNivel
}

/** Lo que paga el mercader por algo: una parte del precio, nunca 0 */
export function precioVenta(i: ItemCat): number {
  const fija = TIENDA.ofertas.find((o) => o.id === i.id)?.precio
  return Math.max(1, Math.round(((fija ?? precioDe(i)) * TIENDA.ventaPct) / 100))
}

/** Las armas de la familia no se venden (son de cada una, salen del cofre legendario) */
export function sePuedeVender(i: ItemCat | null): boolean {
  if (!i) return false
  const personales = new Set<string>([...Object.values(BOTIN.armaPersonal), BOTIN.armaPersonalDefecto, ...Object.values(CLASES).map((c) => c.armaPersonal)])
  return !personales.has(i.id)
}

/** Semilla del surtido: cambia con el mundo y al subir de nivel (trae cosas nuevas) */
export function semillaSurtido(idPartida: string, mundo: string, nivel: number): number {
  let h = 2166136261
  for (const ch of `${idPartida}|${mundo}|${nivel}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * El equipo del mercader: un arma de la clase de la heroína y piezas de armadura o mano libre, de su nivel
 * (como el botín normal y mágico). Siempre el mismo para la misma semilla.
 */
export function surtido(cat: Catalogo, nivel: number, clase: string, semilla: number, n = TIENDA.surtido): { id: string; precio: number }[] {
  const rng = new Azar(semilla)
  const tabla = [...tablaNormal(cat, nivel), ...tablaMagicos(cat, nivel)].filter((i) => !TIENDA.ofertas.some((o) => o.id === i.id))
  const elegir = (l: ItemCat[]) => (l.length ? l[Math.floor(rng.next() * l.length)]! : null)
  const fuera = new Set<string>()
  const lista: ItemCat[] = []
  const armas = TIENDA.armasDeClase[clase] ?? []
  const arma = elegir(tabla.filter((i) => i.base.cat === 'weapon' && armas.includes(i.base.icon ?? '')))
  if (arma) {
    lista.push(arma)
    fuera.add(arma.id)
  }
  // lo demás: armadura o mano libre, sin repetir casillero
  const casilleros = new Set<string>()
  for (let k = 0; k < 40 && lista.length < n; k++) {
    const i = elegir(tabla.filter((q) => !fuera.has(q.id) && (q.base.cat === 'armor' || q.base.cat === 'offhand')))
    if (!i) break
    fuera.add(i.id)
    const cas = `${i.base.cat}:${i.base.slot ?? ''}`
    if (casilleros.has(cas)) continue
    casilleros.add(cas)
    lista.push(i)
  }
  return lista.map((i) => ({ id: i.id, precio: precioDe(i) }))
}

export type Venta = { ok: true; id: string; oro: number; precio: number } | { ok: false; motivo: 'vacio' | 'no-vende' }

/** Vende lo que hay en un hueco de la bolsa: el oro se suma y el hueco queda libre */
export function vender(p: { oro: number }, inv: Inv, cat: Catalogo, indiceBolsa: number): Venta {
  const id = inv.bolsa[indiceBolsa]
  const i = itemDe(cat, id)
  if (!id || !i) return { ok: false, motivo: 'vacio' }
  if (!sePuedeVender(i)) return { ok: false, motivo: 'no-vende' }
  const precio = precioVenta(i)
  inv.bolsa[indiceBolsa] = null
  p.oro += precio
  return { ok: true, id, oro: p.oro, precio }
}
