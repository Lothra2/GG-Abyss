import { describe, expect, it } from 'vitest'
import { Impactos } from '../impacto'
import { IMPACTO } from '../../config/balance'

describe('Impactos', () => {
  it('un golpe normal no congela ni sacude, un crítico y una muerte sí', () => {
    const i = new Impactos()
    expect(i.pedir('golpe')).toEqual({ pausa: 0, sacudida: null })
    expect(i.pedir('critico').pausa).toBeGreaterThan(0)
    expect(i.pedir('muerte').sacudida).not.toBeNull()
  })
  it('los golpes seguidos no congelan más del tope por segundo', () => {
    const i = new Impactos()
    let total = 0
    for (let k = 0; k < 30; k++) {
      total += i.pedir('critico').pausa
      i.avanzar(0.02)
    }
    expect(total).toBeLessThanOrEqual(IMPACTO.topePausaPorSeg + 1e-9)
    expect(total).toBeGreaterThan(0)
  })
  it('pasado un segundo vuelve a haber pausa', () => {
    const i = new Impactos()
    for (let k = 0; k < 10; k++) i.pedir('muerte')
    expect(i.pedir('critico').pausa).toBe(0)
    i.avanzar(1.1)
    expect(i.pedir('critico').pausa).toBeGreaterThan(0)
  })
  it('la fase 2 y la muerte del jefe pausan siempre, aunque se haya gastado el tope', () => {
    const i = new Impactos()
    for (let k = 0; k < 10; k++) i.pedir('muerte')
    expect(i.pedir('jefeFase2').pausa).toBe(IMPACTO.jefeFase2.pausa)
    expect(i.pedir('jefeMuerte').pausa).toBe(IMPACTO.jefeMuerte.pausa)
  })
})
