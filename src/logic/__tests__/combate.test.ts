import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { danoEnemigo, escudoDeThor, recibirDano, reducirPorArmadura, tirarGolpe } from '../combate'

describe('tirarGolpe', () => {
  it('con la misma semilla da siempre lo mismo', () => {
    const a = tirarGolpe(new Azar(7), { min: 4, max: 7 })
    const b = tirarGolpe(new Azar(7), { min: 4, max: 7 })
    expect(a).toEqual(b)
  })
  it('queda entre min y max y nunca baja de 1', () => {
    const r = new Azar(1)
    for (let i = 0; i < 300; i++) {
      const g = tirarGolpe(r, { min: 4, max: 7, critChance: 0 })
      expect(g.dano).toBeGreaterThanOrEqual(4)
      expect(g.dano).toBeLessThanOrEqual(7)
      expect(g.critico).toBe(false)
    }
    expect(tirarGolpe(new Azar(2), { min: 0.1, max: 0.2, critChance: 0 }).dano).toBe(1)
  })
  it('el crítico pega 1.5 veces y sale con la probabilidad dada', () => {
    const g = tirarGolpe(new Azar(3), { min: 10, max: 10, critChance: 1 })
    expect(g.critico).toBe(true)
    expect(g.dano).toBe(15)
    let crit = 0
    const r = new Azar(11)
    for (let i = 0; i < 2000; i++) if (tirarGolpe(r, { min: 5, max: 5, critChance: 0.25 }).critico) crit++
    expect(crit / 2000).toBeGreaterThan(0.2)
    expect(crit / 2000).toBeLessThan(0.3)
  })
  it('el multiplicador de una habilidad escala el daño', () => {
    expect(tirarGolpe(new Azar(1), { min: 10, max: 10, mult: 1.5, critChance: 0 }).dano).toBe(15)
  })
  it('puedeCritar false nunca crita', () => {
    const r = new Azar(5)
    for (let i = 0; i < 100; i++) expect(tirarGolpe(r, { min: 3, max: 3, critChance: 1, puedeCritar: false }).critico).toBe(false)
  })
})

describe('armadura y daño recibido', () => {
  it('la armadura reduce con 100 / (100 + armadura * 4)', () => {
    expect(reducirPorArmadura(100, 0)).toBe(100)
    expect(reducirPorArmadura(100, 25)).toBeCloseTo(50)
  })
  it('el modo peque baja el daño de los enemigos a la mitad', () => {
    const normal = danoEnemigo(new Azar(4), [10, 10], false)
    const peque = danoEnemigo(new Azar(4), [10, 10], true)
    expect(normal).toBe(10)
    expect(peque).toBe(5)
  })
  const d = { vida: 50, escudo: 0, reduccionPct: 0, armadura: 0, invulnerableS: 0 }
  it('resta vida y avisa si cae', () => {
    const r = recibirDano(d, 20)
    expect(r.vida).toBe(30)
    expect(r.recibido).toBe(20)
    expect(r.cayo).toBe(false)
    expect(recibirDano({ ...d, vida: 5 }, 20)).toMatchObject({ vida: 0, cayo: true })
  })
  it('el escudo se come el daño primero', () => {
    const r = recibirDano({ ...d, escudo: 15 }, 20)
    expect(r).toMatchObject({ vida: 45, escudo: 0, absorbido: 15, recibido: 5 })
    const r2 = recibirDano({ ...d, escudo: 30 }, 20)
    expect(r2).toMatchObject({ vida: 50, escudo: 10, recibido: 0 })
  })
  it('el bloqueo reduce 80 %', () => {
    expect(recibirDano({ ...d, reduccionPct: 80 }, 20).recibido).toBe(4)
  })
  it('invulnerable no recibe nada y el golpe deja una invulnerabilidad corta', () => {
    expect(recibirDano({ ...d, invulnerableS: 0.2 }, 99)).toMatchObject({ vida: 50, esquivado: true })
    expect(recibirDano(d, 5).invulnerableS).toBeGreaterThan(0)
  })
  it('quien ya cayó no vuelve a caer', () => {
    expect(recibirDano({ ...d, vida: 0 }, 9).esquivado).toBe(true)
  })
  it('el escudo de Thor crece con el nivel', () => {
    expect(escudoDeThor(30, 5, 1)).toBe(30)
    expect(escudoDeThor(30, 5, 5)).toBe(50)
  })
})
