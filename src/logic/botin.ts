import type { Azar } from './azar'
import { BOTIN, ENEMIGOS, type BotinFuente } from '../config/balance'
import { esEquipable, esPocion, type Catalogo, type ItemCat } from './catalogo'

export type Fuente =
  | { tipo: 'enemigo'; enemigo: string }
  | { tipo: 'rompible' }
  | { tipo: 'cofre'; nivel: string; pista?: string; tutorial?: boolean }

export interface ContextoBotin {
  nivelHeroe: number
  clase: string
  idHeroe: string
}

export interface Premio {
  objetos: string[]
  /** oro total (puede salir en varias monedas) */
  oro: number
}

/** Objetos sorteables que se pueden llevar puestos y no son únicos */
const sorteable = (i: ItemCat) => esEquipable(i) && !esPocion(i)

/** Los normales cuyo nivel <= nivel de la heroína + 2 (PLAN.md 4) */
export function tablaNormal(cat: Catalogo, nivelHeroe: number): ItemCat[] {
  return cat.lista.filter((i) => i.rarity === 'normal' && sorteable(i) && i.level <= nivelHeroe + BOTIN.nivelExtra)
}

/** Los mágicos de nivel bajo del kit (`m_*`) que le tocan a su nivel */
export function tablaMagicos(cat: Catalogo, nivelHeroe: number): ItemCat[] {
  return cat.lista.filter((i) => i.rarity === 'magic' && sorteable(i) && i.level <= nivelHeroe + BOTIN.nivelExtra)
}

/** Los raros del Mundo 1 (`r_*`) */
export function tablaRaros(cat: Catalogo): ItemCat[] {
  return cat.lista.filter((i) => i.rarity === 'rare' && sorteable(i))
}

/** Legendarios de nivel 16 a 24 que se pueden equipar */
export function tablaLegendarios(cat: Catalogo): ItemCat[] {
  const [a, b] = BOTIN.legendarioNivel
  return cat.lista.filter((i) => i.rarity === 'legendary' && sorteable(i) && i.level >= a && i.level <= b)
}

/** Un objeto normal: a veces un mágico `m_*` si hay uno que le toque a su nivel */
export function sortearNormal(rng: Azar, cat: Catalogo, nivelHeroe: number): string {
  const magicos = tablaMagicos(cat, nivelHeroe)
  if (magicos.length > 0 && rng.prob(BOTIN.magicoProb)) return rng.elegir(magicos).id
  const normales = tablaNormal(cat, nivelHeroe)
  // el catálogo siempre trae objetos de nivel 1: nunca queda vacío
  return rng.elegir(normales.length > 0 ? normales : cat.lista.filter((i) => i.rarity === 'normal' && sorteable(i))).id
}

export function sortearRaro(rng: Azar, cat: Catalogo): string {
  return rng.elegir(tablaRaros(cat)).id
}

/** El legendario del cofre del Claro Escondido: el de su clase, o uno cualquiera de la tabla */
export function legendarioDe(rng: Azar, cat: Catalogo, clase: string): string {
  const propio = BOTIN.legendarioClaro[clase]
  if (propio && cat.items.has(propio)) return propio
  return rng.elegir(tablaLegendarios(cat)).id
}

function cantidadDeOro(rng: Azar, rango: readonly [number, number]): number {
  return rng.entero(rango[0], rango[1])
}

/** El tamaño de la moneda del suelo según el oro: small, medium, large o huge */
export function tamanoOro(oro: number): 'small' | 'medium' | 'large' | 'huge' {
  const t = BOTIN.oroTamano
  if (oro <= t.small) return 'small'
  if (oro <= t.medium) return 'medium'
  if (oro <= t.large) return 'large'
  return 'huge'
}

function resolverFijos(rng: Azar, cat: Catalogo, ctx: ContextoBotin, fijos: readonly string[]): string[] {
  return fijos.map((f) => (f === '@raro' ? sortearRaro(rng, cat) : f === '@legendario' ? legendarioDe(rng, cat, ctx.clase) : f))
}

/** El premio de un enemigo o un rompible (PLAN.md 4, tabla de botín) */
function premioDeCriatura(rng: Azar, cat: Catalogo, ctx: ContextoBotin, t: BotinFuente, rangoOro: readonly [number, number], esRompible: boolean): Premio {
  const objetos: string[] = []
  if (rng.prob(t.objeto)) {
    for (let k = 0; k < t.cantidad; k++) {
      if (k === 0 && t.garantiza === 'rare') objetos.push(sortearRaro(rng, cat))
      else if (esRompible && rng.prob(BOTIN.rompible.pocionProb)) objetos.push(rng.elegir(BOTIN.pocionesSuelo))
      else objetos.push(sortearNormal(rng, cat, ctx.nivelHeroe))
    }
  }
  const oro = rng.prob(t.oro) ? cantidadDeOro(rng, rangoOro) : 0
  return { objetos, oro }
}

/** El premio de un cofre, con los premios fijos de los secretos además del azar */
function premioDeCofre(rng: Azar, cat: Catalogo, ctx: ContextoBotin, f: Extract<Fuente, { tipo: 'cofre' }>): Premio {
  const tabla = BOTIN.cofres[f.nivel as keyof typeof BOTIN.cofres] ?? BOTIN.cofres.madera
  const objetos: string[] = []
  if (f.nivel === 'legendario') {
    objetos.push(BOTIN.armaPersonal[ctx.idHeroe] ?? BOTIN.armaPersonalDefecto, BOTIN.cofreLegendarioExtra)
  } else {
    for (let k = 0; k < tabla.objetos; k++) {
      if (k < tabla.raroGarantizado) objetos.push(sortearRaro(rng, cat))
      else if (tabla.legendarioProb > 0 && rng.prob(tabla.legendarioProb)) objetos.push(rng.elegir(tablaLegendarios(cat)).id)
      else if (tabla.raroProb > 0 && rng.prob(tabla.raroProb)) objetos.push(sortearRaro(rng, cat))
      else objetos.push(sortearNormal(rng, cat, ctx.nivelHeroe))
    }
  }
  const clave = f.tutorial ? 'tutorial' : f.pista
  if (clave && BOTIN.premiosFijos[clave]) objetos.push(...resolverFijos(rng, cat, ctx, BOTIN.premiosFijos[clave]!))
  return { objetos, oro: cantidadDeOro(rng, tabla.oro) }
}

/** Tira el botín de cualquier fuente. Con la misma semilla da siempre lo mismo. */
export function tirarBotin(rng: Azar, cat: Catalogo, ctx: ContextoBotin, f: Fuente): Premio {
  if (f.tipo === 'cofre') return premioDeCofre(rng, cat, ctx, f)
  if (f.tipo === 'rompible') return premioDeCriatura(rng, cat, ctx, { objeto: BOTIN.rompible.objeto, oro: BOTIN.rompible.oro, cantidad: BOTIN.rompible.cantidad }, [1, 3], true)
  const t = BOTIN[f.enemigo as 'rata' | 'calabaza' | 'goblin_arquero' | 'trol'] as BotinFuente | undefined
  const e = ENEMIGOS[f.enemigo]
  if (!t || !e) return { objetos: [], oro: 0 }
  return premioDeCriatura(rng, cat, ctx, t, e.oro, false)
}
