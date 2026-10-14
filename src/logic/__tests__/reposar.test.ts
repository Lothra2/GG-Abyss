import { describe, expect, it } from 'vitest'
import { danarJefe, nuevoJefe, reposar, vidaInicioFase } from '../jefe'
import { JEFE, JEFE_DIABLO } from '../../config/balance'

// F13, decisión de Rick: en modo normal, si la heroína cae, el jefe vuelve a la vida con la que empezó su fase. En modo
// peque (Alana) se queda como estaba. Lo de las fases ya ganadas nunca se pierde.
describe('el jefe cuando ella cae', () => {
  it('en modo peque no se cura', () => {
    const j = nuevoJefe(0, 0, 1000, 'minotauro')
    danarJefe(j, 200)
    reposar(j, false)
    expect(j.vida).toBe(800)
  })

  it('en modo normal vuelve al inicio de su fase, no más', () => {
    const j = nuevoJefe(0, 0, 1000, 'minotauro')
    danarJefe(j, 200)
    reposar(j, true)
    expect(j.vida).toBe(1000)
    // ya en la fase 2: vuelve al 60 %, nunca a la fase 1
    danarJefe(j, 1000 * (1 - JEFE.fase2Pct / 100) + 150)
    expect(j.fase).toBe(2)
    reposar(j, true)
    expect(j.vida).toBe(Math.round(1000 * JEFE.fase2Pct / 100))
    expect(j.fase).toBe(2)
  })

  it('el Diablo vuelve al umbral de su fase de ahora', () => {
    const j = nuevoJefe(0, 0, 1000, 'diablo')
    danarJefe(j, 1000 - JEFE_DIABLO.fases[2] * 10 + 10)
    expect(j.fase).toBe(4)
    expect(vidaInicioFase(j)).toBe(JEFE_DIABLO.fases[2] * 10)
    reposar(j, true)
    expect(j.vida).toBe(JEFE_DIABLO.fases[2] * 10)
  })
})
