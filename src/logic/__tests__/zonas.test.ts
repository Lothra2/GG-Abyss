import { describe, expect, it } from 'vitest'
import { atmosferaDe, hexARgb, LUZ_DEFECTO, mezclar, nocheEfectiva, nocheMaxima, oscuridadFinal, zonaEn } from '../zonas'
import { leerJson } from '../../../scripts/lib/verificacion'
import { parsearMapa, type Zona } from '../../kit/mapa'
import type { Manifest, MapaTiled } from '../../kit/tipos'

const KIT = 'public/assets/kit/'
const manifest = leerJson<Manifest>(KIT + 'manifest.json')
const mapa = parsearMapa(leerJson<MapaTiled>(KIT + manifest.mundo.mapa))

const zona = (nombre: string, x: number, y: number, w: number, h: number, extra: Partial<Zona> = {}): Zona => ({
  nombre, x, y, w, h, area: w * h, musica: 'bosque', ambiente: 'bosque', luz: null, oscuridad: 0, niebla: 0.3, particulas: [], descubrir: true, secreto: false, props: {}, ...extra,
})

describe('zonaEn', () => {
  it('gana la zona más chica cuando se solapan', () => {
    const grande = zona('grande', 0, 0, 1000, 1000)
    const chica = zona('chica', 100, 100, 50, 50)
    expect(zonaEn([grande, chica], 120, 120)?.nombre).toBe('chica')
    expect(zonaEn([chica, grande], 120, 120)?.nombre).toBe('chica')
    expect(zonaEn([grande, chica], 500, 500)?.nombre).toBe('grande')
  })

  it('el borde derecho e inferior no entran, el izquierdo y el superior sí', () => {
    const z = zona('z', 10, 10, 10, 10)
    expect(zonaEn([z], 10, 10)).toBe(z)
    expect(zonaEn([z], 20, 15)).toBeNull()
    expect(zonaEn([z], 15, 20)).toBeNull()
  })

  it('fuera de toda zona da null', () => {
    expect(zonaEn([zona('z', 0, 0, 10, 10)], 50, 50)).toBeNull()
  })

  it('la llegada del Bosque GG cae en el Claro de la Llegada y el Bosque Profundo es más oscuro', () => {
    const inicio = mapa.entidades.find((e) => e.tipo === 'jugador_inicio')!
    expect(zonaEn(mapa.zonas, inicio.x, inicio.y)?.nombre).toBe('Claro de la Llegada')
    const profundo = mapa.zonas.find((z) => z.nombre === 'Bosque Profundo')!
    expect(profundo.oscuridad).toBeCloseTo(0.4)
  })
})

describe('atmósfera', () => {
  it('sin zona usa los valores por defecto', () => {
    const a = atmosferaDe(null)
    expect(a.niebla).toBeCloseTo(0.3)
    expect(a.oscuridad).toBe(0)
    expect(a.luz).toEqual(LUZ_DEFECTO)
  })

  it('hexARgb', () => {
    expect(hexARgb('#7a8ab8')).toEqual([0x7a, 0x8a, 0xb8])
  })

  it('mezclar se acerca al objetivo y nunca se pasa', () => {
    let a = atmosferaDe(null)
    const objetivo = atmosferaDe(zona('p', 0, 0, 1, 1, { oscuridad: 0.4, niebla: 0.75, luz: '#7a8ab8' }))
    let ant = a.oscuridad
    for (let i = 0; i < 200; i++) {
      a = mezclar(a, objetivo, 1 / 60)
      expect(a.oscuridad).toBeGreaterThanOrEqual(ant - 1e-9)
      expect(a.oscuridad).toBeLessThanOrEqual(0.4 + 1e-9)
      ant = a.oscuridad
    }
    expect(a.oscuridad).toBeCloseTo(0.4, 1)
    expect(Math.abs(a.luz[0] - 0x7a)).toBeLessThan(4)
  })

  it('con k = dt * 1.2 tarda 1 a 2 s en llegar a lo que pide la zona', () => {
    let a = atmosferaDe(null)
    const objetivo = atmosferaDe(zona('p', 0, 0, 1, 1, { oscuridad: 0.4 }))
    let t = 0
    while (Math.abs(a.oscuridad - 0.4) > 0.4 * 0.2 && t < 10) { a = mezclar(a, objetivo, 1 / 60); t += 1 / 60 }
    expect(t).toBeGreaterThan(0.5)
    expect(t).toBeLessThan(2.5)
  })

  it('un salto grande de dt no se pasa del objetivo', () => {
    const a = mezclar(atmosferaDe(null), atmosferaDe(zona('p', 0, 0, 1, 1, { oscuridad: 0.4 })), 5)
    expect(a.oscuridad).toBeCloseTo(0.4)
  })
})

describe('oscuridad final', () => {
  it('noche 0.15 más zona 0.40 da 0.55 (el Bosque Profundo)', () => {
    expect(oscuridadFinal(0.15, 0.4, false)).toBeCloseTo(0.55)
  })

  it('tope 0.6 siempre', () => {
    expect(oscuridadFinal(0.55, 0.4, false)).toBeCloseTo(0.6)
    expect(oscuridadFinal(5, 5, false)).toBeCloseTo(0.6)
  })

  it('en modo peque nunca pasa de 0.45', () => {
    expect(oscuridadFinal(0.15, 0.4, true)).toBeCloseTo(0.45)
    expect(oscuridadFinal(0.55, 0.4, true)).toBeCloseTo(0.45)
    expect(oscuridadFinal(0.25, 0, true)).toBeCloseTo(0.25)
  })

  it('el control de noche llega a 0.55 y a 0.25 en modo peque', () => {
    expect(nocheMaxima(false)).toBe(0.55)
    expect(nocheMaxima(true)).toBe(0.25)
    expect(nocheEfectiva(0.9, false)).toBe(0.55)
    expect(nocheEfectiva(0.9, true)).toBe(0.25)
    expect(nocheEfectiva(-1, false)).toBe(0)
  })

  it('hora dorada pura queda en 0.15', () => {
    expect(oscuridadFinal(0.15, 0, false)).toBeCloseTo(0.15)
  })

  it('las zonas oscuras del mapa llegan a 0.55 con la noche por defecto y a 0.45 en modo peque', () => {
    for (const nombre of ['Bosque Profundo', 'Anillo de las Hadas', 'Arena del Minotauro']) {
      const z = mapa.zonas.find((x) => x.nombre === nombre)!
      expect(oscuridadFinal(0.15, z.oscuridad, false)).toBeCloseTo(0.55)
      expect(oscuridadFinal(0.15, z.oscuridad, true)).toBeCloseTo(0.45)
    }
    expect(oscuridadFinal(0.15, mapa.zonas.find((x) => x.nombre === 'Claro Escondido')!.oscuridad, false)).toBeCloseTo(0.45)
  })
})
