import { describe, expect, it } from 'vitest'
import { RelojesThor, rangoMordida } from '../thorCombate'
import { rescatar } from '../rescate'
import { partidaNueva } from '../guardado'

const e = (extra: object = {}) => ({ dt: 0.1, vidaPct: 1, enemigoCerca: false, heroeVivo: true, ...extra })

describe('RelojesThor', () => {
  it('muerde cada 2 s mientras haya enemigo cerca', () => {
    const t = new RelojesThor()
    expect(t.tick(e({ enemigoCerca: true }))).toBe('morder')
    let mordidas = 0
    for (let i = 0; i < 100; i++) if (t.tick(e({ enemigoCerca: true })) === 'morder') mordidas++
    expect(mordidas).toBeGreaterThanOrEqual(4)
    expect(mordidas).toBeLessThanOrEqual(5)
  })
  it('no muerde sin enemigos', () => {
    const t = new RelojesThor()
    for (let i = 0; i < 50; i++) expect(t.tick(e())).toBeNull()
  })
  it('aúlla solo con la vida bajo 30 %', () => {
    const t = new RelojesThor()
    expect(t.tick(e({ vidaPct: 0.3 }))).toBeNull()
    expect(t.tick(e({ vidaPct: 0.29 }))).toBe('aullar')
  })
  it('respeta los 20 s de recarga del aullido', () => {
    const t = new RelojesThor()
    expect(t.tick(e({ vidaPct: 0.1 }))).toBe('aullar')
    let n = 0
    for (let i = 0; i < 190; i++) if (t.tick(e({ vidaPct: 0.1 })) === 'aullar') n++
    expect(n).toBe(0)
    for (let i = 0; i < 20; i++) if (t.tick(e({ vidaPct: 0.1 })) === 'aullar') n++
    expect(n).toBe(1)
  })
  it('con la heroína caída no hace nada', () => {
    expect(new RelojesThor().tick(e({ vidaPct: 0, heroeVivo: false, enemigoCerca: true }))).toBeNull()
  })
  it('la mordida sube 1 por nivel', () => {
    expect(rangoMordida(1)).toEqual([3, 5])
    expect(rangoMordida(4)).toEqual([6, 8])
  })
})

describe('rescate de Thor', () => {
  it('deja todo igual menos posición, vida y maná', () => {
    const p = { ...partidaNueva('sophie', 5), oro: 120, nivel: 4, xp: 33, cofres: ['a:1:2'], zonas: ['llegada'], secretos: ['x'], vida: 0, mana: 3, posicion: { x: 900, y: 900 }, bolsa: ['sword_1', ...Array(27).fill(null)], equipo: { arma: 'sword_1' } }
    const r = rescatar(p, { x: 1296.4, y: 1584 }, 90, 45)
    expect(r.vida).toBe(90)
    expect(r.mana).toBe(45)
    expect(r.posicion).toEqual({ x: 1296, y: 1584 })
    const { vida: _v, mana: _m, posicion: _p, ...restoNuevo } = r
    const { vida: _v2, mana: _m2, posicion: _p2, ...restoViejo } = p
    expect(restoNuevo).toEqual(restoViejo)
  })
  it('no modifica la partida original', () => {
    const p = partidaNueva('alana', 1)
    rescatar(p, { x: 5, y: 5 }, 55, 50)
    expect(p.posicion).toEqual({ x: 0, y: 0 })
  })
})
