import Phaser from 'phaser'
import { PREMIUM_FX, PROF } from '../config/juego'
import { rayosEn, type Rayos as RayosZona } from '../logic/grado'

/**
 * F14: rayos de luz que bajan en diagonal, anclados al mundo (logic/grado.ts rayosEn), con motas de polvo que flotan
 * adentro. Son texturas técnicas (un degradado de luz y una mota), no arte. Van entre la niebla y la oscuridad: en los
 * pisos oscuros la oscuridad los apaga sola y no confunden las mecánicas de luz.
 */
const KEY_HAZ = 'rayo_tecnico'
const KEY_MOTA = 'mota_tecnica'
const TOPE = 10
/** anchos de haz que se hornean (pixeles del arte) */
const ANCHOS = [14, 24, 38]
/** el ángulo se hornea de 5 en 5 grados */
const PASO_ANG = 5

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/**
 * Un haz ya inclinado y tramado, sin rotar en el juego: así cada pixel del rayo cae en la grilla del arte (pixel
 * perfecto) y la luz se ve en escalones con trama, como en los juegos retro. Es un degradado de luz técnico.
 */
function texHaz(escena: Phaser.Scene, angulo: number, ancho: number, largo: number): string {
  const ang = Math.round(angulo / PASO_ANG) * PASO_ANG
  const key = `${KEY_HAZ}_${ang}_${ancho}_${largo}`
  if (escena.textures.exists(key)) return key
  const tg = Math.tan((ang * Math.PI) / 180)
  const corre = Math.round(Math.abs(tg) * largo)
  const W = ancho * 2 + corre
  const t = escena.textures.createCanvas(key, W, largo)
  if (!t) return key
  const ctx = t.getContext()
  const img = ctx.createImageData(W, largo)
  const niveles = 6
  for (let y = 0; y < largo; y++) {
    const v = y / largo
    // fuerte arriba, se apaga hacia abajo, y entra suave en el borde de arriba
    const caida = Math.pow(1 - v, 1.25) * Math.min(1, v / 0.06)
    const centro = ancho + (tg >= 0 ? y * tg : corre + y * tg)
    for (let x = 0; x < W; x++) {
      const u = Math.abs(x + 0.5 - centro) / (ancho / 2)
      if (u >= 1.6) continue
      // un núcleo parejo con borde suave
      const perfil = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 1.05) ** 1.6
      const a = perfil * caida
      // escalones con trama ordenada: luz retro
      const q = a * niveles + BAYER[(y & 3) * 4 + (x & 3)]! / 16 - 0.5
      const nivel = Math.max(0, Math.min(niveles, Math.round(q))) / niveles
      if (nivel <= 0) continue
      const i = (y * W + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(nivel * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  t.refresh()
  return key
}

function texMota(escena: Phaser.Scene): void {
  if (escena.textures.exists(KEY_MOTA)) return
  const t = escena.textures.createCanvas(KEY_MOTA, 3, 3)
  if (!t) return
  const ctx = t.getContext()
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(0, 0, 3, 3)
  ctx.fillStyle = 'rgba(255,255,255,1)'
  ctx.fillRect(1, 0, 1, 3)
  ctx.fillRect(0, 1, 3, 1)
  t.refresh()
}

interface Haz {
  haz: Phaser.GameObjects.Image
  motas: Phaser.GameObjects.Image[]
}

export class Rayos {
  private pool: Haz[] = []
  /** cuántos rayos se ven en este cuadro (para las pruebas) */
  visibles = 0

  constructor(private escena: Phaser.Scene) {
    texMota(escena)
  }

  private haz(i: number): Haz {
    while (this.pool.length <= i) {
      const haz = this.escena.add.image(0, 0, texHaz(this.escena, 0, ANCHOS[0]!, PREMIUM_FX.largoRayos)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(PROF.RAYOS).setVisible(false)
      const motas = Array.from({ length: PREMIUM_FX.motasPorRayo }, () => this.escena.add.image(0, 0, KEY_MOTA).setBlendMode(Phaser.BlendModes.ADD).setDepth(PROF.RAYOS + 1).setVisible(false))
      this.pool.push({ haz, motas })
    }
    return this.pool[i]!
  }

  update(t: number, vista: Phaser.Geom.Rectangle, r: RayosZona, oscuridad: number, encendidos: boolean): void {
    const largo = PREMIUM_FX.largoRayos
    const angB = Math.round(r.angulo / PASO_ANG) * PASO_ANG
    const tg = Math.tan((angB * Math.PI) / 180)
    const corre = tg * largo
    // los rayos nacen arriba de la vista y bajan: se buscan en una franja más alta y se quedan los que la cruzan,
    // los más cercanos al centro primero (la mitad de arriba del haz es la que más brilla)
    const cx = vista.centerX, cy = vista.centerY
    const lista = encendidos && r.densidad > 0.02
      ? rayosEn({ x: vista.x - corre * 0.5, y: vista.y - largo * 0.55, w: vista.width, h: vista.height * 0.8 + largo * 0.3 }, PREMIUM_FX.celdaRayos, r.densidad)
          .map((ry) => ({ ry, d: Math.hypot(ry.x + corre * 0.3 - cx, ry.y + largo * 0.3 - cy) }))
          .filter(({ ry }) => ry.y < vista.bottom && ry.y + largo * 0.7 > vista.y && Math.min(ry.x, ry.x + corre) < vista.right + 40 && Math.max(ry.x, ry.x + corre) > vista.x - 40)
          .sort((p, q) => p.d - q.d)
          .slice(0, TOPE)
          .map(({ ry }) => ry)
      : []
    const color = Phaser.Display.Color.GetColor(Math.round(r.color[0]), Math.round(r.color[1]), Math.round(r.color[2]))
    // en lo oscuro los rayos se ven menos, pero no desaparecen (luz que entra por una grieta)
    const fuerza = PREMIUM_FX.alfaRayos * (0.55 + 0.45 * r.densidad) * (1 - Math.min(0.7, oscuridad * 0.6))
    lista.forEach((ry, i) => {
      const h = this.haz(i)
      const pulso = 0.7 + 0.3 * Math.sin(t * 0.35 + ry.fase)
      const ancho = ANCHOS[Math.min(ANCHOS.length - 1, Math.floor((ry.ancho - 0.6) / 0.3))]!
      const key = texHaz(this.escena, angB, ancho, largo)
      if (h.haz.texture.key !== key) h.haz.setTexture(key)
      // la textura empieza `ancho` antes del centro del haz (y, si baja a la izquierda, también lo que corre)
      const x0 = ry.x - ancho - (tg < 0 ? Math.round(-tg * largo) : 0)
      h.haz.setVisible(true).setPosition(Math.round(x0), Math.round(ry.y)).setTint(color).setAlpha(fuerza * pulso)
      h.motas.forEach((m, k) => {
        const u = (ry.fase / (Math.PI * 2) + t * 0.025 + k / h.motas.length) % 1
        const lado = Math.sin(t * 0.6 + ry.fase + k * 1.7) * ancho * 0.35
        const x = ry.x + tg * u * largo * 0.8 + lado
        const y = ry.y + u * largo * 0.8
        const brillo = Math.sin(u * Math.PI) * (0.55 + 0.45 * Math.sin(t * 2.1 + k * 2.3 + ry.fase))
        m.setVisible(true).setPosition(Math.round(x), Math.round(y)).setTint(color).setAlpha(Math.max(0, brillo) * fuerza * 2.4)
      })
    })
    for (let i = lista.length; i < this.pool.length; i++) {
      const h = this.pool[i]!
      if (!h.haz.visible) continue
      h.haz.setVisible(false)
      for (const m of h.motas) m.setVisible(false)
    }
    this.visibles = lista.length
  }

  destruir(): void {
    for (const h of this.pool) {
      h.haz.destroy()
      for (const m of h.motas) m.destroy()
    }
    this.pool = []
  }
}
