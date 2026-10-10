import Phaser from 'phaser'
import { K } from '../kit/claves'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { album, type FiguritaAlbum } from '../logic/descubrimiento'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo } from './Mundo'

interface Casilla {
  f: FiguritaAlbum
  marco: Phaser.GameObjects.NineSlice
  foto: Phaser.GameObjects.Image | null
  candado: Phaser.GameObjects.Image
  zona: Phaser.GameObjects.Zone
  x: number
  y: number
  w: number
  h: number
}

/**
 * El álbum de postales: una por cada lugar lindo del mapa. Las de las zonas descubiertas se ven a color; las que faltan,
 * en sombra con un signo de secreto, para que se note qué queda por encontrar. Tocar una pegada la muestra grande.
 * Se abre desde la pausa o tocando los contadores del HUD.
 */
export class Album extends Phaser.Scene {
  private mundo!: Mundo
  private desde = 'Mundo'
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.NineSlice
  private titulo!: Phaser.GameObjects.BitmapText
  private cuenta!: Phaser.GameObjects.BitmapText
  private cerrar!: Boton
  private casillas: Casilla[] = []
  private grande: { img: Phaser.GameObjects.Image; marco: Phaser.GameObjects.NineSlice; nombre: Phaser.GameObjects.BitmapText; postal: string } | null = null
  private escalaFoto = 0.25

  constructor() {
    super('Album')
  }

  init(datos: { desde?: string }): void {
    this.desde = datos?.desde ?? 'Mundo'
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    this.casillas = []
    this.grande = null
    Bloqueo.instalar(this)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.8).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.velo.on('pointerup', () => this.grande && this.cerrarGrande())
    this.panel = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 12, 12, 12, 12).setOrigin(0, 0)
    this.titulo = texto(this, 0, 0, 'Álbum del Bosque', 'fuente_titulo', 1, { origen: [0.5, 0] })
    this.cuenta = texto(this, 0, 0, '', 'fuente_ui', 1, { origen: [0.5, 0], tinte: 0xffd27a })
    this.cerrar = crearBoton(this, { x: 0, y: 0, icono: 'icono_cerrar', alToque: () => this.salir(), origen: [1, 0] })
    const figus = album(this.mundo.mapa, this.mundo.partida.zonas)
    for (const f of figus) this.casillas.push(this.crearCasilla(f))
    this.cuenta.setText(`${figus.filter((f) => f.desbloqueada).length} / ${figus.length}`)
    this.input.keyboard?.on('keydown-ESC', () => (this.grande ? this.cerrarGrande() : this.salir()))
    if (this.cache.audio.exists(K.aud('abrir_inventario'))) this.sound.play(K.aud('abrir_inventario'), { volume: 0.5 })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('albumUI', 'albumTocar', 'cerrarAlbum'))
    alCambiarEscala(this, () => this.acomodar())
    this.acomodar()
    agregarGanchos({
      albumUI: () => ({
        abierto: true,
        desde: this.desde,
        figuritas: this.casillas.map((c) => ({ ...c.f, x: c.x, y: c.y, w: c.w, h: c.h })),
        grande: this.grande?.postal ?? null,
        escalaFoto: this.escalaFoto,
      }),
      albumTocar: ((postal: string) => this.tocar(postal)) as never,
      cerrarAlbum: (() => this.salir()) as never,
    })
  }

  override update(_t: number, ms: number): void {
    if (this.desde === 'Mundo') this.mundo.sonidoEnPausa(Math.min(0.05, ms / 1000))
  }

  private crearCasilla(f: FiguritaAlbum): Casilla {
    const marco = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 40, 30, 6, 6, 6, 6).setOrigin(0, 0)
    const tex = K.postal(f.postal)
    const foto = this.textures.exists(tex) ? this.add.image(0, 0, tex).setOrigin(0, 0) : null
    // la que falta: la foto en sombra, casi negra, con el signo de secreto encima
    if (foto && !f.desbloqueada) foto.setTint(0x141822)
    const candado = this.add.image(0, 0, K.ui('icono_secreto')).setVisible(!f.desbloqueada)
    const zona = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true })
    zona.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    zona.on('pointerup', () => this.tocar(f.postal))
    return { f, marco, foto, candado, zona, x: 0, y: 0, w: 0, h: 0 }
  }

  /** Tocar una pegada la muestra grande con su nombre; una que falta solo suena */
  private tocar(postal: string): boolean {
    const c = this.casillas.find((x) => x.f.postal === postal)
    if (!c) return false
    if (!c.f.desbloqueada || !c.foto) {
      if (this.cache.audio.exists(K.aud('error'))) this.sound.play(K.aud('error'), { volume: 0.4 })
      this.tweens.add({ targets: c.candado, y: c.candado.y - 3, duration: 80, yoyo: true })
      return false
    }
    if (this.cache.audio.exists(K.aud('click'))) this.sound.play(K.aud('click'), { volume: 0.6 })
    this.cerrarGrande()
    const marco = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 12, 12, 12, 12).setOrigin(0.5, 0.5)
    const img = this.add.image(0, 0, K.postal(postal)).setOrigin(0.5, 0.5)
    const nombre = texto(this, 0, 0, c.f.titulo, 'fuente_titulo', 1, { origen: [0.5, 0] })
    this.grande = { img, marco, nombre, postal }
    this.verGrilla(false)
    this.acomodarGrande()
    img.setAlpha(0)
    this.tweens.add({ targets: img, alpha: 1, duration: 180 })
    return true
  }

  private cerrarGrande(): void {
    if (!this.grande) return
    this.grande.img.destroy()
    this.grande.marco.destroy()
    this.grande.nombre.destroy()
    this.grande = null
    this.verGrilla(true)
  }

  /** Con una postal grande, la grilla de atrás se esconde para que no se asome */
  private verGrilla(v: boolean): void {
    for (const c of this.casillas) {
      c.marco.setVisible(v)
      c.foto?.setVisible(v)
      c.candado.setVisible(v && !c.f.desbloqueada)
      if (v) c.zona.setInteractive()
      else c.zona.disableInteractive()
    }
    this.cuenta.setVisible(v)
  }

  private acomodarGrande(): void {
    const g = this.grande
    if (!g) return
    const w = this.scale.width
    const h = this.scale.height
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    g.nombre.setScale(esc)
    // la postal mide 960 x 540: se achica a la mitad o al cuarto para entrar (siempre una fracción exacta)
    const libreH = h - 24 - g.nombre.displayHeight - 16
    const s = [1, 0.5, 0.25].find((k) => 960 * k <= w - 24 && 540 * k <= libreH) ?? 0.25
    g.img.setScale(s).setPosition(Math.round(w / 2), Math.round(h / 2 - g.nombre.displayHeight / 2 - 4))
    g.marco.setPosition(g.img.x, g.img.y).setSize(Math.round(960 * s) + 16, Math.round(540 * s) + 16)
    g.nombre.setPosition(Math.round(w / 2), Math.round(g.img.y + (540 * s) / 2 + 12))
  }

  private acomodar(): void {
    if (!this.velo?.active) return
    const w = this.scale.width
    const h = this.scale.height
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.velo.setSize(w, h)
    this.titulo.setScale(esc)
    this.cuenta.setScale(esc)
    const n = this.casillas.length
    const sep = 6
    const cabeza = 12 + this.titulo.displayHeight + 4 + this.cuenta.displayHeight + 8
    // la escala de las fotos: la más grande (1/4, 1/6 o 1/8 de la postal) con la que entra la grilla
    let cols = 4
    let k = 0.125
    for (const kk of [0.25, 1 / 6, 0.125]) {
      for (const c of [5, 4, 3]) {
        const filas = Math.ceil(n / c)
        const gw = c * (960 * kk + 8) + (c - 1) * sep + 24
        const gh = cabeza + filas * (540 * kk + 8) + (filas - 1) * sep + 16
        if (gw <= w - 12 && gh <= h - 12) {
          cols = c
          k = kk
          break
        }
      }
      if (k === kk) break
    }
    this.escalaFoto = k
    const fw = Math.round(960 * k)
    const fh = Math.round(540 * k)
    const filas = Math.ceil(n / cols)
    const pw = cols * (fw + 8) + (cols - 1) * sep + 24
    const ph = Math.min(h - 8, cabeza + filas * (fh + 8) + (filas - 1) * sep + 16)
    const px = Math.round((w - pw) / 2)
    const py = Math.round((h - ph) / 2)
    this.panel.setPosition(px, py).setSize(pw, ph)
    this.titulo.setPosition(Math.round(w / 2), py + 12)
    this.cuenta.setPosition(Math.round(w / 2), py + 12 + this.titulo.displayHeight + 4)
    this.cerrar.setPosition(px + pw - 6, py + 6)
    this.casillas.forEach((c, i) => {
      const fila = Math.floor(i / cols)
      const col = i % cols
      const enFila = Math.min(cols, n - fila * cols)
      const x0 = px + Math.round((pw - (enFila * (fw + 8) + (enFila - 1) * sep)) / 2)
      const x = x0 + col * (fw + 8 + sep)
      const y = py + cabeza + fila * (fh + 8 + sep)
      c.x = x
      c.y = y
      c.w = fw + 8
      c.h = fh + 8
      c.marco.setPosition(x, y).setSize(fw + 8, fh + 8)
      c.foto?.setScale(k).setPosition(x + 4, y + 4)
      c.candado.setScale(esc).setPosition(Math.round(x + c.w / 2), Math.round(y + c.h / 2))
      c.zona.setPosition(x, y).setSize(c.w, c.h)
    })
    this.acomodarGrande()
  }

  private salir(): void {
    if (!this.scene.isActive()) return
    this.scene.resume(this.desde)
    if (this.desde === 'Mundo') this.game.events.emit('inventario-cerrado')
    this.scene.stop()
  }
}
