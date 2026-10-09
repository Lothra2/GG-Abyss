import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'

/** Mapa de prueba chico: # bloquea, . libre */
function mapaDe(filas: string[]): Grilla {
  const alto = filas.length
  const ancho = filas[0]!.length
  const colision = new Uint8Array(ancho * alto)
  filas.forEach((f, y) => [...f].forEach((c, x) => (colision[y * ancho + x] = c === '#' ? 1 : 0)))
  return new Grilla({ ancho, alto, cuadro: 32, colision })
}

describe('Grilla', () => {
  it('fuera del mapa cuenta como bloqueado', () => {
    const g = mapaDe(['...', '...'])
    expect(g.bloqueado(-1, 0)).toBe(true)
    expect(g.bloqueado(3, 0)).toBe(true)
    expect(g.bloqueado(0, 2)).toBe(true)
    expect(g.caminable(1, 1)).toBe(true)
  })

  it('círculo libre respeta los bordes de los cuadros bloqueados', () => {
    const g = mapaDe(['...', '.#.', '...'])
    // el cuadro del medio va de 32 a 64
    expect(g.circuloLibre(16, 16, 8)).toBe(true)
    expect(g.circuloLibre(28, 48, 8)).toBe(false)
    expect(g.circuloLibre(20, 48, 8)).toBe(true)
    expect(g.circuloLibre(48, 48, 1)).toBe(false)
  })

  it('línea libre no pasa por una pared', () => {
    const g = mapaDe(['.....', '..#..', '.....'])
    expect(g.lineaLibre(16, 48, 144, 48, 6)).toBe(false)
    expect(g.lineaLibre(16, 16, 144, 16, 6)).toBe(true)
  })

  it('cercano caminable busca por anillos y devuelve null si no hay', () => {
    const g = mapaDe(['###', '#.#', '###'])
    expect(g.cercanoCaminable(0, 0, 1)).toEqual({ tx: 1, ty: 1 })
    expect(mapaDe(['###', '###']).cercanoCaminable(0, 0, 3)).toBeNull()
    expect(g.cercanoCaminable(1, 1, 3)).toEqual({ tx: 1, ty: 1 })
  })

  it('puntoLibreCerca saca a un círculo de una pared', () => {
    const g = mapaDe(['...', '.#.', '...'])
    const p = g.puntoLibreCerca(48, 48, 8)!
    expect(g.circuloLibre(p.x, p.y, 8)).toBe(true)
  })

  it('bloquearRect cierra un paso y se libera una sola vez', () => {
    const g = mapaDe(['...', '...'])
    const liberar = g.bloquearRect(1, 0, 1, 1)
    expect(g.bloqueado(1, 0)).toBe(true)
    expect(g.bloqueado(1, 1)).toBe(true)
    liberar()
    liberar()
    expect(g.bloqueado(1, 0)).toBe(false)
  })

  it('dos bloqueos sobre el mismo cuadro se cuentan', () => {
    const g = mapaDe(['...'])
    const a = g.bloquearRect(1, 0, 1, 0)
    const b = g.bloquearRect(1, 0, 1, 0)
    a()
    expect(g.bloqueado(1, 0)).toBe(true)
    b()
    expect(g.bloqueado(1, 0)).toBe(false)
  })
})
