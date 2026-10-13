import { PUERTO } from '../config/balance'

/**
 * Reglas del Mundo 4, El Puerto Ahogado (PLAN.md F12), sin Phaser. El farol de Thor es la luz del piso, la marea abre
 * y cierra caminos, los marineros de niebla dependen de la luz y el faro prendido ilumina todo.
 */

/* ---------- el farol de Thor ---------- */

export interface EstadoFarol {
  /** segundos que le quedan apagado (una medusa lo tocó) */
  apagadoS: number
  /** segundos que le quedan alzado (Thor aulló) */
  alzadoS: number
  /** segundos para poder alzarlo otra vez */
  recargaS: number
}

export function farolNuevo(): EstadoFarol {
  return { apagadoS: 0, alzadoS: 0, recargaS: 0 }
}

/** El radio de la luz del farol ahora. Apagado queda una brasa: nunca a oscuras del todo */
export function radioFarolThor(e: EstadoFarol, peque: boolean): number {
  const f = PUERTO.farol
  const extra = peque ? f.extraPeque : 0
  if (e.apagadoS > 0) return f.radioApagado + extra
  if (e.alzadoS > 0) return f.radioAlzado + extra
  return f.radio + extra
}

export function pasoFarol(e: EstadoFarol, dt: number): EstadoFarol {
  return { apagadoS: Math.max(0, e.apagadoS - dt), alzadoS: Math.max(0, e.alzadoS - dt), recargaS: Math.max(0, e.recargaS - dt) }
}

/** Una medusa toca a Thor: el farol se apaga un rato. Alzado no se apaga (la luz grande las espanta) */
export function apagarFarol(e: EstadoFarol, peque: boolean): EstadoFarol {
  if (e.alzadoS > 0) return e
  const s = peque ? PUERTO.farol.apagadoPequeS : PUERTO.farol.apagadoS
  return { ...e, apagadoS: Math.max(e.apagadoS, s) }
}

/** Thor alza el farol (aúlla): crece la luz unos segundos. Si estaba apagado, el aullido lo vuelve a prender */
export function alzarFarol(e: EstadoFarol): { e: EstadoFarol; ok: boolean } {
  if (e.recargaS > 0) return { e, ok: false }
  return { e: { apagadoS: 0, alzadoS: PUERTO.farol.alzadoS, recargaS: PUERTO.farol.recargaAlzarS }, ok: true }
}

/* ---------- la marea ---------- */

export type FaseMarea = 'baja' | 'subiendo' | 'alta' | 'bajando'

export interface Marea {
  fase: FaseMarea
  /** cuánto del agua de la marea cubre (0 seco, 1 tapado del todo) */
  agua: number
  /** segundos que faltan para la fase siguiente */
  falta: number
}

/** La marea a los `t` segundos del piso. En modo peque el ciclo es más lento (más tiempo para salir) */
export function mareaEn(t: number, peque = false): Marea {
  const m = PUERTO.marea
  const k = peque ? m.pequeMult : 1
  const fases: [FaseMarea, number][] = [
    ['baja', m.baja * k],
    ['subiendo', m.subiendo * k],
    ['alta', m.alta * k],
    ['bajando', m.bajando * k],
  ]
  const ciclo = fases.reduce((a, [, d]) => a + d, 0)
  let r = ((t % ciclo) + ciclo) % ciclo
  for (const [fase, d] of fases) {
    if (r < d) {
      const f = r / d
      const agua = fase === 'baja' ? 0 : fase === 'alta' ? 1 : fase === 'subiendo' ? f : 1 - f
      return { fase, agua, falta: d - r }
    }
    r -= d
  }
  return { fase: 'baja', agua: 0, falta: 0 }
}

export type CeldaMarea = 'normal' | 'baja' | 'alta'

/**
 * ¿Se camina este cuadro con esta marea? Los de marea baja se cierran al terminar de subir (mientras sube hay tiempo de
 * salir) y los muelles flotantes de marea alta se pueden pisar desde que llegan arriba hasta que terminan de bajar.
 */
export function caminableConMarea(celda: CeldaMarea, fase: FaseMarea): boolean {
  if (celda === 'normal') return true
  if (celda === 'baja') return fase === 'baja' || fase === 'subiendo'
  return fase === 'alta' || fase === 'bajando'
}

/**
 * La marea alcanzó a la heroína en (tx, ty): el cuadro seco más cercano para empujarla suave (sin daño, nadie pierde).
 * Busca a lo ancho, con los mismos pasos que caminar. null si no hay seco cerca (no debería pasar en un mapa bien hecho)
 */
export function secoMasCercano(tx: number, ty: number, caminable: (x: number, y: number) => boolean, max: number = PUERTO.rescateMareaCuadros): { x: number; y: number } | null {
  if (caminable(tx, ty)) return { x: tx, y: ty }
  const visto = new Set<string>([`${tx},${ty}`])
  let borde = [{ x: tx, y: ty, d: 0 }]
  while (borde.length) {
    const sig: typeof borde = []
    for (const p of borde) {
      if (p.d >= max) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const x = p.x + dx
        const y = p.y + dy
        const k = `${x},${y}`
        if (visto.has(k)) continue
        visto.add(k)
        if (caminable(x, y)) return { x, y }
        sig.push({ x, y, d: p.d + 1 })
      }
    }
    borde = sig
  }
  return null
}

/* ---------- marineros, cangrejos y el faro ---------- */

/** El golpe a un marinero de niebla: en la luz del farol se deshace, a oscuras casi no se le hace nada */
export function danoMarinero(base: number, enLuz: boolean): number {
  return Math.max(1, Math.round(base * (enLuz ? PUERTO.marinero.danoEnLuz : PUERTO.marinero.danoOscuro)))
}

/** Dónde se para el cangrejo `i` de un grupo de `n` para rodear a (x, y): repartidos en círculo */
export function puntoRodeo(i: number, n: number, x: number, y: number, giro = 0, radio: number = PUERTO.cangrejo.radioRodeo): { x: number; y: number } {
  const a = giro + (Math.PI * 2 * i) / Math.max(1, n)
  return { x: x + Math.cos(a) * radio, y: y + Math.sin(a) * radio * 0.7 }
}

/** Con el faro prendido (el Pez Farol vencido) la oscuridad del piso baja de golpe */
export function oscuridadConFaro(oscuridad: number, faroPrendido: boolean): number {
  return faroPrendido ? Math.min(oscuridad, PUERTO.oscuridadFaro) : oscuridad
}
