import { describe, expect, it } from 'vitest'
import { Medidor, percentil } from '../medidor'

describe('medidor', () => {
  it('percentil 95 de una lista', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(percentil(v, 95)).toBe(95)
    expect(percentil([], 95)).toBe(0)
  })

  it('frames: promedio, p95, peor y tirones en una ventana corta', () => {
    const m = new Medidor(10)
    for (let i = 0; i < 20; i++) m.frame(16.7)
    m.frame(50)
    const r = m.medidas()
    expect(r.muestras).toBe(10)
    expect(r.framePeorMs).toBe(50)
    expect(r.tirones).toBe(1)
    expect(r.fps).toBeGreaterThan(40)
  })

  it('respuesta: del toque al primer frame dibujado, una por toque', () => {
    const m = new Medidor()
    expect(m.medidas().respuestaMedioMs).toBeNull()
    m.entrada(1000)
    m.entrada(1005)
    m.dibujado(1020)
    m.dibujado(1040)
    m.entrada(2000)
    m.dibujado(2010)
    const r = m.medidas()
    expect(r.respuestaMedioMs).toBe(15)
    expect(r.respuestaPeorMs).toBe(20)
  })
})
