import { describe, expect, it } from 'vitest'
import { Azar, hash2 } from '../azar'

describe('Azar', () => {
  it('misma semilla, misma secuencia', () => {
    const a = new Azar(42)
    const b = new Azar(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('semillas distintas dan secuencias distintas', () => {
    const a = Array.from({ length: 8 }, ((r) => () => r.next())(new Azar(1)))
    const b = Array.from({ length: 8 }, ((r) => () => r.next())(new Azar(2)))
    expect(a).not.toEqual(b)
  })

  it('next queda en [0, 1)', () => {
    const r = new Azar(7)
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('entero incluye los dos extremos', () => {
    const r = new Azar(3)
    const vistos = new Set<number>()
    for (let i = 0; i < 500; i++) vistos.add(r.entero(1, 4))
    expect([...vistos].sort()).toEqual([1, 2, 3, 4])
  })

  it('prob 0 nunca y prob 1 siempre', () => {
    const r = new Azar(5)
    for (let i = 0; i < 200; i++) {
      expect(r.prob(0)).toBe(false)
      expect(r.prob(1)).toBe(true)
    }
  })

  it('pesos respeta la proporción', () => {
    const r = new Azar(11)
    let a = 0
    for (let i = 0; i < 4000; i++) if (r.pesos([['a', 3], ['b', 1]] as const) === 'a') a++
    expect(a / 4000).toBeGreaterThan(0.7)
    expect(a / 4000).toBeLessThan(0.8)
  })

  it('mezclar no pierde ni repite elementos', () => {
    const r = new Azar(9)
    const m = r.mezclar([1, 2, 3, 4, 5, 6])
    expect([...m].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('elegir de una lista vacía avisa', () => {
    expect(() => new Azar(1).elegir([])).toThrow()
  })

  it('hash2 es estable y queda en [0, 1)', () => {
    expect(hash2(10, 20)).toBe(hash2(10, 20))
    expect(hash2(10, 20)).not.toBe(hash2(20, 10))
    const v = hash2(123, 456)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  })
})
