import { describe, expect, it } from 'vitest'
import { arenaSellada, claveLlave, llaveDeArena } from '../llave'

describe('la llave de la arena (F13)', () => {
  const arena = { x: 1000, y: 1000 }
  const guardian = { id: 7, x: 1100, y: 900, nombre: 'El Guardián de la Puerta' }
  const reina = { id: 3, x: 200, y: 300, nombre: 'La Reina Escarcha' }
  it('el minijefe es el élite más cerca de la arena (el lejano queda opcional)', () => {
    expect(llaveDeArena([reina, guardian], arena)).toBe(guardian)
    expect(llaveDeArena([], arena)).toBeNull()
    expect(llaveDeArena([reina], null)).toBeNull()
  })
  it('sellada hasta vencerlo, o si el jefe ya cayó', () => {
    expect(arenaSellada(guardian, [], false)).toBe(true)
    expect(arenaSellada(guardian, [claveLlave(7)], false)).toBe(false)
    expect(arenaSellada(guardian, [], true)).toBe(false)
    expect(arenaSellada(null, [], false)).toBe(false)
  })
})
