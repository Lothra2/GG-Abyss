import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { Entidad } from '../kit/mapa'
import { K } from '../kit/claves'
import { crearAnimsPersonaje } from '../kit/anims'
import { DIRECCIONES, indiceDireccion } from '../logic/direccion'
import type { Grilla } from '../logic/grilla'
import { moverCuerpo } from '../logic/movimiento'
import { aturdir, matar, nuevoEnemigoIA, pensar, type ConfigIA, type EnemigoIA } from '../logic/ia'
import { juego } from '../logic/azar'
import { COMBATE, ENEMIGOS, GOLPE_EN, IMPACTO, TROL_ELITE, type EnemigoBalance } from '../config/balance'
import { PROF } from '../config/juego'
import { Sombra } from './Sombras'
import { texto } from './Texto'
import type { Blanco } from './Proyectiles'

/** Alto del cuerpo (para barra, marca y choque de proyectiles) y radio de choque por tipo */
const CUERPO: Record<string, { alto: number; radio: number; sombra: number; barra: number }> = {
  rata: { alto: 18, radio: 10, sombra: 18, barra: 22 },
  calabaza: { alto: 24, radio: 12, sombra: 22, barra: 26 },
  goblin_arquero: { alto: 30, radio: 11, sombra: 20, barra: 26 },
  trol: { alto: 46, radio: 18, sombra: 40, barra: 40 },
}
const CUERPO_DEFECTO = { alto: 28, radio: 12, sombra: 22, barra: 26 }

export interface ContextoEnemigos {
  heroe: { x: number; y: number; vivo: boolean }
  modoPeque: boolean
  dt: number
}

export interface EventosEnemigos {
  /** golpe cuerpo a cuerpo: ¿llegó a la heroína? Devuelve el daño ya calculado de [min,max] */
  golpeCuerpo(e: Enemigo, rango: readonly [number, number], radio: number): void
  disparar(e: Enemigo, angulo: number): void
  /** el golpe pesado cae en una elipse alrededor del trol */
  golpePesado(e: Enemigo, rango: readonly [number, number], radio: number): void
  alMorir(e: Enemigo): void
  efecto(nombre: string, x: number, y: number): void
  sonido(nombre: string, op?: { volumen?: number; rate?: number }): void
  sacudir(): void
  curo(e: Enemigo): void
}

/** Todo lo que la heroína puede marcar y golpear: los enemigos del mapa y el jefe */
export interface Atacable extends Blanco {
  readonly id: number
  readonly tipo: string
  readonly vida: number
  readonly vidaMax: number
  readonly cuerpo: { alto: number; radio: number }
  readonly esJefe?: boolean
  golpe(x: number, y: number, margen?: number): boolean
  marcar(v: boolean): void
  recibir(dano: number, desdeX?: number, desdeY?: number): boolean
}

/** Un enemigo del mapa: sprite en 8 direcciones, sombra, barra de vida (solo si recibió daño) y su cabeza (logic/ia). */
export class Enemigo implements Atacable {
  readonly tipo: string
  readonly cfg: EnemigoBalance
  readonly ia: EnemigoIA
  readonly sprite: Phaser.GameObjects.Sprite
  readonly sombra: Sombra
  readonly nombre: string
  readonly elite: boolean
  readonly cuerpo: { alto: number; radio: number; sombra: number; barra: number }
  private fondoBarra: Phaser.GameObjects.NineSlice
  private relleno: Phaser.GameObjects.NineSlice
  private estandarte?: Phaser.GameObjects.Container
  private aviso?: Phaser.GameObjects.Sprite
  private dir = 0
  private animActual = ''
  private bloqueoAnimS = 0
  private golpeEn: { resta: number; tipo: 'normal' | 'pesado' } | null = null
  private barraS = 0
  private marcado = false
  private destelloFin = 0
  private muertoS = 0
  private cfgIA: ConfigIA
  private durAtaque: number
  private cuadros: Record<string, { cuadros: number; fps: number }> = {}
  vivo = true
  id: number

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private grilla: Grilla,
    readonly ent: Entidad,
    private ev: EventosEnemigos,
  ) {
    this.tipo = String(ent.props.enemigo ?? 'rata')
    this.id = ent.id
    this.cfg = ENEMIGOS[this.tipo] ?? ENEMIGOS.rata!
    this.elite = ent.props.elite === true
    this.nombre = String(ent.props.nombre ?? (this.elite ? 'Trol del Puente' : this.tipo))
    this.cuerpo = CUERPO[this.tipo] ?? CUERPO_DEFECTO
    const p = m.personajes[this.tipo]!
    this.ia = nuevoEnemigoIA(ent.x, ent.y, this.cfg.vida)
    for (const [n, a] of Object.entries(p.anims)) this.cuadros[n] = { cuadros: a.cuadros, fps: a.fps }
    const aa = p.anims[this.cfg.anim]
    this.durAtaque = aa ? aa.cuadros / aa.fps : 0.5
    this.cfgIA = {
      ve: this.cfg.ve,
      alcance: this.cfg.alcance,
      velocidad: this.cfg.velocidad,
      ataquesPorSeg: this.cfg.ataquesPorSeg,
      duracionAtaqueS: this.durAtaque,
      huyeSi: this.cfg.huyeSi,
      ...(this.elite
        ? {
            pesado: { cadaS: TROL_ELITE.golpePesadoCadaS, radio: TROL_ELITE.golpePesadoRadio, avisoS: TROL_ELITE.golpePesadoAvisoS },
            grito: { vidaPct: TROL_ELITE.gritoVidaPct, velocidadPct: TROL_ELITE.gritoVelocidadPct, duracionS: 0.9 },
          }
        : {}),
    }
    crearAnimsPersonaje(escena, m, this.tipo)
    this.sprite = escena.add.sprite(ent.x, ent.y, K.pers(this.tipo, 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda)
    this.sombra = new Sombra(escena, this.cuerpo.sombra)
    this.fondoBarra = escena.add.nineslice(0, 0, K.ui('barra_vida_enemigo'), undefined, this.cuerpo.barra, 3, 1, 1, 1, 1).setOrigin(0.5, 1).setTint(0x1a1020).setVisible(false)
    this.relleno = escena.add.nineslice(0, 0, K.ui('barra_vida_enemigo'), undefined, this.cuerpo.barra, 3, 1, 1, 1, 1).setOrigin(0, 1).setTint(0xd8423a).setVisible(false)
    if (this.elite && escena.textures.exists(K.ui('estandarte'))) {
      const img = escena.add.image(0, 0, K.ui('estandarte')).setOrigin(0.5, 1)
      const t = texto(escena, 0, -14, this.nombre, 'fuente_ui', 1, { origen: [0.5, 0.5] })
      this.estandarte = escena.add.container(0, 0, [img, t])
    }
    this.dir = (ent.id * 3) % 8
    this.poner('idle', true)
    this.colocar()
  }

  get x(): number {
    return this.ia.x
  }
  get y(): number {
    return this.ia.y
  }
  get radioHit(): number {
    return this.cuerpo.radio
  }
  get altura(): number {
    return this.cuerpo.alto / 2
  }
  get vida(): number {
    return this.ia.vida
  }
  get vidaMax(): number {
    return this.ia.vidaMax
  }
  get estado(): string {
    return this.ia.estado
  }

  /** ¿cae el toque (en coordenadas de mundo) sobre su cuerpo? Con margen para el dedo. */
  golpe(x: number, y: number, margen = 10): boolean {
    if (!this.vivo) return false
    return Math.abs(x - this.x) <= this.cuerpo.radio + margen && y >= this.y - this.cuerpo.alto - margen && y <= this.y + 8 + margen
  }

  marcar(v: boolean): void {
    this.marcado = v
    if (!v) this.sprite.clearTint()
  }

  /** Daño recibido. Devuelve true si murió con este golpe. */
  recibir(dano: number, desdeX?: number, desdeY?: number): boolean {
    if (!this.vivo) return false
    this.ia.vida = Math.max(0, this.ia.vida - dano)
    this.barraS = 4
    this.destellar()
    if (this.ia.vida <= 0) {
      this.morir()
      return true
    }
    // un golpe corta el ataque que se preparaba (menos el aviso del trol)
    if (this.ia.estado !== 'aviso' && this.ia.estado !== 'grito') {
      this.golpeEn = null
      this.aviso?.destroy()
      this.aviso = undefined
      aturdir(this.ia, COMBATE.aturdidoS)
      this.poner('hit', true)
      this.bloqueoAnimS = COMBATE.aturdidoS
      if (desdeX !== undefined && desdeY !== undefined) {
        const dx = this.x - desdeX
        const dy = this.y - desdeY
        const d = Math.hypot(dx, dy) || 1
        const r = moverCuerpo(this.grilla, { x: this.x, y: this.y, radio: 8 }, (dx / d) * COMBATE.empujeHit, (dy / d) * COMBATE.empujeHit)
        this.ia.x = r.x
        this.ia.y = r.y
      }
    }
    this.ev.sonido('enemigo_dolor', { volumen: 0.5, rate: 0.9 + juego().next() * 0.2 })
    return false
  }

  /** El destello blanco del golpe (en tiempo real, vuelve a la marca si estaba marcado) */
  private destellar(): void {
    this.sprite.setTintFill(0xffffff)
    this.destelloFin = this.escena.time.now + IMPACTO.destelloMs
    this.escena.time.delayedCall(IMPACTO.destelloMs, () => {
      if (!this.sprite.active) return
      this.sprite.clearTint()
      if (this.marcado && this.vivo) this.sprite.setTint(0xffa0a0)
    })
  }

  private morir(): void {
    this.vivo = false
    matar(this.ia)
    this.golpeEn = null
    this.aviso?.destroy()
    this.aviso = undefined
    this.marcar(false)
    this.poner('die', true)
    this.muertoS = 1.6
    this.ev.sonido('enemigo_muere', { volumen: 0.7 })
    this.ev.alMorir(this)
  }

  /** Vuelve a casa curado (tras el rescate de Thor) */
  reiniciar(): void {
    if (!this.vivo) return
    this.golpeEn = null
    this.aviso?.destroy()
    this.aviso = undefined
    this.ia.estado = 'volver'
    this.ia.cd = 1
  }

  update(dt: number, ctx: ContextoEnemigos): void {
    if (!this.vivo) {
      if (this.muertoS > 0) {
        this.muertoS -= dt
        if (this.muertoS <= 0) {
          this.escena.tweens.add({ targets: [this.sprite], alpha: 0, duration: 500, onComplete: () => this.destruir() })
          this.escena.tweens.add({ targets: this.sombra.img, alpha: 0, duration: 500 })
        }
      }
      return
    }
    this.bloqueoAnimS = Math.max(0, this.bloqueoAnimS - dt)
    this.barraS = Math.max(0, this.barraS - dt)

    // el golpe pendiente de un ataque ya empezado
    if (this.golpeEn) {
      this.golpeEn.resta -= dt
      if (this.golpeEn.resta <= 0) {
        const g = this.golpeEn
        this.golpeEn = null
        if (g.tipo === 'normal') this.ejecutarGolpe()
      }
    }

    const antes = { x: this.x, y: this.y }
    const orden = pensar(this.ia, this.cfgIA, { dt, heroeX: ctx.heroe.x, heroeY: ctx.heroe.y, heroeVivo: ctx.heroe.vivo, modoPeque: ctx.modoPeque }, juego())

    if (orden.mirarA) this.dir = indiceDireccion(orden.mirarA.x - this.x, orden.mirarA.y - this.y)
    let mueve = false
    if (orden.mover) {
      const o = orden.mover
      const paso = o.vel * dt
      const r = moverCuerpo(this.grilla, { x: this.x, y: this.y, radio: this.elite ? 10 : 8 }, o.dx * paso, o.dy * paso)
      this.ia.x = r.x
      this.ia.y = r.y
      mueve = r.movido > 0.05
      if (!orden.mirarA) this.dir = indiceDireccion(o.dx, o.dy)
    }
    if (orden.curar) this.ev.curo(this)
    if (orden.gritar) {
      this.ev.sonido('jefe_rugido', { volumen: 0.5, rate: 1.3 })
      this.ev.efecto('grito_de_guerra', this.x, this.y - this.cuerpo.alto)
      this.poner('warcry', true)
      this.bloqueoAnimS = 0.9
    }
    if (orden.atacar) this.comenzarAtaque()
    if (orden.avisoS) this.comenzarAviso(orden.avisoS)
    if (orden.golpePesado) this.soltarGolpePesado()

    if (this.bloqueoAnimS <= 0) {
      if (this.ia.estado === 'atacando' || this.ia.estado === 'aviso') {
        // la animación de ataque o aviso sigue corriendo
      } else this.poner(mueve || Math.hypot(this.x - antes.x, this.y - antes.y) > 0.05 ? 'walk' : 'idle')
    }
  }

  private comenzarAtaque(): void {
    const dur = this.durAtaque
    this.golpeEn = { resta: dur * GOLPE_EN.enemigo, tipo: 'normal' }
    this.poner(this.cfg.anim, true)
    this.bloqueoAnimS = dur
    this.ev.sonido(this.cfg.proyectil ? 'arco' : 'golpe', { volumen: 0.35, rate: 0.8 + juego().next() * 0.3 })
  }

  private ejecutarGolpe(): void {
    if (!this.vivo) return
    if (this.cfg.proyectil) {
      // dispara hacia donde mira
      const v = DIRECCIONES[this.dir]!
      const ang = { down: Math.PI / 2, down_left: (3 * Math.PI) / 4, left: Math.PI, up_left: (-3 * Math.PI) / 4, up: -Math.PI / 2, up_right: -Math.PI / 4, right: 0, down_right: Math.PI / 4 }[v]!
      this.ev.disparar(this, ang)
    } else this.ev.golpeCuerpo(this, this.cfg.dano, this.cfg.alcance + 18)
  }

  private comenzarAviso(seg: number): void {
    const def = this.cuadros.attack_heavy
    const tex = K.obj('aviso_jefe', 'llenar')
    if (this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists('aviso_jefe_llenar')) {
        this.escena.anims.create({ key: 'aviso_jefe_llenar', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: 7 }), frameRate: 8, repeat: 0 })
      }
      this.aviso?.destroy()
      this.aviso = this.escena.add.sprite(Math.round(this.x), Math.round(this.y), tex, 0).setDepth(PROF.SOMBRAS + 2).setAlpha(0.9)
      this.aviso.play({ key: 'aviso_jefe_llenar', frameRate: 8 / Math.max(0.2, seg) })
    }
    // el golpe pesado se levanta lento: la animación se estira hasta el momento del impacto
    if (def && this.escena.anims.exists(K.anim(this.tipo, 'attack_heavy', DIRECCIONES[this.dir]!))) {
      this.poner('attack_heavy', true, def.cuadros / Math.max(0.2, seg))
    }
    this.ev.sonido('jefe_rugido', { volumen: 0.35, rate: 1.4 })
  }

  private soltarGolpePesado(): void {
    this.aviso?.destroy()
    this.aviso = undefined
    this.ev.sonido('jefe_pisoton', { volumen: 0.6, rate: 1.1 })
    this.ev.sacudir()
    this.ev.golpePesado(this, TROL_ELITE.golpePesadoDano, TROL_ELITE.golpePesadoRadio)
    this.bloqueoAnimS = 0.3
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
    if (this.marcado && this.vivo && this.escena.time.now >= this.destelloFin) this.sprite.setTint(0xffa0a0)
    const mostrar = this.barraS > 0 && this.vivo
    const by = y - this.cuerpo.alto - 8
    this.fondoBarra.setVisible(mostrar).setPosition(x, by).setDepth(PROF.OBJETOS + 9400)
    const w = Math.max(1, Math.round(this.cuerpo.barra * (this.ia.vida / this.ia.vidaMax)))
    this.relleno.setVisible(mostrar).setPosition(x - this.cuerpo.barra / 2, by).setSize(w, 3).setDepth(PROF.OBJETOS + 9401)
    if (this.estandarte) this.estandarte.setPosition(x, y - this.cuerpo.alto - 14).setDepth(PROF.OBJETOS + 9300).setVisible(this.vivo)
    if (this.aviso) this.aviso.setPosition(x, y)
  }

  /** Después de pensar y moverse: acomoda sprites. Se llama cada cuadro. */
  actualizarVista(): void {
    this.colocar()
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v)
    this.sombra.setVisible(v)
    if (!v) {
      this.fondoBarra.setVisible(false)
      this.relleno.setVisible(false)
    }
    this.estandarte?.setVisible(v && this.vivo)
  }

  destruir(): void {
    this.sprite.destroy()
    this.sombra.destroy()
    this.fondoBarra.destroy()
    this.relleno.destroy()
    this.estandarte?.destroy()
    this.aviso?.destroy()
    this.destruido = true
  }

  destruido = false
}

/** Todos los enemigos del mapa */
export class Enemigos {
  readonly lista: Enemigo[] = []
  /** el jefe y lo que se sume después: se marcan y se golpean igual que los demás */
  readonly adicionales: Atacable[] = []

  get todos(): Atacable[] {
    return [...this.lista, ...this.adicionales]
  }

  constructor(escena: Phaser.Scene, m: Manifest, grilla: Grilla, entidades: readonly Entidad[], ev: EventosEnemigos) {
    for (const e of entidades) {
      if (e.tipo !== 'enemigo') continue
      if (e.props.tras_jefe === true) continue
      const tipo = String(e.props.enemigo ?? '')
      if (!m.personajes[tipo]) continue
      this.lista.push(new Enemigo(escena, m, grilla, e, ev))
    }
  }

  get vivos(): Enemigo[] {
    return this.lista.filter((e) => e.vivo)
  }

  /** El enemigo bajo un toque, o null */
  golpe(x: number, y: number): Atacable | null {
    let mejor: Atacable | null = null
    let mejorD = Infinity
    for (const e of this.todos) {
      if (!e.golpe(x, y)) continue
      const d = Math.hypot(e.x - x, e.y - 14 - y)
      if (d < mejorD) {
        mejorD = d
        mejor = e
      }
    }
    return mejor
  }

  /** Vivos dentro de un radio de (x, y), del más cercano al más lejano */
  enRadio(x: number, y: number, radio: number): Atacable[] {
    return this.todos
      .filter((e) => e.vivo && Math.hypot(e.x - x, e.y - y) <= radio)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
  }

  masCercano(x: number, y: number, radio: number): Atacable | null {
    return this.enRadio(x, y, radio)[0] ?? null
  }

  /** Los lejanos ni piensan ni se dibujan (cuesta menos y no cambia nada: vuelven a su sitio) */
  update(dt: number, ctx: ContextoEnemigos, vistaRadio = 900): void {
    for (const e of this.lista) {
      if (e.destruido) continue
      const lejos = Math.hypot(e.x - ctx.heroe.x, e.y - ctx.heroe.y) > vistaRadio
      if (lejos && e.vivo) {
        e.setVisible(false)
        continue
      }
      e.setVisible(true)
      e.update(dt, ctx)
      e.actualizarVista()
    }
  }

  /** Una rata invocada por el grito del jefe: pelea como las del mapa y se cuenta aparte */
  invocar(escena: Phaser.Scene, m: Manifest, grilla: Grilla, tipo: string, x: number, y: number, ev: EventosEnemigos): Enemigo | null {
    if (!m.personajes[tipo]) return null
    const id = 900000 + this.lista.length
    const ent: Entidad = { id, tipo: 'enemigo', x, y, props: { enemigo: tipo, invocada: true } }
    const e = new Enemigo(escena, m, grilla, ent, ev)
    // salen persiguiendo, no paseando
    e.ia.cd = 0.6
    this.lista.push(e)
    return e
  }

  /** Cuántas invocadas siguen vivas */
  get invocadasVivas(): number {
    return this.lista.filter((e) => e.vivo && e.ent.props.invocada === true).length
  }

  /** Quita las invocadas (al terminar o reiniciar la pelea) */
  quitarInvocadas(): void {
    for (const e of this.lista) if (e.ent.props.invocada === true && !e.destruido) e.destruir()
    for (let i = this.lista.length - 1; i >= 0; i--) if (this.lista[i]!.ent.props.invocada === true) this.lista.splice(i, 1)
  }

  /** Tras el rescate de Thor: todos vuelven a casa */
  reiniciarTodos(): void {
    for (const e of this.lista) e.reiniciar()
  }

  destruir(): void {
    for (const e of this.lista) if (!e.destruido) e.destruir()
    this.lista.length = 0
  }
}
