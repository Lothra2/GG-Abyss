import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { rutaKit } from '../kit/cargador'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/**
 * Cómo instalar el juego en el iPad (PLAN.md F5): en iPad no hay pantalla completa de verdad, hay que agregarlo a la pantalla de inicio
 * desde Safari. Tres pasos con el ícono de la app del kit. Faltan los íconos de Compartir y Agregar a inicio (ASSETS_PENDIENTES.md).
 */
export class Instalar extends Phaser.Scene {
  private desde = 'Pausa'
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.NineSlice
  private titulo!: Phaser.GameObjects.BitmapText
  private pasos: Phaser.GameObjects.BitmapText[] = []
  private icono?: Phaser.GameObjects.Image
  private cerrar!: ReturnType<typeof crearBoton>

  constructor() {
    super('Instalar')
  }

  init(datos: { desde?: string }): void {
    this.desde = datos?.desde ?? 'Pausa'
  }

  preload(): void {
    const m = manifestDe(this)
    const a = m.app?.icono_192
    if (a && !this.textures.exists('icono_app')) this.load.image('icono_app', rutaKit(a.archivo))
  }

  create(): void {
    Bloqueo.instalar(this)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.85).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.panel = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 8, 8, 8, 8).setOrigin(0, 0)
    this.titulo = texto(this, 0, 0, 'Instalar', 'fuente_titulo', 1, { origen: [0.5, 0] })
    for (const t of ['1  Toca Compartir en Safari', '2  Elige Agregar a inicio', '3  Abre GG Abyss desde su ícono']) this.pasos.push(texto(this, 0, 0, t, 'fuente_ui', 1, { origen: [0, 0.5] }))
    if (this.textures.exists('icono_app')) this.icono = this.add.image(0, 0, 'icono_app').setScale(0.5)
    this.cerrar = crearBoton(this, { x: 0, y: 0, icono: 'icono_jugar', etiqueta: 'Listo', alToque: () => this.salir() })
    this.input.keyboard?.on('keydown-ESC', () => this.salir())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('instalar', 'cerrarInstalar'))
    alCambiarEscala(this, () => this.acomodar())
    agregarGanchos({ instalar: () => ({ abierto: true, pasos: this.pasos.map((p) => p.text) }), cerrarInstalar: (() => this.salir()) as never })
  }

  private acomodar(): void {
    if (!this.velo) return
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    const esc = e.zoom >= 3 ? 1 : 2
    this.velo.setSize(w, h)
    const pw = Math.min(w - 16, 360)
    const ph = Math.min(h - 16, 190 + (esc - 1) * 50)
    const px = Math.round((w - pw) / 2)
    const py = Math.round((h - ph) / 2)
    this.panel.setPosition(px, py).setSize(pw, ph)
    this.titulo.setScale(esc).setPosition(Math.round(w / 2), py + 10)
    let y = py + 14 + this.titulo.displayHeight + 14
    for (const p of this.pasos) {
      p.setScale(esc).setPosition(px + 16, y + p.displayHeight / 2)
      y += p.displayHeight + 10
    }
    this.icono?.setPosition(px + pw - 38, py + ph / 2).setVisible(pw > 200)
    this.cerrar.setPosition(Math.round(w / 2), py + ph - this.cerrar.alto / 2 - 8)
  }

  private salir(): void {
    this.scene.resume(this.desde)
    this.scene.stop()
  }
}
