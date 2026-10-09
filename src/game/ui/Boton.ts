import Phaser from 'phaser'
import { K } from '../../kit/claves'
import { texto, type Fuente } from '../Texto'
import { escalaDe, toqueMinimo } from '../Pantalla'
import { Bloqueo } from './Bloqueo'

export interface OpcionesBoton {
  x: number
  y: number
  /** ancho y alto lógicos. Se agrandan solos si no llegan al mínimo táctil. */
  w?: number
  h?: number
  etiqueta?: string
  fuente?: Fuente
  escalaTexto?: number
  /** nombre de una imagen de ui (sin el prefijo), por ejemplo `icono_ajustes` */
  icono?: string
  /** escala entera del ícono */
  escalaIcono?: number
  /** cuadro del ícono si es una hoja */
  cuadroIcono?: number
  peque?: boolean
  sonido?: string
  alToque: () => void
  origen?: [number, number]
}

export interface Boton extends Phaser.GameObjects.Container {
  /** tamaño real del botón en pixeles lógicos (puede ser mayor que el pedido) */
  ancho: number
  alto: number
  setEtiqueta(t: string): void
  setActivo(v: boolean): void
  zona: Phaser.GameObjects.Zone
}

/**
 * Botón con el sprite `boton` del kit (3 cuadros: normal, encima, presionado), nueve rebanadas,
 * texto y/o ícono. El área de toque nunca baja del mínimo táctil.
 */
export function crearBoton(e: Phaser.Scene, o: OpcionesBoton): Boton {
  const esc = escalaDe(e.game)
  const min = toqueMinimo(esc, o.peque)
  const [ox, oy] = o.origen ?? [0.5, 0.5]

  // el texto se mide antes para que el botón siempre lo abrace
  let etiqueta: Phaser.GameObjects.BitmapText | null = null
  if (o.etiqueta !== undefined) etiqueta = texto(e, 0, 0, o.etiqueta, o.fuente ?? 'fuente_ui', o.escalaTexto ?? 1, { origen: [0.5, 0.5] })
  const iconoW = o.icono ? (o.escalaIcono ?? 1) * 24 + (etiqueta ? 6 : 0) : 0
  const w = Math.max(o.w ?? 0, min, etiqueta ? etiqueta.displayWidth + iconoW + 16 : 0, o.icono && !etiqueta ? iconoW + 12 : 0)
  const h = Math.max(o.h ?? 0, min, etiqueta ? etiqueta.displayHeight + 8 : 0, o.icono ? (o.escalaIcono ?? 1) * 24 + 8 : 0)

  const c = e.add.container(o.x, o.y) as Boton
  const fondo = e.add.nineslice(0, 0, K.ui('boton'), 0, w, h, 8, 8, 6, 6).setOrigin(ox, oy)
  c.add(fondo)

  const cx = (0.5 - ox) * w
  const cy = (0.5 - oy) * h
  let icono: Phaser.GameObjects.Image | null = null
  if (o.icono) {
    icono = e.add.image(cx, cy, K.ui(o.icono), o.cuadroIcono ?? 0).setScale(o.escalaIcono ?? 1)
    c.add(icono)
  }
  if (etiqueta) {
    etiqueta.setPosition(cx, cy)
    if (icono) {
      const total = icono.displayWidth + 6 + etiqueta.displayWidth
      icono.x = cx - total / 2 + icono.displayWidth / 2
      etiqueta.x = cx + total / 2 - etiqueta.displayWidth / 2
    }
    c.add(etiqueta)
  }

  Bloqueo.instalar(e)
  const zona = e.add.zone(0, 0, w, h).setOrigin(ox, oy).setInteractive({ useHandCursor: true })
  c.add(zona)
  c.zona = zona
  c.ancho = w
  c.alto = h
  c.setSize(w, h)

  let activo = true
  zona.on('pointerover', () => activo && fondo.setFrame(1))
  zona.on('pointerout', () => { fondo.setFrame(0); c.y = o.y })
  zona.on('pointerdown', (p: Phaser.Input.Pointer) => { Bloqueo.tomar(p.id); if (!activo) return; fondo.setFrame(2); c.y = o.y + 1 })
  zona.on('pointerup', () => {
    fondo.setFrame(0)
    c.y = o.y
    if (!activo) return
    if (o.sonido && e.cache.audio.exists(o.sonido)) e.sound.play(o.sonido, { volume: 0.6 })
    o.alToque()
  })

  c.setEtiqueta = (t: string) => { etiqueta?.setText(t) }
  c.setActivo = (v: boolean) => { activo = v; c.setAlpha(v ? 1 : 0.5) }
  return c
}
