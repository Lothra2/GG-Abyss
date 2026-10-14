import { CELESTIAL } from '../config/balance'
import type { BonosEquipo } from './stats'

/**
 * La heroína celestial (PLAN.md F13), sin Phaser. Al terminar el juego la heroína de ese perfil se vuelve celestial para
 * siempre: más vida, daño y luz, y dos poderes, las alas y la lanza de luz.
 */

/** Lo que suma ser celestial, encima del equipo (se suma como un bono más) */
export function bonosCelestial(celestial: boolean): BonosEquipo {
  return celestial ? { danoPct: CELESTIAL.danoPct } : {}
}

/** La vida máxima celestial: un porcentaje más de la que ya tiene con su nivel y su equipo */
export function vidaCelestial(vidaMax: number, celestial: boolean): number {
  return celestial ? Math.round(vidaMax * (1 + CELESTIAL.vidaPct / 100)) : vidaMax
}

/** El radio de su farol */
export function haloCelestial(radio: number, celestial: boolean): number {
  return celestial ? Math.round(radio * CELESTIAL.halo) : radio
}

/* ---------- las alas ---------- */

export interface Vuelo {
  x0: number
  y0: number
  x1: number
  y1: number
  t: number
  dur: number
}

/**
 * Un vuelo con las alas: de donde está hacia (dx, dy), `distancia` de largo (pasa por encima de todo). El juego busca
 * dónde aterrizar si el final cae en algo que no se camina.
 */
export function empezarVuelo(x: number, y: number, dx: number, dy: number, distancia: number = CELESTIAL.alas.distancia): Vuelo {
  const d = Math.hypot(dx, dy) || 1
  return { x0: x, y0: y, x1: x + (dx / d) * distancia, y1: y + (dy / d) * distancia, t: 0, dur: CELESTIAL.alas.duracionS }
}

/** Dónde va en el vuelo (con una curva suave) y si ya llegó. Mientras vuela no recibe daño */
export function pasoVuelo(v: Vuelo, dt: number): { x: number; y: number; alto: number; llego: boolean } {
  v.t = Math.min(v.dur, v.t + dt)
  const k = v.t / v.dur
  const e = k * k * (3 - 2 * k)
  return { x: v.x0 + (v.x1 - v.x0) * e, y: v.y0 + (v.y1 - v.y0) * e, alto: Math.round(Math.sin(k * Math.PI) * 18), llego: v.t >= v.dur }
}

/* ---------- la lanza de luz ---------- */

/** El daño de la lanza: un golpe fuerte que atraviesa a todos en su línea */
export function danoLanza(golpe: number): number {
  return Math.round(golpe * (CELESTIAL.lanza.danoPct / 100))
}
