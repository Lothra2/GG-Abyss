import { describe, expect, it } from 'vitest'
import { alfaTexto, avanceBeat, beatEn, DURACION_INTRO, enSilencio, GUION_INTRO, latidosHasta, letrasVisibles, mostrarIntro } from '../intro'

describe('el guion del intro', () => {
  it('dura menos de 30 s y los momentos van seguidos, sin huecos', () => {
    expect(DURACION_INTRO).toBeLessThanOrEqual(30)
    expect(GUION_INTRO[0]!.t0).toBe(0)
    for (let i = 1; i < GUION_INTRO.length; i++) expect(GUION_INTRO[i]!.t0).toBe(GUION_INTRO[i - 1]!.t1)
  })

  it('termina con el título y cada momento trae su sonido (Alana no lee)', () => {
    expect(GUION_INTRO[GUION_INTRO.length - 1]!.momento).toBe('titulo')
    for (const b of GUION_INTRO) expect(b.sonido.length).toBeGreaterThan(0)
  })

  it('encuentra el momento de cada segundo', () => {
    expect(beatEn(0).momento).toBe('brasas')
    expect(beatEn(10).momento).toBe('ojos')
    expect(beatEn(999).momento).toBe('titulo')
  })

  it('el texto entra y sale suave', () => {
    const b = GUION_INTRO[1]!
    expect(alfaTexto(b.t0, b)).toBe(0)
    expect(alfaTexto((b.t0 + b.t1) / 2, b)).toBe(1)
    expect(alfaTexto(b.t1, b)).toBe(0)
    expect(avanceBeat(b.t0 + (b.t1 - b.t0) / 2, b)).toBeCloseTo(0.5)
  })

  it('sale una sola vez, nunca en las pruebas salvo que se pida', () => {
    expect(mostrarIntro(false, false, false)).toBe(true)
    expect(mostrarIntro(true, false, false)).toBe(false)
    expect(mostrarIntro(false, true, false)).toBe(false)
    expect(mostrarIntro(true, true, true)).toBe(true)
  })

  it('el texto se escribe de a poco y termina completo', () => {
    const b = GUION_INTRO[0]!
    expect(letrasVisibles(b.t0, b)).toBe(0)
    expect(letrasVisibles(b.t0 + 1, b)).toBeGreaterThan(0)
    expect(letrasVisibles(b.t1, b)).toBe(b.texto.length)
  })

  it('hay medio segundo de silencio justo antes del título', () => {
    const ti = GUION_INTRO.find((b) => b.momento === 'titulo')!
    expect(enSilencio(ti.t0 - 0.2)).toBe(true)
    expect(enSilencio(ti.t0 + 0.1)).toBe(false)
    expect(enSilencio(2)).toBe(false)
  })

  it('los ojos laten mientras miran, y solo ellos', () => {
    const ojos = GUION_INTRO.find((b) => b.momento === 'ojos')!
    expect(latidosHasta(ojos.t0 + 0.3, ojos)).toBe(0)
    expect(latidosHasta(ojos.t1, ojos)).toBeGreaterThanOrEqual(3)
    expect(latidosHasta(5, GUION_INTRO[1]!)).toBe(0)
  })

  it('los planos fuertes entran con corte seco', () => {
    for (const m of ['ojos', 'guardianes', 'familia']) expect(GUION_INTRO.find((b) => b.momento === m)!.corte).toBe(true)
  })
})
