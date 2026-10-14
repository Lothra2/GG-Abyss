import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { danarJefe, despertar, faseDeVida, nuevoJefe, pensarJefe, reposar, type EntradaJefe, type Jefe, type OrdenJefe } from '../jefe'
import { JEFE_DIABLO } from '../../config/balance'

const entrada = (j: Jefe, extra: Partial<EntradaJefe> = {}): EntradaJefe => ({ dt: 0.05, heroeX: j.x - 90, heroeY: j.y + 20, heroeVivo: true, modoPeque: false, ratasVivas: 0, ...extra })

function correr(j: Jefe, seg: number, rng: Azar, f: (j: Jefe, t: number) => Partial<EntradaJefe> = () => ({})): { t: number; o: OrdenJefe }[] {
  const out: { t: number; o: OrdenJefe }[] = []
  for (let t = 0; t < seg; t += 0.05) {
    const o = pensarJefe(j, entrada(j, f(j, t)), rng)
    if (Object.keys(o).length > 0) out.push({ t, o })
  }
  return out
}

const diablo = (): Jefe => {
  const j = nuevoJefe(2000, 2000, JEFE_DIABLO.vida, 'diablo')
  despertar(j)
  j.estado = 'quieto'
  return j
}
const aPct = (j: Jefe, pct: number) => danarJefe(j, j.vida - (j.vidaMax * pct) / 100 + 1)

describe('el Diablo', () => {
  it('cinco fases según la vida', () => {
    const m = JEFE_DIABLO.vida
    expect(faseDeVida(m, m)).toBe(1)
    expect(faseDeVida(m * 0.74, m)).toBe(2)
    expect(faseDeVida(m * 0.49, m)).toBe(3)
    expect(faseDeVida(m * 0.29, m)).toBe(4)
    expect(faseDeVida(m * 0.09, m)).toBe(5)
  })

  it('fase 1: zarpazo, nova en anillo y carga, y se le pega', () => {
    const j = diablo()
    expect(danarJefe(j, 10).escudo).toBeUndefined()
    const ords = correr(j, 40, new Azar(2), (_j, t) => ({ heroeX: 2000 - (t % 10 < 5 ? 80 : 200), heroeY: 2010 }))
    const ataques = new Set(ords.map((x) => x.o.aviso?.ataque).filter(Boolean))
    expect(ataques.has('zarpazo')).toBe(true)
    expect(ataques.has('nova')).toBe(true)
    const nova = ords.find((x) => x.o.aviso?.ataque === 'nova')!.o.aviso!
    expect(nova.forma).toBe('anillo')
    expect(nova.interior).toBeGreaterThan(0)
    expect(ataques.has('rayo')).toBe(false)
  })

  it('fase 2 enseña el rayo que gira, y después llegan los pilares', () => {
    const j = diablo()
    const r = aPct(j, 74)
    expect(r.fase2).toBe(true)
    expect(j.fase).toBe(2)
    const ords = correr(j, 60, new Azar(3))
    expect(ords.find((x) => x.o.aviso)?.o.aviso?.ataque).toBe('rayo')
    const ry = ords.find((x) => x.o.rayo)!.o.rayo!
    expect(ry.vuelta).toBe(JEFE_DIABLO.rayo.vuelta)
    expect(ords.some((x) => x.o.aviso?.ataque === 'pilares')).toBe(true)
    const p = ords.find((x) => x.o.aviso?.ataque === 'pilares')!.o.aviso!
    expect(p.puntos!.length).toBe(JEFE_DIABLO.pilares.cuantos)
  })

  it('fase 3, la oscuridad: blindado hasta prender los braseros, ahí de rodillas, y su aliento congela uno', () => {
    const j = diablo()
    aPct(j, 74)
    aPct(j, 49)
    expect(j.fase).toBe(3)
    expect(j.escudo).toBe(true)
    expect(danarJefe(j, 50).escudo).toBe(true)
    correr(j, 3, new Azar(4), () => ({ vulnerable: false }))
    const o = correr(j, 1, new Azar(4), () => ({ vulnerable: true }))
    expect(o.some((x) => x.o.aturdido)).toBe(true)
    expect(j.escudo).toBe(false)
    expect(danarJefe(j, 20).escudo).toBeUndefined()
    const ords = correr(j, JEFE_DIABLO.oscuridad.congelaCadaS + 6, new Azar(5), () => ({ vulnerable: true }))
    expect(ords.some((x) => x.o.congelar)).toBe(true)
  })

  it('fase 4, la jaula de huesos; fase 5 desesperado, más rápido', () => {
    const j = diablo()
    aPct(j, 74)
    aPct(j, 49)
    j.escudo = false
    aPct(j, 29)
    expect(j.fase).toBe(4)
    expect(j.escudo).toBe(false)
    const ords = correr(j, 6, new Azar(6))
    expect(ords.find((x) => x.o.aviso)?.o.aviso?.ataque).toBe('jaula')
    const ja = ords.find((x) => x.o.jaula)!.o.jaula!
    expect(ja.golpes).toBe(JEFE_DIABLO.jaula.golpes)
    aPct(j, 9)
    expect(j.fase).toBe(5)
    const o5 = correr(j, 6, new Azar(7), () => ({ heroeX: 2400, heroeY: 2000 }))
    const mov = o5.find((x) => x.o.mover)?.o.mover
    expect(mov?.vel).toBeCloseTo(JEFE_DIABLO.velocidad * JEFE_DIABLO.desesperado.velocidad)
  })

  it('si la heroína cae en la oscuridad, vuelve blindado y con la vida que tenía', () => {
    const j = diablo()
    aPct(j, 74)
    aPct(j, 49)
    const vida = j.vida
    reposar(j)
    expect(j.escudo).toBe(true)
    expect(j.vida).toBe(vida)
  })
})
