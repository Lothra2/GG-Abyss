import { Azar } from '../src/logic/azar'
import { danarJefe, despertar, nuevoJefe, pensarJefe } from '../src/logic/jefe'
import { statsDe } from '../src/logic/stats'
import { rangoMordida } from '../src/logic/thorCombate'
import { CLASES, JEFE, MODO_PEQUE, PROGRESION, type ClaseId } from '../src/config/balance'

/**
 * Simulación de la pelea con el minotauro para afinar el balance (PLAN.md F4, aceptación): usa la máquina de estados real del jefe
 * y un modelo simple de la heroína: ataca todo el tiempo que no se mueve, Thor muerde cada 2 s y las niñas esquivan los avisos
 * con cierta probabilidad. No es el juego, es un termómetro: dice si el número de vida y daño está en el rango jugable.
 */
export interface Modelo {
  /** probabilidad de salvarse de un ataque grande avisado (1.2 s o 1.8 s) */
  esquiva: number
  /** probabilidad de que le toque el golpe normal sin aviso */
  tocaGolpe: number
  /** fracción del tiempo que de verdad está pegando (el resto se mueve o esquiva) */
  uptime: number
  /** extra por las habilidades (torbellino, nova, lluvia...) como fracción del daño base */
  habilidades: number
}

export function pelea(clase: ClaseId, nivel: number, peque: boolean, m: Modelo, semilla: number, usaPociones = false): { gana: boolean; seg: number; vidaFinal: number } {
  const rng = new Azar(semilla)
  const s = statsDe(clase, nivel)
  const b = CLASES[clase]
  const j = nuevoJefe(0, 0)
  despertar(j)
  let vida = s.vidaMax
  let sinDano = 99
  let pociones = usaPociones ? 2 : 0
  const dmgGolpe = ((s.danoMin + s.danoMax) / 2) * (1 + 0.05 * 0.5) * s.ataquesPorSeg
  const dpsHeroe = dmgGolpe * m.uptime * (1 + m.habilidades)
  const mord = rangoMordida(nivel)
  const dpsThor = (mord[0] + mord[1]) / 2 / 2
  const dist = b.alcance < 100 ? 55 : 150
  // lo que las habilidades de defensa aportan: el Bloqueo del paladín (1.5 s de cada 4 con 80 % menos daño) y Curar de la druida (35 % cada 8 s)
  const reduccion = clase === 'paladin' ? 1 - (1.5 / 4) * 0.8 : 1
  const curaPorSeg = clase === 'druida' ? (s.vidaMax * 0.35) / 8 : 0
  let avisoVisto: Record<string, number> = {}
  let hx = dist
  let hy = 0
  for (let t = 0; t < 400; t += 0.05) {
    // la heroína se queda a su distancia, mirando al jefe
    const ang = Math.atan2(hy - j.y, hx - j.x)
    hx = j.x + Math.cos(ang) * dist
    hy = j.y + Math.sin(ang) * dist
    const o = pensarJefe(j, { dt: 0.05, heroeX: hx, heroeY: hy, heroeVivo: vida > 0, modoPeque: peque, ratasVivas: 0 }, rng)
    if (o.mover) {
      j.x += o.mover.dx * o.mover.vel * 0.05
      j.y += o.mover.dy * o.mover.vel * 0.05
    }
    if (o.aviso) avisoVisto[o.aviso.ataque] = t
    if (o.golpe) {
      const grande = o.golpe.ataque !== 'golpe'
      const p = grande ? 1 - m.esquiva : m.tocaGolpe
      // la carga solo le pega si estaba en el camino
      const pega = o.golpe.ataque === 'carga' ? rng.prob(1 - m.esquiva) : rng.prob(p)
      if (pega) {
        const d = rng.rango(o.golpe.dano[0], o.golpe.dano[1]) * (peque ? MODO_PEQUE.danoEnemigos : 1) * reduccion
        vida -= d
        sinDano = 0
      }
    }
    sinDano += 0.05
    if (curaPorSeg > 0) vida = Math.min(s.vidaMax, vida + curaPorSeg * 0.05)
    if (sinDano >= PROGRESION.vidaRegenTrasDanoS) vida = Math.min(s.vidaMax, vida + PROGRESION.vidaRegenPorSeg * 0.05)
    if (usaPociones && pociones > 0 && vida < s.vidaMax * 0.35) {
      vida = Math.min(s.vidaMax, vida + s.vidaMax * 0.4)
      pociones--
    }
    if (vida <= 0) return { gana: false, seg: t, vidaFinal: 0 }
    // daño de la heroína y de Thor, solo mientras el jefe está de pie y despierto
    if (j.estado !== 'intro' && j.estado !== 'dormido') {
      const d = (dpsHeroe + dpsThor) * 0.05 * (j.estado === 'aturdido' ? 1.4 : 1)
      const r = danarJefe(j, d)
      if (r.murio) return { gana: true, seg: t, vidaFinal: vida }
    }
  }
  avisoVisto = {}
  return { gana: false, seg: 400, vidaFinal: vida }
}

export function tasa(clase: ClaseId, nivel: number, peque: boolean, m: Modelo, n = 300): { gana: number; segProm: number } {
  let g = 0
  let seg = 0
  for (let i = 0; i < n; i++) {
    const r = pelea(clase, nivel, peque, m, 1000 + i)
    if (r.gana) {
      g++
      seg += r.seg
    }
  }
  return { gana: g / n, segProm: g > 0 ? seg / g : 0 }
}

if (process.argv[1]?.endsWith('simular-jefe.ts')) {
  const normal: Modelo = { esquiva: 0.8, tocaGolpe: 0.6, uptime: 0.7, habilidades: 0.15 }
  const peque: Modelo = { esquiva: 0.9, tocaGolpe: 0.5, uptime: 0.7, habilidades: 0.15 }
  for (const c of ['amazona', 'druida', 'paladin', 'hechicera'] as ClaseId[]) for (const n of [4, 5, 6]) console.log(c, 'nivel', n, 'normal', JSON.stringify(tasa(c, n, false, normal)), 'peque', JSON.stringify(tasa(c, n, true, peque)))
  console.log('vida jefe', JEFE.vida)
}
