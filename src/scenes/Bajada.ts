import Phaser from 'phaser'
import { K } from '../kit/claves'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import { columnaAbismo } from '../logic/abismo'
import { ABISMO } from '../config/balance'

/** Lo que muestra la bajada: el nombre del mundo y si se baja o se sube */
export interface DatosBajada {
  nombre: string
  subir: boolean
  /** F11: el piso al que llega (1 a 7), para la columna del abismo */
  piso?: number
}

/**
 * F8: el paso de un mundo a otro. Negro, el nombre del mundo grande que aparece y se apaga, y el sonido del portal.
 * Dura poco (unos 2 s) y un toque lo salta. Después arranca el Mundo, que ya lee la partida en el mundo nuevo.
 * F11: al costado, la columna de los siete pisos con el actual brillando y, al fondo, dos ojos rojos que miran.
 */
export class Bajada extends Phaser.Scene {
  private titulo!: Phaser.GameObjects.BitmapText
  private sub!: Phaser.GameObjects.BitmapText
  private saliendo = false
  private columna: Phaser.GameObjects.Container | null = null

  constructor() {
    super('Bajada')
  }

  create(d: DatosBajada): void {
    this.saliendo = false
    this.cameras.main.setBackgroundColor(0x05060c)
    this.sub = texto(this, 0, 0, d.subir ? 'Subiendo...' : 'Más abajo en el abismo...', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0x9ad8d0 }).setAlpha(0)
    this.titulo = texto(this, 0, 0, d.nombre, 'fuente_titulo', 2, { origen: [0.5, 0.5] }).setAlpha(0)
    const piso = d.piso ?? 0
    const lugar = piso ? texto(this, 0, 0, `Piso ${piso} de ${ABISMO.pisos.length}`, 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xd8b070 }).setAlpha(0) : null
    const acomodar = () => {
      const w = this.scale.width
      const h = this.scale.height
      const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
      this.titulo.setScale(1)
      this.titulo.setScale(escalaQueEntra(this.titulo.displayWidth, w - 24, esc + 1))
      this.sub.setScale(esc).setPosition(Math.round(w / 2), Math.round(h / 2 - this.titulo.displayHeight / 2 - 14))
      this.titulo.setPosition(Math.round(w / 2), Math.round(h / 2 + 6))
      lugar?.setScale(esc).setPosition(Math.round(w / 2), Math.round(h / 2 + this.titulo.displayHeight / 2 + 18))
      if (piso) this.armarColumna(piso, w, h, esc)
    }
    alCambiarEscala(this, acomodar)
    acomodar()
    if (this.cache.audio.exists(K.aud('portal'))) this.sound.play(K.aud('portal'), { volume: 0.5, rate: d.subir ? 1.2 : 0.8 })
    this.tweens.add({ targets: this.sub, alpha: 1, duration: 300 })
    this.tweens.add({ targets: this.titulo, alpha: 1, duration: 500, delay: 200 })
    if (lugar) this.tweens.add({ targets: lugar, alpha: 1, duration: 400, delay: 500 })
    this.time.delayedCall(piso ? 2300 : 1700, () => this.seguir())
    this.input.once('pointerdown', () => this.seguir())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('bajada'))
    agregarGanchos({ bajada: () => ({ titulo: this.titulo.text, subir: d.subir, piso, columna: piso ? columnaAbismo(piso).map((p) => p.estado) : [] }) })
  }

  /**
   * La columna del abismo a la derecha: un cuadrito por piso, unidos por una línea. Los de arriba ya vistos en
   * turquesa apagado, el actual dorado y latiendo, los de abajo a oscuras. Al fondo, dos ojos rojos (luz técnica).
   */
  private armarColumna(piso: number, w: number, h: number, esc: number): void {
    this.columna?.destroy()
    const col = columnaAbismo(piso)
    const lado = 9 * esc
    const paso = Math.max(lado + 6, Math.min(Math.round((h * 0.6) / col.length), 18 * esc))
    const x = Math.round(w - 36 * esc)
    const y0 = Math.round(h / 2 - (paso * (col.length - 1)) / 2 - paso / 2)
    const c = this.add.container(0, 0)
    const g = this.add.graphics()
    g.lineStyle(Math.max(1, esc), 0x3a4a58, 0.8).lineBetween(x, y0, x, y0 + paso * (col.length - 1))
    c.add(g)
    col.forEach((p, i) => {
      const y = y0 + i * paso
      const color = p.estado === 'actual' ? 0xffc860 : p.estado === 'pasado' ? 0x4a9a90 : 0x1a2028
      const r = this.add.rectangle(x, y, lado, lado, color).setStrokeStyle(1, 0x05060c)
      c.add(r)
      if (p.estado === 'actual') this.tweens.add({ targets: r, scale: 1.4, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })
    // los ojos del fondo, más abajo del último piso
    if (this.textures.exists(K.luz)) {
      const yo = y0 + paso * col.length + 4 * esc
      for (const dx of [-5 * esc, 5 * esc]) {
        const o = this.add.image(x + dx, yo, K.luz).setTint(0xff2a1a).setBlendMode(Phaser.BlendModes.ADD).setScale((10 * esc) / 64).setAlpha(0)
        c.add(o)
        this.tweens.add({ targets: o, alpha: 0.95, duration: 700, delay: 900, yoyo: true, hold: 500 })
      }
    }
    c.setAlpha(0)
    this.tweens.add({ targets: c, alpha: 1, duration: 400, delay: 300 })
    this.columna = c
  }

  private seguir(): void {
    if (this.saliendo) return
    this.saliendo = true
    this.cameras.main.fadeOut(300, 5, 6, 12)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Mundo'))
  }
}
