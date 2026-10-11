import { describe, expect, it } from 'vitest'
import { capaDe, cuerpoJefe, posParalaje, tapa } from '../capas'

describe('capas del taller', () => {
  it('lee la capa del manifest y lo demás va con los objetos', () => {
    expect(capaDe({ capa: 'suelo' })).toBe('suelo')
    expect(capaDe({ capa: 'frente' })).toBe('frente')
    expect(capaDe({ capa: 'fondo' })).toBe('fondo')
    expect(capaDe({})).toBe('objetos')
    expect(capaDe({ capa: 'otra' })).toBe('objetos')
  })

  it('el paralaje deja la cosa en su lugar en el centro y la corre afuera', () => {
    expect(posParalaje(500, 500, 1.15)).toBe(500)
    expect(posParalaje(600, 500, 1.15)).toBe(615)
    expect(posParalaje(600, 500, 0.6)).toBe(560)
    expect(Number.isInteger(posParalaje(601, 499.3, 1.15))).toBe(true)
  })

  it('el frente tapa a la heroína solo si está detrás', () => {
    const r = { x0: 100, y0: 100, x1: 200, y1: 180 }
    expect(tapa(r, 150, 160)).toBe(true)
    expect(tapa(r, 400, 160)).toBe(false)
  })
})

describe('jefes grandes', () => {
  it('a celda 96 el cuerpo es el de siempre y a 128 crece en la misma proporción', () => {
    expect(cuerpoJefe(96, { radio: 30, alto: 72 })).toEqual({ radio: 30, alto: 72 })
    expect(cuerpoJefe(128, { radio: 30, alto: 72 })).toEqual({ radio: 40, alto: 96 })
    expect(cuerpoJefe(192, { radio: 30, alto: 72 }).alto).toBe(144)
  })
})
