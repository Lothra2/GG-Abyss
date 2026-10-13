import { describe, expect, it } from 'vitest'
import { Azar } from '../azar'
import { danarJefe, despertar, nuevoJefe, pensarJefe, type EntradaJefe, type Jefe, type OrdenJefe } from '../jefe'
import { JEFE, JEFE_REY, MODO_PEQUE } from '../../config/balance'

const entrada = (j: Jefe, extra: Partial<EntradaJefe> = {}): EntradaJefe => ({ dt: 0.05, heroeX: j.x - 60, heroeY: j.y + 10, heroeVivo: true, modoPeque: false, ratasVivas: 0, vulnerable: true, ...extra })

function correr(j: Jefe, seg: number, rng: Azar, f: (j: Jefe, t: number) => Partial<EntradaJefe> = () => ({})): { t: number; o: OrdenJefe }[] {
  const out: { t: number; o: OrdenJefe }[] = []
  for (let t = 0; t < seg; t += 0.05) {
    const o = pensarJefe(j, entrada(j, f(j, t)), rng)
    if (Object.keys(o).length > 0) out.push({ t, o })
  }
  return out
}

const rey = (): Jefe => {
  const j = nuevoJefe(1000, 1000, JEFE_REY.vida, 'rey')
  despertar(j)
  j.estado = 'quieto'
  return j
}
const aFase2 = (j: Jefe) => danarJefe(j, JEFE_REY.vida * (1 - JEFE.fase2Pct / 100) + 1)

describe('el Rey de Piedra', () => {
  it('en la fase 1 se le pega siempre, y el puño avisa delante de él', () => {
    const j = rey()
    expect(j.escudo).toBe(false)
    expect(danarJefe(j, 10).escudo).toBeUndefined()
    const ords = correr(j, 8, new Azar(2))
    const av = ords.find((x) => x.o.aviso?.ataque === 'puno')
    expect(av).toBeDefined()
    expect(av!.o.aviso!.forma).toBe('frente')
    expect(av!.o.aviso!.seg).toBeCloseTo(JEFE_REY.puno.avisoS)
    const g = ords.find((x) => x.o.golpe?.ataque === 'puno')!.o.golpe!
    expect(g.x).toBeCloseTo(av!.o.aviso!.x)
    // en la fase 1 el golpe no suelta chispas
    expect(ords.some((x) => x.o.chispas)).toBe(false)
  })

  it('la fase 2 enseña la canción de cuna: al terminar se apagan las lámparas y su piedra no siente los golpes', () => {
    const j = rey()
    expect(aFase2(j).fase2).toBe(true)
    const ords = correr(j, 6, new Azar(3))
    expect(ords.find((x) => x.o.aviso)?.o.aviso?.ataque).toBe('cancion')
    expect(ords.some((x) => x.o.cancion)).toBe(true)
    // con las lámparas apagadas: escudo
    pensarJefe(j, entrada(j, { vulnerable: false }), new Azar(1))
    expect(j.escudo).toBe(true)
    expect(danarJefe(j, 50).escudo).toBe(true)
  })

  it('al prenderse las cuatro lámparas cae de rodillas y ahí se le pega; en modo peque dura más', () => {
    for (const peque of [false, true]) {
      const j = rey()
      aFase2(j)
      j.estado = 'quieto'
      pensarJefe(j, entrada(j, { vulnerable: false }), new Azar(1))
      const o = pensarJefe(j, entrada(j, { vulnerable: true, modoPeque: peque }), new Azar(1))
      expect(j.estado).toBe('aturdido')
      expect(o.aturdido).toBeCloseTo(JEFE_REY.rodillasS * (peque ? MODO_PEQUE.avisos : 1))
      expect(danarJefe(j, 10).escudo).toBeUndefined()
    }
  })

  it('desde la fase 2 cada golpe al piso suelta chispas de la corona', () => {
    const j = rey()
    aFase2(j)
    j.forzar = 'puno'
    const ords = correr(j, 5, new Azar(5), () => ({ vulnerable: false }))
    const c = ords.find((x) => x.o.chispas)
    expect(c).toBeDefined()
    expect(c!.o.chispas!.n).toBe(JEFE_REY.chispasPorGolpe)
  })

  it('la fase 3 trae el barrido en línea y la llamada de sonámbulos sin pasarse del tope', () => {
    const j = rey()
    aFase2(j)
    const r = danarJefe(j, JEFE_REY.vida * ((JEFE.fase2Pct - JEFE_REY.fase3Pct) / 100))
    expect(r.fase3).toBe(true)
    expect(j.fase).toBe(3)
    const ords = correr(j, 20, new Azar(7), () => ({ ratasVivas: JEFE_REY.llamada.max - 1 }))
    const inv = ords.find((x) => x.o.invocar !== undefined)
    expect(inv).toBeDefined()
    expect(inv!.o.invocar).toBe(1)
    // el barrido avisa en línea delante de él y pega en esa franja
    j.estado = 'quieto'
    j.pausaS = 0
    j.forzar = 'barrido'
    const b = correr(j, 4, new Azar(8))
    const av = b.find((x) => x.o.aviso?.ataque === 'barrido')!.o.aviso!
    expect(av.forma).toBe('linea')
    expect(av.largo).toBe(JEFE_REY.barrido.largo)
    expect(b.some((x) => x.o.golpe?.ataque === 'barrido')).toBe(true)
  })

  it('la vida solo baja', () => {
    const j = rey()
    let antes = j.vida
    for (const t of [10, 0, 25]) {
      danarJefe(j, t)
      expect(j.vida).toBeLessThanOrEqual(antes)
      antes = j.vida
    }
  })
})
