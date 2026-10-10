import { describe, expect, it } from 'vitest'
import { elegirDestino, posicionFlecha, RelojGuia } from '../guia'
import type { Zona } from '../../kit/mapa'
import { DIRECCIONES } from '../direccion'
import { GUIA } from '../../config/balance'

const z = (nombre: string, x: number, y: number, extra: Partial<Zona> = {}): Zona => ({
  nombre, x, y, w: 100, h: 100, area: 10000, musica: 'bosque', ambiente: 'bosque', luz: null, oscuridad: 0, niebla: 0.3, particulas: [], descubrir: true, secreto: false, props: {}, ...extra,
})
const zonas = [z('Cerca', 200, 0), z('Lejos', 2000, 0), z('Secreta', 100, 0, { secreto: true }), z('Arena', 5000, 5000)]
const base = { heroe: { x: 0, y: 0 }, nivel: 1, zonas, descubiertas: [] as string[], arena: { x: 5050, y: 5050 }, jefeVencido: false, portal: { x: 5050, y: 4900 } }

describe('flecha guía', () => {
  it('apunta a la zona sin descubrir más cercana, nunca a una secreta ni a la arena antes de tiempo', () => {
    expect(elegirDestino(base)!.nombre).toBe('Cerca')
    expect(elegirDestino({ ...base, descubiertas: ['Cerca'] })!.nombre).toBe('Lejos')
    expect(elegirDestino({ ...base, descubiertas: ['Cerca', 'Lejos'] })!.tipo).toBe('arena')
  })
  it('con nivel suficiente va a la arena y después de ganar, al portal', () => {
    expect(elegirDestino({ ...base, nivel: GUIA.nivelParaJefe })!.tipo).toBe('arena')
    expect(elegirDestino({ ...base, jefeVencido: true })!.tipo).toBe('portal')
  })
  it('aparece solo después de un rato sin progreso', () => {
    const r = new RelojGuia(40)
    r.tick(39)
    expect(r.visible).toBe(false)
    r.tick(2)
    expect(r.visible).toBe(true)
    r.progreso()
    expect(r.visible).toBe(false)
  })
  it('se pone en el borde de la vista mirando al destino, y no aparece si el destino se ve', () => {
    const vista = { x: 0, y: 0, w: 640, h: 360 }
    const h = { x: 320, y: 180 }
    const der = posicionFlecha(vista, h, { x: 3000, y: 180 })!
    expect(der.x).toBe(640 - GUIA.margen)
    expect(DIRECCIONES[der.dir]).toBe('right')
    const arr = posicionFlecha(vista, h, { x: 320, y: -2000 })!
    expect(arr.y).toBe(GUIA.margen)
    expect(DIRECCIONES[arr.dir]).toBe('up')
    const abajo = posicionFlecha(vista, h, { x: 320, y: 3000 })!
    expect(abajo.y).toBe(360 - GUIA.margenAbajo)
    expect(posicionFlecha(vista, h, { x: 500, y: 200 })).toBeNull()
  })
})
