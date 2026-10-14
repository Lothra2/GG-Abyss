import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego, Zona } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { CIUDAD, PUERTO, THOR } from '../config/balance'
import { zonaEn } from '../logic/zonas'
import { juego } from '../logic/azar'
import { barrioNuevo, elegirBarrioARobar, elegirChispas, empezarRobo, esperaLadrona, juntarChispas, oscuridadBarrio, pasoRobo, prenderBarrio, type Barrio } from '../logic/ciudad'
import type { Grilla } from '../logic/grilla'
import type { Luz } from './Decos'

export interface DepsCiudad {
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  /** se prendió o se apagó un farol de plaza: la partida guarda la lista */
  alCambiar: (prendidos: string[]) => void
  estallido: (x: number, y: number, llave: string, n: number) => void
  texto: (x: number, y: number, t: string, tinte: number) => void
  modoPeque: () => boolean
  /** la pelea con el jefe está en marcha (la Ladrona no roba en medio) */
  peleando: () => boolean
  /** cambia la anim de los decorados (las estatuas y las casas que despiertan) */
  despertarDecos: (animar: boolean) => void
}

interface FarolPlaza {
  id: string
  x: number
  y: number
  zona: Zona | null
  baseOsc: number
  b: Barrio
  s: Phaser.GameObjects.Sprite | null
  puntos: { x: number; y: number }[]
  figuras: { x: number; y: number }[]
  chispasS: { x: number; y: number; s: Phaser.GameObjects.Sprite }[]
}

interface Lampara {
  id: string
  x: number
  y: number
  prendida: boolean
  s: Phaser.GameObjects.Sprite | null
}

/**
 * El Mundo 5, La Ciudad Dormida (PLAN.md F12). La luz te la roban: cada barrio tiene un farol de plaza que la heroína
 * prende al pasar y que aclara el barrio entero. La Ladrona aparece cada tanto en un barrio prendido y le chupa la luz con
 * un hilo que se ve: si la heroína llega antes, se va en humo. Si no, la luz se rompe en tres chispas que Thor rastrea y
 * con las tres el farol se prende otra vez. En la sala del trono, cuatro lámparas: la canción del Rey las apaga y las
 * chispas que se le caen de la corona las vuelven a prender. Al vencerlo la ciudad entera despierta.
 */
export class Ciudad {
  private faroles: FarolPlaza[] = []
  private lamparas: Lampara[] = []
  private ladrona: { f: FarolPlaza; s: Phaser.GameObjects.Sprite | null; x: number; y: number; hilo: Phaser.GameObjects.Graphics; yendo: boolean } | null = null
  private esperaS: number = CIUDAD.ladrona.primeraS
  /** las chispas que se le caen al Rey (vuelven a prender las lámparas) */
  private chispasJefe: { x: number; y: number; s: Phaser.GameObjects.Sprite }[] = []
  private iconos: { x: number; y: number; s: Phaser.GameObjects.Image }[] = []
  private t = 0
  despierta = false
  /** las veces que robó (para las pruebas) */
  robos = 0

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private mapa: MapaJuego,
    private grilla: Grilla,
    prendidos: readonly string[],
    private deps: DepsCiudad,
  ) {
    const hay = new Set(prendidos)
    const chispas = entidadesDeTipo(mapa, 'chispa')
    const figuras = entidadesDeTipo(mapa, 'figura')
    for (const e of entidadesDeTipo(mapa, 'farol_plaza')) {
      const id = String(e.props.punto ?? e.props.id ?? `${e.x},${e.y}`)
      const barrio = String(e.props.barrio ?? '')
      const zona = mapa.zonas.find((z) => z.nombre === barrio) ?? zonaEn(mapa.zonas, e.x, e.y)
      const f: FarolPlaza = {
        id,
        x: e.x,
        y: e.y,
        zona,
        baseOsc: zona?.oscuridad ?? 0,
        b: barrioNuevo(id, hay.has(id)),
        s: null,
        puntos: chispas.filter((c) => c.props.barrio === barrio).map((c) => ({ x: c.x, y: c.y })),
        figuras: figuras.filter((c) => c.props.barrio === barrio && c.props.alto !== true).map((c) => ({ x: c.x, y: c.y })),
        chispasS: [],
      }
      const nombre = f.b.estado === 'prendido' ? 'farol_plaza_prendido' : 'farol_plaza_apagado'
      f.s = this.sprite(nombre, e.x, e.y)
      this.faroles.push(f)
      this.aplicarOscuridad(f)
    }
    for (const e of entidadesDeTipo(mapa, 'lampara_trono')) {
      this.lamparas.push({ id: String(e.props.id ?? `${e.x},${e.y}`), x: e.x, y: e.y, prendida: false, s: this.sprite('lampara_trono_apagada', e.x, e.y) })
    }
    for (const f of this.faroles) if (f.b.estado === 'apagado') this.ponerIcono(f.x, f.y)
  }

  /* ---------- piezas ---------- */

  private anim(nombre: string): string | null {
    const def = this.m.mundo.objetos[nombre]
    const a = def?.anims.idle ?? (def ? Object.values(def.anims)[0] : undefined)
    const tex = K.obj(nombre, 'idle')
    if (!def || !a || !this.escena.textures.exists(tex)) return null
    const key = `ciudad_${nombre}`
    if (!this.escena.anims.exists(key)) this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: a.loop === false ? 0 : -1 })
    return key
  }

  private sprite(nombre: string, x: number, y: number): Phaser.GameObjects.Sprite | null {
    const def = this.m.mundo.objetos[nombre]
    const key = this.anim(nombre)
    if (!def || !key) return null
    const s = this.escena.add.sprite(x, y, K.obj(nombre, 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + y)
    s.play(key)
    return s
  }

  /** Cambia el dibujo del farol: una vez la de pasar (prenderse, robado) y después la que queda */
  private vestir(s: Phaser.GameObjects.Sprite | null, pasa: string | null, queda: string): void {
    if (!s) return
    const poner = (n: string) => {
      const def = this.m.mundo.objetos[n]
      const key = this.anim(n)
      if (!def || !key) return false
      s.setTexture(K.obj(n, 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).play(key)
      return true
    }
    if (pasa && poner(pasa)) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.active && poner(queda))
    else poner(queda)
  }

  /** El ícono de prender (para Alana) flotando sobre lo que falta prender */
  private ponerIcono(x: number, y: number): void {
    const tex = K.ui('hab_prender')
    if (!this.escena.textures.exists(tex)) return
    const s = this.escena.add.image(x, y - 150, tex).setScale(0.5).setDepth(PROF.OBJETOS + y + 500).setAlpha(0)
    this.iconos.push({ x, y, s })
  }

  private quitarIcono(x: number, y: number): void {
    for (let i = this.iconos.length - 1; i >= 0; i--) {
      const ic = this.iconos[i]!
      if (Math.abs(ic.x - x) < 2 && Math.abs(ic.y - y) < 2) {
        ic.s.destroy()
        this.iconos.splice(i, 1)
      }
    }
  }

  /** El barrio se aclara con su farol prendido (la atmósfera se mezcla sola hacia la oscuridad nueva) */
  private aplicarOscuridad(f: FarolPlaza): void {
    if (f.zona) f.zona.oscuridad = this.despierta ? Math.min(f.baseOsc, PUERTO.oscuridadFaro) : oscuridadBarrio(f.baseOsc, f.b)
  }

  private guardar(): void {
    this.deps.alCambiar(this.faroles.filter((f) => f.b.estado === 'prendido' || f.b.estado === 'robando').map((f) => f.id))
  }

  /* ---------- los faroles de plaza ---------- */

  private prender(f: FarolPlaza, porChispas = false): void {
    if (!porChispas && !prenderBarrio(f.b)) return
    this.deps.sonido(this.escena.cache.audio.exists(K.aud('farol_plaza_prender')) ? 'farol_plaza_prender' : 'fogata_prender', { volumen: 0.7 })
    this.vestir(f.s, 'farol_plaza_prenderse', 'farol_plaza_prendido')
    this.deps.estallido(f.x, f.y - 96, 'brasa', 10)
    this.quitarIcono(f.x, f.y)
    this.aplicarOscuridad(f)
    this.guardar()
  }

  /** Para la heroína y las pruebas: prende el farol de plaza más cercano (si está apagado) */
  prenderCerca(x: number, y: number, radio = 64): boolean {
    const f = this.faroles.find((q) => q.b.estado === 'apagado' && Math.hypot(q.x - x, q.y - y) <= radio)
    if (!f) return false
    this.prender(f)
    return true
  }

  /* ---------- la Ladrona ---------- */

  private empezarLadrona(heroe: { x: number; y: number }): void {
    const peque = this.deps.modoPeque()
    const donde = zonaEn(this.mapa.zonas, heroe.x, heroe.y)?.nombre ?? null
    const porId = new Map(this.faroles.map((f) => [f.id, f]))
    const id = elegirBarrioARobar(
      this.faroles.map((f) => f.b),
      this.faroles.find((f) => f.zona?.nombre === donde)?.id ?? null,
      peque,
      (i) => {
        const f = porId.get(i)!
        return Math.hypot(f.x - heroe.x, f.y - heroe.y)
      },
    )
    if (!id) return
    const f = porId.get(id)!
    if (!empezarRobo(f.b, peque)) return
    // aparece en su punto del barrio más cerca del farol (o al lado del farol)
    const pt = f.figuras.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0] ?? { x: f.x + 70, y: f.y + 10 }
    const s = this.sprite('figura_ladrona', pt.x, pt.y)
    const k = this.animDe('figura_ladrona', 'robar', true)
    if (s && k) s.play(k)
    this.ladrona = { f, s, x: pt.x, y: pt.y, hilo: this.escena.add.graphics().setDepth(PROF.OBJETOS + Math.max(pt.y, f.y) + 2).setBlendMode(Phaser.BlendModes.ADD), yendo: false }
    this.deps.sonido('luz_robada', { volumen: 0.35, rate: 1.3 })
  }

  private animDe(nombre: string, anim: string, loop: boolean): string | null {
    const def = this.m.mundo.objetos[nombre]
    const a = def?.anims[anim]
    const tex = K.obj(nombre, anim)
    if (!a || !this.escena.textures.exists(tex)) return null
    const key = `ciudad_${nombre}_${anim}`
    if (!this.escena.anims.exists(key)) this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: loop ? -1 : 0 })
    return key
  }

  /** Dónde está el farolito de la Ladrona en este cuadro (el kit lo trae por anim y por cuadro) */
  private farolito(): { x: number; y: number } {
    const l = this.ladrona!
    const s = l.s
    if (!s) return { x: l.x, y: l.y - 40 }
    const def = this.m.mundo.objetos.figura_ladrona as unknown as { farolito?: Record<string, [number, number][]> }
    const anim = s.anims.currentAnim?.key.endsWith('_irse') ? 'irse' : 'robar'
    const f = Math.max(0, (s.anims.currentFrame?.index ?? 1) - 1)
    const pt = def.farolito?.[anim]?.[f]
    return pt ? { x: l.x + pt[0], y: l.y + pt[1] } : { x: l.x + 12, y: l.y - 36 }
  }

  private irseLadrona(): void {
    const l = this.ladrona
    if (!l || l.yendo) return
    l.yendo = true
    l.hilo.clear()
    this.deps.sonido('figura_irse', { volumen: 0.6 })
    const k = this.animDe('figura_ladrona', 'irse', false)
    const fin = () => {
      l.s?.destroy()
      l.hilo.destroy()
      if (this.ladrona === l) this.ladrona = null
    }
    if (l.s && k) {
      l.s.play(k)
      l.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, fin)
    } else fin()
  }

  private pasoLadrona(dt: number, heroe: { x: number; y: number }, thor: { x: number; y: number }): void {
    const l = this.ladrona
    if (!l || l.yendo) return
    const cerca = Math.hypot(heroe.x - l.x, heroe.y - l.y) <= CIUDAD.ladrona.espantaA
    const r = pasoRobo(l.f.b, dt, cerca)
    if (r === 'sigue') {
      // el hilo de luz del farol al farolito: se ve venir
      const fl = this.farolito()
      const k = 0.55 + 0.45 * Math.sin(this.t * 14)
      l.hilo.clear()
      l.hilo.lineStyle(3, 0xffd890, 0.35 * k).lineBetween(l.f.x, l.f.y - 97, fl.x, fl.y)
      l.hilo.lineStyle(1, 0xfff0c0, 0.9 * k).lineBetween(l.f.x, l.f.y - 97, fl.x, fl.y)
      return
    }
    if (r === 'salvado') {
      this.deps.texto(l.x, l.y - 70, '¡Se fue!', 0xffd890)
      this.irseLadrona()
      return
    }
    if (r === 'robado') {
      // la luz se rompe en tres chispas que caen en el barrio
      const f = l.f
      this.robos++
      this.deps.sonido('luz_robada', { volumen: 0.8 })
      this.vestir(f.s, 'farol_plaza_robado', 'farol_plaza_apagado')
      f.b.chispas = elegirChispas(f.puntos, juego(), this.deps.modoPeque(), thor)
      for (const c of f.b.chispas) {
        const s = this.sprite('chispa_luz', c.x, c.y)
        if (s) f.chispasS.push({ x: c.x, y: c.y, s })
        this.deps.estallido(c.x, c.y, 'brillo', 4)
      }
      this.deps.texto(f.x, f.y - 120, '¡Se llevó la luz!', 0xff9a7a)
      this.aplicarOscuridad(f)
      this.guardar()
      this.irseLadrona()
      this.esperaS = esperaLadrona(juego(), this.deps.modoPeque())
    }
  }

  /* ---------- las chispas ---------- */

  /** Las chispas van hacia Thor si anda cerca (él las trae) */
  private atraer(lista: { x: number; y: number; s: Phaser.GameObjects.Sprite }[], thor: { x: number; y: number }, dt: number): void {
    for (const c of lista) {
      const d = Math.hypot(thor.x - c.x, thor.y - c.y)
      if (d > THOR.recogerRadio || d < 1) continue
      const paso = Math.min(d, 140 * dt)
      c.x += ((thor.x - c.x) / d) * paso
      c.y += ((thor.y - c.y) / d) * paso
      c.s.setPosition(Math.round(c.x), Math.round(c.y)).setDepth(PROF.OBJETOS + c.y)
    }
  }

  private juntar(f: FarolPlaza, quienes: { x: number; y: number }[]): void {
    // la lógica mira las posiciones de las chispas: se sincronizan con los sprites que Thor arrastró
    f.b.chispas = f.chispasS.map((c) => ({ x: c.x, y: c.y }))
    const antes = f.chispasS.length
    const r = juntarChispas(f.b, quienes)
    if (r.juntadas <= 0) return
    const quedan = new Set(f.b.chispas.map((c) => `${c.x},${c.y}`))
    for (const c of [...f.chispasS]) {
      if (quedan.has(`${c.x},${c.y}`)) continue
      c.s.destroy()
      f.chispasS.splice(f.chispasS.indexOf(c), 1)
    }
    const total = CIUDAD.chispas.cuantas
    const juntadas = total - (antes - r.juntadas)
    this.deps.sonido('chispa_recoger', { volumen: 0.6, rate: 0.9 + juntadas * 0.1 })
    this.mostrarCuenta(quienes[0]!, Math.min(total, juntadas), total)
    if (r.prendido) this.prender(f, true)
  }

  /** El ícono de las chispas con la cuenta, sobre la heroína (Alana lo ve sin leer) */
  private mostrarCuenta(h: { x: number; y: number }, n: number, total: number): void {
    const tex = K.ui('hab_chispas')
    if (this.escena.textures.exists(tex)) {
      const ic = this.escena.add.image(h.x - 10, h.y - 62, tex).setScale(0.5).setDepth(PROF.OBJETOS + 9500)
      this.escena.tweens.add({ targets: ic, y: ic.y - 18, alpha: 0, delay: 600, duration: 700, onComplete: () => ic.destroy() })
    }
    this.deps.texto(h.x + 12, h.y - 62, `${n}/${total}`, 0xffd890)
  }

  /* ---------- la sala del trono ---------- */

  /** Al empezar la pelea las cuatro lámparas se prenden (el salón se ve entero) */
  prenderLamparas(): void {
    for (const l of this.lamparas) if (!l.prendida) this.prenderLampara(l)
  }

  private prenderLampara(l: Lampara): void {
    l.prendida = true
    this.vestir(l.s, 'lampara_trono_prenderse', 'lampara_trono_prendida')
    this.deps.sonido('farol_plaza_prender', { volumen: 0.5, rate: 1.2 })
    this.deps.estallido(l.x, l.y - 76, 'brasa', 6)
  }

  /** La canción de cuna: las cuatro lámparas se apagan */
  apagarLamparas(): void {
    for (const l of this.lamparas) {
      if (!l.prendida) continue
      l.prendida = false
      this.vestir(l.s, null, 'lampara_trono_apagada')
    }
    this.deps.sonido('luz_robada', { volumen: 0.7, rate: 0.8 })
  }

  get lamparasPrendidas(): number {
    return this.lamparas.filter((l) => l.prendida).length
  }

  /** Las cuatro prendidas: el Rey cae de rodillas (lo que lee la lógica del jefe como `vulnerable`) */
  get lamparasTodas(): boolean {
    return this.lamparas.length > 0 && this.lamparas.every((l) => l.prendida)
  }

  /** El Rey golpeó el piso: se le caen chispas de la corona en el anillo, donde se camina */
  soltarChispasJefe(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = juego().next() * Math.PI * 2
      const p = this.grilla.puntoLibreCerca(x + Math.cos(a) * 60, y + Math.sin(a) * 40, 8, 160) ?? { x, y }
      const s = this.sprite('chispa_luz', p.x, p.y)
      if (s) this.chispasJefe.push({ x: p.x, y: p.y, s })
      this.deps.estallido(p.x, p.y, 'brillo', 3)
    }
  }

  private juntarJefe(quienes: { x: number; y: number }[]): void {
    for (const c of [...this.chispasJefe]) {
      if (!quienes.some((q) => Math.hypot(q.x - c.x, q.y - c.y) <= CIUDAD.chispas.juntarA)) continue
      c.s.destroy()
      this.chispasJefe.splice(this.chispasJefe.indexOf(c), 1)
      const l = this.lamparas.filter((q) => !q.prendida).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]
      this.deps.sonido('chispa_recoger', { volumen: 0.6 })
      if (l) {
        this.prenderLampara(l)
        this.mostrarCuenta(quienes[0]!, this.lamparasPrendidas, this.lamparas.length)
      }
    }
  }

  /** La pelea se cortó o terminó: las chispas sueltas se van */
  limpiarChispasJefe(): void {
    for (const c of this.chispasJefe) c.s.destroy()
    this.chispasJefe = []
  }

  /* ---------- el despertar ---------- */

  /**
   * El Rey se liberó: la luz vuelve a toda la ciudad. Todos los faroles de plaza se prenden, la oscuridad baja y la gente
   * despierta (las estatuas, las casas, la fuente y la torre del reloj). La Ladrona ya no vuelve.
   */
  despertar(animar: boolean): void {
    if (this.despierta) return
    this.despierta = true
    if (this.ladrona) this.irseLadrona()
    for (const c of this.chispasJefe) c.s.destroy()
    this.chispasJefe = []
    this.faroles.forEach((f, i) => {
      for (const c of f.chispasS) c.s.destroy()
      f.chispasS = []
      const ya = f.b.estado === 'prendido'
      f.b.estado = 'prendido'
      f.b.chispas = []
      this.quitarIcono(f.x, f.y)
      if (!ya) {
        if (animar) this.escena.time.delayedCall(500 + i * 350, () => this.vestir(f.s, 'farol_plaza_prenderse', 'farol_plaza_prendido'))
        else this.vestir(f.s, null, 'farol_plaza_prendido')
      }
      this.aplicarOscuridad(f)
    })
    for (const l of this.lamparas) if (!l.prendida) {
      l.prendida = true
      this.vestir(l.s, null, 'lampara_trono_prendida')
    }
    this.deps.despertarDecos(animar)
    if (animar) this.deps.sonido('ciudad_despierta', { volumen: 0.8 })
    this.guardar()
  }

  /* ---------- cada cuadro ---------- */

  update(dt: number, heroe: { x: number; y: number; vivo: boolean }, thor: { x: number; y: number }, luces: Luz[]): void {
    this.t += dt
    // la heroína prende el farol de plaza al llegar
    if (heroe.vivo) for (const f of this.faroles) if (f.b.estado === 'apagado' && Math.hypot(heroe.x - f.x, heroe.y - f.y) < 60) this.prender(f)
    // la luz de los faroles prendidos (y del que la Ladrona está chupando, que va bajando)
    const lp = this.m.mundo.objetos.farol_plaza_prendido?.luz
    for (const f of this.faroles) {
      if (!lp) break
      if (f.b.estado === 'prendido' || f.b.estado === 'robando') {
        const k = f.b.estado === 'robando' ? Math.max(0.35, f.b.roboS / CIUDAD.ladrona.roboS) : 1
        luces.push({ x: f.x, y: f.y - (lp.dy ?? 0), r: Math.round(lp.radius * k), color: lp.color, flicker: lp.flicker, ph: (f.x * 0.011) % 1, alto: lp.dy ?? 0 })
      }
      const cl = this.m.mundo.objetos.chispa_luz?.luz
      if (cl) for (const c of f.chispasS) luces.push({ x: c.x, y: c.y - (cl.dy ?? 0), r: cl.radius, color: cl.color, pulse: true, ph: (c.x * 0.03) % 1, alto: cl.dy ?? 0 })
    }
    const ll = this.m.mundo.objetos.lampara_trono_prendida?.luz
    if (ll) for (const l of this.lamparas) if (l.prendida) luces.push({ x: l.x, y: l.y - (ll.dy ?? 0), r: ll.radius, color: ll.color, flicker: ll.flicker, ph: (l.x * 0.017) % 1, alto: ll.dy ?? 0 })
    const cl = this.m.mundo.objetos.chispa_luz?.luz
    if (cl) for (const c of this.chispasJefe) luces.push({ x: c.x, y: c.y - (cl.dy ?? 0), r: cl.radius, color: cl.color, pulse: true, ph: 0.3, alto: cl.dy ?? 0 })
    // la luz robada que vuelve con Thor o con la heroína
    for (const f of this.faroles) {
      if (f.b.estado !== 'robado') continue
      this.atraer(f.chispasS, thor, dt)
      this.juntar(f, [heroe, thor])
    }
    this.atraer(this.chispasJefe, thor, dt)
    this.juntarJefe([heroe, thor])
    // la Ladrona
    if (!this.despierta && !this.deps.peleando()) {
      if (!this.ladrona && this.faroles.some((f) => f.b.estado === 'prendido')) {
        this.esperaS -= dt
        if (this.esperaS <= 0) {
          this.esperaS = esperaLadrona(juego(), this.deps.modoPeque())
          this.empezarLadrona(heroe)
        }
      }
      this.pasoLadrona(dt, heroe, thor)
    }
    // los íconos de prender: se ven cerca y laten
    for (const ic of this.iconos) {
      const d = Math.hypot(heroe.x - ic.x, heroe.y - ic.y)
      const meta = d < 320 ? 1 : 0
      ic.s.setAlpha(ic.s.alpha + (meta - ic.s.alpha) * Math.min(1, dt * 4))
      ic.s.setY(Math.round(ic.y - 150 + Math.sin(this.t * 3 + ic.x) * 3))
    }
  }

  /** F12: ¿el punto está en la luz de un barrio prendido o de un farol o lámpara? (el sonámbulo se queda de piedra) */
  enLuz(x: number, y: number): boolean {
    const z = zonaEn(this.mapa.zonas, x, y)
    if (this.despierta) return true
    for (const f of this.faroles) {
      const prendido = f.b.estado === 'prendido' || f.b.estado === 'robando'
      if (!prendido) continue
      if (z && f.zona === z) return true
      if (Math.hypot(f.x - x, f.y - y) <= 220) return true
    }
    for (const l of this.lamparas) if (l.prendida && Math.hypot(l.x - x, l.y - y) <= 140) return true
    return false
  }

  /** Para el olfato de Thor: las chispas que faltan juntar */
  get pistasChispas(): { x: number; y: number }[] {
    return this.faroles.flatMap((f) => (f.b.estado === 'robado' ? f.chispasS.map((c) => ({ x: c.x, y: c.y })) : []))
  }

  /** Para las pruebas: la Ladrona sale ya, al barrio que le toque */
  robarYa(heroe: { x: number; y: number }): boolean {
    if (this.ladrona) return false
    this.empezarLadrona(heroe)
    return !!this.ladrona
  }

  get info() {
    return {
      faroles: this.faroles.map((f) => ({ id: f.id, x: f.x, y: f.y, barrio: f.zona?.nombre ?? null, estado: f.b.estado, chispas: f.chispasS.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })), oscuridad: f.zona?.oscuridad ?? null })),
      ladrona: this.ladrona ? { x: this.ladrona.x, y: this.ladrona.y, barrio: this.ladrona.f.id, resta: Math.round(this.ladrona.f.b.roboS * 100) / 100, yendo: this.ladrona.yendo } : null,
      lamparas: this.lamparas.map((l) => ({ id: l.id, x: l.x, y: l.y, prendida: l.prendida })),
      chispasJefe: this.chispasJefe.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
      despierta: this.despierta,
      robos: this.robos,
      esperaS: Math.round(this.esperaS),
    }
  }

  destruir(): void {
    for (const f of this.faroles) {
      f.s?.destroy()
      for (const c of f.chispasS) c.s.destroy()
      if (f.zona) f.zona.oscuridad = f.baseOsc
    }
    for (const l of this.lamparas) l.s?.destroy()
    for (const c of this.chispasJefe) c.s.destroy()
    for (const ic of this.iconos) ic.s.destroy()
    this.ladrona?.s?.destroy()
    this.ladrona?.hilo.destroy()
  }
}
