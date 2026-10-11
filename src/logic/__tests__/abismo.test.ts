import { describe, expect, it } from 'vitest'
import { ABISMO, MODO_PEQUE } from '../../config/balance'
import {
  apagarConPolvo, avanceLuz, columnaAbismo, cristalEn, golpearCristal, lucesDeCristales, lugarFigura, ordenPolilla, pisoDe, reaccionFigura, reinaVulnerable,
  sombraVisible, thorBrilla, topeOscuridad, vecesFigura, type Cristal,
} from '../abismo'

const cristal = (id: string, x: number, y: number, prendido = false, grande = false): Cristal => ({ id, x, y, prendido, grande })

describe('los siete pisos', () => {
  it('son siete y el último es el Diablo', () => {
    expect(ABISMO.pisos).toHaveLength(7)
    expect(ABISMO.pisos[6]!.jefe).toBe('diablo')
  })

  it('cada mundo sabe su piso', () => {
    expect(pisoDe('mundo1')).toBe(1)
    expect(pisoDe('mundo3')).toBe(3)
    expect(pisoDe('raro')).toBe(1)
    expect(pisoDe('mundo99')).toBe(7)
  })

  it('cuanto más abajo más oscuro, salvo las fraguas que tienen luz roja', () => {
    expect(topeOscuridad(3, false)).toBeGreaterThan(topeOscuridad(1, false))
    expect(topeOscuridad(7, false)).toBe(Math.max(...ABISMO.pisos.map((p) => p.oscuridadMax)))
  })

  it('en modo peque ningún piso pasa de 0.60 y los dos primeros quedan como siempre', () => {
    for (let p = 1; p <= 7; p++) expect(topeOscuridad(p, true)).toBeLessThanOrEqual(0.6)
    expect(topeOscuridad(1, true)).toBe(MODO_PEQUE.oscuridadMax)
    expect(topeOscuridad(2, true)).toBe(MODO_PEQUE.oscuridadMax)
  })

  it('Thor brilla desde el piso 3', () => {
    expect(thorBrilla(2)).toBe(false)
    expect(thorBrilla(3)).toBe(true)
  })
})

describe('Mundo 3: la luz es el progreso', () => {
  it('pegarle prende el cristal una sola vez', () => {
    const c = cristal('a', 0, 0)
    expect(golpearCristal(c)).toBe(true)
    expect(golpearCristal(c)).toBe(false)
    expect(c.prendido).toBe(true)
  })

  it('el golpe encuentra el cristal más cercano y nada si está lejos', () => {
    const cs = [cristal('a', 100, 100), cristal('b', 130, 100)]
    expect(cristalEn(cs, 104, 100)?.id).toBe('a')
    expect(cristalEn(cs, 126, 100)?.id).toBe('b')
    expect(cristalEn(cs, 400, 400)).toBeNull()
  })

  it('el avance cuenta los chicos prendidos y las luces salen de los prendidos', () => {
    const cs = [cristal('a', 0, 0, true), cristal('b', 0, 0), cristal('g', 0, 0, true, true)]
    expect(avanceLuz(cs)).toBe(0.5)
    expect(lucesDeCristales(cs)).toHaveLength(2)
    expect(lucesDeCristales(cs).find((l) => l.r === ABISMO.cristal.radioLuzGrande)).toBeTruthy()
  })

  it('la sombra se ve dentro de la luz y no en su borde ni afuera', () => {
    const luces = [{ x: 0, y: 0, r: 100 }]
    expect(sombraVisible(20, 0, luces)).toBe(true)
    expect(sombraVisible(95, 0, luces)).toBe(false)
    expect(sombraVisible(300, 0, luces)).toBe(false)
  })

  it('la polilla va al cristal prendido más cercano, lo apaga al llegar, y sin cristales va por la heroína', () => {
    const cs = [cristal('lejos', 200, 0, true), cristal('cerca', 50, 0, true), cristal('apagado', 10, 0)]
    expect(ordenPolilla({ x: 0, y: 0 }, cs)).toEqual({ tipo: 'ir', x: 50, y: 0, cristal: 'cerca' })
    expect(ordenPolilla({ x: 48, y: 0 }, cs)).toEqual({ tipo: 'apagar', cristal: 'cerca' })
    expect(ordenPolilla({ x: 0, y: 0 }, [cristal('x', 2000, 0, true)])).toEqual({ tipo: 'heroina' })
  })

  it('la Polilla Reina solo es vulnerable con los cuatro grandes prendidos, y el polvo los apaga', () => {
    const cs = [0, 1, 2, 3].map((i) => cristal(`g${i}`, i * 100, 0, true, true))
    expect(reinaVulnerable(cs)).toBe(true)
    expect(apagarConPolvo(cs, [{ x: 100, y: 10 }], 40)).toEqual(['g1'])
    expect(reinaVulnerable(cs)).toBe(false)
    expect(reinaVulnerable([])).toBe(false)
  })
})

describe('la figura de los ojos rojos', () => {
  it('no aparece en los dos primeros pisos y cada vez más abajo', () => {
    expect(vecesFigura(1)).toBe(0)
    expect(vecesFigura(2)).toBe(0)
    expect(vecesFigura(3)).toBeGreaterThan(0)
    expect(vecesFigura(6)).toBeGreaterThan(vecesFigura(3))
  })

  it('nunca se acerca: si la heroína llega cerca se va, y Thor gruñe antes', () => {
    expect(reaccionFigura({ x: 300, y: 0 }, { x: 0, y: 0 })).toEqual({ estado: 'mirando', thorGrunne: false })
    expect(reaccionFigura({ x: 220, y: 0 }, { x: 0, y: 0 }).thorGrunne).toBe(true)
    expect(reaccionFigura({ x: 100, y: 0 }, { x: 0, y: 0 }).estado).toBe('se_va')
  })

  it('se asoma lejos, en un lugar libre, o no se asoma', () => {
    const p = lugarFigura({ x: 0, y: 0 }, 0, () => true)!
    const d = Math.hypot(p.x, p.y)
    expect(d).toBeGreaterThanOrEqual(ABISMO.figura.distMin - 1)
    expect(d).toBeLessThanOrEqual(ABISMO.figura.distMax + 1)
    expect(lugarFigura({ x: 0, y: 0 }, 0, () => false)).toBeNull()
  })
})

describe('el mapa del abismo', () => {
  it('muestra los pisos de arriba, el actual y esconde los de abajo', () => {
    const c = columnaAbismo(3)
    expect(c.map((p) => p.estado)).toEqual(['pasado', 'pasado', 'actual', 'oculto', 'oculto', 'oculto', 'oculto'])
    expect(c[3]!.nombre).toBe('?')
    expect(c[2]!.nombre).toBe('Las Galerías del Eco')
  })
})
