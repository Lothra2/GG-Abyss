import { STATS_ACTIVOS, type ClaseId } from '../config/balance'
import type { BonosEquipo } from './stats'
import { itemDe, type Catalogo, type ItemCat, type ModCat } from './catalogo'

/** Lo que suma un objeto, ya traducido a los bonos que entiende `statsDe` */
export interface AporteItem {
  bonos: BonosEquipo
  /** stats del catálogo que existen pero el Mundo 1 no usa todavía (se muestran en el tooltip) */
  ignorados: ModCat[]
}

const CASTERS: ClaseId[] = ['druida', 'hechicera']

const activo = (stat: string) => (STATS_ACTIVOS as readonly string[]).includes(stat)

function sumar(a: BonosEquipo, b: BonosEquipo): BonosEquipo {
  const out: Record<string, number> = { ...(a as Record<string, number>) }
  for (const [k, v] of Object.entries(b)) if (typeof v === 'number') out[k] = (out[k] ?? 0) + v
  return out as BonosEquipo
}

/** Un solo objeto: daño del arma, defensa y sus mods. `velocidad` depende de la clase: el tiro y el golpe usan atkSpeed, los hechizos castSpeed. */
export function aporteDe(i: ItemCat, clase: ClaseId): AporteItem {
  const b: BonosEquipo = {}
  const ignorados: ModCat[] = []
  if (i.stats.damage) {
    b.danoMinPlano = i.stats.damage[0]
    b.danoMaxPlano = i.stats.damage[1]
  }
  let defensa = i.stats.defense ?? 0
  let armorPct = 0
  for (const m of i.stats.mods ?? []) {
    if (!activo(m.stat)) {
      ignorados.push(m)
      continue
    }
    switch (m.stat) {
      case 'life':
        b.vida = (b.vida ?? 0) + m.value
        break
      case 'mana':
        b.mana = (b.mana ?? 0) + m.value
        break
      case 'dmgPct':
        b.danoPct = (b.danoPct ?? 0) + m.value
        break
      case 'armorPct':
        armorPct += m.value
        break
      case 'defense':
        defensa += m.value
        break
      case 'damage':
        b.danoMinPlano = (b.danoMinPlano ?? 0) + m.value
        b.danoMaxPlano = (b.danoMaxPlano ?? 0) + m.value
        break
      case 'atkSpeed':
        if (!CASTERS.includes(clase)) b.velocidadAtaquePct = (b.velocidadAtaquePct ?? 0) + m.value
        break
      case 'castSpeed':
        if (CASTERS.includes(clase)) b.velocidadAtaquePct = (b.velocidadAtaquePct ?? 0) + m.value
        break
      case 'moveSpeed':
        b.velocidadPct = (b.velocidadPct ?? 0) + m.value
        break
      case 'critChance':
        b.critChance = (b.critChance ?? 0) + m.value
        break
      case 'lifeRegen':
        b.vidaRegen = (b.vidaRegen ?? 0) + m.value
        break
      case 'healPct':
        b.curacionPct = (b.curacionPct ?? 0) + m.value
        break
      case 'petDmg':
        b.mascotaDanoPct = (b.mascotaDanoPct ?? 0) + m.value
        break
      case 'petArmor':
        b.mascotaArmaduraPct = (b.mascotaArmaduraPct ?? 0) + m.value
        break
      default:
        break
    }
  }
  if (defensa > 0 || armorPct > 0) b.armadura = defensa * (1 + armorPct / 100)
  return { bonos: b, ignorados }
}

/** Cuántas piezas de cada set lleva puestas */
export function piezasDeSet(cat: Catalogo, equipo: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of Object.values(equipo)) {
    const s = itemDe(cat, id)?.set
    if (s) out[s] = (out[s] ?? 0) + 1
  }
  return out
}

/** Los bonos de set que ya están activos, por cantidad de piezas */
export function bonosDeSets(cat: Catalogo, equipo: Record<string, string>, clase: ClaseId): BonosEquipo {
  let total: BonosEquipo = {}
  for (const [set, n] of Object.entries(piezasDeSet(cat, equipo))) {
    for (const bono of cat.sets[set]?.bonus ?? []) {
      if (n < bono.pieces) continue
      total = sumar(total, aporteDe({ id: 'set', name: { es: '' }, rarity: 'set', level: 0, base: { cat: 'set' }, stats: { mods: bono.mods }, text: { es: [] }, icon: '', atlas: '', animated: false }, clase).bonos)
    }
  }
  return total
}

/** Todo lo que suma lo que lleva puesto: objetos y sets. Lo que cuenta es el equipo, no la bolsa ni el cinturón. */
export function bonosDeEquipo(cat: Catalogo, equipo: Record<string, string>, clase: ClaseId): BonosEquipo {
  let total: BonosEquipo = {}
  for (const [ranura, id] of Object.entries(equipo)) {
    const i = itemDe(cat, id)
    if (!i) continue
    // la armadura de Thor y su collar no suman a la heroína: son de la mascota
    if (ranura === 'mascota') continue
    total = sumar(total, aporteDe(i, clase).bonos)
  }
  return sumar(total, bonosDeSets(cat, equipo, clase))
}

/** La armadura que lleva Thor: nivel del `pet_armor_N` puesto, 0 si ninguna */
export function nivelArmaduraThor(cat: Catalogo, equipo: Record<string, string>): number {
  const i = itemDe(cat, equipo.mascota)
  return i && i.base.cat === 'pet' ? (i.base.tier ?? 0) : 0
}

export interface DiferenciaStat {
  /** nombre corto para mostrar */
  etiqueta: string
  /** nuevo menos actual */
  delta: number
}

/** Qué cambia al poner `nuevo` donde hoy está `actual` (o nada). Para el tooltip con + verde y - rojo. */
export function comparar(nuevo: ItemCat, actual: ItemCat | null, clase: ClaseId): DiferenciaStat[] {
  const a = aporteDe(nuevo, clase).bonos
  const b = actual ? aporteDe(actual, clase).bonos : {}
  const filas: [string, (x: BonosEquipo) => number][] = [
    ['Daño mín', (x) => x.danoMinPlano ?? 0],
    ['Daño máx', (x) => x.danoMaxPlano ?? 0],
    ['Defensa', (x) => Math.round(x.armadura ?? 0)],
    ['Vida', (x) => x.vida ?? 0],
    ['Maná', (x) => x.mana ?? 0],
    ['Daño %', (x) => x.danoPct ?? 0],
    ['Velocidad ataque %', (x) => x.velocidadAtaquePct ?? 0],
    ['Crítico %', (x) => x.critChance ?? 0],
    ['Velocidad %', (x) => x.velocidadPct ?? 0],
    ['Vida por s', (x) => x.vidaRegen ?? 0],
    ['Mascota daño %', (x) => x.mascotaDanoPct ?? 0],
  ]
  const out: DiferenciaStat[] = []
  for (const [etiqueta, f] of filas) {
    const d = f(a) - f(b)
    if (d !== 0) out.push({ etiqueta, delta: d })
  }
  return out
}
