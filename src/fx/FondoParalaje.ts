import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { PARALAJE_FONDO } from '../logic/capas'

/**
 * El abismo que se ve donde la Catedral no tiene piso (PLAN.md F10, encargo 2.6): las capas `fondo` del taller
 * repetidas detrás de todo, cada una más lenta que el mundo. Si el kit no las trae no se arma nada y queda el
 * color de fondo de siempre.
 */
export class FondoParalaje {
  private capas: { t: Phaser.GameObjects.TileSprite; k: number }[] = []

  constructor(escena: Phaser.Scene, m: Manifest, nombres: string[]) {
    nombres.forEach((n, i) => {
      const def = m.mundo.objetos[n]
      const an = def && (def.anims.idle ? 'idle' : Object.keys(def.anims)[0])
      if (!def || !an || !escena.textures.exists(K.obj(n, an))) return
      const k = PARALAJE_FONDO[Math.min(i, PARALAJE_FONDO.length - 1)]!
      const t = escena.add.tileSprite(0, 0, 16, 16, K.obj(n, an)).setOrigin(0, 0).setScrollFactor(0).setDepth(PROF.FONDO + i)
      this.capas.push({ t, k })
    })
  }

  get cantidad(): number {
    return this.capas.length
  }

  /** Lo que se ve del mundo y dónde va para cubrir la pantalla con el zoom de la cámara (igual que la oscuridad) */
  redimensionar(ancho: number, alto: number, ox: number, oy: number): void {
    for (const c of this.capas) c.t.setSize(Math.ceil(ancho), Math.ceil(alto)).setPosition(ox, oy)
  }

  update(vista: Phaser.Geom.Rectangle): void {
    for (const c of this.capas) c.t.setTilePosition(Math.round(vista.x * c.k), Math.round(vista.y * c.k))
  }

  destruir(): void {
    for (const c of this.capas) c.t.destroy()
    this.capas = []
  }
}
