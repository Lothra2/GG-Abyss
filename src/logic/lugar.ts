import type { Grilla } from './grilla'

/**
 * El cuadro más cercano a (x, y) con sus 8 vecinos libres, lejos de la fogata. Bloquear un
 * cuadro con todos sus vecinos libres nunca corta un camino: siempre se lo puede rodear.
 */
export function lugarAbierto(g: Grilla, x: number, y: number, fogata: { x: number; y: number }): { tx: number; ty: number } | null {
  const c = g.cuadro
  const t0x = Math.floor(x / c)
  const t0y = Math.floor(y / c)
  const libre = (tx: number, ty: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!g.dentro(tx + dx, ty + dy) || g.bloqueadoCamino(tx + dx, ty + dy)) return false
    return true
  }
  for (const r of [1]) {
    let mejor: { tx: number; ty: number; d: number } | null = null
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const tx = t0x + dx
      const ty = t0y + dy
      const cx = tx * c + c / 2
      const cy = ty * c + c / 2
      if (Math.hypot(cx - fogata.x, cy - fogata.y) < 44 || !libre(tx, ty, r)) continue
      const d = Math.hypot(dx, dy)
      if (!mejor || d < mejor.d) mejor = { tx, ty, d }
    }
    if (mejor) return { tx: mejor.tx, ty: mejor.ty }
  }
  return null
}
