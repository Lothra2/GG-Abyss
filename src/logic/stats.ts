import { CLASES, CLASE_DEFECTO, PROGRESION, xpParaSubir, type ClaseBalance, type ClaseId } from '../config/balance'

/** Stats de una heroína a un nivel dado (PLAN.md sección 4). El equipo suma sus bonos encima (F3). */
export interface StatsHeroe {
  clase: ClaseId
  nivel: number
  vidaMax: number
  manaMax: number
  /** multiplicador de daño por nivel y por el % del equipo */
  danoMult: number
  /** daño del ataque básico, ya con el nivel, sin redondear */
  danoMin: number
  danoMax: number
  alcance: number
  ataquesPorSeg: number
  armadura: number
  critChance: number
}

export interface BonosEquipo {
  vida?: number
  mana?: number
  danoPlano?: number
  danoPct?: number
  armadura?: number
  critChance?: number
  velocidadAtaquePct?: number
}

export function claseDe(id: string, claseManifest?: string): ClaseId {
  const c = (claseManifest ?? '') as ClaseId
  if (c in CLASES) return c
  const porId: Record<string, ClaseId> = { sophie: 'amazona', alana: 'druida', rick: 'paladin', steph: 'hechicera' }
  return porId[id] ?? CLASE_DEFECTO
}

export function baseDeClase(clase: ClaseId): ClaseBalance {
  return CLASES[clase] ?? CLASES[CLASE_DEFECTO]
}

export function statsDe(clase: ClaseId, nivel: number, bonos: BonosEquipo = {}): StatsHeroe {
  const b = baseDeClase(clase)
  const n = Math.max(1, Math.min(PROGRESION.nivelMax, Math.floor(nivel)))
  const subidas = n - 1
  const danoMult = (1 + (subidas * PROGRESION.danoPorNivelPct) / 100) * (1 + (bonos.danoPct ?? 0) / 100)
  const plano = bonos.danoPlano ?? 0
  return {
    clase,
    nivel: n,
    vidaMax: b.vida + subidas * PROGRESION.vidaPorNivel + (bonos.vida ?? 0),
    manaMax: b.mana + subidas * PROGRESION.manaPorNivel + (bonos.mana ?? 0),
    danoMult,
    danoMin: (b.dano[0] + plano) * danoMult,
    danoMax: (b.dano[1] + plano) * danoMult,
    alcance: b.alcance,
    ataquesPorSeg: b.ataquesPorSeg * (1 + (bonos.velocidadAtaquePct ?? 0) / 100),
    armadura: bonos.armadura ?? 0,
    critChance: 0.05 + (bonos.critChance ?? 0) / 100,
  }
}

export interface ResultadoXp {
  nivel: number
  xp: number
  /** los niveles que se alcanzaron en esta ganancia, en orden */
  subio: number[]
}

/** Suma XP y sube de nivel las veces que haga falta. En el nivel máximo la XP queda en 0. */
export function ganarXp(nivel: number, xp: number, ganada: number): ResultadoXp {
  let n = nivel
  let x = xp + Math.max(0, ganada)
  const subio: number[] = []
  while (n < PROGRESION.nivelMax && x >= xpParaSubir(n)) {
    x -= xpParaSubir(n)
    n++
    subio.push(n)
  }
  if (n >= PROGRESION.nivelMax) x = 0
  return { nivel: n, xp: x, subio }
}

/** Lo que falta de XP para la barra: 0 a 1 */
export function fraccionXp(nivel: number, xp: number): number {
  if (nivel >= PROGRESION.nivelMax) return 1
  return Math.max(0, Math.min(1, xp / xpParaSubir(nivel)))
}

export interface RegenEntrada {
  vida: number
  mana: number
  vidaMax: number
  manaMax: number
  /** segundos desde el último daño recibido */
  sinDanoS: number
  dt: number
  /** regeneración extra de vida por segundo (equipo) */
  vidaRegenExtra?: number
  /** si está canalizando, el maná no se regenera */
  canalizando?: boolean
}

/** Regeneración: maná siempre, vida solo si pasaron 4 s sin recibir daño */
export function regenerar(e: RegenEntrada): { vida: number; mana: number } {
  let { vida, mana } = e
  if (!e.canalizando) mana = Math.min(e.manaMax, mana + PROGRESION.manaRegenPorSeg * e.dt)
  if (vida > 0 && e.sinDanoS >= PROGRESION.vidaRegenTrasDanoS) vida = Math.min(e.vidaMax, vida + (PROGRESION.vidaRegenPorSeg + (e.vidaRegenExtra ?? 0)) * e.dt)
  return { vida, mana }
}
