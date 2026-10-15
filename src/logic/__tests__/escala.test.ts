import { describe, expect, it } from 'vitest'
import { ALTO_CSS_TELEFONO, ALTO_LOGICO_GRANDE, ALTO_LOGICO_MIN, ALTO_LOGICO_MIN_TELEFONO, ALTO_MUNDO_MIN, PANEL_ALTO, PANEL_ANCHO_PARTIDO, calcularEscala, pantallaChica, zoomCamara } from '../escala'

describe('calcularEscala', () => {
  it('iPad 1180 x 820 con dpr 2: zoom 4 y vista 590 x 410 (con 5 el inventario no cabría)', () => {
    const e = calcularEscala(1180, 820, 2)
    expect(e.zoom).toBe(4)
    expect(e.ancho).toBe(590)
    expect(e.alto).toBe(410)
    expect(e.Wp).toBe(2360)
    expect(e.Hp).toBe(1640)
  })

  it('escritorio 1280 x 720 con dpr 1: zoom 2 y vista 640 x 360', () => {
    const e = calcularEscala(1280, 720, 1)
    expect(e.zoom).toBe(2)
    expect(e.ancho).toBe(640)
    expect(e.alto).toBe(360)
  })

  it('960 x 540 con dpr 1: zoom 1 y vista 960 x 540 (el encuadre de las postales)', () => {
    const e = calcularEscala(960, 540, 1)
    expect(e.zoom).toBe(1)
    expect(e.ancho).toBe(960)
    expect(e.alto).toBe(540)
  })

  it('1920 x 1080 con dpr 1: zoom 3 y vista 640 x 360, el mismo encuadre que la compu de 720 p', () => {
    const e = calcularEscala(1920, 1080, 1)
    expect(e.zoom).toBe(3)
    expect(e.ancho).toBe(640)
    expect(e.alto).toBe(360)
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

  it('el alto lógico siempre mide al menos el mínimo cuando la pantalla lo tiene en pixeles físicos', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      for (const h of [400, 410, 540, 600, 720, 820, 1080, 1440]) {
        const e = calcularEscala(1000, h / dpr, dpr)
        // los teléfonos acostados buscan menos alto (ver el test de abajo)
        if (e.Hp >= ALTO_LOGICO_MIN && h / dpr >= ALTO_CSS_TELEFONO) expect(e.alto).toBeGreaterThanOrEqual(ALTO_LOGICO_MIN)
      }
    }
  })

  it('en un teléfono acostado se ve lo mismo que en la tablet, no el doble de mundo a la mitad', () => {
    // iPhone 14 a pantalla completa, Galaxy S23 a pantalla completa y con la barra de Chrome, iPhone SE en Safari
    for (const [w, h, dpr] of [[844, 390, 3], [780, 360, 3], [780, 304, 3], [667, 325, 2], [932, 430, 3]] as const) {
      const e = calcularEscala(w, h, dpr)
      expect(e.alto).toBeGreaterThanOrEqual(ALTO_LOGICO_MIN_TELEFONO)
      expect(e.alto).toBeLessThan(ALTO_LOGICO_GRANDE)
      expect(pantallaChica(e)).toBe(true)
    }
    // la tablet y la compu no cambian
    expect(calcularEscala(1180, 820, 2).zoom).toBe(4)
    expect(calcularEscala(1280, 720, 1).zoom).toBe(2)
    // una ventana de 540 a 639 de alto con zoom 1 (las postales) lleva textos x2
    expect(pantallaChica(calcularEscala(960, 540, 1))).toBe(false)
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

  it('F14: el inventario siempre cabe a x1, entero o partido en dos', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      for (const [w, h] of [[1180, 820], [1366, 1024], [1024, 768], [1280, 800], [1280, 720], [1920, 1080], [2560, 1440], [844, 390], [667, 325], [800, 1280]]) {
        const e = calcularEscala(w!, h!, dpr)
        if (e.zoom > 1) expect(e.alto >= PANEL_ALTO || e.ancho >= PANEL_ANCHO_PARTIDO, `${w}x${h}@${dpr}`).toBe(true)
      }
    }
  })

  it('la tablet, la compu y las postales ven el mundo sin agrandar más la cámara: el zoom entero ya lo acerca', () => {
    expect(zoomCamara(calcularEscala(1280, 720, 1).alto)).toBe(1)
    expect(zoomCamara(calcularEscala(1366, 768, 1).alto)).toBe(1)
    expect(zoomCamara(calcularEscala(1180, 820, 2).alto)).toBe(1)
    expect(zoomCamara(calcularEscala(960, 540, 1).alto)).toBe(1)
    // las compus ven entre 320 y 460 de alto del mundo (la MacBook queda en 450 para que quepa el inventario)
    for (const [w, h, d] of [[1280, 720, 1], [1920, 1080, 1], [2560, 1440, 1], [1440, 900, 2]] as const) {
      const e = calcularEscala(w, h, d)
      const alto = e.alto / zoomCamara(e.alto)
      expect(alto, `${w}x${h}@${d}`).toBeGreaterThanOrEqual(ALTO_MUNDO_MIN)
      expect(alto, `${w}x${h}@${d}`).toBeLessThanOrEqual(460)
    }
    // la tablet sigue como estaba: 410
    expect(calcularEscala(1180, 820, 2).alto / zoomCamara(calcularEscala(1180, 820, 2).alto)).toBe(410)
  })

  it('lo que se ve del mundo nunca baja del alto mínimo si la pantalla lo tiene', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (const [w, h] of [[800, 600], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [1180, 820]]) {
        const e = calcularEscala(w!, h!, dpr)
        const z = zoomCamara(e.alto)
        expect(Number.isInteger(z)).toBe(true)
        if (e.alto >= ALTO_MUNDO_MIN) expect(e.alto / z).toBeGreaterThanOrEqual(ALTO_MUNDO_MIN)
      }
    }
  })
})
