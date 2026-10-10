import { describe, expect, it } from 'vitest'
import { DirectorMusica, estadoPedido } from '../musica'
import { MUSICA_ESTADOS } from '../../config/balance'

const calma = { alertas: 0, elite: false, fogata: false }
const correr = (d: DirectorMusica, seg: number, s: typeof calma) => {
  let e = d.estado
  for (let t = 0; t < seg; t += 0.1) e = d.tick(0.1, s)
  return e
}

describe('música por estados', () => {
  it('pide según la situación', () => {
    expect(estadoPedido(calma)).toBe('explorar')
    expect(estadoPedido({ ...calma, alertas: 1 })).toBe('amenaza')
    expect(estadoPedido({ ...calma, alertas: MUSICA_ESTADOS.combateDesde })).toBe('combate')
    expect(estadoPedido({ ...calma, alertas: 1, elite: true })).toBe('combate')
    expect(estadoPedido({ ...calma, fogata: true })).toBe('descanso')
  })
  it('una rata que pasa un segundo no cambia la música', () => {
    const d = new DirectorMusica()
    expect(correr(d, 1, { ...calma, alertas: 1 })).toBe('explorar')
    expect(correr(d, 3, calma)).toBe('explorar')
  })
  it('una pelea que dura sube a amenaza y a combate, y baja recién después de un rato de calma', () => {
    const d = new DirectorMusica()
    expect(correr(d, 2, { ...calma, alertas: 1 })).toBe('amenaza')
    expect(correr(d, 6, { ...calma, alertas: 3 })).toBe('combate')
    expect(correr(d, 3, calma)).toBe('combate')
    expect(correr(d, 8, calma)).toBe('explorar')
  })
  it('después de un cambio se queda un mínimo, aunque la situación cambie enseguida', () => {
    const d = new DirectorMusica()
    correr(d, 2, { ...calma, alertas: 1 })
    expect(d.estado).toBe('amenaza')
    expect(correr(d, MUSICA_ESTADOS.minimoS - 1, { ...calma, alertas: 3 })).toBe('amenaza')
  })
  it('al lado de la fogata y sin enemigos suena el descanso', () => {
    const d = new DirectorMusica()
    expect(correr(d, 3, { ...calma, fogata: true })).toBe('descanso')
  })
})
