import type { Zona } from '../kit/mapa'
import { MODO_PEQUE, OSCURIDAD } from '../config/balance'
import { COLOR } from '../config/juego'

/** Zona en un punto. Si caben varias gana la más chica (PLAN.md 3.1, igual que el visor). */
export function zonaEn(zonas: readonly Zona[], x: number, y: number): Zona | null {
  let mejor: Zona | null = null
  for (const z of zonas) {
    if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h && (!mejor || z.area < mejor.area)) mejor = z
  }
  return mejor
}

export type RGB = [number, number, number]

export interface Atmosfera {
  niebla: number
  oscuridad: number
  luz: RGB
}

export function hexARgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export const LUZ_DEFECTO: RGB = hexARgb(COLOR.LUZ_DEFECTO)
export const NIEBLA_DEFECTO = 0.3

/** Lo que pide una zona (o el valor por defecto fuera de toda zona) */
export function atmosferaDe(zona: Zona | null): Atmosfera {
  return {
    niebla: zona ? zona.niebla : NIEBLA_DEFECTO,
    oscuridad: zona ? zona.oscuridad : 0,
    luz: zona?.luz ? hexARgb(zona.luz) : [...LUZ_DEFECTO],
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** Mezcla suave hacia lo que pide la zona: k = min(1, dt * 1.2), como el visor */
export function mezclar(actual: Atmosfera, objetivo: Atmosfera, dt: number): Atmosfera {
  const k = Math.min(1, dt * OSCURIDAD.mezclaPorSeg)
  return {
    niebla: lerp(actual.niebla, objetivo.niebla, k),
    oscuridad: lerp(actual.oscuridad, objetivo.oscuridad, k),
    luz: [lerp(actual.luz[0], objetivo.luz[0], k), lerp(actual.luz[1], objetivo.luz[1], k), lerp(actual.luz[2], objetivo.luz[2], k)],
  }
}

/** Lo más que llega el control de Noche: 0.55, o 0.25 en modo peque */
export function nocheMaxima(modoPeque: boolean): number {
  return modoPeque ? MODO_PEQUE.nocheMax : OSCURIDAD.nocheMax
}

/** El valor del control de Noche, ya recortado a lo que se permite */
export function nocheEfectiva(noche: number, modoPeque: boolean): number {
  return Math.min(Math.max(0, noche), nocheMaxima(modoPeque))
}

/**
 * Oscuridad final = clamp(noche + zona.oscuridad, 0, 0.6). En modo peque nunca pasa de 0.45.
 */
export function oscuridadFinal(noche: number, oscuridadZona: number, modoPeque: boolean): number {
  const tope = modoPeque ? Math.min(OSCURIDAD.finalMax, MODO_PEQUE.oscuridadMax) : OSCURIDAD.finalMax
  const v = nocheEfectiva(noche, modoPeque) + oscuridadZona
  return Math.max(0, Math.min(tope, v))
}
