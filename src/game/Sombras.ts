import Phaser from 'phaser'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'

/**
 * Sombra elíptica bajo un personaje (PLAN.md 2.5): la textura `luz` del kit teñida de negro
 * y aplastada. No se dibuja nada: es la misma textura de las luces.
 */
export class Sombra {
  readonly img: Phaser.GameObjects.Image

  constructor(escena: Phaser.Scene, readonly ancho: number, alfa = 0.35) {
    const s = ancho / 96
    this.img = escena.add.image(0, 0, K.luz).setTint(0x000000).setAlpha(alfa).setDepth(PROF.SOMBRAS).setScale(s, s * 0.42)
  }

  poner(x: number, y: number): void {
    this.img.setPosition(Math.round(x), Math.round(y) - 1)
  }

  setVisible(v: boolean): void {
    this.img.setVisible(v)
  }

  destroy(): void {
    this.img.destroy()
  }
}
