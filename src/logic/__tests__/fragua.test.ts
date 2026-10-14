import { describe, expect, it } from 'vitest'
import { abrirCarcel, abrirJaula, abrirTodas, aguaNueva, alcanzaCandado, alcanzaSacudida, avisoGrieta, calientaPorS, calorNuevo, chorroAlcanza, cuentaJaulas, enfriarDelTodo, enLuzFria, enParche, estadoGrieta, haloConHollines, mojarThor, palancaCerca, pasoAgua, pasoCalor, pasoSurtidores, periodoFuelle, puedePegarse, sacudir, soplaEntre, sueltanHollines, surtidorBajo, tirarPalanca, velocidadCalor, velocidadHollines, type Jaula, type Surtidor } from '../fragua'
import { FRAGUA, MODO_PEQUE } from '../../config/balance'

const correrCalor = (seg: number, a: Parameters<typeof pasoCalor>[2], peque = false, c = calorNuevo()) => {
  let dano = 0
  const cambios: string[] = []
  for (let t = 0; t < seg; t += 0.1) {
    const r = pasoCalor(c, 0.1, a, peque)
    dano += r.dano
    if (r.cambio) cambios.push(r.cambio)
  }
  return { c, dano, cambios }
}

describe('la Fragua: el calor', () => {
  it('el fuego calienta, la luz fría y la fuente no, y en modo peque calienta la mitad', () => {
    expect(calientaPorS({}, false)).toBe(0)
    expect(calientaPorS({ lava: true, grieta: true }, false)).toBe(FRAGUA.calor.lava + FRAGUA.calor.grieta)
    expect(calientaPorS({ braseros: 2 }, false)).toBe(2 * FRAGUA.calor.brasero)
    expect(calientaPorS({ lava: true, luzFria: true }, false)).toBe(0)
    expect(calientaPorS({ grieta: true, fuente: true }, false)).toBe(0)
    expect(calientaPorS({ grieta: true }, true)).toBeCloseTo(FRAGUA.calor.grieta * FRAGUA.calor.pequeMult)
  })

  it('con el calor lleno queda acalorada, camina más lento y pierde un poquito de vida cada tanto', () => {
    const { c, dano, cambios } = correrCalor(8, { grieta: true, lava: true })
    expect(c.valor).toBe(FRAGUA.calor.max)
    expect(c.acalorada).toBe(true)
    expect(cambios).toEqual(['acalorada'])
    expect(dano).toBeGreaterThan(0)
    expect(dano % FRAGUA.calor.dano).toBe(0)
    expect(velocidadCalor(c, false)).toBe(FRAGUA.calor.velocidad)
  })

  it('no parpadea en el borde: sigue acalorada hasta bajar de sueltaEn, y lejos del fuego se enfría sola', () => {
    const { c } = correrCalor(8, { grieta: true, lava: true })
    // apenas sale del fuego sigue acalorada
    pasoCalor(c, 0.5, {}, false)
    expect(c.acalorada).toBe(true)
    const r = correrCalor(20, {}, false, c)
    expect(r.cambios).toEqual(['fresca'])
    expect(c.acalorada).toBe(false)
    expect(c.valor).toBeLessThan(FRAGUA.calor.sueltaEn)
  })

  it('la luz fría enfría rápido y la fuente o la sacudida la dejan fresca del todo', () => {
    const { c } = correrCalor(8, { grieta: true, lava: true })
    const r = correrCalor(2, { luzFria: true, grieta: true }, false, c)
    expect(r.c.valor).toBeLessThan(FRAGUA.calor.max - 50)
    const c2 = correrCalor(8, { grieta: true, lava: true }).c
    pasoCalor(c2, 1, { fuente: true }, false)
    expect(c2.valor).toBe(0)
    expect(c2.acalorada).toBe(false)
    const c3 = correrCalor(8, { grieta: true, lava: true }).c
    enfriarDelTodo(c3)
    expect(c3.valor).toBe(0)
    expect(c3.acalorada).toBe(false)
  })

  it('en modo peque el calor nunca quita vida', () => {
    const { c, dano } = correrCalor(30, { grieta: true, lava: true }, true)
    expect(c.acalorada).toBe(true)
    expect(dano).toBe(0)
    expect(velocidadCalor(c, true)).toBe(FRAGUA.calor.pequeVelocidad)
  })
})

describe('la Fragua: los fuelles y las grietas', () => {
  it('cada soplido: aviso, al rojo y después apagada, en ese orden', () => {
    const p = periodoFuelle(false)
    const seq: string[] = []
    for (let t = 0; t < p; t += 0.05) {
      const e = estadoGrieta(t, 0, p, false)
      if (seq[seq.length - 1] !== e) seq.push(e)
    }
    expect(seq).toEqual(['aviso', 'caliente', 'apagada'])
    expect(estadoGrieta(0.01, 0, p, false)).toBe('aviso')
    expect(estadoGrieta(FRAGUA.fuelle.avisoS + 0.1, 0, p, false)).toBe('caliente')
  })

  it('la fase corre el soplido: no se prenden todas a la vez', () => {
    const p = periodoFuelle(false)
    expect(estadoGrieta(0.2, 0, p, false)).toBe('aviso')
    expect(estadoGrieta(0.2, 0.5, p, false)).toBe('apagada')
    expect(estadoGrieta(0.5 * p + 0.2, 0.5, p, false)).toBe('aviso')
  })

  it('en modo peque el aviso dura más, y en la fase 3 los fuelles soplan más seguido', () => {
    expect(avisoGrieta(true)).toBeCloseTo(FRAGUA.fuelle.avisoS * MODO_PEQUE.avisos)
    expect(estadoGrieta(FRAGUA.fuelle.avisoS + 0.1, 0, periodoFuelle(false), true)).toBe('aviso')
    expect(periodoFuelle(true)).toBeLessThan(periodoFuelle(false))
  })

  it('el soplido se oye una vez por ciclo, antes de que empiece el aviso', () => {
    const p = periodoFuelle(false)
    let n = 0
    let cuando = -1
    for (let t = 0; t < 3 * p; t += 0.05) {
      if (soplaEntre(t, t + 0.05, p)) {
        n++
        if (cuando < 0) cuando = t + 0.05
      }
    }
    expect(n).toBe(3)
    expect(cuando).toBeCloseTo(p - FRAGUA.fuelle.sonidoAntesS, 1)
  })

  it('el parche de grietas es su rectángulo', () => {
    const r = { x: 100, y: 200, w: 64, h: 32 }
    expect(enParche(110, 210, r)).toBe(true)
    expect(enParche(164, 210, r)).toBe(false)
    expect(enParche(110, 199, r)).toBe(false)
  })
})

describe('la Fragua: las jaulas y la luz fría', () => {
  const jaulas = (): Jaula[] => [
    { id: 'a', x: 0, y: 0, luz: 'bosque', zona: 'El Río de Lava', abierta: false },
    { id: 'b', x: 1000, y: 0, luz: 'faro', zona: 'El Río de Lava', abierta: false },
    { id: 'c', x: 2000, y: 0, luz: 'ciudad', zona: 'La Cárcel de las Luces', abierta: false, carcel: true },
    { id: 'd', x: 2100, y: 0, luz: 'galerias', zona: 'La Cárcel de las Luces', abierta: false, carcel: true },
  ]

  it('el candado se rompe una vez y la luz libre alumbra frío alrededor', () => {
    const js = jaulas()
    expect(enLuzFria(10, 10, js)).toBe(false)
    expect(alcanzaCandado(10, 10, js[0]!)).toBe(true)
    expect(abrirJaula(js[0]!)).toBe(true)
    expect(abrirJaula(js[0]!)).toBe(false)
    expect(alcanzaCandado(10, 10, js[0]!)).toBe(false)
    expect(enLuzFria(FRAGUA.jaula.radioLuzLibre - 5, 0, js)).toBe(true)
    expect(enLuzFria(FRAGUA.jaula.radioLuzLibre + 5, 0, js)).toBe(false)
  })

  it('la cuenta va por zona, el Carcelero abre su cárcel y la Dragona abre todas', () => {
    const js = jaulas()
    abrirJaula(js[0]!)
    expect(cuentaJaulas(js, 'El Río de Lava')).toEqual({ libres: 1, total: 2 })
    expect(cuentaJaulas(js)).toEqual({ libres: 1, total: 4 })
    expect(abrirCarcel(js).map((j) => j.id)).toEqual(['c', 'd'])
    expect(abrirCarcel(js)).toEqual([])
    expect(abrirTodas(js).map((j) => j.id)).toEqual(['b'])
    expect(cuentaJaulas(js)).toEqual({ libres: 4, total: 4 })
  })
})

describe('la Fragua: Thor se sacude', () => {
  it('seco no se sacude; mojado guarda tres sacudidas con una pausa corta entre ellas', () => {
    const a = aguaNueva()
    expect(sacudir(a)).toBe(false)
    expect(mojarThor(a)).toBe(true)
    expect(mojarThor(a)).toBe(false)
    expect(a.cargas).toBe(FRAGUA.sacudida.cargas)
    expect(sacudir(a)).toBe(true)
    expect(sacudir(a)).toBe(false)
    pasoAgua(a, FRAGUA.sacudida.recargaS)
    expect(sacudir(a)).toBe(true)
    pasoAgua(a, FRAGUA.sacudida.recargaS)
    expect(sacudir(a)).toBe(true)
    pasoAgua(a, FRAGUA.sacudida.recargaS)
    expect(a.cargas).toBe(0)
    expect(sacudir(a)).toBe(false)
  })

  it('las gotas llegan hasta su radio', () => {
    expect(alcanzaSacudida({ x: 0, y: 0 }, { x: FRAGUA.sacudida.radio - 1, y: 0 })).toBe(true)
    expect(alcanzaSacudida({ x: 0, y: 0 }, { x: FRAGUA.sacudida.radio + 1, y: 0 })).toBe(false)
  })
})

describe('la Fragua: los hollines', () => {
  it('se pegan hasta tres (uno en modo peque), cada uno achica el halo hasta un mínimo', () => {
    expect(puedePegarse(2, false)).toBe(true)
    expect(puedePegarse(FRAGUA.hollin.max, false)).toBe(false)
    expect(puedePegarse(1, true)).toBe(false)
    expect(haloConHollines(0)).toBe(1)
    expect(haloConHollines(1)).toBeCloseTo(1 - FRAGUA.hollin.halo)
    expect(haloConHollines(10)).toBe(FRAGUA.hollin.haloMin)
    expect(velocidadHollines(0)).toBe(1)
    expect(velocidadHollines(2)).toBe(FRAGUA.hollin.velocidad)
  })

  it('la luz fría o la sacudida los sueltan', () => {
    expect(sueltanHollines({})).toBe(false)
    expect(sueltanHollines({ luzFria: true })).toBe(true)
    expect(sueltanHollines({ sacudida: true })).toBe(true)
  })
})

describe('la Fragua: los surtidores', () => {
  const surt = (): Surtidor[] => [
    { id: 's1', x: 130, y: 0, px: 178, py: 0, recargaS: 0 },
    { id: 's2', x: -130, y: 0, px: -178, py: 0, recargaS: 0 },
  ]

  it('se tira la palanca que está al lado, sale el chorro y queda recargando', () => {
    const ss = surt()
    expect(palancaCerca(ss, 0, 0)).toBeNull()
    const s = palancaCerca(ss, 170, 10)!
    expect(s.id).toBe('s1')
    expect(tirarPalanca(s)).toBe(true)
    expect(tirarPalanca(s)).toBe(false)
    expect(palancaCerca(ss, 170, 10)).toBeNull()
    pasoSurtidores(ss, FRAGUA.surtidor.recargaS)
    expect(palancaCerca(ss, 170, 10)?.id).toBe('s1')
  })

  it('el chorro alcanza a la Dragona encima y el ícono se muestra en ese surtidor', () => {
    const ss = surt()
    expect(chorroAlcanza(ss[0]!, { x: 130 + FRAGUA.surtidor.alcance - 1, y: 0 })).toBe(true)
    expect(chorroAlcanza(ss[0]!, { x: 0, y: 200 })).toBe(false)
    expect(surtidorBajo(ss, { x: -120, y: 10 })?.id).toBe('s2')
    expect(surtidorBajo(ss, { x: 0, y: 300 })).toBeNull()
  })
})
