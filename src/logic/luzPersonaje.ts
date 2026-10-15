import { hexARgb, type RGB } from './zonas'

/**
 * F14: la luz pinta a los personajes. Cerca de una fogata la heroína se pone tibia, cerca de un cristal azul se pone
 * fría. Es un tinte suave (multiplica, nunca oscurece de más) que sale de las luces que la rodean, más fuerte cuanto
 * más oscuro está el piso. Su propio farol no cuenta: ese ya es la luz de siempre.
 */
export interface FuenteLuz {
  x: number
  y: number
  r: number
  color: string
  heroina?: boolean
}

export interface ConfigLuzPersonaje {
  /** cuánto tinte como mucho (0 a 1) */
  tope: number
  /** cuánto pesa una luz que está encima */
  fuerza: number
  /** a pleno día el tinte se queda en esta parte */
  diaMin: number
}

const BLANCO: RGB = [255, 255, 255]

/** El tinte que le toca a un personaje parado en `x, y` */
export function tinteDeLuces(x: number, y: number, luces: readonly FuenteLuz[], oscuridad: number, cfg: ConfigLuzPersonaje): RGB {
  let peso = 0
  const suma: [number, number, number] = [0, 0, 0]
  for (const l of luces) {
    if (l.heroina || l.r <= 0) continue
    const d = Math.hypot(l.x - x, l.y - y)
    if (d >= l.r) continue
    const w = (1 - d / l.r) ** 2
    const c = colorDe(l.color)
    if (!c) continue
    suma[0] += c[0] * w
    suma[1] += c[1] * w
    suma[2] += c[2] * w
    peso += w
  }
  if (peso <= 0) return BLANCO
  // el color promedio, llevado a su brillo máximo: la luz tiñe, no apaga
  const prom: RGB = [suma[0] / peso, suma[1] / peso, suma[2] / peso]
  const max = Math.max(1, prom[0], prom[1], prom[2])
  const puro: RGB = [(prom[0] / max) * 255, (prom[1] / max) * 255, (prom[2] / max) * 255]
  const osc = Math.min(1, Math.max(0, oscuridad))
  const k = Math.min(cfg.tope, peso * cfg.fuerza * (cfg.diaMin + (1 - cfg.diaMin) * osc))
  return [Math.round(255 + (puro[0] - 255) * k), Math.round(255 + (puro[1] - 255) * k), Math.round(255 + (puro[2] - 255) * k)]
}

/** Mezcla suave hacia el tinte nuevo (así no salta al pasar junto a una antorcha) */
export function acercarTinte(a: RGB, b: RGB, k: number): RGB {
  const t = Math.min(1, Math.max(0, k))
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Dos tintes juntos (el del golpe o el enojo encima del de la luz) */
export function multiplicarTinte(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255
  const bl = ((a & 255) * (b & 255)) / 255
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

export function aEntero(c: RGB): number {
  return (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])
}

const cache = new Map<string, RGB | null>()
function colorDe(hex: string): RGB | null {
  let c = cache.get(hex)
  if (c === undefined) {
    c = /^#?[0-9a-f]{6}$/i.test(hex) ? hexARgb(hex) : null
    cache.set(hex, c)
  }
  return c
}
