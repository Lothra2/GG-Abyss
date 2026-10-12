import { describe, expect, it } from 'vitest'
import { durezaDePiso, enemigoDelPiso } from '../dureza'
import { BOTIN, ENEMIGOS, PROGRESION } from '../../config/balance'

describe('la dureza de cada piso', () => {
  it('el Bosque es la base y cada piso más abajo pega y aguanta más', () => {
    expect(durezaDePiso(1)).toEqual({ vida: 1, dano: 1 })
    expect(durezaDePiso(2).vida).toBeGreaterThan(1)
    expect(durezaDePiso(3).vida).toBeGreaterThan(durezaDePiso(2).vida)
    expect(durezaDePiso(3).dano).toBeGreaterThan(durezaDePiso(2).dano)
  })

  it('escala la vida, el daño y el golpe pesado sin tocar el balance original', () => {
    const base = ENEMIGOS.guardian_cobre!
    const p3 = enemigoDelPiso(base, 3)
    expect(p3.vida).toBeGreaterThan(base.vida)
    expect(p3.dano[0]).toBeGreaterThan(base.dano[0])
    expect(p3.pesado!.dano[1]).toBeGreaterThan(base.pesado!.dano[1])
    expect(ENEMIGOS.guardian_cobre).toBe(base)
    expect(enemigoDelPiso(ENEMIGOS.rata!, 1)).toBe(ENEMIGOS.rata)
  })

  it('el botín común es raro y la heroína no se cura sola de inmediato', () => {
    // pedido de Rick: se agarraban demasiadas cosas y todo moría muy fácil
    for (const t of ['rata', 'calabaza', 'goblin_arquero', 'raicita', 'polilla_ceniza'] as const) expect(BOTIN[t].objeto).toBeLessThanOrEqual(0.15)
    expect(PROGRESION.vidaRegenTrasDanoS).toBeGreaterThanOrEqual(5)
    expect(PROGRESION.vidaRegenPorSeg).toBeLessThanOrEqual(3)
  })
})
