import { describe, expect, it } from 'vitest'
import { acercarTinte, aEntero, multiplicarTinte, tinteDeLuces } from '../luzPersonaje'
import { LUZ_PERSONAJE } from '../../config/juego'

const fogata = { x: 100, y: 100, r: 120, color: '#ff9040' }
const cristal = { x: 400, y: 100, r: 120, color: '#60a0ff' }

describe('la luz pinta a los personajes', () => {
  it('lejos de toda luz no hay tinte', () => {
    expect(tinteDeLuces(1000, 1000, [fogata, cristal], 0.8, LUZ_PERSONAJE)).toEqual([255, 255, 255])
  })

  it('junto a la fogata se pone tibia y junto al cristal se pone fría', () => {
    const tibia = tinteDeLuces(110, 110, [fogata, cristal], 0.8, LUZ_PERSONAJE)
    expect(tibia[0]).toBeGreaterThan(tibia[2])
    const fria = tinteDeLuces(410, 110, [fogata, cristal], 0.8, LUZ_PERSONAJE)
    expect(fria[2]).toBeGreaterThan(fria[0])
  })

  it('su propio farol no la pinta, y nunca pasa del tope', () => {
    expect(tinteDeLuces(100, 100, [{ ...fogata, heroina: true }], 1, LUZ_PERSONAJE)).toEqual([255, 255, 255])
    const muchas = Array.from({ length: 20 }, () => fogata)
    const t = tinteDeLuces(100, 100, muchas, 1, LUZ_PERSONAJE)
    // con el tope el canal más bajo no baja de lo que permite
    expect(t[2]).toBeGreaterThanOrEqual(Math.floor(255 - (255 - 64) * LUZ_PERSONAJE.tope) - 1)
    // la luz tiñe, no apaga: el canal más fuerte queda en 255
    expect(Math.max(...t)).toBe(255)
  })

  it('en lo oscuro la luz pinta más que de día', () => {
    const dia = tinteDeLuces(130, 100, [fogata], 0, LUZ_PERSONAJE)
    const noche = tinteDeLuces(130, 100, [fogata], 1, LUZ_PERSONAJE)
    expect(noche[2]).toBeLessThan(dia[2])
  })

  it('el cambio es suave y los tintes se juntan', () => {
    expect(acercarTinte([255, 255, 255], [255, 155, 55], 0.5)).toEqual([255, 205, 155])
    expect(multiplicarTinte(0xffffff, 0xffa0a0)).toBe(0xffa0a0)
    expect(multiplicarTinte(0x808080, 0xffffff)).toBe(0x808080)
    expect(aEntero([255, 128.4, 0])).toBe(0xff8000)
  })

  it('una luz con un color mal escrito no rompe nada', () => {
    expect(tinteDeLuces(100, 100, [{ ...fogata, color: 'rojo' }], 1, LUZ_PERSONAJE)).toEqual([255, 255, 255])
  })
})
