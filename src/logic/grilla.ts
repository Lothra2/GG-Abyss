import type { MapaJuego } from '../kit/mapa'

export interface Punto {
  x: number
  y: number
}

/**
 * Grilla de colisión del mapa (PLAN.md 3.4). Un cuadro bloqueado no se pasa.
 * Todo en pixeles de mundo salvo `tx`, `ty` que son cuadros. Fuera del mapa cuenta como bloqueado.
 */
export class Grilla {
  readonly ancho: number
  readonly alto: number
  readonly cuadro: number
  private base: Uint8Array
  /** bloqueos temporales (la salida de la arena del jefe en F4): cuántas veces se bloqueó cada cuadro */
  private extra = new Map<number, number>()

  constructor(mapa: Pick<MapaJuego, 'ancho' | 'alto' | 'cuadro' | 'colision'>) {
    this.ancho = mapa.ancho
    this.alto = mapa.alto
    this.cuadro = mapa.cuadro
    this.base = mapa.colision
  }

  get anchoPx(): number {
    return this.ancho * this.cuadro
  }

  get altoPx(): number {
    return this.alto * this.cuadro
  }

  dentro(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.ancho && ty < this.alto
  }

  idx(tx: number, ty: number): number {
    return ty * this.ancho + tx
  }

  bloqueado(tx: number, ty: number): boolean {
    if (!this.dentro(tx, ty)) return true
    const i = this.idx(tx, ty)
    return this.base[i] !== 0 || (this.extra.get(i) ?? 0) > 0
  }

  caminable(tx: number, ty: number): boolean {
    return !this.bloqueado(tx, ty)
  }

  bloqueadoPx(x: number, y: number): boolean {
    return this.bloqueado(Math.floor(x / this.cuadro), Math.floor(y / this.cuadro))
  }

  /** Bloquea un rectángulo de cuadros por un rato. Devuelve una función que lo libera. */
  bloquearRect(tx0: number, ty0: number, tx1: number, ty1: number): () => void {
    const ids: number[] = []
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.dentro(tx, ty)) ids.push(this.idx(tx, ty))
    for (const i of ids) this.extra.set(i, (this.extra.get(i) ?? 0) + 1)
    let liberado = false
    return () => {
      if (liberado) return
      liberado = true
      for (const i of ids) {
        const n = (this.extra.get(i) ?? 1) - 1
        if (n <= 0) this.extra.delete(i)
        else this.extra.set(i, n)
      }
    }
  }

  centroDe(tx: number, ty: number): Punto {
    return { x: tx * this.cuadro + this.cuadro / 2, y: ty * this.cuadro + this.cuadro / 2 }
  }

  cuadroDe(x: number, y: number): { tx: number; ty: number } {
    return { tx: Math.floor(x / this.cuadro), ty: Math.floor(y / this.cuadro) }
  }

  /** ¿Un círculo de radio r en (x, y) cabe sin tocar ningún cuadro bloqueado? */
  circuloLibre(x: number, y: number, r: number): boolean {
    const c = this.cuadro
    const tx0 = Math.floor((x - r) / c)
    const tx1 = Math.floor((x + r) / c)
    const ty0 = Math.floor((y - r) / c)
    const ty1 = Math.floor((y + r) / c)
    const r2 = r * r
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!this.bloqueado(tx, ty)) continue
        const nx = Math.max(tx * c, Math.min(x, tx * c + c))
        const ny = Math.max(ty * c, Math.min(y, ty * c + c))
        const dx = x - nx
        const dy = y - ny
        if (dx * dx + dy * dy < r2) return false
      }
    }
    return true
  }

  /** ¿Se puede ir en línea recta de un punto al otro con un círculo de radio r? */
  lineaLibre(x0: number, y0: number, x1: number, y1: number, r: number): boolean {
    const dx = x1 - x0
    const dy = y1 - y0
    const largo = Math.hypot(dx, dy)
    const pasos = Math.max(1, Math.ceil(largo / 4))
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos
      if (!this.circuloLibre(x0 + dx * t, y0 + dy * t, r)) return false
    }
    return true
  }

  /** Cuadro caminable más cercano a (tx, ty) dentro de `radio` cuadros, buscando por anillos. null si no hay. */
  cercanoCaminable(tx: number, ty: number, radio: number): { tx: number; ty: number } | null {
    if (this.caminable(tx, ty)) return { tx, ty }
    for (let d = 1; d <= radio; d++) {
      let mejor: { tx: number; ty: number } | null = null
      let mejorD = Infinity
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue
          const x = tx + dx
          const y = ty + dy
          if (!this.caminable(x, y)) continue
          const dd = dx * dx + dy * dy
          if (dd < mejorD) {
            mejorD = dd
            mejor = { tx: x, ty: y }
          }
        }
      }
      if (mejor) return mejor
    }
    return null
  }

  /** Punto libre para un círculo de radio r lo más cerca posible de (x, y), buscando en espiral. null si no hay. */
  puntoLibreCerca(x: number, y: number, r: number, maxPx = 160): Punto | null {
    if (this.circuloLibre(x, y, r)) return { x, y }
    for (let d = 8; d <= maxPx; d += 8) {
      let mejor: Punto | null = null
      let mejorD = Infinity
      const n = Math.max(8, Math.round((d * 2 * Math.PI) / 8))
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const px = x + Math.cos(a) * d
        const py = y + Math.sin(a) * d
        if (!this.circuloLibre(px, py, r)) continue
        const dd = (px - x) ** 2 + (py - y) ** 2
        if (dd < mejorD) {
          mejorD = dd
          mejor = { x: px, y: py }
        }
      }
      if (mejor) return mejor
    }
    return null
  }
}
