import type { Azar } from './azar'
import { ENEMIGO_COMUN, MODO_PEQUE } from '../config/balance'

export type EstadoIA = 'quieto' | 'paseo' | 'perseguir' | 'atacando' | 'huir' | 'volver' | 'aviso' | 'aturdido' | 'grito' | 'muerto'

export interface ConfigIA {
  ve: number
  alcance: number
  velocidad: number
  ataquesPorSeg: number
  /** cuánto dura el cuerpo del ataque (la animación), sin moverse */
  duracionAtaqueS: number
  /** si la heroína está más cerca que esto, se aleja (goblin) */
  huyeSi?: number
  volverSiLejos?: number
  paseoRadio?: number
  paseoCadaS?: readonly [number, number]
  /** golpe pesado con aviso (trol) */
  pesado?: { cadaS: number; radio: number; avisoS: number }
  /** al bajar de este % de vida lanza un grito y gana velocidad */
  grito?: { vidaPct: number; velocidadPct: number; duracionS: number }
}

export interface EnemigoIA {
  x: number
  y: number
  casaX: number
  casaY: number
  estado: EstadoIA
  /** tiempo que queda del estado actual (ataque, aviso, aturdido, paseo) */
  t: number
  /** tiempo hasta el próximo ataque */
  cd: number
  cdPesado: number
  vida: number
  vidaMax: number
  velMult: number
  gritoHecho: boolean
  meta: { x: number; y: number } | null
}

export interface EntradaIA {
  dt: number
  heroeX: number
  heroeY: number
  heroeVivo: boolean
  modoPeque: boolean
  /** el jefe y otros que no se curan al volver ponen false */
  curaAlVolver?: boolean
}

export interface OrdenIA {
  /** dirección unitaria y velocidad en px/s */
  mover?: { dx: number; dy: number; vel: number }
  mirarA?: { x: number; y: number }
  atacar?: boolean
  /** empezó el aviso del golpe pesado: dura esto en segundos */
  avisoS?: number
  /** el aviso terminó: el golpe pesado cae ahora */
  golpePesado?: boolean
  gritar?: boolean
  curar?: boolean
}

export function nuevoEnemigoIA(x: number, y: number, vida: number): EnemigoIA {
  return { x, y, casaX: x, casaY: y, estado: 'quieto', t: 0, cd: 0.4, cdPesado: 3, vida, vidaMax: vida, velMult: 1, gritoHecho: false, meta: null }
}

/** El golpe lo frena un momento: no ataca ni camina */
export function aturdir(e: EnemigoIA, seg: number): void {
  if (e.estado === 'muerto') return
  // un aviso o un grito en marcha no se interrumpe con un golpe chico
  if (e.estado === 'aviso' || e.estado === 'grito') return
  e.estado = 'aturdido'
  e.t = seg
}

export function matar(e: EnemigoIA): void {
  e.estado = 'muerto'
  e.vida = 0
}

const norm = (dx: number, dy: number) => {
  const d = Math.hypot(dx, dy) || 1
  return { dx: dx / d, dy: dy / d }
}

/**
 * Un paso de la cabeza del enemigo. No toca Phaser: devuelve lo que quiere hacer y el juego lo ejecuta.
 * Estados: quieto y paseo (nadie cerca), perseguir, atacando, huir (arqueros), aviso (golpe pesado del trol),
 * grito, aturdido y volver (si la heroína lo aleja más de 320 px de su sitio, regresa y se cura).
 */
export function pensar(e: EnemigoIA, c: ConfigIA, en: EntradaIA, rng: Azar): OrdenIA {
  if (e.estado === 'muerto') return {}
  const orden: OrdenIA = {}
  const dt = en.dt
  e.cd = Math.max(0, e.cd - dt)
  e.cdPesado = Math.max(0, e.cdPesado - dt)
  const peque = en.modoPeque
  const vel = c.velocidad * e.velMult * (peque ? MODO_PEQUE.velocidadEnemigos : 1)
  const dx = en.heroeX - e.x
  const dy = en.heroeY - e.y
  const dH = Math.hypot(dx, dy)
  const dCasa = Math.hypot(e.x - e.casaX, e.y - e.casaY)
  const leash = c.volverSiLejos ?? ENEMIGO_COMUN.volverSiLejos

  // estados con reloj que no se pueden interrumpir
  if (e.estado === 'aturdido' || e.estado === 'atacando' || e.estado === 'grito') {
    e.t -= dt
    if (e.estado !== 'atacando') orden.mirarA = { x: en.heroeX, y: en.heroeY }
    if (e.t > 0) return orden
    e.estado = 'quieto'
    e.t = 0
  }
  if (e.estado === 'aviso') {
    e.t -= dt
    orden.mirarA = { x: en.heroeX, y: en.heroeY }
    if (e.t > 0) return orden
    orden.golpePesado = true
    e.estado = 'atacando'
    e.t = c.duracionAtaqueS * 0.4
    e.cd = 1 / c.ataquesPorSeg
    e.cdPesado = c.pesado?.cadaS ?? 6
    return orden
  }

  // el grito del trol al bajar de la mitad de vida
  if (c.grito && !e.gritoHecho && e.vida / e.vidaMax <= c.grito.vidaPct / 100 && e.vida > 0) {
    e.gritoHecho = true
    e.velMult *= 1 + c.grito.velocidadPct / 100
    e.estado = 'grito'
    e.t = c.grito.duracionS
    orden.gritar = true
    return orden
  }

  // volver a casa
  if (e.estado === 'volver' || dCasa > leash || !en.heroeVivo) {
    if (dCasa <= 6) {
      e.estado = 'quieto'
      e.t = 0
      if (en.curaAlVolver !== false && e.vida < e.vidaMax) {
        e.vida = e.vidaMax
        orden.curar = true
      }
      return orden
    }
    e.estado = 'volver'
    const n = norm(e.casaX - e.x, e.casaY - e.y)
    orden.mover = { ...n, vel: vel * 1.3 }
    return orden
  }

  const ve = dH <= c.ve
  if (ve) {
    // arqueros: se alejan si la heroína está muy cerca
    if (c.huyeSi && dH < c.huyeSi) {
      e.estado = 'huir'
      const n = norm(-dx, -dy)
      orden.mover = { ...n, vel }
      orden.mirarA = { x: en.heroeX, y: en.heroeY }
      return orden
    }
    // golpe pesado con aviso
    if (c.pesado && e.cdPesado <= 0 && dH <= c.pesado.radio + 22) {
      e.estado = 'aviso'
      e.t = c.pesado.avisoS * (peque ? MODO_PEQUE.avisos : 1)
      orden.avisoS = e.t
      orden.mirarA = { x: en.heroeX, y: en.heroeY }
      return orden
    }
    if (dH <= c.alcance) {
      orden.mirarA = { x: en.heroeX, y: en.heroeY }
      if (e.cd <= 0) {
        e.estado = 'atacando'
        e.t = c.duracionAtaqueS
        e.cd = 1 / c.ataquesPorSeg
        orden.atacar = true
      } else e.estado = 'quieto'
      return orden
    }
    // acercarse: los de a distancia se paran un poco antes de su alcance
    e.estado = 'perseguir'
    const n = norm(dx, dy)
    orden.mover = { ...n, vel }
    return orden
  }

  // nadie cerca: pasear por su sitio
  if (c.paseoRadio !== 0) {
    if (e.estado === 'paseo' && e.meta) {
      const d = Math.hypot(e.meta.x - e.x, e.meta.y - e.y)
      if (d < 4) {
        e.meta = null
        e.estado = 'quieto'
        const r = c.paseoCadaS ?? ENEMIGO_COMUN.paseoCadaS
        e.t = rng.rango(r[0], r[1])
      } else {
        const n = norm(e.meta.x - e.x, e.meta.y - e.y)
        orden.mover = { ...n, vel: vel * 0.5 }
        return orden
      }
    }
    e.estado = 'quieto'
    e.t -= dt
    if (e.t <= 0) {
      const r = c.paseoRadio ?? ENEMIGO_COMUN.paseoRadio
      const ang = rng.next() * Math.PI * 2
      const rad = rng.next() * r
      e.meta = { x: e.casaX + Math.cos(ang) * rad, y: e.casaY + Math.sin(ang) * rad }
      e.estado = 'paseo'
    }
  }
  return orden
}
