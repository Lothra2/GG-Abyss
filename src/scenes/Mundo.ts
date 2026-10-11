import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { existeMundo, idMundo, manifestParaMundo, MUNDO_BOSQUE } from '../kit/mundos'
import { Mecanismos, OBJETOS_MECANISMOS } from '../game/Mecanismos'
import { ID_MERCADER, Mercader } from '../game/Mercader'
import { entidadesDeTipo, parsearMapa, superficieEn, type Deco, type MapaJuego, type Zona } from '../kit/mapa'
import { encolarAudio, encolarBotin, encolarCapas, encolarCriaturas, encolarFx, encolarMundoBase, encolarObjetosMundo, encolarParticulas, encolarPersonaje, encolarPostales } from '../kit/cargador'
import { aspectoDe, claveAspecto } from '../logic/aspecto'
import { puntosDeCaida, regionCaminable } from '../logic/lugar'
import { RADIO_HEROINA } from '../logic/camino'
import { familiaDeArma, NOMBRE_FAMILIA } from '../logic/armas'
import { crearAnimsPersonaje } from '../kit/anims'
import { crearAnimsAtlas } from '../kit/atlas'
import { params } from '../config/params'
import { CALIDAD, PROF, FPS_MIN_CALIDAD, FPS_VENTANA_S, SOMBRA_LARGA } from '../config/juego'
import { AUTOGUARDADO_S, BOTIN, ESCENA_JEFE, GUIA, JEFE, JEFE_CAMPANA, MUSICA_ESTADOS, OLFATO } from '../config/balance'
import { enAnillo } from '../logic/jefe'
import { Grilla } from '../logic/grilla'
import { zonaEn, nocheMaxima } from '../logic/zonas'
import { descubrirSecretoCofre, descubrirZona, resumen, type EstadoDescubrimiento } from '../logic/descubrimiento'
import { fx, juego } from '../logic/azar'
import { statsDe } from '../logic/stats'
import { itemDe, leerCatalogo, type Catalogo } from '../logic/catalogo'
import { tirarBotin, type Fuente, type Premio } from '../logic/botin'
import { equipar as equiparInv, desequipar as desequiparInv, moverEnBolsa, normalizar, recoger as recogerInv, sacar as sacarInv, type Inv, type OrigenInv } from '../logic/inventario'
import { nivelArmaduraThor } from '../logic/equipo'
import { almacenDelNavegador, borrarPartida, cambiarDeMundo, cargarOCrear, guardarPartida, type Almacen, type Partida } from '../logic/guardado'
import { MundoVista } from '../game/MundoVista'
import { Reflejos } from '../game/Reflejos'
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
import { Botin } from '../game/Botin'
import { texto } from '../game/Texto'
import { JefeSprite, type EventosJefe } from '../game/Jefe'
import { Impactos, type TipoImpacto } from '../logic/impacto'
import { Guia, ordenarPistas, type Pista } from '../logic/olfato'
import { elegirDestino, posicionFlecha, RelojGuia, type Destino } from '../logic/guia'
import { DirectorJefe, type Plano } from '../logic/escenaJefe'
import { veredicto } from '../logic/veredicto'
import { DirectorMusica, type EstadoMusica } from '../logic/musica'
import { demostracion, pasoCumplido, PASOS_TUTORIAL, type PasoTutorial } from '../logic/tutorial'
import { buscarCamino } from '../logic/camino'
import { Presentacion } from '../game/Presentacion'
import { alCambiarEscala } from '../game/Pantalla'
import { zoomCamara } from '../logic/escala'
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
const EXTRAS_MUNDO = ['portal_azul', 'portal_rojo', 'aviso_jefe', ...OBJETOS_MECANISMOS]

const NOMBRES_GANCHOS = [
  'pos', 'teleport', 'irAPostal', 'postales', 'conteos', 'zona', 'tocar', 'estado', 'atmosfera', 'camara', 'mapa', 'ajustes', 'soltarCamara',
  'cuervosVolando', 'hud', 'objetivos', 'usarObjetivo', 'abrirCofre', 'guardarAhora', 'presentacion', 'saltarPresentacion', 'cartelAbierto', 'vaciarGuardado', 'forzarGuardar', 'puntoCerca', 'thor', 'sonido', 'ultimoPaso', 'superficieEn', 'avanzar', 'tecla', 'marca', 'cuervos', 'decoInfo', 'aguaFrame', 'thorInfo', 'hudLayout', 'noEsperar',
  'combate', 'danar', 'enemigos', 'tocarEnemigo', 'habilidad', 'soltarHabilidad', 'pocion', 'darXp', 'cercaDeEnemigo', 'matarEnemigos', 'curarTodo', 'ponerNivel', 'proyectilesActivos',
  'jefe', 'danarJefe', 'entrarArena', 'irAlPortal', 'impactos', 'abrirTienda', 'darOro', 'olfatear', 'olfato', 'ponerHeroina', 'abrirAlbum', 'guia', 'forzarGuia', 'planoJefe', 'musicaEstado', 'tutorial', 'saltarTutorial', 'irAMundo', 'mundoActual', 'mecanismos', 'darBrasas', 'mercader', 'aspecto',
  'botin', 'inventario', 'soltarObjeto', 'soltarOro', 'darObjeto', 'llenarBolsa', 'equipar', 'desequipar', 'abrirInventario', 'desenterrar', 'premioDe', 'romper',
  'luzMundo',
]

/**
 * El Bosque GG: suelo, agua, decorados, criaturas, la heroína con Thor y toda la atmósfera.
 * La interfaz (contadores, banners) vive en la escena HUD, que corre encima.
 */
export class Mundo extends Phaser.Scene {
  private m!: Manifest
  /** El manifest del mundo de ahora (para las escenas de interfaz) */
  get manifest(): Manifest {
    return this.m
  }
  /** El id del mundo de ahora (mundo1, mundo2...) */
  get idMundo(): string {
    return idMundo(this.m.mundo)
  }
  mapa!: MapaJuego
  grilla!: Grilla
  partida!: Partida
  descub!: EstadoDescubrimiento
  private vista!: MundoVista
  decos!: Decos
  private reflejos!: Reflejos
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
  /** segundos desde que llegó a este mundo (el portal de vuelta espera un poco) */
  private tEnMundo = 0
  /** F8: el agua negra que se pisa al lado del vado: caer ahí la devuelve a la orilla (sin perder nada) */
  private peligroAgua = new Set<number>()
  /** F8: las brasas de la forja y lo que abren (solo en la Catedral) */
  mecanismos: Mecanismos | null = null
  mercader!: Mercader
  /** lo que se ve puesto ahora (para no rehacer las capas si no cambió) */
  private aspectoPuesto = ''
  /** la tienda mientras dura este mundo: lo que ya se compró del surtido y lo vendido (se puede recomprar) */
  tiendaSesion: { comprados: string[]; recompra: { id: string; precio: number }[] } = { comprados: [], recompra: [] }
  private destinoBrasa: { firma: string; p: { x: number; y: number } | null } = { firma: '', p: null }
  private ultimaSegura = { x: 0, y: 0 }
  /** F8: las raíces de la llamada que siguen en pie (se van solas, o todas juntas cuando termina la pelea) */
  private raicesActivas: { quitar: () => void }[] = []
  /** F8: a dónde va la oscuridad de la Catedral cuando el guardián se libera */
  private aclaradoMeta = 1
  private enAgua = 0
  caidasAgua = 0
  private alm!: Almacen
  private entidades!: Entidades
  private presentacion: Presentacion | null = null
  enemigos!: Enemigos
  proyectiles!: Proyectiles
  numeros!: Numeros
  combate!: Combate
  botin!: Botin
  jefe?: JefeSprite
  arena?: { x: number; y: number; radio: number }
  private anillo: (() => void)[] = []
  private portalJefe: { s: Phaser.GameObjects.Sprite; x: number; y: number; luz: string } | null = null
  private saliendoAContinuara = false
  /** Cruzando un portal: la partida ya puede estar en el otro mundo, el HUD no la lee */
  get saliendo(): boolean {
    return this.saliendoAContinuara
  }
  private piedrasEncendidas = 0
  private timersPiedras: Phaser.Time.TimerEvent[] = []
  private musicaVictoriaPuesta = false
  private victoriaVista = false
  cat!: Catalogo
  private pendiente: Objetivo | null = null
  private cartelAbierto = false
  private autoguardadoEn = AUTOGUARDADO_S
  private tJugado = 0
  private barra?: { marco: Phaser.GameObjects.NineSlice; relleno: Phaser.GameObjects.NineSlice }
  /** el peso de los golpes: el mundo se congela un instante (hitstop) */
  private impactos = new Impactos()
  private pausaGolpe = 0
  private olfatoRecarga = 0
  /** el cine de la pelea con el jefe: entrada, fase 2 y muerte */
  private director = new DirectorJefe()
  planoJefe: Plano = new DirectorJefe().tick(0)
  private bloqueoPorJefe = false
  /** F7: la música por estados y los detalles de ambiente por cercanía */
  private directorMusica = new DirectorMusica()
  private relojAudio = 0
  estadoMusica: EstadoMusica = 'explorar'
  private detalleAgua = 0
  private alertaHasta = new Map<number, number>()
  /** F7: la demostración que se está mostrando (la mano del HUD) y lo hecho desde que apareció */
  demoTutorial: { paso: PasoTutorial; x: number; y: number } | null = null
  private demoBase = { paso: '' as string, movido: 0, golpes: 0, cofres: 0 }
  private tutoMovido = 0
  private tutoGolpes = 0
  private tutoUltima: { x: number; y: number } | null = null
  /** la flecha guía: tiempo sin progreso, la firma del progreso y lo que hay que dibujar */
  private relojGuia = new RelojGuia(GUIA.esperaS)
  private firmaProgreso = ''
  flechaGuia: { x: number; y: number; dir: number; destino: Destino } | null = null
  private olfatoInfo: { llave: string; llego: boolean; huellas: number } | null = null
  private ultimoImpacto: { tipo: TipoImpacto; pausa: number; sacude: boolean } | null = null
  /** cámara lenta (la muerte del jefe): el mundo corre a `factor` durante `resta` segundos reales */
  private lento = { factor: 1, resta: 0 }

  constructor() {
    super('Mundo')
  }

  /* ---------- carga ---------- */

  preload(): void {
    const id = (this.registry.get('heroeId') as string | undefined) ?? params.heroe ?? 'sophie'
    this.registry.set('heroeId', id)
    // F8: la partida se lee antes de cargar para saber en qué mundo está; mientras esta escena corre, el manifest
    // del registro es el de ese mundo (y al cerrarse vuelve el de siempre, el del Bosque, para el título y la selección)
    const base = (this.registry.get('manifestBase') as Manifest | undefined) ?? manifestDe(this)
    this.registry.set('manifestBase', base)
    this.alm = (this.registry.get('almacen') as Almacen | undefined) ?? almacenDelNavegador()
    this.registry.set('almacen', this.alm)
    const partida = (this.registry.get('partida') as Partida | undefined) ?? cargarOCrear(this.alm, id).partida
    if (!existeMundo(base, partida.mundo)) cambiarDeMundo(partida, MUNDO_BOSQUE)
    this.registry.set('partida', partida)
    const m = manifestParaMundo(base, partida.mundo)
    this.registry.set('manifest', m)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.registry.set('manifest', base))
    this.m = m

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
    encolarBotin(this, m, { atlas: Object.keys(m.botin.atlas), tamanos: ['32'], mundo: true, catalogo: true })
    encolarPostales(this, m)
    encolarPersonaje(this, m, id)
    encolarPersonaje(this, m, 'thor')
    encolarAudio(this, m)
  }

  /* ---------- armado ---------- */

  /** Segunda carga: ya con el mapa en la mano se sabe qué objetos del manifest hacen falta */
  /** El mapa del mundo de ahora, ya leído (el del Bosque lo deja Boot en el registro) */
  private mapaDelMundo(): MapaJuego {
    const mundo = idMundo(this.m.mundo)
    const llave = mundo === MUNDO_BOSQUE ? 'mapa' : `mapa_${mundo}`
    let mapa = this.registry.get(llave) as MapaJuego | undefined
    if (!mapa) {
      mapa = parsearMapa(this.cache.json.get(K.mapaDe(mundo)))
      this.registry.set(llave, mapa)
    }
    return mapa
  }

  create(): void {
    const mapa = this.mapaDelMundo()
    encolarObjetosMundo(this, this.m, new Set([...mapa.decos.map((d) => d.sprite), ...EXTRAS_MUNDO]))
    // enemigos del mapa y los efectos de combate
    // lo que se rompe y las armaduras de Thor que se pueden conseguir en el Mundo 1
    encolarObjetosMundo(this, this.m, new Set(mapa.entidades.filter((e) => e.tipo === 'rompible').map((e) => String(e.props.objeto ?? 'caja'))))
    for (const n of [1, 2, 3]) encolarPersonaje(this, this.m, `thor_armadura${n}`, ['idle', 'walk', 'run', 'sit', 'wag', 'bite', 'howl', 'bark', 'pickup', 'dig', 'hurt'])
    for (const t of new Set(mapa.entidades.filter((e) => e.tipo === 'enemigo' || e.tipo === 'jefe').map((e) => String(e.props.enemigo ?? '')))) encolarPersonaje(this, this.m, t)
    // el mercader de las fogatas (si el kit lo trae)
    if (this.m.personajes[ID_MERCADER]) encolarPersonaje(this, this.m, ID_MERCADER)
    // lo que la heroína lleva puesto (capas de equipo de PixelForja): se ve desde el primer cuadro
    const idHeroe = this.registry.get('heroeId') as string
    const partidaCarga = this.registry.get('partida') as Partida | undefined
    if (partidaCarga && this.cache.json.exists(K.catalogo)) encolarCapas(this, this.m, idHeroe, aspectoDe(partidaCarga.equipo, leerCatalogo(this.cache.json.get(K.catalogo)), this.m.personajes[idHeroe]?.capas))
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
    this.partida = (this.registry.get('partida') as Partida | undefined) ?? cargarOCrear(this.alm, id).partida
    this.registry.set('partida', this.partida)
    this.cat = leerCatalogo(this.cache.json.get(K.catalogo))
    this.aspectoPuesto = ''
    normalizar(this.inv())
    this.descub = { zonas: this.partida.zonas, secretos: this.partida.secretos }
    this.tJugado = this.partida.tiempoJugado ?? 0
    this.tEnMundo = 0
    this.enAgua = 0
    this.caidasAgua = 0
    this.aclaradoMeta = 1
    this.raicesActivas = []
    this.destinoBrasa = { firma: '', p: null }
    // la escena es la misma al volver de Continuará o de otro mundo: el portal tiene que poder usarse otra vez, y lo
    // del jefe del mundo anterior no sigue acá (un mundo sin jefe no hereda el del Bosque)
    this.saliendoAContinuara = false
    this.jefe = undefined
    this.arena = undefined
    this.anillo = []
    this.portalJefe = null
    this.piedrasEncendidas = 0
    this.timersPiedras = []
    this.musicaVictoriaPuesta = false
    this.victoriaVista = false
    this.bloqueoPorJefe = false
    this.director = new DirectorJefe()
    this.planoJefe = this.director.tick(0)
    this.mapa = this.mapaDelMundo()
    this.peligroAgua = new Set(entidadesDeTipo(this.mapa, 'peligro_agua').map((e) => Math.floor(e.y / this.mapa.cuadro) * this.mapa.ancho + Math.floor(e.x / this.mapa.cuadro)))
    this.grilla = new Grilla(this.mapa)
    // el agua del vado se pisa pero tocar la otra orilla nunca la manda por ahí: caer es solo por despiste
    this.grilla.evitar(this.peligroAgua)

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
    const calidadIni = CALIDAD[this.partida.ajustes.calidad]
    this.decos = new Decos(this, m, decos, { sombra: this.mapa.bioma === 'bosque' ? SOMBRA_LARGA.afuera : SOMBRA_LARGA.adentro, agua: this.mapa })
    this.decos.sombrasLargas = calidadIni.sombrasLargas
    this.decos.reflejos = calidadIni.reflejos
    this.decos.alDespertar = () => this.sonido.efecto('magia', { volumen: 0.3, detune: -200 })

    const inicio = entidadesDeTipo(this.mapa, 'jugador_inicio')[0]!
    const thorIni = entidadesDeTipo(this.mapa, 'thor_inicio')[0]
    const pos = this.partida.posicion.x > 0 ? this.partida.posicion : { x: inicio.x, y: inicio.y }
    this.sonido = new Sonido(this, () => ({ musica: this.partida.ajustes.musica, efectos: this.partida.ajustes.efectos }))
    this.heroina = new Heroina(this, m, this.grilla, id, pos.x, pos.y, { paso: (x, y, corre) => this.alPaso(x, y, corre) })
    this.thor = new ThorSprite(this, m, this.grilla, thorIni?.x ?? pos.x + 30, thorIni?.y ?? pos.y + 10)
    this.criaturas = new Criaturas(this, m, this.mapa.entidades)

    this.reflejos = new Reflejos(this, this.mapa, [this.heroina.sprite, this.thor.sprite])
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
      alPremio: (f, x, y) => this.soltarPremio(f, x, y),
      alLeerCartel: (icono, texto) => this.alLeerCartel(icono, texto),
      alAbrazar: (x, y) => this.alAbrazar(x, y),
      alAbrirCofre: () => this.guardar(),
      // con el mercader al lado, la fogata solo guarda: la tienda es él
      alUsarFogata: () => !this.mercader?.hay && this.abrirTienda(),
    })
    this.mercader = new Mercader(this, m, this.grilla, this.entidades.fogatas.map((f) => ({ x: f.e.x, y: f.e.y })))
    this.tiendaSesion = { comprados: [], recompra: [] }

    this.numeros = new Numeros(this)
    this.proyectiles = new Proyectiles(this, m, this.grilla)
    const evEnemigos: EventosEnemigos = {
      golpeCuerpo: (e, rango, radio) => {
        if (this.combate.caido) return
        // la raicita distraída le tira zarpazos a Thor: a la heroína no le llega y a Thor no le hace nada
        if (e.distraida) {
          if (Math.hypot(this.thor.x - e.x, this.thor.y - e.y) < radio + 20) this.sonido.efecto('ladrido', { volumen: 0.25, rate: 1.2 })
          return
        }
        const d = Math.hypot(this.heroina.x - e.x, this.heroina.y - e.y)
        if (d <= radio) this.combate.golpeDeEnemigo(rango)
        // se salvó por poco: que se note que lo esquivó
        else if (d <= radio + 40 && this.mejoras) {
          this.textoFlotante(this.heroina.x, this.heroina.y - 48, '¡Esquivaste!', 0x8af0e0)
          this.atmosfera.particulas.estallido((e.x + this.heroina.x) / 2, (e.y + this.heroina.y) / 2, 'polvo', 3)
        }
      },
      mejoras: () => this.mejoras,
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
      sacudir: () => this.sacudir(160, 0.004),
      curo: (e) => this.numeros.mostrar(e.x, e.y - e.cuerpo.alto - 4, '+', 'verde'),
    }
    this.botin = new Botin({
      escena: this,
      cat: this.cat,
      heroina: this.heroina,
      thor: this.thor,
      sonido: this.sonido,
      recoger: (id) => {
        // el veredicto se calcula antes de guardarlo (contra lo que tenía puesto), y el hueco donde cae en la bolsa
        const v = veredicto(this.cat, this.partida.equipo, id, this.combate.clase)
        const fam = familiaDeArma(itemDe(this.cat, id))
        const ataqueNuevo = fam && fam !== this.combate.ataque.familia ? NOMBRE_FAMILIA[fam] : undefined
        const hueco = this.partida.bolsa.indexOf(null)
        const r = recogerInv(this.inv(), this.cat, id)
        if (r.ok) {
          this.alCambioInventario()
          if (v && r.donde === 'bolsa') this.game.events.emit('botin-recogido', { id, indice: hueco, veredicto: v, ataqueNuevo })
        }
        return r
      },
      alOro: (n, x, y) => this.alOro(n, x, y),
      juicio: (id) => veredicto(this.cat, this.partida.equipo, id, this.combate.clase)?.juicio ?? null,
    })
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
      cat: this.cat,
      alBotinEnemigo: (e) => this.soltarPremio({ tipo: 'enemigo', enemigo: e.tipo }, e.x, e.y),
      soltarObjeto: (id, x, y) => this.botin.soltar(id, x, y),
      bloquearEntrada: (v) => {
        if (v) this.entrada.pausada = true
        else if (!this.cartelAbierto && !this.presentacion?.activa) this.entrada.pausada = false
      },
      guardar: () => this.guardar(),
      centrarCamara: () => this.camara.centrarEn(this.heroina.x, this.heroina.y - 12),
      alImpacto: (t) => this.impacto(t),
      alFallar: (x, y) => this.alFallar(x, y),
      mejoras: () => this.mejoras,
    })

    this.crearJefe(evEnemigos)
    // F8: las brasas, los braseros, la forja y las compuertas de raíces (la Catedral)
    this.mecanismos = new Mecanismos({
      escena: this,
      m,
      mapa: this.mapa,
      grilla: this.grilla,
      brasas: () => this.partida.brasas,
      sonido: (n, op) => this.sonido.efecto(n, op),
      estallido: (x, y, llave, n) => this.atmosfera.particulas.estallido(x, y, llave, n),
      texto: (x, y, t, tinte) => this.textoFlotante(x, y, t, tinte),
      liberado: () => this.partida.jefeVencido,
      alRecoger: (id, n) => {
        this.relojGuia.progreso()
        this.game.events.emit('brasa-recogida', { id, n, total: this.mecanismos?.total ?? 3 })
        this.guardar()
      },
    })
    this.alCambioInventario(false)

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
      atacarHacia: (x, y) => {
        this.pendiente = null
        this.combate.atacarHacia(x, y)
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
    this.game.events.on('inventario-cerrado', this.alCerrarPausa, this)

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

    alCambiarEscala(this, (e) => {
      // el mundo se ve más cerca en pantallas grandes, el HUD no cambia (va en su escena)
      this.camara.zoom = params.postal ? 1 : zoomCamara(e.alto)
      const o = this.camara.origenPantalla
      this.atmosfera.redimensionar(this.camara.ancho, this.camara.alto, o.x, o.y, this.camara.zoom)
    })

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

  /* ---------- el minotauro ---------- */

  private crearJefe(evEnemigos: EventosEnemigos): void {
    const ent = entidadesDeTipo(this.mapa, 'jefe')[0]
    const are = entidadesDeTipo(this.mapa, 'arena_jefe')[0]
    const tipoJefe = String(ent?.props.enemigo ?? 'minotauro')
    if (!ent || !are || !this.m.personajes[tipoJefe] || !this.textures.exists(K.pers(tipoJefe, 'idle'))) return
    this.arena = { x: are.x, y: are.y, radio: Number(are.props.radio ?? JEFE.arenaRadio) }
    const ev: EventosJefe = {
      golpeCirculo: (x, y, radio, dano, elipse) => {
        if (this.combate.caido) return
        const dx = (this.heroina.x - x) / radio
        const dy = (this.heroina.y - y) / (elipse ? radio / 2 : radio)
        if (dx * dx + dy * dy <= 1) this.combate.golpeDeEnemigo(dano)
      },
      golpeCarga: (dano) => {
        if (!this.combate.caido) this.combate.golpeDeEnemigo(dano)
      },
      // F8: la onda de la campana: el anillo pega, cerca de la campana (o lejos del anillo) no
      golpeAnillo: (x, y, interior, exterior, dano) => {
        if (this.combate.caido) return
        if (enAnillo(this.heroina.x, this.heroina.y, x, y, interior, exterior)) this.combate.golpeDeEnemigo(dano)
        else if (this.mejoras && Math.hypot(this.heroina.x - x, this.heroina.y - y) <= interior) this.textoFlotante(this.heroina.x, this.heroina.y - 48, '¡A salvo!', 0x5ae0d0)
      },
      // F8: la llamada de raíces: salen del piso donde cayeron y tapan el paso un rato
      raices: (puntos, _radio, seg) => this.brotarRaices(puntos, seg),
      invocar: (n, x, y) => {
        const hay = this.enemigos.invocadasVivas
        for (let k = 0; k < Math.min(n, JEFE.grito.maxRatas - hay); k++) {
          const ang = (Math.PI * 2 * k) / Math.max(1, n) + 0.7
          const p = this.grilla.puntoLibreCerca(x + Math.cos(ang) * 46, y + Math.sin(ang) * 30, 8, 80) ?? { x, y }
          this.enemigos.invocar(this, this.m, this.grilla, 'rata', p.x, p.y, evEnemigos)
        }
      },
      efecto: (n, x, y, esc) => this.proyectiles.fxEn(n, x, y, esc ?? 1),
      sonido: (n, op) => this.sonido.efecto(n, op),
      sacudir: (fuerte) => this.sacudir(fuerte ? 280 : 150, fuerte ? 0.009 : 0.004),
      alFase2: () => {
        // se enoja: el mundo se congela un instante, destello rojo, onda y su nombre se vuelve enojo
        this.director.fase2()
        this.impacto('jefeFase2')
        this.game.events.emit('destello', { color: 0xc8281e, alfa: this.suave ? 0.1 : 0.32, ms: 380 })
        if (this.jefe) {
          this.proyectiles.fxEn('onda_pisoton', this.jefe.x, this.jefe.y, 3)
          this.proyectiles.fxEn('grito_de_guerra', this.jefe.x, this.jefe.y - JEFE.cuerpoAlto, 2)
        }
        this.game.events.emit('jefe-fase2')
      },
      alMorir: () => this.victoria(),
    }
    this.jefe = new JefeSprite(this, this.m, this.grilla, ent, this.arena, this.partida.jefeVida ?? (tipoJefe === 'guardian_campana' ? JEFE_CAMPANA.vida : JEFE.vida), ev)
    this.enemigos.adicionales.push(this.jefe)
    this.game.events.on('heroina-cae', this.alCaerEnArena, this)
    if (this.partida.jefeVencido) {
      this.jefe.quitar()
      this.victoria(true)
    }
  }

  /** F8: raíces que salen del piso por unos segundos (la llamada del Guardián de la Campana). No atrapan a la heroína. */
  private brotarRaices(puntos: { x: number; y: number }[], seg: number): void {
    const c = this.mapa.cuadro
    const key = K.obj('raices_cortina', 'idle')
    const def = this.m.mundo.objetos.raices_cortina
    for (const p of puntos) {
      const tx = Math.floor(p.x / c)
      const ty = Math.floor(p.y / c)
      // donde está parada no se cierra (no la encierra)
      const ella = Math.floor(this.heroina.x / c) === tx && Math.floor(this.heroina.y / c) === ty
      const liberar = ella ? null : this.grilla.bloquearRect(tx, ty, tx, ty)
      const s = def && this.textures.exists(key) ? this.add.sprite(Math.round(p.x), Math.round(p.y + 16), key, 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + p.y).setScale(1, 0.1) : null
      if (s) this.tweens.add({ targets: s, scaleY: 1, duration: 220, ease: 'Back.easeOut' })
      this.atmosfera.particulas.estallido(p.x, p.y, 'polvo', 6)
      let hecho = false
      const r = {
        quitar: () => {
          if (hecho) return
          hecho = true
          liberar?.()
          if (s) this.tweens.add({ targets: s, scaleY: 0.1, alpha: 0, duration: 300, onComplete: () => s.destroy() })
          this.raicesActivas = this.raicesActivas.filter((q) => q !== r)
        },
      }
      this.raicesActivas.push(r)
      this.time.delayedCall(seg * 1000, () => r.quitar())
    }
  }

  private actualizarJefe(dt: number): void {
    const j = this.jefe
    const a = this.arena
    if (!j || !a) return
    if (!j.peleando && j.vivo && !this.partida.jefeVencido && !this.combate.caido) {
      if (Math.hypot(this.heroina.x - a.x, this.heroina.y - a.y) <= a.radio - JEFE.entradaMargen) this.empezarJefe()
    }
    // si la heroína se va lejos de la arena (un salto de prueba, por ejemplo) la pelea se corta sin curar al jefe
    if (j.peleando && Math.hypot(this.heroina.x - a.x, this.heroina.y - a.y) > a.radio + 60) this.alCaerEnArena()
    j.update({ dt, heroeX: this.heroina.x, heroeY: this.heroina.y, heroeVivo: !this.combate.caido, modoPeque: this.combate.modoPeque, ratasVivas: this.enemigos.invocadasVivas })
    // al salir de la arena después de ganar, vuelve la música del bosque
    if (this.musicaVictoriaPuesta && Math.hypot(this.heroina.x - a.x, this.heroina.y - a.y) > a.radio + 40) {
      this.musicaVictoriaPuesta = false
      this.sonido.fijarMusica(null)
      this.sonido.fijarZona(this.atmosfera.zona)
    }
    // el portal: se entra caminando
    const p = this.portalJefe
    if (p && !this.saliendoAContinuara && !this.combate.caido && Math.hypot(this.heroina.x - p.x, this.heroina.y - (p.y - 16)) < 30) this.irAContinuara()
  }

  private empezarJefe(): void {
    if (!this.jefe || !this.arena || !this.jefe.empezar()) return
    this.director.empezar()
    this.sonido.fijarMusica('musica_jefe')
    this.cerrarAnillo()
    this.encenderPiedras()
    this.game.events.emit('jefe-empieza')
  }

  /** La salida de la arena se cierra mientras dura la pelea: un anillo de cuadros bloqueados justo afuera del borde */
  private cerrarAnillo(): void {
    const a = this.arena
    if (!a || this.anillo.length > 0) return
    const c = this.mapa.cuadro
    const r0 = a.radio
    const r1 = a.radio + 28
    for (let ty = Math.floor((a.y - r1) / c); ty <= Math.floor((a.y + r1) / c); ty++) {
      for (let tx = Math.floor((a.x - r1) / c); tx <= Math.floor((a.x + r1) / c); tx++) {
        const d = Math.hypot(tx * c + c / 2 - a.x, ty * c + c / 2 - a.y)
        if (d >= r0 && d <= r1) this.anillo.push(this.grilla.bloquearRect(tx, ty, tx, ty))
      }
    }
  }

  private soltarAnillo(): void {
    for (const f of this.anillo) f()
    this.anillo = []
  }

  /** Las piedras de la arena se encienden una tras otra */
  private encenderPiedras(rapido = false): void {
    const a = this.arena
    if (!a) return
    const pts = this.decos
      .posicionesDe('piedra_arena')
      .filter((p) => Math.hypot(p.x - a.x, p.y - a.y) <= a.radio + 80)
      .sort((p, q) => Math.atan2(p.y - a.y, p.x - a.x) - Math.atan2(q.y - a.y, q.x - a.x))
    this.piedrasEncendidas = 0
    pts.forEach((p, i) => {
      const f = () => {
        this.decos.fijarAnim('piedra_arena', p.x, p.y, 'encendida')
        this.piedrasEncendidas++
        if (!rapido) this.sonido.efecto('magia', { volumen: 0.35, rate: 0.8 + i * 0.05 })
      }
      if (rapido) f()
      else this.timersPiedras.push(this.time.delayedCall(i * 260, f))
    })
  }

  private apagarPiedras(): void {
    for (const t of this.timersPiedras) t.remove(false)
    this.timersPiedras = []
    const a = this.arena
    if (!a) return
    for (const p of this.decos.posicionesDe('piedra_arena')) if (Math.hypot(p.x - a.x, p.y - a.y) <= a.radio + 80) this.decos.fijarAnim('piedra_arena', p.x, p.y, 'idle')
    this.piedrasEncendidas = 0
  }

  /** Thor rescató a la heroína: el jefe se duerme sin curarse, la arena se abre y vuelve la música del bosque */
  private alCaerEnArena(): void {
    if (!this.jefe || !this.jefe.peleando) return
    this.director.cortar()
    this.jefe.reposar()
    this.enemigos.quitarInvocadas()
    for (const r of [...this.raicesActivas]) r.quitar()
    this.soltarAnillo()
    this.apagarPiedras()
    this.sonido.fijarMusica(null)
    this.sonido.fijarZona(this.atmosfera.zona)
    this.guardar()
  }

  /** Victoria: el jefe cae, suena la música de victoria, llueve oro, se abre el portal y aparece el cofre legendario */
  private victoria(yaVencido = false): void {
    if (this.victoriaVista) return
    this.victoriaVista = true
    const a = this.arena
    this.partida.jefeVencido = true
    this.partida.jefeVida = undefined
    this.soltarAnillo()
    this.enemigos.quitarInvocadas()
    for (const r of [...this.raicesActivas]) r.quitar()
    this.entidades.mostrarCofresTrasJefe()
    // F8: el Guardián de la Campana no muere: se libera de la corrupción y la catedral se ilumina
    if (this.jefe?.tipo === 'guardian_campana') this.liberarCatedral(!yaVencido)
    if (a && yaVencido) {
      this.encenderPiedras(true)
      this.abrirPortalJefe(false)
    }
    if (!yaVencido) {
      // el golpe final: congelado, destello, cámara lenta y el jefe se deshace en polvo
      this.director.morir()
      this.impacto('jefeMuerte')
      this.camaraLenta(ESCENA_JEFE.lenta.factor, ESCENA_JEFE.lenta.seg)
      this.game.events.emit('destello', { color: 0xfff4d2, alfa: this.suave ? 0.15 : 0.55, ms: 600 })
      this.jefe?.desvanecer((x, y) => this.atmosfera.particulas.estallido(x, y, 'polvo', 4))
      this.sonido.fijarMusica('musica_victoria')
      this.musicaVictoriaPuesta = true
      this.sonido.efecto('legendario', { volumen: 0.8 })
      if (a) {
        if (this.anims.exists('lluvia_de_oro')) {
          const lluvia = this.add.sprite(a.x, a.y + 20, 'atlas_mundo', 'lluvia_de_oro_0').setOrigin(0.5, 0.9).setScale(2).setDepth(PROF.OBJETOS + a.y + 900)
          lluvia.play('lluvia_de_oro')
          lluvia.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => lluvia.destroy())
        }
        BOTIN.lluviaDeOro.forEach((oro, i) => {
          const ang = (Math.PI * 2 * i) / BOTIN.lluviaDeOro.length
          this.time.delayedCall(250 + i * 140, () => this.botin.soltarOro(oro, a.x + Math.cos(ang) * 70, a.y + 30 + Math.sin(ang) * 40))
        })
      }
      this.time.delayedCall(2600, () => this.abrirPortalJefe(true))
      this.guardar()
    }
  }

  /** F8: la campana pasa a turquesa, se prenden los braseros que quedaban y la oscuridad baja de a poco */
  private liberarCatedral(animar: boolean): void {
    this.mecanismos?.liberar()
    if (!animar) {
      this.atmosfera.aclarado = 0.45
      this.aclaradoMeta = 0.45
      return
    }
    // baja de a poco con el reloj del juego (en `paso`), no con una animación en tiempo real
    this.aclaradoMeta = 0.45
    this.game.events.emit('destello', { color: 0x8affe8, alfa: this.suave ? 0.12 : 0.35, ms: 1200 })
  }

  private abrirPortalJefe(animar: boolean): void {
    if (this.portalJefe) return
    const ent = entidadesDeTipo(this.mapa, 'portal_jefe')[0]
    if (!ent) return
    const color = ent.props.color === 'rojo' ? 'portal_rojo' : 'portal_azul'
    const def = this.m.mundo.objetos[color]
    if (!def || !this.textures.exists(K.obj(color, 'girar'))) return
    for (const an of ['abrir', 'girar'] as const) {
      const key = `${color}_${an}`
      const info = def.anims[an]
      if (info && !this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(K.obj(color, an), { start: 0, end: info.cuadros - 1 }), frameRate: info.fps, repeat: info.loop ? -1 : 0 })
    }
    const s = this.add.sprite(ent.x, ent.y, K.obj(color, animar ? 'abrir' : 'girar'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + ent.y)
    if (animar) {
      s.play(`${color}_abrir`)
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.play(`${color}_girar`))
      this.sonido.efecto('portal', { volumen: 0.8 })
    } else s.play(`${color}_girar`)
    this.portalJefe = { s, x: ent.x, y: ent.y, luz: def.luz?.color ?? '#6cb4ff' }
  }

  /** El portal del jefe baja al mundo siguiente si el kit lo trae; si no, "Continuará" */
  irAContinuara(): void {
    const p = this.portalJefe
    if (!p || this.saliendoAContinuara) return
    const destino = String(entidadesDeTipo(this.mapa, 'portal_jefe')[0]?.props.destino ?? '')
    const base = (this.registry.get('manifestBase') as Manifest | undefined) ?? this.m
    if (destino && existeMundo(base, destino)) return this.irAMundo(destino, { x: Math.round(p.x), y: Math.round(p.y + 110) }, false)
    this.saliendoAContinuara = true
    this.entrada.pausada = true
    this.heroina.parar()
    this.partida.posicion = { x: Math.round(p.x), y: Math.round(p.y + 110) }
    this.guardar()
    this.sonido.efecto('portal', { volumen: 0.8 })
    this.cameras.main.fadeOut(700, 5, 6, 12)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Continuara'))
  }

  /**
   * F8: cruzar a otro mundo. Primero se guarda el mundo de ahora como siempre, después la partida cambia de mundo
   * (lo de este queda esperando, con la posición `volverEn` para no caer adentro del portal al regresar) y se guarda
   * de nuevo. La escena Bajada muestra el nombre del mundo y vuelve a arrancar el Mundo, ya en el otro.
   */
  irAMundo(destino: string, volverEn: { x: number; y: number }, subir: boolean): void {
    if (this.saliendoAContinuara) return
    this.saliendoAContinuara = true
    this.entrada.pausada = true
    this.heroina.parar()
    this.guardar()
    cambiarDeMundo(this.partida, destino, volverEn)
    guardarPartida(this.alm, this.partida)
    // desde acá nada vuelve a guardar en este mundo (la escena se va)
    this.listo = false
    const base = (this.registry.get('manifestBase') as Manifest | undefined) ?? this.m
    const nombre = manifestParaMundo(base, destino).mundo.nombre
    this.sonido.efecto('portal', { volumen: 0.8 })
    this.cameras.main.fadeOut(700, 5, 6, 12)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Bajada', { nombre, subir }))
  }

  /**
   * F8: el peligro seguro de la nave. Fuera de las losas del vado el agua negra se pisa, pero es agua: salpica, Thor
   * ladra y en un momento ella vuelve a la última losa firme. No hay daño ni se pierde nada (PLAN.md F8, la nave).
   */
  private revisarAgua(dt: number): void {
    if (this.peligroAgua.size === 0) return
    const h = this.heroina
    const c = this.mapa.cuadro
    if (this.enAgua > 0) {
      this.enAgua -= dt
      if (this.enAgua <= 0) {
        h.teleport(this.ultimaSegura.x, this.ultimaSegura.y)
        this.thor.teleport(this.ultimaSegura.x - 18, this.ultimaSegura.y + 6)
        this.atmosfera.particulas.estallido(h.x, h.y, 'gota', 6)
        this.entrada.pausada = false
      }
      return
    }
    const i = Math.floor(h.y / c) * this.mapa.ancho + Math.floor(h.x / c)
    if (!this.peligroAgua.has(i)) {
      if (!this.combate.caido) this.ultimaSegura = { x: h.x, y: h.y }
      return
    }
    this.caidasAgua++
    this.enAgua = 0.7
    h.parar()
    this.entrada.pausada = true
    this.sonido.efecto('paso_agua_1', { volumen: 1, rate: 0.7 })
    this.sonido.efecto('ladrido', { volumen: 0.5 })
    this.atmosfera.particulas.estallido(h.x, h.y, 'gota', 10)
    this.textoFlotante(h.x, h.y - 48, '¡Al agua no!', 0x8ad8ff)
  }

  /** F8: el portal de llegada de un mundo de abajo lleva de vuelta al de arriba (con un momento de gracia al llegar) */
  private revisarPortalVolver(): void {
    if (this.saliendoAContinuara || this.combate.caido || this.enPresentacion || this.tEnMundo < 1.5) return
    for (const e of entidadesDeTipo(this.mapa, 'portal_volver')) {
      if (Math.hypot(this.heroina.x - e.x, this.heroina.y - e.y) > 26) continue
      const destino = String(e.props.destino ?? MUNDO_BOSQUE)
      const base = (this.registry.get('manifestBase') as Manifest | undefined) ?? this.m
      if (existeMundo(base, destino)) this.irAMundo(destino, { x: Math.round(e.x + 4 * this.mapa.cuadro), y: Math.round(e.y + this.mapa.cuadro) }, true)
      return
    }
  }

  /* ---------- botín e inventario ---------- */

  /** El inventario de la partida: son los mismos arreglos, lo que se hace aquí queda guardado */
  inv(): Inv {
    const p = this.partida
    return { equipo: p.equipo, bolsa: p.bolsa, cinturon: p.cinturon }
  }

  /** Sortea el botín de una fuente y lo deja en el piso */
  private soltarPremio(f: Fuente, x: number, y: number): void {
    const premio: Premio = tirarBotin(juego(), this.cat, { nivelHeroe: this.partida.nivel, clase: this.combate.clase, idHeroe: this.heroina.id }, f)
    // cada cosa cae en un lugar donde la heroína se puede parar (nunca encima del cofre ni contra una pared)
    // y del mismo lado que la heroína: si está cerca se mira desde ella, si no desde donde salió el botín
    const h = this.heroina
    const desde = Math.hypot(h.x - x, h.y - y) < 260 ? { x: h.x, y: h.y } : { x, y: y + 24 }
    const region = regionCaminable(this.grilla, desde.x, desde.y, 8)
    const c = this.mapa.cuadro
    const pts = puntosDeCaida(premio.objetos.length + 1, x, y, (px, py) => this.grilla.circuloLibre(px, py, RADIO_HEROINA + 2) && region.has(this.grilla.idx(Math.floor(px / c), Math.floor(py / c))))
    premio.objetos.forEach((id, i) => this.botin.soltar(id, pts[i]!.x, pts[i]!.y))
    const o = pts[premio.objetos.length]!
    this.botin.soltarOro(premio.oro, o.x, o.y)
  }

  /** Se equipó, se sacó o se recogió algo: stats, armadura de Thor y velocidad se ponen al día */
  alCambioInventario(guardar = true): void {
    this.combate.refrescarStats()
    this.actualizarAspecto()
    this.thor.ponerArmadura(nivelArmaduraThor(this.cat, this.partida.equipo))
    this.heroina.velMult = 1 + this.combate.stats.velocidadPct / 100
    this.botin?.refrescarMarcas()
    if (guardar) this.guardar()
  }

  /**
   * Lo que se ve puesto en la heroína. Si una capa todavía no está cargada, se pide al kit y se pone al llegar
   * (mientras tanto se ve lo que ya había).
   */
  private actualizarAspecto(): void {
    const h = this.heroina
    if (!h) return
    const lista = aspectoDe(this.partida.equipo, this.cat, this.m.personajes[h.id]?.capas)
    const clave = claveAspecto(lista)
    if (clave === this.aspectoPuesto) return
    const faltan = h.capas.poner(lista)
    this.aspectoPuesto = faltan.length ? '' : clave
    if (!faltan.length) return
    if (encolarCapas(this, this.m, h.id, faltan) === 0) return
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (h.sprite.active) this.actualizarAspecto()
    })
    this.load.start()
  }

  /** El inventario con su tecla (I) o su botón: el mundo se pausa y se abre la escena Inventario */
  abrirInventario(): void {
    if (this.scene.isActive('Inventario') || this.scene.isPaused('Mundo') || this.combate.caido) return
    this.alAbrirPausa()
    this.scene.pause('Mundo')
    this.scene.launch('Inventario')
    this.scene.bringToTop('Inventario')
  }

  get enPresentacion(): boolean {
    return !!this.presentacion?.activa
  }

  /** El álbum de postales, desde el HUD: el mundo se pausa como con el inventario */
  abrirAlbum(): void {
    if (this.enPresentacion || this.scene.isActive('Album') || this.scene.isActive('Tienda') || this.scene.isActive('Inventario') || this.scene.isPaused('Mundo') || this.combate.caido) return
    this.alAbrirPausa()
    this.scene.pause('Mundo')
    this.scene.launch('Album', { desde: 'Mundo' })
    this.scene.bringToTop('Album')
  }

  /** La tienda de la fogata: el mundo se pausa como con el inventario */
  abrirTienda(): void {
    if (this.scene.isActive('Tienda') || this.scene.isActive('Inventario') || this.scene.isPaused('Mundo') || this.combate.caido) return
    this.alAbrirPausa()
    this.scene.pause('Mundo')
    this.scene.launch('Tienda')
    this.scene.bringToTop('Tienda')
  }

  equiparDeBolsa(i: number) {
    const r = equiparInv(this.inv(), this.cat, i)
    if (r.ok) this.alCambioInventario()
    return r
  }

  desequiparRanura(r: Parameters<typeof desequiparInv>[1]) {
    const res = desequiparInv(this.inv(), r)
    if (res.ok) this.alCambioInventario()
    return res
  }

  /** Soltar desde la mochila: el objeto cae al piso un paso delante de la heroína (y se puede volver a recoger) */
  soltarDeInventario(o: OrigenInv): boolean {
    const id = sacarInv(this.inv(), o)
    if (!id) return false
    this.alCambioInventario()
    const h = this.heroina
    const largo = Math.hypot(h.vx, h.vy) || 1
    const [ux, uy] = h.vx || h.vy ? [h.vx / largo, h.vy / largo] : [0, 1]
    const p = this.grilla.puntoLibreCerca(h.x + ux * 46, h.y + uy * 34, 8, 90) ?? { x: h.x + 46, y: h.y }
    this.botin.soltar(id, p.x, p.y)
    return true
  }

  /** Arrastrar en la mochila: cambia dos huecos de la bolsa */
  moverEnLaBolsa(de: number, a: number): boolean {
    const ok = moverEnBolsa(this.inv(), de, a)
    if (ok) this.guardar()
    return ok
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
    kb.on('keydown-I', () => !this.entrada.estaPausada && this.abrirInventario())
    kb.on('keydown-T', () => !this.entrada.estaPausada && this.olfatear())
    ;(['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((k, i) => kb.on(`keydown-${k}`, () => !this.entrada.estaPausada && this.combate.pocion(i)))
  }

  private cerrar(): void {
    this.listo = false
    this.anims.globalTimeScale = 1
    this.game.events.off('cartel-cerrado', this.alCerrarCartel, this)
    this.game.events.off('pausa-cerrada', this.alCerrarPausa, this)
    this.game.events.off('inventario-cerrado', this.alCerrarPausa, this)
    this.game.events.off('heroina-cae', this.alCaerEnArena, this)
    quitarGanchos(...NOMBRES_GANCHOS)
    this.entrada.destroy()
    this.soltarAnillo()
    this.jefe?.destruir()
    this.combate.destruir()
    this.botin.limpiar()
    this.proyectiles.limpiar()
    this.enemigos.destruir()
    this.mecanismos?.destruir()
    this.mercader?.destruir()
    this.mecanismos = null
    this.sonido.detener()
    this.decos.destruir()
    this.reflejos?.destruir()
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
    // lo que está en el piso va antes que Thor: si el botín cae donde está parado Thor, el toque es para el botín
    const suelo = this.botin.golpe(x, y)
    if (suelo) {
      this.pendiente = null
      this.combate.soltarObjetivo()
      if (this.heroina.irA(suelo.x, suelo.y)) this.ponerMarca(suelo.x, suelo.y)
      return true
    }
    // tocar a Thor: olfatea
    if (this.tocaThor(x, y)) {
      this.olfatear()
      return true
    }
    if (this.criaturas.tocar(x, y)) return true
    const mo = this.mercader.golpe(x, y)
    if (mo) {
      this.irAUsar(mo)
      return true
    }
    const o = this.entidades.golpe(x, y)
    if (!o) return false
    this.irAUsar(o)
    return true
  }

  /**
   * La flecha guía: cuenta el tiempo sin progreso (zona, cofre, enemigo, nivel o secreto nuevo) y, pasado el rato,
   * calcula dónde va la flecha en el borde de la pantalla. Nunca durante la presentación ni la pelea con el jefe.
   */
  private actualizarGuia(dt: number): void {
    const p = this.partida
    const firma = `${p.zonas.length}|${p.cofres.length}|${this.combate.muertes}|${p.nivel}|${p.secretos.length}|${this.partida.jefeVencido ? 1 : 0}`
    if (firma !== this.firmaProgreso) {
      this.firmaProgreso = firma
      this.relojGuia.progreso()
    }
    this.relojGuia.fijarEspera(this.combate.modoPeque ? GUIA.esperaPequeS : GUIA.esperaS)
    const ocupada = this.enPresentacion || !!this.jefe?.peleando || this.combate.caido || this.thor.olfateando
    if (ocupada) this.relojGuia.progreso()
    else this.relojGuia.tick(dt)
    this.flechaGuia = null
    if (!this.relojGuia.visible) return
    // F8: mientras falten brasas, la flecha apunta a la más cercana a la que se llega caminando
    const brasa = this.brasaAlcanzable()
    const destino = brasa ? { tipo: 'zona' as const, nombre: 'Brasa', x: brasa.x, y: brasa.y } : elegirDestino({
      heroe: { x: this.heroina.x, y: this.heroina.y },
      nivel: p.nivel,
      zonas: this.mapa.zonas,
      descubiertas: p.zonas,
      arena: this.arena ? { x: this.arena.x, y: this.arena.y } : null,
      jefeVencido: p.jefeVencido,
      portal: this.portalJefe ? { x: this.portalJefe.x, y: this.portalJefe.y } : null,
    })
    if (!destino) return
    const v = this.camara.vista
    const pos = posicionFlecha({ x: v.x, y: v.y, w: v.width, h: v.height }, { x: this.heroina.x, y: this.heroina.y }, destino)
    // la flecha va en el HUD, que no tiene el zoom del mundo
    const z = this.camara.zoom
    if (pos) this.flechaGuia = { ...pos, x: pos.x * z, y: pos.y * z, destino }
  }

  /** La brasa que falta más cerca a la que se llega caminando (con las compuertas como están). Se recalcula poco. */
  private brasaAlcanzable(): { x: number; y: number } | null {
    const mc = this.mecanismos
    if (!mc?.hay) return null
    const info = mc.info()
    const firma = `${info.brasas}|${Math.floor(this.heroina.x / 256)}|${Math.floor(this.heroina.y / 256)}`
    if (firma === this.destinoBrasa.firma) return this.destinoBrasa.p
    const faltan = info.piezas.filter((b) => !b.recogida).sort((a, b) => Math.hypot(a.x - this.heroina.x, a.y - this.heroina.y) - Math.hypot(b.x - this.heroina.x, b.y - this.heroina.y))
    let p: { x: number; y: number } | null = null
    for (const b of faltan) {
      if (buscarCamino(this.grilla, this.heroina.x, this.heroina.y, b.x, b.y + 18, { radio: 6, radioBusqueda: 3 })) {
        p = { x: b.x, y: b.y }
        break
      }
    }
    this.destinoBrasa = { firma, p }
    return p
  }

  /**
   * F7: cada cuarto de segundo, la música según lo que pasa (explorar, amenaza, combate, descanso) y el agua que
   * suena más fuerte cuanto más cerca está la heroína del río o del lago.
   */
  private actualizarAudio(dt: number): void {
    this.relojAudio -= dt
    if (this.relojAudio > 0) return
    const paso = 0.25 - this.relojAudio
    this.relojAudio = 0.25
    const h = this.heroina
    let alertas = 0
    let elite = false
    // un enemigo está en la pelea si la persigue, le pega o avisa; entre golpes (quieto, aturdido) sigue contando si
    // está cerca, y queda en la memoria 2 s para que la música no salte con cada pausa del enemigo
    const ahora = this.t
    for (const e of this.enemigos.lista) {
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      if (!e.vivo || d > MUSICA_ESTADOS.radioAlerta) continue
      const activo = e.estado === 'perseguir' || e.estado === 'atacando' || e.estado === 'aviso' || e.estado === 'grito' || ((e.estado === 'quieto' || e.estado === 'aturdido') && d < 220)
      if (activo) this.alertaHasta.set(e.id, ahora + 2)
      if ((this.alertaHasta.get(e.id) ?? -1) >= ahora) {
        alertas++
        if (e.elite) elite = true
      }
    }
    const f = this.entidades.fogataCercana(h)
    const fogata = !!f && Math.hypot(f.x - h.x, f.y - h.y) <= MUSICA_ESTADOS.radioFogata
    this.estadoMusica = this.directorMusica.tick(paso, { alertas, elite, fogata })
    const pista: Record<EstadoMusica, string | null> = { explorar: null, amenaza: 'musica_amenaza', combate: 'musica_combate', descanso: 'musica_fogata' }
    this.sonido.fijarEstado(this.mejoras ? pista[this.estadoMusica] : null)
    // el agua cercana: el cuadro de agua más próximo en 7 cuadros a la redonda
    const c = this.mapa.cuadro
    const tx = Math.floor(h.x / c)
    const ty = Math.floor(h.y / c)
    let mejor = Infinity
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        const x = tx + dx
        const y = ty + dy
        if (x < 0 || y < 0 || x >= this.mapa.ancho || y >= this.mapa.alto || !this.mapa.agua[y * this.mapa.ancho + x]) continue
        mejor = Math.min(mejor, Math.hypot(dx, dy))
      }
    }
    this.detalleAgua = this.mejoras && mejor < 7 ? Math.max(0, 1 - mejor / 7) * 0.8 : 0
    this.sonido.fijarDetalle('ambiente_agua', this.detalleAgua)
  }

  /** F7: las demostraciones para Alana (caminar, pegar, abrir), una por vez y hasta que la haga */
  private actualizarTutorial(): void {
    const h = this.heroina
    if (this.tutoUltima) this.tutoMovido += Math.min(40, Math.hypot(h.x - this.tutoUltima.x, h.y - this.tutoUltima.y))
    this.tutoUltima = { x: h.x, y: h.y }
    this.demoTutorial = null
    if (!this.mejoras || (params.heroe && !params.tutorial) || params.postal) return
    const p = this.partida
    let enemigo: { x: number; y: number } | null = null
    let dE = 260
    for (const e of this.enemigos.lista) {
      const d = Math.hypot(e.x - h.x, e.y - h.y)
      if (e.vivo && d < dE) {
        dE = d
        enemigo = { x: e.x, y: e.y }
      }
    }
    let cofre: { x: number; y: number } | null = null
    let dC = 280
    for (const c of this.entidades.cofres) {
      const d = Math.hypot(c.e.x - h.x, c.e.y - h.y)
      if (!c.abierto && !c.abriendo && c.s.visible && d < dC) {
        dC = d
        cofre = { x: c.e.x, y: c.e.y }
      }
    }
    const ocupada = this.enPresentacion || !!this.jefe?.peleando || this.combate.caido || this.scene.isPaused()
    const demo = demostracion({ hechos: p.tutorial, heroe: { x: h.x, y: h.y }, enemigo, cofre, ocupada })
    if (!demo) return
    if (this.demoBase.paso !== demo.paso) this.demoBase = { paso: demo.paso, movido: this.tutoMovido, golpes: this.tutoGolpes, cofres: p.cofres.length }
    const hecho = pasoCumplido(demo.paso, { movido: this.tutoMovido - this.demoBase.movido, golpes: this.tutoGolpes - this.demoBase.golpes, cofresAbiertos: p.cofres.length - this.demoBase.cofres })
    if (hecho) {
      p.tutorial.push(demo.paso)
      this.demoBase.paso = ''
      this.sonido.efecto('descubrir', { volumen: 0.4, rate: 1.3 })
      this.guardar()
      return
    }
    this.demoTutorial = { paso: demo.paso, x: demo.donde.x, y: demo.donde.y }
  }

  /** Tocar el chip del objetivo: la flecha sale ya, sin esperar */
  pedirGuia(): void {
    this.relojGuia.tick(999)
    this.sonido.efecto('descubrir', { volumen: 0.25, rate: 1.5 })
  }

  /** Saltar todas las demostraciones */
  saltarTutorial(): void {
    this.partida.tutorial = [...PASOS_TUTORIAL]
    this.demoTutorial = null
    this.guardar()
  }

  private tocaThor(x: number, y: number): boolean {
    const t = this.thor
    return Math.abs(x - t.x) <= 16 && y >= t.y - 30 && y <= t.y + 6
  }

  /**
   * Thor olfatea: ladra y lleva a la heroína al cofre sin abrir más cercano dejando huellas doradas.
   * Si no queda ninguno a su alcance, aúlla bajito. Devuelve la llave del cofre o null.
   */
  olfatear(): string | null {
    if (this.thor.olfateando || this.combate.caido || this.olfatoRecarga > 0) return null
    this.olfatoRecarga = OLFATO.recargaS
    const pistas: Pista[] = this.entidades.cofres
      .filter((c) => !c.abierto && !c.abriendo && c.s.visible)
      .map((c) => ({ llave: c.llave, x: c.e.x, y: c.e.y + 22, secreto: c.secreto }))
    // F8: en la Catedral Thor huele primero las brasas que faltan (las pistas secretas van primero)
    for (const b of this.mecanismos?.info().piezas ?? []) if (!b.recogida) pistas.push({ llave: `brasa:${b.id}`, x: b.x, y: b.y + 18, secreto: true })
    for (const p of ordenarPistas(pistas, { x: this.heroina.x, y: this.heroina.y }).slice(0, 4)) {
      const camino = buscarCamino(this.grilla, this.thor.x, this.thor.y, p.x, p.y, { radio: 6, radioBusqueda: 3 })
      if (!camino || camino.length === 0) continue
      this.olfatoInfo = { llave: p.llave, llego: false, huellas: 0 }
      this.sonido.efecto('ladrido', { volumen: 0.8 })
      this.thor.olfatear(
        new Guia(camino),
        (x, y) => {
          // una pata a cada lado, como pasos
          const n = this.olfatoInfo?.huellas ?? 0
          this.atmosfera.particulas.huella(x + (n % 2 ? 3 : -3), y + 2 + (n % 2 ? 2 : 0), OLFATO.huellaVidaS)
          if (this.olfatoInfo) this.olfatoInfo.huellas++
        },
        (llego) => {
          if (this.olfatoInfo) this.olfatoInfo.llego = llego
          if (!llego) return
          this.sonido.efecto('secreto', { volumen: 0.6 })
          this.fxSobre('curar', p.x, p.y - 22)
          this.thor.menearCola(2)
        },
      )
      return p.llave
    }
    // nada que olfatear cerca
    this.olfatoInfo = { llave: '', llego: false, huellas: 0 }
    this.thor.hacer('howl', 1)
    this.sonido.efecto('aullido', { volumen: 0.4, rate: 1.3 })
    return null
  }

  /** La heroína camina hasta el objeto y lo usa. Si ya está al lado, lo usa de una. */
  /** Usar algo del mundo: el mercader abre la tienda, lo demás lo resuelve Entidades */
  private usar(o: Objetivo): void {
    if (o.tipo === 'mercader') this.abrirTienda()
    else this.entidades.usar(o)
  }

  private irAUsar(o: Objetivo): void {
    if (Math.hypot(this.heroina.x - o.x, this.heroina.y - o.y) <= o.radio) {
      this.heroina.parar()
      this.usar(o)
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
    if (this.jefe && !this.partida.jefeVencido) this.partida.jefeVida = Math.round(this.jefe.vida)
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

  /**
   * La cámara y la entrada según el director del jefe: en la entrada y la muerte mira al jefe, durante la pelea
   * encuadra a los dos, y en la entrada la heroína espera.
   */
  private dirigirPelea(dtReal: number): void {
    const pl = (this.planoJefe = this.director.tick(dtReal))
    const h = this.heroina
    let x = h.x
    let y = h.y - 12
    let vx = h.vx
    let vy = h.vy
    const j = this.jefe
    if (j && pl.foco === 'jefe') {
      x = j.x
      y = j.y - JEFE.cuerpoAlto / 2
      vx = 0
      vy = 0
    } else if (j && pl.foco === 'mezcla' && j.vivo && Math.hypot(j.x - h.x, j.y - h.y) < ESCENA_JEFE.mezclaHasta) {
      x += (j.x - h.x) * ESCENA_JEFE.mezcla
      y += (j.y - JEFE.cuerpoAlto / 2 - (h.y - 12)) * ESCENA_JEFE.mezcla
    }
    this.camara.seguir(dtReal, x, y, vx, vy)
    if (pl.bloquear && !this.bloqueoPorJefe) {
      this.bloqueoPorJefe = true
      this.heroina.parar()
      this.entrada.pausada = true
    } else if (!pl.bloquear && this.bloqueoPorJefe) {
      this.bloqueoPorJefe = false
      if (!this.cartelAbierto && !this.presentacion?.activa && !this.combate.caido) this.entrada.pausada = false
    }
  }

  /** "Efectos suaves" en la pausa: sin sacudidas, congelados ni destellos fuertes */
  get suave(): boolean {
    return !!this.partida?.ajustes.efectosSuaves
  }

  /** Las mejoras de F7 prendidas (se pueden apagar en la pausa para comparar) */
  get mejoras(): boolean {
    return this.partida?.ajustes.mejorasF7 !== false
  }

  sacudir(ms: number, fuerza: number): void {
    if (!this.suave) this.cameras.main.shake(ms, fuerza)
  }

  /** Un texto que sube y se apaga (fallos, esquivas) */
  textoFlotante(x: number, y: number, s: string, tinte: number): void {
    const t = texto(this, Math.round(x), Math.round(y), s, 'fuente_ui', 1, { origen: [0.5, 1], tinte }).setDepth(PROF.OBJETOS + 9500)
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 750, ease: 'Sine.easeOut', onComplete: () => t.destroy() })
  }

  /** La heroína pegó al aire (el blanco se fue del alcance): polvo, un "fallo" y un silbido */
  private alFallar(x: number, y: number): void {
    if (!this.mejoras) return
    this.atmosfera.particulas.estallido(x, y - 6, 'polvo', 3)
    this.textoFlotante(x, y - 30, 'Fallo', 0xb8b8c8)
    this.sonido.efecto('esquiva', { volumen: 0.3, rate: 1.4 })
  }

  /** Pausa cortita y sacudida según el golpe */
  impacto(tipo: TipoImpacto): void {
    if (tipo !== 'recibidoFuerte') this.tutoGolpes++
    const r0 = this.impactos.pedir(tipo)
    const r = this.suave ? { pausa: 0, sacudida: null } : r0
    this.ultimoImpacto = { tipo, pausa: r.pausa, sacude: !!r.sacudida }
    if (r.pausa > this.pausaGolpe) {
      this.pausaGolpe = r.pausa
      this.anims.globalTimeScale = 0.05
    }
    if (r.sacudida) this.sacudir(r.sacudida.ms, r.sacudida.fuerza)
  }

  /** El mundo corre más lento un rato (en segundos reales) */
  camaraLenta(factor: number, seg: number): void {
    if (this.suave) return
    this.lento = { factor, resta: seg }
  }

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
  private paso(dtReal: number, completo: boolean, dtVisual: number): void {
    // hitstop: el mundo se congela un instante; la cámara lenta lo frena un rato
    this.impactos.avanzar(dtReal)
    let dt = dtReal
    if (this.pausaGolpe > 0) {
      this.pausaGolpe = Math.max(0, this.pausaGolpe - dtReal)
      dt = 0
      if (this.pausaGolpe === 0) this.anims.globalTimeScale = this.lento.resta > 0 ? this.lento.factor : 1
    } else if (this.lento.resta > 0) {
      this.lento.resta = Math.max(0, this.lento.resta - dtReal)
      dt = dtReal * this.lento.factor
      this.anims.globalTimeScale = this.lento.resta > 0 ? this.lento.factor : 1
    }
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
      this.enemigos.update(dt, { heroe: { x: this.heroina.x, y: this.heroina.y, vivo: !this.combate.caido }, thor: { x: this.thor.x, y: this.thor.y }, modoPeque: this.combate.modoPeque, dt })
      this.proyectiles.update(dt)
      this.combate.update(dt)
      this.actualizarJefe(dt)
    }
    this.botin.update(dt)
    this.olfatoRecarga = Math.max(0, this.olfatoRecarga - dt)
    this.actualizarGuia(dt)
    this.proyectiles.impactoAlFallar = this.mejoras
    this.actualizarAudio(dtReal)
    this.actualizarTutorial()
    this.tEnMundo += dt
    this.mecanismos?.revisar({ x: this.heroina.x, y: this.heroina.y })
    this.revisarPortalVolver()
    this.revisarAgua(dt)
    if (this.atmosfera.aclarado > this.aclaradoMeta) this.atmosfera.aclarado = Math.max(this.aclaradoMeta, this.atmosfera.aclarado - dt * 0.15)
    this.tJugado += dt
    // lo que la heroína iba a usar: cuando llega, lo usa
    const pend = this.pendiente
    if (pend) {
      if (Math.hypot(this.heroina.x - pend.x, this.heroina.y - pend.y) <= pend.radio) {
        this.pendiente = null
        this.heroina.parar()
        this.usar(pend)
      } else if (!this.heroina.tieneOrden) this.pendiente = null
    }
    this.thor.registrarRastro(this.heroina)
    this.thor.update(dt, this.heroina)
    this.dirigirPelea(dtReal)
    if (!completo) return

    const vista = this.camara.vista
    if (rafagaNueva) this.atmosfera.particulas.hojasDeRafaga(vista)
    this.vista.update(this.t, vista)

    const luces: Luz[] = []
    if (this.portalJefe) luces.push({ x: this.portalJefe.x, y: this.portalJefe.y - 40, r: 150, color: this.portalJefe.luz, pulse: true, ph: 0.3 })
    const heroe = { x: this.heroina.x, y: this.heroina.y }
    this.entidades.update(this.t, heroe, !this.presentacion?.activa)
    this.mercader.update(this.t, heroe)
    this.autoguardadoEn -= dtVisual
    if (this.autoguardadoEn <= 0) this.guardar()
    this.decos.actualizar(this.tViento, dtVisual, vista, heroe, luces)
    this.mecanismos?.update(this.t, luces)
    this.criaturas.update(this.t, dtVisual, heroe, vista, this.atmosfera.oscuridadFinal)
    this.atmosfera.update(this.t, dtVisual, vista, heroe, luces, (fn) => this.decos.forEachActivo(fn), rafaga)
    const cal = CALIDAD[this.partida.ajustes.calidad]
    this.decos.sombrasLargas = cal.sombrasLargas
    this.decos.reflejos = cal.reflejos
    this.reflejos.activo = cal.reflejos
    this.reflejos.update(this.t)
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
      luzMundo: () => ({ ...this.decos.contarEfectos(), reflejoPersonajes: this.reflejos.visibles, zoomCamara: this.camara.zoom }),
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
      abrirTienda: (() => this.abrirTienda()) as never,
      olfatear: (() => this.olfatear()) as never,
      abrirAlbum: (() => this.abrirAlbum()) as never,
      tutorial: () => ({ hechos: [...this.partida.tutorial], demo: this.demoTutorial ? { paso: this.demoTutorial.paso } : null }),
      saltarTutorial: (() => this.saltarTutorial()) as never,
      irAMundo: ((destino: string) => this.irAMundo(destino, { x: Math.round(this.heroina.x), y: Math.round(this.heroina.y) }, false)) as never,
      mundoActual: () => ({ id: idMundo(this.m.mundo), nombre: this.m.mundo.nombre, partida: this.partida.mundo, otros: Object.keys(this.partida.otrosMundos), zonas: this.mapa.zonas.map((z) => z.nombre), jefe: !!this.jefe, portalVolver: entidadesDeTipo(this.mapa, 'portal_volver').map((e) => ({ x: e.x, y: e.y }))[0] ?? null, peligroAgua: entidadesDeTipo(this.mapa, 'peligro_agua').map((e) => ({ x: e.x, y: e.y })), caidasAgua: this.caidasAgua, aclarado: Math.round(this.atmosfera.aclarado * 100) / 100, jefeTipo: this.jefe?.tipo ?? null }),
      mecanismos: () => this.mecanismos?.info() ?? null,
      darBrasas: ((n: number) => {
        for (const b of this.mecanismos?.info().piezas ?? []) if (this.partida.brasas.length < n && !this.partida.brasas.includes(b.id)) this.partida.brasas.push(b.id)
      }) as never,
      musicaEstado: () => ({ estado: this.estadoMusica, agua: Math.round(this.detalleAgua * 100) / 100 }),
      planoJefe: () => ({ ...this.planoJefe, entradaPausada: this.entrada.estaPausada, camara: { x: Math.round(this.camara.cx), y: Math.round(this.camara.cy) } }),
      guia: () => ({ sinProgreso: Math.round(this.relojGuia.sinProgreso * 10) / 10, visible: this.relojGuia.visible, flecha: this.flechaGuia }),
      /** como si hubiera pasado el rato sin progreso */
      forzarGuia: (() => {
        this.relojGuia.tick(999)
      }) as never,
      /** mueve solo a la heroína (Thor se queda donde está) */
      ponerHeroina: ((x: number, y: number) => {
        const p = this.grilla.puntoLibreCerca(x, y, 8, 120) ?? { x, y }
        this.heroina.teleport(p.x, p.y)
      }) as never,
      olfato: () => ({ activo: this.thor.olfateando, estado: this.thor.estadoOlfato, accion: this.thor.accionActual, t: Math.round(this.t * 100) / 100, info: this.olfatoInfo, thor: { x: Math.round(this.thor.x), y: Math.round(this.thor.y) }, huellasVisibles: this.atmosfera.particulas.cuantasDe('huella') }),
      darOro: ((n: number) => {
        this.partida.oro += n
      }) as never,
      impactos: () => ({ ultimo: this.ultimoImpacto, pausa: this.pausaGolpe, lento: { ...this.lento }, escalaAnims: this.anims.globalTimeScale }),
      jefe: () => {
        const j = this.jefe
        return j
          ? { existe: true, estado: j.estado, fase: j.fase, vida: j.vida, vidaMax: j.vidaMax, peleando: j.peleando, vivo: j.vivo, x: Math.round(j.x), y: Math.round(j.y), ratas: this.enemigos.invocadasVivas, anillo: this.anillo.length > 0, avisos: j.avisos(), vencido: this.partida.jefeVencido, portal: !!this.portalJefe, cofreJefe: this.entidades.cofres.some((c) => c.e.props.tras_jefe === true), piedras: this.piedrasEncendidas, arena: this.arena }
          : { existe: false }
      },
      danarJefe: ((n: number) => (this.jefe && this.jefe.peleando ? this.combate.golpear(this.jefe, 0, { dano: n, critico: false }) : undefined)) as never,
      entrarArena: (() => {
        const a = this.arena
        if (!a) return null
        const p = this.grilla.puntoLibreCerca(a.x - 110, a.y + 70, 8, 80) ?? { x: a.x - 110, y: a.y + 70 }
        this.heroina.teleport(p.x, p.y)
        this.camara.manual = false
        this.camara.centrarEn(p.x, p.y)
        return p
      }) as never,
      irAlPortal: (() => this.irAContinuara()) as never,
      botin: () => this.botin.info(),
      inventario: () => ({ equipo: { ...this.partida.equipo }, bolsa: [...this.partida.bolsa], cinturon: [...this.partida.cinturon], armaduraThor: this.thor.nivelArmadura, oro: this.partida.oro, velMult: this.heroina.velMult }),
      soltarObjeto: ((id: string, dx = 70) => this.botin.soltar(id, this.heroina.x + dx, this.heroina.y + 4)) as never,
      soltarOro: ((n: number, dx = 26) => this.botin.soltarOro(n, this.heroina.x + dx, this.heroina.y + 6)) as never,
      darObjeto: ((id: string) => {
        const r = recogerInv(this.inv(), this.cat, id)
        if (r.ok) this.alCambioInventario()
        return r
      }) as never,
      llenarBolsa: ((id: string) => {
        for (let i = 0; i < this.partida.bolsa.length; i++) if (!this.partida.bolsa[i]) this.partida.bolsa[i] = id
      }) as never,
      equipar: ((i: number) => this.equiparDeBolsa(i)) as never,
      desequipar: ((r: string) => this.desequiparRanura(r as never)) as never,
      abrirInventario: () => this.abrirInventario(),
      desenterrar: () => this.combate.desenterrar(),
      premioDe: ((f: Fuente) => tirarBotin(juego(), this.cat, { nivelHeroe: this.partida.nivel, clase: this.combate.clase, idHeroe: this.heroina.id }, f)) as never,
      romper: ((llave: string) => this.entidades.romper(llave)) as never,
      danar: ((n: number) => this.combate.danar(n)) as never,
      enemigos: () => this.enemigos.lista.map((e) => ({ id: e.id, tipo: e.tipo, x: Math.round(e.x), y: Math.round(e.y), vida: e.vida, vidaMax: e.vidaMax, vivo: e.vivo, estado: e.estado, elite: e.elite, nombre: e.nombre, casa: { x: e.ia.casaX, y: e.ia.casaY }, anticipa: e.anticipando, distraida: e.distraida })),
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
      objetivos: () => [...this.entidades.objetivos(), ...this.mercader.objetivos()],
      mercader: () => this.mercader.info(),
      aspecto: () => ({ capas: this.heroina.capas.info(), clave: this.aspectoPuesto, base: this.heroina.sprite.texture.key, cuadro: Number(this.heroina.sprite.frame.name) }),
      usarObjetivo: ((llave: string) => {
        const o = [...this.entidades.objetivos(), ...this.mercader.objetivos()].find((q) => q.llave === llave)
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
