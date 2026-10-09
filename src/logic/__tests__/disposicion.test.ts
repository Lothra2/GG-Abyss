import { describe, expect, it } from 'vitest'
import { disponerTarjetas, medidasTarjeta } from '../disposicion'

describe('disponerTarjetas', () => {
  it('4 tarjetas en el iPad (590 x 410): una fila con la heroína a escala 2', () => {
    const d = disponerTarjetas(4, 590, 410)
    expect(d.escalaHeroe).toBe(2)
    expect(d.cols).toBe(4)
    expect(d.filas).toBe(1)
  })

  it('4 tarjetas en escritorio (1280 x 720) y en 960 x 540: una fila a escala 3', () => {
    for (const [w, h] of [[1280, 720], [960, 540]] as const) {
      const d = disponerTarjetas(4, w, h)
      expect(d.escalaHeroe, `${w}x${h}`).toBe(3)
      expect(d.filas).toBe(1)
    }
  })

  it('una quinta heroína del estudio entra: en el iPad pasa a dos filas', () => {
    const d = disponerTarjetas(5, 590, 410)
    expect(d.posiciones).toHaveLength(5)
    expect(d.filas).toBe(2)
    expect(d.escalaHeroe).toBeGreaterThanOrEqual(1)
  })

  it('ninguna tarjeta se sale de la vista cuando cabe', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 8]) {
      for (const [w, h] of [[590, 410], [960, 540], [1280, 720], [1366, 768], [800, 600]] as const) {
        const d = disponerTarjetas(n, w, h)
        const { w: cw, h: ch } = medidasTarjeta(d.escalaHeroe)
        expect(cw).toBe(d.w)
        expect(d.posiciones).toHaveLength(n)
        for (const p of d.posiciones) {
          expect(p.x, `n=${n} ${w}x${h}`).toBeGreaterThanOrEqual(0)
          expect(p.y).toBeGreaterThanOrEqual(0)
          expect(p.x + d.w).toBeLessThanOrEqual(w)
          expect(p.y + ch).toBeLessThanOrEqual(h)
        }
      }
    }
  })

  it('las tarjetas no se pisan', () => {
    const d = disponerTarjetas(5, 590, 410)
    for (let i = 0; i < d.posiciones.length; i++) {
      for (let j = i + 1; j < d.posiciones.length; j++) {
        const a = d.posiciones[i]!
        const b = d.posiciones[j]!
        const choca = a.x < b.x + d.w && b.x < a.x + d.w && a.y < b.y + d.h && b.y < a.y + d.h
        expect(choca, `${i} con ${j}`).toBe(false)
      }
    }
  })

  it('la última fila incompleta queda centrada', () => {
    const d = disponerTarjetas(5, 590, 410)
    const ultima = d.posiciones.filter((p) => p.y === d.posiciones[4]!.y)
    expect(ultima.length).toBeLessThan(d.cols)
    const izq = ultima[0]!.x
    const der = 590 - (ultima[ultima.length - 1]!.x + d.w)
    expect(Math.abs(izq - der)).toBeLessThanOrEqual(1)
  })

  it('una pantalla muy chica se deja en una fila a escala 1', () => {
    const d = disponerTarjetas(4, 300, 200)
    expect(d.escalaHeroe).toBe(1)
  })
})
