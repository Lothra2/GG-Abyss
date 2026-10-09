import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { entidadesDeTipo, llaveEntidad, parsearMapa, type Deco, type MapaJuego, type Zona } from '../kit/mapa'
import { encolarAudio, encolarBotin, encolarCriaturas, encolarMundoBase, encolarObjetosMundo, encolarParticulas, encolarPersonaje, encolarPostales } from '../kit/cargador'
import { crearAnimsPersonaje } from '../kit/anims'
import { crearAnimsAtlas } from '../kit/atlas'
import { params } from '../config/params'
import { PROF, FPS_MIN_CALIDAD, FPS_VENTANA_S } from '../config/juego'
import { Grilla } from '../logic/grilla'
import { zonaEn, nocheMaxima } from '../logic/zonas'
import { descubrirZona, resumen, type EstadoDescubrimiento } from '../logic/descubrimiento'
import { fx } from '../logic/azar'
import { partidaNueva, type Partida } from '../logic/guardado'
import { MundoVista } from '../game/MundoVista'
import { Decos, type Luz } from '../game/Decos'
import { Heroina } from '../game/Heroina'
import { ThorSprite } from '../game/ThorSprite'
import { Criaturas } from '../game/Criaturas'
import { Camara } from '../game/Camara'
import { Entrada } from '../game/Entrada'
import { Sonido } from '../game/Sonido'
import { alCambiarEscala } from '../game/Pantalla'
import { Atmosfera } from '../fx/Atmosfera'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

export interface EventoDescubrimiento {
  zona: Zona
  secreto: boolean
}

/** Objetos del manifest que el mapa usa sin ponerlos en la capa `objetos` */
const EXTRAS_MUNDO = ['portal_azul', 'portal_rojo', 'aviso_jefe']

const NOMBRES_GANCHOS = [
  'pos', 'teleport', 'irAPostal', 'postales', 'conteos', 'zona', 'tocar', 'estado', 'atmosfera', 'camara', 'mapa', 'ajustes', 'soltarCamara',
  'cuervosVolando', 'hud', 'puntoCerca', 'thor', 'sonido', 'avanzar', 'tecla', 'marca', 'cuervos', 'decoInfo', 'aguaFrame', 'thorInfo', 'hudLayout', 'noEsperar',
]

/**
 * El Bosque GG: suelo, agua, decorados, criaturas, la heroína con Thor y toda la atmósfera.
 * La interfaz (contadores, banners) vive en la escena HUD, que corre encima.
 */
export class Mundo extends Phaser.Scene {
  private m!: Manifest
  mapa!: MapaJuego
  grilla!: Grilla
  partida!: Partida
  descub!: EstadoDescubrimiento
  private vista!: MundoVista
  decos!: Decos
  heroina!: Heroina
  private thor!: ThorSprite
  private criaturas!: Criaturas
  camara!: Camara
  atmosfera!: Atmosfera
  sonido!: Sonido
  private entrada!: Entrada
  private marca!: Phaser.GameObjects.Sprite
  private t = 0
  private tViento = 0
  private rafagaEn = 8
  private rafagaResta = 0
  private cuentaFps: number[] = []
  private tFps = 0
  private ultimoDescubrimiento: EventoDescubrimiento | null = null
  private listo = false
  private barra?: { marco: Phaser.GameObjects.NineSlice; relleno: Phaser.GameObjects.NineSlice }

  constructor() {
    super('Mundo')
  }

  /* ---------- carga ---------- */

  preload(): void {
    const m = manifestDe(this)
    this.m = m
    const id = (this.registry.get('heroeId') as string | undefined) ?? params.heroe ?? 'sophie'
    this.registry.set('heroeId', id)

    // barra de carga con el marco y el relleno del kit
    const marco = this.add.nineslice(0, 0, K.ui('barra_marco'), undefined, 240, 14, 6, 6, 6, 6)
    const relleno = this.add.nineslice(0, 0, K.ui('barra_xp'), undefined, 1, 6, 1, 1, 1, 1).setOrigin(0, 0.5)
    let avance = 0
    const dibujar = () => {
      if (!marco.active || !relleno.active) return
      const w = Math.min(240, Math.max(96, this.scale.width - 40))
      marco.setSize(w, 14).setPosition(this.scale.width / 2, this.scale.height / 2)
      relleno.setPosition(this.scale.width / 2 - w / 2 + 3, this.scale.height / 2)
      relleno.setSize(Math.max(1, Math.round((w - 6) * avance)), 6)
    }
    alCambiarEscala(this, dibujar)
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => {
      avance = v
      dibujar()
    })
    this.barra = { marco, relleno }

    encolarMundoBase(this, m)
    encolarCriaturas(this, m)
    encolarParticulas(this, m)
    encolarBotin(this, m, true)
    encolarPostales(this, m)
    encolarPersonaje(this, m, id)
    encolarPersonaje(this, m, 'thor')
    encolarAudio(this, m)
  }

  /* ---------- armado ---------- */

  /** Segunda carga: ya con el mapa en la mano se sabe qué objetos del manifest hacen falta */
  create(): void {
    const mapa = parsearMapa(this.cache.json.get(K.mapa))
    encolarObjetosMundo(this, this.m, new Set([...mapa.decos.map((d) => d.sprite), ...EXTRAS_MUNDO]))
    if (this.load.list.size === 0) return this.armar()
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.armar())
    this.load.start()
  }

  private armar(): void {
    this.barra?.marco.destroy()
    this.barra?.relleno.destroy()
    this.barra = undefined
    const m = this.m
    const id = this.registry.get('heroeId') as string
    this.partida = (this.registry.get('partida') as Partida | undefined) ?? partidaNueva(id)
    this.registry.set('partida', this.partida)
    this.descub = { zonas: this.partida.zonas, secretos: this.partida.secretos }
    this.mapa = parsearMapa(this.cache.json.get(K.mapa))
    this.grilla = new Grilla(this.mapa)

    crearAnimsPersonaje(this, m, id)
    crearAnimsPersonaje(this, m, 'thor')
    crearAnimsAtlas(this, 'atlas_mundo', 'atlas_mundo_datos')
    if (!this.anims.exists('marca_destino')) {
      this.anims.create({ key: 'marca_destino', frames: this.anims.generateFrameNumbers(K.ui('marca_destino'), { start: 0, end: 3 }), frameRate: 8, repeat: -1 })
    }

    const ancho = this.mapa.ancho * this.mapa.cuadro
    const alto = this.mapa.alto * this.mapa.cuadro

    this.vista = new MundoVista(this, m, this.mapa)

    // decorados del mapa más el portal de llegada, que es una entidad
    const decos: Deco[] = [...this.mapa.decos]
    for (const p of entidadesDeTipo(this.mapa, 'portal_llegada')) decos.push({ sprite: p.props.color === 'rojo' ? 'portal_rojo' : 'portal_azul', x: p.x, y: p.y })
    this.decos = new Decos(this, m, decos)
    this.decos.alDespertar = () => this.sonido.efecto('magia', { volumen: 0.3, detune: -200 })

    this.cofres()

    const inicio = entidadesDeTipo(this.mapa, 'jugador_inicio')[0]!
    const thorIni = entidadesDeTipo(this.mapa, 'thor_inicio')[0]
    const pos = this.partida.posicion.x > 0 ? this.partida.posicion : { x: inicio.x, y: inicio.y }
    this.sonido = new Sonido(this, () => ({ musica: this.partida.ajustes.musica, efectos: this.partida.ajustes.efectos }))
    this.heroina = new Heroina(this, m, this.grilla, id, pos.x, pos.y, { paso: (x, y, corre) => this.alPaso(x, y, corre) })
    this.thor = new ThorSprite(this, m, this.grilla, thorIni?.x ?? pos.x + 30, thorIni?.y ?? pos.y + 10)
    this.criaturas = new Criaturas(this, m, this.mapa.entidades)

    this.camara = new Camara(this, ancho, alto)
    this.camara.centrarEn(pos.x, pos.y)

    this.atmosfera = new Atmosfera(this, m, this.mapa, () => this.partida.ajustes, this.scale.width, this.scale.height)
    this.atmosfera.alCambiarZona = (z) => this.alCambiarZona(z)
    this.atmosfera.saltarA(zonaEn(this.mapa.zonas, pos.x, pos.y))

    this.marca = this.add.sprite(0, 0, K.ui('marca_destino'), 0).setDepth(PROF.SOMBRAS + 1).setVisible(false)
    this.marca.play('marca_destino')

    this.entrada = new Entrada(this, {
      tocarMundo: (x, y) => this.criaturas.tocar(x, y),
      irA: (x, y) => this.irA(x, y),
      seguir: (x, y) => {
        if (this.heroina.seguirPunto(x, y)) this.ponerMarca(x, y)
      },
      direccion: (dx, dy) => {
        this.heroina.caminarDir(dx, dy)
        if (dx !== 0 || dy !== 0) this.marca.setVisible(false)
      },
    })

    alCambiarEscala(this, () => this.atmosfera.redimensionar(this.scale.width, this.scale.height))

    if (!params.postal) {
      this.scene.launch('HUD')
      this.scene.bringToTop('HUD')
    }
    this.instalarGanchos()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cerrar())
    this.cameras.main.fadeIn(350, 7, 10, 18)
    this.listo = true
  }

  private cerrar(): void {
    this.listo = false
    quitarGanchos(...NOMBRES_GANCHOS)
    this.entrada.destroy()
    this.sonido.detener()
    this.decos.destruir()
    this.atmosfera.destruir()
    if (this.scene.isActive('HUD')) this.scene.stop('HUD')
  }

  /** Cofres del mapa: cerrados y con su brillo. Abrirlos es de F1b. */
  private cofres(): void {
    for (const c of entidadesDeTipo(this.mapa, 'cofre')) {
      if (c.props.tras_jefe === true) continue
      const nivel = String(c.props.nivel ?? 'madera')
      const anim = `cofre_${nivel}_quieto`
      if (!this.anims.exists(anim)) continue
      const s = this.add.sprite(c.x, c.y, 'atlas_mundo', `${anim}_0`).setOrigin(0.5, 0.9).setDepth(PROF.OBJETOS + c.y)
      s.play({ key: anim, startFrame: Math.floor(Math.abs(Math.sin(c.x * 12.9898 + c.y * 78.233)) * 8) % 8 })
      s.setData('llave', llaveEntidad(c))
    }
  }

  /* ---------- órdenes ---------- */

  private irA(x: number, y: number): void {
    if (this.heroina.irA(x, y)) {
      const d = this.heroina.destinoActual
      if (d) this.ponerMarca(d.x, d.y)
    } else this.sonido.efecto('error', { volumen: 0.5 })
  }

  private ponerMarca(x: number, y: number): void {
    this.marca.setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(1)
  }

  private alPaso(x: number, y: number, corriendo: boolean): void {
    this.sonido.paso(corriendo)
    if (this.superficie(x, y) === 'seca') this.atmosfera.particulas.polvo(x, y)
  }

  /** Mira el pixel del suelo bajo los pies: pasto, o tierra y piedra (que levantan polvo) */
  private superficie(x: number, y: number): 'pasto' | 'seca' | 'agua' {
    const suelo = this.m.mundo.suelo
    for (let i = 0; i < suelo.length; i++) {
      const s = suelo[i]!
      if (x >= s.x && y >= s.y && x < s.x + this.m.mundo.trozo && y < s.y + this.m.mundo.trozo) {
        const c = this.textures.getPixel(Math.floor(x - s.x), Math.floor(y - s.y), K.suelo(i))
        if (!c || c.alpha < 128) return 'agua'
        if (c.green > c.red + 10 && c.green >= c.blue) return 'pasto'
        if (c.blue > c.red + 30 && c.blue > c.green) return 'agua'
        return 'seca'
      }
    }
    return 'pasto'
  }

  private alCambiarZona(z: Zona | null): void {
    this.sonido.fijarZona(z)
    if (!z) return
    const r = descubrirZona(this.descub, z)
    if (!r.nueva) return
    this.partida.zonas = this.descub.zonas
    this.partida.secretos = this.descub.secretos
    const ev: EventoDescubrimiento = { zona: z, secreto: r.secreto }
    this.ultimoDescubrimiento = ev
    // los sonidos nuevos del taller si ya existen, y si no los parecidos
    const a = this.m.audio
    const nombre = r.secreto ? (a.secreto ? 'secreto' : 'legendario') : a.descubrir ? 'descubrir' : 'magia'
    this.sonido.efecto(nombre, { volumen: 0.55 })
    this.game.events.emit('descubrimiento', ev)
  }

  get resumenDescubrimiento() {
    return resumen(this.descub, this.mapa)
  }

  /* ---------- cuadro ---------- */

  override update(_time: number, deltaMs: number): void {
    if (!this.listo) return
    const dt = Math.min(0.05, deltaMs / 1000)
    this.paso(dt, true, dt)
  }

  /**
   * Un paso del mundo. `completo` también dibuja la atmósfera, las partículas y el sonido; sin él solo
   * se mueven la heroína, Thor y la cámara (las pruebas lo usan para avanzar rápido).
   * `dtVisual` es el tiempo acumulado desde el último paso completo.
   */
  private paso(dt: number, completo: boolean, dtVisual: number): void {
    this.t += dt

    // el viento: un reloj para todos los árboles, con una ráfaga cada 8 a 15 s que dura 2 s
    let rafagaNueva = false
    this.rafagaEn -= dt
    if (this.rafagaEn <= 0) {
      this.rafagaEn = 8 + fx().next() * 7
      this.rafagaResta = 2
      rafagaNueva = true
    }
    const rafaga = this.rafagaResta > 0
    if (rafaga) this.rafagaResta -= dt
    this.tViento += dt * (rafaga ? 1.6 : 1)

    this.entrada.update()
    this.heroina.update(dt)
    this.thor.registrarRastro(this.heroina)
    this.thor.update(dt, this.heroina)
    this.camara.seguir(dt, this.heroina.x, this.heroina.y - 12, this.heroina.vx, this.heroina.vy)
    if (!completo) return

    const vista = this.camara.vista
    if (rafagaNueva) this.atmosfera.particulas.hojasDeRafaga(vista)
    this.vista.update(this.t, vista)

    const luces: Luz[] = []
    const heroe = { x: this.heroina.x, y: this.heroina.y }
    this.decos.actualizar(this.tViento, dtVisual, vista, heroe, luces)
    this.criaturas.update(this.t, dtVisual, heroe, vista, this.atmosfera.oscuridadFinal)
    this.atmosfera.update(this.t, dtVisual, vista, heroe, luces, (fn) => this.decos.forEachActivo(fn), rafaga)
    this.sonido.update(dtVisual)

    // la marca de destino se va cuando llega
    if (this.marca.visible) {
      const d = this.heroina.destinoActual
      if (!d) {
        this.marca.setAlpha(this.marca.alpha - dtVisual * 4)
        if (this.marca.alpha <= 0) this.marca.setVisible(false)
      }
    }

    this.vigilarFps(dtVisual)
  }

  /** Si el promedio de fps de los primeros 10 s baja de 45, pasa sola a calidad baja (no en modo prueba) */
  private vigilarFps(dt: number): void {
    if (params.test || this.partida.ajustes.calidad === 'baja' || this.tFps > FPS_VENTANA_S) return
    this.tFps += dt
    this.cuentaFps.push(1 / Math.max(dt, 0.001))
    if (this.tFps >= FPS_VENTANA_S) {
      const prom = this.cuentaFps.reduce((a, b) => a + b, 0) / this.cuentaFps.length
      if (prom < FPS_MIN_CALIDAD) {
        this.partida.ajustes.calidad = 'baja'
        this.game.events.emit('calidad-baja-automatica')
      }
      this.cuentaFps = []
    }
  }

  /* ---------- pruebas ---------- */

  private instalarGanchos(): void {
    const irAPostal = (nombre: string): boolean => {
      const p = this.mapa.postales.find((x) => x.nombre === nombre)
      if (!p) return false
      // la heroína se para un poco abajo y al lado del centro, así no tapa lo que la postal quiere mostrar
      const pt = this.grilla.puntoLibreCerca(p.x + 36, p.y + 56, 8, 320) ?? this.grilla.puntoLibreCerca(p.x, p.y, 8, 320) ?? { x: p.x, y: p.y }
      this.camara.manual = true
      this.heroina.teleport(pt.x, pt.y)
      const tp = this.grilla.puntoLibreCerca(pt.x - 30, pt.y + 6, 6, 120) ?? pt
      this.thor.teleport(tp.x, tp.y)
      this.camara.centrarEn(p.x, p.y)
      this.atmosfera.saltarA(zonaEn(this.mapa.zonas, pt.x, pt.y))
      this.decos.actualizar(this.tViento, 0.016, this.camara.vista, { x: pt.x, y: pt.y }, [], true)
      return true
    }
    agregarGanchos({
      pos: () => ({ x: Math.round(this.heroina.x * 10) / 10, y: Math.round(this.heroina.y * 10) / 10 }),
      teleport: ((x: number, y: number) => {
        const p = this.grilla.puntoLibreCerca(x, y, 8, 320) ?? { x, y }
        this.heroina.teleport(p.x, p.y)
        const tp = this.grilla.puntoLibreCerca(p.x - 30, p.y + 6, 6, 120) ?? p
        this.thor.teleport(tp.x, tp.y)
        this.camara.manual = false
        this.camara.centrarEn(p.x, p.y)
        this.atmosfera.saltarA(zonaEn(this.mapa.zonas, p.x, p.y))
      }) as never,
      irAPostal: irAPostal as never,
      soltarCamara: (() => { this.camara.manual = false }) as never,
      postales: () => this.mapa.postales.map((p) => p.nombre),
      conteos: () => ({
        decos: this.decos.cantidadActivos,
        decosTotal: this.decos.total,
        particulas: this.atmosfera.particulas.cantidad,
        luces: this.atmosfera.info().luces,
        enemigos: 0,
        aguaVisible: this.vista.aguaVisible(),
        cuervosVolando: this.criaturas.volando,
      }),
      zona: () => this.atmosfera.zona?.nombre ?? null,
      tocar: ((x: number, y: number) => this.entrada.tocar(x, y)) as never,
      estado: () => JSON.parse(JSON.stringify(this.partida)),
      atmosfera: () => this.atmosfera.info(),
      camara: () => ({ x: this.camara.cx, y: this.camara.cy, ancho: this.camara.ancho, alto: this.camara.alto, manual: this.camara.manual }),
      mapa: () => ({
        ancho: this.mapa.ancho * this.mapa.cuadro,
        alto: this.mapa.alto * this.mapa.cuadro,
        inicio: entidadesDeTipo(this.mapa, 'jugador_inicio')[0],
        zonas: this.mapa.zonas.map((z) => ({ nombre: z.nombre, x: z.x, y: z.y, w: z.w, h: z.h, secreto: z.secreto, descubrir: z.descubrir, oscuridad: z.oscuridad })),
        postales: this.mapa.postales,
        resumen: this.resumenDescubrimiento,
      }),
      ajustes: ((cambios?: Partial<Partida['ajustes']>) => {
        if (cambios) {
          Object.assign(this.partida.ajustes, cambios)
          this.partida.ajustes.noche = Math.min(this.partida.ajustes.noche, nocheMaxima(this.partida.ajustes.modoPeque))
        }
        return { ...this.partida.ajustes }
      }) as never,
      cuervosVolando: () => this.criaturas.volando,
      hud: () => ({ ultimo: this.ultimoDescubrimiento?.zona.nombre ?? null, resumen: this.resumenDescubrimiento }),
      puntoCerca: ((x: number, y: number) => this.grilla.puntoLibreCerca(x, y, 8, 320)) as never,
      thor: () => ({ x: this.thor.x, y: this.thor.y, estado: this.thor.estado }),
      sonido: () => this.sonido.estado(),
      // avanza el mundo sin esperar al reloj de pantalla (para pruebas deterministas)
      avanzar: ((segundos: number, parar = false) => {
        const n = Math.round(segundos * 60)
        const dt = 1 / 60
        for (let i = 0; i < n; i++) {
          const completo = i % 3 === 2 || i === n - 1
          this.paso(dt, completo, completo ? dt * 3 : dt)
          if (parar && i > 5 && !this.heroina.tieneOrden && !this.heroina.moviendo) {
            this.paso(dt, true, dt)
            break
          }
        }
      }) as never,
      tecla: ((dx: number, dy: number) => this.heroina.caminarDir(dx, dy)) as never,
      marca: () => ({ visible: this.marca.visible, x: this.marca.x, y: this.marca.y }),
      cuervos: () => this.criaturas.cuervos.map((c) => ({ x: c.hx, y: c.hy, st: c.st })),
      decoInfo: ((nombre: string) => this.decos.activosDe(nombre).map((a) => ({ x: a.d.x, y: a.d.y, anim: a.anim, alfa: Math.round(a.alfa * 100) / 100, angulo: Math.round(a.s.angle * 10) / 10, despierto: a.despierto, frame: a.fr }))) as never,
      aguaFrame: () => this.vista.frameAgua,
      thorInfo: () => ({ x: this.thor.x, y: this.thor.y, estado: this.thor.estado }),
      hudLayout: () => (this.scene.isActive('HUD') ? (this.scene.get('HUD') as unknown as { layout(): unknown }).layout() : null),
      noEsperar: () => this.listo,
    })
  }
}
