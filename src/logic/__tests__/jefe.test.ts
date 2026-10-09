import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { avisoDe, danarJefe, despertar, reposar, distanciaAlBorde, distanciaASegmento, nuevoJefe, pensarJefe, type AtaqueJefe, type EntradaJefe, type Jefe, type OrdenJefe } from '../jefe'
import { JEFE } from '../../config/balance'

const entrada = (j: Jefe, extra: Partial<EntradaJefe> = {}): EntradaJefe => ({ dt: 0.05, heroeX: j.cx - 90, heroeY: j.cy + 10, heroeVivo: true, modoPeque: false, ratasVivas: 0, ...extra })

/** Corre el jefe `seg` segundos y junta todas sus órdenes con la hora */
function correr(j: Jefe, seg: number, rng: Azar, f: (j: Jefe, t: number) => Partial<EntradaJefe> = () => ({})): { t: number; o: OrdenJefe }[] {
  const out: { t: number; o: OrdenJefe }[] = []
  for (let t = 0; t < seg; t += 0.05) {
    const e = entrada(j, f(j, t))
    const o = pensarJefe(j, e, rng)
    if (Object.keys(o).length > 0) out.push({ t, o })
  }
  return out
}

const despierto = (): Jefe => {
  const j = nuevoJefe(3280, 400)
  despertar(j)
  return j
}

describe('jefe: fases', () => {
  it('empieza dormido y no hace nada hasta que la heroína entra', () => {
    const j = nuevoJefe(3280, 400)
    expect(correr(j, 5, new Azar(1))).toHaveLength(0)
    expect(despertar(j)).toBe(true)
    expect(despertar(j)).toBe(false)
    expect(j.estado).toBe('intro')
  })
  it('la fase 2 llega justo al 60 % de la vida', () => {
    const j = despierto()
    expect(danarJefe(j, 650 * 0.39)).toEqual({ fase2: false, murio: false })
    expect(j.fase).toBe(1)
    expect(danarJefe(j, 650 * 0.01 + 0.5)).toEqual({ fase2: true, murio: false })
    expect(j.fase).toBe(2)
    // no vuelve a avisar la fase 2 ni cambia de nuevo
    expect(danarJefe(j, 10).fase2).toBe(false)
  })
  it('un golpe grande puede saltarse hasta la muerte y se anota', () => {
    const j = despierto()
    expect(danarJefe(j, 9999)).toEqual({ fase2: false, murio: true })
    expect(j.estado).toBe('muerto')
    expect(j.vida).toBe(0)
    expect(pensarJefe(j, entrada(j), new Azar(1))).toEqual({})
  })
  it('la fase 1 solo usa golpe, golpe fuerte y carga', () => {
    const j = despierto()
    const usados = new Set<AtaqueJefe>()
    for (const { o } of correr(j, 400, new Azar(3), (jj, t) => ({ heroeX: jj.cx - 90 + Math.sin(t * 0.8) * 100, heroeY: jj.cy + Math.cos(t * 0.5) * 70 }))) {
      if (o.aviso) usados.add(o.aviso.ataque)
      if (o.atacando) usados.add(o.atacando)
    }
    expect([...usados].sort()).toEqual(['carga', 'golpe', 'golpe_fuerte'])
  })
  it('la fase 2 suma pisotón, salto y grito', () => {
    const j = despierto()
    danarJefe(j, 650 * 0.45)
    expect(j.fase).toBe(2)
    const usados = new Set<AtaqueJefe>()
    for (const { o } of correr(j, 400, new Azar(5), (jj, t) => ({ heroeX: jj.cx - 60 + Math.sin(t) * 120, heroeY: jj.cy + Math.cos(t) * 80 }))) {
      if (o.aviso) usados.add(o.aviso.ataque)
    }
    for (const a of ['pisoton', 'salto', 'grito', 'carga', 'golpe_fuerte'] as AtaqueJefe[]) expect(usados.has(a), a).toBe(true)
  })
})

describe('jefe: avisos', () => {
  it('cada ataque grande avisa 1.2 s antes y 1.8 s en modo peque', () => {
    for (const a of ['golpe_fuerte', 'carga', 'pisoton', 'salto'] as AtaqueJefe[]) {
      expect(avisoDe(a, false)).toBeCloseTo(1.2)
      expect(avisoDe(a, true)).toBeCloseTo(1.8)
    }
    expect(avisoDe('grito', false)).toBeCloseTo(0.8)
    expect(avisoDe('golpe', false)).toBe(0)
  })
  it('ningún ataque grande pega sin su aviso completo, en los dos modos', () => {
    for (const peque of [false, true]) {
      const j = despierto()
      danarJefe(j, 650 * 0.45)
      let avisoT: Record<string, number> = {}
      let golpesGrandes = 0
      for (const { t, o } of correr(j, 500, new Azar(peque ? 8 : 9), (jj, tt) => ({ modoPeque: peque, heroeX: jj.cx - 70 + Math.sin(tt * 0.7) * 110, heroeY: jj.cy + Math.cos(tt * 0.5) * 90 }))) {
        if (o.aviso) avisoT[o.aviso.ataque] = t
        if (o.golpe && o.golpe.ataque !== 'golpe' && o.golpe.ataque !== 'carga') {
          const visto = avisoT[o.golpe.ataque]
          expect(visto, `${o.golpe.ataque} sin aviso`).toBeDefined()
          // desde que avisó hasta que cae pasa al menos el aviso entero (el salto cae un rato después de empezar a saltar)
          expect(t - visto!).toBeGreaterThanOrEqual(avisoDe(o.golpe.ataque, peque) - 0.06)
          golpesGrandes++
        }
        if (o.golpe?.ataque === 'carga') expect(avisoT.carga).toBeDefined()
      }
      avisoT = {}
      expect(golpesGrandes).toBeGreaterThan(5)
    }
  })
  it('el aviso del golpe fuerte queda delante del jefe, el del pisotón a su alrededor y el del salto donde estaba la heroína', () => {
    const j = despierto()
    j.estado = 'quieto'
    j.pausaS = 0
    j.fase = 2
    const r = new Azar(2)
    const vistos: Record<string, { x: number; y: number; forma: string }> = {}
    for (let i = 0; i < 3000 && Object.keys(vistos).length < 3; i++) {
      j.estado = 'quieto'
      j.pausaS = 0
      j.x = j.cx
      j.y = j.cy
      const o = pensarJefe(j, entrada(j, { heroeX: j.cx - 108, heroeY: j.cy - 40 }), r)
      if (o.aviso && ['golpe_fuerte', 'pisoton', 'salto'].includes(o.aviso.ataque)) vistos[o.aviso.ataque] = { x: o.aviso.x, y: o.aviso.y, forma: o.aviso.forma }
    }
    expect(vistos.pisoton).toMatchObject({ x: j.cx, y: j.cy, forma: 'circulo' })
    expect(vistos.salto).toMatchObject({ x: j.cx - 108, y: j.cy - 40, forma: 'circulo' })
    expect(vistos.golpe_fuerte!.x).toBeLessThan(j.cx)
  })
})

describe('jefe: carga, salto y grito', () => {
  it('la carga avisa la línea, corre hasta el borde, choca y queda aturdido 1.5 s', () => {
    const j = despierto()
    j.estado = 'quieto'
    j.pausaS = 0
    // se fuerza la carga
    const r = new Azar(1)
    let aviso: OrdenJefe['aviso'] | undefined
    for (let i = 0; i < 400 && !aviso; i++) {
      j.estado = 'quieto'
      j.pausaS = 0
      j.x = j.cx
      j.y = j.cy
      const o = pensarJefe(j, entrada(j, { heroeX: j.cx + 150, heroeY: j.cy }), r)
      if (o.aviso?.ataque === 'carga') aviso = o.aviso
    }
    expect(aviso).toBeDefined()
    expect(aviso!.forma).toBe('linea')
    expect(aviso!.largo).toBeCloseTo(JEFE.arenaRadio - JEFE.margenBorde, 0)
    // pasa el aviso entero, empieza la carga y choca
    let aturd = 0
    let t = 0
    for (; t < 6 && !aturd; t += 0.05) {
      const o = pensarJefe(j, entrada(j, { heroeX: j.cx + 150, heroeY: j.cy + 90 }), r)
      if (o.aturdido) aturd = o.aturdido
    }
    expect(aturd).toBe(JEFE.carga.aturdidoS)
    expect(Math.hypot(j.x - j.cx, j.y - j.cy)).toBeCloseTo(JEFE.arenaRadio - JEFE.margenBorde, 0)
    expect(j.estado).toBe('aturdido')
    // aturdido no ataca ni se mueve durante 1.5 s
    let hizo = false
    for (let k = 0; k < 28; k++) if (Object.keys(pensarJefe(j, entrada(j), r)).length > 0) hizo = true
    expect(hizo).toBe(false)
    for (let k = 0; k < 4; k++) pensarJefe(j, entrada(j), r)
    expect(j.estado).not.toBe('aturdido')
  })
  it('la carga le pega a la heroína una sola vez si está en el camino', () => {
    const j = despierto()
    j.estado = 'cargando'
    j.dirX = 1
    j.dirY = 0
    j.x = j.cx - 100
    j.y = j.cy
    j.cargaPego = false
    const r = new Azar(1)
    let golpes = 0
    for (let i = 0; i < 80; i++) {
      const o = pensarJefe(j, entrada(j, { heroeX: j.cx, heroeY: j.cy + 5 }), r)
      if (o.golpe?.ataque === 'carga') golpes++
    }
    expect(golpes).toBe(1)
  })
  it('la carga no le pega a la heroína que se salió del camino', () => {
    const j = despierto()
    j.estado = 'cargando'
    j.dirX = 1
    j.dirY = 0
    j.x = j.cx - 100
    j.y = j.cy
    const r = new Azar(1)
    for (let i = 0; i < 80; i++) expect(pensarJefe(j, entrada(j, { heroeX: j.cx, heroeY: j.cy + 70 }), r).golpe).toBeUndefined()
  })
  it('el grito llama 2 ratas y nunca hay más de 4 vivas', () => {
    const j = despierto()
    j.fase = 2
    j.gritoEnS = 0
    const r = new Azar(4)
    let invocadas = 0
    let ratas = 0
    for (let i = 0; i < 4000; i++) {
      const o = pensarJefe(j, entrada(j, { ratasVivas: ratas, heroeX: j.cx + 120, heroeY: j.cy + 30 }), r)
      if (o.invocar) {
        expect(o.invocar).toBeLessThanOrEqual(2)
        invocadas += o.invocar
        ratas += o.invocar
        expect(ratas).toBeLessThanOrEqual(JEFE.grito.maxRatas)
      }
      // las ratas mueren cada tanto
      if (i % 400 === 399) ratas = Math.max(0, ratas - 2)
    }
    expect(invocadas).toBeGreaterThanOrEqual(4)
  })
  it('con 4 ratas vivas no grita', () => {
    const j = despierto()
    j.fase = 2
    j.gritoEnS = 0
    const r = new Azar(6)
    for (let i = 0; i < 2000; i++) expect(pensarJefe(j, entrada(j, { ratasVivas: 4, heroeX: j.cx + 120 }), r).invocar).toBeUndefined()
  })
  it('el salto cae dentro de la arena aunque la heroína esté afuera', () => {
    const j = despierto()
    j.fase = 2
    const r = new Azar(10)
    let destino: { x: number; y: number } | undefined
    for (let i = 0; i < 4000 && !destino; i++) {
      j.estado = 'quieto'
      j.pausaS = 0
      j.x = j.cx
      j.y = j.cy
      const o = pensarJefe(j, entrada(j, { heroeX: j.cx + 400, heroeY: j.cy }), r)
      if (o.aviso?.ataque === 'salto') destino = { x: o.aviso.x, y: o.aviso.y }
    }
    expect(destino).toBeDefined()
    expect(Math.hypot(destino!.x - j.cx, destino!.y - j.cy)).toBeLessThanOrEqual(JEFE.arenaRadio)
  })
})

describe('jefe: nunca se cura', () => {
  it('su vida solo baja, pase lo que pase', () => {
    const j = despierto()
    const r = new Azar(11)
    let ultima = j.vida
    for (let i = 0; i < 6000; i++) {
      pensarJefe(j, entrada(j, { heroeVivo: i % 700 < 500, heroeX: j.cx + Math.sin(i / 50) * 150, heroeY: j.cy + Math.cos(i / 70) * 100 }), r)
      if (i % 90 === 0) danarJefe(j, 3)
      expect(j.vida).toBeLessThanOrEqual(ultima)
      ultima = j.vida
    }
  })
  it('si la heroína cae el jefe se queda donde estaba, sin curarse, y retoma al volver', () => {
    const j = despierto()
    danarJefe(j, 400)
    const vida = j.vida
    const r = new Azar(2)
    const x = j.x
    const y = j.y
    for (let i = 0; i < 400; i++) expect(pensarJefe(j, entrada(j, { heroeVivo: false }), r).mover).toBeUndefined()
    expect(j.vida).toBe(vida)
    expect(j.x).toBe(x)
    expect(j.y).toBe(y)
    const ordenes = correr(j, 30, r)
    expect(ordenes.length).toBeGreaterThan(0)
    expect(j.vida).toBe(vida)
  })
  it('el golpe que cambia de fase interrumpe el ataque que preparaba', () => {
    const j = despierto()
    j.estado = 'aviso'
    j.ataque = 'golpe_fuerte'
    j.t = 0.9
    danarJefe(j, 650 * 0.41)
    expect(j.estado).toBe('intro')
    expect(j.ataque).toBeNull()
  })
})

describe('jefe: reposo tras el rescate', () => {
  it('vuelve al centro y se duerme con la misma vida y la misma fase', () => {
    const j = despierto()
    danarJefe(j, 400)
    j.x = j.cx + 90
    j.y = j.cy - 40
    const vida = j.vida
    reposar(j)
    expect(j.estado).toBe('dormido')
    expect(j.vida).toBe(vida)
    expect(j.fase).toBe(2)
    expect([j.x, j.y]).toEqual([j.cx, j.cy])
    // al volver a entrar, despierta otra vez
    expect(despertar(j)).toBe(true)
    expect(j.vida).toBe(vida)
  })
  it('un jefe vencido no vuelve', () => {
    const j = despierto()
    danarJefe(j, 9999)
    reposar(j)
    expect(j.estado).toBe('muerto')
  })
})

describe('geometría de la arena', () => {
  const arena = { cx: 100, cy: 100 }
  it('la distancia al borde desde el centro es el radio menos el margen', () => {
    expect(distanciaAlBorde(arena, 100, 100, 1, 0)).toBeCloseTo(JEFE.arenaRadio - JEFE.margenBorde)
  })
  it('desde un punto desplazado queda más corto hacia un lado y más largo hacia el otro', () => {
    const r = JEFE.arenaRadio - JEFE.margenBorde
    expect(distanciaAlBorde(arena, 150, 100, 1, 0)).toBeCloseTo(r - 50)
    expect(distanciaAlBorde(arena, 150, 100, -1, 0)).toBeCloseTo(r + 50)
  })
  it('distancia a un segmento', () => {
    expect(distanciaASegmento(5, 3, 0, 0, 10, 0)).toBeCloseTo(3)
    expect(distanciaASegmento(-4, 3, 0, 0, 10, 0)).toBeCloseTo(5)
    expect(distanciaASegmento(3, 3, 5, 5, 5, 5)).toBeCloseTo(Math.hypot(2, 2))
  })
})
