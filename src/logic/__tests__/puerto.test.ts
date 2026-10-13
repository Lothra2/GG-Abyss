import { describe, expect, it } from 'vitest'
import { PUERTO } from '../../config/balance'
import { alzarFarol, apagarFarol, caminableConMarea, danoMarinero, farolNuevo, mareaEn, oscuridadConFaro, pasoFarol, puntoRodeo, radioFarolThor, secoMasCercano } from '../puerto'

describe('el farol de Thor', () => {
  it('es la luz grande del piso, y en modo peque alumbra un poco más', () => {
    expect(radioFarolThor(farolNuevo(), false)).toBe(PUERTO.farol.radio)
    expect(radioFarolThor(farolNuevo(), true)).toBeGreaterThan(PUERTO.farol.radio)
  })

  it('una medusa lo apaga un rato, pero queda una brasa y vuelve solo', () => {
    let e = apagarFarol(farolNuevo(), false)
    expect(radioFarolThor(e, false)).toBe(PUERTO.farol.radioApagado)
    expect(radioFarolThor(e, false)).toBeGreaterThan(0)
    e = pasoFarol(e, PUERTO.farol.apagadoS + 0.1)
    expect(radioFarolThor(e, false)).toBe(PUERTO.farol.radio)
    // en modo peque dura menos
    expect(apagarFarol(farolNuevo(), true).apagadoS).toBeLessThan(apagarFarol(farolNuevo(), false).apagadoS)
  })

  it('alzarlo agranda la luz, lo vuelve a prender y tiene recarga', () => {
    const apagado = apagarFarol(farolNuevo(), false)
    const r = alzarFarol(apagado)
    expect(r.ok).toBe(true)
    expect(r.e.apagadoS).toBe(0)
    expect(radioFarolThor(r.e, false)).toBe(PUERTO.farol.radioAlzado)
    expect(alzarFarol(r.e).ok).toBe(false)
    // alzado no lo apaga una medusa
    expect(apagarFarol(r.e, false).apagadoS).toBe(0)
    const listo = pasoFarol(r.e, PUERTO.farol.recargaAlzarS)
    expect(alzarFarol(listo).ok).toBe(true)
  })
})

describe('la marea', () => {
  const m = PUERTO.marea
  it('da la vuelta: baja, sube con aviso, alta y baja con aviso', () => {
    expect(mareaEn(1).fase).toBe('baja')
    expect(mareaEn(m.baja + 1).fase).toBe('subiendo')
    expect(mareaEn(m.baja + m.subiendo + 1).fase).toBe('alta')
    expect(mareaEn(m.baja + m.subiendo + m.alta + 1).fase).toBe('bajando')
    const ciclo = m.baja + m.subiendo + m.alta + m.bajando
    expect(mareaEn(ciclo + 1).fase).toBe('baja')
  })

  it('el agua sube y baja de a poco', () => {
    expect(mareaEn(1).agua).toBe(0)
    const medio = mareaEn(m.baja + m.subiendo / 2).agua
    expect(medio).toBeGreaterThan(0.3)
    expect(medio).toBeLessThan(0.7)
    expect(mareaEn(m.baja + m.subiendo + 1).agua).toBe(1)
  })

  it('en modo peque el ciclo es más lento', () => {
    expect(mareaEn(m.baja + 1, true).fase).toBe('baja')
  })

  it('los caminos bajos se cierran con la alta y los muelles flotantes se abren', () => {
    expect(caminableConMarea('normal', 'alta')).toBe(true)
    expect(caminableConMarea('baja', 'baja')).toBe(true)
    // mientras sube todavía se puede salir
    expect(caminableConMarea('baja', 'subiendo')).toBe(true)
    expect(caminableConMarea('baja', 'alta')).toBe(false)
    expect(caminableConMarea('alta', 'baja')).toBe(false)
    expect(caminableConMarea('alta', 'alta')).toBe(true)
    expect(caminableConMarea('alta', 'bajando')).toBe(true)
  })

  it('si la marea la alcanza, la empuja al seco más cercano', () => {
    // un pasillo de agua de 3 cuadros con seco a los dos lados, más cerca a la derecha
    const seco = (x: number, y: number) => y === 0 && (x <= -2 || x >= 2)
    expect(secoMasCercano(1, 0, seco)).toEqual({ x: 2, y: 0 })
    expect(secoMasCercano(5, 0, seco)).toEqual({ x: 5, y: 0 })
    expect(secoMasCercano(0, 0, () => false, 3)).toBeNull()
  })
})

describe('marineros, cangrejos y el faro', () => {
  it('el marinero en la luz se deshace, a oscuras casi no le pasa nada', () => {
    expect(danoMarinero(10, true)).toBeGreaterThan(10)
    expect(danoMarinero(10, false)).toBeLessThan(10)
    expect(danoMarinero(1, false)).toBe(1)
  })

  it('los cangrejos se reparten alrededor', () => {
    const ps = [0, 1, 2, 3].map((i) => puntoRodeo(i, 4, 100, 100))
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y)).toBeGreaterThan(20)
  })

  it('con el faro prendido el piso se aclara', () => {
    expect(oscuridadConFaro(0.85, true)).toBe(PUERTO.oscuridadFaro)
    expect(oscuridadConFaro(0.85, false)).toBe(0.85)
    expect(oscuridadConFaro(0.2, true)).toBe(0.2)
  })
})
