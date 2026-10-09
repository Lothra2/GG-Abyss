import Phaser from 'phaser'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'

/**
 * `niebla_jirones.png` repite bien hacia arriba y abajo pero NO hacia los lados: su borde izquierdo y su borde derecho
 * no coinciden y se ve una costura cada 512 px (anotado en ASSETS_PENDIENTES.md para el taller).
 * Mientras tanto se usa la misma textura del kit con una copia espejada al lado: en el espejo los bordes sí empatan.
 */
function espejoHorizontal(escena: Phaser.Scene, key: string): string {
  const nuevo = `${key}_espejo`
  if (escena.textures.exists(nuevo)) return nuevo
  const orig = escena.textures.get(key).getSourceImage() as HTMLImageElement
  const w = orig.width
  const h = orig.height
  const tex = escena.textures.createCanvas(nuevo, w * 2, h)
  if (!tex) return key
  const ctx = tex.getContext()
  ctx.drawImage(orig, 0, 0)
  ctx.save()
  ctx.translate(w * 2, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(orig, 0, 0)
  ctx.restore()
  tex.refresh()
  return nuevo
}

/**
 * Bruma en dos capas que corren con el viento (PLAN.md 2.5). Van pegadas a la pantalla, con parallax,
 * antes de la oscuridad para que las luces la iluminen.
 */
export class Bruma {
  private jirones: Phaser.GameObjects.TileSprite
  private nubes: Phaser.GameObjects.TileSprite

  constructor(escena: Phaser.Scene, ancho: number, alto: number) {
    const mk = (key: string, prof: number) => escena.add.tileSprite(0, 0, ancho, alto, key).setOrigin(0, 0).setScrollFactor(0).setTileScale(2, 2).setDepth(prof)
    this.jirones = mk(espejoHorizontal(escena, K.nieblaJirones), PROF.BRUMA_A)
    this.nubes = mk(K.nieblaNubes, PROF.BRUMA_B)
  }

  redimensionar(ancho: number, alto: number): void {
    this.jirones.setSize(ancho, alto)
    this.nubes.setSize(ancho, alto)
  }

  /** `niebla` ya viene multiplicada por el control de bruma */
  update(t: number, cx: number, cy: number, niebla: number, capas: number): void {
    const a = Phaser.Math.Clamp(niebla, 0, 1.5)
    // la textura se dibuja a escala 2: la posición va en pixeles de textura
    this.jirones.setTilePosition((cx * 1 + t * 12) / 2, (cy * 1 + t * 1.5) / 2)
    this.nubes.setTilePosition((cx * 1.15 + t * 7) / 2, (cy * 1.15 + t * -2) / 2)
    this.jirones.setAlpha(Math.min(1, a * 0.85)).setVisible(a * 0.85 > 0.01)
    const conNubes = capas >= 2 && a * 0.55 > 0.01
    this.nubes.setAlpha(Math.min(1, a * 0.55)).setVisible(conNubes)
  }

  get capasVisibles(): number {
    return (this.jirones.visible ? 1 : 0) + (this.nubes.visible ? 1 : 0)
  }

  destruir(): void {
    this.jirones.destroy()
    this.nubes.destroy()
  }
}
