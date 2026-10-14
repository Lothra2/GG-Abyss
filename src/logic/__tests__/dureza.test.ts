import { describe, expect, it } from 'vitest'
import { durezaDePiso, enemigoDelPiso, traeRefuerzo, vidaDeJefe } from '../dureza'
import { BOTIN, DUREZA, ENEMIGOS, PROGRESION } from '../../config/balance'

describe('la dureza de cada piso', () => {
  it('el Bosque es la base y cada piso más abajo pega y aguanta más', () => {
    expect(durezaDePiso(1)).toEqual({ vida: DUREZA.vidaBase, dano: DUREZA.danoBase })
    expect(durezaDePiso(2).vida).toBeGreaterThan(durezaDePiso(1).vida)
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
    // el original no se toca aunque el Bosque también escale
    expect(enemigoDelPiso(ENEMIGOS.rata!, 1).vida).toBe(Math.round(ENEMIGOS.rata!.vida * DUREZA.vidaBase))
    expect(ENEMIGOS.rata!.vida).toBe(18)
  })

  it('el Ciclo 2 multiplica otra vez todo, y los jefes aguantan más', () => {
    expect(durezaDePiso(3, 2).vida).toBeCloseTo(durezaDePiso(3).vida * DUREZA.ciclo.vida)
    expect(durezaDePiso(3, 2).dano).toBeCloseTo(durezaDePiso(3).dano * DUREZA.ciclo.dano)
    expect(vidaDeJefe(1000)).toBe(Math.round(1000 * DUREZA.jefeVida))
    expect(vidaDeJefe(1000, 2)).toBeGreaterThan(vidaDeJefe(1000))
  })

  it('los refuerzos: nunca en los pisos de arriba, más seguido al bajar y en los ciclos', () => {
    const hs = Array.from({ length: 1000 }, (_, i) => i / 1000)
    const cuenta = (piso: number, ciclo = 1) => hs.filter((h) => traeRefuerzo(piso, h, ciclo)).length
    expect(cuenta(1)).toBe(0)
    expect(cuenta(DUREZA.refuerzoDesde - 1)).toBe(0)
    expect(cuenta(DUREZA.refuerzoDesde)).toBeGreaterThan(0)
    expect(cuenta(7)).toBeGreaterThan(cuenta(4))
    expect(cuenta(4, 2)).toBeGreaterThan(cuenta(4))
  })

  it('el botín común es raro y la heroína no se cura sola de inmediato', () => {
    // pedido de Rick: se agarraban demasiadas cosas y todo moría muy fácil
    for (const t of ['rata', 'calabaza', 'goblin_arquero', 'raicita', 'polilla_ceniza'] as const) expect(BOTIN[t].objeto).toBeLessThanOrEqual(0.15)
    expect(PROGRESION.vidaRegenTrasDanoS).toBeGreaterThanOrEqual(5)
    expect(PROGRESION.vidaRegenPorSeg).toBeLessThanOrEqual(3)
  })
})
