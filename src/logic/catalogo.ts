/** El catálogo de objetos del kit (`botin/catalogo.json`), leído tal cual. Sin Phaser. */

export type Rareza = 'normal' | 'magic' | 'rare' | 'set' | 'unique' | 'legendary'

export type Ranura = 'casco' | 'amuleto' | 'arma' | 'pecho' | 'mano_libre' | 'guantes' | 'cinturon' | 'anillo_1' | 'anillo_2' | 'botas' | 'mascota'

export const RANURAS: readonly Ranura[] = ['mascota', 'casco', 'amuleto', 'arma', 'pecho', 'mano_libre', 'guantes', 'cinturon', 'anillo_2', 'anillo_1', 'botas']

export interface ModCat {
  stat: string
  value: number
}

export interface ItemCat {
  id: string
  name: { es: string; en?: string }
  rarity: Rareza
  level: number
  base: { cat: string; slot?: string; icon?: string; tier?: number; kind?: string; line?: string }
  stats: { damage?: [number, number]; defense?: number; speed?: number; block?: number; mods: ModCat[] }
  text: { es: string[] }
  flavor?: { es: string }
  icon: string
  atlas: string
  animated: boolean
  set?: string
  twoHanded?: boolean
}

export interface BonoSet {
  pieces: number
  mods: ModCat[]
  text: { es: string[] }
}

export interface SetCat {
  name: { es: string }
  bonus: BonoSet[]
}

export interface Catalogo {
  items: Map<string, ItemCat>
  lista: ItemCat[]
  colores: Record<string, string>
  sets: Record<string, SetCat>
}

interface CatalogoJson {
  rarities: Record<string, string>
  sets: Record<string, SetCat>
  items: ItemCat[]
}

export function leerCatalogo(json: CatalogoJson): Catalogo {
  const items = new Map<string, ItemCat>()
  for (const i of json.items) {
    // los items sin `stats.mods` o con campos faltantes se completan para que el resto no tenga que revisar
    items.set(i.id, { ...i, stats: { ...i.stats, mods: i.stats?.mods ?? [] }, text: i.text ?? { es: [] } })
  }
  return { items, lista: [...items.values()], colores: json.rarities, sets: json.sets ?? {} }
}

export function itemDe(cat: Catalogo, id: string | null | undefined): ItemCat | null {
  return id ? cat.items.get(id) ?? null : null
}

/** En qué casillero de equipo va un objeto. Hombreras, pantalones, gemas y demás no tienen casillero en el Mundo 1. */
export function ranuraDe(i: ItemCat): Ranura | 'anillo' | null {
  switch (i.base.cat) {
    case 'weapon':
      return 'arma'
    case 'offhand':
      return 'mano_libre'
    case 'pet':
      return 'mascota'
    case 'armor':
      return ({ helm: 'casco', chest: 'pecho', gloves: 'guantes', belt: 'cinturon', boots: 'botas' } as Record<string, Ranura>)[i.base.slot ?? ''] ?? null
    case 'jewel': {
      const ic = i.base.icon ?? ''
      if (ic.startsWith('ring')) return 'anillo'
      if (ic.startsWith('amulet')) return 'amuleto'
      return null
    }
    default:
      return null
  }
}

export function esPocion(i: ItemCat): boolean {
  return i.base.cat === 'potion'
}

/** ¿Se puede llevar puesto o en el cinturón? */
export function esEquipable(i: ItemCat): boolean {
  return esPocion(i) || ranuraDe(i) !== null
}

export function colorDeRareza(cat: Catalogo, r: string): string {
  return cat.colores[r] ?? '#e8e4dc'
}

/** El texto que se muestra: el del kit y, si no trae, el daño o la defensa */
export function lineasDeStats(i: ItemCat): string[] {
  const out: string[] = []
  if (i.stats.damage) out.push(`Daño ${i.stats.damage[0]}-${i.stats.damage[1]}`)
  if (i.stats.defense) out.push(`Defensa ${i.stats.defense}`)
  out.push(...(i.text?.es ?? []))
  return out
}
