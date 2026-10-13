import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { danarJefe, despertar, enLinea, nuevoJefe, pensarJefe, reposar, type EntradaJefe, type Jefe, type OrdenJefe } from '../jefe'
import { JEFE, JEFE_PEZ, MODO_PEQUE } from '../../config/balance'

const entrada = (j: Jefe, extra: Partial<EntradaJefe> = {}): EntradaJefe => ({ dt: 0.05, heroeX: j.x - 70, heroeY: j.y + 10, heroeVivo: true, modoPeque: false, ratasVivas: 0, ...extra })

function correr(j: Jefe, seg: number, rng: Azar, f: (j: Jefe, t: number) => Partial<EntradaJefe> = () => ({})): { t: number; o: OrdenJefe }[] {
  const out: { t: number; o: OrdenJefe }[] = []
  for (let t = 0; t < seg; t += 0.05) {
    const o = pensarJefe(j, entrada(j, f(j, t)), rng)
    if (Object.keys(o).length > 0) out.push({ t, o })
  }
  return out
}

const pez = (): Jefe => {
  const j = nuevoJefe(2704, 2352, JEFE_PEZ.vida, 'pez')
  despertar(j)
  return j
}

describe('Pez Farol', () => {
  it('sumergido no recibe daño: solo se ve la lucecita', () => {
    const j = pez()
    expect(j.escudo).toBe(true)
    expect(danarJefe(j, 50)).toMatchObject({ escudo: true })
    expect(j.vida).toBe(JEFE_PEZ.vida)
  })

  it('sale a morder con aviso delante de él, y queda afuera un rato para pegarle', () => {
    const j = pez()
    const rng = new Azar(3)
    const ords = correr(j, 8, rng)
    const aviso = ords.find((x) => x.o.aviso?.ataque === 'mordida')
    expect(aviso).toBeDefined()
    expect(aviso!.o.emerger).toBe(true)
    expect(aviso!.o.aviso!.forma).toBe('frente')
    expect(aviso!.o.aviso!.seg).toBeCloseTo(JEFE_PEZ.mordida.avisoS)
    const golpe = ords.find((x) => x.o.golpe?.ataque === 'mordida')
    expect(golpe).toBeDefined()
    // el golpe cae donde estaba el aviso, cuando terminó el aviso
    expect(golpe!.o.golpe!.x).toBeCloseTo(aviso!.o.aviso!.x)
    expect(golpe!.t - aviso!.t).toBeGreaterThanOrEqual(JEFE_PEZ.mordida.avisoS - 0.06)
    // después de morder se le puede pegar, y luego se hunde
    const hunde = ords.find((x) => x.t > golpe!.t && x.o.hundirse)
    expect(hunde).toBeDefined()
    expect(hunde!.t - golpe!.t).toBeGreaterThanOrEqual(JEFE_PEZ.mordida.fueraS - 0.1)
  })

  it('afuera se le pega y la vida solo baja', () => {
    const j = pez()
    const rng = new Azar(3)
    correr(j, 8, rng, (jj) => {
      if (!jj.escudo) danarJefe(jj, 5)
      return {}
    })
    expect(j.vida).toBeLessThan(JEFE_PEZ.vida)
  })

  it('Thor alzando el farol cerca lo saca aturdido (sin escudo) y en modo peque dura más', () => {
    for (const peque of [false, true]) {
      const j = pez()
      const o = pensarJefe(j, entrada(j, { alzado: { x: j.x + 100, y: j.y }, modoPeque: peque }), new Azar(1))
      // durante el rugido de entrada no cae
      expect(o.encandilado).toBeUndefined()
      j.estado = 'quieto'
      const o2 = pensarJefe(j, entrada(j, { alzado: { x: j.x + 100, y: j.y }, modoPeque: peque }), new Azar(1))
      expect(o2.encandilado).toBe(true)
      expect(o2.escudo).toBe(false)
      expect(j.estado).toBe('aturdido')
      expect(o2.aturdido).toBeCloseTo(JEFE_PEZ.aturdidoS * (peque ? MODO_PEQUE.avisos : 1))
      expect(danarJefe(j, 10).escudo).toBeUndefined()
    }
  })

  it('el farol alzado lejos no lo alcanza, y no lo encandila dos veces seguidas', () => {
    const j = pez()
    j.estado = 'quieto'
    expect(pensarJefe(j, entrada(j, { alzado: { x: j.x + JEFE_PEZ.alzarRadio + 30, y: j.y } }), new Azar(1)).encandilado).toBeUndefined()
    expect(pensarJefe(j, entrada(j, { alzado: { x: j.x, y: j.y } }), new Azar(1)).encandilado).toBe(true)
    // pasa el aturdido, se hunde, y el farol todavía no lo vuelve a sacar
    const ords = correr(j, JEFE_PEZ.aturdidoS + 0.5, new Azar(2), (jj) => ({ alzado: { x: jj.x, y: jj.y } }))
    expect(ords.some((x) => x.o.hundirse)).toBe(true)
    expect(ords.filter((x) => x.o.encandilado)).toHaveLength(0)
  })

  it('la fase 2 enseña la ola sola: una franja que empuja', () => {
    const j = pez()
    j.estado = 'quieto'
    j.escudo = false
    expect(danarJefe(j, JEFE_PEZ.vida * (1 - JEFE.fase2Pct / 100) + 1).fase2).toBe(true)
    const ords = correr(j, 6, new Azar(4), () => ({}))
    const aviso = ords.find((x) => x.o.aviso?.ataque === 'ola')
    expect(aviso).toBeDefined()
    expect(aviso!.o.aviso!.forma).toBe('linea')
    expect(aviso!.o.aviso!.largo).toBeGreaterThan(0)
    const g = ords.find((x) => x.o.golpe?.ataque === 'ola')!.o.golpe!
    expect(g.empuje).toBe(JEFE_PEZ.ola.empuje)
    expect(enLinea(g.x + g.dx * 40, g.y + g.dy * 40, g.x, g.y, g.dx, g.dy, g.largo, g.ancho)).toBe(true)
    expect(enLinea(g.x - g.dy * 80, g.y + g.dx * 80, g.x, g.y, g.dx, g.dy, g.largo, g.ancho)).toBe(false)
  })

  it('la fase 3 llama cangrejos y medusas, sin pasarse del tope', () => {
    const j = pez()
    j.estado = 'quieto'
    j.escudo = false
    danarJefe(j, JEFE_PEZ.vida * (1 - JEFE.fase2Pct / 100) + 1)
    const r = danarJefe(j, JEFE_PEZ.vida * ((JEFE.fase2Pct - JEFE_PEZ.fase3Pct) / 100))
    expect(r.fase3).toBe(true)
    expect(j.fase).toBe(3)
    const ords = correr(j, 6, new Azar(5), () => ({ ratasVivas: JEFE_PEZ.llamada.max - 1 }))
    const inv = ords.find((x) => x.o.invocar !== undefined)
    expect(inv).toBeDefined()
    expect(inv!.o.invocar).toBe(1)
  })

  it('si la heroína cae, se repone en el fondo sin curarse', () => {
    const j = pez()
    j.escudo = false
    danarJefe(j, 100)
    reposar(j)
    expect(j.escudo).toBe(true)
    expect(j.vida).toBe(JEFE_PEZ.vida - 100)
    expect(j.estado).toBe('dormido')
  })
})
