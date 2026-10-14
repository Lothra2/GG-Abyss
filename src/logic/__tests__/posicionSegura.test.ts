import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'
import { posicionSegura } from '../lugar'

// 10 x 10 cuadros de 32: borde de pared, un cuarto encerrado arriba a la derecha
function grilla(): Grilla {
  const W = 10
  const colision = Array.from({ length: W * W }, (_, i) => {
    const x = i % W
    const y = Math.floor(i / W)
    if (x === 0 || y === 0 || x === W - 1 || y === W - 1) return 1
    if ((x === 6 && y <= 4) || (y === 4 && x >= 6)) return 1
    return 0
  })
  return new Grilla({ ancho: W, alto: W, cuadro: 32, colision: Uint8Array.from(colision) })
}

describe('la heroína nunca queda trancada (F13, pedido de Rick)', () => {
  const g = grilla()
  const inicio = { x: 2 * 32 + 16, y: 7 * 32 + 16 }
  it('un lugar bueno se queda igual', () => {
    expect(posicionSegura(g, { x: 3 * 32 + 16, y: 6 * 32 + 16 }, inicio)).toEqual({ x: 3 * 32 + 16, y: 6 * 32 + 16 })
  })
  it('fuera del mapa o en la pared, va al lugar bueno más cercano', () => {
    const p = posicionSegura(g, { x: 5 * 32, y: 10 * 32 + 30 }, inicio)
    expect(p.y).toBeLessThan(9 * 32)
    expect(g.circuloLibre(p.x, p.y, 8)).toBe(true)
  })
  it('en un cuarto encerrado (no se llega caminando), sale del cuarto', () => {
    const p = posicionSegura(g, { x: 8 * 32 + 16, y: 2 * 32 + 16 }, inicio)
    expect(p.y > 4 * 32 || p.x < 6 * 32).toBe(true)
  })
  it('sin nada cerca, el inicio', () => {
    expect(posicionSegura(g, { x: 99999, y: 99999 }, inicio)).toEqual(inicio)
  })
})
