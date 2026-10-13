import { CIUDAD, MODO_PEQUE } from '../config/balance'
import type { Azar } from './azar'
import { distanciaASegmento } from './jefe'

/**
 * Reglas del Mundo 5, La Ciudad Dormida (PLAN.md F12), sin Phaser. La luz te la roban: el farol de plaza aclara su
 * barrio, la Ladrona le chupa la luz y si lo logra la luz se rompe en chispas que Thor rastrea. Los sonámbulos solo se
 * mueven a oscuras.
 */

/* ---------- los barrios y sus faroles ---------- */

export type EstadoBarrio = 'apagado' | 'prendido' | 'robando' | 'robado'

export interface Barrio {
  id: string
  estado: EstadoBarrio
  /** lo que le queda a la Ladrona para terminar de chupar la luz */
  roboS: number
  /** las chispas de la luz robada que quedan por juntar */
  chispas: { x: number; y: number }[]
}

export function barrioNuevo(id: string, prendido = false): Barrio {
  return { id, estado: prendido ? 'prendido' : 'apagado', roboS: 0, chispas: [] }
}

/** La oscuridad del barrio: con su farol prendido (o mientras la Ladrona todavía no termina) baja a CIUDAD.oscuridadPrendido */
export function oscuridadBarrio(base: number, b: Barrio | undefined): number {
  if (!b) return base
  return b.estado === 'prendido' || b.estado === 'robando' ? Math.min(base, CIUDAD.oscuridadPrendido) : base
}

/** La heroína prende el farol de plaza. Robado no se prende tocándolo: hacen falta las chispas */
export function prenderBarrio(b: Barrio): boolean {
  if (b.estado !== 'apagado') return false
  b.estado = 'prendido'
  return true
}

/* ---------- la Ladrona ---------- */

/** Cada cuánto viene a robar (en modo peque menos seguido) */
export function esperaLadrona(rng: Azar, peque: boolean): number {
  const [a, z] = CIUDAD.ladrona.cadaS
  return rng.rango(a, z) * (peque ? CIUDAD.ladrona.pequeMult : 1)
}

/**
 * A qué barrio va: uno prendido, el más lejos de la heroína (que tenga que correr y llegue si se apura). En modo peque
 * nunca el barrio donde está ella. Null si no hay a cuál.
 */
export function elegirBarrioARobar(barrios: readonly Barrio[], dondeEsta: string | null, peque: boolean, distancia: (id: string) => number): string | null {
  const ok = barrios.filter((b) => b.estado === 'prendido' && !(peque && b.id === dondeEsta))
  if (!ok.length) return null
  return ok.reduce((m, b) => (distancia(b.id) > distancia(m.id) ? b : m)).id
}

export function empezarRobo(b: Barrio, peque: boolean): boolean {
  if (b.estado !== 'prendido') return false
  b.estado = 'robando'
  b.roboS = peque ? CIUDAD.ladrona.roboPequeS : CIUDAD.ladrona.roboS
  return true
}

/**
 * Un paso del robo. Si la heroína llega a la Ladrona antes de que termine, se va en humo y la luz vuelve ('salvado').
 * Si termina, el barrio queda robado ('robado') y el juego tira las chispas.
 */
export function pasoRobo(b: Barrio, dt: number, heroinaCerca: boolean): 'sigue' | 'salvado' | 'robado' | null {
  if (b.estado !== 'robando') return null
  if (heroinaCerca) {
    b.estado = 'prendido'
    b.roboS = 0
    return 'salvado'
  }
  b.roboS = Math.max(0, b.roboS - dt)
  if (b.roboS > 0) return 'sigue'
  b.estado = 'robado'
  return 'robado'
}

/* ---------- las chispas ---------- */

/**
 * Dónde caen las chispas de la luz robada: CIUDAD.chispas.cuantas puntos distintos del barrio, al azar. En modo peque
 * los que quedan cerca de Thor (si hay suficientes).
 */
export function elegirChispas(puntos: readonly { x: number; y: number }[], rng: Azar, peque = false, thor?: { x: number; y: number }): { x: number; y: number }[] {
  const n = Math.min(CIUDAD.chispas.cuantas, puntos.length)
  let pool = [...puntos]
  if (peque && thor) {
    const cerca = pool.filter((p) => Math.hypot(p.x - thor.x, p.y - thor.y) <= CIUDAD.chispas.pequeCercaThor)
    if (cerca.length >= n) pool = cerca
  }
  const out: { x: number; y: number }[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!)
  return out
}

/** Junta las chispas que estén al alcance de alguien. Devuelve cuántas juntó; con la última el farol vuelve a prenderse */
export function juntarChispas(b: Barrio, quienes: readonly { x: number; y: number }[]): { juntadas: number; prendido: boolean } {
  if (b.estado !== 'robado') return { juntadas: 0, prendido: false }
  const antes = b.chispas.length
  b.chispas = b.chispas.filter((c) => !quienes.some((q) => Math.hypot(q.x - c.x, q.y - c.y) <= CIUDAD.chispas.juntarA))
  const juntadas = antes - b.chispas.length
  if (b.chispas.length === 0) {
    b.estado = 'prendido'
    return { juntadas, prendido: true }
  }
  return { juntadas, prendido: false }
}

/* ---------- los sonámbulos y el sueño ---------- */

/** El sonámbulo de piedra solo se mueve (y solo pega) fuera de la luz: en un barrio prendido se queda quieto */
export function sonambuloDespierto(enLuz: boolean): boolean {
  return !enLuz
}

/** La arena del duende: la heroína bosteza y camina más lento un rato (en modo peque no la frena) */
export function bostezo(peque: boolean): { seg: number; velocidad: number } {
  return peque ? { seg: 0, velocidad: 1 } : { ...CIUDAD.bostezo }
}

/* ---------- el barrido del Relojero ---------- */

/** La punta de la aguja a `grados` (0 es a la derecha, crece en el sentido del reloj con y hacia abajo) */
export function puntaAguja(cx: number, cy: number, grados: number, largo: number = CIUDAD.barrido.largo): { x: number; y: number } {
  const a = (grados * Math.PI) / 180
  return { x: cx + Math.cos(a) * largo, y: cy + Math.sin(a) * largo * 0.7 }
}

/** ¿La aguja en `grados` toca este punto? La aguja va del centro hacia afuera, con su ancho */
export function tocaAguja(px: number, py: number, cx: number, cy: number, grados: number, largo: number = CIUDAD.barrido.largo, ancho: number = CIUDAD.barrido.ancho): boolean {
  const p = puntaAguja(cx, cy, grados, largo)
  return distanciaASegmento(px, py, cx, cy, p.x, p.y) <= ancho / 2
}

/** Cuánto dura el aviso del barrido (más largo en modo peque) */
export function avisoBarrido(peque: boolean): number {
  return CIUDAD.barrido.avisoS * (peque ? MODO_PEQUE.avisos : 1)
}
