import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import type { MapaJuego } from '../kit/mapa'
import { FondoAbismo } from '../game/FondoAbismo'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { recargarSiHayVersionNueva } from '../pwa'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import { introVista } from './Intro'
import { mostrarIntro } from '../logic/intro'
import { params } from '../config/params'

/**
 * Pantalla de título (PLAN.md F1b, tarea 1): la entrada al abismo con su luz, el logo de GG Abyss y "Toca para empezar".
 * Ese primer toque desbloquea el audio en las tablets y pasa a la selección de jugadora.
 */
export class Titulo extends Phaser.Scene {
  private fondo!: FondoAbismo
  private logo?: Phaser.GameObjects.Sprite
  private logoTexto?: Phaser.GameObjects.BitmapText
  private toca!: Phaser.GameObjects.BitmapText
  private icono!: Phaser.GameObjects.Image
  private placa!: Phaser.GameObjects.NineSlice
  private botonCreditos!: Boton
  private botonIntro!: Boton
  private empezando = false
  private musica?: Phaser.Sound.BaseSound
  private version?: Phaser.GameObjects.BitmapText

  constructor() {
    super('Titulo')
  }

  create(): void {
    const m = manifestDe(this)
    this.empezando = false
    this.fondo = new FondoAbismo(this, m, this.registry.get('mapa') as MapaJuego, { oscuridad: 0.45, bruma: 0.55 })

    if (m.ui.logo && this.textures.exists(K.ui('logo'))) {
      this.logo = this.add.sprite(0, 0, K.ui('logo'), 0).setDepth(100)
      if (this.anims.exists('logo')) this.logo.play('logo')
    } else this.logoTexto = texto(this, 0, 0, 'GG Abyss', 'fuente_titulo', 3, { origen: [0.5, 0.5], profundidad: 100 })

    this.placa = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 100, 40, 6, 6, 6, 6).setOrigin(0.5, 0.5).setAlpha(0.85).setDepth(99)
    this.toca = texto(this, 0, 0, 'Toca para empezar', 'fuente_ui', 2, { origen: [0.5, 0.5], tinte: 0xffd27a, profundidad: 100 })
    this.icono = this.add.image(0, 0, K.ui('icono_jugar')).setDepth(100)
    this.tweens.add({ targets: [this.toca, this.icono], alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // la música arranca sola cuando el navegador deja (el primer toque la desbloquea)
    const nombre = this.cache.audio.exists(K.aud('musica_titulo')) ? 'musica_titulo' : 'ambiente_magia'
    const previa = this.registry.get('musicaTitulo') as Phaser.Sound.BaseSound | undefined
    if (previa?.isPlaying) this.musica = previa
    else {
      this.musica = this.sound.add(K.aud(nombre), { loop: true, volume: 0 })
      this.musica.play()
      this.registry.set('musicaTitulo', this.musica)
      this.tweens.add({ targets: this.musica, volume: 0.5, duration: 2500 })
    }

    Bloqueo.instalar(this)
    this.botonCreditos = crearBoton(this, {
      x: 0, y: 0, etiqueta: 'Créditos', origen: [1, 1], sonido: 'click',
      alToque: () => {
        this.scene.pause()
        this.scene.launch('Creditos', { desde: 'Titulo' })
        this.scene.bringToTop('Creditos')
      },
    })
    this.botonCreditos.setDepth(110)
    // el intro otra vez, para quien lo quiera ver (o mostrárselo a alguien)
    this.botonIntro = crearBoton(this, { x: 0, y: 0, etiqueta: 'Intro', origen: [1, 1], sonido: 'click', alToque: () => this.empezar(true) })
    this.botonIntro.setDepth(110)
    // la versión, chiquita abajo a la izquierda: para saber qué se está jugando
    this.version = texto(this, 0, 0, `v ${__VERSION_JUEGO__}`, 'fuente_ui', 1, { origen: [0, 1], tinte: 0x8a8698, profundidad: 110 })
    recargarSiHayVersionNueva(this)
    alCambiarEscala(this, () => this.acomodar())
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!Bloqueo.tomado(p.id)) this.empezar()
    })
    this.input.keyboard?.once('keydown', () => this.empezar())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('titulo', 'verIntro')
      this.fondo.destruir()
    })
    agregarGanchos({ titulo: () => ({ empezando: this.empezando, logo: !!this.logo, musica: !!this.musica, creditos: this.botonCreditos.getBounds() }), empezar: (() => this.empezar()) as never, verIntro: (() => this.empezar(true)) as never })
  }

  private acomodar(): void {
    if (!this.fondo) return
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    this.fondo.acomodar()
    // el logo a la escala entera más grande que entra en el 80 % del ancho
    if (this.logo) {
      const s = escalaQueEntra(288, w * 0.8, 4)
      this.logo.setScale(s).setPosition(Math.round(w / 2), Math.round(h * 0.32))
    } else this.logoTexto?.setPosition(Math.round(w / 2), Math.round(h * 0.32))
    const esc = e.zoom >= 3 ? 1 : 2
    this.toca.setScale(esc)
    const total = 24 + 8 + this.toca.displayWidth
    const y = Math.round(h * 0.78)
    this.botonCreditos.setPosition(w - 6, h - 6)
    this.botonIntro.setPosition(w - 6 - this.botonCreditos.ancho - 4, h - 6)
    this.version?.setPosition(6, h - 6)
    this.placa.setPosition(Math.round(w / 2), y).setSize(total + 28, Math.max(36, this.toca.displayHeight + 16))
    this.icono.setPosition(Math.round(w / 2 - total / 2 + 12), y)
    this.toca.setPosition(Math.round(w / 2 - total / 2 + 24 + 8 + this.toca.displayWidth / 2), y)
  }

  /** El primer toque: la primera vez en este aparato va al intro (ya con el sonido desbloqueado), después a elegir */
  private empezar(verIntro = false): void {
    if (this.empezando) return
    this.empezando = true
    if (this.cache.audio.exists(K.aud('click'))) this.sound.play(K.aud('click'), { volume: 0.7 })
    const destino = verIntro || mostrarIntro(introVista(), params.test, params.intro) ? 'Intro' : 'SeleccionJugador'
    this.cameras.main.fadeOut(300, 7, 10, 18)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(destino))
  }

  override update(_t: number, ms: number): void {
    this.fondo.update(Math.min(0.05, ms / 1000))
  }
}
