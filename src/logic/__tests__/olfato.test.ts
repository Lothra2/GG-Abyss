import { describe, expect, it } from 'vitest'
import { Guia, ordenarPistas } from '../olfato'
import { OLFATO } from '../../config/balance'

describe('olfato de Thor', () => {
  it('ordena las pistas por cercanía y deja afuera las que están muy lejos', () => {
    const p = ordenarPistas(
      [
        { llave: 'a', x: 500, y: 0, secreto: false },
        { llave: 'b', x: 100, y: 0, secreto: true },
        { llave: 'c', x: 99999, y: 0, secreto: false },
      ],
      { x: 0, y: 0 },
    )
    expect(p.map((x) => x.llave)).toEqual(['b', 'a'])
  })

  /** Simula a Thor corriendo hacia la meta a 200 px/s y a la heroína caminando detrás a `velHeroe` */
  function simular(velHeroe: number, segundos: number) {
    const camino = [{ x: 300, y: 0 }, { x: 600, y: 0 }, { x: 900, y: 0 }]
    const g = new Guia(camino)
    const thor = { x: 0, y: 0 }
    const heroe = { x: -20, y: 0 }
    const estados = new Set<string>()
    const acciones: string[] = []
    let huellas = 0
    for (let t = 0; t < segundos && g.estado !== 'listo'; t += 0.05) {
      const r = g.tick(0.05, thor, heroe)
      estados.add(g.estado)
      if (r.accion) acciones.push(r.accion)
      if (r.huella) huellas++
      if (r.meta) {
        const dx = r.meta.x - thor.x
        const d = Math.abs(dx)
        thor.x += Math.sign(dx) * Math.min(d, 200 * 0.05)
      }
      if (heroe.x < thor.x - 30) heroe.x += velHeroe * 0.05
    }
    return { g, thor, estados, acciones, huellas }
  }

  it('ladra, guía dejando huellas, espera si ella se queda atrás y al llegar cava', () => {
    const r = simular(80, 120)
    expect(r.acciones[0]).toBe('ladrar')
    expect(r.estados.has('esperar')).toBe(true)
    expect(r.acciones).toContain('cavar')
    expect(r.g.estado).toBe('listo')
    expect(Math.abs(r.thor.x - 900)).toBeLessThanOrEqual(OLFATO.llegada)
    expect(r.huellas).toBeGreaterThan(900 / OLFATO.huellaCada / 2)
  })

  it('si ella no lo sigue, la espera un rato y se rinde', () => {
    const r = simular(0, OLFATO.esperaMaxS + 30)
    expect(r.acciones).not.toContain('cavar')
    expect(r.g.estado).toBe('listo')
    expect(r.thor.x).toBeLessThan(900)
  })

  it('sin camino ladra y termina', () => {
    const g = new Guia([])
    for (let k = 0; k < 40; k++) g.tick(0.05, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(g.estado).toBe('listo')
  })
})
