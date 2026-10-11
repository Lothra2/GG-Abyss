import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { Entidad } from '../kit/mapa'
import { K } from '../kit/claves'
import { crearAnimsPersonaje } from '../kit/anims'
import { DIRECCIONES, indiceDireccion } from '../logic/direccion'
import type { Grilla } from '../logic/grilla'
import { moverCuerpo } from '../logic/movimiento'
import { fx, juego } from '../logic/azar'
import { danarJefe, despertar, nuevoJefe, pensarJefe, reposar, type EstadoJefe, type Jefe, type OrdenJefe } from '../logic/jefe'
import { IMPACTO, JEFE, JEFE_CAMPANA } from '../config/balance'
import { PROF } from '../config/juego'
import { Sombra } from './Sombras'
import { texto } from './Texto'
import type { Atacable } from './Enemigos'
import { cuerpoJefe } from '../logic/capas'

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
  alFase2(): void
  alMorir(): void
}

export interface ContextoJefe {
  dt: number
  heroeX: number
  heroeY: number
  heroeVivo: boolean
  modoPeque: boolean
  ratasVivas: number
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
  /** la pelea está en marcha (despertó y no murió ni se reposó) */
  peleando = false

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private grilla: Grilla,
    ent: Entidad,
    arena: { x: number; y: number; radio: number },
    vida: number,
    private ev: EventosJefe,
  ) {
    this.tipo = String(ent.props.enemigo ?? 'minotauro')
    this.nombre = String(ent.props.nombre ?? 'Minotauro del Bosque')
    this.titulo = String(ent.props.titulo ?? 'Guardián de Las Alturas')
    this.radioArena = arena.radio
    const campana = this.tipo === 'guardian_campana'
    const vidaMax = campana ? JEFE_CAMPANA.vida : JEFE.vida
    this.logica = nuevoJefe(arena.x, arena.y, vidaMax, campana ? 'campana' : 'minotauro')
    this.logica.vida = Math.max(1, Math.min(vidaMax, vida))
    if ((this.logica.vida / this.logica.vidaMax) * 100 <= JEFE.fase2Pct) this.logica.fase = 2
    // un guardado que ya pasó de raicesPct no vuelve a enseñarlas
    if (campana && (this.logica.vida / this.logica.vidaMax) * 100 <= JEFE_CAMPANA.raicesPct) this.logica.raicesVistas = true
    const p = m.personajes[this.tipo]!
    this.celda = p.celda
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
    const r = danarJefe(this.logica, dano)
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
    if (r.fase2) {
      this.limpiarTelegrafos()
      this.ev.alFase2()
      this.ev.sonido('jefe_rugido', { volumen: 0.9, rate: 0.8 })
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
    this.ev.sonido('jefe_rugido', { volumen: 1 })
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
    this.ev.sonido('jefe_rugido', { volumen: 1, rate: 0.5 })
    this.ev.sacudir(true)
    this.ev.alMorir()
  }

  /**
   * Después de caer: cuando termina de morir, se deshace de a poco en polvo (alPolvo suelta partículas donde está)
   * y la sombra se va con él. En tiempo real, para que la cámara lenta lo haga más solemne.
   */
  desvanecer(alPolvo: (x: number, y: number) => void): void {
    const def = this.cuadros.die
    const espera = def ? (def.cuadros / def.fps) * 1000 : 600
    this.escena.time.delayedCall(espera + 250, () => {
      if (!this.sprite.active) return
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
    const o = pensarJefe(j, { dt: c.dt, heroeX: c.heroeX, heroeY: c.heroeY, heroeVivo: c.heroeVivo, modoPeque: c.modoPeque, ratasVivas: c.ratasVivas }, juego())
    this.ejecutar(o, c)
    this.colocar()
  }

  private ejecutar(o: OrdenJefe, c: ContextoJefe): void {
    const j = this.logica
    if (o.mirarA) this.dir = indiceDireccion(o.mirarA.x - j.x, o.mirarA.y - j.y)
    if (o.mover) {
      const paso = o.mover.vel * c.dt
      const r = moverCuerpo(this.grilla, { x: j.x, y: j.y, radio: 14 }, o.mover.dx * paso, o.mover.dy * paso)
      // no se sale de la arena
      const dx = r.x - j.cx
      const dy = r.y - j.cy
      const tope = this.radioArena - JEFE.margenBorde
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
      this.ev.sonido('jefe_rugido', { volumen: 0.7, rate: 1.2 })
      this.ev.efecto('grito_de_guerra', j.x, j.y - this.cuerpo.alto)
    }
    if (o.saltar) {
      this.poner('leap', true)
      this.bloqueoAnimS = JEFE.salto.duracionS + 0.2
      this.ev.sonido('esquiva', { volumen: 0.7, rate: 0.5 })
    }
    if (o.cargar) {
      this.poner('charge', true)
      this.ev.sonido('jefe_rugido', { volumen: 0.6, rate: 1.5 })
    }
    if (o.aturdido) {
      this.poner('hit', true)
      this.bloqueoAnimS = o.aturdido
      this.ev.sacudir(true)
      this.ev.sonido('jefe_pisoton', { volumen: 0.8, rate: 0.7 })
    }
    if (o.golpe) this.soltarGolpe(o.golpe)
    if (o.raices) this.ev.raices?.(o.raices.puntos, o.raices.radio, o.raices.seg)
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
    else if (e === 'quieto' || e === 'intro') this.poner('idle')
    else if (e === 'aviso') this.poner(this.logica.ataque === 'grito' ? 'warcry' : 'idle')
    else if (e === 'cargando') this.poner('charge')
    else if (e === 'aturdido') this.poner('idle')
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
    if (g.forma === 'raices') {
      for (const p of g.puntos ?? []) this.ev.golpeCirculo(p.x, p.y, g.radio, g.dano, true)
      this.ev.sonido('romper', { volumen: 0.8, rate: 0.6 })
      this.ev.sacudir(false)
      this.limpiarTelegrafos(g.ataque)
      return
    }
    this.ev.golpeCirculo(g.x, g.y, g.radio, g.dano, g.ataque !== 'golpe')
    if (g.ataque === 'pisoton' || g.ataque === 'salto') {
      this.ev.efecto('onda_pisoton', g.x, g.y, 2)
      this.ev.sonido('jefe_pisoton', { volumen: 0.9 })
      this.ev.sacudir(true)
    } else if (g.ataque === 'golpe_fuerte') {
      this.ev.sonido('jefe_pisoton', { volumen: 0.7, rate: 1.2 })
      this.ev.sacudir(false)
    } else this.ev.sonido('golpe', { volumen: 0.7, rate: 0.6 })
    this.limpiarTelegrafos(g.ataque)
    void j
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
      this.ev.sonido('jefe_rugido', { volumen: 0.4, rate: 0.9 })
    } else if (a.forma === 'linea') {
      t.linea = { x: a.x, y: a.y, dx: a.dx, dy: a.dy, largo: a.largo, ancho: a.ancho }
      t.g = this.escena.add.graphics().setDepth(PROF.SOMBRAS + 2)
      this.ev.sonido('jefe_rugido', { volumen: 0.4, rate: 1.4 })
      this.poner('idle')
    } else if (a.ataque !== 'grito' && this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists('aviso_jefe_llenar')) {
        this.escena.anims.create({ key: 'aviso_jefe_llenar', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: 7 }), frameRate: 8, repeat: 0 })
      }
      // el aviso del kit mide 96 px de ancho: x1 para el golpe fuerte (radio 48) y x2 para el pisotón y el salto (radio 96)
      const escala = a.radio > 60 ? 2 : 1
      t.s = this.escena.add.sprite(Math.round(a.x), Math.round(a.y), tex, 0).setScale(escala).setDepth(PROF.SOMBRAS + 2).setAlpha(0.92)
      t.s.play({ key: 'aviso_jefe_llenar', frameRate: 8 / Math.max(0.2, a.seg) })
      this.ev.sonido('jefe_rugido', { volumen: 0.35, rate: 1.4 })
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
    if (this.escena.anims.exists(key)) this.sprite.play(fps ? { key, frameRate: fps } : key)
  }

  private colocar(): void {
    const x = Math.round(this.x)
    const y = Math.round(this.y)
    this.sprite.setPosition(x, y).setDepth(PROF.OBJETOS + this.y)
    this.sombra.poner(this.x, this.y)
    this.pintarTono()
    // la dirección de los ataques sigue a la heroína solo si no hay animación en curso
    if (this.estandarte) this.estandarte.setPosition(x, y - 100).setDepth(PROF.OBJETOS + 9300)
  }

  destruir(): void {
    this.limpiarTelegrafos()
    this.sprite.destroy()
    this.sombra.destroy()
    this.estandarte?.destroy()
  }
}
