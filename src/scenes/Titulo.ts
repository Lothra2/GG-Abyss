import Phaser from 'phaser'
import { alCambiarEscala } from '../game/Pantalla'
import { texto } from '../game/Texto'

/** F0: título mínimo. En F1b se reemplaza por la entrada al abismo con luz, música y "Toca para empezar". */
export class Titulo extends Phaser.Scene {
  constructor() {
    super('Titulo')
  }

  create(): void {
    const t = texto(this, 0, 0, 'GG Abyss', 'fuente_titulo', 3, { origen: [0.5, 0.5] })
    const s = texto(this, 0, 0, 'Toca para empezar', 'fuente_ui', 2, { origen: [0.5, 0.5], tinte: 0xffd27a })
    this.tweens.add({ targets: s, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 })
    alCambiarEscala(this, () => {
      t.setPosition(this.scale.width / 2, this.scale.height / 2 - 20)
      s.setPosition(this.scale.width / 2, this.scale.height / 2 + 26)
    })
  }
}
