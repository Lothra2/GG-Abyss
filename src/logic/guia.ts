import { GUIA } from '../config/balance'
import type { Zona } from '../kit/mapa'
import { indiceDireccion } from './direccion'
import type { Punto } from './grilla'

export interface Destino {
  tipo: 'zona' | 'arena' | 'portal'
  nombre: string
  x: number
  y: number
}

export interface ContextoGuia {
  heroe: Punto
  nivel: number
  zonas: readonly Zona[]
  descubiertas: readonly string[]
  arena?: Punto | null
  jefeVencido: boolean
  portal?: Punto | null
}

const centro = (z: Zona): Punto => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 })
const dentro = (z: Zona, p: Punto) => p.x >= z.x && p.y >= z.y && p.x < z.x + z.w && p.y < z.y + z.h

/**
 * Adónde mandar a la heroína: después del jefe, al portal; con nivel para el jefe, a la arena; si no, a la zona
 * sin descubrir más cercana (nunca a una secreta, ni a la de la arena antes de tiempo). Sin Phaser.
 */
export function elegirDestino(c: ContextoGuia, cfg: typeof GUIA = GUIA): Destino | null {
  if (c.jefeVencido) return c.portal ? { tipo: 'portal', nombre: 'Portal', x: c.portal.x, y: c.portal.y } : null
  const listoJefe = c.nivel >= cfg.nivelParaJefe
  if (listoJefe && c.arena) return { tipo: 'arena', nombre: 'Arena', x: c.arena.x, y: c.arena.y }
  let mejor: Destino | null = null
  let mejorD = Infinity
  for (const z of c.zonas) {
    if (!z.descubrir || z.secreto || c.descubiertas.includes(z.nombre)) continue
    if (c.arena && dentro(z, c.arena)) continue
    const p = centro(z)
    const d = Math.hypot(p.x - c.heroe.x, p.y - c.heroe.y)
    if (d < mejorD) {
      mejorD = d
      mejor = { tipo: 'zona', nombre: z.nombre, x: p.x, y: p.y }
    }
  }
  // todo descubierto pero todavía sin nivel: igual la arena (es lo que queda)
  return mejor ?? (c.arena ? { tipo: 'arena', nombre: 'Arena', x: c.arena.x, y: c.arena.y } : null)
}

/** Cuenta el tiempo sin progreso. `progreso()` lo reinicia; `visible` dice si ya toca mostrar la flecha. */
export class RelojGuia {
  sinProgreso = 0
  constructor(private espera: number) {}
  fijarEspera(s: number): void {
    this.espera = s
  }
  tick(dt: number): void {
    this.sinProgreso += dt
  }
  progreso(): void {
    this.sinProgreso = 0
  }
  get visible(): boolean {
    return this.sinProgreso >= this.espera
  }
}

export interface Vista {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Dónde va la flecha: en el borde de la vista, sobre la línea del centro al destino. `pantalla` es la posición
 * en la vista (0..w, 0..h), `dir` el cuadro de la flecha. null si el destino ya se ve o está muy cerca.
 */
export function posicionFlecha(vista: Vista, heroe: Punto, destino: Punto, cfg: typeof GUIA = GUIA): { x: number; y: number; dir: number } | null {
  if (Math.hypot(destino.x - heroe.x, destino.y - heroe.y) < cfg.cerca) return null
  const enVista = destino.x >= vista.x && destino.x <= vista.x + vista.w && destino.y >= vista.y && destino.y <= vista.y + vista.h
  if (enVista) return null
  const cx = vista.w / 2
  const cy = vista.h / 2
  const dx = destino.x - (vista.x + cx)
  const dy = destino.y - (vista.y + cy)
  // el rectángulo donde puede ir la flecha (dejando lugar al HUD de abajo)
  const x0 = cfg.margen
  const x1 = vista.w - cfg.margen
  const y0 = cfg.margen
  const y1 = vista.h - cfg.margenAbajo
  const ts = [dx > 0 ? (x1 - cx) / dx : dx < 0 ? (x0 - cx) / dx : Infinity, dy > 0 ? (y1 - cy) / dy : dy < 0 ? (y0 - cy) / dy : Infinity]
  const t = Math.min(...ts)
  return { x: Math.round(cx + dx * t), y: Math.round(cy + dy * t), dir: indiceDireccion(dx, dy) }
}

export type ClaveObjetivo = 'explorar' | 'crecer' | 'jefe' | 'portal'

export interface Objetivo {
  clave: ClaveObjetivo
  /** el ícono de la interfaz (sin el prefijo ui_) */
  icono: string
  texto: string
}

/**
 * El objetivo de ahora, corto y con ícono para el chip del HUD. Sigue el mismo orden que la flecha: portal después
 * del jefe, el jefe con nivel suficiente, explorar mientras quedan zonas y crecer si ya está todo visto.
 */
export function objetivoActual(c: { nivel: number; jefeVencido: boolean; descubiertas: number; totalZonas: number }, cfg: typeof GUIA = GUIA): Objetivo {
  if (c.jefeVencido) return { clave: 'portal', icono: 'icono_jugar', texto: 'Entra al portal' }
  if (c.nivel >= cfg.nivelParaJefe) return { clave: 'jefe', icono: 'icono_calavera', texto: 'Vence al jefe' }
  if (c.descubiertas < c.totalZonas) return { clave: 'explorar', icono: 'icono_zona', texto: `Explora ${c.descubiertas}/${c.totalZonas}` }
  return { clave: 'crecer', icono: 'icono_calavera', texto: `Gana fuerza ${c.nivel}/${cfg.nivelParaJefe}` }
}
