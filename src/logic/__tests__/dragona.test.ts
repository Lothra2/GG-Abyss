import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { danarJefe, despertar, enMedio, nuevoJefe, pensarJefe, reposar, type EntradaJefe, type Jefe, type OrdenJefe } from '../jefe'
import { JEFE, JEFE_DRAGONA, MODO_PEQUE } from '../../config/balance'

const entrada = (j: Jefe, extra: Partial<EntradaJefe> = {}): EntradaJefe => ({ dt: 0.05, heroeX: j.x - 60, heroeY: j.y + 10, heroeVivo: true, modoPeque: false, ratasVivas: 0, ...extra })

function correr(j: Jefe, seg: number, rng: Azar, f: (j: Jefe, t: number) => Partial<EntradaJefe> = () => ({})): { t: number; o: OrdenJefe }[] {
  const out: { t: number; o: OrdenJefe }[] = []
  for (let t = 0; t < seg; t += 0.05) {
    const o = pensarJefe(j, entrada(j, f(j, t)), rng)
    if (Object.keys(o).length > 0) out.push({ t, o })
  }
  return out
}

const dragona = (): Jefe => {
  const j = nuevoJefe(1000, 1000, JEFE_DRAGONA.vida, 'dragona')
  despertar(j)
  j.estado = 'quieto'
  return j
}
const aFase2 = (j: Jefe) => danarJefe(j, JEFE_DRAGONA.vida * (1 - JEFE.fase2Pct / 100) + 1)

describe('la Dragona de Brasa', () => {
  it('en la fase 1 se le pega siempre: zarpazo con aviso delante y coletazo en medio círculo', () => {
    const j = dragona()
    expect(j.escudo).toBe(false)
    expect(danarJefe(j, 10).escudo).toBeUndefined()
    const ords = correr(j, 20, new Azar(4))
    const z = ords.find((x) => x.o.aviso?.ataque === 'zarpazo')
    expect(z).toBeDefined()
    expect(z!.o.aviso!.forma).toBe('frente')
    expect(z!.o.aviso!.seg).toBeCloseTo(JEFE_DRAGONA.zarpazo.avisoS)
    const c = ords.find((x) => x.o.aviso?.ataque === 'coletazo')
    expect(c).toBeDefined()
    expect(c!.o.aviso!.forma).toBe('medio')
    // en la fase 1 no echa fuego
    expect(ords.some((x) => x.o.aviso?.ataque === 'aliento')).toBe(false)
  })

  it('el coletazo pega del lado de la heroína y no del otro', () => {
    expect(enMedio(-100, 0, 0, 0, -1, 0, 150)).toBe(true)
    expect(enMedio(100, 0, 0, 0, -1, 0, 150)).toBe(false)
    expect(enMedio(-200, 0, 0, 0, -1, 0, 150)).toBe(false)
  })

  it('la fase 2 la enciende: los golpes no le hacen nada y enseña el aliento, que deja el piso ardiendo', () => {
    const j = dragona()
    expect(aFase2(j).fase2).toBe(true)
    expect(j.escudo).toBe(true)
    expect(danarJefe(j, 50).escudo).toBe(true)
    const ords = correr(j, 8, new Azar(5), () => ({ heroeX: 1000 - 150, heroeY: 1000 }))
    const av = ords.find((x) => x.o.aviso)
    expect(av?.o.aviso?.ataque).toBe('aliento')
    expect(av!.o.aviso!.forma).toBe('linea')
    expect(av!.o.aviso!.seg).toBeCloseTo(JEFE_DRAGONA.aliento.avisoS)
    const f = ords.find((x) => x.o.fuegoPiso)!.o.fuegoPiso!
    expect(f.seg).toBe(JEFE_DRAGONA.aliento.fuegoS)
    expect(f.largo).toBe(JEFE_DRAGONA.aliento.largo)
  })

  it('el chorro del surtidor la apaga: echada y sin escudo, y al levantarse se vuelve a encender', () => {
    const j = dragona()
    aFase2(j)
    correr(j, 3, new Azar(6))
    const o = pensarJefe(j, entrada(j, { chorro: true }), new Azar(1))
    expect(o.apagada).toBe('chorro')
    expect(o.aturdido).toBeCloseTo(JEFE_DRAGONA.apagadaS)
    expect(j.estado).toBe('aturdido')
    expect(j.escudo).toBe(false)
    expect(danarJefe(j, 30).escudo).toBeUndefined()
    const ords = correr(j, JEFE_DRAGONA.apagadaS + 0.5, new Azar(2))
    expect(ords.some((x) => x.o.encender)).toBe(true)
    expect(j.escudo).toBe(true)
  })

  it('Thor sacudiéndose al lado la apaga menos rato, y no se puede apagar de nuevo enseguida', () => {
    const j = dragona()
    aFase2(j)
    correr(j, 3, new Azar(7))
    const o = pensarJefe(j, entrada(j, { sacudida: true }), new Azar(1))
    expect(o.apagada).toBe('thor')
    expect(o.aturdido).toBeCloseTo(JEFE_DRAGONA.apagadaThorS)
    correr(j, JEFE_DRAGONA.apagadaThorS + 0.2, new Azar(2))
    expect(j.escudo).toBe(true)
    // recién encendida: otro chorro no la apaga todavía
    const o2 = pensarJefe(j, entrada(j, { chorro: true }), new Azar(1))
    expect(o2.apagada).toBeUndefined()
    correr(j, JEFE_DRAGONA.apagarCadaS, new Azar(3))
    let apagada = false
    for (let i = 0; i < 40 && !apagada; i++) apagada = !!pensarJefe(j, entrada(j, { chorro: true }), new Azar(i)).apagada
    expect(apagada).toBe(true)
  })

  it('en la fase 1 el chorro no hace nada y en modo peque queda apagada más rato', () => {
    const j = dragona()
    expect(pensarJefe(j, entrada(j, { chorro: true }), new Azar(1)).apagada).toBeUndefined()
    const k = dragona()
    aFase2(k)
    correr(k, 3, new Azar(8), () => ({ modoPeque: true }))
    const o = pensarJefe(k, entrada(k, { chorro: true, modoPeque: true }), new Azar(1))
    expect(o.aturdido).toBeCloseTo(JEFE_DRAGONA.apagadaS * MODO_PEQUE.avisos)
  })

  it('la fase 3 llama hollines y salamandras', () => {
    const j = dragona()
    aFase2(j)
    // encendida no se le baja la vida: primero hay que apagarla
    expect(danarJefe(j, j.vida).escudo).toBe(true)
    correr(j, 3, new Azar(11))
    pensarJefe(j, entrada(j, { chorro: true }), new Azar(1))
    const r = danarJefe(j, j.vida - JEFE_DRAGONA.vida * (JEFE_DRAGONA.fase3Pct / 100) + 1)
    expect(r.fase3).toBe(true)
    // apagada la llamada espera a que se levante
    const ords = correr(j, JEFE_DRAGONA.apagadaS + 4, new Azar(9))
    const inv = ords.find((x) => x.o.invocar !== undefined)
    expect(inv?.o.invocar).toBe(JEFE_DRAGONA.llamada.hollines + JEFE_DRAGONA.llamada.salamandras)
  })

  it('si la heroína cae, vuelve encendida y con la vida que tenía', () => {
    const j = dragona()
    aFase2(j)
    correr(j, 3, new Azar(10))
    pensarJefe(j, entrada(j, { chorro: true }), new Azar(1))
    const vida = j.vida
    reposar(j)
    expect(j.escudo).toBe(true)
    expect(j.vida).toBe(vida)
  })
})
