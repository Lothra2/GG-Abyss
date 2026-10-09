import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { uiImagenes } from '../kit/manifest'
import { params } from '../config/params'
import { HUD as MARGENES } from '../config/juego'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo, EventoDescubrimiento } from './Mundo'

/**
 * Interfaz encima del mundo. Todo se ancla a los bordes de la vista lógica, nada flota en coordenadas fijas.
 * F1a: contadores de zonas y secretos, banner de descubrimiento y el medidor de fps del modo prueba.
 */
export class HUD extends Phaser.Scene {
  private mundo!: Mundo
  private panel!: Phaser.GameObjects.NineSlice
  private iconoZonas!: Phaser.GameObjects.Image
  private iconoSecretos!: Phaser.GameObjects.Image
  private txtZonas!: Phaser.GameObjects.BitmapText
  private txtSecretos!: Phaser.GameObjects.BitmapText
  private banner!: Phaser.GameObjects.Container
  private bDescubriste!: Phaser.GameObjects.BitmapText
  private bNombre!: Phaser.GameObjects.BitmapText
  private bNombrePlata!: Phaser.GameObjects.BitmapText
  private fps?: Phaser.GameObjects.BitmapText
  private tween?: Phaser.Tweens.Tween
  private acumFps = 0
  private bannerInfo = { visible: false, titulo: '', nombre: '', secreto: false }

  constructor() {
    super('HUD')
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    const m = manifestDe(this)
    const ui = uiImagenes(m)
    const k = (nuevo: string, viejo: string) => K.ui(ui[nuevo] ? nuevo : viejo)

    this.panel = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 60, 60, 6, 6, 6, 6).setOrigin(0, 0).setAlpha(0.9)
    this.iconoZonas = this.add.image(0, 0, k('icono_zona', 'icono_mapa')).setOrigin(0, 0.5)
    this.iconoSecretos = this.add.image(0, 0, k('icono_secreto', 'icono_bolsa')).setOrigin(0, 0.5)
    this.txtZonas = texto(this, 0, 0, '0/0', 'fuente_ui', 1, { origen: [0, 0.5] })
    this.txtSecretos = texto(this, 0, 0, '0/0', 'fuente_ui', 1, { origen: [0, 0.5] })

    this.bDescubriste = texto(this, 0, 0, 'Descubriste', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xffd27a })
    this.bNombre = texto(this, 0, 0, '', 'fuente_titulo', 1, { origen: [0.5, 0.5] })
    this.bNombrePlata = texto(this, 0, 0, '', 'fuente_titulo_plata', 1, { origen: [0.5, 0.5] })
    this.banner = this.add.container(0, 0, [this.bDescubriste, this.bNombre, this.bNombrePlata]).setAlpha(0)

    if (params.test) this.fps = texto(this, 0, 0, '', 'fuente_ui', 1, { origen: [1, 0], tinte: 0x7affc8 })

    const alDescubrir = (ev: EventoDescubrimiento) => this.mostrarBanner(ev)
    this.game.events.on('descubrimiento', alDescubrir)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('descubrimiento', alDescubrir)
      quitarGanchos('hudBanner')
    })
    alCambiarEscala(this, () => this.acomodar())
    this.actualizarContadores()

    agregarGanchos({ hudBanner: () => ({ ...this.bannerInfo, alpha: this.banner.alpha }) })
  }

  /** Todo pegado a los bordes. Los textos usan escala 1 en pantallas de zoom alto y 2 en las chicas. */
  private acomodar(): void {
    const e = escalaDe(this.game)
    const w = this.scale.width
    const h = this.scale.height
    const mg = MARGENES.MARGEN
    const esc = e.zoom >= 3 ? 1 : 2
    this.txtZonas.setScale(esc)
    this.txtSecretos.setScale(esc)
    const fila = Math.max(26, this.txtZonas.displayHeight + 8)
    const ancho = 24 + 6 + Math.max(this.txtZonas.displayWidth, this.txtSecretos.displayWidth, 30 * esc) + 16
    this.panel.setPosition(mg, mg).setSize(ancho, fila * 2 + 8)
    this.iconoZonas.setPosition(mg + 8, mg + 4 + fila / 2)
    this.iconoSecretos.setPosition(mg + 8, mg + 4 + fila * 1.5)
    this.txtZonas.setPosition(mg + 8 + 24 + 6, mg + 4 + fila / 2)
    this.txtSecretos.setPosition(mg + 8 + 24 + 6, mg + 4 + fila * 1.5)

    // banner centrado arriba
    const nombre = this.bannerInfo.nombre
    this.bDescubriste.setText(this.bannerInfo.secreto ? '¡Secreto!' : 'Descubriste').setScale(esc)
    const base = (this.bannerInfo.secreto ? this.bNombrePlata : this.bNombre).setText(nombre)
    base.setScale(1)
    const anchoBase = base.displayWidth
    const escNombre = escalaQueEntra(anchoBase, w - 24, 2)
    this.bNombre.setText(nombre).setScale(escNombre).setVisible(!this.bannerInfo.secreto)
    this.bNombrePlata.setText(nombre).setScale(escNombre).setVisible(this.bannerInfo.secreto)
    this.bDescubriste.setPosition(0, -this.bNombre.displayHeight / 2 - 4)
    this.bNombre.setPosition(0, 6)
    this.bNombrePlata.setPosition(0, 6)
    this.banner.setPosition(Math.round(w / 2), Math.round(h * 0.22))

    this.fps?.setPosition(w - mg, mg)
  }

  private actualizarContadores(): void {
    const r = this.mundo.resumenDescubrimiento
    this.txtZonas.setText(`${r.zonas}/${r.totalZonas}`)
    this.txtSecretos.setText(`${r.secretos}/${r.totalSecretos}`)
    this.acomodar()
  }

  private mostrarBanner(ev: EventoDescubrimiento): void {
    this.bannerInfo = { visible: true, titulo: ev.secreto ? '¡Secreto!' : 'Descubriste', nombre: ev.zona.nombre, secreto: ev.secreto }
    this.acomodar()
    this.actualizarContadores()
    this.tween?.stop()
    this.banner.setAlpha(0)
    const dy = 6
    this.banner.y = Math.round(this.scale.height * 0.22) - dy
    const base = Math.round(this.scale.height * 0.22)
    // entra en 0.9 s, se queda 3.2 s, sale en 0.9 s
    this.tween = this.tweens.add({
      targets: this.banner,
      alpha: 1,
      y: base,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tween = this.tweens.add({
          targets: this.banner,
          alpha: 0,
          delay: 3200,
          duration: 900,
          onComplete: () => {
            this.bannerInfo.visible = false
          },
        })
      },
    })
  }

  /** Dónde quedó cada pieza, para comprobar que está pegada a los bordes */
  layout(): unknown {
    const r = (o: Phaser.GameObjects.Components.GetBounds) => {
      const b = o.getBounds()
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
    }
    return {
      vista: { w: this.scale.width, h: this.scale.height },
      panel: r(this.panel),
      fps: this.fps ? r(this.fps) : null,
      banner: { x: Math.round(this.banner.x), y: Math.round(this.banner.y) },
    }
  }

  override update(_t: number, deltaMs: number): void {
    if (this.fps) {
      this.acumFps += deltaMs
      if (this.acumFps > 500) {
        this.acumFps = 0
        const f = this.game.loop.actualFps
        this.fps.setText(`${Math.round(f)} fps`).setTint(f >= 55 ? 0x7affc8 : f >= 40 ? 0xffd27a : 0xff6a6a)
      }
    }
  }
}
