import { describe, expect, it } from 'vitest'
import { meneo, reaccionDe, tocaReaccion } from '../reaccion'

describe('qué reacciona', () => {
  it('arbustos, flores, hongos y charcos sí', () => {
    expect(reaccionDe('arbusto_verde_0')?.tipo).toBe('sacudir')
    expect(reaccionDe('juncos')?.tipo).toBe('sacudir')
    expect(reaccionDe('flores_grandes_1')?.tipo).toBe('sacudir')
    expect(reaccionDe('hongos')?.tipo).toBe('rebotar')
    expect(reaccionDe('hongo_gigante_azul')?.tipo).toBe('rebotar')
    expect(reaccionDe('charco')?.tipo).toBe('salpicar')
  })

  it('los árboles, las piedras y la fogata no', () => {
    for (const n of ['roble_0', 'roca', 'fogata', 'pasto_alto', 'tocon']) expect(reaccionDe(n)).toBeNull()
  })
})

describe('cuándo reacciona', () => {
  const r = reaccionDe('arbusto')!

  it('al pasar pegado a los pies sí, lejos o por arriba de la copa no', () => {
    expect(tocaReaccion(r, 32, 100, 100, 110, 104)).toBe(true)
    expect(tocaReaccion(r, 32, 100, 100, 200, 100)).toBe(false)
    expect(tocaReaccion(r, 32, 100, 100, 100, 40)).toBe(false)
  })
})

describe('el meneo', () => {
  it('empieza movido y termina quieto', () => {
    for (const n of ['arbusto', 'hongos', 'charco']) {
      const r = reaccionDe(n)!
      const ini = meneo(r, 0.05, 1)
      expect(Math.abs(ini.angulo) + Math.abs(1 - ini.sy) + Math.abs(1 - ini.sx)).toBeGreaterThan(0)
      expect(meneo(r, r.dura, 1)).toEqual({ angulo: 0, sx: 1, sy: 1, dx: 0 })
      expect(meneo(r, r.dura + 3, 1)).toEqual({ angulo: 0, sx: 1, sy: 1, dx: 0 })
    }
  })

  it('el arbusto nunca se tuerce más de 6 grados y el desplazamiento es entero', () => {
    const r = reaccionDe('arbusto')!
    for (let t = 0; t < r.dura; t += 0.01) {
      const m = meneo(r, t, -1)
      expect(Math.abs(m.angulo)).toBeLessThanOrEqual(6)
      expect(Number.isInteger(m.dx)).toBe(true)
    }
  })

  it('el hongo se aplasta: baja en y y se ensancha en x', () => {
    const m = meneo(reaccionDe('hongos')!, 0.1, 1)
    expect(m.sy).toBeLessThan(0.85)
    expect(m.sx).toBeGreaterThan(1)
  })
})
