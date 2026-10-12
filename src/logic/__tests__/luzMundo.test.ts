import { describe, expect, it } from 'vitest'
import { aguaDebajo, cizallaSombra, meneoReflejo, radioFarol, sombraDeLuces, tiraSombra, tramosSombra, type CfgSombra, type CfgSombraLuces } from '../luzMundo'

const cfg: CfgSombra = { alfa: 0.3, alfaPunta: 0.15, tramos: 4, kx: 0.4, ky: 0.2, altoMin: 28 }

describe('sombras largas', () => {
  it('los árboles y las piedras grandes tiran sombra', () => {
    expect(tiraSombra('roble_0', { h: 160 }, cfg)).toBe(true)
    expect(tiraSombra('roca_grande', { h: 40 }, cfg)).toBe(true)
  })

  it('lo del suelo, lo que alumbra y lo bajito no', () => {
    expect(tiraSombra('puente', { h: 64, capa: 'suelo' }, cfg)).toBe(false)
    expect(tiraSombra('fogata', { h: 48, luz: { radius: 200 } }, cfg)).toBe(false)
    expect(tiraSombra('hongos', { h: 20 }, cfg)).toBe(false)
    expect(tiraSombra('pasto_alto', { h: 40 }, cfg)).toBe(false)
    expect(tiraSombra('portal_azul', { h: 96 }, cfg)).toBe(false)
  })
})

describe('reflejos', () => {
  const ancho = 10, alto = 10, cuadro = 32
  const agua = new Uint8Array(ancho * alto)
  // un lago en las filas 6 a 9
  for (let y = 6; y < 10; y++) for (let x = 0; x < ancho; x++) agua[y * ancho + x] = 1
  const m = { ancho, alto, cuadro, agua }

  it('se ve si hay agua justo debajo', () => {
    expect(aguaDebajo(m, 100, 6 * 32 - 10, 40)).toBe(true)
    expect(aguaDebajo(m, 100, 40, 40)).toBe(false)
  })

  it('no se sale del mapa', () => {
    expect(aguaDebajo(m, 5, 9 * 32 + 20, 200)).toBe(true)
    expect(aguaDebajo(m, -50, 9 * 32 + 20, 200)).toBe(false)
    expect(aguaDebajo(m, 9999, -999, 10)).toBe(false)
  })

  it('el meneo es entero y chico', () => {
    for (let t = 0; t < 5; t += 0.37) {
      const d = meneoReflejo(t, 0.3)
      expect(Number.isInteger(d)).toBe(true)
      expect(Math.abs(d)).toBeLessThanOrEqual(1)
    }
  })
})

describe('farol de la heroína', () => {
  it('en modo peque alumbra más', () => {
    expect(radioFarol(0, 120, true, 30)).toBeGreaterThan(radioFarol(0, 120, false, 30))
  })

  it('respira poquito, nunca menos del 94 % del radio', () => {
    for (let t = 0; t < 10; t += 0.1) expect(radioFarol(t, 120, false, 0)).toBeGreaterThanOrEqual(120 * 0.94)
  })
})

describe('la sombra inclinada', () => {
  // recompone giro(fi) * escala(sx, sy) * giro(theta) y la aplica a un punto
  const aplicar = (c: ReturnType<typeof cizallaSombra>, x: number, y: number) => {
    const rt = [Math.cos(c.theta) * x - Math.sin(c.theta) * y, Math.sin(c.theta) * x + Math.cos(c.theta) * y]
    const sc = [rt[0]! * c.sx, rt[1]! * c.sy]
    return [Math.cos(c.fi) * sc[0]! - Math.sin(c.fi) * sc[1]!, Math.sin(c.fi) * sc[0]! + Math.cos(c.fi) * sc[1]!]
  }
  it('la base queda en el piso y la punta cae abajo a la derecha como las horneadas del taller', () => {
    const c = cizallaSombra(0.42, 0.19)
    const base = aplicar(c, 20, 0)
    expect(base[0]).toBeCloseTo(20)
    expect(base[1]).toBeCloseTo(0)
    // la punta de un objeto de 100 de alto (y = -100 en el dibujo, hacia arriba)
    const punta = aplicar(c, 0, -100)
    expect(punta[0]).toBeCloseTo(42)
    expect(punta[1]).toBeCloseTo(19)
  })
})

describe('tramos de la sombra', () => {
  it('cubren todo el cuadro del pie para arriba, sin huecos', () => {
    for (const [h, pie, n] of [[64, 58, 4], [48, 46, 4], [170, 143, 5], [30, 30, 1]] as const) {
      const t = tramosSombra(h, pie, n)
      expect(t).toHaveLength(n)
      expect(t[0]!.hasta).toBe(h)
      expect(t[n - 1]!.desde).toBe(0)
      for (let i = 1; i < n; i++) expect(t[i]!.hasta).toBe(t[i - 1]!.desde)
      for (const x of t) expect(x.hasta).toBeGreaterThan(x.desde)
    }
  })

  it('el primero es el del pie', () => {
    const t = tramosSombra(64, 58, 4)
    expect(t[0]!.desde).toBeLessThan(58)
    expect(t[0]!.desde).toBeGreaterThan(40)
  })
})

describe('sombras con antorchas (adentro)', () => {
  const cl: CfgSombraLuces = { largo: 0.6, lejos: 60, aplaste: 0.55, kyMin: 0.06, ganancia: 1 }

  it('cae del lado contrario a la luz', () => {
    // la luz a la izquierda: la sombra va a la derecha
    const a = sombraDeLuces(100, 100, 48, [{ x: 20, y: 90, r: 200 }], cl)
    expect(a.kx).toBeGreaterThan(0.3)
    expect(a.fuerza).toBeGreaterThan(0.5)
    // la luz abajo (delante): la sombra va para arriba, detrás
    const b = sombraDeLuces(100, 100, 48, [{ x: 100, y: 170, r: 200 }], cl)
    expect(b.ky).toBeLessThan(0)
    expect(Math.abs(b.kx)).toBeLessThan(0.05)
    // la luz arriba (detrás): la sombra viene para adelante
    const c = sombraDeLuces(100, 100, 48, [{ x: 100, y: 20, r: 200 }], cl)
    expect(c.ky).toBeGreaterThan(0.2)
  })

  it('más lejos de la luz, más larga; justo debajo casi no sale', () => {
    const cerca = sombraDeLuces(100, 100, 48, [{ x: 85, y: 90, r: 200 }], cl)
    const lejos = sombraDeLuces(100, 100, 48, [{ x: 10, y: 90, r: 200 }], cl)
    expect(lejos.kx).toBeGreaterThan(cerca.kx)
  })

  it('a oscuras no hay sombra y se va apagando hacia el borde de la luz', () => {
    expect(sombraDeLuces(100, 100, 48, [], cl).fuerza).toBe(0)
    expect(sombraDeLuces(100, 100, 48, [{ x: 400, y: 100, r: 200 }], cl).fuerza).toBe(0)
    const medio = sombraDeLuces(100, 100, 48, [{ x: 0, y: 90, r: 200 }], cl)
    const borde = sombraDeLuces(100, 100, 48, [{ x: -80, y: 90, r: 200 }], cl)
    expect(borde.fuerza).toBeLessThan(medio.fuerza)
    expect(borde.fuerza).toBeGreaterThan(0)
  })

  it('la luz que lleva encima no le hace sombra a ella misma', () => {
    // el farol de la heroína va 8 px arriba de su pie
    const s = sombraDeLuces(100, 100, 48, [{ x: 100, y: 92, r: 118, alto: 8 }], cl)
    expect(s.fuerza).toBe(0)
    // pero sí a lo que tiene al lado
    const vecino = sombraDeLuces(160, 100, 48, [{ x: 100, y: 92, r: 118, alto: 8 }], cl)
    expect(vecino.fuerza).toBeGreaterThan(0)
    expect(vecino.kx).toBeGreaterThan(0)
  })

  it('de costado la sombra no queda como una raya', () => {
    const s = sombraDeLuces(100, 100, 48, [{ x: 0, y: 90, r: 200, alto: 10 }], cl)
    expect(Math.abs(s.ky)).toBeGreaterThanOrEqual(cl.kyMin)
  })
})
