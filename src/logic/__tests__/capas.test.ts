import { describe, expect, it } from 'vitest'
import { bordeFrente, capaDe, corrimientoTira, cuerpoJefe, esColumnaFrente, frenteDeZona, posParalaje, tapa } from '../capas'

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

describe('primer plano por zona', () => {
  it('lee los ids de la propiedad frente de la zona', () => {
    expect(frenteDeZona({ frente: 'frente_ramas_0, frente_hojas_1,,' })).toEqual(['frente_ramas_0', 'frente_hojas_1'])
    expect(frenteDeZona({})).toEqual([])
    expect(frenteDeZona(undefined)).toEqual([])
  })

  it('las ramas cuelgan de arriba y las hojas suben de abajo', () => {
    expect(bordeFrente({ h: 96, apoyo: [128, 0] })).toBe('arriba')
    expect(bordeFrente({ h: 64, apoyo: [64, 64] })).toBe('abajo')
  })

  it('la tira se corre un poco más que el mundo y nunca sale del período', () => {
    for (const sx of [0, 100, 1234.5, 99999, -50]) {
      const d = corrimientoTira(sx, 256)
      expect(d).toBeLessThanOrEqual(0)
      expect(d).toBeGreaterThan(-256 - 1)
      expect(Number.isInteger(d)).toBe(true)
    }
    expect(corrimientoTira(0, 256)).toBe(0)
  })
})

describe('el primer plano no tapa el juego', () => {
  it('una columna que sube de abajo no va; las raíces que cuelgan y las hojas sí', () => {
    expect(esColumnaFrente({ w: 64, h: 256, apoyo: [32, 256] })).toBe(true)
    expect(esColumnaFrente({ w: 128, h: 160, apoyo: [64, 0] })).toBe(false)
    expect(esColumnaFrente({ w: 40, h: 200, apoyo: [20, 0] })).toBe(false)
    expect(esColumnaFrente({ w: 96, h: 64, apoyo: [48, 64] })).toBe(false)
  })
})
