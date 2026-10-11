import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'
import { caminarDireccion, cuadrosDe, faseImpacto, moverCuerpo, ritmoAnim, seguirCamino } from '../movimiento'

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


describe('movimiento premium', () => {
  it('el ritmo hace que los pies no patinen y sin avance queda en 1', () => {
    // 8 cuadros a 10 fps avanzando 64 px por ciclo: a 80 px/s el ritmo es 1
    expect(ritmoAnim(80, { cuadros: 8, fps: 10, avance: 64 })).toBeCloseTo(1)
    expect(ritmoAnim(105, { cuadros: 8, fps: 10, avance: 64 })).toBeGreaterThan(1)
    expect(ritmoAnim(105, { cuadros: 8, fps: 10 })).toBe(1)
    expect(ritmoAnim(9999, { cuadros: 8, fps: 10, avance: 1 })).toBe(1.5)
    // con velocidad_natural del kit: ritmo = velocidad / natural, con el mismo tope
    expect(ritmoAnim(80, { cuadros: 8, fps: 10, velocidad_natural: 80 })).toBeCloseTo(1)
    expect(ritmoAnim(105, { cuadros: 8, fps: 10, avance: 13.2, velocidad_natural: 16.5 })).toBe(1.5)
    expect(ritmoAnim(1, { cuadros: 8, fps: 10, avance: 64 })).toBe(0.7)
  })

  it('lee los cuadros de los pasos y la fase del golpe', () => {
    const a = { cuadros: 8, fps: 10, eventos: [{ tipo: 'paso', cuadro: 0 }, { tipo: 'paso', cuadro: 4 }, { tipo: 'impacto', cuadro: 3, fase: 0.5 }] }
    expect(cuadrosDe(a, 'paso')).toEqual([0, 4])
    expect(cuadrosDe({}, 'paso')).toBeNull()
    expect(faseImpacto(a)).toBeCloseTo(3.5 / 8)
    expect(faseImpacto({ cuadros: 8 })).toBeNull()
  })
})
