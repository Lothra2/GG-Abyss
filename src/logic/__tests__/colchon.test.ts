import { describe, expect, it } from 'vitest'
import { Colchon } from '../colchon'

describe('colchón de entrada', () => {
  it('la orden guardada sale apenas puede actuar, una sola vez', () => {
    const c = new Colchon<number>(0.15)
    c.guardar(1)
    expect(c.tick(0.05, false)).toBeNull()
    expect(c.tick(0.05, true)).toBe(1)
    expect(c.tick(0.05, true)).toBeNull()
  })
  it('si pasa la ventana se olvida: no sale un golpe viejo', () => {
    const c = new Colchon<number>(0.15)
    c.guardar(0)
    c.tick(0.1, false)
    c.tick(0.1, false)
    expect(c.pendiente).toBeNull()
    expect(c.tick(0.01, true)).toBeNull()
  })
  it('la última orden manda', () => {
    const c = new Colchon<number>(0.15)
    c.guardar(0)
    c.guardar(1)
    expect(c.tick(0, true)).toBe(1)
  })
})
