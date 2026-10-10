import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { crearAnimFx } from '../kit/anims'
import { juego } from '../logic/azar'
import { DIRECCIONES, vectorDe } from '../logic/direccion'
import type { Partida } from '../logic/guardado'
import { rescatar } from '../logic/rescate'
import { claseDe, fraccionXp, ganarXp, regenerar, statsDe, type StatsHeroe } from '../logic/stats'
import { danoEnemigo, escudoDeThor, recibirDano, tirarGolpe, type Golpe } from '../logic/combate'
import { abanico, Recargas } from '../logic/habilidades'
import { RelojDesenterrar, RelojesThor, rangoMordida } from '../logic/thorCombate'
import { bonosDeEquipo } from '../logic/equipo'
import type { TipoImpacto } from '../logic/impacto'
import { sortearNormal } from '../logic/botin'
import type { Catalogo } from '../logic/catalogo'
import { BOTIN, COMBATE, ENEMIGOS, GOLPE_EN, IMPACTO, JEFE, HABILIDADES, MODO_PEQUE, PROYECTIL, THOR, CLASES, type ClaseId } from '../config/balance'
import { Colchon } from '../logic/colchon'
import { PROF } from '../config/juego'
import type { Heroina } from './Heroina'
import type { ThorSprite } from './ThorSprite'
import type { Atacable, Enemigos } from './Enemigos'
import type { Proyectiles, Blanco } from './Proyectiles'
import type { Numeros } from './Numeros'
import type { Sonido } from './Sonido'

export interface DepsCombate {
  escena: Phaser.Scene
  m: Manifest
  heroina: Heroina
  thor: ThorSprite
  enemigos: Enemigos
  proyectiles: Proyectiles
  numeros: Numeros
  sonido: Sonido
  partida: () => Partida
  claseManifest?: string
  /** dónde reaparece la heroína tras el rescate (la última fogata) */
  puntoRescate: () => { x: number; y: number }
  cat: Catalogo
  /** un enemigo cayó: Mundo sortea su botín y lo suelta */
  alBotinEnemigo: (e: Atacable) => void
  /** Thor desenterró un objeto */
  soltarObjeto: (id: string, x: number, y: number) => void
  /** bloquea y desbloquea la entrada del jugador (al caer y al volver) */
  bloquearEntrada: (v: boolean) => void
  guardar: () => void
  /** la cámara salta a la heroína tras el rescate */
  centrarCamara: () => void
  /** el peso del golpe: pausa cortita y sacudida (Mundo decide cuánto) */
  alImpacto?: (tipo: TipoImpacto) => void
  /** el golpe cuerpo a cuerpo no llegó (el blanco se alejó): se muestra el fallo */
  alFallar?: (x: number, y: number) => void
  /** F7 prendido (el colchón de entrada es de F7) */
  mejoras?: () => boolean
}

interface Aura {
  s: Phaser.GameObjects.Sprite
  resta: number
  dx: number
  dy: number
}

const POCION_VIDA = (id: string) => id.includes('health')
const POCION_MANA = (id: string) => id.includes('mana')

/**
 * El combate de la heroína (PLAN.md F2): ataque básico por toque al enemigo, dos habilidades por clase, pociones,
 * XP y niveles, escudo, Thor y el rescate cuando la vida llega a 0. Las reglas están en src/logic, aquí solo se juntan con Phaser.
 */
export class Combate {
  readonly clase: ClaseId
  stats: StatsHeroe
  readonly recargas: Recargas
  objetivo: Atacable | null = null
  escudo = 0
  escudoS = 0
  invulnerableS = 0
  bloqueoS = 0
  sinDanoS = 99
  caido = false
  rescates = 0
  enRescate = false
  muertes = 0
  ultimoNivel = 0
  private atqCd = 0
  private reaproxS = 0
  private canalizando = false
  private canalCd = 0
  private torbellino: { resta: number; cada: number } | null = null
  private curacion: { vida: number; mana: number; resta: number } | null = null
  private relojes = new RelojesThor()
  private reloj_desenterrar = new RelojDesenterrar(juego())
  private auras: Aura[] = []
  private fxEscudo?: Phaser.GameObjects.Sprite
  /** cuerpo de la heroína para los proyectiles enemigos */
  readonly cuerpo: Blanco

  constructor(private d: DepsCombate) {
    const p = d.partida()
    this.clase = claseDe(d.heroina.id, d.claseManifest ?? d.m.personajes[d.heroina.id]?.clase)
    this.stats = this.calcularStats()
    this.recargas = new Recargas(this.clase)
    // una partida recién creada tiene vida 0: arranca llena
    if (p.vida <= 0) {
      p.vida = this.stats.vidaMax
      p.mana = this.stats.manaMax
    }
    p.vida = Math.min(p.vida, this.stats.vidaMax)
    p.mana = Math.min(p.mana, this.stats.manaMax)
    const self = this
    this.cuerpo = {
      get x() {
        return d.heroina.x
      },
      get y() {
        return d.heroina.y
      },
      get vivo() {
        return !self.caido
      },
      radioHit: 9,
      altura: 16,
    }
  }

  get partida(): Partida {
    return this.d.partida()
  }

  /** Los stats con el nivel y lo que lleva puesto */
  private calcularStats(): StatsHeroe {
    const p = this.d.partida()
    return statsDe(this.clase, p.nivel, bonosDeEquipo(this.d.cat, p.equipo, this.clase))
  }

  /** Se equipó o se sacó algo: se recalculan los stats y la vida y el maná no pasan del nuevo máximo */
  refrescarStats(): void {
    this.stats = this.calcularStats()
    const p = this.partida
    p.vida = Math.min(p.vida, this.stats.vidaMax)
    p.mana = Math.min(p.mana, this.stats.manaMax)
  }

  get modoPeque(): boolean {
    return this.partida.ajustes.modoPeque
  }

  get habilidades() {
    return HABILIDADES[this.clase]
  }

  /* ---------- objetivo y ataque básico ---------- */

  /** Un toque en el mundo: si cae sobre un enemigo lo marca y la heroína va a atacarlo */
  tocarEnemigo(x: number, y: number): boolean {
    if (this.caido) return false
    const e = this.d.enemigos.golpe(x, y)
    if (!e) return false
    this.marcar(e)
    return true
  }

  marcar(e: Atacable | null): void {
    if (this.objetivo && this.objetivo !== e) this.objetivo.marcar(false)
    this.objetivo = e
    e?.marcar(true)
    this.reaproxS = 0
  }

  /** Otra orden de camino: la heroína deja de perseguir al enemigo */
  soltarObjetivo(): void {
    this.marcar(null)
  }

  private origenDisparo(): { x: number; y: number } {
    return { x: this.d.heroina.x, y: this.d.heroina.y - 20 }
  }

  private anguloHacia(e: { x: number; y: number }, altura = 14): number {
    const o = this.origenDisparo()
    return Math.atan2(e.y - altura - o.y, e.x - o.x)
  }

  private blancosEnemigos = (): readonly Blanco[] => this.d.enemigos.todos

  private ataqueBasico(e: Atacable): void {
    const h = this.d.heroina
    const base = CLASES[this.clase]
    h.mirarA(e.x, e.y)
    this.atqCd = 1 / this.stats.ataquesPorSeg
    const sonido = this.clase === 'amazona' ? 'arco' : this.clase === 'paladin' ? 'espadazo' : 'magia'
    h.accion(base.animAtaque, {
      fraccion: GOLPE_EN.heroe,
      interrumpible: true,
      enGolpe: () => {
        this.d.sonido.efecto(sonido, { volumen: 0.5, rate: 0.9 + juego().next() * 0.2 })
        if (!e.vivo) return
        if (base.proyectil) {
          this.disparar(base.proyectil, base.impacto ?? undefined, this.anguloHacia(e), 1)
        } else if (Math.hypot(e.x - h.x, e.y - h.y) <= this.stats.alcance + 22) {
          this.golpear(e, 1)
          if (base.impacto) this.d.proyectiles.fxEn(base.impacto, e.x, e.y - 14)
        } else {
          // el blanco se fue: el golpe cae en el aire delante de ella
          const ang = Math.atan2(e.y - h.y, e.x - h.x)
          this.d.alFallar?.(h.x + Math.cos(ang) * this.stats.alcance, h.y + Math.sin(ang) * this.stats.alcance)
        }
      },
    })
  }

  private tirar(mult: number): Golpe {
    return tirarGolpe(juego(), { min: this.stats.danoMin, max: this.stats.danoMax, mult, critChance: this.stats.critChance })
  }

  private disparar(fx: string, impacto: string | undefined, angulo: number, mult: number): void {
    const o = this.origenDisparo()
    this.d.proyectiles.lanzar({
      fx,
      impacto,
      x: o.x,
      y: o.y,
      angulo,
      alcance: this.stats.alcance + 80,
      blancos: this.blancosEnemigos,
      alGolpear: (b) => this.golpear(b as Atacable, mult),
    })
  }

  /** Daño de la heroína a un enemigo, con números, sonido y la muerte */
  golpear(e: Atacable, mult: number, golpePrevio?: Golpe): void {
    if (!e.vivo) return
    const g = golpePrevio ?? this.tirar(mult)
    const murio = e.recibir(g.dano, this.d.heroina.x, this.d.heroina.y)
    this.d.numeros.mostrar(e.x, e.y - e.cuerpo.alto - 4, String(g.dano) + (g.critico ? '!' : ''), g.critico ? 'amarillo' : 'blanco', g.critico)
    this.d.sonido.efecto(g.critico ? 'critico' : 'golpe', { volumen: 0.5 })
    // la muerte del jefe tiene su propio momento (Mundo.victoria)
    if (e.esJefe) {
      if (!murio) this.d.alImpacto?.(g.critico ? 'jefeCritico' : 'jefeGolpe')
    } else this.d.alImpacto?.(murio ? 'muerte' : g.critico ? 'critico' : 'golpe')
    if (murio) this.alMorirEnemigo(e)
  }

  /** XP y oro por un enemigo derrotado (el botín de verdad llega en F3) */
  alMorirEnemigo(e: Atacable): void {
    this.muertes++
    if (this.objetivo === e) this.marcar(null)
    const xp = ENEMIGOS[e.tipo]?.xp ?? (e.esJefe ? JEFE.xp : 0)
    if (xp > 0) this.darXp(xp)
    this.d.alBotinEnemigo(e)
  }

  darXp(n: number): void {
    const p = this.partida
    const r = ganarXp(p.nivel, p.xp, n)
    p.xp = r.xp
    if (r.subio.length > 0) {
      p.nivel = r.nivel
      this.stats = this.calcularStats()
      p.vida = this.stats.vidaMax
      p.mana = this.stats.manaMax
      this.ultimoNivel = r.nivel
      this.aura('aura_nivel', 1.4)
      this.d.sonido.efecto('subir_nivel', { volumen: 0.8 })
      this.d.escena.game.events.emit('nivel-subido', { nivel: r.nivel })
    }
  }

  get fraccionXp(): number {
    return fraccionXp(this.partida.nivel, this.partida.xp)
  }

  private aura(nombre: string, seg: number, dy = -2): void {
    const tex = K.fx(nombre)
    if (!this.d.escena.textures.exists(tex)) return
    const key = crearAnimFx(this.d.escena, this.d.m, nombre)
    const h = this.d.heroina
    const s = this.d.escena.add.sprite(h.x, h.y + dy, tex, 0).setDepth(PROF.OBJETOS + h.y + 2).setOrigin(0.5, 0.9)
    if (key) s.play(key)
    this.auras.push({ s, resta: seg, dx: 0, dy })
  }

  /* ---------- recibir daño ---------- */

  /** Un golpe de un enemigo (ya con su daño base) */
  golpeDeEnemigo(rango: readonly [number, number], mult = 1): void {
    this.recibirGolpe(danoEnemigo(juego(), rango, this.modoPeque, mult))
  }

  recibirGolpe(dano: number): void {
    if (this.caido) return
    const p = this.partida
    const r = recibirDano({ vida: p.vida, escudo: this.escudo, reduccionPct: this.bloqueoS > 0 ? HABILIDADES.paladin[1].params.reduccionPct! : 0, armadura: this.stats.armadura, invulnerableS: this.invulnerableS }, dano)
    if (r.esquivado) return
    p.vida = r.vida
    this.escudo = r.escudo
    this.invulnerableS = r.invulnerableS
    this.sinDanoS = 0
    const h = this.d.heroina
    if (r.recibido > 0) this.d.numeros.mostrar(h.x, h.y - 44, `-${r.recibido}`, 'rojo')
    else if (r.absorbido > 0) this.d.numeros.mostrar(h.x, h.y - 44, String(r.absorbido), 'azul')
    h.destello(0xff7070)
    // un golpe grande (más de un octavo de la vida) se siente
    if (r.recibido >= this.stats.vidaMax / 8) this.d.alImpacto?.('recibidoFuerte')
    this.d.sonido.efecto('jugador_dolor', { volumen: 0.5 })
    if (r.cayo) this.caer()
  }

  /** Para las pruebas y para los peligros del mundo: daño que no se esquiva */
  danar(n: number): void {
    this.invulnerableS = 0
    this.recibirGolpe(n)
  }

  /* ---------- el rescate de Thor ---------- */

  private caer(): void {
    if (this.caido) return
    this.caido = true
    this.enRescate = true
    this.marcar(null)
    this.canalizando = false
    this.torbellino = null
    this.d.bloquearEntrada(true)
    const h = this.d.heroina
    h.liberar()
    h.accion('die', { dur: Infinity })
    const e = this.d.escena
    this.d.sonido.efecto('thor_rescate', { volumen: 0.8 })
    this.d.thor.hacer('howl', 1.4)
    this.d.sonido.efecto('aullido', { volumen: 0.9 })
    e.game.events.emit('heroina-cae')
    e.time.delayedCall(900, () => {
      const cam = e.cameras.main
      cam.fadeOut(COMBATE.fundidoRescateS * 1000, 7, 10, 18)
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.reaparecer())
    })
  }

  private reaparecer(): void {
    const e = this.d.escena
    const h = this.d.heroina
    const destino = this.d.puntoRescate()
    const p = rescatar(this.partida, destino, this.stats.vidaMax, this.stats.manaMax)
    // la partida es un objeto compartido: se copian los tres campos que cambian
    const act = this.partida
    act.vida = p.vida
    act.mana = p.mana
    act.posicion = p.posicion
    this.escudo = 0
    this.escudoS = 0
    this.fxEscudo?.destroy()
    this.fxEscudo = undefined
    this.bloqueoS = 0
    this.recargas.reiniciar()
    h.teleport(destino.x, destino.y)
    this.d.thor.teleport(destino.x - 30, destino.y + 8)
    this.d.enemigos.reiniciarTodos()
    this.d.centrarCamara()
    this.d.escena.game.events.emit('rescate', { mensaje: '¡Thor te salvó!' })
    e.time.delayedCall(1300, () => {
      e.cameras.main.fadeIn(500, 7, 10, 18)
      this.caido = false
      this.enRescate = false
      this.rescates++
      this.invulnerableS = 1
      this.d.bloquearEntrada(false)
      this.d.thor.menearCola()
      this.d.guardar()
    })
  }

  /* ---------- Thor en combate ---------- */

  private thorMorder(): void {
    const h = this.d.heroina
    const e = this.d.enemigos.masCercano(h.x, h.y, THOR.mordidaRadio)
    if (!e) return
    this.d.thor.irAMorder(e.x, e.y, () => {
      if (!e.vivo) return
      const r = rangoMordida(this.partida.nivel)
      const g = tirarGolpe(juego(), { min: r[0], max: r[1], puedeCritar: false })
      this.golpearConThor(e, g, 1 + this.stats.mascotaDanoPct / 100)
    })
  }

  private golpearConThor(e: Atacable, g: Golpe, mult = 1): void {
    const dano = Math.max(1, Math.round(g.dano * mult))
    const murio = e.recibir(dano, this.d.thor.x, this.d.thor.y)
    this.d.numeros.mostrar(e.x, e.y - e.cuerpo.alto - 4, String(dano), 'blanco')
    this.d.sonido.efecto('mordida', { volumen: 0.6 })
    if (murio && !e.esJefe) this.d.alImpacto?.('muerte')
    if (murio) this.alMorirEnemigo(e)
  }

  private thorAullar(): void {
    const p = this.partida
    this.escudo = escudoDeThor(THOR.aullidoEscudoBase, THOR.aullidoEscudoPorNivel, p.nivel)
    this.escudoS = THOR.aullidoEscudoS
    this.d.thor.hacer('howl', 1.2)
    this.d.sonido.efecto('aullido', { volumen: 0.9 })
    this.ponerFxEscudo()
  }

  /** Ladra, cava y trae un objeto normal (PLAN.md 4, tabla de Thor). Público para las pruebas. */
  desenterrar(): void {
    const t = this.d.thor
    if (t.ocupado || this.caido) return
    t.hacer('bark', undefined, 0.5, () => this.d.sonido.efecto('ladrido', { volumen: 0.7 }), () => {
      t.hacer('dig', 1.4, 0.75, () => {
        this.d.proyectiles.fxEn('tierra_cavada', t.x, t.y + 4)
        this.d.sonido.efecto('recoger', { volumen: 0.5, rate: 0.8 })
        this.d.soltarObjeto(sortearNormal(juego(), this.d.cat, this.partida.nivel), t.x, t.y + 6)
      }, () => t.hacer('pickup'))
    })
  }

  private ponerFxEscudo(): void {
    this.fxEscudo?.destroy()
    const tex = K.fx('escudo_de_thor')
    if (!this.d.escena.textures.exists(tex)) return
    const key = crearAnimFx(this.d.escena, this.d.m, 'escudo_de_thor')
    const h = this.d.heroina
    this.fxEscudo = this.d.escena.add.sprite(h.x, h.y, tex, 0).setOrigin(0.5, 0.85).setDepth(PROF.OBJETOS + h.y + 3).setAlpha(0.85)
    if (key) this.fxEscudo.play(key)
  }

  /* ---------- habilidades ---------- */

  private apuntar(): { x: number; y: number; angulo: number; enemigo: Atacable | null } {
    const h = this.d.heroina
    let e: Atacable | null = this.objetivo && this.objetivo.vivo ? this.objetivo : null
    if (!e) e = this.d.enemigos.masCercano(h.x, h.y, this.stats.alcance + 40)
    if (e) return { x: e.x, y: e.y, angulo: this.anguloHacia(e), enemigo: e }
    const v = vectorDe(DIRECCIONES[h.dir]!)
    const n = Math.hypot(v.x, v.y) || 1
    return { x: h.x + (v.x / n) * 100, y: h.y + (v.y / n) * 100, angulo: Math.atan2(v.y, v.x), enemigo: null }
  }

  /** F7: la habilidad tocada justo antes de que termine el golpe se guarda y sale al terminar */
  private colchon = new Colchon<0 | 1>(IMPACTO.colchonS)

  private puedeActuar(): boolean {
    const h = this.d.heroina
    return !this.caido && (!h.ocupada || h.accionInterrumpible)
  }

  /** Pulsó un botón de habilidad (0 o 1). El Rayo canalizado se mantiene: se suelta con `soltarHabilidad`. */
  presionarHabilidad(i: 0 | 1): void {
    if (!this.puedeActuar()) {
      if (!this.caido && this.d.mejoras?.() !== false) this.colchon.guardar(i)
      return
    }
    const hab = this.habilidades[i]
    if (hab.id === 'rayo_canalizado') return this.canalizar(true)
    const motivo = this.recargas.puede(i, this.partida.mana)
    if (motivo === 'sinMana') {
      this.d.sonido.efecto('error', { volumen: 0.5 })
      this.d.escena.game.events.emit('sin-mana')
      return
    }
    if (motivo) return
    const resto = this.recargas.usar(i, this.partida.mana)
    if (resto === null) return
    this.partida.mana = resto
    this.d.escena.game.events.emit('habilidad-usada', { id: hab.id })
    this.ejecutar(hab.id)
  }

  soltarHabilidad(i: 0 | 1): void {
    if (this.habilidades[i].id === 'rayo_canalizado') this.canalizar(false)
  }

  private ejecutar(id: string): void {
    const h = this.d.heroina
    const a = this.apuntar()
    h.mirarA(a.x, a.y)
    const p = this.partida
    switch (id) {
      case 'lluvia_flechas': {
        const prm = HABILIDADES.amazona[0].params
        h.accion('shoot_bow', {
          fraccion: GOLPE_EN.heroe,
          enGolpe: () => {
            this.d.sonido.efecto('arco', { volumen: 0.6, rate: 1.1 })
            for (const ang of abanico(a.angulo, prm.flechas!, prm.abanicoGrados!)) this.disparar('proyectil_flecha', 'impacto_flecha', ang, prm.danoPct! / 100)
          },
        })
        break
      }
      case 'esquiva': {
        const prm = HABILIDADES.amazona[1].params
        const mueve = h.moviendo && Math.hypot(h.vx, h.vy) > 5
        const v = mueve ? { x: h.vx, y: h.vy } : vectorDe(DIRECCIONES[h.dir]!)
        const n = Math.hypot(v.x, v.y) || 1
        const vel = prm.distancia! / prm.duracion!
        this.invulnerableS = prm.duracion! + 0.05
        h.accion('dodge', { dur: prm.duracion! })
        h.impulso((v.x / n) * vel, (v.y / n) * vel, prm.duracion!)
        this.d.sonido.efecto('esquiva', { volumen: 0.7 })
        break
      }
      case 'llamar_thor': {
        const prm = HABILIDADES.druida[0].params
        h.accion('summon', {
          fraccion: 0.5,
          enGolpe: () => {
            this.escudo = escudoDeThor(prm.escudoBase!, prm.escudoPorNivel!, p.nivel)
            this.escudoS = prm.escudoS!
            this.ponerFxEscudo()
            this.d.sonido.efecto('aullido', { volumen: 0.8 })
            this.d.thor.hacer('howl', 0.9, 0.5, () => {
              const e = this.d.enemigos.masCercano(h.x, h.y, THOR.mordidaRadio + 60)
              if (e) {
                this.d.thor.irAMorder(e.x, e.y, () => {
                  if (!e.vivo) return
                  const r = rangoMordida(p.nivel)
                  this.golpearConThor(e, tirarGolpe(juego(), { min: r[0], max: r[1], puedeCritar: false }), prm.mordidaPct! / 100)
                })
              }
            })
            this.relojes.reiniciarMordida()
          },
        })
        break
      }
      case 'curar': {
        const prm = HABILIDADES.druida[1].params
        h.accion('cast', {
          fraccion: 0.5,
          enGolpe: () => {
            const cura = Math.round(((this.stats.vidaMax * prm.curaPct!) / 100) * (1 + this.stats.curacionPct / 100))
            const antes = p.vida
            p.vida = Math.min(this.stats.vidaMax, p.vida + cura)
            this.d.numeros.mostrar(h.x, h.y - 44, `+${Math.round(p.vida - antes)}`, 'verde')
            this.d.proyectiles.fxEn('curar', h.x, h.y - 24)
            this.d.sonido.efecto('curar', { volumen: 0.7 })
          },
        })
        break
      }
      case 'torbellino': {
        const prm = HABILIDADES.paladin[0].params
        h.accion('whirlwind', { dur: prm.duracion! })
        this.torbellino = { resta: prm.duracion!, cada: 0 }
        this.d.sonido.efecto('espadazo', { volumen: 0.6, rate: 0.8 })
        break
      }
      case 'bloqueo': {
        const prm = HABILIDADES.paladin[1].params
        this.bloqueoS = prm.duracion!
        h.accion('block_shield', { dur: prm.duracion! })
        this.d.sonido.efecto('bloqueo', { volumen: 0.7 })
        break
      }
      case 'nova_fuego': {
        const prm = HABILIDADES.hechicera[0].params
        h.accion('nova', {
          fraccion: 0.5,
          enGolpe: () => {
            this.d.sonido.efecto('magia', { volumen: 0.8, rate: 0.8 })
            ;[1, 2, 3].forEach((esc, k) => this.d.escena.time.delayedCall(k * 120, () => this.d.proyectiles.fxEn('nova_fuego', h.x, h.y - 6, esc, PROF.OBJETOS + h.y + 800)))
            for (const e of this.d.enemigos.enRadio(h.x, h.y, prm.radio!)) this.golpear(e, prm.danoPct! / 100)
          },
        })
        break
      }
    }
  }

  /** Rayo canalizado: mientras se mantiene, un proyectil arcano cada 0.2 s y 3 de maná por segundo */
  canalizar(on: boolean): void {
    const h = this.d.heroina
    if (on) {
      if (this.canalizando || !this.puedeActuar() || this.partida.mana <= 0.5) {
        if (this.partida.mana <= 0.5) this.d.sonido.efecto('error', { volumen: 0.5 })
        return
      }
      this.canalizando = true
      this.canalCd = 0
      h.accion('channel', { dur: Infinity })
    } else if (this.canalizando) {
      this.canalizando = false
      h.liberar()
    }
  }

  get estaCanalizando(): boolean {
    return this.canalizando
  }

  /* ---------- pociones ---------- */

  pocion(i: number): boolean {
    if (this.caido) return false
    const p = this.partida
    const id = p.cinturon[i]
    if (!id) return false
    const vida = POCION_VIDA(id)
    const mana = POCION_MANA(id)
    if (!vida && !mana) return false
    // no se gasta una poción que no hace falta
    if (vida && p.vida >= this.stats.vidaMax) return false
    if (mana && p.mana >= this.stats.manaMax) return false
    p.cinturon[i] = null
    this.curacion = {
      vida: vida ? (this.stats.vidaMax * BOTIN.pociones.vidaPct) / 100 : 0,
      mana: mana ? (this.stats.manaMax * BOTIN.pociones.manaPct) / 100 : 0,
      resta: BOTIN.pociones.duracionS,
    }
    const h = this.d.heroina
    this.d.numeros.mostrar(h.x, h.y - 44, vida ? `+${Math.round(this.curacion.vida)}` : `+${Math.round(this.curacion.mana)}`, vida ? 'verde' : 'azul')
    this.d.sonido.efecto('pocion', { volumen: 0.7 })
    return true
  }

  /* ---------- cada cuadro ---------- */

  update(dt: number): void {
    const p = this.partida
    const h = this.d.heroina
    const guardada = this.colchon.tick(dt, this.puedeActuar())
    if (guardada !== null) this.presionarHabilidad(guardada)

    for (let i = this.auras.length - 1; i >= 0; i--) {
      const a = this.auras[i]!
      a.resta -= dt
      a.s.setPosition(Math.round(h.x), Math.round(h.y + a.dy)).setDepth(PROF.OBJETOS + h.y + 2)
      if (a.resta <= 0) {
        a.s.destroy()
        this.auras.splice(i, 1)
      }
    }
    if (this.fxEscudo) this.fxEscudo.setPosition(Math.round(h.x), Math.round(h.y)).setDepth(PROF.OBJETOS + h.y + 3)

    if (this.caido) return

    this.recargas.tick(dt)
    this.atqCd = Math.max(0, this.atqCd - dt)
    this.invulnerableS = Math.max(0, this.invulnerableS - dt)
    this.bloqueoS = Math.max(0, this.bloqueoS - dt)
    this.sinDanoS += dt
    if (this.escudoS > 0) {
      this.escudoS -= dt
      if (this.escudoS <= 0) {
        this.escudo = 0
        this.fxEscudo?.destroy()
        this.fxEscudo = undefined
      }
    }

    // regeneración y pociones
    const r = regenerar({ vida: p.vida, mana: p.mana, vidaMax: this.stats.vidaMax, manaMax: this.stats.manaMax, sinDanoS: this.sinDanoS, dt, canalizando: this.canalizando, vidaRegenExtra: this.stats.vidaRegen })
    p.vida = r.vida
    p.mana = r.mana
    if (this.curacion) {
      const c = this.curacion
      const k = Math.min(dt, c.resta) / BOTIN.pociones.duracionS
      p.vida = Math.min(this.stats.vidaMax, p.vida + (c.vida ? (this.stats.vidaMax * BOTIN.pociones.vidaPct) / 100 * k : 0))
      p.mana = Math.min(this.stats.manaMax, p.mana + (c.mana ? (this.stats.manaMax * BOTIN.pociones.manaPct) / 100 * k : 0))
      c.resta -= dt
      if (c.resta <= 0) this.curacion = null
    }

    // Thor
    const cerca = this.d.enemigos.masCercano(h.x, h.y, THOR.mordidaRadio)
    const accion = this.relojes.tick({ dt, vidaPct: p.vida / this.stats.vidaMax, enemigoCerca: !!cerca && !this.d.thor.ocupado, heroeVivo: true })
    if (accion === 'morder') this.thorMorder()
    else if (accion === 'aullar') this.thorAullar()

    // Thor desentierra algo cuando no hay pelea
    const libre = !this.d.enemigos.masCercano(h.x, h.y, 360) && !h.ocupada && !this.d.thor.ocupado
    if (this.reloj_desenterrar.tick(dt, libre)) this.desenterrar()

    // torbellino
    if (this.torbellino) {
      const t = this.torbellino
      const prm = HABILIDADES.paladin[0].params
      t.resta -= dt
      t.cada -= dt
      if (t.cada <= 0) {
        t.cada = prm.cadaS!
        for (const e of this.d.enemigos.enRadio(h.x, h.y, prm.radio!)) this.golpear(e, prm.danoPct! / 100)
      }
      if (t.resta <= 0) this.torbellino = null
    }

    // rayo canalizado
    if (this.canalizando) {
      const prm = HABILIDADES.hechicera[1].params
      p.mana = Math.max(0, p.mana - prm.manaPorSeg! * dt)
      this.canalCd -= dt
      if (this.canalCd <= 0) {
        this.canalCd = prm.cadaS!
        const a = this.apuntar()
        h.mirarA(a.x, a.y)
        this.disparar('proyectil_arcano', 'impacto_arcano', a.angulo, prm.danoPct! / 100)
      }
      if (p.mana <= 0.05) this.canalizar(false)
    }

    this.actualizarObjetivo(dt)
  }

  private actualizarObjetivo(dt: number): void {
    const h = this.d.heroina
    let e = this.objetivo
    if (e && (!e.vivo || Math.hypot(e.x - h.x, e.y - h.y) > COMBATE.soltarObjetivoLejos)) {
      this.marcar(null)
      e = null
    }
    // modo peque: ataca solo al enemigo más cercano que tenga al alcance si está quieta
    if (!e && this.modoPeque && !h.tieneOrden && !h.ocupada && !this.canalizando) {
      const c = this.d.enemigos.masCercano(h.x, h.y, this.stats.alcance)
      if (c) e = c
    }
    if (!e || this.canalizando) return
    if (h.ocupada && !h.accionInterrumpible) return
    const d = Math.hypot(e.x - h.x, e.y - h.y)
    const alcance = this.stats.alcance
    if (d > alcance * 0.92) {
      this.reaproxS -= dt
      if (this.reaproxS <= 0) {
        this.reaproxS = 0.25
        if (!h.ocupada) h.irA(e.x, e.y + 4)
      }
      return
    }
    if (h.tieneOrden) h.parar()
    if (h.ocupada) return
    h.mirarA(e.x, e.y)
    if (this.atqCd <= 0) this.ataqueBasico(e)
  }

  /** Para las pruebas */
  info() {
    const p = this.partida
    return {
      clase: this.clase,
      nivel: p.nivel,
      xp: p.xp,
      vida: Math.round(p.vida * 10) / 10,
      mana: Math.round(p.mana * 10) / 10,
      vidaMax: this.stats.vidaMax,
      manaMax: this.stats.manaMax,
      escudo: Math.round(this.escudo),
      caido: this.caido,
      ocupada: this.d.heroina.ocupada,
      colchon: this.colchon.pendiente,
      rescates: this.rescates,
      enRescate: this.enRescate,
      muertes: this.muertes,
      objetivo: this.objetivo ? { x: this.objetivo.x, y: this.objetivo.y, vida: this.objetivo.vida, tipo: this.objetivo.tipo } : null,
      recargas: [this.recargas.restante(0), this.recargas.restante(1)],
      habilidades: [this.habilidades[0].id, this.habilidades[1].id],
      canalizando: this.canalizando,
      bloqueo: this.bloqueoS > 0,
      invulnerable: this.invulnerableS > 0,
      modoPeque: this.modoPeque,
      avisoMult: this.modoPeque ? MODO_PEQUE.avisos : 1,
      danoMin: this.stats.danoMin,
      danoMax: this.stats.danoMax,
      cinturon: [...p.cinturon],
      alcance: this.stats.alcance,
      proyectiles: this.d.proyectiles.cantidad,
      velocidadProyectil: PROYECTIL.velocidad,
    }
  }

  destruir(): void {
    for (const a of this.auras) a.s.destroy()
    this.auras = []
    this.fxEscudo?.destroy()
    this.marcar(null)
  }
}
