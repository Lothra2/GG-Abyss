import type { Azar } from './azar'
import { JEFE, MODO_PEQUE } from '../config/balance'

/**
 * El Minotauro del Bosque (PLAN.md F4): máquina de estados con fases y temporizadores, sin Phaser.
 * Fase 1 de 100 % a 60 % de vida: golpe, golpe fuerte y carga. Fase 2 de 60 % a 0: suma pisotón, salto y grito.
 * Todo ataque grande avisa 1.2 s antes (1.8 s en modo peque) y la vida del jefe nunca sube.
 */

export type AtaqueJefe = 'golpe' | 'golpe_fuerte' | 'carga' | 'pisoton' | 'salto' | 'grito'
export type EstadoJefe = 'dormido' | 'intro' | 'quieto' | 'perseguir' | 'aviso' | 'saltando' | 'cargando' | 'aturdido' | 'muerto'
/** `frente` es una elipse delante del jefe, `circulo` es a su alrededor o en el destino del salto, `linea` es la carga */
export type FormaAtaque = 'frente' | 'circulo' | 'linea'

export interface Jefe {
  x: number
  y: number
  /** centro de la arena */
  cx: number
  cy: number
  vida: number
  vidaMax: number
  fase: 1 | 2
  estado: EstadoJefe
  /** lo que queda del estado actual */
  t: number
  /** espera hasta el próximo ataque */
  pausaS: number
  ataque: AtaqueJefe | null
  /** dirección con la que se lanzó el ataque (frente y carga) */
  dirX: number
  dirY: number
  /** destino del salto */
  destX: number
  destY: number
  /** salto: de dónde salió */
  origX: number
  origY: number
  /** si la carga ya le pegó a la heroína en este tramo */
  cargaPego: boolean
  /** hasta que pueda volver a gritar */
  gritoEnS: number
}

export interface EntradaJefe {
  dt: number
  heroeX: number
  heroeY: number
  heroeVivo: boolean
  modoPeque: boolean
  /** las ratas del grito que siguen vivas */
  ratasVivas: number
}

export interface OrdenJefe {
  mover?: { dx: number; dy: number; vel: number }
  mirarA?: { x: number; y: number }
  /** empezó el aviso de un ataque grande: dibujarlo y que dure `seg` */
  aviso?: { ataque: AtaqueJefe; forma: FormaAtaque; seg: number; x: number; y: number; radio: number; dx: number; dy: number; largo: number; ancho: number }
  /** el ataque cae ahora */
  golpe?: { ataque: AtaqueJefe; forma: FormaAtaque; dano: readonly [number, number]; x: number; y: number; radio: number; dx: number; dy: number; largo: number; ancho: number }
  fase2?: boolean
  rugir?: boolean
  invocar?: number
  saltar?: { x: number; y: number; seg: number }
  cargar?: { dx: number; dy: number; vel: number }
  aturdido?: number
  /** empezó un golpe chico (sin aviso grande): animar el ataque */
  atacando?: AtaqueJefe
}

export function nuevoJefe(cx: number, cy: number, vida: number = JEFE.vida): Jefe {
  return {
    x: cx, y: cy, cx, cy, vida, vidaMax: vida, fase: 1, estado: 'dormido', t: 0, pausaS: 1, ataque: null,
    dirX: 0, dirY: 1, destX: cx, destY: cy, origX: cx, origY: cy, cargaPego: false, gritoEnS: 4,
  }
}

const norm = (dx: number, dy: number) => {
  const d = Math.hypot(dx, dy) || 1
  return { dx: dx / d, dy: dy / d, d }
}

/** La heroína entró a la arena: el jefe ruge y empieza la pelea */
export function despertar(j: Jefe): boolean {
  if (j.estado !== 'dormido') return false
  j.estado = 'intro'
  j.t = JEFE.introS
  return true
}

/**
 * La heroína cayó y Thor la rescató: el jefe vuelve al centro de la arena y se duerme, con la vida que tenía.
 * No se cura (PLAN.md F4): cuando ella vuelva a entrar, sigue donde quedó.
 */
export function reposar(j: Jefe): void {
  if (j.estado === 'muerto') return
  j.estado = 'dormido'
  j.ataque = null
  j.t = 0
  j.pausaS = 1
  j.x = j.cx
  j.y = j.cy
  j.gritoEnS = 4
  j.cargaPego = false
}

/** El golpe que recibe el jefe. La vida solo baja: no hay manera de curarlo. Devuelve si cambió de fase o murió. */
export function danarJefe(j: Jefe, dano: number): { fase2: boolean; murio: boolean } {
  if (j.estado === 'muerto' || dano <= 0) return { fase2: false, murio: false }
  j.vida = Math.max(0, j.vida - dano)
  if (j.vida <= 0) {
    j.estado = 'muerto'
    j.ataque = null
    return { fase2: false, murio: true }
  }
  if (j.fase === 1 && (j.vida / j.vidaMax) * 100 <= JEFE.fase2Pct) {
    j.fase = 2
    // el rugido de la fase 2 corta lo que estuviera haciendo
    if (j.estado !== 'dormido') {
      j.estado = 'intro'
      j.t = JEFE.fase2RugidoS
      j.ataque = null
      j.pausaS = 0.8
    }
    return { fase2: true, murio: false }
  }
  return { fase2: false, murio: false }
}

/** Segundos de aviso de un ataque grande: 1.2 s, o 1.8 s en modo peque */
export function avisoDe(ataque: AtaqueJefe, modoPeque: boolean): number {
  const base = ataque === 'golpe_fuerte' ? JEFE.golpeFuerte.avisoS : ataque === 'carga' ? JEFE.carga.avisoS : ataque === 'pisoton' ? JEFE.pisoton.avisoS : ataque === 'salto' ? JEFE.salto.avisoS : ataque === 'grito' ? JEFE.grito.avisoS : 0
  return base * (modoPeque ? MODO_PEQUE.avisos : 1)
}

/** Distancia desde (x, y) yendo en (dx, dy) hasta el borde del círculo de la arena (menos el margen) */
export function distanciaAlBorde(j: Pick<Jefe, 'cx' | 'cy'>, x: number, y: number, dx: number, dy: number, radio: number = JEFE.arenaRadio - JEFE.margenBorde): number {
  const fx = x - j.cx
  const fy = y - j.cy
  const b = fx * dx + fy * dy
  const c = fx * fx + fy * fy - radio * radio
  const disc = b * b - c
  if (disc < 0) return 0
  return Math.max(0, -b + Math.sqrt(disc))
}

/** Distancia de un punto a un segmento (para saber si la carga pasó por la heroína) */
export function distanciaASegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const l2 = vx * vx + vy * vy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2))
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
}

function elegir(j: Jefe, e: EntradaJefe, rng: Azar, dist: number): AtaqueJefe | null {
  const cerca = dist <= JEFE.golpe.radio + 28
  const pesos: [AtaqueJefe, number][] = [
    ['golpe', cerca ? 45 : 0],
    ['golpe_fuerte', dist <= 120 ? 30 : 0],
    ['carga', dist >= 100 ? 30 : 0],
  ]
  if (j.fase === 2) {
    pesos.push(['pisoton', dist <= 140 ? 28 : 0])
    pesos.push(['salto', dist >= 110 ? 28 : 0])
    pesos.push(['grito', j.gritoEnS <= 0 && e.ratasVivas < JEFE.grito.maxRatas ? 22 : 0])
  }
  if (pesos.every(([, p]) => p === 0)) return null
  return rng.pesos(pesos)
}

/** Un paso del jefe. Devuelve lo que quiere hacer: el juego lo ejecuta y lo dibuja. */
export function pensarJefe(j: Jefe, e: EntradaJefe, rng: Azar): OrdenJefe {
  const o: OrdenJefe = {}
  if (j.estado === 'muerto' || j.estado === 'dormido') return o
  const dt = e.dt
  j.pausaS = Math.max(0, j.pausaS - dt)
  j.gritoEnS = Math.max(0, j.gritoEnS - dt)
  const peque = e.modoPeque
  const vel = JEFE.velocidad * (peque ? MODO_PEQUE.velocidadEnemigos : 1)
  const dir = norm(e.heroeX - j.x, e.heroeY - j.y)

  // la heroína cayó: el jefe se queda donde está, sin curarse, esperando
  if (!e.heroeVivo && j.estado !== 'intro' && j.estado !== 'aturdido') {
    j.estado = 'quieto'
    j.ataque = null
    j.pausaS = Math.max(j.pausaS, 1.5)
    return o
  }

  switch (j.estado) {
    case 'intro': {
      j.t -= dt
      o.mirarA = { x: e.heroeX, y: e.heroeY }
      if (j.t <= 0) {
        j.estado = 'quieto'
        j.pausaS = 1
      }
      return o
    }
    case 'aturdido': {
      j.t -= dt
      if (j.t <= 0) {
        j.estado = 'quieto'
        j.pausaS = 0.6
      }
      return o
    }
    case 'aviso': {
      j.t -= dt
      const a = j.ataque!
      // el golpe fuerte sigue a la heroína con la mirada hasta el último instante; la carga y el salto ya fijaron su destino
      if (a === 'golpe_fuerte' && j.t > 0.25) {
        j.dirX = dir.dx
        j.dirY = dir.dy
      }
      o.mirarA = { x: j.x + j.dirX * 50, y: j.y + j.dirY * 50 }
      if (j.t > 0) return o
      return resolverAtaque(j, o, a, e.ratasVivas, rng)
    }
    case 'saltando': {
      j.t -= dt
      const k = 1 - Math.max(0, j.t) / JEFE.salto.duracionS
      j.x = j.origX + (j.destX - j.origX) * k
      j.y = j.origY + (j.destY - j.origY) * k
      if (j.t > 0) return o
      j.x = j.destX
      j.y = j.destY
      j.estado = 'quieto'
      j.pausaS = rng.rango(JEFE.pausaEntreAtaquesS[0], JEFE.pausaEntreAtaquesS[1])
      o.golpe = { ataque: 'salto', forma: 'circulo', dano: JEFE.salto.dano, x: j.x, y: j.y, radio: JEFE.salto.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
      j.ataque = null
      return o
    }
    case 'cargando': {
      const paso = JEFE.carga.velocidad * dt
      const resta = distanciaAlBorde(j, j.x, j.y, j.dirX, j.dirY)
      const real = Math.min(paso, resta)
      const x0 = j.x
      const y0 = j.y
      j.x += j.dirX * real
      j.y += j.dirY * real
      // le pega una sola vez, si la heroína está en el camino
      if (!j.cargaPego && distanciaASegmento(e.heroeX, e.heroeY, x0, y0, j.x, j.y) <= JEFE.carga.ancho / 2 + 10) {
        j.cargaPego = true
        o.golpe = { ataque: 'carga', forma: 'linea', dano: JEFE.carga.dano, x: j.x, y: j.y, radio: 0, dx: j.dirX, dy: j.dirY, largo: 0, ancho: JEFE.carga.ancho }
      }
      if (real >= resta - 0.001) {
        // choca con el borde y queda aturdido
        j.estado = 'aturdido'
        j.t = JEFE.carga.aturdidoS
        j.ataque = null
        j.pausaS = 0.6
        o.aturdido = JEFE.carga.aturdidoS
      }
      return o
    }
    default:
      break
  }

  // quieto o persiguiendo
  const dist = dir.d
  o.mirarA = { x: e.heroeX, y: e.heroeY }
  if (j.pausaS > 0) {
    if (dist > JEFE.golpe.radio + 16) {
      j.estado = 'perseguir'
      o.mover = { dx: dir.dx, dy: dir.dy, vel }
    } else j.estado = 'quieto'
    return o
  }
  const a = elegir(j, e, rng, dist)
  if (!a) {
    // nada le sirve a esta distancia: se acerca
    j.estado = 'perseguir'
    o.mover = { dx: dir.dx, dy: dir.dy, vel }
    return o
  }
  return empezarAtaque(j, o, a, e, dir)
}

function empezarAtaque(j: Jefe, o: OrdenJefe, a: AtaqueJefe, e: EntradaJefe, dir: { dx: number; dy: number; d: number }): OrdenJefe {
  j.ataque = a
  j.estado = 'aviso'
  j.dirX = dir.dx
  j.dirY = dir.dy
  j.cargaPego = false
  if (a === 'golpe') {
    // el golpe normal es chico: una ventana corta, sin aviso en el piso
    j.t = JEFE.golpeVentanaS
    o.atacando = 'golpe'
    return o
  }
  const seg = avisoDe(a, e.modoPeque)
  j.t = seg
  const base = { ataque: a, seg }
  if (a === 'golpe_fuerte') {
    o.aviso = { ...base, forma: 'frente', x: j.x + dir.dx * JEFE.golpeFuerte.delante, y: j.y + dir.dy * JEFE.golpeFuerte.delante, radio: JEFE.golpeFuerte.radio, dx: dir.dx, dy: dir.dy, largo: 0, ancho: 0 }
  } else if (a === 'pisoton') {
    o.aviso = { ...base, forma: 'circulo', x: j.x, y: j.y, radio: JEFE.pisoton.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
  } else if (a === 'salto') {
    // el aviso queda donde estaba la heroína al empezar: si camina, se salva
    j.destX = e.heroeX
    j.destY = e.heroeY
    j.origX = j.x
    j.origY = j.y
    // el destino cae dentro de la arena
    const d = Math.hypot(j.destX - j.cx, j.destY - j.cy)
    const tope = JEFE.arenaRadio - JEFE.margenBorde
    if (d > tope) {
      j.destX = j.cx + ((j.destX - j.cx) / d) * tope
      j.destY = j.cy + ((j.destY - j.cy) / d) * tope
    }
    o.aviso = { ...base, forma: 'circulo', x: j.destX, y: j.destY, radio: JEFE.salto.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
  } else if (a === 'carga') {
    const largo = distanciaAlBorde(j, j.x, j.y, dir.dx, dir.dy)
    o.aviso = { ...base, forma: 'linea', x: j.x, y: j.y, radio: 0, dx: dir.dx, dy: dir.dy, largo, ancho: JEFE.carga.ancho }
  } else if (a === 'grito') {
    o.aviso = { ...base, forma: 'circulo', x: j.x, y: j.y, radio: 0, dx: 0, dy: 1, largo: 0, ancho: 0 }
    o.rugir = true
  }
  return o
}

function resolverAtaque(j: Jefe, o: OrdenJefe, a: AtaqueJefe, ratasVivas: number, rng: Azar): OrdenJefe {
  const pausa = () => rng.rango(JEFE.pausaEntreAtaquesS[0], JEFE.pausaEntreAtaquesS[1])
  j.ataque = null
  switch (a) {
    case 'golpe':
      o.golpe = { ataque: 'golpe', forma: 'frente', dano: JEFE.golpe.dano, x: j.x + j.dirX * 30, y: j.y + j.dirY * 30, radio: JEFE.golpe.radio, dx: j.dirX, dy: j.dirY, largo: 0, ancho: 0 }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    case 'golpe_fuerte':
      o.golpe = { ataque: 'golpe_fuerte', forma: 'frente', dano: JEFE.golpeFuerte.dano, x: j.x + j.dirX * JEFE.golpeFuerte.delante, y: j.y + j.dirY * JEFE.golpeFuerte.delante, radio: JEFE.golpeFuerte.radio, dx: j.dirX, dy: j.dirY, largo: 0, ancho: 0 }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    case 'pisoton':
      o.golpe = { ataque: 'pisoton', forma: 'circulo', dano: JEFE.pisoton.dano, x: j.x, y: j.y, radio: JEFE.pisoton.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    case 'salto':
      j.estado = 'saltando'
      j.t = JEFE.salto.duracionS
      j.ataque = 'salto'
      o.saltar = { x: j.destX, y: j.destY, seg: JEFE.salto.duracionS }
      break
    case 'carga':
      j.estado = 'cargando'
      j.ataque = 'carga'
      o.cargar = { dx: j.dirX, dy: j.dirY, vel: JEFE.carga.velocidad }
      break
    case 'grito':
      j.estado = 'quieto'
      j.gritoEnS = JEFE.grito.cadaS
      j.pausaS = pausa()
      o.invocar = Math.max(0, Math.min(JEFE.grito.ratas, JEFE.grito.maxRatas - ratasVivas))
      break
  }
  return o
}
