import { describe, expect, it } from 'vitest'
import { ganarXp, fraccionXp, regenerar, statsDe, claseDe } from '../stats'
import { CLASES, HABILIDADES, PROGRESION, xpParaSubir } from '../../config/balance'

describe('statsDe', () => {
  it('a nivel 1 es la tabla de la clase', () => {
    for (const [id, c] of Object.entries(CLASES)) {
      const s = statsDe(id as keyof typeof CLASES, 1)
      expect(s.vidaMax).toBe(c.vida)
      expect(s.manaMax).toBe(c.mana)
      expect(s.danoMin).toBeCloseTo(c.dano[0])
      expect(s.danoMax).toBeCloseTo(c.dano[1])
    }
  })
  it('por nivel suma 10 de vida, 5 de maná y 8 % de daño', () => {
    const s = statsDe('amazona', 4)
    expect(s.vidaMax).toBe(60 + 30)
    expect(s.manaMax).toBe(30 + 15)
    expect(s.danoMult).toBeCloseTo(1 + 3 * 0.08)
  })
  it('no pasa del nivel máximo ni baja de 1', () => {
    expect(statsDe('paladin', 99).nivel).toBe(PROGRESION.nivelMax)
    expect(statsDe('paladin', -3).nivel).toBe(1)
  })
  it('el equipo suma encima', () => {
    const s = statsDe('hechicera', 1, { vida: 10, danoPct: 50, armadura: 7, danoPlano: 2 })
    expect(s.vidaMax).toBe(60)
    expect(s.danoMin).toBeCloseTo((5 + 2) * 1.5)
    expect(s.armadura).toBe(7)
  })
  it('la clase sale del manifest o del id y si no, amazona', () => {
    expect(claseDe('x', 'paladin')).toBe('paladin')
    expect(claseDe('alana')).toBe('druida')
    expect(claseDe('prima_nueva', 'bruja')).toBe('amazona')
  })
})

describe('XP y niveles', () => {
  it('la tabla es 40, 113, 208, 320, 447, 588, 741, 905, 1080', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(xpParaSubir)).toEqual([40, 113, 208, 320, 447, 588, 741, 905, 1080])
  })
  it('sube un nivel y guarda el sobrante', () => {
    expect(ganarXp(1, 30, 15)).toEqual({ nivel: 2, xp: 5, subio: [2] })
  })
  it('puede subir varios niveles de una vez', () => {
    const r = ganarXp(1, 0, 40 + 113 + 10)
    expect(r.nivel).toBe(3)
    expect(r.subio).toEqual([2, 3])
    expect(r.xp).toBe(10)
  })
  it('en el nivel máximo no acumula', () => {
    const r = ganarXp(10, 0, 5000)
    expect(r).toEqual({ nivel: 10, xp: 0, subio: [] })
    expect(fraccionXp(10, 0)).toBe(1)
  })
  it('la fracción de la barra', () => {
    expect(fraccionXp(1, 20)).toBeCloseTo(0.5)
  })
})

describe('regeneración', () => {
  const base = { vida: 10, mana: 5, vidaMax: 60, manaMax: 30, dt: 1 }
  it('en pelea el maná vuelve lento y en calma rápido', () => {
    expect(regenerar({ ...base, sinDanoS: 0 }).mana).toBeCloseTo(5 + PROGRESION.manaRegenPorSeg)
    // sin daño pero con una habilidad recién usada sigue siendo pelea
    expect(regenerar({ ...base, sinDanoS: 9, sinHabilidadS: 1 }).mana).toBeCloseTo(5 + PROGRESION.manaRegenPorSeg)
    expect(regenerar({ ...base, sinDanoS: 9, sinHabilidadS: 9 }).mana).toBeCloseTo(5 + PROGRESION.manaRegenCalmaPorSeg)
    expect(PROGRESION.manaRegenCalmaPorSeg).toBeGreaterThan(PROGRESION.manaRegenPorSeg)
  })
  it('el maná se nota: usar una habilidad cada vez que recarga vacía la barra, y en calma se llena rápido', () => {
    for (const clase of Object.keys(HABILIDADES) as (keyof typeof HABILIDADES)[]) {
      const s = statsDe(clase, 1)
      for (const h of HABILIDADES[clase]) {
        if (h.mana <= 0) continue
        // lo que gasta es más de lo que vuelve en pelea mientras recarga
        expect(h.mana, `${h.id}`).toBeGreaterThan(PROGRESION.manaRegenPorSeg * h.recarga)
        // con la barra llena alcanza para usarla al menos dos veces seguidas
        expect(s.manaMax, `${h.id}`).toBeGreaterThanOrEqual(h.mana * 2)
      }
      // en calma, la barra entera del nivel máximo vuelve en menos de medio minuto
      expect(statsDe(clase, PROGRESION.nivelMax).manaMax / PROGRESION.manaRegenCalmaPorSeg, clase).toBeLessThanOrEqual(30)
    }
  })
  it('la vida espera 4 s sin daño y luego sube 5 por segundo', () => {
    expect(regenerar({ ...base, sinDanoS: 3.9 }).vida).toBe(10)
    expect(regenerar({ ...base, sinDanoS: 4 }).vida).toBeCloseTo(15)
  })
  it('canalizando no regenera maná', () => {
    expect(regenerar({ ...base, sinDanoS: 9, canalizando: true }).mana).toBe(5)
  })
  it('no pasa del máximo ni revive a quien está en 0', () => {
    expect(regenerar({ ...base, vida: 59, sinDanoS: 9 }).vida).toBe(60)
    expect(regenerar({ ...base, vida: 0, sinDanoS: 9 }).vida).toBe(0)
  })
})
