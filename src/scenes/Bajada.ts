import Phaser from 'phaser'
import { K } from '../kit/claves'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/** Lo que muestra la bajada: el nombre del mundo y si se baja o se sube */
export interface DatosBajada {
  nombre: string
  subir: boolean
}

/**
 * F8: el paso de un mundo a otro. Negro, el nombre del mundo grande que aparece y se apaga, y el sonido del portal.
 * Dura poco (menos de 2 s) y un toque lo salta. Después arranca el Mundo, que ya lee la partida en el mundo nuevo.
 */
export class Bajada extends Phaser.Scene {
  private titulo!: Phaser.GameObjects.BitmapText
  private sub!: Phaser.GameObjects.BitmapText
  private saliendo = false

  constructor() {
    super('Bajada')
  }

  create(d: DatosBajada): void {
    this.saliendo = false
    this.cameras.main.setBackgroundColor(0x05060c)
    this.sub = texto(this, 0, 0, d.subir ? 'Subiendo...' : 'Más abajo en el abismo...', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0x9ad8d0 }).setAlpha(0)
    this.titulo = texto(this, 0, 0, d.nombre, 'fuente_titulo', 2, { origen: [0.5, 0.5] }).setAlpha(0)
    const acomodar = () => {
      const w = this.scale.width
      const h = this.scale.height
      const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
      this.titulo.setScale(1)
      this.titulo.setScale(escalaQueEntra(this.titulo.displayWidth, w - 24, esc + 1))
      this.sub.setScale(esc).setPosition(Math.round(w / 2), Math.round(h / 2 - this.titulo.displayHeight / 2 - 14))
      this.titulo.setPosition(Math.round(w / 2), Math.round(h / 2 + 6))
    }
    alCambiarEscala(this, acomodar)
    acomodar()
    if (this.cache.audio.exists(K.aud('portal'))) this.sound.play(K.aud('portal'), { volume: 0.5, rate: d.subir ? 1.2 : 0.8 })
    this.tweens.add({ targets: this.sub, alpha: 1, duration: 300 })
    this.tweens.add({ targets: this.titulo, alpha: 1, duration: 500, delay: 200 })
    this.time.delayedCall(1700, () => this.seguir())
    this.input.once('pointerdown', () => this.seguir())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('bajada'))
    agregarGanchos({ bajada: () => ({ titulo: this.titulo.text, subir: d.subir }) })
  }

  private seguir(): void {
    if (this.saliendo) return
    this.saliendo = true
    this.cameras.main.fadeOut(300, 5, 6, 12)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Mundo'))
  }
}
