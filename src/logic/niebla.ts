/**
 * Niebla del minimapa (PLAN.md F9, 1): el mapa se va descubriendo al caminar. Una grilla gruesa (cada celda son
 * `CELDA_NIEBLA` cuadros del mundo) con un bit por celda, guardada en la partida como texto corto.
 */

/** cuántos cuadros del mundo mide cada celda de la niebla */
export const CELDA_NIEBLA = 2
/** radio de lo que se descubre alrededor de la heroína, en px */
export const RADIO_NIEBLA = 300

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function aTexto(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? B64[n & 63]! : '=')
  }
  return out
}

export function deTexto(s: string, largo: number): Uint8Array {
  const out = new Uint8Array(largo)
  let j = 0
  for (let i = 0; i + 3 < s.length + 1 && j < largo; i += 4) {
    const v = (k: number) => Math.max(0, B64.indexOf(s[i + k] ?? 'A'))
    const n = (v(0) << 18) | (v(1) << 12) | (v(2) << 6) | v(3)
    if (j < largo) out[j++] = (n >> 16) & 255
    if (j < largo && s[i + 2] !== '=') out[j++] = (n >> 8) & 255
    if (j < largo && s[i + 3] !== '=') out[j++] = n & 255
  }
  return out
}

export class Niebla {
  readonly w: number
  readonly h: number
  readonly lado: number
  private bits: Uint8Array
  private vistas = 0

  /** `ancho` y `alto` en cuadros del mapa, `cuadro` en px */
  constructor(ancho: number, alto: number, cuadro: number, guardada = '') {
    this.w = Math.ceil(ancho / CELDA_NIEBLA)
    this.h = Math.ceil(alto / CELDA_NIEBLA)
    this.lado = cuadro * CELDA_NIEBLA
    this.bits = guardada ? deTexto(guardada, Math.ceil((this.w * this.h) / 8)) : new Uint8Array(Math.ceil((this.w * this.h) / 8))
    for (let i = 0; i < this.w * this.h; i++) if (this.visto(i % this.w, Math.floor(i / this.w))) this.vistas++
  }

  visto(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return false
    const i = cy * this.w + cx
    return ((this.bits[i >> 3]! >> (i & 7)) & 1) === 1
  }

  /** ¿Ya vio el punto (x, y) del mundo? */
  vistoEn(x: number, y: number): boolean {
    return this.visto(Math.floor(x / this.lado), Math.floor(y / this.lado))
  }

  /** Descubre un círculo alrededor de (x, y). Devuelve cuántas celdas nuevas */
  revelar(x: number, y: number, radio = RADIO_NIEBLA): number {
    const r = Math.ceil(radio / this.lado)
    const cx = Math.floor(x / this.lado)
    const cy = Math.floor(y / this.lado)
    let nuevas = 0
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = cx + dx, ty = cy + dy
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue
        const mx = (tx + 0.5) * this.lado - x
        const my = (ty + 0.5) * this.lado - y
        if (mx * mx + my * my > radio * radio) continue
        const i = ty * this.w + tx
        if ((this.bits[i >> 3]! >> (i & 7)) & 1) continue
        this.bits[i >> 3]! |= 1 << (i & 7)
        nuevas++
      }
    }
    this.vistas += nuevas
    return nuevas
  }

  /** De 0 a 1, cuánto del mapa ya vio */
  get avance(): number {
    return this.vistas / (this.w * this.h)
  }

  get texto(): string {
    return aTexto(this.bits)
  }
}

/**
 * Dónde dibujar un punto del mundo dentro del minimapa: `ancho` x `alto` es el tamaño del minimapa, `vista` la parte
 * del mundo que muestra (centrada en la heroína en el chico, todo el mapa en el grande).
 */
export function aMinimapa(x: number, y: number, vista: { x: number; y: number; w: number; h: number }, ancho: number, alto: number): { x: number; y: number; dentro: boolean } {
  const px = ((x - vista.x) / vista.w) * ancho
  const py = ((y - vista.y) / vista.h) * alto
  return { x: Math.round(px), y: Math.round(py), dentro: px >= 0 && py >= 0 && px <= ancho && py <= alto }
}
