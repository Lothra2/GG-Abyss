import { describe, expect, it } from 'vitest'
import { abanico, habilidadesDe, Recargas } from '../habilidades'
import { HABILIDADES } from '../../config/balance'

describe('Recargas', () => {
  it('cada clase trae dos habilidades', () => {
    for (const c of Object.keys(HABILIDADES) as (keyof typeof HABILIDADES)[]) expect(habilidadesDe(c)).toHaveLength(2)
  })
  it('usar gasta maná y arranca la recarga', () => {
    const r = new Recargas('amazona')
    expect(r.usar(0, 30)).toBe(24)
    expect(r.puede(0, 30)).toBe('recargando')
    expect(r.restante(0)).toBe(4)
    r.tick(3.9)
    expect(r.puede(0, 30)).toBe('recargando')
    r.tick(0.2)
    expect(r.puede(0, 30)).toBeNull()
  })
  it('sin maná no se puede y no se gasta la recarga', () => {
    const r = new Recargas('hechicera')
    expect(r.usar(0, 5)).toBeNull()
    expect(r.restante(0)).toBe(0)
    expect(r.puede(0, 11.9)).toBe('sinMana')
  })
  it('la esquiva y el bloqueo no cuestan maná', () => {
    expect(new Recargas('amazona').usar(1, 0)).toBe(0)
    expect(new Recargas('paladin').usar(1, 0)).toBe(0)
  })
  it('la fracción va de 1 a 0', () => {
    const r = new Recargas('paladin')
    r.usar(0, 20)
    expect(r.fraccion(0)).toBe(1)
    r.tick(2.5)
    expect(r.fraccion(0)).toBeCloseTo(0.5)
  })
  it('el rayo canalizado no tiene recarga', () => {
    const r = new Recargas('hechicera')
    r.usar(1, 0)
    expect(r.puede(1, 0)).toBeNull()
  })
  it('reiniciar deja todo listo', () => {
    const r = new Recargas('druida')
    r.usar(0, 50)
    r.reiniciar()
    expect(r.puede(0, 50)).toBeNull()
  })
})

describe('abanico', () => {
  it('tres flechas a 20 grados: -10, 0 y +10 del centro', () => {
    const a = abanico(1, 3, 20)
    expect(a[1]).toBeCloseTo(1)
    expect(a[0]).toBeCloseTo(1 - (10 * Math.PI) / 180)
    expect(a[2]).toBeCloseTo(1 + (10 * Math.PI) / 180)
  })
  it('una sola va al centro', () => {
    expect(abanico(2, 1, 20)).toEqual([2])
  })
})
