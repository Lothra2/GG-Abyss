import { describe, expect, it } from 'vitest'
import { aMinimapa, aTexto, CELDA_NIEBLA, deTexto, Niebla } from '../niebla'

describe('niebla del minimapa', () => {
  it('empieza todo tapado y se descubre alrededor de la heroína', () => {
    const n = new Niebla(120, 90, 32)
    expect(n.avance).toBe(0)
    expect(n.vistoEn(500, 500)).toBe(false)
    expect(n.revelar(500, 500)).toBeGreaterThan(0)
    expect(n.vistoEn(500, 500)).toBe(true)
    expect(n.vistoEn(3000, 2000)).toBe(false)
    expect(n.avance).toBeGreaterThan(0)
  })

  it('revelar dos veces lo mismo no cuenta de nuevo', () => {
    const n = new Niebla(40, 40, 32)
    n.revelar(300, 300)
    expect(n.revelar(300, 300)).toBe(0)
  })

  it('se guarda como texto y vuelve igual', () => {
    const n = new Niebla(120, 90, 32)
    n.revelar(100, 100)
    n.revelar(2000, 1500)
    const m = new Niebla(120, 90, 32, n.texto)
    expect(m.texto).toBe(n.texto)
    expect(m.avance).toBeCloseTo(n.avance, 6)
    expect(m.vistoEn(2000, 1500)).toBe(true)
  })

  it('no se sale del mapa en los bordes', () => {
    const n = new Niebla(10, 10, 32)
    expect(() => n.revelar(-500, -500, 2000)).not.toThrow()
    expect(n.avance).toBe(1)
  })

  it('un texto roto no rompe nada', () => {
    const n = new Niebla(30, 30, 32, '%%%basura')
    expect(n.avance).toBeGreaterThanOrEqual(0)
    expect(n.avance).toBeLessThanOrEqual(1)
  })

  it('el texto en base64 va y vuelve para cualquier largo', () => {
    for (const largo of [1, 2, 3, 4, 5, 17, 100]) {
      const b = new Uint8Array(largo).map((_, i) => (i * 37 + 11) & 255)
      expect(Array.from(deTexto(aTexto(b), largo))).toEqual(Array.from(b))
    }
  })

  it('cada celda mide CELDA_NIEBLA cuadros', () => {
    const n = new Niebla(120, 90, 32)
    expect(n.lado).toBe(32 * CELDA_NIEBLA)
    expect(n.w).toBe(Math.ceil(120 / CELDA_NIEBLA))
  })
})

describe('puntos en el minimapa', () => {
  it('el centro de la vista cae en el centro del minimapa', () => {
    const p = aMinimapa(500, 400, { x: 0, y: 0, w: 1000, h: 800 }, 100, 80)
    expect(p).toEqual({ x: 50, y: 40, dentro: true })
    expect(aMinimapa(-10, 400, { x: 0, y: 0, w: 1000, h: 800 }, 100, 80).dentro).toBe(false)
  })
})
