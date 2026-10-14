import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { FRAGUA } from '../config/balance'
import { zonaEn } from '../logic/zonas'
import { enLinea } from '../logic/jefe'
import {
  abrirCarcel, abrirJaula, abrirTodas, aguaNueva, alcanzaSacudida, calorNuevo, chorroAlcanza, cuentaJaulas, enfriarDelTodo, enLuzFria, enParche, estadoGrieta,
  haloConHollines, mojarThor, palancaCerca, pasoAgua, pasoCalor, pasoSurtidores, periodoFuelle, puedePegarse, puedeSacudir, sacudir, soplaEntre, surtidorBajo,
  tirarPalanca, velocidadCalor, velocidadHollines, type AguaThor, type Alrededor, type Calor, type EstadoGrieta, type Jaula, type LuzJaula, type Surtidor,
} from '../logic/fragua'
import type { Grilla } from '../logic/grilla'
import type { Objetivo } from './Entidades'
import type { Luz } from './Decos'

export interface DepsFragua {
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  /** se abrió una jaula: la partida guarda la lista */
  alCambiar: (abiertas: string[]) => void
  estallido: (x: number, y: number, llave: string, n: number) => void
  texto: (x: number, y: number, t: string, tinte: number) => void
  /** un fx de una pasada (el vapor, el chorro) */
  fx: (nombre: string, x: number, y: number, escala?: number) => void
  modoPeque: () => boolean
  /** el calor le quita un poquito de vida */
  danar: (n: number) => void
}

interface JaulaViva {
  j: Jaula
  objeto: string
  /** el apoyo de la jaula (la argolla de arriba): el candado es la entidad */
  ax: number
  ay: number
  s: Phaser.GameObjects.Sprite | null
  libre: Phaser.GameObjects.Sprite | null
  ph: number
  /** la de un farolero: no se dibuja la jaula, solo su luz libre al vencerlo */
  deFarolero?: boolean
}

interface Grieta {
  x: number
  y: number
  w: number
  h: number
  fase: number
  estado: EstadoGrieta
  /** la sacudida de Thor la apaga hasta este momento del reloj de la fragua */
  apagadaHasta: number
  s: Phaser.GameObjects.Sprite[]
}

interface SurtidorVivo extends Surtidor {
  objPalanca: string
  s: Phaser.GameObjects.Sprite | null
  ps: Phaser.GameObjects.Sprite | null
  icono: Phaser.GameObjects.Image | null
}

/**
 * El Mundo 6, La Fragua de las Luces (PLAN.md F12). La luz quema: cerca de la lava, de un brasero o de una grieta al rojo
 * la heroína junta calor. Las grietas respiran al ritmo de los fuelles. Cada jaula liberada deja una luz fría que alumbra
 * sin calentar. Thor se moja en el agua fría y se sacude para enfriar. En la arena, cuatro surtidores apagan a la Dragona.
 * Al liberarla se abren todas las jaulas, la lava se enfría y los fuelles se callan.
 */
export class Fragua {
  private jaulas: JaulaViva[] = []
  private grietas: Grieta[] = []
  private fuelles: { x: number; y: number; objeto: string; s: Phaser.GameObjects.Sprite | null }[] = []
  private surtidores: SurtidorVivo[] = []
  private cadenas: Phaser.GameObjects.Sprite[] = []
  private charcos: { x: number; y: number }[] = []
  private fuentes: { x: number; y: number }[] = []
  private braseros: { x: number; y: number }[] = []
  /** puntos de la orilla de la lava (para su luz y para el calor) */
  private orillas: { x: number; y: number; ph: number }[] = []
  private rastros: { x: number; y: number; resta: number; s: Phaser.GameObjects.Sprite | null }[] = []
  private fuegos: { x: number; y: number; dx: number; dy: number; largo: number; ancho: number; resta: number; s: Phaser.GameObjects.Sprite[] }[] = []
  /** las luces que suben al liberar a la Dragona (vuelven a sus pisos) */
  private subiendo: { s: Phaser.GameObjects.Sprite; color: string }[] = []
  private pegados: Phaser.GameObjects.Sprite[] = []
  private iconoCalor: Phaser.GameObjects.Image | null = null
  private barraCalor: Phaser.GameObjects.Graphics
  readonly calor: Calor = calorNuevo()
  readonly agua: AguaThor = aguaNueva()
  /** el reloj de los fuelles */
  private t = 0
  private avisoCalorS = 0
  private ultimoAlrededor: Alrededor = {}
  /** la Dragona se liberó: la fragua se enfría */
  apagada = false
  /** los fuelles soplan más seguido (fase 3 de la Dragona) */
  rapido = false

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private mapa: MapaJuego,
    private grilla: Grilla,
    guardadas: readonly string[],
    private deps: DepsFragua,
    posiciones: (nombre: string) => { x: number; y: number }[],
  ) {
    const abiertas = new Set(guardadas)
    for (const e of entidadesDeTipo(mapa, 'jaula')) {
      const luz = String(e.props.luz ?? 'bosque') as LuzJaula
      const id = String(e.props.id ?? `${e.x},${e.y}`)
      const objeto = String(e.props.objeto ?? `jaula_luz_${luz}`)
      const def = m.mundo.objetos[objeto] as (typeof m.mundo.objetos)[string] & { candado?: [number, number] }
      const cd = def?.candado ?? [0, 52]
      const j: JaulaViva = {
        j: { id, x: e.x, y: e.y, luz, zona: String(e.props.zona ?? zonaEn(mapa.zonas, e.x, e.y)?.nombre ?? ''), abierta: abiertas.has(`jaula:${id}`), ...(e.props.carcel === true ? { carcel: true } : {}) },
        objeto,
        ax: e.x - cd[0],
        ay: e.y - cd[1],
        s: null,
        libre: null,
        ph: ((e.x * 0.013 + e.y * 0.007) % 1 + 1) % 1,
      }
      j.s = this.sprite(objeto, j.j.abierta ? 'vacia' : 'cerrada', j.ax, j.ay, e.y + 2)
      if (j.j.abierta) this.ponerLibre(j, false)
      this.jaulas.push(j)
    }
    // los faroleros que cargan una jaula: su luz cuenta como jaula (se libera al vencerlo)
    for (const e of mapa.entidades) {
      if (e.tipo !== 'enemigo' || e.props.enemigo !== 'farolero_cadenas' || e.props.jaula !== true) continue
      const luz = String(e.props.luz ?? 'catedral') as LuzJaula
      const id = `farolero_${e.id}`
      const j: JaulaViva = { j: { id, x: e.x, y: e.y, luz, zona: String(e.props.zona ?? zonaEn(mapa.zonas, e.x, e.y)?.nombre ?? ''), abierta: abiertas.has(`jaula:${id}`) }, objeto: '', ax: e.x, ay: e.y - 52, s: null, libre: null, ph: 0.4, deFarolero: true }
      if (j.j.abierta) this.ponerLibre(j, false)
      this.jaulas.push(j)
    }
    for (const e of entidadesDeTipo(mapa, 'grieta')) {
      const w = e.w ?? Number(e.props.width ?? 64)
      const h = e.h ?? Number(e.props.height ?? 64)
      const g: Grieta = { x: e.x, y: e.y, w, h, fase: Number(e.props.fase ?? 0), estado: 'apagada', apagadaHasta: 0, s: [] }
      for (let cy = 0; cy < h; cy += 64) {
        for (let cx = 0; cx < w; cx += 64) {
          const v = Math.abs(Math.floor(e.x / 64) * 7 + Math.floor(e.y / 64) * 13 + cx + cy) % 4
          const nombre = m.mundo.objetos[`grieta_brasa_${v}`] ? `grieta_brasa_${v}` : 'grieta_brasa'
          const s = this.sprite(nombre, 'apagada', e.x + cx + 32, e.y + cy + 32, 0, PROF.SUELO_OBJ - 0.4)
          if (s) g.s.push(s.setData('obj', nombre))
        }
      }
      this.grietas.push(g)
    }
    for (const e of entidadesDeTipo(mapa, 'fuelle')) {
      const objeto = String(e.props.objeto ?? 'fuelle_gigante_0')
      this.fuelles.push({ x: e.x, y: e.y, objeto, s: this.sprite(objeto, 'quieto', e.x, e.y, e.y) })
    }
    const palancas = entidadesDeTipo(mapa, 'palanca')
    for (const e of entidadesDeTipo(mapa, 'surtidor')) {
      const id = String(e.props.id ?? `${e.x},${e.y}`)
      const p = palancas.find((q) => q.props.surtidor === id)
      const px = p?.x ?? e.x
      const py = p?.y ?? e.y
      const icono = this.escena.textures.exists(K.ui('hab_palanca')) ? this.escena.add.image(px, py - 70, K.ui('hab_palanca')).setScale(0.5).setDepth(PROF.OBJETOS + py + 500).setVisible(false) : null
      const objPalanca = String(p?.props.objeto ?? 'palanca_surtidor')
      this.surtidores.push({ id, x: e.x, y: e.y, px, py, recargaS: 0, s: this.sprite('surtidor', 'quieto', e.x, e.y, 0, PROF.SUELO_OBJ), ps: p ? this.sprite(objPalanca, 'arriba', px, py, py) : null, icono, objPalanca })
    }
    // las cadenas de la Dragona: eslabones del borde de la arena hasta ella
    for (const e of entidadesDeTipo(mapa, 'cadena')) {
      const hx = Number(e.props.hacia_x ?? e.x)
      const hy = Number(e.props.hacia_y ?? e.y)
      const d = Math.hypot(hx - e.x, hy - e.y)
      const ang = Math.atan2(hy - e.y, hx - e.x)
      // hasta un poco antes del centro (la Dragona tapa el resto)
      for (let k = 0; k < d - 40; k += 28) {
        const s = this.sprite(String(e.props.objeto ?? 'cadena_dragona'), 'idle', e.x + Math.cos(ang) * k, e.y + Math.sin(ang) * k, 0, PROF.SUELO_OBJ)
        if (s) this.cadenas.push(s.setRotation(ang))
      }
    }
    this.charcos = entidadesDeTipo(mapa, 'charco_frio').map((e) => ({ x: e.x, y: e.y }))
    this.fuentes = entidadesDeTipo(mapa, 'punto_guardado').filter((e) => e.props.fuente_fria === true).map((e) => ({ x: e.x, y: e.y }))
    for (const n of Object.keys(m.mundo.objetos).filter((k) => /^brasero_\d/.test(k))) this.braseros.push(...posiciones(n))
    this.calcularOrillas()
    this.rearmarFrias()
    this.barraCalor = escena.add.graphics().setDepth(PROF.OBJETOS + 9600)
    if (escena.textures.exists(K.ui('hab_calor'))) this.iconoCalor = escena.add.image(0, 0, K.ui('hab_calor')).setScale(0.5).setDepth(PROF.OBJETOS + 9601).setVisible(false)
  }

  /* ---------- piezas ---------- */

  private animDe(nombre: string, anim: string, loop?: boolean): string | null {
    const a = this.m.mundo.objetos[nombre]?.anims[anim]
    const tex = K.obj(nombre, anim)
    // una hoja que no cuadra con su tamaño no trae cuadros: mejor no dibujarla que romper la escena
    if (!a || !this.escena.textures.exists(tex) || this.escena.textures.get(tex).frameTotal <= 1) return null
    const key = `fragua_${nombre}_${anim}`
    if (!this.escena.anims.exists(key)) this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: (loop ?? a.loop !== false) ? -1 : 0 })
    return key
  }

  private sprite(nombre: string, anim: string, x: number, y: number, pieY: number, prof?: number): Phaser.GameObjects.Sprite | null {
    const def = this.m.mundo.objetos[nombre]
    const key = this.animDe(nombre, anim)
    if (!def || !key) return null
    const s = this.escena.add.sprite(Math.round(x), Math.round(y), K.obj(nombre, anim), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(prof ?? PROF.OBJETOS + pieY)
    s.play({ key, startFrame: Math.floor(((x * 0.37 + y * 0.11) % 1 + 1) % 1 * (def.anims[anim]?.cuadros ?? 1)) })
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

  /** La orilla de la lava: cuadros de lava al lado de piso, uno de cada tres (para su luz y para el calor) */
  private calcularOrillas(): void {
    const { ancho, alto, cuadro: c } = this.mapa
    const lava = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < ancho && ty < alto && this.mapa.agua[ty * ancho + tx]! > 0
    for (let ty = 0; ty < alto; ty++) {
      for (let tx = 0; tx < ancho; tx++) {
        if (!lava(tx, ty) || (tx + ty * 2) % 3 !== 0) continue
        const borde = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !lava(tx + dx!, ty + dy!) && this.grilla.caminable(tx + dx!, ty + dy!))
        if (borde) this.orillas.push({ x: tx * c + c / 2, y: ty * c + c / 2, ph: ((tx * 0.31 + ty * 0.17) % 1 + 1) % 1 })
      }
    }
  }

  /* ---------- las jaulas ---------- */

  /** Dónde flota la luz libre: en el medio de la jaula, que cuelga de su argolla */
  private puntoLibre(j: JaulaViva): { x: number; y: number } {
    return { x: j.ax, y: j.ay + 26 }
  }

  private ponerLibre(j: JaulaViva, animar: boolean): void {
    const p = this.puntoLibre(j)
    const s = this.sprite(`luz_libre_${j.j.luz}`, 'idle', p.x, p.y, j.j.y + 4)
    j.libre = s
    if (s && animar) {
      s.setAlpha(0).setY(p.y + 18)
      this.escena.tweens.add({ targets: s, alpha: 1, y: p.y, duration: 700, ease: 'Sine.easeOut' })
    }
  }

  private guardar(): void {
    this.rearmarFrias()
    this.deps.alCambiar(this.jaulas.filter((j) => j.j.abierta).map((j) => `jaula:${j.j.id}`))
  }

  /** Abre una jaula: salta el candado, sale la luz y queda flotando (luz fría) */
  private abrir(j: JaulaViva, animar = true, contar = true): boolean {
    if (!abrirJaula(j.j)) return false
    this.vestir(j.s, j.objeto, animar ? 'abrir' : null, 'vacia')
    if (animar) {
      this.deps.sonido('jaula_abre', { volumen: 0.6 })
      this.deps.sonido(this.escena.cache.audio.exists(K.aud(`luz_libre_${j.j.luz}`)) ? `luz_libre_${j.j.luz}` : 'luz_libre', { volumen: 0.5 })
      const p = this.puntoLibre(j)
      this.deps.estallido(p.x, p.y, 'brillo', 8)
      this.escena.time.delayedCall(j.deFarolero ? 0 : 450, () => this.ponerLibre(j, true))
    } else this.ponerLibre(j, false)
    if (contar && animar) this.mostrarCuenta(j)
    this.guardar()
    return true
  }

  /** El ícono de la jaula con la cuenta de la zona (Alana lo ve sin leer) */
  private mostrarCuenta(j: JaulaViva): void {
    const c = cuentaJaulas(this.jaulas.map((q) => q.j), j.j.zona)
    const x = j.ax
    const y = j.ay - 18
    const tex = K.ui('hab_jaula')
    if (this.escena.textures.exists(tex)) {
      const ic = this.escena.add.image(x - 12, y, tex).setScale(0.5).setDepth(PROF.OBJETOS + 9500)
      this.escena.tweens.add({ targets: ic, y: y - 18, alpha: 0, delay: 700, duration: 700, onComplete: () => ic.destroy() })
    }
    this.deps.texto(x + 12, y, `${c.libres}/${c.total}`, 0xbfe8ff)
  }

  /** Lo que se toca para usarlo: el candado de una jaula cerrada o una palanca con agua */
  golpe(x: number, y: number): Objetivo | null {
    for (const j of this.jaulas) {
      if (j.j.abierta || j.deFarolero || !j.s) continue
      if (Math.abs(x - j.ax) <= 18 && y >= j.ay - 6 && y <= j.j.y + 12) return { tipo: 'jaula', x: j.j.x, y: j.j.y, radio: 34, parada: { x: j.j.x, y: j.j.y + 16 }, llave: `jaula:${j.j.id}` }
    }
    for (const s of this.surtidores) {
      if (Math.abs(x - s.px) <= 18 && y >= s.py - 50 && y <= s.py + 8) return { tipo: 'palanca', x: s.px, y: s.py, radio: FRAGUA.surtidor.palancaA - 4, parada: { x: s.px, y: s.py + 14 }, llave: `palanca:${s.id}` }
    }
    return null
  }

  /** Usar un objetivo de la Fragua: le pega al candado o tira de la palanca. Devuelve el surtidor si salió el chorro */
  usar(o: Objetivo): { jaula?: boolean; surtidor?: Surtidor } {
    if (o.tipo === 'jaula') {
      const j = this.jaulas.find((q) => `jaula:${q.j.id}` === o.llave)
      return { jaula: !!j && this.abrir(j) }
    }
    if (o.tipo === 'palanca') {
      const s = this.surtidores.find((q) => `palanca:${q.id}` === o.llave)
      return s && this.tirar(s) ? { surtidor: s } : {}
    }
    return {}
  }

  /** Un golpe al aire de la heroína hacia una jaula cerrada la abre (como los cristales de las Galerías) */
  cercaDeGolpe(hx: number, hy: number, dirX: number, dirY: number, alcance = 46): string | null {
    let mejor: JaulaViva | null = null
    let dm = Infinity
    for (const j of this.jaulas) {
      if (j.j.abierta || j.deFarolero) continue
      const dx = j.j.x - hx
      const dy = j.j.y - hy
      const d = Math.hypot(dx, dy)
      if (d < alcance && (d < 14 || dx * dirX + dy * dirY > 0) && d < dm) {
        dm = d
        mejor = j
      }
    }
    return mejor ? mejor.j.id : null
  }

  abrirPorId(id: string): boolean {
    const j = this.jaulas.find((q) => q.j.id === id)
    return !!j && this.abrir(j)
  }

  /** Cayó un farolero: la jaula que cargaba se abre donde vivía y su luz queda libre */
  liberarFarolero(entId: number): boolean {
    const j = this.jaulas.find((q) => q.deFarolero && q.j.id === `farolero_${entId}`)
    return !!j && this.abrir(j)
  }

  /** ¿La luz del farolero ya está libre? (al volver al mundo sale sin su jaula) */
  faroleroLibre(entId: number): boolean {
    return !!this.jaulas.find((q) => q.deFarolero && q.j.id === `farolero_${entId}`)?.j.abierta
  }

  /** El Carcelero cayó: todas las jaulas de su cárcel se abren a la vez */
  abrirCarcel(): number {
    const ab = abrirCarcel(this.jaulas.map((q) => q.j))
    ab.forEach((jj, i) => {
      const j = this.jaulas.find((q) => q.j === jj)!
      jj.abierta = false
      this.escena.time.delayedCall(200 + i * 140, () => this.abrir(j, true, i === ab.length - 1))
    })
    return ab.length
  }

  /* ---------- la sacudida y los surtidores ---------- */

  get puedeSacudir(): boolean {
    return puedeSacudir(this.agua) && !this.apagada
  }

  /**
   * Thor se sacude mojado: la heroína se enfría del todo (y se suelta los hollines si está cerca), las grietas cercanas
   * se apagan un rato. Devuelve dónde (para las salamandras y la Dragona) o null si no tenía agua.
   */
  sacudir(heroe: { x: number; y: number }, thor: { x: number; y: number }): { x: number; y: number } | null {
    if (this.apagada || !sacudir(this.agua)) return null
    this.deps.sonido('thor_sacude', { volumen: 0.7 })
    this.deps.fx('vapor', thor.x, thor.y - 10, 1.4)
    this.deps.estallido(thor.x, thor.y - 14, 'gota', 14)
    if (alcanzaSacudida(thor, heroe)) {
      enfriarDelTodo(this.calor)
      this.soltarHollines()
    }
    for (const g of this.grietas) {
      const cx = Math.max(g.x, Math.min(thor.x, g.x + g.w))
      const cy = Math.max(g.y, Math.min(thor.y, g.y + g.h))
      if (alcanzaSacudida(thor, { x: cx, y: cy })) g.apagadaHasta = this.t + FRAGUA.sacudida.apagaGrietasS
    }
    return { x: thor.x, y: thor.y }
  }

  private tirar(s: SurtidorVivo): boolean {
    if (!tirarPalanca(s)) return false
    this.deps.sonido('palanca', { volumen: 0.6 })
    this.vestir(s.ps, s.objPalanca, 'tirar', 'arriba')
    this.escena.time.delayedCall(260, () => {
      this.deps.sonido('surtidor_chorro', { volumen: 0.8 })
      this.vestir(s.s, 'surtidor', 'chorro', 'quieto')
      const ch = this.sprite('surtidor_chorro', 'idle', s.x, s.y, s.y + 4)
      if (ch) {
        const key = this.animDe('surtidor_chorro', 'idle', false)
        if (key) ch.play(key)
        ch.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => ch.destroy())
      }
      this.deps.fx('vapor_grande', s.x, s.y - 20)
      this.deps.estallido(s.x, s.y - 40, 'gota', 10)
    })
    return true
  }

  /** La palanca que la heroína tiene al lado (para el toque cerca y las pruebas) */
  palancaCerca(hx: number, hy: number): Objetivo | null {
    const s = palancaCerca(this.surtidores, hx, hy)
    return s ? { tipo: 'palanca', x: s.px, y: s.py, radio: FRAGUA.surtidor.palancaA, parada: { x: s.px, y: s.py + 14 }, llave: `palanca:${s.id}` } : null
  }

  /** ¿El chorro de este surtidor le llega a la Dragona? */
  chorroA(s: Surtidor, p: { x: number; y: number }): boolean {
    return chorroAlcanza(s, p)
  }

  /* ---------- lo que deja la pelea ---------- */

  /** El aliento de la Dragona dejó esta franja ardiendo */
  fuegoPiso(x: number, y: number, dx: number, dy: number, largo: number, ancho: number, seg: number): void {
    const s: Phaser.GameObjects.Sprite[] = []
    const tex = K.fx('fuego_piso')
    const def = this.m.fx.fuego_piso
    if (def && this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists('fragua_fuego_piso')) this.escena.anims.create({ key: 'fragua_fuego_piso', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: def.cuadros - 1 }), frameRate: def.fps, repeat: -1 })
      const px = -dy
      const py = dx
      for (let d = 30; d < largo; d += 26) {
        for (const lado of [-0.5, 0.5]) {
          const fx0 = x + dx * d + px * lado * ancho * 0.6
          const fy0 = y + dy * d + py * lado * ancho * 0.6
          s.push(this.escena.add.sprite(Math.round(fx0), Math.round(fy0), tex, 0).setDepth(PROF.SUELO_OBJ + 0.2).play({ key: 'fragua_fuego_piso', startFrame: Math.floor(d / 26) % def.cuadros }))
        }
      }
    }
    this.fuegos.push({ x, y, dx, dy, largo, ancho, resta: seg, s })
  }

  /** La salamandra pasó por aquí: el piso queda caliente un rato */
  rastro(x: number, y: number): void {
    if (this.rastros.length > 60) return
    const tex = K.fx('rastro_brasa')
    const def = this.m.fx.rastro_brasa
    let s: Phaser.GameObjects.Sprite | null = null
    if (def && this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists('fragua_rastro')) this.escena.anims.create({ key: 'fragua_rastro', frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: def.cuadros - 1 }), frameRate: def.cuadros / FRAGUA.salamandra.rastroS, repeat: 0 })
      s = this.escena.add.sprite(Math.round(x), Math.round(y), tex, 0).setDepth(PROF.SUELO_OBJ + 0.1).play('fragua_rastro')
    }
    this.rastros.push({ x, y, resta: FRAGUA.salamandra.rastroS, s })
  }

  /* ---------- los hollines ---------- */

  /** Un hollín alcanzó a la heroína: se le pega (si cabe). Devuelve si se pegó */
  pegarHollin(): boolean {
    if (!puedePegarse(this.pegados.length, this.deps.modoPeque())) return false
    this.deps.sonido('hollin_pega', { volumen: 0.5, rate: 0.9 + this.pegados.length * 0.1 })
    const anim = `p_hollin_pegado`
    const tex = K.pers('hollin', 'pegado')
    const s = this.escena.add.sprite(0, 0, this.escena.textures.exists(tex) ? tex : K.pers('hollin', 'idle'), 0).setScale(0.75)
    const def = this.m.personajes.hollin?.anims.pegado
    if (def && this.escena.textures.exists(tex)) {
      if (!this.escena.anims.exists(anim)) this.escena.anims.create({ key: anim, frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: def.cuadros - 1 }), frameRate: def.fps, repeat: -1 })
      s.play({ key: anim, startFrame: this.pegados.length % def.cuadros })
    }
    this.pegados.push(s)
    return true
  }

  /** La luz fría o la sacudida los sueltan: se deshacen en polvo negro */
  soltarHollines(): void {
    if (!this.pegados.length) return
    this.deps.sonido('hollin_suelta', { volumen: 0.5 })
    for (const s of this.pegados) {
      this.deps.estallido(s.x, s.y, 'humo', 3)
      s.destroy()
    }
    this.pegados = []
  }

  get hollinesPegados(): number {
    return this.pegados.length
  }

  /** El halo de la heroína con los hollines pegados (lo multiplica el radio del farol) */
  get halo(): number {
    return haloConHollines(this.pegados.length)
  }

  /** Lo que camina la heroína con el calor y los hollines */
  get velocidad(): number {
    return velocidadCalor(this.calor, this.deps.modoPeque()) * velocidadHollines(this.pegados.length)
  }

  /** ¿Está este punto en la luz fría de una jaula liberada? (los hollines huyen, las grietas no queman) */
  enLuzFria(x: number, y: number): boolean {
    return enLuzFria(x, y, this.frias)
  }

  /** las luces libres como jaulas abiertas en el piso debajo de su luz (se rearma al abrir una) */
  private frias: Jaula[] = []

  private rearmarFrias(): void {
    this.frias = this.jaulas.filter((q) => q.j.abierta).map((q) => {
      const p = this.puntoLibre(q)
      return { ...q.j, x: p.x, y: p.y + 30 }
    })
  }

  /* ---------- la liberación ---------- */

  /**
   * La Dragona se liberó: todas las jaulas que quedan se abren, una tras otra, y sus luces suben por el techo de vuelta a
   * sus pisos. La lava se enfría, los fuelles se callan y las grietas se apagan para siempre.
   */
  liberar(animar: boolean): void {
    if (this.apagada) return
    this.apagada = true
    this.soltarHollines()
    enfriarDelTodo(this.calor)
    for (const f of this.fuegos) for (const s of f.s) s.destroy()
    this.fuegos = []
    for (const g of this.grietas) {
      g.estado = 'apagada'
      for (const s of g.s) this.vestirGrieta(s, 'apagada')
    }
    for (const f of this.fuelles) this.vestir(f.s, f.objeto, null, 'dormido')
    for (const s of this.cadenas) {
      if (animar) this.escena.tweens.add({ targets: s, alpha: 0, duration: 900, delay: 300 })
      else s.setVisible(false)
    }
    const ab = abrirTodas(this.jaulas.map((q) => q.j))
    ab.forEach((jj, i) => {
      const j = this.jaulas.find((q) => q.j === jj)!
      jj.abierta = false
      if (!animar) {
        this.abrir(j, false, false)
        return
      }
      this.escena.time.delayedCall(600 + i * 90, () => {
        this.abrir(j, true, false)
        this.subir(j)
      })
    })
    // las que ya estaban libres también suben (el río de luces es de todas)
    if (animar) this.jaulas.filter((q) => !ab.includes(q.j)).forEach((j, i) => this.escena.time.delayedCall(400 + i * 70, () => this.subir(j)))
    this.guardar()
  }

  /** Una luz que sube por el techo de vuelta a su piso (se va desvaneciendo) */
  private subir(j: JaulaViva): void {
    const p = this.puntoLibre(j)
    const nombre = `luz_libre_${j.j.luz}`
    const s = this.sprite(nombre, 'idle', p.x, p.y, j.j.y + 600)
    if (!s) return
    const color = this.m.mundo.objetos[nombre]?.luz?.color ?? '#ffe8b0'
    const v = { s, color }
    this.subiendo.push(v)
    this.escena.tweens.add({
      targets: s,
      y: p.y - 420 - (j.ph * 120),
      x: p.x + (j.ph - 0.5) * 80,
      alpha: 0,
      duration: 3200 + j.ph * 900,
      ease: 'Sine.easeIn',
      onComplete: () => {
        s.destroy()
        this.subiendo = this.subiendo.filter((q) => q !== v)
      },
    })
  }

  private vestirGrieta(s: Phaser.GameObjects.Sprite, estado: EstadoGrieta): void {
    const nombre = String(s.getData('obj'))
    const key = this.animDe(nombre, estado)
    if (key) s.setTexture(K.obj(nombre, estado), 0).play(key)
  }

  /* ---------- cada cuadro ---------- */

  update(dt: number, heroe: { x: number; y: number; vivo: boolean }, thor: { x: number; y: number }, luces: Luz[], jefe: { x: number; y: number } | null): void {
    const t0 = this.t
    this.t += dt
    const peque = this.deps.modoPeque()
    const periodo = periodoFuelle(this.rapido)
    // los fuelles soplan todos juntos: se oye antes de que las grietas se prendan
    if (!this.apagada && soplaEntre(t0, this.t, periodo)) {
      const cerca = Math.min(...this.fuelles.map((f) => Math.hypot(f.x - heroe.x, f.y - heroe.y)), 9999)
      this.deps.sonido('fuelle_sopla', { volumen: Math.max(0.15, Math.min(0.6, 1 - cerca / 1600)) })
      for (const f of this.fuelles) this.vestir(f.s, f.objeto, 'soplar', 'quieto')
    }
    // las grietas siguen el soplido (la sacudida de Thor y la luz fría las apagan)
    const enVista = (x: number, y: number, m = 520) => Math.abs(x - heroe.x) < m + 160 && Math.abs(y - heroe.y) < m
    for (const g of this.grietas) {
      const cx = g.x + g.w / 2
      const cy = g.y + g.h / 2
      const e: EstadoGrieta = this.apagada || g.apagadaHasta > this.t || this.enLuzFria(cx, cy) ? 'apagada' : estadoGrieta(this.t, g.fase, periodo, peque)
      if (e !== g.estado) {
        g.estado = e
        for (const s of g.s) this.vestirGrieta(s, e)
        if (e === 'caliente' && Math.hypot(cx - heroe.x, cy - heroe.y) < 280) this.deps.sonido('grieta_rojo', { volumen: 0.3, rate: 0.9 + g.fase * 0.2 })
      }
      if (e === 'caliente' && enVista(cx, cy)) luces.push({ x: cx, y: cy, r: 70 + Math.min(g.w, g.h) / 4, color: '#ff7020', flicker: true, ph: g.fase, alto: 0 })
    }
    // la lava brilla a lo largo de la orilla (la apagada ya no)
    if (!this.apagada) for (const o of this.orillas) if (enVista(o.x, o.y, 460)) luces.push({ x: o.x, y: o.y, r: 120, color: '#ff7020', flicker: true, ph: o.ph, alto: 0 })
    // las jaulas: la cerrada late chiquita de su color, la libre alumbra frío y grande
    for (const j of this.jaulas) {
      const p = this.puntoLibre(j)
      if (!enVista(p.x, p.y, 700)) continue
      if (j.j.abierta && j.libre) {
        const ly = p.y + Math.sin(this.t * 1.6 + j.ph * 6) * 3
        j.libre.setY(Math.round(ly))
        const l = this.m.mundo.objetos[`luz_libre_${j.j.luz}`]?.luz
        if (l) luces.push({ x: p.x, y: ly, r: l.radius, color: l.color, pulse: true, ph: j.ph, alto: 30 })
      } else if (!j.j.abierta && j.s) {
        const l = this.m.mundo.objetos[j.objeto]?.luz
        if (l) luces.push({ x: j.ax, y: j.ay - (l.dy ?? 0), r: l.radius, color: l.color, pulse: true, ph: j.ph, alto: 30 })
      }
    }
    for (const v of this.subiendo) luces.push({ x: v.s.x, y: v.s.y, r: Math.round(140 * v.s.alpha + 30), color: v.color, pulse: true, ph: 0.3, alto: 60 })
    // el piso ardiendo del aliento y los rastros de las salamandras
    for (const f of this.fuegos) {
      f.resta -= dt
      if (enVista(f.x, f.y, 600)) for (let d = 40; d < f.largo; d += 80) luces.push({ x: f.x + f.dx * d, y: f.y + f.dy * d, r: 70, color: '#ff8a30', flicker: true, ph: d * 0.01, alto: 0 })
      if (f.resta < 0.6) for (const s of f.s) s.setAlpha(Math.max(0, f.resta / 0.6))
    }
    for (const f of this.fuegos.filter((q) => q.resta <= 0)) for (const s of f.s) s.destroy()
    this.fuegos = this.fuegos.filter((q) => q.resta > 0)
    for (const r of this.rastros) r.resta -= dt
    for (const r of this.rastros.filter((q) => q.resta <= 0)) r.s?.destroy()
    this.rastros = this.rastros.filter((q) => q.resta > 0)
    // los surtidores recargan; sobre la palanca, el ícono cuando la Dragona está encima de su surtidor
    pasoSurtidores(this.surtidores, dt)
    const bajo = jefe ? surtidorBajo(this.surtidores, jefe) : null
    for (const s of this.surtidores) {
      const ver = !!bajo && bajo === s
      if (s.icono) s.icono.setVisible(ver).setY(Math.round(s.py - 70 + Math.sin(this.t * 6) * 3))
    }
    // Thor se moja en el agua fría (charcos y fuentes)
    pasoAgua(this.agua, dt)
    const mojado = this.charcos.some((c) => Math.hypot(c.x - thor.x, c.y - thor.y) <= FRAGUA.sacudida.mojarA) || this.fuentes.some((c) => Math.hypot(c.x - thor.x, c.y - thor.y) <= 80)
    if (!this.apagada && mojado && mojarThor(this.agua)) {
      this.deps.sonido('thor_mojarse', { volumen: 0.5 })
      this.deps.estallido(thor.x, thor.y - 6, 'gota', 6)
    }
    // el calor de la heroína
    const a: Alrededor = this.apagada || !heroe.vivo ? { luzFria: true } : this.alrededor(heroe)
    this.ultimoAlrededor = a
    const r = pasoCalor(this.calor, dt, a, peque)
    if (r.dano > 0) this.deps.danar(r.dano)
    if (r.cambio === 'acalorada') {
      this.deps.sonido('acalorada', { volumen: 0.6 })
      this.deps.texto(heroe.x, heroe.y - 60, '¡Qué calor!', 0xff9a5a)
    }
    this.avisoCalorS -= dt
    if (!this.calor.acalorada && this.calor.valor > 75 && this.avisoCalorS <= 0) {
      this.avisoCalorS = 1.6
      this.deps.sonido('calor_sube', { volumen: 0.35 })
    }
    if (a.luzFria && this.pegados.length) this.soltarHollines()
    this.dibujarCalor(heroe)
    // los hollines pegados la siguen, cada uno en su lugar
    this.pegados.forEach((s, i) => {
      const ang = i * 2.1 + this.t * 1.3
      s.setPosition(Math.round(heroe.x + Math.cos(ang) * 9), Math.round(heroe.y - 22 + Math.sin(ang) * 7)).setDepth(PROF.OBJETOS + heroe.y + 3)
    })
  }

  /** Lo que tiene alrededor la heroína para el calor */
  private alrededor(h: { x: number; y: number }): Alrededor {
    const k = FRAGUA.calor
    const luzFria = this.enLuzFria(h.x, h.y)
    const fuente = this.fuentes.some((f) => Math.hypot(f.x - h.x, f.y - h.y) <= 80)
    const lava = this.orillas.some((o) => Math.abs(o.x - h.x) < k.lavaA + 32 && Math.abs(o.y - h.y) < k.lavaA + 32 && Math.hypot(o.x - h.x, o.y - h.y) <= k.lavaA + 16)
    const grieta = this.grietas.some((g) => g.estado === 'caliente' && enParche(h.x, h.y, g))
    const fuegoPiso = this.fuegos.some((f) => enLinea(h.x, h.y, f.x, f.y, f.dx, f.dy, f.largo, f.ancho))
    const braseros = this.braseros.filter((b) => Math.hypot(b.x - h.x, b.y - h.y) <= k.braseroA).length
    const rastro = this.rastros.some((r) => Math.hypot(r.x - h.x, r.y - h.y) <= FRAGUA.salamandra.rastroRadio + 8)
    return { lava, grieta, fuegoPiso, braseros, rastro, luzFria, fuente }
  }

  /** El termómetro con la llamita arriba de la heroína: aparece cuando sube el calor */
  private dibujarCalor(h: { x: number; y: number }): void {
    const v = this.calor.valor / FRAGUA.calor.max
    const g = this.barraCalor
    g.clear()
    const ver = v > 0.08
    this.iconoCalor?.setVisible(ver)
    if (!ver) return
    const x = Math.round(h.x - 10)
    const y = Math.round(h.y - 62)
    const parpadea = this.calor.acalorada && Math.floor(this.t * 6) % 2 === 0
    this.iconoCalor?.setPosition(x, y).setAlpha(parpadea ? 0.6 : 1)
    const w = 20
    g.fillStyle(0x000000, 0.6).fillRect(x + 12, y - 2, w + 2, 5)
    const c = v < 0.5 ? 0xffb040 : v < 0.85 ? 0xff7020 : 0xff3a2a
    g.fillStyle(c, 1).fillRect(x + 13, y - 1, Math.max(1, Math.round(w * v)), 3)
  }

  /* ---------- para el olfato y las pruebas ---------- */

  /** Las jaulas cerradas de la zona donde está la heroína (Thor las rastrea) */
  pistasJaulas(x: number, y: number): { x: number; y: number }[] {
    const z = zonaEn(this.mapa.zonas, x, y)?.nombre
    return this.jaulas.filter((j) => !j.j.abierta && !j.deFarolero && (!z || j.j.zona === z)).map((j) => ({ x: j.j.x, y: j.j.y }))
  }

  get info() {
    const js = this.jaulas.map((q) => q.j)
    return {
      jaulas: this.jaulas.map((q) => ({ id: q.j.id, x: q.j.x, y: q.j.y, luz: q.j.luz, zona: q.j.zona, abierta: q.j.abierta, carcel: !!q.j.carcel, farolero: !!q.deFarolero })),
      libres: cuentaJaulas(js).libres,
      total: js.length,
      grietas: this.grietas.map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h, fase: g.fase, estado: g.estado })),
      surtidores: this.surtidores.map((s) => ({ id: s.id, x: s.x, y: s.y, px: s.px, py: s.py, recarga: Math.round(s.recargaS * 10) / 10 })),
      charcos: this.charcos,
      fuentes: this.fuentes,
      calor: Math.round(this.calor.valor * 10) / 10,
      acalorada: this.calor.acalorada,
      alrededor: this.ultimoAlrededor,
      agua: this.agua.cargas,
      hollines: this.pegados.length,
      fuegos: this.fuegos.length,
      rastros: this.rastros.length,
      orillas: this.orillas.length,
      apagada: this.apagada,
      t: Math.round(this.t * 100) / 100,
      periodo: periodoFuelle(this.rapido),
    }
  }

  /** Para las pruebas: corre el reloj de los fuelles hasta `t` */
  fijarReloj(t: number): void {
    this.t = t
  }

  destruir(): void {
    for (const j of this.jaulas) {
      j.s?.destroy()
      j.libre?.destroy()
    }
    for (const g of this.grietas) for (const s of g.s) s.destroy()
    for (const f of this.fuelles) f.s?.destroy()
    for (const s of this.surtidores) {
      s.s?.destroy()
      s.ps?.destroy()
      s.icono?.destroy()
    }
    for (const s of this.cadenas) s.destroy()
    for (const f of this.fuegos) for (const s of f.s) s.destroy()
    for (const r of this.rastros) r.s?.destroy()
    for (const v of this.subiendo) v.s.destroy()
    for (const s of this.pegados) s.destroy()
    this.iconoCalor?.destroy()
    this.barraCalor.destroy()
  }
}
