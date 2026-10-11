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

/**
 * Los cuadros a los que se llega caminando desde (x, y) sin salir de `radio` cuadros (búsqueda a lo ancho). Sirve para
 * que lo que cae quede del lado de donde está la heroína y no en un hueco encerrado entre árboles.
 */
export function regionCaminable(g: Grilla, x: number, y: number, radio = 6): Set<number> {
  const c = g.cuadro
  let t = { tx: Math.floor(x / c), ty: Math.floor(y / c) }
  if (g.bloqueadoCamino(t.tx, t.ty)) {
    const cerca = g.cercanoCaminable(t.tx, t.ty, 3, true)
    if (!cerca) return new Set()
    t = cerca
  }
  const visto = new Set<number>([g.idx(t.tx, t.ty)])
  const cola = [t]
  while (cola.length) {
    const p = cola.shift()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.tx + dx
      const ny = p.ty + dy
      if (!g.dentro(nx, ny) || Math.abs(nx - t.tx) > radio || Math.abs(ny - t.ty) > radio) continue
      const k = g.idx(nx, ny)
      if (visto.has(k) || g.bloqueadoCamino(nx, ny)) continue
      visto.add(k)
      cola.push({ tx: nx, ty: ny })
    }
  }
  return visto
}

/**
 * Dónde cae lo que suelta un cofre, un enemigo o un rompible: n puntos libres (donde la heroína se puede parar) alrededor
 * de (x, y), primero al frente (abajo en pantalla) y separados entre sí. Así nada queda encima de algo sólido y fuera de
 * su alcance. Si no hay lugar libre cerca, cae en el más cercano que haya (o en el mismo punto).
 */
export function puntosDeCaida(n: number, x: number, y: number, libre: (x: number, y: number) => boolean, separacion = 20): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  // primero el frente (90° es abajo), aunque quede un poco más lejos, después los costados y al final atrás.
  // Si no alcanza el lugar, una segunda vuelta más apretada (nunca dos cosas en el mismo punto)
  const grupos = [[90, 60, 120], [30, 150], [0, 180], [-30, 210, -60, 240, -90]]
  for (const sep of [separacion, separacion * 0.6]) {
    for (const angulos of grupos) for (const r of [30, 46, 62, 80, 100, 124, 150]) {
      for (const a of angulos) {
        if (out.length >= n) return out
        const px = x + Math.cos((a * Math.PI) / 180) * r
        const py = y + Math.sin((a * Math.PI) / 180) * r * 0.75
        if (!libre(px, py)) continue
        if (out.some((q) => Math.hypot(q.x - px, q.y - py) < sep)) continue
        out.push({ x: px, y: py })
      }
    }
  }
  // sin lugar: se repiten los que hay, o el punto mismo
  while (out.length < n) out.push(out[out.length % Math.max(1, out.length)] ?? { x, y })
  return out
}
