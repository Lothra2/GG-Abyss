import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { aturdir, matar, nuevoEnemigoIA, pensar, type ConfigIA, type EntradaIA } from '../ia'
import { ENEMIGOS, TROL_ELITE } from '../../config/balance'

const rata: ConfigIA = { ve: ENEMIGOS.rata!.ve, alcance: ENEMIGOS.rata!.alcance, velocidad: ENEMIGOS.rata!.velocidad, ataquesPorSeg: 1, duracionAtaqueS: 0.4 }
const goblin: ConfigIA = { ve: 220, alcance: 200, velocidad: 60, ataquesPorSeg: 0.7, duracionAtaqueS: 0.5, huyeSi: 120 }
const trol: ConfigIA = {
  ve: 200, alcance: 34, velocidad: 55, ataquesPorSeg: 0.6, duracionAtaqueS: 0.5,
  pesado: { cadaS: TROL_ELITE.golpePesadoCadaS, radio: TROL_ELITE.golpePesadoRadio, avisoS: TROL_ELITE.golpePesadoAvisoS },
  grito: { vidaPct: TROL_ELITE.gritoVidaPct, velocidadPct: TROL_ELITE.gritoVelocidadPct, duracionS: 0.8 },
}
const en = (hx: number, hy: number, extra: Partial<EntradaIA> = {}): EntradaIA => ({ dt: 0.1, heroeX: hx, heroeY: hy, heroeVivo: true, modoPeque: false, ...extra })

describe('IA enemigos', () => {
  it('sin heroína cerca pasea cerca de casa y no persigue', () => {
    const e = nuevoEnemigoIA(500, 500, 12)
    const r = new Azar(1)
    let maxD = 0
    for (let i = 0; i < 600; i++) {
      const o = pensar(e, rata, en(5000, 5000), r)
      if (o.mover) {
        e.x += o.mover.dx * o.mover.vel * 0.1
        e.y += o.mover.dy * o.mover.vel * 0.1
      }
      maxD = Math.max(maxD, Math.hypot(e.x - 500, e.y - 500))
    }
    expect(maxD).toBeLessThan(80)
    expect(e.estado === 'quieto' || e.estado === 'paseo').toBe(true)
  })
  it('persigue a la heroína si la ve y le pega al alcanzarla', () => {
    const e = nuevoEnemigoIA(500, 500, 12)
    const r = new Azar(1)
    let ataque = false
    for (let i = 0; i < 100 && !ataque; i++) {
      const o = pensar(e, rata, en(600, 500), r)
      if (o.mover) e.x += o.mover.dx * o.mover.vel * 0.1
      if (o.atacar) ataque = true
    }
    expect(ataque).toBe(true)
    expect(e.x).toBeGreaterThan(560)
  })
  it('el ataque respeta los ataques por segundo', () => {
    const e = nuevoEnemigoIA(500, 500, 12)
    const r = new Azar(1)
    let ataques = 0
    for (let i = 0; i < 100; i++) {
      const o = pensar(e, rata, en(510, 500), r)
      if (o.atacar) ataques++
    }
    // 10 s a 1 ataque por segundo
    expect(ataques).toBeGreaterThanOrEqual(8)
    expect(ataques).toBeLessThanOrEqual(11)
  })
  it('el goblin se aleja si la heroína está a menos de 120 px y dispara desde lejos', () => {
    const e = nuevoEnemigoIA(500, 500, 22)
    const r = new Azar(1)
    const cerca = pensar(e, goblin, en(560, 500), r)
    expect(cerca.mover!.dx).toBeLessThan(0)
    expect(e.estado).toBe('huir')
    const e2 = nuevoEnemigoIA(500, 500, 22)
    e2.cd = 0
    const lejos = pensar(e2, goblin, en(680, 500), r)
    expect(lejos.atacar).toBe(true)
  })
  it('vuelve a su sitio y se cura si la heroína lo aleja más de 320 px', () => {
    const e = nuevoEnemigoIA(500, 500, 22)
    e.x = 900
    e.vida = 5
    const r = new Azar(1)
    let curo = false
    for (let i = 0; i < 400 && !curo; i++) {
      const o = pensar(e, rata, en(1300, 500), r)
      if (o.mover) {
        e.x += o.mover.dx * o.mover.vel * 0.1
        e.y += o.mover.dy * o.mover.vel * 0.1
      }
      if (o.curar) curo = true
    }
    expect(curo).toBe(true)
    expect(e.vida).toBe(22)
    expect(Math.hypot(e.x - 500, e.y - 500)).toBeLessThan(8)
  })
  it('el jefe (sin cura al volver) no se cura', () => {
    const e = nuevoEnemigoIA(500, 500, 650)
    e.vida = 100
    e.x = 505
    e.estado = 'volver'
    const o = pensar(e, rata, en(5000, 5000, { curaAlVolver: false }), new Azar(1))
    expect(o.curar).toBeUndefined()
    expect(e.vida).toBe(100)
  })
  it('volver también si la heroína cayó', () => {
    const e = nuevoEnemigoIA(500, 500, 12)
    e.x = 560
    const o = pensar(e, rata, en(570, 500, { heroeVivo: false }), new Azar(1))
    expect(e.estado).toBe('volver')
    expect(o.mover!.dx).toBeLessThan(0)
  })
  it('el golpe aturde un momento y no ataca mientras tanto', () => {
    const e = nuevoEnemigoIA(500, 500, 12)
    e.cd = 0
    aturdir(e, 0.3)
    const o = pensar(e, rata, en(510, 500), new Azar(1))
    expect(o.atacar).toBeUndefined()
    expect(e.estado).toBe('aturdido')
  })
  it('un enemigo muerto no hace nada', () => {
    const e = nuevoEnemigoIA(500, 500, 12)
    matar(e)
    expect(pensar(e, rata, en(510, 500), new Azar(1))).toEqual({})
  })
})

describe('golpe pesado del trol', () => {
  it('avisa 1.2 s antes (1.8 s en modo peque) y luego cae', () => {
    for (const [peque, esperado] of [[false, 1.2], [true, 1.8]] as const) {
      const e = nuevoEnemigoIA(500, 500, 140)
      e.cdPesado = 0
      const r = new Azar(1)
      const inicio = pensar(e, trol, en(530, 500, { modoPeque: peque, dt: 0.05 }), r)
      expect(inicio.avisoS).toBeCloseTo(esperado)
      let t = 0
      let cae = false
      for (let i = 0; i < 100 && !cae; i++) {
        const o = pensar(e, trol, en(530, 500, { modoPeque: peque, dt: 0.05 }), r)
        t += 0.05
        if (o.golpePesado) cae = true
      }
      expect(cae).toBe(true)
      expect(t).toBeGreaterThanOrEqual(esperado - 0.06)
      expect(t).toBeLessThanOrEqual(esperado + 0.1)
    }
  })
  it('durante el aviso no se mueve, se puede esquivar caminando', () => {
    const e = nuevoEnemigoIA(500, 500, 140)
    e.cdPesado = 0
    const r = new Azar(1)
    pensar(e, trol, en(530, 500), r)
    const o = pensar(e, trol, en(530, 500), r)
    expect(o.mover).toBeUndefined()
    expect(e.estado).toBe('aviso')
  })
  it('el golpe pesado vuelve cada 6 s', () => {
    const e = nuevoEnemigoIA(500, 500, 140)
    e.cdPesado = 0
    const r = new Azar(1)
    let pesados = 0
    for (let i = 0; i < 200; i++) if (pensar(e, trol, en(530, 500), r).golpePesado) pesados++
    expect(pesados).toBeGreaterThanOrEqual(3)
    expect(pesados).toBeLessThanOrEqual(4)
  })
  it('grita una sola vez al llegar al 50 % y gana 20 % de velocidad', () => {
    const e = nuevoEnemigoIA(500, 500, 140)
    e.vida = 70
    const r = new Azar(1)
    const o = pensar(e, trol, en(700, 500), r)
    expect(o.gritar).toBe(true)
    expect(e.velMult).toBeCloseTo(1.2)
    let otra = false
    for (let i = 0; i < 100; i++) if (pensar(e, trol, en(700, 500), r).gritar) otra = true
    expect(otra).toBe(false)
    expect(e.velMult).toBeCloseTo(1.2)
  })
})
