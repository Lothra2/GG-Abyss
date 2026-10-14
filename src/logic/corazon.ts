import { CORAZON } from '../config/balance'
import type { Azar } from './azar'

/**
 * Reglas del Mundo 7, El Corazón Helado (PLAN.md F13), sin Phaser. Oscuridad casi total y frío. El fuego y las luces
 * compañeras calientan, la ventisca empuja y achica la luz (detrás de una columna no llega), el hielo fino se rompe si
 * te quedas parada y las sombras devoradoras se comen tus luces compañeras.
 */

/* ---------- el frío ---------- */

export interface Frio {
  valor: number
  congelada: boolean
  tickS: number
}

export function frioNuevo(): Frio {
  return { valor: 0, congelada: false, tickS: CORAZON.frio.danoCadaS }
}

export interface Clima {
  /** al lado de una hoguera o un brasero prendido */
  fuego?: boolean
  /** dentro de la luz de sus compañeras */
  companeras?: boolean
  /** en la ventisca y sin refugio */
  ventisca?: boolean
  /** hundida en el agua helada */
  aguaHelada?: boolean
}

/** Cuánto enfría por segundo (a oscuras siempre un poco). Al lado del fuego nada */
export function enfriaPorS(c: Clima, peque: boolean): number {
  if (c.fuego) return 0
  const k = CORAZON.frio
  const s = (c.companeras ? 0 : k.oscuro) + (c.ventisca ? k.ventisca : 0) + (c.aguaHelada ? k.aguaHelada : 0)
  return s * (peque ? k.pequeMult : 1)
}

/** Cuánto calienta por segundo: el fuego más que nada, después las compañeras (si no hay ventisca encima) */
export function calientaPorS(c: Clima): number {
  const k = CORAZON.frio
  if (c.fuego) return k.fuego
  if (c.companeras && !c.ventisca && !c.aguaHelada) return k.companeras
  return 0
}

/** Un paso del frío. Congelada pierde vida cada tanto (en modo peque menos) hasta bajar de `sueltaEn` */
export function pasoFrio(f: Frio, dt: number, c: Clima, peque: boolean): { dano: number; cambio?: 'congelada' | 'tibia' } {
  const k = CORAZON.frio
  f.valor = Math.max(0, Math.min(k.max, f.valor + (enfriaPorS(c, peque) - calientaPorS(c)) * dt))
  let cambio: 'congelada' | 'tibia' | undefined
  if (!f.congelada && f.valor >= k.max) {
    f.congelada = true
    f.tickS = k.danoCadaS
    cambio = 'congelada'
  } else if (f.congelada && f.valor < k.sueltaEn) {
    f.congelada = false
    cambio = 'tibia'
  }
  let dano = 0
  if (f.congelada) {
    f.tickS -= dt
    if (f.tickS <= 0) {
      dano = peque ? k.pequeDano : k.dano
      f.tickS += k.danoCadaS
    }
  }
  return cambio ? { dano, cambio } : { dano }
}

export function velocidadFrio(f: Frio): number {
  return f.congelada ? CORAZON.frio.velocidad : 1
}

/* ---------- la ventisca ---------- */

export type FaseVentisca = 'calma' | 'aviso' | 'sopla'

export interface Ventisca {
  fase: FaseVentisca
  t: number
  /** hacia dónde sopla (normalizado) */
  dx: number
  dy: number
}

export function ventiscaNueva(rng: Azar): Ventisca {
  return { fase: 'calma', t: esperaVentisca(rng), dx: 1, dy: 0 }
}

export function esperaVentisca(rng: Azar): number {
  const [a, z] = CORAZON.ventisca.cadaS
  return rng.rango(a, z)
}

/** Un paso de la ventisca: calma, aviso (el aullido) y sopla. Devuelve la fase nueva si cambió */
export function pasoVentisca(v: Ventisca, dt: number, rng: Azar, peque: boolean): FaseVentisca | null {
  v.t -= dt
  if (v.t > 0) return null
  const k = CORAZON.ventisca
  if (v.fase === 'calma') {
    v.fase = 'aviso'
    v.t = k.avisoS * (peque ? 1.5 : 1)
    const a = rng.next() * Math.PI * 2
    v.dx = Math.cos(a)
    v.dy = Math.sin(a)
    return 'aviso'
  }
  if (v.fase === 'aviso') {
    v.fase = 'sopla'
    v.t = k.duraS
    return 'sopla'
  }
  v.fase = 'calma'
  v.t = esperaVentisca(rng)
  return 'calma'
}

/**
 * ¿Está a sotavento de este refugio (una columna o un gigante)? Es la sombra contra el viento: detrás del refugio, del
 * lado hacia donde sopla, hasta `largo` y dentro de `ancho`.
 */
export function aSotavento(px: number, py: number, r: { x: number; y: number }, dx: number, dy: number): boolean {
  const k = CORAZON.ventisca
  const vx = px - r.x
  const vy = py - r.y
  const delante = vx * dx + vy * dy
  if (delante < -8 || delante > k.refugioLargo) return false
  const lado = Math.abs(vx * -dy + vy * dx)
  return lado <= k.refugioAncho / 2
}

/** ¿La ventisca le llega aquí? (soplando y sin ningún refugio) */
export function laAlcanza(v: Ventisca, px: number, py: number, refugios: readonly { x: number; y: number }[]): boolean {
  return v.fase === 'sopla' && !refugios.some((r) => aSotavento(px, py, r, v.dx, v.dy))
}

/* ---------- el hielo fino ---------- */

export type EstadoHielo = 'firme' | 'cruje' | 'roto'

export interface Hielo {
  parada: number
  estado: EstadoHielo
  /** roto: lo que le falta para volver a congelarse */
  rehaceS: number
}

export function hieloNuevo(): Hielo {
  return { parada: 0, estado: 'firme', rehaceS: 0 }
}

/**
 * Un paso de un parche de hielo fino. Si la heroína está encima y quieta, cruje y después se rompe. Si se mueve o se va,
 * deja de crujir. Roto, se vuelve a congelar solo. Devuelve el estado nuevo si cambió.
 */
export function pasoHielo(h: Hielo, dt: number, encimaQuieta: boolean, encima: boolean, peque: boolean): EstadoHielo | null {
  const k = CORAZON.hielo
  if (h.estado === 'roto') {
    h.rehaceS -= dt
    if (h.rehaceS > 0) return null
    h.estado = 'firme'
    h.parada = 0
    return 'firme'
  }
  if (encimaQuieta) h.parada += dt
  else h.parada = Math.max(0, h.parada - dt * (encima ? 0.5 : 2))
  const m = peque ? k.pequeMult : 1
  const antes = h.estado
  if (h.parada >= k.rompeS * m) {
    h.estado = 'roto'
    h.rehaceS = k.rehaceS
  } else h.estado = h.parada >= k.crujeS * m ? 'cruje' : 'firme'
  return h.estado !== antes ? h.estado : null
}

/* ---------- las luces compañeras ---------- */

/** Cuántas luces compañeras la siguen según las jaulas que liberó en la Fragua (una por cada quinto, hasta cinco) */
export function companerasDe(libres: number, total: number): number {
  if (total <= 0 || libres <= 0) return 0
  return Math.min(CORAZON.companeras.max, Math.floor((CORAZON.companeras.max * libres) / total))
}

export interface Companeras {
  max: number
  /** las devoradas: lo que le falta a cada una para volver */
  devoradas: number[]
}

export function companerasNuevas(max: number): Companeras {
  return { max, devoradas: [] }
}

export function companerasVivas(c: Companeras): number {
  return c.max - c.devoradas.length
}

/** Una sombra devoradora se traga una. Devuelve si había alguna */
export function devorar(c: Companeras): boolean {
  if (companerasVivas(c) <= 0) return false
  c.devoradas.push(CORAZON.companeras.vuelveS)
  return true
}

/** Las devoradas vuelven solas con el tiempo. Devuelve cuántas volvieron en este paso */
export function pasoCompaneras(c: Companeras, dt: number): number {
  const antes = c.devoradas.length
  c.devoradas = c.devoradas.map((s) => s - dt).filter((s) => s > 0)
  return antes - c.devoradas.length
}

/** En la hoguera vuelven todas */
export function recuperarTodas(c: Companeras): number {
  const n = c.devoradas.length
  c.devoradas = []
  return n
}

/** El radio de su luz: crece con cuántas la acompañan */
export function radioCompaneras(vivas: number): number {
  return vivas <= 0 ? 0 : Math.round(CORAZON.companeras.radio * (0.6 + 0.1 * vivas))
}
