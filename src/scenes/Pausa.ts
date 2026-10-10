import Phaser from 'phaser'
import { K } from '../kit/claves'
import { OSCURIDAD } from '../config/balance'
import { alCambiarEscala, escalaDe, toqueMinimo } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { nocheMaxima } from '../logic/zonas'
import { alternarPantallaCompleta, esIOS, instaladaComoApp, puedePantallaCompleta } from '../pwa'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo } from './Mundo'

interface Deslizador {
  rotulo: string
  nombre: 'noche' | 'musica' | 'efectos'
  icono: Phaser.GameObjects.Image
  riel: Phaser.GameObjects.NineSlice
  relleno: Phaser.GameObjects.NineSlice
  perilla: Phaser.GameObjects.NineSlice
  zona: Phaser.GameObjects.Zone
  valor: Phaser.GameObjects.BitmapText
  max: () => number
  x: number
  w: number
}

/**
 * Pausa y ajustes (PLAN.md F1b): Noche, música y efectos con deslizadores, calidad, modo peque,
 * cambiar de jugadora, créditos y continuar. Todo se guarda en la partida de la jugadora que está jugando.
 * Se abre encima del Mundo en pausa y lo reanuda al cerrar.
 */
export class Pausa extends Phaser.Scene {
  private mundo!: Mundo
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.NineSlice
  private titulo!: Phaser.GameObjects.BitmapText
  private deslizadores: Deslizador[] = []
  private calidad!: Boton
  private peque!: Boton
  private cambiar!: Boton
  private creditos!: Boton
  private album!: Boton
  private suaves!: Boton
  private mejoras!: Boton
  private seguir!: Boton
  private pantalla: Boton | null = null
  private arrastrando: Deslizador | null = null
  private cerrando = false
  private nombresVisibles = true

  constructor() {
    super('Pausa')
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    this.cerrando = false
    this.arrastrando = null
    this.deslizadores = []
    Bloqueo.instalar(this)

    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.72).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.panel = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 8, 8, 8, 8).setOrigin(0, 0)
    this.titulo = texto(this, 0, 0, 'Pausa', 'fuente_titulo', 1, { origen: [0.5, 0] })

    const aj = () => this.mundo.partida.ajustes
    this.deslizador('noche', 'icono_luna', () => nocheMaxima(aj().modoPeque), 'Noche')
    this.deslizador('musica', 'icono_sonido', () => 1, 'Música')
    this.deslizador('efectos', 'icono_sonido', () => 1, 'Efectos')

    this.calidad = crearBoton(this, { x: 0, y: 0, icono: 'icono_calidad', etiqueta: 'Calidad alta', alToque: () => this.alternarCalidad() })
    this.peque = crearBoton(this, { x: 0, y: 0, icono: 'icono_peque', etiqueta: 'Modo peque: no', alToque: () => this.alternarPeque() })
    this.suaves = crearBoton(this, { x: 0, y: 0, icono: 'icono_luna', etiqueta: 'Efectos suaves: no', alToque: () => this.alternar('efectosSuaves') })
    this.mejoras = crearBoton(this, { x: 0, y: 0, icono: 'icono_calidad', etiqueta: 'Mejoras F7: sí', alToque: () => this.alternar('mejorasF7') })
    this.cambiar = crearBoton(this, { x: 0, y: 0, icono: 'icono_jugadora', etiqueta: 'Otra jugadora', alToque: () => this.cambiarJugadora() })
    this.creditos = crearBoton(this, { x: 0, y: 0, icono: 'icono_guardado', etiqueta: 'Créditos', alToque: () => this.abrirCreditos() })
    this.album = crearBoton(this, { x: 0, y: 0, icono: 'icono_zona', etiqueta: 'Álbum', alToque: () => this.abrirAlbum() })
    // pantalla completa en Android y PC; en el iPad no existe y se explica cómo instalarla
    this.pantalla = null
    if (puedePantallaCompleta()) this.pantalla = crearBoton(this, { x: 0, y: 0, icono: 'icono_mapa', etiqueta: 'Pantalla completa', alToque: () => alternarPantallaCompleta() })
    else if (esIOS() && !instaladaComoApp()) this.pantalla = crearBoton(this, { x: 0, y: 0, icono: 'icono_guardado', etiqueta: 'Instalar', alToque: () => this.abrirInstalar() })
    this.seguir = crearBoton(this, { x: 0, y: 0, icono: 'icono_jugar', etiqueta: 'Seguir', alToque: () => this.continuar() })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.arrastrando && p.isDown && this.mover(this.arrastrando, p.x))
    this.input.on('pointerup', () => this.soltar())
    this.input.on('pointerupoutside', () => this.soltar())
    this.input.keyboard?.on('keydown-ESC', () => this.continuar())

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('pausa', 'pausaFijar', 'pausaContinuar', 'pausaCambiarJugadora', 'pausaAlbum', 'pausaAlternar'))
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.acomodar())
    alCambiarEscala(this, () => this.acomodar())
    this.refrescar()

    agregarGanchos({
      pausa: () => ({
        abierta: true,
        deslizadores: this.deslizadores.map((d) => ({ nombre: d.nombre, x: d.x, y: Math.round(d.riel.y), w: d.w, valor: this.valorDe(d.nombre) })),
        pantalla: this.pantalla ? this.pantalla.getBounds() : null,
        botones: { calidad: this.calidad.getBounds(), peque: this.peque.getBounds(), suaves: this.suaves.getBounds(), mejoras: this.mejoras.getBounds(), cambiar: this.cambiar.getBounds(), creditos: this.creditos.getBounds(), album: this.album.getBounds(), seguir: this.seguir.getBounds() },
        ajustes: { ...aj() },
      }),
      pausaFijar: ((nombre: 'noche' | 'musica' | 'efectos', v: number) => {
        const d = this.deslizadores.find((x) => x.nombre === nombre)
        if (d) this.poner(d, v)
      }) as never,
      pausaContinuar: (() => this.continuar()) as never,
      pausaAlbum: (() => this.abrirAlbum()) as never,
      pausaAlternar: ((k: 'efectosSuaves' | 'mejorasF7') => this.alternar(k)) as never,
      pausaCambiarJugadora: (() => this.cambiarJugadora()) as never,
    })
  }

  override update(_t: number, ms: number): void {
    this.mundo.sonidoEnPausa(Math.min(0.05, ms / 1000))
  }

  private valorDe(n: Deslizador['nombre']): number {
    return this.mundo.partida.ajustes[n]
  }

  private deslizador(nombre: Deslizador['nombre'], icono: string, max: () => number, etiqueta: string): void {
    const ic = this.add.image(0, 0, K.ui(icono)).setOrigin(0, 0.5)
    const riel = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 100, 10, 6, 6, 6, 6).setOrigin(0, 0.5)
    const relleno = this.add.nineslice(0, 0, K.ui('boton'), 0, 10, 6, 8, 8, 6, 6).setOrigin(0, 0.5).setTint(0xffd27a)
    const perilla = this.add.nineslice(0, 0, K.ui('boton'), 0, 14, 22, 8, 8, 6, 6).setOrigin(0.5, 0.5)
    const zona = this.add.zone(0, 0, 10, 10).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
    const valor = texto(this, 0, 0, etiqueta, 'fuente_ui', 1, { origen: [0, 0.5] })
    const d: Deslizador = { rotulo: etiqueta, nombre, icono: ic, riel, relleno, perilla, zona, valor, max, x: 0, w: 100 }
    zona.on('pointerdown', (p: Phaser.Input.Pointer) => {
      Bloqueo.tomar(p.id)
      this.arrastrando = d
      this.mover(d, p.x)
    })
    this.deslizadores.push(d)
  }

  private mover(d: Deslizador, px: number): void {
    const t = Phaser.Math.Clamp((px - d.x) / d.w, 0, 1)
    this.poner(d, t * (d.nombre === 'noche' ? OSCURIDAD.nocheMax : 1))
  }

  private poner(d: Deslizador, v: number): void {
    const a = this.mundo.partida.ajustes
    const nuevo = Phaser.Math.Clamp(Math.round(v * 100) / 100, 0, d.max())
    a[d.nombre] = nuevo
    this.refrescar()
  }

  private soltar(): void {
    if (!this.arrastrando) return
    this.arrastrando = null
    this.mundo.guardar()
  }

  private alternarCalidad(): void {
    const a = this.mundo.partida.ajustes
    a.calidad = a.calidad === 'alta' ? 'baja' : 'alta'
    this.mundo.guardar()
    this.refrescar()
  }

  private alternarPeque(): void {
    const a = this.mundo.partida.ajustes
    a.modoPeque = !a.modoPeque
    a.noche = Math.min(a.noche, nocheMaxima(a.modoPeque))
    this.mundo.guardar()
    this.refrescar()
  }

  private refrescar(): void {
    const a = this.mundo.partida.ajustes
    for (const d of this.deslizadores) {
      const total = d.nombre === 'noche' ? OSCURIDAD.nocheMax : 1
      const t = Phaser.Math.Clamp(a[d.nombre] / total, 0, 1)
      const tope = Phaser.Math.Clamp(d.max() / total, 0, 1)
      d.relleno.setSize(Math.max(8, Math.round(d.w * t)), 6)
      d.perilla.setPosition(Math.round(d.x + d.w * t), d.riel.y)
      const pct = `${Math.round((a[d.nombre] / total) * 100)}%`
      d.valor.setText(this.nombresVisibles ? `${d.rotulo} ${pct}` : pct)
      // en modo peque el riel se corta en el tope para que se vea hasta dónde llega
      d.riel.setAlpha(1)
      d.icono.setAlpha(tope < 1 ? 0.85 : 1)
    }
    this.calidad.setEtiqueta(`Calidad ${a.calidad === 'alta' ? 'alta' : 'baja'}`)
    this.peque.setEtiqueta(a.modoPeque ? 'Modo peque: sí' : 'Modo peque: no')
    this.suaves.setEtiqueta(a.efectosSuaves ? 'Efectos suaves: sí' : 'Efectos suaves: no')
    this.mejoras.setEtiqueta(a.mejorasF7 ? 'Mejoras F7: sí' : 'Mejoras F7: no')
  }

  private acomodar(): void {
    if (!this.velo || !this.panel.active) return
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    const esc = e.zoom >= 3 ? 1 : 2
    this.nombresVisibles = esc === 1
    this.refrescar()
    this.velo.setSize(w, h)
    const fila = Math.max(toqueMinimo(e, this.mundo.partida.ajustes.modoPeque), 26)
    const pw = Math.min(w - 16, Math.max(280, Math.floor(w * 0.62)))
    const fila1 = [this.calidad, this.peque, this.suaves, this.mejoras]
    const fila2 = [this.album, this.cambiar, this.creditos, ...(this.pantalla ? [this.pantalla] : []), this.seguir]
    // cada fila de botones se reparte en tantas líneas como haga falta para entrar en el panel
    const repartir = (lista: Boton[]): Boton[][] => {
      const lineas: Boton[][] = [[]]
      let ancho = 0
      for (const btn of lista) {
        const l = lineas[lineas.length - 1]!
        if (l.length > 0 && ancho + 8 + btn.ancho > pw - 20) {
          lineas.push([btn])
          ancho = btn.ancho
        } else {
          l.push(btn)
          ancho += (l.length > 1 ? 8 : 0) + btn.ancho
        }
      }
      return lineas
    }
    const l1 = repartir(fila1)
    const l2 = repartir(fila2)
    this.titulo.setScale(esc)
    const altoLinea = (l: Boton[]) => Math.max(fila, ...l.map((b) => b.alto)) + 6
    const alto = 10 + this.titulo.displayHeight + 8 + fila * 3 + 6 + [...l1, ...l2].reduce((t, l) => t + altoLinea(l), 0) + 12
    const ph = Math.min(h - 8, alto)
    const px = Math.round((w - pw) / 2)
    const py = Math.round((h - ph) / 2)
    this.panel.setPosition(px, py).setSize(pw, ph)
    this.titulo.setPosition(Math.round(w / 2), py + 10)
    let y = py + 10 + this.titulo.displayHeight + 8
    for (const d of this.deslizadores) {
      const cy = y + fila / 2
      d.valor.setScale(esc)
      const etiquetaW = (this.nombresVisibles ? 84 : 32) * esc
      d.icono.setPosition(px + 14, cy)
      d.valor.setPosition(px + pw - 14 - d.valor.displayWidth, cy)
      d.x = px + 14 + 24 + 10
      d.w = Math.max(40, pw - 14 * 2 - 24 - 10 - etiquetaW - 10)
      d.riel.setPosition(d.x, cy).setSize(d.w, 10)
      d.zona.setPosition(d.x - 10, cy).setSize(d.w + 20, fila)
      d.perilla.setY(cy)
      d.relleno.setPosition(d.x, cy)
      y += fila
    }
    y += 6
    const centrar = (b: Boton, cx: number, cy: number) => b.setPosition(Math.round(cx), Math.round(cy))
    for (const linea of [...l1, ...l2]) {
      const tot = linea.reduce((t, b) => t + b.ancho, 0) + 8 * (linea.length - 1)
      let cx = px + (pw - tot) / 2
      const al = altoLinea(linea)
      for (const b of linea) {
        centrar(b, cx + b.ancho / 2, y + al / 2)
        cx += b.ancho + 8
      }
      y += al
    }
    this.refrescar()
  }

  private alternar(k: 'efectosSuaves' | 'mejorasF7'): void {
    const a = this.mundo.partida.ajustes
    a[k] = !a[k]
    this.refrescar()
  }

  private continuar(): void {
    if (this.cerrando) return
    this.cerrando = true
    this.mundo.guardar()
    this.scene.resume('Mundo')
    this.game.events.emit('pausa-cerrada')
    this.scene.stop()
  }

  private cambiarJugadora(): void {
    if (this.cerrando) return
    this.cerrando = true
    this.mundo.guardar()
    this.game.registry.remove('partida')
    this.game.registry.remove('heroeId')
    this.scene.stop('Mundo')
    this.scene.start('SeleccionJugador')
  }

  private abrirInstalar(): void {
    this.scene.pause()
    this.scene.launch('Instalar', { desde: 'Pausa' })
    this.scene.bringToTop('Instalar')
  }

  private abrirAlbum(): void {
    this.scene.pause()
    this.scene.launch('Album', { desde: 'Pausa' })
    this.scene.bringToTop('Album')
  }

  private abrirCreditos(): void {
    this.scene.pause()
    this.scene.launch('Creditos', { desde: 'Pausa' })
    this.scene.bringToTop('Creditos')
  }
}

