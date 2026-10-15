import type { RGB } from './zonas'
import { hexARgb } from './zonas'

/**
 * El look premium de cada zona (PLAN.md F14): la gradación de color del cuadro, los rayos de luz y el color de la
 * niebla. Cada mundo trae su valor de base (config/juego.ts PREMIUM) y el taller puede afinarlo por zona en el mapa
 * con las propiedades `grado` ("#sombras,#luces,contraste,saturacion") y `rayos` ("angulo,#color,densidad").
 */
export interface Grado {
  /** el color hacia el que van los negros (sombras con color, no grises) */
  sombras: RGB
  /** el color que toman las luces altas */
  luces: RGB
  contraste: number
  saturacion: number
}

export interface Rayos {
  /** grados desde la vertical (negativo: la luz baja hacia la izquierda) */
  angulo: number
  color: RGB
  /** 0 sin rayos, 1 muchos y bien visibles */
  densidad: number
}

export interface Premium {
  grado: Grado
  rayos: Rayos
  /** el tinte de la niebla */
  niebla: RGB
  /** cuánto brilla lo que ya brilla (fuego, cristales, faroles), 0 a 1 */
  brillo: number
}

const HEX = /^#?[0-9a-f]{6}$/i
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** "#sombras,#luces,contraste,saturacion". Lo que no se entienda queda como null (se usa el del mundo) */
export function leerGrado(texto: unknown): Grado | null {
  if (typeof texto !== 'string') return null
  const p = texto.split(',').map((s) => s.trim())
  if (p.length !== 4 || !HEX.test(p[0]!) || !HEX.test(p[1]!)) return null
  const c = Number(p[2]), s = Number(p[3])
  if (!Number.isFinite(c) || !Number.isFinite(s)) return null
  return { sombras: hexARgb(p[0]!), luces: hexARgb(p[1]!), contraste: limitar(c, 0.6, 1.6), saturacion: limitar(s, 0.4, 1.6) }
}

/** "angulo,#color,densidad" */
export function leerRayos(texto: unknown): Rayos | null {
  if (typeof texto !== 'string') return null
  const p = texto.split(',').map((s) => s.trim())
  if (p.length !== 3 || !HEX.test(p[1]!)) return null
  const a = Number(p[0]), d = Number(p[2])
  if (!Number.isFinite(a) || !Number.isFinite(d)) return null
  return { angulo: limitar(a, -60, 60), color: hexARgb(p[1]!), densidad: limitar(d, 0, 1) }
}

/** Lo que pide una zona: sus propiedades encima de la base de su mundo */
export function premiumDe(props: Readonly<Record<string, unknown>> | null | undefined, base: Premium): Premium {
  const g = leerGrado(props?.grado)
  const r = leerRayos(props?.rayos)
  return { grado: g ?? base.grado, rayos: r ?? base.rayos, niebla: base.niebla, brillo: base.brillo }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerp3 = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]

/** Mezcla suave hacia el look de la zona nueva (`k` entre 0 y 1) */
export function mezclarPremium(a: Premium, b: Premium, k: number): Premium {
  const t = limitar(k, 0, 1)
  return {
    grado: { sombras: lerp3(a.grado.sombras, b.grado.sombras, t), luces: lerp3(a.grado.luces, b.grado.luces, t), contraste: lerp(a.grado.contraste, b.grado.contraste, t), saturacion: lerp(a.grado.saturacion, b.grado.saturacion, t) },
    // el ángulo y el color de los rayos se mezclan, y la densidad baja antes de subir: los rayos de una zona no giran de golpe
    rayos: { angulo: lerp(a.rayos.angulo, b.rayos.angulo, t), color: lerp3(a.rayos.color, b.rayos.color, t), densidad: lerp(a.rayos.densidad, b.rayos.densidad, t) },
    niebla: lerp3(a.niebla, b.niebla, t),
    brillo: lerp(a.brillo, b.brillo, t),
  }
}

/** Rayos de luz anclados al mundo: una grilla de celdas y, en cada una, un rayo o ninguno (siempre el mismo) */
export interface Rayo {
  /** dónde nace (arriba) en pixeles del mundo */
  x: number
  y: number
  /** ancho del haz y fase de su pulso */
  ancho: number
  fase: number
}

const hash = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Los rayos que caen en la vista `[x, y, w, h]` (con margen). `celda` es el lado de la grilla y `densidad` la parte de
 * celdas que tienen rayo. Es determinista: el mismo lugar del mundo siempre tiene el mismo rayo.
 */
export function rayosEn(vista: { x: number; y: number; w: number; h: number }, celda: number, densidad: number): Rayo[] {
  if (densidad <= 0) return []
  const out: Rayo[] = []
  const x0 = Math.floor((vista.x - celda) / celda), x1 = Math.ceil((vista.x + vista.w + celda) / celda)
  const y0 = Math.floor((vista.y - celda) / celda), y1 = Math.ceil((vista.y + vista.h) / celda)
  const parte = Math.min(0.85, densidad * 0.7)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (hash(cx, cy) >= parte) continue
      out.push({ x: cx * celda + hash(cx + 7, cy) * celda, y: cy * celda + hash(cx, cy + 11) * celda * 0.5, ancho: 0.6 + hash(cx + 3, cy + 5) * 0.9, fase: hash(cx + 13, cy + 17) * Math.PI * 2 })
    }
  }
  return out
}
