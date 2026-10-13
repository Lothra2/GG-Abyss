import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { avisoBarrido, barrioNuevo, bostezo, elegirBarrioARobar, elegirChispas, empezarRobo, esperaLadrona, juntarChispas, oscuridadBarrio, pasoRobo, prenderBarrio, puntaAguja, sonambuloDespierto, tocaAguja } from '../ciudad'
import { CIUDAD, MODO_PEQUE } from '../../config/balance'

describe('la Ciudad Dormida: faroles de plaza', () => {
  it('prender el farol aclara el barrio; robado no se prende tocándolo', () => {
    const b = barrioNuevo('plaza')
    expect(oscuridadBarrio(0.85, b)).toBe(0.85)
    expect(prenderBarrio(b)).toBe(true)
    expect(oscuridadBarrio(0.85, b)).toBe(CIUDAD.oscuridadPrendido)
    expect(prenderBarrio(b)).toBe(false)
    b.estado = 'robado'
    expect(prenderBarrio(b)).toBe(false)
    expect(oscuridadBarrio(0.85, b)).toBe(0.85)
    // un barrio sin farol queda como está
    expect(oscuridadBarrio(0.6, undefined)).toBe(0.6)
  })
})

describe('la Ladrona', () => {
  it('viene menos seguido en modo peque', () => {
    const [a, z] = CIUDAD.ladrona.cadaS
    for (let s = 1; s < 20; s++) {
      const n = esperaLadrona(new Azar(s), false)
      expect(n).toBeGreaterThanOrEqual(a)
      expect(n).toBeLessThanOrEqual(z)
      expect(esperaLadrona(new Azar(s), true)).toBeCloseTo(n * CIUDAD.ladrona.pequeMult)
    }
  })

  it('elige un barrio prendido, el más lejos, y en modo peque nunca donde está la heroína', () => {
    const bs = [barrioNuevo('a', true), barrioNuevo('b', true), barrioNuevo('c')]
    const dist = (id: string) => ({ a: 100, b: 500, c: 900 })[id]!
    expect(elegirBarrioARobar(bs, 'a', false, dist)).toBe('b')
    expect(elegirBarrioARobar(bs, 'b', true, dist)).toBe('a')
    expect(elegirBarrioARobar([barrioNuevo('a', true)], 'a', true, dist)).toBeNull()
    expect(elegirBarrioARobar([barrioNuevo('c')], null, false, dist)).toBeNull()
  })

  it('si la heroína llega antes la luz vuelve; si no, el barrio queda robado', () => {
    const b = barrioNuevo('a', true)
    expect(empezarRobo(b, false)).toBe(true)
    expect(oscuridadBarrio(0.85, b)).toBe(CIUDAD.oscuridadPrendido)
    expect(pasoRobo(b, 1, false)).toBe('sigue')
    expect(pasoRobo(b, 1, true)).toBe('salvado')
    expect(b.estado).toBe('prendido')
    empezarRobo(b, false)
    let r: string | null = 'sigue'
    for (let t = 0; t < CIUDAD.ladrona.roboS + 1 && r === 'sigue'; t += 0.5) r = pasoRobo(b, 0.5, false)
    expect(r).toBe('robado')
    expect(b.estado).toBe('robado')
  })

  it('en modo peque roba más despacio', () => {
    const b = barrioNuevo('a', true)
    empezarRobo(b, true)
    expect(b.roboS).toBe(CIUDAD.ladrona.roboPequeS)
    expect(CIUDAD.ladrona.roboPequeS).toBeGreaterThan(CIUDAD.ladrona.roboS)
  })
})

describe('las chispas', () => {
  const puntos = Array.from({ length: 8 }, (_, i) => ({ x: i * 100, y: 0 }))

  it('caen tres en puntos distintos, y en modo peque cerca de Thor', () => {
    const c = elegirChispas(puntos, new Azar(4))
    expect(c).toHaveLength(CIUDAD.chispas.cuantas)
    expect(new Set(c.map((p) => p.x)).size).toBe(c.length)
    const cp = elegirChispas(puntos, new Azar(4), true, { x: 0, y: 0 })
    for (const p of cp) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(CIUDAD.chispas.pequeCercaThor)
  })

  it('juntar las tres vuelve a prender el farol', () => {
    const b = barrioNuevo('a')
    b.estado = 'robado'
    b.chispas = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 400, y: 0 }]
    expect(juntarChispas(b, [{ x: 5, y: 5 }])).toEqual({ juntadas: 1, prendido: false })
    // Thor también las junta
    expect(juntarChispas(b, [{ x: 999, y: 999 }, { x: 198, y: 3 }])).toEqual({ juntadas: 1, prendido: false })
    expect(juntarChispas(b, [{ x: 400, y: 10 }])).toEqual({ juntadas: 1, prendido: true })
    expect(b.estado).toBe('prendido')
  })
})

describe('los sonámbulos y el sueño', () => {
  it('el sonámbulo solo se mueve a oscuras', () => {
    expect(sonambuloDespierto(true)).toBe(false)
    expect(sonambuloDespierto(false)).toBe(true)
  })
  it('la arena hace bostezar a la heroína, menos en modo peque', () => {
    expect(bostezo(false).velocidad).toBeLessThan(1)
    expect(bostezo(false).seg).toBeGreaterThan(0)
    expect(bostezo(true)).toEqual({ seg: 0, velocidad: 1 })
  })
})

describe('el barrido del Relojero', () => {
  it('la aguja toca lo que tiene encima y no lo que está del otro lado', () => {
    const p = puntaAguja(0, 0, 0)
    expect(p.x).toBeCloseTo(CIUDAD.barrido.largo)
    expect(tocaAguja(80, 0, 0, 0, 0)).toBe(true)
    expect(tocaAguja(-80, 0, 0, 0, 0)).toBe(false)
    // a 90 grados apunta para abajo (aplastado en y como el piso)
    expect(tocaAguja(0, 60, 0, 0, 90)).toBe(true)
    // más allá de la punta no llega
    expect(tocaAguja(CIUDAD.barrido.largo + 40, 0, 0, 0, 0)).toBe(false)
  })
  it('el aviso dura más en modo peque', () => {
    expect(avisoBarrido(true)).toBeCloseTo(avisoBarrido(false) * MODO_PEQUE.avisos)
  })
})
