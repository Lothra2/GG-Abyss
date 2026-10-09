import { describe, expect, it } from 'vitest'
import { tasa, type Modelo } from '../../../scripts/simular-jefe'
import type { ClaseId } from '../../config/balance'

/**
 * Termómetro del balance de la pelea (PLAN.md F4, aceptación): "se gana con cada clase a nivel 6 sin pociones en modo normal,
 * y con Alana en modo peque a nivel 4". Usa la máquina de estados real del jefe y un modelo de jugadora que esquiva la mitad de los
 * avisos y pega el 60 % del tiempo. Si estos números se rompen al tocar `JEFE` o las clases, la pelea dejó de ser jugable.
 */
const jugadora: Modelo = { esquiva: 0.5, tocaGolpe: 0.8, uptime: 0.6, habilidades: 0.1 }
const jugadoraPeque: Modelo = { esquiva: 0.5, tocaGolpe: 0.7, uptime: 0.6, habilidades: 0.1 }

describe('balance de la pelea con el minotauro', () => {
  for (const c of ['amazona', 'druida', 'paladin', 'hechicera'] as ClaseId[]) {
    it(`${c} nivel 6, sin pociones, modo normal: casi siempre gana y la pelea dura entre 40 y 120 s`, () => {
      const r = tasa(c, 6, false, jugadora, 120)
      expect(r.gana).toBeGreaterThanOrEqual(0.9)
      expect(r.segProm).toBeGreaterThan(40)
      expect(r.segProm).toBeLessThan(120)
    })
  }
  it('la druida (Alana) en modo peque a nivel 4 gana siempre', () => {
    const r = tasa('druida', 4, true, jugadoraPeque, 120)
    expect(r.gana).toBeGreaterThanOrEqual(0.95)
    expect(r.segProm).toBeLessThan(150)
  })
  it('subir de nivel ayuda: el paladín a nivel 2 pierde más seguido que a nivel 6', () => {
    const bajo = tasa('paladin', 2, false, jugadora, 120).gana
    const alto = tasa('paladin', 6, false, jugadora, 120).gana
    expect(bajo).toBeLessThan(alto + 0.001)
  })
})
