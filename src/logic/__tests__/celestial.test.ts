import { describe, expect, it } from 'vitest'
import { bonosCelestial, danoLanza, empezarVuelo, haloCelestial, pasoVuelo, vidaCelestial } from '../celestial'
import { empezarCiclo, migrar, partidaNueva } from '../guardado'
import { CELESTIAL } from '../../config/balance'

describe('la heroína celestial', () => {
  it('más vida, daño y luz, solo si es celestial', () => {
    expect(bonosCelestial(false)).toEqual({})
    expect(bonosCelestial(true).danoPct).toBe(CELESTIAL.danoPct)
    expect(vidaCelestial(200, true)).toBe(Math.round(200 * (1 + CELESTIAL.vidaPct / 100)))
    expect(vidaCelestial(200, false)).toBe(200)
    expect(haloCelestial(100, true)).toBeGreaterThan(100)
  })

  it('las alas: un vuelo corto que llega a su distancia y sube en el medio', () => {
    const v = empezarVuelo(0, 0, 3, 4)
    let p = pasoVuelo(v, v.dur / 2)
    expect(p.alto).toBeGreaterThan(10)
    expect(p.llego).toBe(false)
    p = pasoVuelo(v, v.dur)
    expect(p.llego).toBe(true)
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(CELESTIAL.alas.distancia)
  })

  it('la lanza de luz pega más que un golpe', () => {
    expect(danoLanza(10)).toBeGreaterThan(10)
  })
})

describe('el Ciclo 2', () => {
  it('vuelve al Bosque con lo de la heroína y los mundos reiniciados', () => {
    const p = partidaNueva('sophie')
    p.nivel = 10
    p.oro = 900
    p.equipo = { arma: 'sword_1' }
    p.mundo = 'mundo7'
    p.jefeVencido = true
    p.cofres.push('c1')
    p.otrosMundos = { mundo1: { posicion: { x: 1, y: 1 }, ultimaFogata: 'f', zonas: ['z'], secretos: [], cofres: ['x'], rompibles: [], presentacionVista: true, jefeVencido: true, brasas: [], niebla: 'n', cristales: [], faroles: [], vencidos: [] } }
    empezarCiclo(p)
    expect(p.ciclo).toBe(2)
    expect(p.celestial).toBe(true)
    expect(p.mundo).toBe('mundo1')
    expect(p.otrosMundos).toEqual({})
    expect(p.jefeVencido).toBe(false)
    expect(p.cofres).toEqual([])
    expect(p.nivel).toBe(10)
    expect(p.oro).toBe(900)
    expect(p.equipo.arma).toBe('sword_1')
    expect(empezarCiclo(p).ciclo).toBe(3)
  })

  it('el guardado recuerda el ciclo, las alas y las cinemáticas vistas', () => {
    const p = migrar({ id: 'alana', ciclo: 2, celestial: true, cines: ['bajada'] })!
    expect(p.ciclo).toBe(2)
    expect(p.celestial).toBe(true)
    expect(p.cines).toEqual(['bajada'])
    const v = migrar({ id: 'alana' })!
    expect(v.ciclo).toBe(1)
    expect(v.celestial).toBe(false)
  })
})
