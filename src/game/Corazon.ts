import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { CORAZON } from '../config/balance'
import { enParche } from '../logic/fragua'
import {
  companerasNuevas, companerasVivas, devorar, frioNuevo, hieloNuevo, laAlcanza, pasoCompaneras, pasoFrio, pasoHielo, pasoVentisca, radioCompaneras, recuperarTodas,
  velocidadFrio, ventiscaNueva, type Clima, type Companeras, type EstadoHielo, type Frio, type Hielo, type Ventisca,
} from '../logic/corazon'
import { juego } from '../logic/azar'
import type { Luz } from './Decos'

export interface DepsCorazon {
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  texto: (x: number, y: number, t: string, tinte: number) => void
  fx: (nombre: string, x: number, y: number, escala?: number) => void
  estallido: (x: number, y: number, llave: string, n: number) => void
  modoPeque: () => boolean
  /** el frío le quita un poquito de vida */
  danar: (n: number) => void
  /** la ventisca la empuja este tanto (px) */
  empujar: (dx: number, dy: number) => void
  /** el hielo fino se rompió debajo: cae al agua helada y vuelve a este punto firme */
  alAgua: (firme: { x: number; y: number }) => void
}

interface ParcheHielo {
  x: number
  y: number
  w: number
  h: number
  h0: Hielo
  s: { s: Phaser.GameObjects.Sprite; nombre: string }[]
}

interface Brasero {
  x: number
  y: number
  objeto: string
  estado: 'apagado' | 'prendido' | 'congelado'
  s: Phaser.GameObjects.Sprite | null
  /** para Alana: la mano que prende, arriba del brasero apagado */
  icono: Phaser.GameObjects.Image | null
}

/** Los colores de las luces compañeras: una por cada piso que ya alumbró */
const COLORES = ['#8af0a0', '#ffd890', '#9ad8ff', '#ffe8b0', '#d8b0ff']

/**
 * El Mundo 7, El Corazón Helado (PLAN.md F13). Casi todo a oscuras y frío. Las hogueras de hueso y los braseros
 * calientan, las luces compañeras (las que liberó en la Fragua) la siguen y la abrigan. La ventisca avisa con un aullido,
 * sopla, empuja y achica la luz: detrás de una columna de hielo o de un gigante congelado no llega. El hielo fino cruje
 * si se queda parada y se rompe. Las sombras devoradoras se comen sus luces compañeras (vuelven solas o en la hoguera).
 * En la arena, cuatro braseros de hueso: prendidos los cuatro, el Diablo cae de rodillas.
 */
export class Corazon {
  readonly frio: Frio = frioNuevo()
  readonly ventisca: Ventisca
  readonly companeras: Companeras
  private refugios: { x: number; y: number }[] = []
  private hogueras: { x: number; y: number }[] = []
  private hielos: ParcheHielo[] = []
  private braseros: Brasero[] = []
  private luces: Phaser.GameObjects.Image[] = []
  private yendose: { s: Phaser.GameObjects.Image; vx: number; vy: number }[] = []
  private iconoFrio: Phaser.GameObjects.Image | null = null
  private barraFrio: Phaser.GameObjects.Graphics
  private t = 0
  private ultimo = { x: 0, y: 0 }
  private quietaS = 0
  private firme = { x: 0, y: 0 }
  private braseroS = 0
  private avisoFrioS = 0
  private ultimoClima: Clima = {}
  /** la ventisca le llega ahora mismo (sin refugio) */
  alcanzada = false
  /** vencido el Diablo: se acaba la ventisca y el frío */
  apagado = false

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    mapa: MapaJuego,
    companeras: number,
    private deps: DepsCorazon,
  ) {
    this.ventisca = ventiscaNueva(juego())
    this.companeras = companerasNuevas(companeras)
    this.refugios = [...entidadesDeTipo(mapa, 'columna_hielo'), ...entidadesDeTipo(mapa, 'gigante')].map((e) => ({ x: e.x, y: e.y }))
    this.hogueras = entidadesDeTipo(mapa, 'punto_guardado').map((e) => ({ x: e.x, y: e.y }))
    for (const e of entidadesDeTipo(mapa, 'hielo_fino')) {
      const w = e.w ?? Number(e.props.width ?? 64)
      const h = e.h ?? Number(e.props.height ?? 64)
      const p: ParcheHielo = { x: e.x, y: e.y, w, h, h0: hieloNuevo(), s: [] }
      for (let cy = 0; cy < h; cy += 64) {
        for (let cx = 0; cx < w; cx += 64) {
          const v = Math.abs(Math.floor(e.x / 64) * 7 + Math.floor(e.y / 64) * 13 + cx + cy) % 4
          const nombre = m.mundo.objetos[`hielo_fino_${v}`] ? `hielo_fino_${v}` : 'hielo_fino'
          const s = this.sprite(nombre, 'quieto', e.x + cx + 32, e.y + cy + 32, 0, PROF.SUELO_OBJ - 0.4)
          if (s) p.s.push({ s, nombre })
        }
      }
      this.hielos.push(p)
    }
    for (const e of entidadesDeTipo(mapa, 'brasero_hueso')) {
      const objeto = String(e.props.objeto ?? 'brasero_hueso')
      const icono = escena.textures.exists(K.ui('hab_brasero')) ? escena.add.image(e.x, e.y - 100, K.ui('hab_brasero')).setScale(0.5).setDepth(PROF.OBJETOS + e.y + 500).setVisible(false) : null
      this.braseros.push({ x: e.x, y: e.y, objeto, estado: 'apagado', s: this.sprite(objeto, 'apagado', e.x, e.y, e.y), icono })
    }
    // las luces compañeras: luz técnica (el degradado), cada una de su color
    if (escena.textures.exists(K.luz)) {
      for (let i = 0; i < this.companeras.max; i++) {
        const c = Phaser.Display.Color.HexStringToColor(COLORES[i % COLORES.length]!).color
        this.luces.push(escena.add.image(0, 0, K.luz).setTint(c).setBlendMode(Phaser.BlendModes.ADD).setScale(14 / 64).setDepth(PROF.OBJETOS + 9500))
      }
    }
    this.barraFrio = escena.add.graphics().setDepth(PROF.OBJETOS + 9600)
    if (escena.textures.exists(K.ui('hab_frio'))) this.iconoFrio = escena.add.image(0, 0, K.ui('hab_frio')).setScale(0.5).setDepth(PROF.OBJETOS + 9601).setVisible(false)
  }

  /* ---------- piezas ---------- */

  private animDe(nombre: string, anim: string, loop?: boolean): string | null {
    const a = this.m.mundo.objetos[nombre]?.anims[anim]
    const tex = K.obj(nombre, anim)
    if (!a || !this.escena.textures.exists(tex) || this.escena.textures.get(tex).frameTotal < 1) return null
    const key = `corazon_${nombre}_${anim}`
    if (!this.escena.anims.exists(key)) this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: Math.max(0, a.cuadros - 1) }), frameRate: a.fps, repeat: (loop ?? a.loop !== false) ? -1 : 0 })
    return key
  }

  private sprite(nombre: string, anim: string, x: number, y: number, pieY: number, prof?: number): Phaser.GameObjects.Sprite | null {
    const def = this.m.mundo.objetos[nombre]
    const key = this.animDe(nombre, anim)
    if (!def || !key) return null
    const s = this.escena.add.sprite(Math.round(x), Math.round(y), K.obj(nombre, anim), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(prof ?? PROF.OBJETOS + pieY)
    s.play(key)
    return s
  }

  /** Pone una anim de un objeto: una vez la de pasar y después la que queda */
  private vestir(s: Phaser.GameObjects.Sprite | null, nombre: string, pasa: string | null, queda: string): void {
    if (!s) return
    const poner = (a: string, loop?: boolean) => {
      const key = this.animDe(nombre, a, loop)
      if (!key) return false
      s.setTexture(K.obj(nombre, a), 0).play(key)
      return true
    }
    if (pasa && poner(pasa, false)) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.active && poner(queda))
    else poner(queda)
  }

  /* ---------- las luces compañeras ---------- */

  get vivas(): number {
    return companerasVivas(this.companeras)
  }

  /** Una sombra devoradora se traga una: sale volando y se apaga. Devuelve si había alguna */
  devorarUna(): boolean {
    if (!devorar(this.companeras)) return false
    const s = this.luces[this.vivas]
    if (s) {
      const a = juego().next() * Math.PI * 2
      const copia = this.escena.add.image(s.x, s.y, K.luz).setTint(s.tintTopLeft).setBlendMode(Phaser.BlendModes.ADD).setScale(s.scale).setDepth(s.depth)
      this.yendose.push({ s: copia, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40 })
    }
    this.deps.texto(this.ultimo.x, this.ultimo.y - 60, '¡Se comió una luz!', 0x9aa8ff)
    return true
  }

  /** En la hoguera vuelven todas (y se calienta del todo) */
  enHoguera(): number {
    this.frio.valor = 0
    this.frio.congelada = false
    const n = recuperarTodas(this.companeras)
    if (n > 0) this.deps.sonido('luz_vuelve', { volumen: 0.5 })
    return n
  }

  /* ---------- los braseros de la arena ---------- */

  /** El brasero apagado (o congelado) que está al alcance de la heroína */
  braseroCerca(x: number, y: number, alcance = 56): Brasero | null {
    return this.braseros.find((b) => b.estado !== 'prendido' && Math.hypot(b.x - x, b.y - y) <= alcance) ?? null
  }

  prender(b: Brasero): boolean {
    if (b.estado === 'prendido') return false
    b.estado = 'prendido'
    this.vestir(b.s, b.objeto, 'prenderse', 'prendido')
    this.deps.sonido('brasero_hueso_prender', { volumen: 0.6 })
    this.deps.estallido(b.x, b.y - 40, 'chispa', 8)
    return true
  }

  prenderPorIndice(i: number): boolean {
    const b = this.braseros[i]
    return b ? this.prender(b) : false
  }

  /** El aliento del Diablo congela uno de los prendidos (el más cerca de él) */
  congelarUno(jx: number, jy: number): boolean {
    const b = this.braseros.filter((q) => q.estado === 'prendido').sort((p, q) => Math.hypot(p.x - jx, p.y - jy) - Math.hypot(q.x - jx, q.y - jy))[0]
    if (!b) return false
    b.estado = 'congelado'
    this.vestir(b.s, b.objeto, null, 'congelado')
    this.deps.sonido('brasero_congela', { volumen: 0.6 })
    this.deps.fx('impacto_hielo', b.x, b.y - 30, 2)
    return true
  }

  get braserosTodos(): boolean {
    return this.braseros.length > 0 && this.braseros.every((b) => b.estado === 'prendido')
  }

  get cuantosBraseros(): number {
    return this.braseros.length
  }

  /* ---------- el paso ---------- */

  update(dt: number, heroe: { x: number; y: number; vivo: boolean }, luces: Luz[]): void {
    this.t += dt
    const peque = this.deps.modoPeque()
    const movio = Math.hypot(heroe.x - this.ultimo.x, heroe.y - this.ultimo.y) > 0.5
    this.quietaS = movio ? 0 : this.quietaS + dt
    this.ultimo = { x: heroe.x, y: heroe.y }
    const enVista = (x: number, y: number, m = 560) => Math.abs(x - heroe.x) < m + 160 && Math.abs(y - heroe.y) < m

    // la ventisca: el aullido avisa, después sopla. Detrás de un refugio no llega
    const f = this.apagado ? null : pasoVentisca(this.ventisca, dt, juego(), peque)
    if (f === 'aviso') {
      this.deps.sonido('ventisca_viene', { volumen: 0.6 })
      if (heroe.vivo) this.deps.texto(heroe.x, heroe.y - 64, '¡Viene la ventisca! Busca un refugio', 0xc8e0ff)
    } else if (f === 'sopla') this.deps.sonido('viento_fuerte', { volumen: 0.55 })
    this.alcanzada = !this.apagado && heroe.vivo && laAlcanza(this.ventisca, heroe.x, heroe.y, this.refugios)
    if (this.alcanzada) {
      const k = CORAZON.ventisca.empuje * (peque ? 0.6 : 1) * dt
      this.deps.empujar(this.ventisca.dx * k, this.ventisca.dy * k)
      if (juego().next() < dt * 10) this.deps.estallido(heroe.x - this.ventisca.dx * 120 + (juego().next() - 0.5) * 200, heroe.y - this.ventisca.dy * 120 + (juego().next() - 0.5) * 140, 'nieve', 3)
    }

    // el hielo fino: cruje si se queda parada encima y se rompe
    for (const p of this.hielos) {
      const encima = heroe.vivo && enParche(heroe.x, heroe.y, p)
      const e = pasoHielo(p.h0, dt, encima && this.quietaS > 0.15, encima, peque)
      if (e) this.vestirHielo(p, e, heroe)
    }
    const enAgua = this.hielos.some((p) => p.h0.estado === 'roto' && enParche(heroe.x, heroe.y, p))
    if (heroe.vivo && !this.hielos.some((p) => enParche(heroe.x, heroe.y, p))) this.firme = { x: heroe.x, y: heroe.y }

    // un brasero de hueso se prende si ella se queda un ratico al lado (para Alana: sin botón)
    const bc = heroe.vivo && !this.apagado ? this.braseroCerca(heroe.x, heroe.y) : null
    this.braseroS = bc ? this.braseroS + dt : 0
    if (bc && this.braseroS >= CORAZON.braseros.prenderS) {
      this.braseroS = 0
      this.prender(bc)
    }

    // las compañeras: vuelven solas con el tiempo; orbitan alrededor de ella y alumbran
    if (pasoCompaneras(this.companeras, dt) > 0) this.deps.sonido('luz_vuelve', { volumen: 0.4 })
    const vivas = this.vivas
    this.luces.forEach((s, i) => {
      const ver = i < vivas && heroe.vivo
      s.setVisible(ver)
      if (!ver) return
      const ang = (i / Math.max(1, vivas)) * Math.PI * 2 + this.t * 0.9
      const x = heroe.x + Math.cos(ang) * 26
      const y = heroe.y - 26 + Math.sin(ang) * 12 + Math.sin(this.t * 2.4 + i) * 3
      s.setPosition(Math.round(x), Math.round(y)).setAlpha(0.85 + Math.sin(this.t * 5 + i * 1.7) * 0.15)
    })
    const rc = radioCompaneras(vivas)
    if (rc > 0 && heroe.vivo) luces.push({ x: heroe.x, y: heroe.y - 20, r: Math.round(rc * (this.alcanzada ? 0.6 : 1)), color: COLORES[(vivas - 1) % COLORES.length]!, pulse: true, ph: 0.2, alto: 20 })
    for (const y of this.yendose) {
      y.s.x += y.vx * dt
      y.s.y += y.vy * dt
      y.s.setAlpha(y.s.alpha - dt * 0.8)
    }
    for (const y of this.yendose.filter((q) => q.s.alpha <= 0)) y.s.destroy()
    this.yendose = this.yendose.filter((q) => q.s.alpha > 0)

    // para Alana: sobre cada brasero apagado o congelado, la mano que lo prende (cuando ella anda cerca)
    for (const b of this.braseros) b.icono?.setVisible(!this.apagado && b.estado !== 'prendido' && heroe.vivo && Math.hypot(b.x - heroe.x, b.y - heroe.y) < 420).setY(Math.round(b.y - 100 + Math.sin(this.t * 5) * 3))
    // los braseros prendidos alumbran grande y calientan
    for (const b of this.braseros) {
      if (b.estado !== 'prendido' || !enVista(b.x, b.y)) continue
      const l = this.m.mundo.objetos[b.objeto]?.luz
      luces.push({ x: b.x, y: b.y - (l?.dy ?? 56), r: l?.radius ?? 220, color: l?.color ?? '#ff9a40', flicker: true, ph: b.x * 0.01, alto: 50 })
    }

    // el frío
    const fuego = this.hogueras.some((h) => Math.hypot(h.x - heroe.x, h.y - heroe.y) <= CORAZON.frio.fuegoA) || this.braseros.some((b) => b.estado === 'prendido' && Math.hypot(b.x - heroe.x, b.y - heroe.y) <= CORAZON.frio.fuegoA)
    const clima: Clima = this.apagado || !heroe.vivo ? { fuego: true } : { fuego, companeras: vivas > 0, ventisca: this.alcanzada, aguaHelada: enAgua }
    this.ultimoClima = clima
    const r = pasoFrio(this.frio, dt, clima, peque)
    if (r.dano > 0) this.deps.danar(r.dano)
    if (r.cambio === 'congelada') {
      this.deps.sonido('congelada', { volumen: 0.6 })
      this.deps.texto(heroe.x, heroe.y - 60, '¡Qué frío! Busca el fuego', 0x9ad8ff)
    }
    this.avisoFrioS -= dt
    if (!this.frio.congelada && this.frio.valor > CORAZON.frio.max * 0.75 && this.avisoFrioS <= 0) {
      this.avisoFrioS = 1.8
      this.deps.sonido('frio_sube', { volumen: 0.35 })
    }
    this.dibujarFrio(heroe)
  }

  private vestirHielo(p: ParcheHielo, e: EstadoHielo, heroe: { x: number; y: number }): void {
    for (const q of p.s) this.vestir(q.s, q.nombre, null, e === 'cruje' ? 'cruje' : e === 'roto' ? 'roto' : 'quieto')
    if (e === 'cruje') this.deps.sonido('hielo_cruje', { volumen: 0.5 })
    else if (e === 'roto') {
      this.deps.sonido('hielo_rompe', { volumen: 0.7 })
      if (enParche(heroe.x, heroe.y, p)) {
        this.deps.sonido('agua_helada', { volumen: 0.6 })
        this.deps.estallido(heroe.x, heroe.y, 'gota', 10)
        this.frio.valor = Math.min(CORAZON.frio.max, this.frio.valor + CORAZON.hielo.frioAlCaer)
        this.deps.alAgua(this.firme)
      }
    }
  }

  /** El termómetro con el copo arriba de la heroína: aparece cuando se enfría */
  private dibujarFrio(h: { x: number; y: number }): void {
    const v = this.frio.valor / CORAZON.frio.max
    const g = this.barraFrio
    g.clear()
    const ver = v > 0.08
    this.iconoFrio?.setVisible(ver)
    if (!ver) return
    const x = Math.round(h.x - 10)
    const y = Math.round(h.y - 62)
    const parpadea = this.frio.congelada && Math.floor(this.t * 6) % 2 === 0
    this.iconoFrio?.setPosition(x, y).setAlpha(parpadea ? 0.6 : 1)
    const w = 20
    g.fillStyle(0x000000, 0.6).fillRect(x + 12, y - 2, w + 2, 5)
    const c = v < 0.5 ? 0x9ad8ff : v < 0.85 ? 0x5aa8ff : 0xe8f4ff
    g.fillStyle(c, 1).fillRect(x + 13, y - 1, Math.max(1, Math.round(w * v)), 3)
  }

  /** La velocidad de la heroína con el frío encima */
  get velocidad(): number {
    return velocidadFrio(this.frio) * (this.alcanzada ? CORAZON.ventisca.lento : 1)
  }

  /** El halo: la ventisca lo achica */
  get halo(): number {
    return this.alcanzada ? CORAZON.ventisca.halo : 1
  }

  /** Vencido el Diablo: se acaban el frío y la ventisca, los braseros quedan prendidos */
  apagar(): void {
    this.apagado = true
    this.alcanzada = false
    this.frio.valor = 0
    this.frio.congelada = false
    for (const b of this.braseros) if (b.estado !== 'prendido') this.prender(b)
  }

  get info() {
    return {
      frio: Math.round(this.frio.valor * 10) / 10,
      congelada: this.frio.congelada,
      clima: this.ultimoClima,
      ventisca: { fase: this.ventisca.fase, t: Math.round(this.ventisca.t * 10) / 10, dx: Math.round(this.ventisca.dx * 100) / 100, dy: Math.round(this.ventisca.dy * 100) / 100 },
      alcanzada: this.alcanzada,
      refugios: this.refugios,
      hogueras: this.hogueras,
      hielos: this.hielos.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, estado: p.h0.estado })),
      companeras: { max: this.companeras.max, vivas: this.vivas },
      braseros: this.braseros.map((b) => ({ x: b.x, y: b.y, estado: b.estado })),
      apagado: this.apagado,
    }
  }

  /** Para las pruebas: la ventisca pasa a esta fase ya */
  forzarVentisca(fase: 'aviso' | 'sopla' | 'calma', dx = 1, dy = 0): void {
    this.ventisca.fase = fase === 'calma' ? 'sopla' : fase === 'sopla' ? 'aviso' : 'calma'
    this.ventisca.t = 0
    pasoVentisca(this.ventisca, 0, juego(), false)
    this.ventisca.dx = dx
    this.ventisca.dy = dy
  }

  destruir(): void {
    for (const p of this.hielos) for (const q of p.s) q.s.destroy()
    for (const b of this.braseros) {
      b.s?.destroy()
      b.icono?.destroy()
    }
    for (const s of this.luces) s.destroy()
    for (const y of this.yendose) y.s.destroy()
    this.iconoFrio?.destroy()
    this.barraFrio.destroy()
  }
}
