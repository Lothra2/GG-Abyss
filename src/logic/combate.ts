import type { Azar } from './azar'
import { COMBATE, MODO_PEQUE } from '../config/balance'

export interface GolpeEntrada {
  min: number
  max: number
  /** multiplicador extra (habilidades: 0.8 es 80 %) */
  mult?: number
  critChance?: number
  /** el crítico se puede apagar (daño de enemigos no crita) */
  puedeCritar?: boolean
}

export interface Golpe {
  dano: number
  critico: boolean
}

/** Tira un golpe: entre min y max, por el multiplicador, y crítico con la probabilidad dada. Nunca menos de 1. */
export function tirarGolpe(rng: Azar, e: GolpeEntrada): Golpe {
  const base = e.min + rng.next() * (e.max - e.min)
  const critico = (e.puedeCritar ?? true) && rng.prob(e.critChance ?? COMBATE.critBase)
  const v = base * (e.mult ?? 1) * (critico ? COMBATE.critDanoMult : 1)
  return { dano: Math.max(1, Math.round(v)), critico }
}

/** El daño que pasa una armadura: dano * 100 / (100 + armadura * factor) */
export function reducirPorArmadura(dano: number, armadura: number): number {
  return dano * (100 / (100 + Math.max(0, armadura) * COMBATE.armaduraFactor))
}

/** Daño de un enemigo a la heroína, con el modo peque */
export function danoEnemigo(rng: Azar, rango: readonly [number, number], modoPeque: boolean, mult = 1): number {
  const v = (rango[0] + rng.next() * (rango[1] - rango[0])) * mult * (modoPeque ? MODO_PEQUE.danoEnemigos : 1)
  return Math.max(1, Math.round(v))
}

export interface EstadoDefensa {
  vida: number
  escudo: number
  /** 0 a 100: Bloqueo reduce 80 */
  reduccionPct: number
  armadura: number
  /** segundos de invulnerabilidad que quedan */
  invulnerableS: number
}

export interface ResultadoDano {
  vida: number
  escudo: number
  /** lo que bajó la vida de verdad */
  recibido: number
  /** lo que se comió el escudo */
  absorbido: number
  /** el golpe no pasó (invulnerable) */
  esquivado: boolean
  cayo: boolean
  invulnerableS: number
}

/** La heroína recibe un golpe: invulnerabilidad, reducción, armadura, escudo y por último vida. Nunca baja de 0. */
export function recibirDano(d: EstadoDefensa, dano: number): ResultadoDano {
  if (d.invulnerableS > 0 || d.vida <= 0) return { vida: d.vida, escudo: d.escudo, recibido: 0, absorbido: 0, esquivado: true, cayo: false, invulnerableS: d.invulnerableS }
  let v = dano * (1 - Math.max(0, Math.min(100, d.reduccionPct)) / 100)
  v = reducirPorArmadura(v, d.armadura)
  v = Math.max(1, Math.round(v))
  const absorbido = Math.min(d.escudo, v)
  const resto = v - absorbido
  const vida = Math.max(0, d.vida - resto)
  return { vida, escudo: d.escudo - absorbido, recibido: resto, absorbido, esquivado: false, cayo: vida <= 0, invulnerableS: COMBATE.invulnerableS }
}

/** Escudo de Thor para Alana (Llamar a Thor) o para el aullido de rescate */
export function escudoDeThor(base: number, porNivel: number, nivel: number): number {
  return base + porNivel * (nivel - 1)
}
