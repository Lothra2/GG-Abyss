import { describe, expect, it } from 'vitest'
import { activo, brasaMasCercana, cambiosAl, estadoForja } from '../brasas'

describe('brasas de la forja', () => {
  it('compuertas y braseros dependen de cuántas brasas volvieron', () => {
    expect(activo(1, 0)).toBe(false)
    expect(activo(1, 1)).toBe(true)
    expect(activo(3, 2)).toBe(false)
    expect(estadoForja(0)).toBe(0)
    expect(estadoForja(2)).toBe(2)
    expect(estadoForja(7)).toBe(3)
  })
  it('cada brasa anuncia lo que abre y prende, y la tercera enciende la forja', () => {
    const comp = [{ id: 'nave_forja', requiere: 1 }, { id: 'atajo', requiere: 2 }, { id: 'campanario', requiere: 3 }]
    const bras = [{ requiere: 1 }, { requiere: 1 }, { requiere: 2 }, { requiere: 3 }]
    expect(cambiosAl(1, comp, bras)).toEqual({ abre: ['nave_forja'], prende: 2, forjaEncendida: false })
    expect(cambiosAl(3, comp, bras)).toEqual({ abre: ['campanario'], prende: 1, forjaEncendida: true })
  })
  it('la brasa más cercana que falta', () => {
    const b = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }, { id: 'c', x: 50, y: 0 }]
    expect(brasaMasCercana(b, [], 90, 0)!.id).toBe('b')
    expect(brasaMasCercana(b, ['b'], 90, 0)!.id).toBe('c')
    expect(brasaMasCercana(b, ['a', 'b', 'c'], 0, 0)).toBeNull()
  })
})
