import { Grilla, type Punto } from './grilla'

/** Radio del círculo de los pies de la heroína (PLAN.md 3.4) */
export const RADIO_HEROINA = 8

const SQRT2 = Math.SQRT2

/** Montículo binario mínimo para el A* */
class Monticulo {
  private idx: number[] = []
  private pri: number[] = []

  get largo(): number {
    return this.idx.length
  }

  meter(i: number, p: number): void {
    const a = this.idx
    const b = this.pri
    let n = a.length
    a.push(i)
    b.push(p)
    while (n > 0) {
      const padre = (n - 1) >> 1
      if (b[padre]! <= p) break
      a[n] = a[padre]!
      b[n] = b[padre]!
      n = padre
    }
    a[n] = i
    b[n] = p
  }

  sacar(): number {
    const a = this.idx
    const b = this.pri
    const primero = a[0]!
    const ultI = a.pop()!
    const ultP = b.pop()!
    const n = a.length
    if (n > 0) {
      let i = 0
      while (true) {
        let h = 2 * i + 1
        if (h >= n) break
        if (h + 1 < n && b[h + 1]! < b[h]!) h++
        if (b[h]! >= ultP) break
        a[i] = a[h]!
        b[i] = b[h]!
        i = h
      }
      a[i] = ultI
      b[i] = ultP
    }
    return primero
  }
}

const VECINOS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [-1, 1, SQRT2], [1, -1, SQRT2], [-1, -1, SQRT2],
]

export interface OpcionesCamino {
  /** radio del círculo para suavizar (0 desactiva el suavizado) */
  radio?: number
  /** cuántos cuadros se busca un destino caminable si el pedido está bloqueado */
  radioBusqueda?: number
}

/**
 * A* en 8 direcciones sobre la grilla, sin cortar esquinas (PLAN.md 3.4).
 * Devuelve los puntos por donde pasar (sin el de salida), suavizados por línea de vista.
 * Si el destino está bloqueado va al cuadro caminable más cercano en `radioBusqueda` cuadros.
 * null si no hay camino.
 */
export function buscarCamino(g: Grilla, x0: number, y0: number, x1: number, y1: number, op: OpcionesCamino = {}): Punto[] | null {
  const radio = op.radio ?? RADIO_HEROINA
  const radioBusq = op.radioBusqueda ?? 3
  const ini0 = g.cuadroDe(x0, y0)
  const ini = g.cercanoCaminable(ini0.tx, ini0.ty, 3)
  const fin0 = g.cuadroDe(x1, y1)
  const fin = g.cercanoCaminable(fin0.tx, fin0.ty, radioBusq)
  if (!ini || !fin) return null

  const n = g.ancho * g.alto
  const gScore = new Float32Array(n).fill(Infinity)
  const vino = new Int32Array(n).fill(-1)
  const cerrado = new Uint8Array(n)
  const abierto = new Monticulo()

  const iIni = g.idx(ini.tx, ini.ty)
  const iFin = g.idx(fin.tx, fin.ty)
  const h = (tx: number, ty: number) => {
    const dx = Math.abs(tx - fin.tx)
    const dy = Math.abs(ty - fin.ty)
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy)
  }
  gScore[iIni] = 0
  abierto.meter(iIni, h(ini.tx, ini.ty))

  let llego = false
  while (abierto.largo > 0) {
    const cur = abierto.sacar()
    if (cerrado[cur]) continue
    cerrado[cur] = 1
    if (cur === iFin) {
      llego = true
      break
    }
    const cx = cur % g.ancho
    const cy = (cur - cx) / g.ancho
    for (const [dx, dy, costo] of VECINOS) {
      const nx = cx + dx
      const ny = cy + dy
      if (g.bloqueado(nx, ny)) continue
      // sin cortar esquinas: en diagonal los dos cuadros de al lado tienen que estar libres
      if (dx !== 0 && dy !== 0 && (g.bloqueado(cx + dx, cy) || g.bloqueado(cx, cy + dy))) continue
      const ni = g.idx(nx, ny)
      if (cerrado[ni]) continue
      const t = gScore[cur]! + costo
      if (t < gScore[ni]!) {
        gScore[ni] = t
        vino[ni] = cur
        abierto.meter(ni, t + h(nx, ny))
      }
    }
  }
  if (!llego) return null

  // reconstruir por centros de cuadro
  const centros: Punto[] = []
  for (let i = iFin; i !== -1; i = vino[i]!) {
    const tx = i % g.ancho
    centros.push(g.centroDe(tx, (i - tx) / g.ancho))
    if (i === iIni) break
  }
  centros.reverse()

  // el primer punto es donde está parado, el último el destino exacto si es libre
  const pts: Punto[] = [{ x: x0, y: y0 }, ...centros.slice(1)]
  const exacto = fin.tx === fin0.tx && fin.ty === fin0.ty && (radio === 0 || g.circuloLibre(x1, y1, radio))
  if (exacto) {
    if (pts.length > 1) pts[pts.length - 1] = { x: x1, y: y1 }
    else pts.push({ x: x1, y: y1 })
  }

  const suave = radio > 0 ? suavizar(g, pts, radio) : pts
  return suave.slice(1)
}

/** Quita los puntos que sobran: de cada punto se salta al más lejano al que se llega en línea recta */
export function suavizar(g: Grilla, pts: Punto[], radio: number): Punto[] {
  if (pts.length <= 2) return pts
  const out: Punto[] = [pts[0]!]
  let i = 0
  while (i < pts.length - 1) {
    let j = pts.length - 1
    while (j > i + 1 && !g.lineaLibre(pts[i]!.x, pts[i]!.y, pts[j]!.x, pts[j]!.y, radio)) j--
    out.push(pts[j]!)
    i = j
  }
  return out
}

export function largoCamino(desde: Punto, camino: Punto[]): number {
  let total = 0
  let ant = desde
  for (const p of camino) {
    total += Math.hypot(p.x - ant.x, p.y - ant.y)
    ant = p
  }
  return total
}
