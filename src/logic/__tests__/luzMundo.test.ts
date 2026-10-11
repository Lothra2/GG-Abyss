import { describe, expect, it } from 'vitest'
import { aguaDebajo, meneoReflejo, radioFarol, tiraSombra, type CfgSombra } from '../luzMundo'

const cfg: CfgSombra = { alfa: 0.3, largo: 0.5, angulo: -30, altoMin: 28 }

describe('sombras largas', () => {
  it('los árboles y las piedras grandes tiran sombra', () => {
    expect(tiraSombra('roble_0', { h: 160 }, cfg)).toBe(true)
    expect(tiraSombra('roca_grande', { h: 40 }, cfg)).toBe(true)
  })

  it('lo del suelo, lo que alumbra y lo bajito no', () => {
    expect(tiraSombra('puente', { h: 64, capa: 'suelo' }, cfg)).toBe(false)
    expect(tiraSombra('fogata', { h: 48, luz: { radius: 200 } }, cfg)).toBe(false)
    expect(tiraSombra('hongos', { h: 20 }, cfg)).toBe(false)
    expect(tiraSombra('pasto_alto', { h: 40 }, cfg)).toBe(false)
    expect(tiraSombra('portal_azul', { h: 96 }, cfg)).toBe(false)
  })
})

describe('reflejos', () => {
  const ancho = 10, alto = 10, cuadro = 32
  const agua = new Uint8Array(ancho * alto)
  // un lago en las filas 6 a 9
  for (let y = 6; y < 10; y++) for (let x = 0; x < ancho; x++) agua[y * ancho + x] = 1
  const m = { ancho, alto, cuadro, agua }

  it('se ve si hay agua justo debajo', () => {
    expect(aguaDebajo(m, 100, 6 * 32 - 10, 40)).toBe(true)
    expect(aguaDebajo(m, 100, 40, 40)).toBe(false)
  })

  it('no se sale del mapa', () => {
    expect(aguaDebajo(m, 5, 9 * 32 + 20, 200)).toBe(true)
    expect(aguaDebajo(m, -50, 9 * 32 + 20, 200)).toBe(false)
    expect(aguaDebajo(m, 9999, -999, 10)).toBe(false)
  })

  it('el meneo es entero y chico', () => {
    for (let t = 0; t < 5; t += 0.37) {
      const d = meneoReflejo(t, 0.3)
      expect(Number.isInteger(d)).toBe(true)
      expect(Math.abs(d)).toBeLessThanOrEqual(1)
    }
  })
})

describe('farol de la heroína', () => {
  it('en modo peque alumbra más', () => {
    expect(radioFarol(0, 120, true, 30)).toBeGreaterThan(radioFarol(0, 120, false, 30))
  })

  it('respira poquito, nunca menos del 94 % del radio', () => {
    for (let t = 0; t < 10; t += 0.1) expect(radioFarol(t, 120, false, 0)).toBeGreaterThanOrEqual(120 * 0.94)
  })
})
