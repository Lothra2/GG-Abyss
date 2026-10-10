import Phaser from 'phaser'
import { DIRECCIONES, vectorDe } from '../logic/direccion'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { uiImagenes } from '../kit/manifest'
import { params } from '../config/params'
import { HUD as MARGENES } from '../config/juego'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { HudCombate } from '../game/ui/HudCombate'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo, EventoDescubrimiento } from './Mundo'

/**
 * Interfaz encima del mundo. Todo se ancla a los bordes de la vista lógica, nada flota en coordenadas fijas.
 * Contadores de zonas, secretos y oro arriba a la izquierda, el botón de pausa arriba a la derecha, el banner de
 * descubrimiento, el panel de los carteles y el medidor de fps del modo prueba.
 */
export class HUD extends Phaser.Scene {
  private mundo!: Mundo
  private panel!: Phaser.GameObjects.NineSlice
  private iconoZonas!: Phaser.GameObjects.Image
  private iconoSecretos!: Phaser.GameObjects.Image
  private iconoOro!: Phaser.GameObjects.Image
  private txtZonas!: Phaser.GameObjects.BitmapText
  private txtSecretos!: Phaser.GameObjects.BitmapText
  private txtOro!: Phaser.GameObjects.BitmapText
  private banner!: Phaser.GameObjects.Container
  private bDescubriste!: Phaser.GameObjects.BitmapText
  private bNombre!: Phaser.GameObjects.BitmapText
  private bNombrePlata!: Phaser.GameObjects.BitmapText
  private fps?: Phaser.GameObjects.BitmapText
  private pausa!: Boton
  private bolsa!: Boton
  private flecha: Phaser.GameObjects.Image | null = null
  /** el cine del jefe: franjas negras y el título grande */
  private franjaArriba!: Phaser.GameObjects.Rectangle
  private franjaAbajo!: Phaser.GameObjects.Rectangle
  private tituloCine!: Phaser.GameObjects.BitmapText
  private subCine!: Phaser.GameObjects.BitmapText
  private cineTitulo: string | null = null
  private alJefeEmpieza = () => this.ocultarBanner()
  /** un velo de color que se apaga (el enojo del jefe en rojo, su caída en blanco) */
  private velo!: Phaser.GameObjects.Rectangle
  private alDestello = (d: { color: number; alfa: number; ms: number }) => {
    this.velo.setFillStyle(d.color, 1).setAlpha(d.alfa).setVisible(true)
    this.tweens.killTweensOf(this.velo)
    this.tweens.add({ targets: this.velo, alpha: 0, duration: d.ms, ease: 'Quad.easeOut', onComplete: () => this.velo.setVisible(false) })
  }
  private tFlecha = 0
  private combate!: HudCombate
  private bNivel!: Phaser.GameObjects.BitmapText
  private bRescate!: Phaser.GameObjects.BitmapText
  private alNivel = (e: { nivel: number }) => this.mostrarNivel(e.nivel)
  private alRescate = (e: { mensaje: string }) => this.mostrarRescate(e.mensaje)
  private cartel: Phaser.GameObjects.Container | null = null
  private cartelTimer?: Phaser.Time.TimerEvent
  private cartelInfo: { icono: string; texto: string } | null = null
  private tween?: Phaser.Tweens.Tween
  private acumFps = 0
  private oroMostrado = -1
  private bannerInfo = { visible: false, titulo: '', nombre: '', secreto: false }
  private alDescubrir = (ev: EventoDescubrimiento) => this.mostrarBanner(ev)
  private alCartel = (c: { icono: string; texto: string }) => this.mostrarCartel(c.icono, c.texto)
  private alCalidad = () => this.avisoCalidad()
  private avisoCalidadImg?: Phaser.GameObjects.Image

  constructor() {
    super('HUD')
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    const m = manifestDe(this)
    const ui = uiImagenes(m)
    const k = (nuevo: string, viejo: string) => K.ui(ui[nuevo] ? nuevo : viejo)
    this.cartel = null
    this.oroMostrado = -1
    Bloqueo.instalar(this)

    this.panel = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 60, 60, 6, 6, 6, 6).setOrigin(0, 0).setAlpha(0.9)
    // tocar los contadores abre el álbum de postales
    this.panel.setInteractive({ useHandCursor: true })
    // durante la presentación el toque es para saltarla: no se toma
    this.panel.on('pointerdown', (p: Phaser.Input.Pointer) => !this.mundo.enPresentacion && Bloqueo.tomar(p.id))
    this.panel.on('pointerup', () => !this.mundo.enPresentacion && this.mundo.abrirAlbum())
    this.iconoZonas = this.add.image(0, 0, k('icono_zona', 'icono_mapa')).setOrigin(0, 0.5)
    this.iconoSecretos = this.add.image(0, 0, k('icono_secreto', 'icono_bolsa')).setOrigin(0, 0.5)
    this.iconoOro = this.add.image(0, 0, K.ui('icono_oro')).setOrigin(0, 0.5)
    this.txtZonas = texto(this, 0, 0, '0/0', 'fuente_ui', 1, { origen: [0, 0.5] })
    this.txtSecretos = texto(this, 0, 0, '0/0', 'fuente_ui', 1, { origen: [0, 0.5] })
    this.txtOro = texto(this, 0, 0, '0', 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a })

    this.bDescubriste = texto(this, 0, 0, 'Descubriste', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xffd27a })
    this.bNombre = texto(this, 0, 0, '', 'fuente_titulo', 1, { origen: [0.5, 0.5] })
    this.bNombrePlata = texto(this, 0, 0, '', 'fuente_titulo_plata', 1, { origen: [0.5, 0.5] })
    this.banner = this.add.container(0, 0, [this.bDescubriste, this.bNombre, this.bNombrePlata]).setAlpha(0)

    // pausa arriba a la derecha (Esc en el teclado)
    this.pausa = crearBoton(this, { x: 0, y: 0, w: 28, h: 28, icono: k('icono_pausa', 'icono_ajustes').replace('ui_', ''), origen: [1, 0], alToque: () => this.abrirPausa() })
    this.bolsa = crearBoton(this, { x: 0, y: 0, w: 28, h: 28, icono: 'icono_bolsa', origen: [1, 0], alToque: () => this.mundo.abrirInventario() })
    this.input.keyboard?.on('keydown-ESC', () => this.abrirPausa())

    this.combate = new HudCombate(this, this.mundo, K.atlas('iconos', '32'))
    this.franjaArriba = this.add.rectangle(0, 0, 10, 0, 0x000000, 1).setOrigin(0, 0).setDepth(240)
    this.franjaAbajo = this.add.rectangle(0, 0, 10, 0, 0x000000, 1).setOrigin(0, 1).setDepth(240)
    this.tituloCine = texto(this, 0, 0, '', 'fuente_titulo', 2, { origen: [0.5, 0.5] }).setDepth(260).setAlpha(0)
    this.subCine = texto(this, 0, 0, '', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xffe6b0 }).setDepth(260).setAlpha(0)
    this.game.events.on('jefe-empieza', this.alJefeEmpieza)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0, 0).setDepth(230).setVisible(false)
    this.game.events.on('destello', this.alDestello)
    // la flecha guía en el borde: aparece si pasa un rato sin progreso
    this.flecha = this.textures.exists(K.ui('flecha_guia')) ? this.add.image(0, 0, K.ui('flecha_guia'), 0).setVisible(false).setAlpha(0).setDepth(300) : null
    this.tFlecha = 0
    this.bNivel = texto(this, 0, 0, '', 'fuente_titulo', 2, { origen: [0.5, 0.5] }).setAlpha(0).setDepth(520)
    this.bRescate = texto(this, 0, 0, '', 'fuente_titulo', 2, { origen: [0.5, 0.5] }).setAlpha(0).setDepth(530)
    this.game.events.on('nivel-subido', this.alNivel)
    this.game.events.on('rescate', this.alRescate)

    if (params.test) this.fps = texto(this, 0, 0, '', 'fuente_ui', 1, { origen: [1, 0], tinte: 0x7affc8 })

    this.game.events.on('descubrimiento', this.alDescubrir)
    this.game.events.on('cartel', this.alCartel)
    this.game.events.on('calidad-baja-automatica', this.alCalidad)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('descubrimiento', this.alDescubrir)
      this.game.events.off('cartel', this.alCartel)
      this.game.events.off('calidad-baja-automatica', this.alCalidad)
      this.game.events.off('nivel-subido', this.alNivel)
      this.game.events.off('rescate', this.alRescate)
      this.game.events.off('jefe-empieza', this.alJefeEmpieza)
      this.game.events.off('destello', this.alDestello)
      this.combate.destruir()
      quitarGanchos('hudBanner', 'hudCartel', 'abrirPausa', 'hudCombate', 'hudOrbes', 'hudNivel', 'hudCine')
    })
    alCambiarEscala(this, () => this.acomodar())
    this.actualizarContadores()

    agregarGanchos({
      hudBanner: () => ({ ...this.bannerInfo, alpha: this.banner.alpha }),
      hudCartel: () => (this.cartel ? { abierto: true, ...this.cartelInfo } : { abierto: false }),
      abrirPausa: (() => this.abrirPausa()) as never,
      hudCombate: () => this.combate.layout(),
      hudOrbes: () => this.combate.niveles(),
      hudCine: () => ({ franjas: this.franjaArriba.visible ? this.franjaArriba.height : 0, titulo: this.tituloCine.text, alfa: Math.round(this.tituloCine.alpha * 100) / 100, banner: this.banner.alpha }),
      hudNivel: () => ({ texto: this.bNivel.text, alpha: this.bNivel.alpha, rescate: this.bRescate.text, alphaRescate: this.bRescate.alpha }),
    })
  }

  private abrirPausa(): void {
    if (this.scene.isActive('Pausa') || this.scene.isPaused('Mundo')) return
    this.mundo.alAbrirPausa()
    this.scene.pause('Mundo')
    this.scene.launch('Pausa')
    this.scene.bringToTop('Pausa')
  }

  /** Todo pegado a los bordes. Los textos usan escala 1 en pantallas de zoom alto y 2 en las chicas. */
  private acomodar(): void {
    const e = escalaDe(this.game)
    const w = this.scale.width
    const h = this.scale.height
    const mg = MARGENES.MARGEN
    const esc = e.zoom >= 3 ? 1 : 2
    for (const t of [this.txtZonas, this.txtSecretos, this.txtOro]) t.setScale(esc)
    const fila = Math.max(26, this.txtZonas.displayHeight + 8)
    const ancho = 24 + 6 + Math.max(this.txtZonas.displayWidth, this.txtSecretos.displayWidth, this.txtOro.displayWidth, 30 * esc) + 16
    this.panel.setPosition(mg, mg).setSize(ancho, fila * 3 + 8)
    const fy = (i: number) => mg + 4 + fila * (i + 0.5)
    this.iconoZonas.setPosition(mg + 8, fy(0))
    this.iconoSecretos.setPosition(mg + 8, fy(1))
    this.iconoOro.setPosition(mg + 8, fy(2))
    this.txtZonas.setPosition(mg + 8 + 24 + 6, fy(0))
    this.txtSecretos.setPosition(mg + 8 + 24 + 6, fy(1))
    this.txtOro.setPosition(mg + 8 + 24 + 6, fy(2))

    // banner centrado arriba
    const nombre = this.bannerInfo.nombre
    this.bDescubriste.setText(this.bannerInfo.secreto ? '¡Secreto!' : 'Descubriste').setScale(esc)
    const base = (this.bannerInfo.secreto ? this.bNombrePlata : this.bNombre).setText(nombre)
    base.setScale(1)
    const escNombre = escalaQueEntra(base.displayWidth, w - 24, 2)
    this.bNombre.setText(nombre).setScale(escNombre).setVisible(!this.bannerInfo.secreto)
    this.bNombrePlata.setText(nombre).setScale(escNombre).setVisible(this.bannerInfo.secreto)
    this.bDescubriste.setPosition(0, -this.bNombre.displayHeight / 2 - 4)
    this.bNombre.setPosition(0, 6)
    this.bNombrePlata.setPosition(0, 6)
    this.banner.setPosition(Math.round(w / 2), Math.round(h * 0.22))

    this.combate.acomodar()
    this.bNivel.setScale(esc + 1).setPosition(Math.round(w / 2), Math.round(h * 0.34))
    this.bRescate.setScale(esc + 1).setPosition(Math.round(w / 2), Math.round(h / 2))
    this.pausa.setPosition(w - mg, mg)
    this.bolsa.setPosition(w - mg, mg + this.pausa.alto + 4)
    const yBajo = mg + this.pausa.alto + this.bolsa.alto + 8
    this.fps?.setPosition(w - mg, yBajo)
    this.avisoCalidadImg?.setPosition(w - mg - 12, yBajo + 18)
    if (this.cartel) this.mostrarCartel(this.cartelInfo!.icono, this.cartelInfo!.texto)
  }

  private mostrarNivel(n: number): void {
    this.bNivel.setText(`¡Nivel ${n}!`).setAlpha(0)
    this.tweens.killTweensOf(this.bNivel)
    this.tweens.add({ targets: this.bNivel, alpha: 1, duration: 250, yoyo: false, onComplete: () => this.tweens.add({ targets: this.bNivel, alpha: 0, delay: 1800, duration: 700 }) })
  }

  private mostrarRescate(mensaje: string): void {
    this.bRescate.setText(mensaje).setAlpha(0)
    this.tweens.killTweensOf(this.bRescate)
    this.tweens.add({ targets: this.bRescate, alpha: 1, duration: 300, onComplete: () => this.tweens.add({ targets: this.bRescate, alpha: 0, delay: 1100, duration: 500 }) })
  }

  private actualizarContadores(): void {
    const r = this.mundo.resumenDescubrimiento
    this.txtZonas.setText(`${r.zonas}/${r.totalZonas}`)
    this.txtSecretos.setText(`${r.secretos}/${r.totalSecretos}`)
    this.txtOro.setText(String(this.mundo.partida.oro))
    this.oroMostrado = this.mundo.partida.oro
    this.acomodar()
  }

  /** Al empezar la pelea el banner de la zona se va: la entrada del jefe es la que manda */
  private ocultarBanner(): void {
    this.tween?.stop()
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 200 })
    this.bannerInfo.visible = false
  }

  /**
   * El cine del jefe: franjas negras arriba y abajo y el título grande (su nombre al entrar, el enojo en la fase 2
   * y la victoria al final), con lo que diga el director de la pelea.
   */
  private dibujarCine(): void {
    const pl = this.mundo.planoJefe
    const w = this.scale.width
    const h = this.scale.height
    this.velo.setSize(w, h)
    // durante el cine el HUD se aparta: se ve el jefe y su título, nada más
    const a = 1 - pl.franjas
    for (const o of [this.iconoZonas, this.iconoSecretos, this.iconoOro, this.txtZonas, this.txtSecretos, this.txtOro, this.pausa, this.bolsa]) o.setAlpha(a)
    this.panel.setAlpha(0.9 * a)
    this.combate.atenuar(a)
    const alto = Math.round(h * 0.085 * pl.franjas)
    this.franjaArriba.setPosition(0, 0).setSize(w, alto).setVisible(alto > 0)
    this.franjaAbajo.setPosition(0, h).setSize(w, alto).setVisible(alto > 0)
    if (pl.titulo !== this.cineTitulo) {
      this.cineTitulo = pl.titulo
      const nombre = this.mundo.jefe?.nombre ?? 'Minotauro del Bosque'
      const t = pl.titulo === 'nombre' ? [nombre, 'Guardián de Las Alturas', 0xffffff] : pl.titulo === 'enojo' ? ['¡Se enojó!', 'Mira bien sus avisos rojos', 0xff9a7a] : pl.titulo === 'victoria' ? ['¡Victoria!', `Venciste al ${nombre}`, 0xffffff] : ['', '', 0xffffff]
      this.tituloCine.setText(String(t[0])).setTint(Number(t[2]))
      this.subCine.setText(String(t[1]))
    }
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.tituloCine.setScale(esc + 1)
    if (this.tituloCine.displayWidth > w - 24) this.tituloCine.setScale(esc)
    this.subCine.setScale(esc)
    const y = Math.round(h * 0.34)
    this.tituloCine.setPosition(Math.round(w / 2), y).setAlpha(pl.tituloAlfa)
    this.subCine.setPosition(Math.round(w / 2), Math.round(y + this.tituloCine.displayHeight / 2 + 6 + this.subCine.displayHeight / 2)).setAlpha(pl.tituloAlfa)
  }

  private mostrarBanner(ev: EventoDescubrimiento): void {
    // durante el cine del jefe no se pisa el título
    if (this.mundo.planoJefe.momento) return
    this.bannerInfo = { visible: true, titulo: ev.secreto ? '¡Secreto!' : 'Descubriste', nombre: ev.nombre, secreto: ev.secreto }
    this.acomodar()
    this.actualizarContadores()
    this.tween?.stop()
    this.banner.setAlpha(0)
    const base = Math.round(this.scale.height * 0.22)
    this.banner.y = base - 6
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

  /** El panel de un cartel: el ícono grande y el texto. Un toque lo cierra. */
  private mostrarCartel(icono: string, textoCartel: string): void {
    this.cerrarCartelVisual()
    this.cartelInfo = { icono, texto: textoCartel }
    const e = escalaDe(this.game)
    const w = this.scale.width
    const h = this.scale.height
    const esc = e.zoom >= 3 ? 1 : 2
    const key = this.textures.exists(K.ui(`cartel_${icono}`)) ? K.ui(`cartel_${icono}`) : K.ui('icono_mapa')
    const escIcono = e.zoom >= 3 ? 2 : 3
    const lado = 24 * escIcono
    const anchoPanel = Math.min(w - 24, 460)
    const txt = texto(this, 0, 0, textoCartel, 'fuente_ui', esc, { origen: [0, 0.5], ancho: anchoPanel - lado - 40, alinear: 'izq' })
    const alto = Math.max(lado, txt.displayHeight) + 28
    const cont = this.add.container(Math.round(w / 2), Math.round(h - alto / 2 - 14)).setDepth(500)
    const fondo = this.add.nineslice(0, 0, K.ui('panel'), undefined, anchoPanel, alto, 12, 12, 12, 12)
    const ic = this.add.image(-anchoPanel / 2 + 16 + lado / 2, 0, key).setScale(escIcono)
    txt.setPosition(-anchoPanel / 2 + 28 + lado, 0)
    cont.add([fondo, ic, txt])
    // un toque en cualquier parte lo cierra
    const velo = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive().setDepth(499)
    velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    velo.on('pointerup', () => this.cerrarCartel())
    cont.setData('velo', velo)
    this.cartel = cont
    this.cartelTimer?.remove()
    this.cartelTimer = this.time.delayedCall(9000, () => this.cerrarCartel())
  }

  private cerrarCartelVisual(): void {
    ;(this.cartel?.getData('velo') as Phaser.GameObjects.Zone | undefined)?.destroy()
    this.cartel?.destroy()
    this.cartel = null
  }

  private cerrarCartel(): void {
    if (!this.cartel) return
    this.cartelTimer?.remove()
    this.cerrarCartelVisual()
    this.cartelInfo = null
    this.game.events.emit('cartel-cerrado')
  }

  /** Aviso de que el juego pasó solo a calidad baja: un ícono chico arriba a la derecha */
  private avisoCalidad(): void {
    this.avisoCalidadImg?.destroy()
    const ui = uiImagenes(manifestDe(this))
    this.avisoCalidadImg = this.add.image(0, 0, K.ui(ui.icono_calidad ? 'icono_calidad' : 'icono_ajustes')).setAlpha(0.8)
    this.acomodar()
  }

  /** Dónde quedó cada pieza, para comprobar que está pegada a los bordes */
  layout(): unknown {
    const r = (o: { getBounds(): Phaser.Geom.Rectangle }) => {
      const b = o.getBounds()
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
    }
    return {
      vista: { w: this.scale.width, h: this.scale.height },
      panel: r(this.panel),
      fps: this.fps ? r(this.fps) : null,
      pausa: r(this.pausa),
      bolsa: r(this.bolsa),
      flecha: this.flecha && this.flecha.visible ? { x: Math.round(this.flecha.x), y: Math.round(this.flecha.y), cuadro: Number(this.flecha.frame.name), alpha: this.flecha.alpha } : null,
      banner: { x: Math.round(this.banner.x), y: Math.round(this.banner.y) },
    }
  }

  /** La flecha guía: entra de a poco, late suave y se mece hacia donde apunta */
  private dibujarFlecha(dt: number): void {
    const fl = this.flecha
    if (!fl) return
    const f = this.mundo.flechaGuia
    this.tFlecha += dt
    if (!f) {
      fl.setAlpha(Math.max(0, fl.alpha - dt * 3))
      if (fl.alpha <= 0) fl.setVisible(false)
      return
    }
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    const v = vectorDe(DIRECCIONES[f.dir]!)
    const meneo = Math.round(Math.sin(this.tFlecha * 5) * 2 * esc)
    fl.setVisible(true).setFrame(f.dir).setScale(esc)
    fl.setPosition(Math.round(f.x + v.x * meneo), Math.round(f.y + v.y * meneo))
    fl.setAlpha(Math.min(0.75 + 0.25 * Math.sin(this.tFlecha * 3), fl.alpha + dt * 2))
  }

  override update(_t: number, deltaMs: number): void {
    this.combate.update(deltaMs / 1000)
    this.dibujarFlecha(deltaMs / 1000)
    this.dibujarCine()
    // durante la presentación el panel no atrapa toques: el toque la salta
    if (this.panel.input) this.panel.input.enabled = !this.mundo.enPresentacion
    if (this.mundo.partida && this.mundo.partida.oro !== this.oroMostrado) this.actualizarContadores()
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
