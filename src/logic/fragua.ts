import { FRAGUA, MODO_PEQUE } from '../config/balance'

/**
 * Reglas del Mundo 6, La Fragua de las Luces (PLAN.md F12), sin Phaser. La luz quema: cerca del fuego se ve pero la
 * heroína junta calor. Las grietas respiran al ritmo de los fuelles, las jaulas liberadas dan luz fría y Thor se moja en
 * el agua fría y se sacude para enfriar.
 */

/* ---------- el calor ---------- */

export interface Calor {
  valor: number
  acalorada: boolean
  /** hasta el próximo poquito de vida que quita el calor */
  tickS: number
}

export function calorNuevo(): Calor {
  return { valor: 0, acalorada: false, tickS: FRAGUA.calor.danoCadaS }
}

/** Lo que tiene cerca la heroína en este cuadro (lo calcula el juego) */
export interface Alrededor {
  /** cerca de la orilla de la lava */
  lava?: boolean
  /** parada en una grieta al rojo */
  grieta?: boolean
  /** parada en el piso que dejó ardiendo el aliento de la Dragona */
  fuegoPiso?: boolean
  /** braseros cerca */
  braseros?: number
  /** en el rastro de una salamandra */
  rastro?: boolean
  /** dentro de la luz fría de una jaula liberada: ahí nada calienta */
  luzFria?: boolean
  /** al lado de una fuente fría */
  fuente?: boolean
}

/** Cuánto calienta (por segundo) lo que tiene alrededor. Dentro de la luz fría o en la fuente, nada */
export function calientaPorS(a: Alrededor, peque: boolean): number {
  if (a.luzFria || a.fuente) return 0
  const c = FRAGUA.calor
  const s = (a.lava ? c.lava : 0) + (a.grieta ? c.grieta : 0) + (a.fuegoPiso ? c.fuegoPiso : 0) + (a.braseros ?? 0) * c.brasero + (a.rastro ? c.rastro : 0)
  return s * (peque ? c.pequeMult : 1)
}

/** Cuánto enfría (por segundo): la fuente más que nada, después la luz fría y, si nada calienta, un poquito solo */
export function enfriaPorS(a: Alrededor, calienta: number): number {
  const c = FRAGUA.calor
  if (a.fuente) return c.enfriaFuente
  if (a.luzFria) return c.enfriaLuzFria
  return calienta > 0 ? 0 : c.enfriaBase
}

/**
 * Un paso del calor. Con el calor lleno queda acalorada hasta que baje de `sueltaEn` (no parpadea en el borde).
 * Acalorada pierde un poquito de vida cada tanto, salvo en modo peque. Devuelve el daño de este paso y si cambió.
 */
export function pasoCalor(c: Calor, dt: number, a: Alrededor, peque: boolean): { dano: number; cambio?: 'acalorada' | 'fresca' } {
  const k = FRAGUA.calor
  const sube = calientaPorS(a, peque)
  const baja = enfriaPorS(a, sube)
  c.valor = Math.max(0, Math.min(k.max, c.valor + (sube - baja) * dt))
  let cambio: 'acalorada' | 'fresca' | undefined
  if (!c.acalorada && c.valor >= k.max) {
    c.acalorada = true
    c.tickS = k.danoCadaS
    cambio = 'acalorada'
  } else if (c.acalorada && c.valor < k.sueltaEn) {
    c.acalorada = false
    cambio = 'fresca'
  }
  let dano = 0
  if (c.acalorada && !peque) {
    c.tickS -= dt
    if (c.tickS <= 0) {
      dano = k.dano
      c.tickS += k.danoCadaS
    }
  }
  return cambio ? { dano, cambio } : { dano }
}

/** La fuente fría o la sacudida de Thor: se enfría del todo */
export function enfriarDelTodo(c: Calor): void {
  c.valor = 0
  c.acalorada = false
  c.tickS = FRAGUA.calor.danoCadaS
}

/** Lo que camina acalorada (en modo peque un poco menos lento) */
export function velocidadCalor(c: Calor, peque: boolean): number {
  if (!c.acalorada) return 1
  return peque ? FRAGUA.calor.pequeVelocidad : FRAGUA.calor.velocidad
}

/* ---------- los fuelles y las grietas ---------- */

export type EstadoGrieta = 'apagada' | 'aviso' | 'caliente'

/** El período de los fuelles: en la fase 3 de la Dragona soplan más seguido */
export function periodoFuelle(rapido: boolean): number {
  return rapido ? FRAGUA.fuelle.periodoFase3S : FRAGUA.fuelle.periodoS
}

/** Cuánto dura el aviso de la grieta (más largo en modo peque) */
export function avisoGrieta(peque: boolean): number {
  return FRAGUA.fuelle.avisoS * (peque ? MODO_PEQUE.avisos : 1)
}

/**
 * En qué está una grieta en el tiempo `t` del ciclo de los fuelles. `fase` (0 a 1) corre el soplido en ese parche, así
 * no se prenden todas a la vez: la ola de calor va pasando. Primero el aviso, después al rojo y el resto apagada.
 */
export function estadoGrieta(t: number, fase: number, periodo: number, peque: boolean): EstadoGrieta {
  const aviso = avisoGrieta(peque)
  const caliente = FRAGUA.fuelle.calienteS
  const p = (((t / periodo - fase) % 1) + 1) % 1
  const s = p * periodo
  if (s < aviso) return 'aviso'
  if (s < aviso + caliente) return 'caliente'
  return 'apagada'
}

/** ¿Soplan los fuelles en este paso? Se avisa con el sonido `sonidoAntesS` antes de que empiece el aviso de fase 0 */
export function soplaEntre(t0: number, t1: number, periodo: number): boolean {
  const antes = FRAGUA.fuelle.sonidoAntesS
  const marca = (t: number) => Math.floor((t + antes) / periodo)
  return t1 > t0 && marca(t1) > marca(t0)
}

/** ¿Un punto cae en un parche de grietas? (rectángulos como los trae el mapa, x e y en la esquina) */
export function enParche(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h
}

/* ---------- las jaulas y la luz fría ---------- */

export type LuzJaula = 'bosque' | 'catedral' | 'galerias' | 'faro' | 'ciudad'

export interface Jaula {
  id: string
  x: number
  y: number
  luz: LuzJaula
  zona: string
  abierta: boolean
  /** de la Cárcel de las Luces: se abren todas juntas al vencer al Carcelero */
  carcel?: boolean
}

/** El golpe al candado: la jaula se abre una sola vez */
export function abrirJaula(j: Jaula): boolean {
  if (j.abierta) return false
  j.abierta = true
  return true
}

/** El Carcelero cayó: se abren todas las de su cárcel. Devuelve las que se abrieron ahora */
export function abrirCarcel(jaulas: readonly Jaula[]): Jaula[] {
  return jaulas.filter((j) => j.carcel && abrirJaula(j))
}

/** La Dragona se liberó: se abren todas las que queden. Devuelve las que se abrieron ahora */
export function abrirTodas(jaulas: readonly Jaula[]): Jaula[] {
  return jaulas.filter((j) => abrirJaula(j))
}

/** Cuántas liberadas en la zona (o en todo el piso sin zona), para la cuenta del HUD */
export function cuentaJaulas(jaulas: readonly Jaula[], zona?: string): { libres: number; total: number } {
  const js = zona ? jaulas.filter((j) => j.zona === zona) : jaulas
  return { libres: js.filter((j) => j.abierta).length, total: js.length }
}

/** ¿Está este punto dentro de la luz fría de alguna jaula liberada? */
export function enLuzFria(px: number, py: number, jaulas: readonly Jaula[], radio: number = FRAGUA.jaula.radioLuzLibre): boolean {
  return jaulas.some((j) => j.abierta && Math.hypot(px - j.x, py - j.y) <= radio)
}

/** ¿Alcanza a pegarle al candado desde aquí? */
export function alcanzaCandado(px: number, py: number, j: Jaula, radio: number = FRAGUA.jaula.golpeRadio): boolean {
  return !j.abierta && Math.hypot(px - j.x, py - j.y) <= radio
}

/* ---------- Thor se sacude ---------- */

export interface AguaThor {
  cargas: number
  recargaS: number
}

export function aguaNueva(cargas = 0): AguaThor {
  return { cargas, recargaS: 0 }
}

/** Thor se metió al agua fría: vuelve a tener todas las sacudidas. Devuelve si cambió algo */
export function mojarThor(a: AguaThor): boolean {
  if (a.cargas >= FRAGUA.sacudida.cargas) return false
  a.cargas = FRAGUA.sacudida.cargas
  return true
}

export function pasoAgua(a: AguaThor, dt: number): void {
  a.recargaS = Math.max(0, a.recargaS - dt)
}

/** ¿Se puede sacudir ahora? (mojado y sin la pausa corta entre sacudidas) */
export function puedeSacudir(a: AguaThor): boolean {
  return a.cargas > 0 && a.recargaS <= 0
}

/** Thor se sacude: gasta una carga. Devuelve si pudo */
export function sacudir(a: AguaThor): boolean {
  if (!puedeSacudir(a)) return false
  a.cargas -= 1
  a.recargaS = FRAGUA.sacudida.recargaS
  return true
}

/** Las gotas llegan a esto (la heroína, las grietas, las salamandras y la Dragona) */
export function alcanzaSacudida(thor: { x: number; y: number }, p: { x: number; y: number }): boolean {
  return Math.hypot(thor.x - p.x, thor.y - p.y) <= FRAGUA.sacudida.radio
}

/* ---------- los hollines ---------- */

/** ¿Se le puede pegar otro hollín? (de a uno en modo peque) */
export function puedePegarse(pegados: number, peque: boolean): boolean {
  return pegados < (peque ? FRAGUA.hollin.maxPeque : FRAGUA.hollin.max)
}

/** El halo de la heroína con los hollines pegados: cada uno lo achica, hasta el mínimo */
export function haloConHollines(pegados: number): number {
  return Math.max(FRAGUA.hollin.haloMin, 1 - pegados * FRAGUA.hollin.halo)
}

/** Lo que camina con hollines pegados */
export function velocidadHollines(pegados: number): number {
  return pegados > 0 ? FRAGUA.hollin.velocidad : 1
}

/** La luz fría o la sacudida los sueltan a todos */
export function sueltanHollines(a: { luzFria?: boolean; sacudida?: boolean }): boolean {
  return !!(a.luzFria || a.sacudida)
}

/* ---------- los surtidores de la arena ---------- */

export interface Surtidor {
  id: string
  x: number
  y: number
  /** la palanca de este surtidor */
  px: number
  py: number
  recargaS: number
}

export function pasoSurtidores(ss: readonly Surtidor[], dt: number): void {
  for (const s of ss) s.recargaS = Math.max(0, s.recargaS - dt)
}

/** La palanca más cercana que la heroína alcanza a tirar (y que tenga agua) */
export function palancaCerca(ss: readonly Surtidor[], hx: number, hy: number): Surtidor | null {
  let mejor: Surtidor | null = null
  let md = FRAGUA.surtidor.palancaA
  for (const s of ss) {
    const d = Math.hypot(hx - s.px, hy - s.py)
    if (s.recargaS <= 0 && d <= md) {
      mejor = s
      md = d
    }
  }
  return mejor
}

/** Tira la palanca: el surtidor echa su chorro y queda recargando. Devuelve si salió el chorro */
export function tirarPalanca(s: Surtidor): boolean {
  if (s.recargaS > 0) return false
  s.recargaS = FRAGUA.surtidor.recargaS
  return true
}

/** ¿El chorro le llega a esto? (la Dragona encima del surtidor) */
export function chorroAlcanza(s: Pick<Surtidor, 'x' | 'y'>, p: { x: number; y: number }): boolean {
  return Math.hypot(s.x - p.x, s.y - p.y) <= FRAGUA.surtidor.alcance
}

/** El surtidor que tiene a la Dragona encima, para el ícono de Alana sobre su palanca */
export function surtidorBajo(ss: readonly Surtidor[], p: { x: number; y: number }): Surtidor | null {
  return ss.find((s) => s.recargaS <= 0 && chorroAlcanza(s, p)) ?? null
}
