import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { entidadesDeTipo, parsearMapa, superficieEn, type Deco, type MapaJuego, type Zona } from '../kit/mapa'
import { encolarAudio, encolarBotin, encolarCriaturas, encolarFx, encolarMundoBase, encolarObjetosMundo, encolarParticulas, encolarPersonaje, encolarPostales } from '../kit/cargador'
import { crearAnimsPersonaje } from '../kit/anims'
import { crearAnimsAtlas } from '../kit/atlas'
import { params } from '../config/params'
import { PROF, FPS_MIN_CALIDAD, FPS_VENTANA_S } from '../config/juego'
import { AUTOGUARDADO_S } from '../config/balance'
import { Grilla } from '../logic/grilla'
import { zonaEn, nocheMaxima } from '../logic/zonas'
import { descubrirSecretoCofre, descubrirZona, resumen, type EstadoDescubrimiento } from '../logic/descubrimiento'
import { fx } from '../logic/azar'
import { statsDe } from '../logic/stats'
import { almacenDelNavegador, borrarPartida, cargarOCrear, guardarPartida, type Almacen, type Partida } from '../logic/guardado'
import { MundoVista } from '../game/MundoVista'
import { Decos, type Luz } from '../game/Decos'
import { Heroina } from '../game/Heroina'
import { ThorSprite } from '../game/ThorSprite'
import { Criaturas } from '../game/Criaturas'
import { Camara } from '../game/Camara'
import { Entrada } from '../game/Entrada'
import { Sonido } from '../game/Sonido'
import { Entidades, type Objetivo } from '../game/Entidades'
import { Enemigos, type EventosEnemigos } from '../game/Enemigos'
import { Proyectiles } from '../game/Proyectiles'
import { Numeros } from '../game/Numeros'
import { Combate } from '../game/Combate'
import { Presentacion } from '../game/Presentacion'
import { alCambiarEscala } from '../game/Pantalla'
import { Atmosfera } from '../fx/Atmosfera'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/** Un banner de descubrimiento: una zona nueva o un cofre secreto */
export interface EventoDescubrimiento {
  nombre: string
  secreto: boolean
  zona?: Zona
}

/** Los efectos que usa el combate: proyectiles en sus 8 direcciones, impactos, novas, auras y escudos */
function fxDeCombate(dirs: readonly string[]): string[] {
  const out = ['aura_nivel', 'curar', 'escudo_de_thor', 'grito_de_guerra', 'nova_fuego', 'tajo', 'impacto_flecha', 'impacto_naturaleza', 'impacto_arcano', 'impacto_fuego', 'impacto_sagrado', 'impacto_veneno', 'onda_pisoton']
  for (const base of ['proyectil_flecha', 'proyectil_naturaleza', 'proyectil_arcano', 'proyectil_fuego']) for (const d of dirs) out.push(`${base}_${d}`)
  return out
}

/** Objetos del manifest que el mapa usa sin ponerlos en la capa `objetos` */
const EXTRAS_MUNDO = ['portal_azul', 'portal_rojo', 'aviso_jefe']

const NOMBRES_GANCHOS = [
  'pos', 'teleport', 'irAPostal', 'postales', 'conteos', 'zona', 'tocar', 'estado', 'atmosfera', 'camara', 'mapa', 'ajustes', 'soltarCamara',
  'cuervosVolando', 'hud', 'objetivos', 'usarObjetivo', 'abrirCofre', 'guardarAhora', 'presentacion', 'saltarPresentacion', 'cartelAbierto', 'vaciarGuardado', 'forzarGuardar', 'puntoCerca', 'thor', 'sonido', 'ultimoPaso', 'superficieEn', 'avanzar', 'tecla', 'marca', 'cuervos', 'decoInfo', 'aguaFrame', 'thorInfo', 'hudLayout', 'noEsperar',
  'combate', 'danar', 'enemigos', 'tocarEnemigo', 'habilidad', 'soltarHabilidad', 'pocion', 'darXp', 'cercaDeEnemigo', 'matarEnemigos', 'curarTodo', 'ponerNivel', 'proyectilesActivos',
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
  private alm!: Almacen
  private entidades!: Entidades
  private presentacion: Presentacion | null = null
  enemigos!: Enemigos
  proyectiles!: Proyectiles
  numeros!: Numeros
  combate!: Combate
  private pendiente: Objetivo | null = null
  private cartelAbierto = false
  private autoguardadoEn = AUTOGUARDADO_S
  private tJugado = 0
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
    encolarBotin(this, m, { atlas: [], mundo: true, catalogo: false })
    encolarPostales(this, m)
    encolarPersonaje(this, m, id)
    encolarPersonaje(this, m, 'thor')
    encolarAudio(this, m)
  }

  /* ---------- armado ---------- */

  /** Segunda carga: ya con el mapa en la mano se sabe qué objetos del manifest hacen falta */
  create(): void {
    const mapa = (this.registry.get('mapa') as MapaJuego | undefined) ?? parsearMapa(this.cache.json.get(K.mapa))
    encolarObjetosMundo(this, this.m, new Set([...mapa.decos.map((d) => d.sprite), ...EXTRAS_MUNDO]))
    // enemigos del mapa y los efectos de combate
    for (const t of new Set(mapa.entidades.filter((e) => e.tipo === 'enemigo').map((e) => String(e.props.enemigo ?? '')))) encolarPersonaje(this, this.m, t)
    encolarFx(this, this.m, fxDeCombate(this.m.direcciones))
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
    this.alm = (this.registry.get('almacen') as Almacen | undefined) ?? almacenDelNavegador()
    this.registry.set('almacen', this.alm)
    this.partida = (this.registry.get('partida') as Partida | undefined) ?? cargarOCrear(this.alm, id).partida
    this.registry.set('partida', this.partida)
    this.descub = { zonas: this.partida.zonas, secretos: this.partida.secretos }
    this.tJugado = this.partida.tiempoJugado ?? 0
    this.mapa = (this.registry.get('mapa') as MapaJuego | undefined) ?? parsearMapa(this.cache.json.get(K.mapa))
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

    this.entidades = new Entidades(this, m, this.mapa, {
      partida: () => this.partida,
      sonido: this.sonido,
      alGuardar: (f) => this.alGuardarEnFogata(f),
      alSecreto: (llave, nombre) => this.alSecretoDeCofre(llave, nombre),
      alOro: (n, x, y) => this.alOro(n, x, y),
      alLeerCartel: (icono, texto) => this.alLeerCartel(icono, texto),
      alAbrazar: (x, y) => this.alAbrazar(x, y),
      alAbrirCofre: () => this.guardar(),
    })

    this.numeros = new Numeros(this)
    this.proyectiles = new Proyectiles(this, m, this.grilla)
    const evEnemigos: EventosEnemigos = {
      golpeCuerpo: (e, rango, radio) => {
        if (this.combate.caido) return
        if (Math.hypot(this.heroina.x - e.x, this.heroina.y - e.y) <= radio) this.combate.golpeDeEnemigo(rango)
      },
      disparar: (e) => {
        const h = this.heroina
        const oy = e.y - e.cuerpo.alto * 0.6
        this.proyectiles.lanzar({
          fx: e.cfg.proyectil ?? 'proyectil_flecha',
          impacto: e.cfg.impacto,
          x: e.x,
          y: oy,
          angulo: Math.atan2(h.y - 16 - oy, h.x - e.x),
          alcance: e.cfg.alcance + 80,
          blancos: () => [this.combate.cuerpo],
          alGolpear: () => this.combate.golpeDeEnemigo(e.cfg.dano),
        })
      },
      golpePesado: (e, rango, radio) => {
        if (this.combate.caido) return
        // el aviso es una elipse en el piso: ancha y baja
        const dx = (this.heroina.x - e.x) / radio
        const dy = (this.heroina.y - e.y) / (radio / 2)
        if (dx * dx + dy * dy <= 1) this.combate.golpeDeEnemigo(rango)
      },
      alMorir: (e) => this.combate.alMorirEnemigo(e),
      efecto: (n, x, y) => this.proyectiles.fxEn(n, x, y),
      sonido: (n, op) => this.sonido.efecto(n, op),
      sacudir: () => this.cameras.main.shake(160, 0.004),
      curo: (e) => this.numeros.mostrar(e.x, e.y - e.cuerpo.alto - 4, '+', 'verde'),
    }
    this.enemigos = new Enemigos(this, m, this.grilla, this.mapa.entidades, evEnemigos)
    this.combate = new Combate({
      escena: this,
      m,
      heroina: this.heroina,
      thor: this.thor,
      enemigos: this.enemigos,
      proyectiles: this.proyectiles,
      numeros: this.numeros,
      sonido: this.sonido,
      partida: () => this.partida,
      puntoRescate: () => {
        const f = this.entidades.fogatas.find((q) => q.id === this.partida.ultimaFogata)
        const ini = entidadesDeTipo(this.mapa, 'jugador_inicio')[0]!
        const base = f ? { x: f.e.x, y: f.e.y + 26 } : { x: ini.x, y: ini.y }
        return this.grilla.puntoLibreCerca(base.x, base.y, 8, 120) ?? base
      },
      alOro: (n, x, y) => this.alOro(n, x, y),
      bloquearEntrada: (v) => {
        if (v) this.entrada.pausada = true
        else if (!this.cartelAbierto && !this.presentacion?.activa) this.entrada.pausada = false
      },
      guardar: () => this.guardar(),
      centrarCamara: () => this.camara.centrarEn(this.heroina.x, this.heroina.y - 12),
    })

    this.entrada = new Entrada(this, {
      tocarMundo: (x, y) => this.tocarMundo(x, y),
      irA: (x, y) => {
        this.pendiente = null
        this.combate.soltarObjetivo()
        this.irA(x, y)
      },
      seguir: (x, y) => {
        this.pendiente = null
        this.combate.soltarObjetivo()
        if (this.heroina.seguirPunto(x, y)) this.ponerMarca(x, y)
      },
      direccion: (dx, dy) => {
        if (dx !== 0 || dy !== 0) {
          this.pendiente = null
          this.combate.soltarObjetivo()
        }
        this.heroina.caminarDir(dx, dy)
        if (dx !== 0 || dy !== 0) this.marca.setVisible(false)
      },
    })
    this.instalarTeclasCombate()
    this.game.events.on('cartel-cerrado', this.alCerrarCartel, this)
    this.game.events.on('pausa-cerrada', this.alCerrarPausa, this)

    // la música del título se va apagando al entrar al mundo
    const mt = this.registry.get('musicaTitulo') as Phaser.Sound.BaseSound | undefined
    if (mt) {
      this.tweens.add({ targets: mt, volume: 0, duration: 1500, onComplete: () => { mt.stop(); mt.destroy() } })
      this.registry.remove('musicaTitulo')
    }

    // la primera vez de cada perfil hay paneo de presentación (entrando directo con ?heroe= se salta, salvo ?presentacion=1)
    const hacerPresentacion = !this.partida.presentacionVista && (!params.heroe || params.presentacion) && !params.postal
    if (hacerPresentacion) {
      this.partida.presentacionVista = true
      this.presentacion = new Presentacion(this.mapa, this.camara, this.heroina, this.thor, this.decos, () => this.tViento, () => this.sonido.efecto('portal', { volumen: 0.7 }), () => this.alTerminarPresentacion())
      this.entrada.pausada = true
      this.input.once('pointerdown', () => this.presentacion?.saltar())
      this.input.keyboard?.once('keydown', () => this.presentacion?.saltar())
    }

    alCambiarEscala(this, () => this.atmosfera.redimensionar(this.scale.width, this.scale.height))

    if (!params.postal) {
      this.scene.launch('HUD')
      this.scene.bringToTop('HUD')
    }
    this.instalarGanchos()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cerrar())
    this.cameras.main.fadeIn(350, 7, 10, 18)
    this.listo = true
    if (hacerPresentacion) this.guardar()
  }

  /** PC: Q y E son las dos habilidades (W ya camina), 1 a 4 son las pociones del cinturón */
  private instalarTeclasCombate(): void {
    const kb = this.input.keyboard
    if (!kb) return
    const hab = (i: 0 | 1) => {
      kb.on(i === 0 ? 'keydown-Q' : 'keydown-E', () => !this.entrada.estaPausada && this.combate.presionarHabilidad(i))
      kb.on(i === 0 ? 'keyup-Q' : 'keyup-E', () => this.combate.soltarHabilidad(i))
    }
    hab(0)
    hab(1)
    ;(['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((k, i) => kb.on(`keydown-${k}`, () => !this.entrada.estaPausada && this.combate.pocion(i)))
  }

  private cerrar(): void {
    this.listo = false
    this.game.events.off('cartel-cerrado', this.alCerrarCartel, this)
    this.game.events.off('pausa-cerrada', this.alCerrarPausa, this)
    quitarGanchos(...NOMBRES_GANCHOS)
    this.entrada.destroy()
    this.combate.destruir()
    this.proyectiles.limpiar()
    this.enemigos.destruir()
    this.sonido.detener()
    this.decos.destruir()
    this.atmosfera.destruir()
    if (this.scene.isActive('HUD')) this.scene.stop('HUD')
  }

  /* ---------- usar cosas del mundo ---------- */

  /** Un toque: un cuervo, algo que se usa (cofre, cartel, fogata, Abuelo Roble) o el piso */
  private tocarMundo(x: number, y: number): boolean {
    if (this.combate.tocarEnemigo(x, y)) {
      this.pendiente = null
      return true
    }
    if (this.criaturas.tocar(x, y)) return true
    const o = this.entidades.golpe(x, y)
    if (!o) return false
    this.irAUsar(o)
    return true
  }

  /** La heroína camina hasta el objeto y lo usa. Si ya está al lado, lo usa de una. */
  private irAUsar(o: Objetivo): void {
    if (Math.hypot(this.heroina.x - o.x, this.heroina.y - o.y) <= o.radio) {
      this.heroina.parar()
      this.entidades.usar(o)
      return
    }
    const p = this.grilla.puntoLibreCerca(o.parada.x, o.parada.y, 8, 90) ?? o.parada
    if (this.heroina.irA(p.x, p.y)) {
      this.pendiente = o
      this.ponerMarca(p.x, p.y)
    } else this.sonido.efecto('error', { volumen: 0.5 })
  }

  private fxSobre(nombre: string, x: number, y: number, escala = 1): void {
    if (!this.textures.exists(K.fx(nombre)) || !this.anims.exists(K.animFx(nombre))) return
    const f = this.add.sprite(Math.round(x), Math.round(y), K.fx(nombre), 0).setOrigin(0.5, 0.9).setScale(escala).setDepth(PROF.OBJETOS + y + 800)
    f.play(K.animFx(nombre))
    f.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => f.destroy())
  }

  private alGuardarEnFogata(f: { id: string; nombre: string; x: number; y: number }): void {
    this.partida.ultimaFogata = f.id
    this.guardar()
    this.fxSobre('curar', this.heroina.x, this.heroina.y)
    this.entidades.flotante(this.heroina.x, this.heroina.y - 58, 'Guardado', 'icono_guardado', 0xbfe6ff)
    this.game.events.emit('guardado', f)
  }

  private alSecretoDeCofre(llave: string, nombre: string): void {
    if (!descubrirSecretoCofre(this.descub, llave)) return
    this.partida.secretos = this.descub.secretos
    const a = this.m.audio
    this.sonido.efecto(a.secreto ? 'secreto' : 'legendario', { volumen: 0.6 })
    const ev: EventoDescubrimiento = { nombre, secreto: true }
    this.ultimoDescubrimiento = ev
    this.game.events.emit('descubrimiento', ev)
  }

  private alOro(n: number, x: number, y: number): void {
    this.partida.oro += n
    this.entidades.flotante(x, y, `+${n}`)
  }

  private alLeerCartel(icono: string, texto: string): void {
    this.cartelAbierto = true
    this.entrada.pausada = true
    this.heroina.parar()
    this.game.events.emit('cartel', { icono, texto })
  }

  private alCerrarCartel(): void {
    this.cartelAbierto = false
    if (!this.presentacion?.activa) this.entrada.pausada = false
  }

  /** La pausa se abre: la heroína se queda quieta y el toque no camina */
  alAbrirPausa(): void {
    this.entrada.pausada = true
    this.heroina.parar()
  }

  /** Mientras el mundo está en pausa el sonido sigue vivo para que los deslizadores se oigan al moverlos */
  sonidoEnPausa(dt: number): void {
    if (this.listo) this.sonido.update(dt)
  }

  private alCerrarPausa(): void {
    if (!this.cartelAbierto && !this.presentacion?.activa) this.entrada.pausada = false
  }

  private alAbrazar(x: number, y: number): void {
    this.decos.sonreir(this.tViento, x, y - 40)
    this.fxSobre('curar', x, y - 40, 1)
    this.sonido.efecto('curar', { volumen: 0.6 })
    this.thor.menearCola()
  }

  private alTerminarPresentacion(): void {
    this.presentacion = null
    if (!this.cartelAbierto) this.entrada.pausada = false
    this.guardar()
  }

  /* ---------- guardado ---------- */

  /** Guarda la partida: posición, ajustes, lo descubierto, el tiempo jugado */
  guardar(): void {
    if (!this.listo) return
    this.partida.posicion = { x: Math.round(this.heroina.x), y: Math.round(this.heroina.y) }
    this.partida.zonas = this.descub.zonas
    this.partida.secretos = this.descub.secretos
    this.partida.tiempoJugado = Math.round(this.tJugado)
    guardarPartida(this.alm, this.partida)
    this.autoguardadoEn = AUTOGUARDADO_S
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
    const sup = superficieEn(this.mapa, x, y)
    this.sonido.paso(sup, corriendo)
    // tierra y piedra levantan polvito
    if (sup === 'tierra' || sup === 'piedra') this.atmosfera.particulas.polvo(x, y)
  }

  private alCambiarZona(z: Zona | null): void {
    this.sonido.fijarZona(z)
    if (!z) return
    const r = descubrirZona(this.descub, z)
    if (!r.nueva) return
    this.partida.zonas = this.descub.zonas
    this.partida.secretos = this.descub.secretos
    const ev: EventoDescubrimiento = { nombre: z.nombre, secreto: r.secreto, zona: z }
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
    this.presentacion?.update(dt)
    this.heroina.update(dt)
    if (!this.presentacion?.activa) {
      this.enemigos.update(dt, { heroe: { x: this.heroina.x, y: this.heroina.y, vivo: !this.combate.caido }, modoPeque: this.combate.modoPeque, dt })
      this.proyectiles.update(dt)
      this.combate.update(dt)
    }
    this.tJugado += dt
    // lo que la heroína iba a usar: cuando llega, lo usa
    const pend = this.pendiente
    if (pend) {
      if (Math.hypot(this.heroina.x - pend.x, this.heroina.y - pend.y) <= pend.radio) {
        this.pendiente = null
        this.heroina.parar()
        this.entidades.usar(pend)
      } else if (!this.heroina.tieneOrden) this.pendiente = null
    }
    this.thor.registrarRastro(this.heroina)
    this.thor.update(dt, this.heroina)
    this.camara.seguir(dt, this.heroina.x, this.heroina.y - 12, this.heroina.vx, this.heroina.vy)
    if (!completo) return

    const vista = this.camara.vista
    if (rafagaNueva) this.atmosfera.particulas.hojasDeRafaga(vista)
    this.vista.update(this.t, vista)

    const luces: Luz[] = []
    const heroe = { x: this.heroina.x, y: this.heroina.y }
    this.entidades.update(this.t, heroe, !this.presentacion?.activa)
    this.autoguardadoEn -= dtVisual
    if (this.autoguardadoEn <= 0) this.guardar()
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
      hud: () => ({ ultimo: this.ultimoDescubrimiento?.nombre ?? null, resumen: this.resumenDescubrimiento }),
      puntoCerca: ((x: number, y: number) => this.grilla.puntoLibreCerca(x, y, 8, 320)) as never,
      thor: () => ({ x: this.thor.x, y: this.thor.y, estado: this.thor.estado }),
      sonido: () => this.sonido.estado(),
      ultimoPaso: () => this.sonido.ultimoPasoSonado(),
      superficieEn: ((x: number, y: number) => superficieEn(this.mapa, x, y)) as never,
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
      decoInfo: ((nombre: string) => this.decos.activosDe(nombre).map((a) => ({ x: a.d.x, y: a.d.y, anim: a.anim, alfa: Math.round(a.alfa * 100) / 100, pasto: a.pasto, copa: !!a.c, despierto: a.despierto, frame: a.fr }))) as never,
      aguaFrame: () => this.vista.frameAgua,
      thorInfo: () => ({ x: this.thor.x, y: this.thor.y, estado: this.thor.estado }),
      hudLayout: () => (this.scene.isActive('HUD') ? (this.scene.get('HUD') as unknown as { layout(): unknown }).layout() : null),
      noEsperar: () => this.listo,
      combate: () => this.combate.info(),
      danar: ((n: number) => this.combate.danar(n)) as never,
      enemigos: () => this.enemigos.lista.map((e) => ({ id: e.id, tipo: e.tipo, x: Math.round(e.x), y: Math.round(e.y), vida: e.vida, vidaMax: e.vidaMax, vivo: e.vivo, estado: e.estado, elite: e.elite, nombre: e.nombre, casa: { x: e.ia.casaX, y: e.ia.casaY } })),
      tocarEnemigo: ((id: number) => {
        const e = this.enemigos.lista.find((q) => q.id === id)
        if (!e) return false
        this.combate.marcar(e)
        return true
      }) as never,
      habilidad: ((i: 0 | 1) => this.combate.presionarHabilidad(i)) as never,
      soltarHabilidad: ((i: 0 | 1) => this.combate.soltarHabilidad(i)) as never,
      pocion: ((i: number) => this.combate.pocion(i)) as never,
      darXp: ((n: number) => this.combate.darXp(n)) as never,
      ponerNivel: ((n: number) => {
        this.partida.nivel = n
        this.partida.xp = 0
        this.combate.stats = statsDe(this.combate.clase, n)
        this.partida.vida = this.combate.stats.vidaMax
        this.partida.mana = this.combate.stats.manaMax
      }) as never,
      curarTodo: () => {
        this.partida.vida = this.combate.stats.vidaMax
        this.partida.mana = this.combate.stats.manaMax
      },
      matarEnemigos: (() => {
        for (const e of this.enemigos.vivos) this.combate.golpear(e, 0, { dano: e.vida + 1, critico: false })
      }) as never,
      cercaDeEnemigo: ((tipo: string, indice = 0) => {
        const e = this.enemigos.lista.filter((q) => q.tipo === tipo && q.vivo)[indice]
        if (!e) return null
        const p = this.grilla.puntoLibreCerca(e.x - 70, e.y + 20, 8, 200) ?? { x: e.x - 70, y: e.y + 20 }
        return { x: p.x, y: p.y, enemigo: e.id }
      }) as never,
      proyectilesActivos: () => this.proyectiles.cantidad,
      objetivos: () => this.entidades.objetivos(),
      usarObjetivo: ((llave: string) => {
        const o = this.entidades.objetivos().find((q) => q.llave === llave)
        if (o) this.irAUsar(o)
        return !!o
      }) as never,
      abrirCofre: ((llave: string) => this.entidades.abrirCofre(llave)) as never,
      guardarAhora: () => this.guardar(),
      forzarGuardar: () => this.guardar(),
      presentacion: () => ({ activa: !!this.presentacion?.activa, vista: this.partida.presentacionVista }),
      saltarPresentacion: () => this.presentacion?.saltar(),
      cartelAbierto: () => this.cartelAbierto,
      vaciarGuardado: () => borrarPartida(this.alm, this.partida.id),
    })
  }
}
