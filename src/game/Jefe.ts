import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { Entidad } from '../kit/mapa'
import { K } from '../kit/claves'
import { crearAnimFx, crearAnimsPersonaje } from '../kit/anims'
import { DIRECCIONES, indiceDireccion } from '../logic/direccion'
import type { Grilla } from '../logic/grilla'
import { moverCuerpo } from '../logic/movimiento'
import { fx, juego } from '../logic/azar'
import { danarJefe, despertar, nuevoJefe, pensarJefe, reposar, type EstadoJefe, type Jefe, type OrdenJefe, type PerfilJefe } from '../logic/jefe'
import { IMPACTO, JEFE, JEFE_CAMPANA, JEFE_DRAGONA, JEFE_PEZ, JEFE_POLILLA, JEFE_REY } from '../config/balance'
import { PROF } from '../config/juego'
import { Sombra } from './Sombras'
import { texto } from './Texto'
import type { Atacable } from './Enemigos'
import { cuerpoJefe } from '../logic/capas'
import { vidaDeJefe } from '../logic/dureza'

export interface EventosJefe {
  /** el golpe cae sobre un círculo del piso: si la heroína está dentro, recibe el daño */
  golpeCirculo(x: number, y: number, radio: number, dano: readonly [number, number], elipse: boolean): void
  /** la carga le pegó a la heroína */
  golpeCarga(dano: readonly [number, number]): void
  invocar(n: number, x: number, y: number): void
  efecto(nombre: string, x: number, y: number, escala?: number): void
  sonido(nombre: string, op?: { volumen?: number; rate?: number }): void
  sacudir(fuerte?: boolean): void
  /** F8: la onda de la campana pega en el anillo entre `interior` y `exterior` */
  golpeAnillo?(x: number, y: number, interior: number, exterior: number, dano: readonly [number, number]): void
  /** F8: salen raíces del piso que tapan el paso un rato */
  raices?(puntos: { x: number; y: number }[], radio: number, seg: number): void
  /** F11: el polvo de la Polilla Reina cayó: apaga los cristales que tapa */
  polvo?(x: number, y: number, radio: number): void
  /** F11: le pegó con el escudo puesto (los cristales grandes apagados, o el Pez Farol bajo el agua) */
  escudo?(x: number, y: number): void
  /** F12: la ola del Pez Farol pasa por la franja: pega y empuja a quien esté adentro */
  ola?(x: number, y: number, dx: number, dy: number, largo: number, ancho: number, dano: readonly [number, number], empuje: number): void
  /** F12: el farol de Thor encandiló al Pez Farol */
  encandilado?(): void
  /** F12: un golpe en franja (el barrido del Rey de Piedra) */
  golpeLinea?(x: number, y: number, dx: number, dy: number, largo: number, ancho: number, dano: readonly [number, number]): void
  /** F12: el Rey cantó la canción de cuna: se apagan las lámparas del salón */
  cancion?(): void
  /** F12: se le cayeron chispas de la corona al golpear el piso */
  chispas?(x: number, y: number, n: number): void
  /** F12: el coletazo de la Dragona barre medio círculo hacia (dx, dy) */
  golpeMedio?(x: number, y: number, dx: number, dy: number, radio: number, dano: readonly [number, number]): void
  /** F12: el aliento de la Dragona deja el piso ardiendo en su franja */
  fuegoPiso?(x: number, y: number, dx: number, dy: number, largo: number, ancho: number, seg: number): void
  /** F12: la Dragona quedó apagada (el chorro o Thor) o se volvió a encender */
  apagada?(por: 'chorro' | 'thor'): void
  encender?(): void
  alFase2(): void
  alMorir(): void
}

/** Qué jefe es según el personaje del manifest, y la vida con la que empieza (F13: más dura, y más en cada ciclo) */
export function perfilDe(tipo: string, ciclo = 1): { perfil: PerfilJefe; vida: number } {
  const b = perfilBase(tipo)
  return { perfil: b.perfil, vida: vidaDeJefe(b.vida, ciclo) }
}

function perfilBase(tipo: string): { perfil: PerfilJefe; vida: number } {
  if (tipo === 'guardian_campana') return { perfil: 'campana', vida: JEFE_CAMPANA.vida }
  if (tipo === 'polilla_reina') return { perfil: 'polilla', vida: JEFE_POLILLA.vida }
  if (tipo === 'pez_farol') return { perfil: 'pez', vida: JEFE_PEZ.vida }
  if (tipo === 'rey_de_piedra') return { perfil: 'rey', vida: JEFE_REY.vida }
  if (tipo === 'dragona_brasa') return { perfil: 'dragona', vida: JEFE_DRAGONA.vida }
  return { perfil: 'minotauro', vida: JEFE.vida }
}

export interface ContextoJefe {
  dt: number
  heroeX: number
  heroeY: number
  heroeVivo: boolean
  modoPeque: boolean
  ratasVivas: number
  /** F11: los cuatro cristales grandes prendidos (la Polilla Reina) */
  vulnerable?: boolean
  /** F12: Thor tiene el farol alzado aquí */
  alzado?: { x: number; y: number }
  /** F12: el chorro de un surtidor le pegó a la Dragona, o Thor se sacudió a su lado */
  chorro?: boolean
  sacudida?: boolean
}

interface Telegrafo {
  ataque: string
  s?: Phaser.GameObjects.Sprite
  g?: Phaser.GameObjects.Graphics
  resta: number
  total: number
  linea?: { x: number; y: number; dx: number; dy: number; largo: number; ancho: number }
  /** F8: el anillo de la onda de la campana */
  anillo?: { x: number; y: number; interior: number; exterior: number }
  /** F8: las manchas de la llamada de raíces */
  extra?: Phaser.GameObjects.Sprite[]
}

/**
 * El Minotauro del Bosque en pantalla: sprite de 96 px en 8 direcciones, sombra, los avisos en el piso y la ejecución de lo que
 * decide `logic/jefe.ts`. Se marca y se golpea igual que un enemigo (Atacable). No se cura: la vida solo baja.
 */
export class JefeSprite implements Atacable {
  readonly id = 777777
  /** el personaje del manifest: el minotauro del Bosque o el guardián de la campana de la Catedral */
  readonly tipo: string
  readonly esJefe = true
  readonly nombre: string
  /** lo que dice abajo del nombre en la entrada */
  readonly titulo: string
  readonly logica: Jefe
  readonly radioArena: number
  /** F12: el radio de la poza del Pez Farol (0 si no hay): nada adentro, sin chocar con el agua */
  readonly radioPoza: number
  /** celda del sprite en el manifest: 96 hoy, 128 cuando el taller entregue los jefes nativos */
  private celda = 96
  readonly sprite: Phaser.GameObjects.Sprite
  readonly sombra: Sombra
  private estandarte?: Phaser.GameObjects.Container
  private dir = 0
  private animActual = ''
  private bloqueoAnimS = 0
  private marcado = false
  private telegrafos: Telegrafo[] = []
  private cuadros: Record<string, { cuadros: number; fps: number }> = {}
  private estadoPrevio: EstadoJefe = 'dormido'
  private destelloFin = 0
  /** la animación que corre (sin dirección): para leer su `elevacion` */
  private animNombre = ''
  /** la luz robada del faro en la punta de la antena (el Pez Farol) */
  readonly luzAntena?: { color: string; radio: number }
  /** vive en el agua (el Pez Farol): la hoja trae el agua pintada, así que no lleva sombra en el piso */
  readonly enAgua: boolean
  /** la pelea está en marcha (despertó y no murió ni se reposó) */
  peleando = false

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private grilla: Grilla,
    ent: Entidad,
    arena: { x: number; y: number; radio: number; poza?: number },
    vida: number,
    private ev: EventosJefe,
    ciclo = 1,
  ) {
    this.tipo = String(ent.props.enemigo ?? 'minotauro')
    this.nombre = String(ent.props.nombre ?? 'Minotauro del Bosque')
    this.titulo = String(ent.props.titulo ?? 'Guardián de Las Alturas')
    this.radioArena = arena.radio
    this.radioPoza = arena.poza ?? 0
    const { perfil, vida: vidaMax } = perfilDe(this.tipo, ciclo)
    const campana = perfil === 'campana'
    this.logica = nuevoJefe(arena.x, arena.y, vidaMax, perfil)
    this.logica.vida = Math.max(1, Math.min(vidaMax, vida))
    if ((this.logica.vida / this.logica.vidaMax) * 100 <= JEFE.fase2Pct) this.logica.fase = 2
    if (perfil === 'pez' && (this.logica.vida / this.logica.vidaMax) * 100 <= JEFE_PEZ.fase3Pct) this.logica.fase = 3
    if (perfil === 'rey' && (this.logica.vida / this.logica.vidaMax) * 100 <= JEFE_REY.fase3Pct) this.logica.fase = 3
    if (perfil === 'dragona' && (this.logica.vida / this.logica.vidaMax) * 100 <= JEFE_DRAGONA.fase3Pct) this.logica.fase = 3
    // la Dragona en la fase 2 o más arranca encendida
    if (perfil === 'dragona' && this.logica.fase >= 2) this.logica.escudo = true
    // un guardado que ya pasó de raicesPct no vuelve a enseñarlas
    if (campana && (this.logica.vida / this.logica.vidaMax) * 100 <= JEFE_CAMPANA.raicesPct) this.logica.raicesVistas = true
    const p = m.personajes[this.tipo]!
    this.celda = p.celda
    // la luz robada en la antena del Pez Farol o en la corona del Rey de Piedra
    const luz = p.luz_antena ?? p.luz_corona ?? p.luz_boca
    if (luz) this.luzAntena = { color: luz.color, radio: luz.radius }
    this.enAgua = p.en_agua === true || ent.props.en_agua === true
    for (const [n, a] of Object.entries(p.anims)) this.cuadros[n] = { cuadros: a.cuadros, fps: a.fps }
    crearAnimsPersonaje(escena, m, this.tipo)
    this.sprite = escena.add.sprite(arena.x, arena.y, K.pers(this.tipo, 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda)
    this.sombra = new Sombra(escena, Math.round(64 * Math.max(1, p.celda / 96)), 0.4)
    if (escena.textures.exists(K.ui('estandarte'))) {
      const img = escena.add.image(0, 0, K.ui('estandarte')).setOrigin(0.5, 1)
      const t = texto(escena, 0, -14, this.nombre, 'fuente_ui', 1, { origen: [0.5, 0.5] })
      this.estandarte = escena.add.container(0, 0, [img, t]).setVisible(false)
    }
    this.dir = 0
    this.poner('idle', true)
    this.colocar()
  }

  /* ---------- Atacable ---------- */

  get x(): number {
    return this.logica.x
  }
  get y(): number {
    return this.logica.y
  }
  get vivo(): boolean {
    return this.logica.estado !== 'muerto'
  }
  get vida(): number {
    return this.logica.vida
  }
  get vidaMax(): number {
    return this.logica.vidaMax
  }
  get blindado(): boolean {
    return this.logica.escudo
  }
  get fase(): number {
    return this.logica.fase
  }
  get estado(): EstadoJefe {
    return this.logica.estado
  }
  get radioHit(): number {
    return this.cuerpo.radio
  }
  get altura(): number {
    return this.cuerpo.alto / 2
  }
  /** el cuerpo crece con la celda: los jefes nativos de 128 del taller siguen recibiendo los golpes donde se ven */
  get cuerpo(): { alto: number; radio: number } {
    return cuerpoJefe(this.celda, { alto: JEFE.cuerpoAlto, radio: JEFE.cuerpoRadio })
  }

  golpe(x: number, y: number, margen = 10): boolean {
    if (!this.vivo || !this.peleando) return false
    const c = this.cuerpo
    return Math.abs(x - this.x) <= c.radio + margen && y >= this.y - c.alto - margen && y <= this.y + 8 + margen
  }

  marcar(v: boolean): void {
    this.marcado = v
    this.pintarTono()
  }

  /** El tono del sprite: marcado (rojizo), enojado en la fase 2 (un poco rojo) o normal. Nunca pisa el destello del golpe */
  private pintarTono(): void {
    if (this.escena.time.now < this.destelloFin) return
    if (!this.vivo) this.sprite.clearTint()
    else if (this.marcado) this.sprite.setTint(0xffa0a0)
    else if (this.logica.fase >= 2) this.sprite.setTint(0xffc4b4)
    else this.sprite.clearTint()
  }

  /** Daño recibido. Devuelve true si murió. */
  recibir(dano: number): boolean {
    if (!this.vivo) return false
    const r = this.logica.escudo ? { fase2: false, murio: false, escudo: true } : danarJefe(this.logica, dano)
    // la Polilla Reina con los cristales apagados: el golpe rebota, sin destello ni daño
    if (r.escudo) {
      // el Pez Farol bajo el agua: el golpe salpica y no le llega
      if (this.logica.perfil === 'pez') this.ev.sonido('ola', { volumen: 0.35, rate: 1.6 })
      else this.ev.sonido('bloqueo', { volumen: 0.5, rate: 1.3 })
      this.ev.escudo?.(this.x, this.y - this.cuerpo.alto)
      return false
    }
    // destello blanco del golpe; en la fase 2 vuelve a su tono enojado
    this.sprite.setTintFill(0xffffff)
    this.destelloFin = this.escena.time.now + IMPACTO.destelloMs
    this.escena.time.delayedCall(IMPACTO.destelloMs, () => {
      if (this.sprite.active) this.pintarTono()
    })
    this.ev.sonido('enemigo_dolor', { volumen: 0.6, rate: 0.6 })
    if (r.murio) {
      this.morir()
      return true
    }
    if (r.fase3) {
      // el Pez Farol en la tercera: asoma y la luz late fuerte (llama cangrejos y medusas)
      this.limpiarTelegrafos()
      this.voz({ volumen: 0.9, rate: 0.8 })
      this.ev.sacudir(true)
      this.poner('warcry', true)
      this.bloqueoAnimS = JEFE.fase2RugidoS
    }
    if (r.fase2) {
      this.limpiarTelegrafos()
      this.ev.alFase2()
      this.voz({ volumen: 0.9, rate: 0.8 })
      this.ev.sacudir(true)
      this.poner('warcry', true)
      this.bloqueoAnimS = JEFE.fase2RugidoS
    }
    return false
  }

  /* ---------- la pelea ---------- */

  empezar(): boolean {
    if (!despertar(this.logica)) return false
    this.peleando = true
    // su nombre va en la barra de arriba: el estandarte sobre la cabeza ya no hace falta
    this.voz({ volumen: 1 })
    this.ev.sacudir(true)
    this.poner('warcry', true)
    this.bloqueoAnimS = JEFE.introS
    return true
  }

  /** La heroína cayó y Thor la rescató: se queda dormido donde empezó, con la vida que tenía */
  reposar(): void {
    reposar(this.logica)
    this.peleando = false
    this.limpiarTelegrafos()
    this.estandarte?.setVisible(false)
    this.poner('idle', true)
    this.colocar()
  }

  /** Cargado desde un guardado con el jefe ya vencido: no aparece */
  quitar(): void {
    this.sprite.setVisible(false)
    this.sombra.setVisible(false)
    this.estandarte?.setVisible(false)
    this.logica.estado = 'muerto'
  }

  private morir(): void {
    this.limpiarTelegrafos()
    this.marcar(false)
    this.sprite.clearTint()
    this.poner('die', true)
    this.bloqueoAnimS = 99
    this.estandarte?.setVisible(false)
    this.voz({ volumen: 1, rate: 0.5 })
    this.ev.sacudir(true)
    this.ev.alMorir()
  }

  /**
   * Después de caer: cuando termina de morir, se deshace de a poco en polvo (alPolvo suelta partículas donde está)
   * y la sombra se va con él. En tiempo real, para que la cámara lenta lo haga más solemne.
   */
  desvanecer(alPolvo: (x: number, y: number) => void): void {
    // el Pez Farol se libera: se achica, se pone azul y dorado y se va nadando. Se espera al último cuadro de `die`
    // (con la cámara lenta tarda más), se lo deja ver un momento y se va suave, sin polvo
    // el Rey de Piedra se libera y se queda: un viejito bonachón que bosteza y saluda (el último cuadro de `die`)
    // la Dragona también: queda una dragoncita dorada que ronronea (el último cuadro de `die`)
    if (this.logica.perfil === 'rey' || this.logica.perfil === 'dragona') return
    if (this.enAgua) {
      const irse = () =>
        this.escena.time.delayedCall(900, () => {
          if (!this.sprite.active) return
          this.escena.tweens.add({ targets: [this.sprite], alpha: 0, duration: 1600, ease: 'Sine.easeIn' })
        })
      if (this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key.includes('_die_')) this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, irse)
      else irse()
      return
    }
    const def = this.cuadros.die
    const espera = def ? (def.cuadros / def.fps) * 1000 : 600
    this.escena.time.delayedCall(espera + 250, () => {
      if (!this.sprite.active) return
      // el guardián trae `libre`: se queda parado y en paz, en turquesa, en vez de deshacerse en polvo
      if (this.cuadros.libre) {
        this.dir = 0
        this.poner('libre', true)
        return
      }
      const polvo = this.escena.time.addEvent({ delay: 90, repeat: 14, callback: () => alPolvo(this.x + (fx().next() - 0.5) * 40, this.y - fx().next() * this.cuerpo.alto * 0.7) })
      this.escena.tweens.add({ targets: [this.sprite], alpha: 0, duration: 1400, ease: 'Sine.easeIn', onComplete: () => polvo.remove(false) })
      this.escena.tweens.add({ targets: this.sombra.img, alpha: 0, duration: 1400 })
    })
  }

  update(c: ContextoJefe): void {
    this.bloqueoAnimS = Math.max(0, this.bloqueoAnimS - c.dt)
    this.actualizarTelegrafos(c.dt)
    if (this.logica.estado === 'dormido' || this.logica.estado === 'muerto') {
      this.colocar()
      return
    }
    const j = this.logica
    const o = pensarJefe(j, { dt: c.dt, heroeX: c.heroeX, heroeY: c.heroeY, heroeVivo: c.heroeVivo, modoPeque: c.modoPeque, ratasVivas: c.ratasVivas, vulnerable: c.vulnerable, alzado: c.alzado, chorro: c.chorro, sacudida: c.sacudida }, juego())
    this.ejecutar(o, c)
    this.colocar()
  }

  private ejecutar(o: OrdenJefe, c: ContextoJefe): void {
    const j = this.logica
    if (o.mirarA) this.dir = indiceDireccion(o.mirarA.x - j.x, o.mirarA.y - j.y)
    if (o.mover) {
      const paso = o.mover.vel * c.dt
      // en la poza nada libre (el agua es sólida para la heroína, no para él)
      const r = this.radioPoza > 0 ? { x: j.x + o.mover.dx * paso, y: j.y + o.mover.dy * paso } : moverCuerpo(this.grilla, { x: j.x, y: j.y, radio: 14 }, o.mover.dx * paso, o.mover.dy * paso)
      // no se sale de la arena (ni de la poza)
      const dx = r.x - j.cx
      const dy = r.y - j.cy
      const tope = this.radioPoza > 0 ? Math.max(8, this.radioPoza - 20) : this.radioArena - JEFE.margenBorde
      const d = Math.hypot(dx, dy)
      j.x = d > tope ? j.cx + (dx / d) * tope : r.x
      j.y = d > tope ? j.cy + (dy / d) * tope : r.y
      if (!o.mirarA) this.dir = indiceDireccion(o.mover.dx, o.mover.dy)
    }
    if (o.atacando === 'golpe') {
      this.poner('attack', true)
      this.bloqueoAnimS = JEFE.golpeVentanaS + 0.3
      this.ev.sonido('golpe', { volumen: 0.6, rate: 0.6 })
    }
    if (o.aviso) this.mostrarAviso(o.aviso)
    if (o.rugir) {
      this.voz({ volumen: 0.7, rate: 1.2 })
      this.ev.efecto('grito_de_guerra', j.x, j.y - this.cuerpo.alto)
    }
    if (o.saltar) {
      this.poner('leap', true)
      this.bloqueoAnimS = JEFE.salto.duracionS + 0.2
      this.ev.sonido('esquiva', { volumen: 0.7, rate: 0.5 })
    }
    if (o.cargar) {
      this.poner('charge', true)
      this.voz({ volumen: 0.6, rate: 1.5 })
    }
    if (o.aturdido) {
      // la Polilla Reina cae al piso con las alas caídas; los demás se tambalean
      if (this.logica.perfil === 'polilla') {
        if (!o.golpe) this.limpiarTelegrafos()
        this.poner('aturdida', true)
        this.ev.sonido('polilla_aleteo', { volumen: 0.7, rate: 0.6 })
        this.ev.efecto('nube_polvo', j.x, j.y, 1)
      } else if (this.logica.perfil === 'rey') {
        // de rodillas, con las grietas brillando dorado: ahí se le pega
        this.limpiarTelegrafos()
        this.poner('aturdido', true)
        this.ev.efecto('grieta_luz', j.x, j.y - this.cuerpo.alto / 2, 2)
        this.ev.sonido('corona_rompe', { volumen: 0.5, rate: 1.4 })
      } else if (this.logica.perfil === 'dragona') {
        // el chorro la apaga: echada en el piso, gris y humeando (ahí se le pega)
        this.limpiarTelegrafos()
        this.poner('apagada', true)
        this.ev.efecto('vapor_grande', j.x, j.y - 10, 1)
        this.ev.sonido('dragona_apagada', { volumen: 0.8 })
        if (o.apagada) this.ev.apagada?.(o.apagada)
      } else if (this.logica.perfil === 'pez') {
        // el farol de Thor lo encandila: sale del agua de costado, boqueando
        this.limpiarTelegrafos()
        this.poner('aturdido', true)
        this.ev.sonido('pez_emerge', { volumen: 0.9, rate: 0.9 })
        if (o.encandilado) this.ev.encandilado?.()
      } else this.poner('hit', true)
      this.bloqueoAnimS = o.aturdido
      this.ev.sacudir(true)
      this.ev.sonido('jefe_pisoton', { volumen: 0.8, rate: 0.7 })
    }
    if (o.hundirse) {
      this.poner('hundirse', true)
      this.bloqueoAnimS = JEFE_PEZ.emergerS
      this.ev.sonido('ola', { volumen: 0.4, rate: 1.3 })
    }
    if (o.golpe) this.soltarGolpe(o.golpe)
    if (o.fuegoPiso) this.ev.fuegoPiso?.(o.fuegoPiso.x, o.fuegoPiso.y, o.fuegoPiso.dx, o.fuegoPiso.dy, o.fuegoPiso.largo, o.fuegoPiso.ancho, o.fuegoPiso.seg)
    if (o.encender) {
      // se levanta y se vuelve a cubrir de fuego
      this.poner('encendida', true)
      this.voz({ volumen: 0.5, rate: 1.1 })
      this.ev.encender?.()
    }
    if (o.cancion) this.ev.cancion?.()
    if (o.chispas) this.ev.chispas?.(o.chispas.x, o.chispas.y, o.chispas.n)
    if (o.raices) this.ev.raices?.(o.raices.puntos, o.raices.radio, o.raices.seg)
    if (o.polvo) this.ev.polvo?.(o.polvo.x, o.polvo.y, o.polvo.radio)
    if (o.invocar && o.invocar > 0) {
      this.poner('warcry', true)
      this.bloqueoAnimS = 0.8
      this.ev.invocar(o.invocar, j.x, j.y)
    }
    if (this.bloqueoAnimS <= 0) this.animarPorEstado()
  }

  private animarPorEstado(): void {
    const e = this.logica.estado
    if (e === this.estadoPrevio && e !== 'perseguir' && e !== 'quieto') return
    this.estadoPrevio = e
    if (e === 'perseguir') this.poner('walk')
    else if (e === 'quieto' || e === 'intro') this.poner(this.logica.perfil === 'dragona' && this.logica.escudo ? 'encendida' : 'idle')
    else if (e === 'aviso') this.poner(this.logica.ataque === 'grito' ? 'warcry' : 'idle')
    else if (e === 'cargando') this.poner('charge')
    else if (e === 'aturdido') this.poner(this.logica.perfil === 'polilla' ? 'aturdida' : this.logica.perfil === 'dragona' ? 'apagada' : this.logica.perfil === 'pez' || this.logica.perfil === 'rey' ? 'aturdido' : 'idle')
  }

  private soltarGolpe(g: NonNullable<OrdenJefe['golpe']>): void {
    const j = this.logica
    if (g.ataque === 'carga') {
      this.ev.golpeCarga(g.dano)
      return
    }
    if (g.forma === 'anillo') {
      // suena la campana: el anillo pega, el centro (cerca de ella) se salva
      this.ev.golpeAnillo?.(g.x, g.y, g.interior ?? 0, g.radio, g.dano)
      this.ev.efecto('onda_pisoton', g.x, g.y, 2)
      this.ev.sonido('bloqueo', { volumen: 0.9, rate: 0.45 })
      this.ev.sonido('jefe_pisoton', { volumen: 0.6, rate: 0.8 })
      this.ev.sacudir(true)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'ola') {
      // salta afuera y cae de panza: el resto del salto a velocidad normal, y la ola corre por la franja
      this.seguirAtaque('attack_heavy')
      this.bloqueoAnimS = JEFE_PEZ.ola.fueraS + 0.4
      this.ev.ola?.(g.x, g.y, g.dx, g.dy, g.largo, g.ancho, g.dano, g.empuje ?? 0)
      this.ev.sonido('ola', { volumen: 0.9 })
      this.ev.sonido('pez_emerge', { volumen: 0.6, rate: 0.8 })
      this.ev.sacudir(true)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'puno') {
      this.seguirAtaque('attack')
      this.bloqueoAnimS = 0.6
      this.ev.golpeCirculo(g.x, g.y, g.radio, g.dano, true)
      this.ev.efecto('onda_pisoton', g.x, g.y, 1)
      this.ev.sonido('rey_puno', { volumen: 0.9 })
      this.ev.sacudir(true)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'zarpazo') {
      this.seguirAtaque('attack')
      this.bloqueoAnimS = 0.6
      this.ev.golpeCirculo(g.x, g.y, g.radio, g.dano, true)
      this.ev.efecto('impacto_brasa', g.x, g.y, 1)
      this.ev.sonido('golpe', { volumen: 0.8, rate: 0.55 })
      this.ev.sacudir(false)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'coletazo') {
      this.seguirAtaque('coletazo')
      this.bloqueoAnimS = 0.6
      this.ev.golpeMedio?.(g.x, g.y, g.dx, g.dy, g.radio, g.dano)
      this.ev.sonido('jefe_pisoton', { volumen: 0.7, rate: 0.9 })
      this.ev.sacudir(true)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'aliento') {
      this.seguirAtaque('aliento')
      this.bloqueoAnimS = 0.9
      this.ev.golpeLinea?.(g.x, g.y, g.dx, g.dy, g.largo, g.ancho, g.dano)
      this.ev.sonido('dragona_aliento', { volumen: 0.9 })
      this.ev.sacudir(true)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'barrido') {
      this.seguirAtaque('barrido')
      this.bloqueoAnimS = 0.6
      this.ev.golpeLinea?.(g.x, g.y, g.dx, g.dy, g.largo, g.ancho, g.dano)
      this.ev.sonido('aguja_barre', { volumen: 0.6, rate: 0.6 })
      this.ev.sacudir(false)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.ataque === 'mordida') {
      this.seguirAtaque('attack')
      this.bloqueoAnimS = JEFE_PEZ.mordida.fueraS + 0.3
      this.ev.golpeCirculo(g.x, g.y, g.radio, g.dano, true)
      this.ev.sonido('pez_mordida', { volumen: 0.9 })
      this.ev.sacudir(false)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    if (g.forma === 'raices') {
      for (const p of g.puntos ?? []) this.ev.golpeCirculo(p.x, p.y, g.radio, g.dano, true)
      this.ev.sonido('romper', { volumen: 0.8, rate: 0.6 })
      this.ev.sacudir(false)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    this.ev.golpeCirculo(g.x, g.y, g.radio, g.dano, g.ataque !== 'golpe' && g.ataque !== 'polvo')
    if (g.ataque === 'polvo') {
      // la nube de polvo cae donde estaba el aviso
      this.ev.efecto('nube_polvo', g.x, g.y, 1)
      this.ev.sonido('polilla_aleteo', { volumen: 0.8, rate: 0.8 })
      this.ev.sacudir(false)
    } else if (g.ataque === 'pisoton' || g.ataque === 'salto') {
      this.ev.efecto('onda_pisoton', g.x, g.y, 2)
      this.ev.sonido(this.logica.perfil === 'rey' ? 'rey_pisoton' : 'jefe_pisoton', { volumen: 0.9 })
      this.ev.sacudir(true)
    } else if (g.ataque === 'golpe_fuerte') {
      this.ev.sonido('jefe_pisoton', { volumen: 0.7, rate: 1.2 })
      this.ev.sacudir(false)
    } else this.ev.sonido('golpe', { volumen: 0.7, rate: 0.6 })
    this.limpiarTelegrafos(g.ataque)
    void j
  }

  /**
   * F12: el golpe del Pez Farol cae: la animación del ataque, que venía estirada en la preparación, sigue desde el
   * cuadro del golpe a su velocidad. Al terminar se queda con el último cuadro de `emerger` (afuera del agua) mientras
   * dura la ventana para pegarle.
   */
  private seguirAtaque(anim: 'attack' | 'attack_heavy' | 'barrido' | 'coletazo' | 'aliento'): void {
    const def = this.m.personajes[this.tipo]?.anims[anim]
    const key = K.anim(this.tipo, anim, DIRECCIONES[this.dir]!)
    if (!def || !this.escena.anims.exists(key)) return
    this.animActual = key
    this.animNombre = anim
    this.sprite.play({ key, frameRate: def.fps, startFrame: Math.min(def.cuadros - 1, def.aviso?.[1] ?? 6) })
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.sprite.active || this.logica.escudo || this.logica.estado === 'aturdido' || !this.vivo) return
      const em = this.m.personajes[this.tipo]?.anims.emerger
      const k2 = K.anim(this.tipo, 'emerger', DIRECCIONES[this.dir]!)
      if (!em || !this.escena.anims.exists(k2)) return
      this.animActual = k2
      this.animNombre = 'emerger'
      this.sprite.play({ key: k2, startFrame: em.cuadros - 1 })
    })
  }

  /** La voz del jefe: el rugido, o el aleteo grave de la Polilla Reina */
  private voz(a: { volumen?: number; rate?: number } | number, rate?: number): void {
    const op = typeof a === 'number' ? { volumen: a, rate } : a
    if (this.logica.perfil === 'pez') this.ev.sonido('pez_emerge', { volumen: (op.volumen ?? 1) * 0.8, rate: (op.rate ?? 1) * 0.8 })
    else if (this.logica.perfil === 'rey') this.ev.sonido('rey_canta', { volumen: (op.volumen ?? 1) * 0.6, rate: (op.rate ?? 1) * 0.7 })
    else if (this.logica.perfil === 'dragona') this.ev.sonido('dragona_ruge', { volumen: (op.volumen ?? 1) * 0.7, rate: op.rate })
    else if (this.logica.perfil === 'polilla') this.ev.sonido('polilla_aleteo', { volumen: op.volumen, rate: (op.rate ?? 1) * 0.7 })
    else this.ev.sonido('jefe_rugido', op)
  }

  /* ---------- avisos en el piso ---------- */

  private mostrarAviso(a: NonNullable<OrdenJefe['aviso']>): void {
    const tex = K.obj('aviso_jefe', 'llenar')
    const t: Telegrafo = { ataque: a.ataque, resta: a.seg, total: a.seg }
    if (a.forma === 'anillo') {
      // el anillo de la onda: violeta, con el centro libre bien marcado (ahí no llega)
      t.anillo = { x: a.x, y: a.y, interior: a.interior ?? 0, exterior: a.radio }
      t.g = this.escena.add.graphics().setDepth(PROF.SOMBRAS + 2)
      this.poner('warcry', true)
      this.bloqueoAnimS = a.seg
      this.ev.sonido('bloqueo', { volumen: 0.5, rate: 0.6 })
    } else if (a.forma === 'raices' && this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists('aviso_jefe_llenar')) {
        this.escena.anims.create({ key: 'aviso_jefe_llenar', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: 7 }), frameRate: 8, repeat: 0 })
      }
      // una mancha por raíz, del tamaño del aviso del kit (x1)
      t.extra = (a.puntos ?? []).map((p) => {
        const s2 = this.escena.add.sprite(Math.round(p.x), Math.round(p.y), tex, 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92).setTint(0xc58aff)
        s2.play({ key: 'aviso_jefe_llenar', frameRate: 8 / Math.max(0.2, a.seg) })
        return s2
      })
      this.poner('warcry', true)
      this.bloqueoAnimS = a.seg
      this.voz({ volumen: 0.4, rate: 0.9 })
    } else if (a.ataque === 'ola') {
      // la franja de espuma por donde va a pasar la ola: el aviso_ola del kit repetido en línea (y el contorno de siempre)
      t.linea = { x: a.x, y: a.y, dx: a.dx, dy: a.dy, largo: a.largo, ancho: a.ancho }
      t.g = this.escena.add.graphics().setDepth(PROF.SOMBRAS + 2)
      const k = crearAnimFx(this.escena, this.m, 'aviso_ola')
      if (k && this.escena.textures.exists(K.fx('aviso_ola'))) {
        const paso = 28
        const ang = Math.atan2(a.dy, a.dx)
        t.extra = []
        for (let d = 24; d < a.largo; d += paso) {
          const s2 = this.escena.add.sprite(Math.round(a.x + a.dx * d), Math.round(a.y + a.dy * d), K.fx('aviso_ola'), 0).setRotation(ang).setDepth(PROF.SOMBRAS + 3).setAlpha(0.92)
          s2.play({ key: k, startFrame: Math.floor(d / paso) % 6 })
          t.extra.push(s2)
        }
      }
      this.estirarAtaque('attack_heavy', a.seg)
      this.ev.sonido('pez_emerge', { volumen: 0.5, rate: 0.7 })
    } else if (a.ataque === 'cancion') {
      // la canción de cuna: abre la boca y salen notas de piedra; al terminar se apagan las lámparas
      this.poner('warcry', true)
      this.bloqueoAnimS = a.seg + 0.2
      this.ev.sonido('rey_canta', { volumen: 0.8 })
      for (let i = 0; i < 6; i++) this.escena.time.delayedCall(i * (a.seg * 1000 / 6), () => this.ev.efecto('nota_cuna', this.x + (i % 2 ? 18 : -18), this.y - this.cuerpo.alto - 8 - i * 4, 1))
    } else if (a.ataque === 'zarpazo') {
      // donde cae la zarpa: el aviso de siempre (x1) se llena en lo que dura el aviso
      if (this.escena.textures.exists(tex)) {
        if (!this.escena.anims.exists('aviso_jefe_llenar')) this.escena.anims.create({ key: 'aviso_jefe_llenar', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: 7 }), frameRate: 8, repeat: 0 })
        t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), tex, 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
        t.s.play({ key: 'aviso_jefe_llenar', frameRate: 8 / Math.max(0.2, a.seg) })
      }
      this.estirarAtaque('attack', a.seg)
      this.voz({ volumen: 0.35, rate: 1.3 })
    } else if (a.ataque === 'coletazo') {
      // el medio círculo de la cola, del lado de la heroína: el aviso_cola del kit viene apuntando para arriba
      const k = crearAnimFx(this.escena, this.m, 'aviso_cola')
      if (k && this.escena.textures.exists(K.fx('aviso_cola'))) {
        t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), K.fx('aviso_cola'), 0).setOrigin(0.5, 1).setRotation(Math.atan2(a.dx, -a.dy)).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
        t.s.play({ key: k, frameRate: (this.m.fx.aviso_cola?.cuadros ?? 8) / Math.max(0.2, a.seg) })
      }
      this.estirarAtaque('coletazo', a.seg)
      this.voz({ volumen: 0.35, rate: 1.4 })
    } else if (a.ataque === 'aliento') {
      // toma aire con el pecho al rojo: la franja donde va el fuego, con el aviso_aliento del kit repetido
      t.linea = { x: a.x, y: a.y, dx: a.dx, dy: a.dy, largo: a.largo, ancho: a.ancho }
      t.g = this.escena.add.graphics().setDepth(PROF.SOMBRAS + 2)
      const k = crearAnimFx(this.escena, this.m, 'aviso_aliento')
      if (k && this.escena.textures.exists(K.fx('aviso_aliento'))) {
        const ang = Math.atan2(a.dy, a.dx)
        const px = -a.dy
        const py = a.dx
        t.extra = []
        for (let d = 30; d < a.largo; d += 28) {
          for (const lado of [-0.3, 0.3]) {
            const s2 = this.escena.add.sprite(Math.round(a.x + a.dx * d + px * lado * a.ancho), Math.round(a.y + a.dy * d + py * lado * a.ancho), K.fx('aviso_aliento'), 0).setRotation(ang).setDepth(PROF.SOMBRAS + 3).setAlpha(0.92)
            s2.play({ key: k, startFrame: Math.floor(d / 28) % 6 })
            t.extra.push(s2)
          }
        }
      }
      this.estirarAtaque('aliento', a.seg)
      this.ev.sonido('dragona_ruge', { volumen: 0.4, rate: 1.3 })
    } else if (a.ataque === 'barrido') {
      // la franja por donde va a barrer el brazo
      t.linea = { x: a.x, y: a.y, dx: a.dx, dy: a.dy, largo: a.largo, ancho: a.ancho }
      t.g = this.escena.add.graphics().setDepth(PROF.SOMBRAS + 2)
      this.estirarAtaque('barrido', a.seg)
      this.voz({ volumen: 0.4, rate: 1.2 })
    } else if (a.ataque === 'puno') {
      // donde cae el puño: el aviso_puno del kit se llena en lo que dura el aviso
      const k = crearAnimFx(this.escena, this.m, 'aviso_puno')
      if (k && this.escena.textures.exists(K.fx('aviso_puno'))) {
        t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), K.fx('aviso_puno'), 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
        t.s.play({ key: k, frameRate: (this.m.fx.aviso_puno?.cuadros ?? 8) / Math.max(0.2, a.seg) })
      }
      this.estirarAtaque('attack', a.seg)
      this.voz({ volumen: 0.4, rate: 1.1 })
    } else if (a.ataque === 'mordida') {
      // la boca abierta en el piso: el aviso_mordida del kit se llena en lo que dura el aviso
      const k = crearAnimFx(this.escena, this.m, 'aviso_mordida')
      if (k && this.escena.textures.exists(K.fx('aviso_mordida'))) {
        t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), K.fx('aviso_mordida'), 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
        const def = this.m.fx.aviso_mordida
        t.s.play({ key: k, frameRate: (def?.cuadros ?? 8) / Math.max(0.2, a.seg) })
      } else if (this.escena.textures.exists(tex)) {
        if (!this.escena.anims.exists('aviso_jefe_llenar')) {
          this.escena.anims.create({ key: 'aviso_jefe_llenar', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: 7 }), frameRate: 8, repeat: 0 })
        }
        t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), tex, 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
        t.s.play({ key: 'aviso_jefe_llenar', frameRate: 8 / Math.max(0.2, a.seg) })
      }
      this.estirarAtaque('attack', a.seg)
      this.ev.sonido('pez_emerge', { volumen: 0.6 })
    } else if (a.forma === 'linea') {
      t.linea = { x: a.x, y: a.y, dx: a.dx, dy: a.dy, largo: a.largo, ancho: a.ancho }
      t.g = this.escena.add.graphics().setDepth(PROF.SOMBRAS + 2)
      this.voz({ volumen: 0.4, rate: 1.4 })
      this.poner('idle')
    } else if (a.ataque === 'polvo' && this.escena.textures.exists(K.fx('aviso_polvo'))) {
      // el aviso propio del polvo (96 x 96, en el piso): se llena en lo que dura el aviso
      t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), K.fx('aviso_polvo'), 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
      const k = crearAnimFx(this.escena, this.m, 'aviso_polvo')
      if (k) t.s.play({ key: k, frameRate: 8 / Math.max(0.2, a.seg) })
      const c = this.cuadros.attack_heavy
      if (c) {
        // sube y tiembla: el cuadro del impacto (el 8) cae justo al terminar el aviso
        this.poner('attack_heavy', true, 8 / Math.max(0.2, a.seg))
        this.bloqueoAnimS = a.seg + 0.3
      }
      this.voz(0.5, 1.1)
    } else if (a.ataque !== 'grito' && this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists('aviso_jefe_llenar')) {
        this.escena.anims.create({ key: 'aviso_jefe_llenar', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: 7 }), frameRate: 8, repeat: 0 })
      }
      // el aviso del kit mide 96 px de ancho: x1 para el golpe fuerte (radio 48) y x2 para el pisotón y el salto (radio 96)
      const escala = a.radio > 60 ? 2 : 1
      t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), tex, 0).setScale(escala).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
      t.s.play({ key: 'aviso_jefe_llenar', frameRate: 8 / Math.max(0.2, a.seg) })
      this.voz({ volumen: 0.35, rate: 1.4 })
    }
    // el golpe fuerte y el pisotón se levantan lento hasta el momento del impacto
    if (a.ataque === 'golpe_fuerte' || a.ataque === 'pisoton') {
      const c = this.cuadros.attack_heavy
      if (c) {
        this.poner('attack_heavy', true, c.cuadros / Math.max(0.2, a.seg))
        this.bloqueoAnimS = a.seg + 0.2
      }
    } else if (a.ataque === 'salto') this.poner('idle')
    this.telegrafos.push(t)
  }

  /** F12: la preparación del ataque del Pez Farol dura lo que el aviso: los cuadros de `aviso` se estiran hasta el golpe */
  private estirarAtaque(anim: 'attack' | 'attack_heavy' | 'barrido' | 'coletazo' | 'aliento', seg: number): void {
    const def = this.cuadros[anim]
    const pre = this.m.personajes[this.tipo]?.anims[anim]?.aviso?.[1] ?? 6
    if (!def) return
    this.poner(anim, true, pre / Math.max(0.2, seg))
    this.bloqueoAnimS = seg + 0.2
  }

  private actualizarTelegrafos(dt: number): void {
    for (const t of this.telegrafos) {
      t.resta -= dt
      if (t.g && t.linea) {
        const l = t.linea
        const k = 1 - Math.max(0, t.resta) / t.total
        t.g.clear()
        // la línea de la carga: el contorno rojo y un relleno que avanza hasta el borde de la arena
        const ang = Math.atan2(l.dy, l.dx)
        const nx = -Math.sin(ang) * (l.ancho / 2)
        const ny = Math.cos(ang) * (l.ancho / 2)
        const lx = (f: number) => ({ a: [l.x + l.dx * l.largo * f + nx, l.y + l.dy * l.largo * f + ny], b: [l.x + l.dx * l.largo * f - nx, l.y + l.dy * l.largo * f - ny] })
        const f0 = lx(0)
        const f1 = lx(1)
        t.g.fillStyle(0xff3b2f, 0.18)
        t.g.fillPoints([new Phaser.Geom.Point(f0.a[0]!, f0.a[1]!), new Phaser.Geom.Point(f1.a[0]!, f1.a[1]!), new Phaser.Geom.Point(f1.b[0]!, f1.b[1]!), new Phaser.Geom.Point(f0.b[0]!, f0.b[1]!)], true)
        const fk = lx(k)
        t.g.fillStyle(0xff3b2f, 0.45)
        t.g.fillPoints([new Phaser.Geom.Point(f0.a[0]!, f0.a[1]!), new Phaser.Geom.Point(fk.a[0]!, fk.a[1]!), new Phaser.Geom.Point(fk.b[0]!, fk.b[1]!), new Phaser.Geom.Point(f0.b[0]!, f0.b[1]!)], true)
        // el borde de la carga bien marcado, y en el último instante parpadea
        const fin = t.resta < 0.3 && Math.floor(t.resta * 20) % 2 === 0
        t.g.lineStyle(1, fin ? 0xffffff : 0xff6a4a, 0.95)
        t.g.strokePoints([new Phaser.Geom.Point(f0.a[0]!, f0.a[1]!), new Phaser.Geom.Point(f1.a[0]!, f1.a[1]!), new Phaser.Geom.Point(f1.b[0]!, f1.b[1]!), new Phaser.Geom.Point(f0.b[0]!, f0.b[1]!)], true, true)
      }
      if (t.g && t.anillo) {
        const r = t.anillo
        const k = 1 - Math.max(0, t.resta) / t.total
        const fin = t.resta < 0.3 && Math.floor(t.resta * 20) % 2 === 0
        t.g.clear()
        // la banda que pega se va llenando de afuera hacia adentro; el centro se ve claro y libre
        t.g.fillStyle(0x8a4ac8, 0.16)
        t.g.fillCircle(r.x, r.y, r.exterior)
        t.g.fillStyle(0x8a4ac8, 0.32 * k)
        t.g.fillCircle(r.x, r.y, r.exterior)
        t.g.lineStyle(2, fin ? 0xffffff : 0xc58aff, 0.95)
        t.g.strokeCircle(r.x, r.y, r.exterior)
        // el lugar seguro: turquesa, como los rastros de vida
        t.g.fillStyle(0x0a0b10, 0.55)
        t.g.fillCircle(r.x, r.y, r.interior)
        t.g.lineStyle(2, 0x5ae0d0, 0.95)
        t.g.strokeCircle(r.x, r.y, r.interior)
      }
      for (const e of t.extra ?? []) e.setAlpha(t.resta < 0.3 ? (Math.floor(t.resta * 20) % 2 === 0 ? 1 : 0.55) : 0.92)
      if (t.s) {
        t.s.setPosition(Math.round(t.s.x), Math.round(t.s.y))
        // el aviso del piso parpadea justo antes de caer: es el momento de salir
        t.s.setAlpha(t.resta < 0.3 ? (Math.floor(t.resta * 20) % 2 === 0 ? 1 : 0.55) : 0.92)
      }
    }
    for (let i = this.telegrafos.length - 1; i >= 0; i--) {
      const t = this.telegrafos[i]!
      if (t.resta <= -0.15) {
        t.s?.destroy()
        t.g?.destroy()
        for (const e of t.extra ?? []) e.destroy()
        this.telegrafos.splice(i, 1)
      }
    }
  }

  /** Los avisos de una pelea que se corta, o el del ataque que ya cayó */
  private limpiarTelegrafos(_ataque?: string): void {
    for (const t of this.telegrafos) {
      t.s?.destroy()
      t.g?.destroy()
      for (const e of t.extra ?? []) e.destroy()
    }
    this.telegrafos = []
  }

  /** Para las pruebas: cuántos avisos hay y sus datos */
  avisos(): { ataque: string; forma: string; resta: number; total: number }[] {
    return this.telegrafos.map((t) => ({ ataque: t.ataque, forma: t.linea ? 'linea' : t.anillo ? 'anillo' : t.extra ? 'raices' : t.s ? 'circulo' : 'otro', resta: Math.round(t.resta * 100) / 100, total: t.total }))
  }

  private poner(anim: string, forzar = false, fps?: number): void {
    const ok = this.m.personajes[this.tipo]!.anims
    let a = anim
    if (!ok[a]) a = ok.idle ? 'idle' : Object.keys(ok)[0]!
    const key = K.anim(this.tipo, a, DIRECCIONES[this.dir]!)
    if (key === this.animActual && !forzar) return
    this.animActual = key
    this.animNombre = a
    if (this.escena.anims.exists(key)) this.sprite.play(fps ? { key, frameRate: fps } : key)
  }

  private colocar(): void {
    const x = Math.round(this.x)
    const y = Math.round(this.y)
    // el salto no se dibuja dentro de la celda: el taller dice cuánto subir el sprite en cada cuadro y la sombra queda abajo
    const sube = this.elevacion()
    this.sprite.setPosition(x, y - sube).setDepth(PROF.OBJETOS + this.y)
    this.sombra.poner(this.x, this.y)
    if (this.enAgua) this.sombra.setVisible(false)
    this.pintarTono()
    // el estandarte con el nombre, arriba de la cabeza (crece con la celda del jefe)
    if (this.estandarte) this.estandarte.setPosition(x, y - this.cuerpo.alto - 30).setDepth(PROF.OBJETOS + 9300)
  }

  /** El último lugar donde se vio la lucecita (para la luz que vuela al faro cuando se apaga en `die`) */
  ultimaAntena: { x: number; y: number } | null = null

  /**
   * F12: dónde está la lucecita de la antena en este cuadro (el kit trae el punto por dirección y cuadro), o null si está
   * bajo el agua. Sin datos del kit, fija arriba del pez.
   */
  antena(): { x: number; y: number } | null {
    if (!this.luzAntena) return null
    const def = this.m.personajes[this.tipo]?.anims[this.animNombre]
    const puntos = def?.antena ?? def?.corona ?? def?.boca
    if (!puntos) {
      const p = { x: this.x, y: this.y - JEFE_PEZ.antenaAlto }
      this.ultimaAntena = p
      return p
    }
    const f = Math.max(0, (this.sprite.anims.currentFrame?.index ?? 1) - 1)
    const pt = puntos[this.dir]?.[f]
    if (!pt) return null
    const p = { x: this.sprite.x + pt[0], y: this.sprite.y + pt[1] }
    this.ultimaAntena = p
    return p
  }

  /** Cuánto sube el sprite en este cuadro (el `leap` del minotauro o el salto del Pez Farol traen `elevacion`), o 0 */
  private elevacion(): number {
    const a = this.sprite.anims.currentAnim
    if (!a || !this.animNombre || !a.key.includes(`_${this.animNombre}_`)) return 0
    const el = this.m.personajes[this.tipo]?.anims[this.animNombre]?.elevacion
    const f = this.sprite.anims.currentFrame?.index ?? 1
    return el ? Math.round(el[Math.max(0, Math.min(el.length - 1, f - 1))] ?? 0) : 0
  }

  destruir(): void {
    this.limpiarTelegrafos()
    this.sprite.destroy()
    this.sombra.destroy()
    this.estandarte?.destroy()
  }
}
