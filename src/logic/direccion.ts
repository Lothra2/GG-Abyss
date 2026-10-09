import type { Direccion } from '../kit/tipos'

/** Mismo orden que `manifest.direcciones`: la fila de la hoja es el índice */
export const DIRECCIONES: readonly Direccion[] = ['down', 'down_left', 'left', 'up_left', 'up', 'up_right', 'right', 'down_right']

/** Índice de dirección (fila de la hoja) desde un vector de movimiento. y hacia abajo en pantalla. */
export function indiceDireccion(dx: number, dy: number): number {
  const grados = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
  return Math.round((((grados - 90 + 360) % 360) / 45)) % 8
}

export function direccionDe(dx: number, dy: number, dirs: readonly Direccion[] = DIRECCIONES): Direccion {
  return dirs[indiceDireccion(dx, dy)]!
}

/** Vector unitario de una dirección */
export function vectorDe(dir: Direccion): { x: number; y: number } {
  const i = DIRECCIONES.indexOf(dir)
  const grados = (i * 45 + 90) % 360
  const r = (grados * Math.PI) / 180
  return { x: Math.round(Math.cos(r) * 1000) / 1000, y: Math.round(Math.sin(r) * 1000) / 1000 }
}

/** Dirección opuesta (índice + 4) */
export function opuesta(dir: Direccion): Direccion {
  return DIRECCIONES[(DIRECCIONES.indexOf(dir) + 4) % 8]!
}
