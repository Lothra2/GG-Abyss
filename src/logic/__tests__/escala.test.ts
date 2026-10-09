import { describe, expect, it } from 'vitest'
import { calcularEscala } from '../escala'

describe('calcularEscala', () => {
  it('iPad 1180 x 820 con dpr 2: zoom 4 y vista 590 x 410', () => {
    const e = calcularEscala(1180, 820, 2)
    expect(e.zoom).toBe(4)
    expect(e.ancho).toBe(590)
    expect(e.alto).toBe(410)
    expect(e.Wp).toBe(2360)
    expect(e.Hp).toBe(1640)
  })

  it('escritorio 1280 x 720 con dpr 1: zoom 1 y vista 1280 x 720', () => {
    const e = calcularEscala(1280, 720, 1)
    expect(e.zoom).toBe(1)
    expect(e.ancho).toBe(1280)
    expect(e.alto).toBe(720)
  })

  it('960 x 540 con dpr 1: zoom 1 y vista 960 x 540 (el encuadre de las postales)', () => {
    const e = calcularEscala(960, 540, 1)
    expect(e.zoom).toBe(1)
    expect(e.ancho).toBe(960)
    expect(e.alto).toBe(540)
  })

  it('1920 x 1080 con dpr 1: zoom 2 y vista 960 x 540', () => {
    const e = calcularEscala(1920, 1080, 1)
    expect(e.zoom).toBe(2)
    expect(e.ancho).toBe(960)
    expect(e.alto).toBe(540)
  })

  it('el zoom siempre es entero y mayor o igual a 1', () => {
    for (const dpr of [0.75, 1, 1.25, 1.5, 2, 2.625, 3]) {
      for (const [w, h] of [[320, 568], [568, 320], [800, 600], [1024, 768], [1180, 820], [1366, 768], [1920, 1080], [2560, 1440]]) {
        const e = calcularEscala(w!, h!, dpr)
        expect(Number.isInteger(e.zoom)).toBe(true)
        expect(e.zoom).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('el alto lógico siempre mide al menos 400 cuando la pantalla tiene 400 o más pixeles físicos de alto', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      for (const h of [400, 410, 540, 600, 720, 820, 1080, 1440]) {
        const e = calcularEscala(1000, h / dpr, dpr)
        if (e.Hp >= 400) expect(e.alto).toBeGreaterThanOrEqual(400)
      }
    }
  })

  it('la vista lógica cubre toda la ventana física', () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      const e = calcularEscala(1181, 821, dpr)
      expect(e.ancho * e.zoom).toBeGreaterThanOrEqual(e.Wp)
      expect(e.alto * e.zoom).toBeGreaterThanOrEqual(e.Hp)
      // y no sobra más de un pixel lógico
      expect(e.ancho * e.zoom - e.Wp).toBeLessThan(e.zoom)
      expect(e.alto * e.zoom - e.Hp).toBeLessThan(e.zoom)
    }
  })

  it('cada pixel lógico mide exactamente zoom pixeles físicos en el canvas', () => {
    for (const dpr of [1, 1.25, 2, 3]) {
      const e = calcularEscala(1180, 820, dpr)
      expect(e.ancho * e.cssZoom * dpr).toBeCloseTo(e.ancho * e.zoom, 6)
    }
  })

  it('una pantalla de menos de 400 de alto da zoom 1', () => {
    const e = calcularEscala(640, 360, 1)
    expect(e.zoom).toBe(1)
    expect(e.alto).toBe(360)
  })

  it('un dpr roto se trata como 1', () => {
    expect(calcularEscala(1280, 720, 0).dpr).toBe(1)
    expect(calcularEscala(1280, 720, Number.NaN).dpr).toBe(1)
  })
})
