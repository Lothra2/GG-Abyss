import Phaser from 'phaser'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { hash2 } from '../logic/azar'

/** Sombras de nubes cruzando el mapa, despacio (PLAN.md 2.5): 6 copias de `nube.png` a escala 2 */
export class Nubes {
  private imgs: Phaser.GameObjects.Image[] = []

  constructor(
    escena: Phaser.Scene,
    private anchoMundo: number,
    private altoMundo: number,
  ) {
    for (let i = 0; i < 6; i++) this.imgs.push(escena.add.image(0, 0, K.nube).setOrigin(0, 0).setScale(2).setAlpha(0.8).setDepth(PROF.NUBES))
  }

  update(t: number, vista: Phaser.Geom.Rectangle, activas: boolean): void {
    this.imgs.forEach((img, i) => {
      const x = ((hash2(i, 1) * this.anchoMundo + t * (7 + i)) % (this.anchoMundo + 400)) - 200
      const y = hash2(i, 2) * this.altoMundo
      const ancho = img.width * 2
      const alto = img.height * 2
      const visible = activas && x + ancho > vista.x && x < vista.right && y + alto > vista.y && y < vista.bottom
      img.setVisible(visible)
      if (visible) img.setPosition(Math.round(x), Math.round(y))
    })
  }

  destruir(): void {
    for (const i of this.imgs) i.destroy()
  }
}
