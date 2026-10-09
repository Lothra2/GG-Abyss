import Phaser from 'phaser'
import { K } from '../kit/claves'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/** Prepara el texto del kit para mostrarlo: sin direcciones web (no caben) y sin renglones repetidos */
export function limpiarCreditos(crudo: string): string {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const linea of crudo.split(/\r?\n/)) {
    const l = linea
      .split(/\s+/)
      .filter((p) => !/^https?:\/\//.test(p))
      .join(' ')
      .replace(/\s+[,.]+$/, '.')
      .trim()
    if (l === '') {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }
    if (vistos.has(l)) continue
    vistos.add(l)
    out.push(l)
  }
  return out.join('\n').trim()
}

/**
 * Créditos visibles en el juego (CLAUDE.md): el CREDITOS.txt del kit, con scroll por arrastre, rueda o flechas.
 * Se abre encima de otra escena (título o pausa), la deja en pausa y la reanuda al cerrar.
 */
export class Creditos extends Phaser.Scene {
  private desde = 'Titulo'
  private contenido!: Phaser.GameObjects.BitmapText
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.NineSlice
  private titulo!: Phaser.GameObjects.BitmapText
  private cerrar!: ReturnType<typeof crearBoton>
  private scroll = 0
  private max = 0
  private ventana = { x: 0, y: 0, w: 0, h: 0 }
  private mascara?: Phaser.Display.Masks.GeometryMask
  private arrastre: { y0: number; s0: number } | null = null

  constructor() {
    super('Creditos')
  }

  init(datos: { desde?: string }): void {
    this.desde = datos?.desde ?? 'Titulo'
  }

  create(): void {
    this.scroll = 0
    this.arrastre = null
    Bloqueo.instalar(this)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.82).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => { Bloqueo.tomar(p.id); this.arrastre = { y0: p.y, s0: this.scroll } })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.arrastre || !p.isDown) return
      this.fijarScroll(this.arrastre.s0 + (this.arrastre.y0 - p.y))
    })
    this.input.on('pointerup', () => (this.arrastre = null))
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.fijarScroll(this.scroll + Math.sign(dy) * 24))
    this.input.keyboard?.on('keydown-DOWN', () => this.fijarScroll(this.scroll + 24))
    this.input.keyboard?.on('keydown-UP', () => this.fijarScroll(this.scroll - 24))
    this.input.keyboard?.on('keydown-ESC', () => this.salir())

    this.panel = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 8, 8, 8, 8).setOrigin(0, 0)
    this.titulo = texto(this, 0, 0, 'Créditos', 'fuente_titulo', 1, { origen: [0.5, 0] })
    const crudo = (this.cache.text.get('creditos') as string | undefined) ?? 'GG Abyss: arte y sonido de PixelForja.'
    this.contenido = texto(this, 0, 0, limpiarCreditos(crudo), 'fuente_ui', 1, { origen: [0, 0] })
    this.cerrar = crearBoton(this, { x: 0, y: 0, icono: 'icono_cerrar', alToque: () => this.salir(), origen: [1, 0] })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('creditos', 'cerrarCreditos')
      this.mascara?.destroy()
    })
    alCambiarEscala(this, () => this.acomodar())
    agregarGanchos({
      creditos: () => ({ abierto: true, desde: this.desde, scroll: this.scroll, max: this.max, alto: this.contenido.height, ventana: this.ventana }),
      cerrarCreditos: (() => this.salir()) as never,
      scrollCreditos: ((v: number) => this.fijarScroll(v)) as never,
    })
  }

  private acomodar(): void {
    if (!this.velo) return
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    const mg = 8
    this.velo.setSize(w, h)
    this.panel.setPosition(mg, mg).setSize(w - mg * 2, h - mg * 2)
    this.titulo.setScale(e.zoom >= 3 ? 1 : 2).setPosition(Math.round(w / 2), mg + 8)
    this.cerrar.setPosition(w - mg - 4, mg + 4)
    const top = mg + 8 + this.titulo.displayHeight + 10
    const esc = e.zoom >= 3 ? 1 : 2
    this.contenido.setScale(esc)
    this.contenido.setMaxWidth(Math.floor((w - mg * 2 - 28) / esc))
    this.ventana = { x: mg + 14, y: top, w: w - mg * 2 - 28, h: h - top - mg - 10 }
    this.contenido.setPosition(this.ventana.x, this.ventana.y)
    this.mascara?.destroy()
    const g = this.make.graphics({}, false)
    g.fillStyle(0xffffff).fillRect(this.ventana.x, this.ventana.y, this.ventana.w, this.ventana.h)
    this.mascara = g.createGeometryMask()
    this.contenido.setMask(this.mascara)
    this.max = Math.max(0, this.contenido.displayHeight - this.ventana.h)
    this.fijarScroll(this.scroll)
  }

  private fijarScroll(v: number): void {
    this.scroll = Math.round(Math.max(0, Math.min(this.max, v)))
    this.contenido.y = this.ventana.y - this.scroll
  }

  private salir(): void {
    if (this.cache.audio.exists(K.aud('click'))) this.sound.play(K.aud('click'), { volume: 0.6 })
    this.scene.resume(this.desde)
    this.scene.stop()
  }
}
