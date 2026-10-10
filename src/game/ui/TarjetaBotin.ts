import Phaser from 'phaser'
import { K } from '../../kit/claves'
import { colorDeRareza, itemDe, type Catalogo } from '../../logic/catalogo'
import type { Veredicto } from '../../logic/veredicto'
import { atlasDeIcono, frameDeIcono } from '../Botin'
import { escalaDe } from '../Pantalla'
import { hexANumero, texto } from '../Texto'
import { crearBoton, type Boton } from './Boton'

const VERDE = 0x8aff7a
const ROJO = 0xff7a6a
const QUIETA_S = 6

export interface DatosTarjeta {
  id: string
  /** el casillero de la bolsa donde cayó */
  indice: number
  veredicto: Veredicto
}

/**
 * La tarjeta del botín: al recoger algo que se puede poner aparece arriba a la derecha con su ícono, su nombre en el
 * color de su rareza, una flecha verde (mejor), roja (peor) o un igual, lo que cambia y el botón "Ponérmelo".
 * Así se decide en el momento sin abrir el inventario. Se va sola a los 6 s.
 */
export class TarjetaBotin {
  private c: Phaser.GameObjects.Container
  private fondo: Phaser.GameObjects.NineSlice
  private icono: Phaser.GameObjects.Image
  private nombre: Phaser.GameObjects.BitmapText
  private flecha: Phaser.GameObjects.Image
  private juicio: Phaser.GameObjects.BitmapText
  private lineas: Phaser.GameObjects.BitmapText[] = []
  private boton: Boton
  private datos: DatosTarjeta | null = null
  private resta = 0
  private puesto = false

  constructor(
    private escena: Phaser.Scene,
    private cat: Catalogo,
    private alPoner: (indice: number) => boolean,
  ) {
    this.fondo = escena.add.nineslice(0, 0, K.ui('tooltip'), undefined, 100, 60, 6, 6, 6, 6).setOrigin(0, 0)
    this.icono = escena.add.image(0, 0, K.ui('icono_bolsa')).setOrigin(0, 0)
    this.nombre = texto(escena, 0, 0, '', 'fuente_ui', 1, { origen: [0, 0] })
    this.flecha = escena.add.image(0, 0, K.ui('flecha_guia'), 4).setOrigin(0, 0.5)
    this.juicio = texto(escena, 0, 0, '', 'fuente_ui', 1, { origen: [0, 0.5] })
    for (let i = 0; i < 3; i++) this.lineas.push(texto(escena, 0, 0, '', 'fuente_ui', 1, { origen: [0, 0] }))
    this.boton = crearBoton(escena, { x: 0, y: 0, etiqueta: 'Ponérmelo', icono: 'icono_bolsa', alToque: () => this.poner(), origen: [0, 0] })
    this.c = escena.add.container(0, 0, [this.fondo, this.icono, this.nombre, this.flecha, this.juicio, ...this.lineas, this.boton]).setDepth(450).setVisible(false)
  }

  mostrar(d: DatosTarjeta): void {
    const item = itemDe(this.cat, d.id)
    if (!item) return
    this.datos = d
    this.puesto = false
    this.resta = QUIETA_S
    const atlas = atlasDeIcono(item)
    if (this.escena.textures.exists(atlas)) this.icono.setTexture(atlas, frameDeIcono(item))
    this.nombre.setText(item.name.es).setTint(hexANumero(colorDeRareza(this.cat, item.rarity)))
    const v = d.veredicto
    if (v.juicio === 'mejor') {
      this.flecha.setVisible(true).setFrame(4).setTint(VERDE)
      this.juicio.setText(v.contra ? '¡Mejor que el tuyo!' : '¡Te sirve!').setTint(VERDE)
    } else if (v.juicio === 'peor') {
      this.flecha.setVisible(true).setFrame(0).setTint(ROJO)
      this.juicio.setText('El tuyo es mejor').setTint(ROJO)
    } else {
      this.flecha.setVisible(false)
      this.juicio.setText('Igual al tuyo').setTint(0xffe6b0)
    }
    // las 3 diferencias que más pesan
    const dif = [...v.dif].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
    this.lineas.forEach((l, i) => {
      const df = dif[i]
      if (!df) return l.setText('').setVisible(false)
      const signo = df.delta > 0 ? '+' : ''
      const pct = df.etiqueta.endsWith('%')
      l.setText(`${df.etiqueta.replace(' %', '')} ${signo}${Math.round(df.delta * 10) / 10}${pct ? '%' : ''}`).setTint(df.delta > 0 ? VERDE : ROJO).setVisible(true)
    })
    this.boton.setVisible(true)
    this.c.setVisible(true).setAlpha(0)
    this.escena.tweens.killTweensOf(this.c)
    this.escena.tweens.add({ targets: this.c, alpha: 1, duration: 160 })
    this.acomodar()
  }

  private poner(): void {
    if (!this.datos || this.puesto) return
    if (this.alPoner(this.datos.indice)) {
      this.puesto = true
      this.juicio.setText('¡Puesto!').setTint(VERDE)
      this.flecha.setVisible(false)
      this.boton.setVisible(false)
      this.resta = 1.2
    }
  }

  acomodar(): void {
    if (!this.datos) return
    const w = this.escena.scale.width
    const esc = escalaDe(this.escena.game).zoom >= 3 ? 1 : 2
    for (const t of [this.nombre, this.juicio, ...this.lineas]) t.setScale(esc)
    this.icono.setScale(esc === 1 ? 1 : 2)
    this.flecha.setScale(esc === 1 ? 0.5 : 1)
    const pad = 6
    const ic = this.icono.displayWidth
    let y = pad
    this.icono.setPosition(pad, pad)
    const tx = pad + ic + 6
    this.nombre.setPosition(tx, y)
    y += this.nombre.displayHeight + 4
    const fy = y + this.juicio.displayHeight / 2
    if (this.flecha.visible) {
      this.flecha.setPosition(tx, Math.round(fy))
      this.juicio.setPosition(tx + this.flecha.displayWidth + 3, Math.round(fy))
    } else this.juicio.setPosition(tx, Math.round(fy))
    y += this.juicio.displayHeight + 4
    for (const l of this.lineas) {
      if (!l.visible) continue
      l.setPosition(tx, y)
      y += l.displayHeight + 2
    }
    y = Math.max(y, pad + ic) + 4
    this.boton.setPosition(pad, y)
    const ancho = Math.max(tx + Math.max(this.nombre.displayWidth, this.juicio.displayWidth + 14 * esc, ...this.lineas.map((l) => (l.visible ? l.displayWidth : 0))), pad + this.boton.ancho) + pad
    const alto = y + (this.boton.visible ? this.boton.alto : 0) + pad
    this.fondo.setSize(Math.ceil(ancho), Math.ceil(alto))
    this.c.setPosition(Math.round(w - ancho - 8), Math.round(this.escena.scale.height * 0.18))
  }

  update(dt: number): void {
    if (!this.c.visible) return
    this.resta -= dt
    if (this.resta <= 0) {
      this.datos = null
      this.escena.tweens.add({ targets: this.c, alpha: 0, duration: 250, onComplete: () => this.c.setVisible(false) })
      this.resta = 99
    }
  }

  info() {
    return this.c.visible && this.datos ? { visible: true, id: this.datos.id, juicio: this.datos.veredicto.juicio, lineas: this.lineas.filter((l) => l.visible).map((l) => l.text), puesto: this.puesto, boton: this.boton.visible ? this.boton.getBounds() : null } : { visible: false }
  }

  /** Para las pruebas: tocar "Ponérmelo" */
  tocarPoner(): void {
    this.poner()
  }
}
