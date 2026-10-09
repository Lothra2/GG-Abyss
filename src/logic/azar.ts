/** RNG con semilla (mulberry32). Misma semilla, misma secuencia, en el juego y en los tests. */
export class Azar {
  private estado: number
  readonly semilla: number

  constructor(semilla: number) {
    this.semilla = semilla >>> 0
    this.estado = this.semilla
  }

  /** número en [0, 1) */
  next(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0
    let t = this.estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** entero en [min, max] los dos incluidos */
  entero(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** decimal en [min, max) */
  rango(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** true con probabilidad p (0 a 1) */
  prob(p: number): boolean {
    return this.next() < p
  }

  elegir<T>(lista: readonly T[]): T {
    if (lista.length === 0) throw new Error('No se puede elegir de una lista vacía')
    return lista[Math.floor(this.next() * lista.length)] as T
  }

  /** elige según pesos: [[valor, peso], ...] */
  pesos<T>(lista: readonly (readonly [T, number])[]): T {
    const total = lista.reduce((s, [, p]) => s + p, 0)
    let r = this.next() * total
    for (const [v, p] of lista) {
      r -= p
      if (r < 0) return v
    }
    return lista[lista.length - 1]![0]
  }

  /** copia de la lista mezclada */
  mezclar<T>(lista: readonly T[]): T[] {
    const a = [...lista]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  }
}

/** Hash determinista de dos números a [0, 1): fases fijas por posición (viento, parpadeos) */
export function hash2(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

let azarJuego = new Azar(Date.now())
let azarFx = new Azar(Date.now() ^ 0x9e3779b9)

/** Fija la semilla de todo el juego (`?seed=N`). El de efectos va aparte para que las partículas no cambien el combate. */
export function fijarSemilla(semilla: number): void {
  azarJuego = new Azar(semilla)
  azarFx = new Azar(semilla ^ 0x9e3779b9)
}

export function juego(): Azar {
  return azarJuego
}

export function fx(): Azar {
  return azarFx
}

export function semillaActual(): number {
  return azarJuego.semilla
}
