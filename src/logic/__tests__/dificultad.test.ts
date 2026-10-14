import { describe, expect, it } from 'vitest'
import { statsDe } from '../stats'
import { bonosDeEquipo } from '../equipo'
import { danoDeJefe, enemigoDelPiso, vidaDeJefe } from '../dureza'
import { reducirPorArmadura } from '../combate'
import { leerCatalogo } from '../catalogo'
import { ENEMIGOS, JEFE, JEFE_CAMPANA, JEFE_DRAGONA, JEFE_PEZ, JEFE_POLILLA, JEFE_REY, MODO_PEQUE, type ClaseId } from '../../config/balance'
import catJson from '../../../public/assets/kit/botin/catalogo.json'

// F13, pedido de Rick: "calibra la dificultad, hoy sigue siendo muy fácil". Se mide con el equipo normal de su nivel
// (la mejor arma y la mejor pieza de cada casillero que ya pudo encontrar), no a ojo.

type It = { id: string; level: number; rarity: string; base: { cat: string; icon?: string; slot?: string }; stats: { damage?: [number, number]; defense?: number } }
const items = (catJson as unknown as { items: It[] }).items
const cat = leerCatalogo(catJson as never)
const NIVEL_DE_PISO = [0, 2, 4, 6, 8, 10, 10, 12]
const COMUNES: Record<number, string[]> = { 1: ['rata', 'calabaza', 'goblin_arquero'], 2: ['raicita', 'vigia_raices'], 3: ['polilla_ceniza', 'sombra'], 4: ['marinero_niebla', 'cangrejo_ceniza'], 5: ['sonambulo_piedra', 'gargola_dormida', 'duende_sueno'], 6: ['salamandra_brasa'], 7: ['lobo_escarcha', 'espectro_helado', 'diablillo', 'caballero_congelado', 'bruja_escarcha', 'sombra_devoradora'] }
const ATAQUES: Record<string, unknown>[] = [{}, JEFE, JEFE_CAMPANA, JEFE_POLILLA, JEFE_PEZ, JEFE_REY, JEFE_DRAGONA]
const JEFES = [0, JEFE.vida, JEFE_CAMPANA.vida, JEFE_POLILLA.vida, JEFE_PEZ.vida, JEFE_REY.vida, JEFE_DRAGONA.vida]

function heroina(clase: ClaseId, piso: number) {
  const L = NIVEL_DE_PISO[piso]!
  const ok = items.filter((i) => i.level <= L + 1 && ['normal', 'magic', 'rare'].includes(i.rarity))
  const arma = ok.filter((i) => i.base.cat === 'weapon' && (clase === 'amazona' ? /bow/.test(i.base.icon ?? '') : !/bow|wand|staff|scepter/.test(i.base.icon ?? ''))).sort((a, b) => (b.stats.damage![0] + b.stats.damage![1]) - (a.stats.damage![0] + a.stats.damage![1]))[0]!
  const eq: Record<string, string> = { arma: arma.id }
  const porCasillero = new Map<string, It>()
  for (const i of ok.filter((q) => q.base.cat === 'armor')) {
    const k = i.base.slot ?? i.id
    const ya = porCasillero.get(k)
    if (!ya || (i.stats.defense ?? 0) > (ya.stats.defense ?? 0)) porCasillero.set(k, i)
  }
  ;[...porCasillero.values()].forEach((i, k) => (eq[`a${k}`] = i.id))
  return statsDe(clase, L, bonosDeEquipo(cat, eq, clase))
}

describe('la dificultad (F13)', () => {
  for (const clase of ['paladin', 'amazona'] as const) {
    it(`${clase}: un enemigo común aguanta varios golpes y la heroína no aguanta para siempre`, () => {
      for (let piso = 1; piso <= 7; piso++) {
        const s = heroina(clase, piso)
        const golpe = (s.danoMin + s.danoMax) / 2
        for (const t of COMUNES[piso]!) {
          const e = enemigoDelPiso(ENEMIGOS[t]!, piso)
          const golpes = Math.ceil(e.vida / golpe)
          const aguanta = Math.ceil(s.vidaMax / reducirPorArmadura((e.dano[0] + e.dano[1]) / 2, s.armadura))
          expect(golpes, `${t} en el piso ${piso}`).toBeGreaterThanOrEqual(2)
          expect(golpes, `${t} en el piso ${piso}`).toBeLessThanOrEqual(14)
          expect(aguanta, `${t} en el piso ${piso}`).toBeLessThanOrEqual(40)
          expect(aguanta, `${t} en el piso ${piso}`).toBeGreaterThanOrEqual(6)
        }
      }
    })

    it(`${clase}: cada jefe aguanta más de 45 s de golpes seguidos`, () => {
      for (let piso = 1; piso <= 6; piso++) {
        const s = heroina(clase, piso)
        const dps = ((s.danoMin + s.danoMax) / 2) * s.ataquesPorSeg
        expect(vidaDeJefe(JEFES[piso]!) / dps, `jefe del piso ${piso}`).toBeGreaterThan(45)
      }
    })
  }

  it('los golpes de cada jefe duelen: con su equipo aguanta entre 4 y 16 (antes eran hasta 39)', () => {
    for (let piso = 1; piso <= 6; piso++) {
      const s = heroina('paladin', piso)
      for (const [k, v] of Object.entries(ATAQUES[piso]!)) {
        const d = (v as { dano?: readonly [number, number] } | null)?.dano
        if (!d || !Array.isArray(d)) continue
        const aguanta = Math.ceil(s.vidaMax / reducirPorArmadura(((d[0] + d[1]) / 2) * danoDeJefe(piso), s.armadura))
        expect(aguanta, `${k} del jefe del piso ${piso}`).toBeGreaterThanOrEqual(4)
        expect(aguanta, `${k} del jefe del piso ${piso}`).toBeLessThanOrEqual(16)
      }
    }
    expect(danoDeJefe(7, 2)).toBeGreaterThan(danoDeJefe(7))
  })

  it('en modo peque sigue siendo más amable, pero ya no regala', () => {
    expect(MODO_PEQUE.danoEnemigos).toBeGreaterThan(0.5)
    expect(MODO_PEQUE.danoEnemigos).toBeLessThan(1)
    expect(MODO_PEQUE.danoHeroina).toBeLessThan(1.5)
    expect(MODO_PEQUE.danoHeroina).toBeGreaterThan(1)
  })
})
