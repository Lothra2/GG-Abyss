import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { aSotavento, calientaPorS, companerasDe, companerasNuevas, companerasVivas, devorar, enfriaPorS, frioNuevo, hieloNuevo, laAlcanza, pasoCompaneras, pasoFrio, pasoHielo, pasoVentisca, radioCompaneras, recuperarTodas, velocidadFrio, ventiscaNueva } from '../corazon'
import { CORAZON } from '../../config/balance'

describe('el Corazón Helado: el frío', () => {
  it('a oscuras enfría, la ventisca y el agua helada más, el fuego calienta y las compañeras un poco', () => {
    expect(enfriaPorS({}, false)).toBe(CORAZON.frio.oscuro)
    expect(enfriaPorS({ ventisca: true }, false)).toBe(CORAZON.frio.oscuro + CORAZON.frio.ventisca)
    expect(enfriaPorS({ fuego: true, ventisca: true }, false)).toBe(0)
    expect(enfriaPorS({ companeras: true }, false)).toBe(0)
    expect(calientaPorS({ fuego: true })).toBe(CORAZON.frio.fuego)
    expect(calientaPorS({ companeras: true })).toBe(CORAZON.frio.companeras)
    expect(calientaPorS({ companeras: true, ventisca: true })).toBe(0)
    expect(enfriaPorS({ ventisca: true }, true)).toBeLessThan(enfriaPorS({ ventisca: true }, false))
  })

  it('congelada camina lento y pierde vida hasta calentarse (en modo peque menos)', () => {
    const f = frioNuevo()
    let dano = 0
    const cambios: string[] = []
    for (let t = 0; t < 12; t += 0.1) {
      const r = pasoFrio(f, 0.1, { ventisca: true, aguaHelada: true }, false)
      dano += r.dano
      if (r.cambio) cambios.push(r.cambio)
    }
    expect(f.congelada).toBe(true)
    expect(dano).toBeGreaterThan(0)
    expect(velocidadFrio(f)).toBe(CORAZON.frio.velocidad)
    for (let t = 0; t < 4; t += 0.1) { const r = pasoFrio(f, 0.1, { fuego: true }, false); if (r.cambio) cambios.push(r.cambio) }
    expect(f.congelada).toBe(false)
    expect(cambios).toEqual(['congelada', 'tibia'])
    const g = frioNuevo()
    let dp = 0
    for (let t = 0; t < 20; t += 0.1) dp += pasoFrio(g, 0.1, { ventisca: true, aguaHelada: true }, true).dano
    expect(dp).toBeLessThan(dano * 2)
  })
})

describe('el Corazón Helado: la ventisca', () => {
  it('calma, aviso (el aullido) y sopla, y vuelve a la calma', () => {
    const rng = new Azar(3)
    const v = ventiscaNueva(rng)
    const fases: string[] = []
    for (let t = 0; t < 120; t += 0.25) { const f = pasoVentisca(v, 0.25, rng, false); if (f) fases.push(f) }
    expect(fases.slice(0, 3)).toEqual(['aviso', 'sopla', 'calma'])
    expect(Math.hypot(v.dx, v.dy)).toBeCloseTo(1)
  })

  it('detrás de una columna (a sotavento) no llega, al costado o delante sí', () => {
    const col = { x: 0, y: 0 }
    expect(aSotavento(60, 0, col, 1, 0)).toBe(true)
    expect(aSotavento(-60, 0, col, 1, 0)).toBe(false)
    expect(aSotavento(60, 80, col, 1, 0)).toBe(false)
    expect(aSotavento(CORAZON.ventisca.refugioLargo + 20, 0, col, 1, 0)).toBe(false)
    const v = { fase: 'sopla' as const, t: 3, dx: 1, dy: 0 }
    expect(laAlcanza(v, 60, 0, [col])).toBe(false)
    expect(laAlcanza(v, 60, 200, [col])).toBe(true)
    expect(laAlcanza({ ...v, fase: 'calma' }, 60, 200, [col])).toBe(false)
  })
})

describe('el Corazón Helado: el hielo fino', () => {
  it('parada encima cruje y se rompe; si se mueve no; roto se rehace solo', () => {
    const h = hieloNuevo()
    const estados: string[] = []
    for (let t = 0; t < CORAZON.hielo.rompeS + 0.2; t += 0.1) { const e = pasoHielo(h, 0.1, true, true, false); if (e) estados.push(e) }
    expect(estados).toEqual(['cruje', 'roto'])
    for (let t = 0; t < CORAZON.hielo.rehaceS + 0.2; t += 0.5) pasoHielo(h, 0.5, false, false, false)
    expect(h.estado).toBe('firme')
    const k = hieloNuevo()
    for (let t = 0; t < 10; t += 0.1) pasoHielo(k, 0.1, false, true, false)
    expect(k.estado).toBe('firme')
  })

  it('en modo peque aguanta más', () => {
    const a = hieloNuevo()
    const b = hieloNuevo()
    for (let t = 0; t < CORAZON.hielo.rompeS + 0.2; t += 0.1) { pasoHielo(a, 0.1, true, true, false); pasoHielo(b, 0.1, true, true, true) }
    expect(a.estado).toBe('roto')
    expect(b.estado).not.toBe('roto')
  })
})

describe('el Corazón Helado: las luces compañeras', () => {
  it('una por cada quinto de jaulas libres en la Fragua, hasta cinco', () => {
    expect(companerasDe(0, 50)).toBe(0)
    expect(companerasDe(10, 50)).toBe(1)
    expect(companerasDe(50, 50)).toBe(5)
    expect(companerasDe(5, 0)).toBe(0)
  })

  it('la sombra se come una, vuelve sola con el tiempo y todas en la hoguera', () => {
    const c = companerasNuevas(3)
    expect(devorar(c)).toBe(true)
    expect(devorar(c)).toBe(true)
    expect(companerasVivas(c)).toBe(1)
    expect(pasoCompaneras(c, CORAZON.companeras.vuelveS + 1)).toBe(2)
    expect(companerasVivas(c)).toBe(3)
    devorar(c)
    expect(recuperarTodas(c)).toBe(1)
    const vacia = companerasNuevas(0)
    expect(devorar(vacia)).toBe(false)
    expect(radioCompaneras(0)).toBe(0)
    expect(radioCompaneras(5)).toBeGreaterThan(radioCompaneras(1))
  })
})
