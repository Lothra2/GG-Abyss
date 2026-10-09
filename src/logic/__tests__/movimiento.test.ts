import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'
import { caminarDireccion, moverCuerpo, seguirCamino } from '../movimiento'

function mapaDe(filas: string[]): Grilla {
  const alto = filas.length
  const ancho = filas[0]!.length
  const colision = new Uint8Array(ancho * alto)
  filas.forEach((f, y) => [...f].forEach((c, x) => (colision[y * ancho + x] = c === '#' ? 1 : 0)))
  return new Grilla({ ancho, alto, cuadro: 32, colision })
}

describe('moverCuerpo', () => {
  it('se mueve libre en campo abierto', () => {
    const g = mapaDe(['....', '....'])
    const r = moverCuerpo(g, { x: 16, y: 16, radio: 8 }, 10, 5)
    expect(r.x).toBeCloseTo(26)
    expect(r.y).toBeCloseTo(21)
    expect(r.choco).toBe(false)
  })

  it('desliza por la pared en vez de frenar', () => {
    // pared vertical a la derecha: x >= 64
    const g = mapaDe(['..#', '..#', '..#'])
    const r = moverCuerpo(g, { x: 50, y: 48, radio: 8 }, 10, 10)
    expect(r.choco).toBe(true)
    expect(r.y).toBeGreaterThan(48) // siguió bajando
    expect(r.x).toBeLessThanOrEqual(56.01) // no entró en la pared
  })

  it('no atraviesa una pared de frente', () => {
    const g = mapaDe(['.#.'])
    const r = moverCuerpo(g, { x: 26, y: 16, radio: 8 }, 20, 0)
    expect(r.x).toBeLessThanOrEqual(26)
    expect(r.movido).toBeLessThan(1)
  })
})

describe('seguirCamino', () => {
  it('avanza por los puntos y llega', () => {
    const g = mapaDe(['........'])
    const cam = [{ x: 100, y: 16 }, { x: 200, y: 16 }]
    const c = { x: 16, y: 16, radio: 8 }
    let llego = false
    for (let i = 0; i < 100 && !llego; i++) {
      const p = seguirCamino(g, c, cam, 120, 0.05)
      c.x = p.x
      c.y = p.y
      llego = p.llego
    }
    expect(llego).toBe(true)
    expect(c.x).toBeCloseTo(200, 0)
  })

  it('con velocidad 120 recorre 6 px en 0.05 s', () => {
    const g = mapaDe(['........'])
    const p = seguirCamino(g, { x: 16, y: 16, radio: 8 }, [{ x: 200, y: 16 }], 120, 0.05)
    expect(p.x).toBeCloseTo(22, 3)
    expect(p.vx).toBe(1)
  })

  it('un cuerpo trabado contra una pared lo avisa', () => {
    const g = mapaDe(['..#'])
    const c = { x: 54, y: 16, radio: 8 }
    const p = seguirCamino(g, c, [{ x: 90, y: 16 }], 120, 0.1)
    expect(p.trabado).toBe(true)
    expect(p.llego).toBe(false)
  })
})

describe('caminarDireccion', () => {
  it('normaliza la diagonal para no ir más rápido', () => {
    const g = mapaDe(['........', '........'])
    const p = caminarDireccion(g, { x: 20, y: 20, radio: 8 }, 1, 1, 100, 0.1)
    expect(Math.hypot(p.x - 20, p.y - 20)).toBeCloseTo(10, 3)
  })

  it('sin dirección no se mueve', () => {
    const g = mapaDe(['....'])
    const p = caminarDireccion(g, { x: 20, y: 20, radio: 8 }, 0, 0, 100, 0.1)
    expect(p.x).toBe(20)
    expect(p.vx).toBe(0)
  })
})
