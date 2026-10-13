import type { Azar } from './azar'
import { JEFE, JEFE_CAMPANA, JEFE_PEZ, JEFE_POLILLA, JEFE_REY, MODO_PEQUE } from '../config/balance'

/**
 * El Minotauro del Bosque (PLAN.md F4): máquina de estados con fases y temporizadores, sin Phaser.
 * Fase 1 de 100 % a 60 % de vida: golpe, golpe fuerte y carga. Fase 2 de 60 % a 0: suma pisotón, salto y grito.
 * Todo ataque grande avisa 1.2 s antes (1.8 s en modo peque) y la vida del jefe nunca sube.
 */

export type AtaqueJefe = 'golpe' | 'golpe_fuerte' | 'carga' | 'pisoton' | 'salto' | 'grito' | 'onda' | 'raices' | 'polvo' | 'mordida' | 'ola' | 'puno' | 'barrido' | 'cancion'
/** F8: qué jefe es (cambia qué ataques elige) */
export type PerfilJefe = 'minotauro' | 'campana' | 'polilla' | 'pez' | 'rey'
export type EstadoJefe = 'dormido' | 'intro' | 'quieto' | 'perseguir' | 'aviso' | 'saltando' | 'cargando' | 'aturdido' | 'muerto'
/** `frente` es una elipse delante del jefe, `circulo` es a su alrededor o en el destino del salto, `linea` es la carga */
export type FormaAtaque = 'frente' | 'circulo' | 'linea' | 'anillo' | 'raices'

export interface Jefe {
  x: number
  y: number
  /** centro de la arena */
  cx: number
  cy: number
  vida: number
  vidaMax: number
  /** el Pez Farol tiene una tercera (llama cangrejos y medusas) */
  fase: 1 | 2 | 3
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
  perfil: PerfilJefe
  /** F8: dónde salen las raíces de la llamada (se fijan al avisar) */
  puntos?: { x: number; y: number }[]
  /** F8: el próximo ataque que hace sí o sí (un patrón nuevo se enseña solo, la primera vez) */
  forzar: AtaqueJefe | null
  /** F8: ya enseñó la llamada de raíces */
  raicesVistas: boolean
  /** F11: la Polilla Reina no recibe daño mientras los cuatro cristales grandes no estén prendidos */
  escudo: boolean
  /** F11: cómo estaban los cristales el paso anterior (prender el cuarto la tumba) */
  vulnerablePrev: boolean
  /** F11: con los cuatro prendidos vuelve a caer aturdida cada tanto */
  aturdeEnS: number
  /** F12: el Pez Farol fuera del agua después de morder o de la ola: lo que le queda afuera (ahí se le pega) */
  fueraS: number
  /** F12: hasta que el farol alzado de Thor lo pueda volver a encandilar */
  alzarEnS: number
  /** F12: el Rey de Piedra, hasta que pueda volver a cantar la canción de cuna */
  cancionEnS: number
}

export interface EntradaJefe {
  dt: number
  heroeX: number
  heroeY: number
  heroeVivo: boolean
  modoPeque: boolean
  /** las ratas del grito que siguen vivas */
  ratasVivas: number
  /** F11: los cuatro cristales grandes de la arena están prendidos (la Polilla Reina se puede golpear) */
  vulnerable?: boolean
  /** F12: Thor tiene el farol alzado aquí (el Pez Farol sale encandilado si está cerca) */
  alzado?: { x: number; y: number }
}

export interface OrdenJefe {
  mover?: { dx: number; dy: number; vel: number }
  mirarA?: { x: number; y: number }
  /** empezó el aviso de un ataque grande: dibujarlo y que dure `seg` */
  aviso?: { ataque: AtaqueJefe; forma: FormaAtaque; seg: number; x: number; y: number; radio: number; dx: number; dy: number; largo: number; ancho: number; interior?: number; puntos?: { x: number; y: number }[] }
  /** el ataque cae ahora */
  golpe?: { ataque: AtaqueJefe; forma: FormaAtaque; dano: readonly [number, number]; x: number; y: number; radio: number; dx: number; dy: number; largo: number; ancho: number; interior?: number; puntos?: { x: number; y: number }[]; empuje?: number }
  /** F8: raíces que salen del piso un rato (tapan el paso donde cayeron) */
  raices?: { puntos: { x: number; y: number }[]; radio: number; seg: number }
  /** F11: el polvo de la reina cayó aquí: apaga los cristales que tapa */
  polvo?: { x: number; y: number; radio: number }
  /** F11: la reina perdió el escudo (true) o lo recuperó (false) */
  escudo?: boolean
  /** F12: el Pez Farol sale del agua (anim `emerger` o la del ataque) o se vuelve a hundir */
  emerger?: boolean
  hundirse?: boolean
  /** F12: el farol de Thor lo encandiló (sale aturdido) */
  encandilado?: boolean
  /** F12: cambió a la fase 3 */
  fase3?: boolean
  /** F12: el Rey cantó la canción de cuna: las lámparas del salón se apagan */
  cancion?: boolean
  /** F12: el golpe cayó al piso (el Rey suelta chispas de la corona aquí) */
  chispas?: { x: number; y: number; n: number }
  fase2?: boolean
  rugir?: boolean
  invocar?: number
  saltar?: { x: number; y: number; seg: number }
  cargar?: { dx: number; dy: number; vel: number }
  aturdido?: number
  /** empezó un golpe chico (sin aviso grande): animar el ataque */
  atacando?: AtaqueJefe
}

export function nuevoJefe(cx: number, cy: number, vida: number = JEFE.vida, perfil: PerfilJefe = 'minotauro'): Jefe {
  return {
    x: cx, y: cy, cx, cy, vida, vidaMax: vida, fase: 1, estado: 'dormido', t: 0, pausaS: 1, ataque: null,
    dirX: 0, dirY: 1, destX: cx, destY: cy, origX: cx, origY: cy, cargaPego: false, gritoEnS: 4,
    perfil, forzar: null, raicesVistas: false, escudo: perfil === 'polilla' || perfil === 'pez', vulnerablePrev: false, aturdeEnS: 0,
    fueraS: 0, alzarEnS: 0, cancionEnS: 0,
  }
}

/** F8: si un punto cae en el anillo de la onda (entre el borde de adentro y el de afuera) */
export function enAnillo(x: number, y: number, cx: number, cy: number, interior: number, exterior: number): boolean {
  const d = Math.hypot(x - cx, y - cy)
  return d > interior && d <= exterior
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
  // el Pez Farol vuelve al fondo del agua
  if (j.perfil === 'pez') {
    j.escudo = true
    j.fueraS = 0
    j.alzarEnS = 0
  }
}

/** F12: si un punto cae en la franja de la ola (de (x, y) en (dx, dy), `largo` de largo y `ancho` de ancho) */
export function enLinea(px: number, py: number, x: number, y: number, dx: number, dy: number, largo: number, ancho: number): boolean {
  return distanciaASegmento(px, py, x, y, x + dx * largo, y + dy * largo) <= ancho / 2
}

/** El golpe que recibe el jefe. La vida solo baja: no hay manera de curarlo. Devuelve si cambió de fase o murió. */
export function danarJefe(j: Jefe, dano: number): { fase2: boolean; murio: boolean; escudo?: boolean; fase3?: boolean } {
  if (j.estado === 'muerto' || dano <= 0) return { fase2: false, murio: false }
  // la Polilla Reina con los cristales apagados: el golpe no le llega
  if (j.escudo) return { fase2: false, murio: false, escudo: true }
  j.vida = Math.max(0, j.vida - dano)
  if (j.vida <= 0) {
    j.estado = 'muerto'
    j.ataque = null
    return { fase2: false, murio: true }
  }
  // el guardián de la campana enseña la llamada de raíces sola, la primera vez que llega a raicesPct
  if (j.perfil === 'campana' && !j.raicesVistas && j.fase === 2 && (j.vida / j.vidaMax) * 100 <= JEFE_CAMPANA.raicesPct) {
    j.raicesVistas = true
    j.forzar = 'raices'
  }
  // el Pez Farol: la tercera fase llama cangrejos y medusas (la primera llamada sale sola)
  if ((j.perfil === 'pez' || j.perfil === 'rey') && j.fase === 2 && (j.vida / j.vidaMax) * 100 <= (j.perfil === 'rey' ? JEFE_REY.fase3Pct : JEFE_PEZ.fase3Pct)) {
    j.fase = 3
    j.forzar = 'grito'
    if (j.estado !== 'dormido' && j.estado !== 'aturdido') {
      j.estado = 'intro'
      j.t = JEFE.fase2RugidoS
      j.ataque = null
      j.pausaS = 0.8
    }
    return { fase2: false, murio: false, fase3: true }
  }
  if (j.fase === 1 && (j.vida / j.vidaMax) * 100 <= JEFE.fase2Pct) {
    j.fase = 2
    // la onda se enseña sola, apenas empieza la fase 2 (y la ola del Pez Farol)
    if (j.perfil === 'campana') j.forzar = 'onda'
    if (j.perfil === 'pez') j.forzar = 'ola'
    // el Rey enseña la canción de cuna apenas empieza la fase 2 (las lámparas están prendidas: no cae de rodillas por eso)
    if (j.perfil === 'rey') {
      j.forzar = 'cancion'
      j.vulnerablePrev = true
      j.aturdeEnS = JEFE_REY.rodillasCadaS
    }
    // el rugido de la fase 2 corta lo que estuviera haciendo (al Pez Farol encandilado lo deja en el piso)
    if (j.estado !== 'dormido' && !(j.perfil === 'pez' && j.estado === 'aturdido')) {
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
  if (ataque === 'polvo') return JEFE_POLILLA.polvo.avisoS * (modoPeque ? MODO_PEQUE.avisos : 1)
  if (ataque === 'mordida') return JEFE_PEZ.mordida.avisoS * (modoPeque ? MODO_PEQUE.avisos : 1)
  if (ataque === 'ola') return JEFE_PEZ.ola.avisoS * (modoPeque ? MODO_PEQUE.avisos : 1)
  if (ataque === 'puno') return JEFE_REY.puno.avisoS * (modoPeque ? MODO_PEQUE.avisos : 1)
  if (ataque === 'barrido') return JEFE_REY.barrido.avisoS * (modoPeque ? MODO_PEQUE.avisos : 1)
  if (ataque === 'cancion') return JEFE_REY.cancion.avisoS * (modoPeque ? MODO_PEQUE.avisos : 1)
  const base = ataque === 'onda' ? JEFE_CAMPANA.onda.avisoS : ataque === 'raices' ? JEFE_CAMPANA.raices.avisoS : ataque === 'golpe_fuerte' ? JEFE.golpeFuerte.avisoS : ataque === 'carga' ? JEFE.carga.avisoS : ataque === 'pisoton' ? JEFE.pisoton.avisoS : ataque === 'salto' ? JEFE.salto.avisoS : ataque === 'grito' ? JEFE.grito.avisoS : 0
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
  if (j.forzar) {
    const a = j.forzar
    j.forzar = null
    return a
  }
  if (j.perfil === 'rey') {
    // el puño de cerca y el pisotón; desde la fase 2 la canción cuando las lámparas están prendidas; desde la 3 el
    // barrido y la llamada
    const r = JEFE_REY
    const pesos: [AtaqueJefe, number][] = [
      ['puno', dist <= r.puno.alcance ? 45 : 0],
      ['pisoton', dist <= r.pisoton.radio + 30 ? 28 : 0],
    ]
    if (j.fase >= 2) pesos.push(['cancion', e.vulnerable && j.cancionEnS <= 0 ? 30 : 0])
    if (j.fase >= 3) {
      pesos.push(['barrido', dist <= r.barrido.largo - 20 ? 30 : 0])
      pesos.push(['grito', j.gritoEnS <= 0 && e.ratasVivas < r.llamada.max ? 22 : 0])
    }
    if (pesos.every(([, p]) => p === 0)) return null
    return rng.pesos(pesos)
  }
  if (j.perfil === 'pez') {
    // la mordida de cerca; desde la fase 2 la ola (de cerca o de lejos); desde la 3, la llamada
    const pz = JEFE_PEZ
    const pesos: [AtaqueJefe, number][] = [['mordida', dist <= pz.mordida.alcance ? 50 : 0]]
    if (j.fase >= 2) pesos.push(['ola', dist <= pz.ola.largo - 40 ? 32 : 0])
    if (j.fase >= 3) pesos.push(['grito', j.gritoEnS <= 0 && e.ratasVivas < pz.llamada.max ? 24 : 0])
    if (pesos.every(([, p]) => p === 0)) return null
    return rng.pesos(pesos)
  }
  if (j.perfil === 'polilla') {
    // el aletazo de cerca, el polvo a cualquier distancia y, cada tanto, la llamada de polillas
    const ll = JEFE_POLILLA.llamada
    const pesos: [AtaqueJefe, number][] = [
      ['golpe', dist <= JEFE_POLILLA.aletazo.radio + 24 ? 45 : 0],
      ['polvo', 30],
      ['grito', j.gritoEnS <= 0 && e.ratasVivas < ll.maxPolillas ? 22 : 0],
    ]
    return rng.pesos(pesos)
  }
  if (j.perfil === 'campana') {
    // fase 1: solo el golpe y el golpe frontal; fase 2 suma la onda; desde raicesPct, las raíces
    const pesos: [AtaqueJefe, number][] = [
      ['golpe', cerca ? 45 : 0],
      ['golpe_fuerte', dist <= 130 ? 35 : 0],
    ]
    if (j.fase === 2) pesos.push(['onda', dist <= 240 ? 30 : 0])
    if (j.raicesVistas) pesos.push(['raices', 26])
    if (pesos.every(([, p]) => p === 0)) return null
    return rng.pesos(pesos)
  }
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
  const vel = (j.perfil === 'pez' ? JEFE_PEZ.velocidad : j.perfil === 'rey' ? JEFE_REY.velocidad : JEFE.velocidad) * (peque ? MODO_PEQUE.velocidadEnemigos : 1)
  j.cancionEnS = Math.max(0, j.cancionEnS - dt)
  const dir = norm(e.heroeX - j.x, e.heroeY - j.y)
  if (j.perfil === 'polilla' && escudoPolilla(j, e, o)) return o
  if (j.perfil === 'pez' && pasoPez(j, e, o)) return o
  if (j.perfil === 'rey' && j.fase >= 2 && escudoLuz(j, e, o, JEFE_REY.rodillasS, JEFE_REY.rodillasCadaS)) return o

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
        // el Pez Farol se despabila y vuelve al agua
        if (j.perfil === 'pez') hundirPez(j, o)
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
    if (dist > (j.perfil === 'pez' ? JEFE_PEZ.mordida.alcance - 24 : j.perfil === 'rey' ? JEFE_REY.puno.alcance - 30 : JEFE.golpe.radio + 16)) {
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

/** F12: el Pez Farol vuelve al fondo: no se le puede pegar hasta que vuelva a salir */
function hundirPez(j: Jefe, o: OrdenJefe): void {
  j.fueraS = 0
  if (j.escudo) return
  j.escudo = true
  o.escudo = true
  o.hundirse = true
  j.pausaS = Math.max(j.pausaS, JEFE_PEZ.emergerS)
}

/**
 * F12: lo propio del Pez Farol antes de pensar como los demás. El farol alzado de Thor lo encandila (sale aturdido) y,
 * después de morder o de la ola, se queda un rato afuera sin moverse: la ventana para pegarle. Devuelve true si este
 * paso ya quedó resuelto.
 */
function pasoPez(j: Jefe, e: EntradaJefe, o: OrdenJefe): boolean {
  const pz = JEFE_PEZ
  j.alzarEnS = Math.max(0, j.alzarEnS - e.dt)
  const a = e.alzado
  if (a && j.alzarEnS <= 0 && j.estado !== 'intro' && j.estado !== 'aturdido' && Math.hypot(a.x - j.x, a.y - j.y) <= pz.alzarRadio) {
    const seg = pz.aturdidoS * (e.modoPeque ? MODO_PEQUE.avisos : 1)
    j.estado = 'aturdido'
    j.t = seg
    j.ataque = null
    j.fueraS = 0
    j.pausaS = 0.8
    j.alzarEnS = seg + pz.alzarCadaS
    if (j.escudo) o.escudo = false
    j.escudo = false
    o.aturdido = seg
    o.encandilado = true
    return true
  }
  if (j.fueraS > 0 && (j.estado === 'quieto' || j.estado === 'perseguir')) {
    j.fueraS -= e.dt
    j.estado = 'quieto'
    o.mirarA = { x: e.heroeX, y: e.heroeY }
    if (j.fueraS <= 0) hundirPez(j, o)
    return true
  }
  return false
}

/**
 * F11: la Polilla Reina y sus cristales. Prender el cuarto grande la tumba (aturdida, en el piso) y le quita el escudo.
 * Mientras sigan los cuatro prendidos vuelve a caer cada tanto. Devuelve true si este paso cayó aturdida.
 */
function escudoPolilla(j: Jefe, e: EntradaJefe, o: OrdenJefe): boolean {
  return escudoLuz(j, e, o, JEFE_POLILLA.aturdidaS, JEFE_POLILLA.aturdidaCadaS)
}

/**
 * El escudo de luz (la Polilla Reina y el Rey de Piedra desde la fase 2): sin la luz no recibe daño. Cuando la luz se
 * completa cae aturdido y vuelve a caer cada tanto mientras siga. Devuelve true si este paso cayó.
 */
function escudoLuz(j: Jefe, e: EntradaJefe, o: OrdenJefe, aturdidoS: number, cadaS: number): boolean {
  const v = !!e.vulnerable
  if (j.escudo === v) o.escudo = !v
  j.escudo = !v
  if (!v) {
    j.vulnerablePrev = false
    return false
  }
  // durante el rugido o ya en el piso espera: la caída se cuenta cuando pueda caer
  if (j.estado === 'intro' || j.estado === 'aturdido') return false
  const nuevo = !j.vulnerablePrev
  j.vulnerablePrev = true
  j.aturdeEnS -= e.dt
  if (!nuevo && j.aturdeEnS > 0) return false
  const seg = aturdidoS * (e.modoPeque ? MODO_PEQUE.avisos : 1)
  j.estado = 'aturdido'
  j.t = seg
  j.ataque = null
  j.pausaS = 0.8
  j.aturdeEnS = cadaS
  o.aturdido = seg
  return true
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
  const seg = a === 'grito' && j.perfil === 'pez' ? JEFE_PEZ.llamada.avisoS * (e.modoPeque ? MODO_PEQUE.avisos : 1) : a === 'grito' && j.perfil === 'rey' ? JEFE_REY.llamada.avisoS * (e.modoPeque ? MODO_PEQUE.avisos : 1) : a === 'pisoton' && j.perfil === 'rey' ? JEFE_REY.pisoton.avisoS * (e.modoPeque ? MODO_PEQUE.avisos : 1) : avisoDe(a, e.modoPeque)
  j.t = seg
  const base = { ataque: a, seg }
  // el Pez Farol sale del agua para morder y para la ola (se le puede pegar desde que asoma)
  if (j.perfil === 'pez' && (a === 'mordida' || a === 'ola') && j.escudo) {
    j.escudo = false
    o.escudo = false
    o.emerger = true
  }
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
  } else if (a === 'puno') {
    // el puño cae delante de él, donde estaba la heroína: si camina, se salva
    const r = JEFE_REY.puno
    j.destX = j.x + dir.dx * Math.min(r.delante, Math.max(20, dir.d))
    j.destY = j.y + dir.dy * Math.min(r.delante, Math.max(20, dir.d))
    o.aviso = { ...base, forma: 'frente', x: j.destX, y: j.destY, radio: r.radio, dx: dir.dx, dy: dir.dy, largo: 0, ancho: 0 }
  } else if (a === 'barrido') {
    const b = JEFE_REY.barrido
    o.aviso = { ...base, forma: 'linea', x: j.x, y: j.y, radio: 0, dx: dir.dx, dy: dir.dy, largo: b.largo, ancho: b.ancho }
  } else if (a === 'cancion') {
    // canta: un aviso sin daño (las lámparas se apagan al terminar)
    o.aviso = { ...base, forma: 'circulo', x: j.x, y: j.y, radio: 0, dx: 0, dy: 1, largo: 0, ancho: 0 }
    o.rugir = true
  } else if (a === 'mordida') {
    // la boca abierta en el piso, delante de él: si camina, se salva
    const m = JEFE_PEZ.mordida
    j.destX = j.x + dir.dx * m.delante
    j.destY = j.y + dir.dy * m.delante
    o.aviso = { ...base, forma: 'frente', x: j.destX, y: j.destY, radio: m.radio, dx: dir.dx, dy: dir.dy, largo: 0, ancho: 0 }
  } else if (a === 'ola') {
    // la franja por donde pasa la ola, hasta el borde de la arena
    const ol = JEFE_PEZ.ola
    const largo = Math.min(ol.largo, distanciaAlBorde(j, j.x, j.y, dir.dx, dir.dy) + JEFE.margenBorde)
    o.aviso = { ...base, forma: 'linea', x: j.x, y: j.y, radio: 0, dx: dir.dx, dy: dir.dy, largo, ancho: ol.ancho }
  } else if (a === 'polvo') {
    // la mancha queda donde estaba la heroína al empezar: si camina, se salva
    j.destX = e.heroeX
    j.destY = e.heroeY
    o.aviso = { ...base, forma: 'circulo', x: j.destX, y: j.destY, radio: JEFE_POLILLA.polvo.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
  } else if (a === 'onda') {
    // la campana va a sonar: un anillo alrededor del jefe. Adentro (cerca de la campana) no llega
    const on = JEFE_CAMPANA.onda
    o.aviso = { ...base, forma: 'anillo', x: j.x, y: j.y, radio: on.exterior, interior: on.interior, dx: 0, dy: 1, largo: 0, ancho: 0 }
  } else if (a === 'raices') {
    // tres manchas donde van a salir raíces: donde está la heroína y a los dos costados (si camina, se salva)
    const r = JEFE_CAMPANA.raices
    const px = -dir.dy
    const py = dir.dx
    const tope = JEFE.arenaRadio - JEFE.margenBorde
    j.puntos = [0, -1, 1].map((k) => {
      let x = e.heroeX + px * r.separacion * k
      let y = e.heroeY + py * r.separacion * k
      const d = Math.hypot(x - j.cx, y - j.cy)
      if (d > tope) {
        x = j.cx + ((x - j.cx) / d) * tope
        y = j.cy + ((y - j.cy) / d) * tope
      }
      return { x, y }
    })
    o.aviso = { ...base, forma: 'raices', x: e.heroeX, y: e.heroeY, radio: r.radio, dx: 0, dy: 1, largo: 0, ancho: 0, puntos: j.puntos }
  }
  return o
}

function resolverAtaque(j: Jefe, o: OrdenJefe, a: AtaqueJefe, ratasVivas: number, rng: Azar): OrdenJefe {
  const pausa = () => rng.rango(JEFE.pausaEntreAtaquesS[0], JEFE.pausaEntreAtaquesS[1])
  j.ataque = null
  switch (a) {
    case 'golpe': {
      const g = j.perfil === 'polilla' ? JEFE_POLILLA.aletazo : JEFE.golpe
      o.golpe = { ataque: 'golpe', forma: 'frente', dano: g.dano, x: j.x + j.dirX * 30, y: j.y + j.dirY * 30, radio: g.radio, dx: j.dirX, dy: j.dirY, largo: 0, ancho: 0 }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    }
    case 'puno': {
      const r = JEFE_REY.puno
      o.golpe = { ataque: 'puno', forma: 'frente', dano: r.dano, x: j.destX, y: j.destY, radio: r.radio, dx: j.dirX, dy: j.dirY, largo: 0, ancho: 0 }
      if (j.fase >= 2) o.chispas = { x: j.destX, y: j.destY, n: JEFE_REY.chispasPorGolpe }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    }
    case 'barrido': {
      const b = JEFE_REY.barrido
      o.golpe = { ataque: 'barrido', forma: 'linea', dano: b.dano, x: j.x, y: j.y, radio: 0, dx: j.dirX, dy: j.dirY, largo: b.largo, ancho: b.ancho }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    }
    case 'cancion': {
      // terminó la canción: las lámparas se apagan (lo hace el juego) y su piedra vuelve a no sentir los golpes
      o.cancion = true
      j.cancionEnS = JEFE_REY.cancion.cadaS
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    }
    case 'mordida': {
      const m = JEFE_PEZ.mordida
      o.golpe = { ataque: 'mordida', forma: 'frente', dano: m.dano, x: j.destX, y: j.destY, radio: m.radio, dx: j.dirX, dy: j.dirY, largo: 0, ancho: 0 }
      j.estado = 'quieto'
      j.pausaS = pausa()
      j.fueraS = m.fueraS
      break
    }
    case 'ola': {
      const ol = JEFE_PEZ.ola
      const largo = Math.min(ol.largo, distanciaAlBorde(j, j.x, j.y, j.dirX, j.dirY) + JEFE.margenBorde)
      o.golpe = { ataque: 'ola', forma: 'linea', dano: ol.dano, x: j.x, y: j.y, radio: 0, dx: j.dirX, dy: j.dirY, largo, ancho: ol.ancho, empuje: ol.empuje }
      j.estado = 'quieto'
      j.pausaS = pausa()
      j.fueraS = ol.fueraS
      break
    }
    case 'polvo': {
      const pv = JEFE_POLILLA.polvo
      o.golpe = { ataque: 'polvo', forma: 'circulo', dano: pv.dano, x: j.destX, y: j.destY, radio: pv.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
      o.polvo = { x: j.destX, y: j.destY, radio: pv.radio }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    }
    case 'golpe_fuerte':
      o.golpe = { ataque: 'golpe_fuerte', forma: 'frente', dano: JEFE.golpeFuerte.dano, x: j.x + j.dirX * JEFE.golpeFuerte.delante, y: j.y + j.dirY * JEFE.golpeFuerte.delante, radio: JEFE.golpeFuerte.radio, dx: j.dirX, dy: j.dirY, largo: 0, ancho: 0 }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    case 'pisoton':
      o.golpe = { ataque: 'pisoton', forma: 'circulo', dano: j.perfil === 'rey' ? JEFE_REY.pisoton.dano : JEFE.pisoton.dano, x: j.x, y: j.y, radio: j.perfil === 'rey' ? JEFE_REY.pisoton.radio : JEFE.pisoton.radio, dx: 0, dy: 1, largo: 0, ancho: 0 }
      if (j.perfil === 'rey' && j.fase >= 2) o.chispas = { x: j.x, y: j.y, n: JEFE_REY.chispasPorGolpe }
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
    case 'grito': {
      // el minotauro llama ratas; la Polilla Reina, polillas de ceniza
      const pz = JEFE_PEZ.llamada
      const ry = JEFE_REY.llamada
      const ll = j.perfil === 'polilla' ? { n: JEFE_POLILLA.llamada.polillas, max: JEFE_POLILLA.llamada.maxPolillas, cada: JEFE_POLILLA.llamada.cadaS } : j.perfil === 'pez' ? { n: pz.cangrejos + pz.medusas, max: pz.max, cada: pz.cadaS } : j.perfil === 'rey' ? { n: ry.sonambulos, max: ry.max, cada: ry.cadaS } : { n: JEFE.grito.ratas, max: JEFE.grito.maxRatas, cada: JEFE.grito.cadaS }
      j.estado = 'quieto'
      j.gritoEnS = ll.cada
      j.pausaS = pausa()
      o.invocar = Math.max(0, Math.min(ll.n, ll.max - ratasVivas))
      break
    }
    case 'onda': {
      // suena la campana: el anillo pega y el guardián queda aturdido (la ventana para pegarle)
      const on = JEFE_CAMPANA.onda
      o.golpe = { ataque: 'onda', forma: 'anillo', dano: on.dano, x: j.x, y: j.y, radio: on.exterior, interior: on.interior, dx: 0, dy: 1, largo: 0, ancho: 0 }
      j.estado = 'aturdido'
      j.t = on.aturdidoS
      j.pausaS = 0.8
      o.aturdido = on.aturdidoS
      break
    }
    case 'raices': {
      const r = JEFE_CAMPANA.raices
      const puntos = j.puntos ?? []
      o.golpe = { ataque: 'raices', forma: 'raices', dano: r.dano, x: j.x, y: j.y, radio: r.radio, dx: 0, dy: 1, largo: 0, ancho: 0, puntos }
      o.raices = { puntos, radio: r.radio, seg: r.duranS }
      j.estado = 'quieto'
      j.pausaS = pausa()
      break
    }
  }
  return o
}
