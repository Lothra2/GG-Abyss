import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { entidadesDeTipo, llaveEntidad, type Entidad, type MapaJuego } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { hash2 } from '../logic/azar'
import type { Fuente } from '../logic/botin'
import type { Partida } from '../logic/guardado'
import type { Sonido } from './Sonido'
import { texto } from './Texto'

export type TipoObjetivo = 'cofre' | 'cartel' | 'fogata' | 'abuelo' | 'rompible' | 'mercader'

/** Algo del mundo que se puede tocar: la heroína camina hasta ahí y lo usa */
export interface Objetivo {
  tipo: TipoObjetivo
  x: number
  y: number
  /** a qué distancia de (x, y) se considera que llegó */
  radio: number
  /** dónde se para la heroína para usarlo */
  parada: { x: number; y: number }
  llave: string
}

interface Cofre {
  e: Entidad
  s: Phaser.GameObjects.Sprite
  nivel: string
  llave: string
  abierto: boolean
  abriendo: boolean
  secreto: boolean
}

interface Rompible {
  e: Entidad
  s: Phaser.GameObjects.Sprite
  objeto: string
  llave: string
  roto: boolean
}

interface Cartel {
  e: Entidad
  icono: string
  texto: string
  burbuja: Phaser.GameObjects.Image
  ph: number
}

interface Fogata {
  e: Entidad
  id: string
  nombre: string
  listo: boolean
}

export interface DepsEntidades {
  partida: () => Partida
  sonido: Sonido
  /** guardar en una fogata */
  alGuardar: (f: { id: string; nombre: string; x: number; y: number }) => void
  /** el cofre abierto era un secreto nuevo */
  alSecreto: (llave: string, nombre: string) => void
  /** un cofre o un rompible suelta su premio en el piso (lo sortea quien lo recibe) */
  alPremio: (fuente: Fuente, x: number, y: number) => void
  /** abrir un cartel: su ícono y su texto */
  alLeerCartel: (icono: string, texto: string) => void
  /** abrazar al Abuelo Roble */
  alAbrazar: (x: number, y: number) => void
  /** un cofre se abrió (autoguardado) */
  alAbrirCofre: (llave: string) => void
  /** se tocó una fogata (además de guardar): abre la tienda */
  alUsarFogata?: (f: { id: string; nombre: string; x: number; y: number }) => void
}

/** Nombre legible de la pista de un cofre secreto */
export function nombreDePista(pista: string): string {
  const n: Record<string, string> = {
    tras_la_cascada: 'Tras la cascada',
    anillo_hadas: 'Anillo de las Hadas',
    claro_escondido: 'Claro Escondido',
    pasto_alto: 'Entre el pasto alto',
    estanque_alto: 'El estanque alto',
  }
  if (n[pista]) return n[pista]!
  const t = pista.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const PAD = 10

/**
 * Lo que se puede usar en el Bosque GG (PLAN.md F1b, tarea 5): los cofres (se abren, sale una moneda), los carteles
 * (se leen con su ícono), las fogatas (guardan) y el Abuelo Roble (sonríe cuando lo abrazan).
 */
export class Entidades {
  readonly cofres: Cofre[] = []
  readonly carteles: Cartel[] = []
  readonly fogatas: Fogata[] = []
  readonly rompibles: Rompible[] = []
  private abuelos: { x: number; y: number }[] = []
  private mapa: MapaJuego
  private cofresJefeListos = false

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    mapa: MapaJuego,
    private deps: DepsEntidades,
  ) {
    this.mapa = mapa
    for (const c of entidadesDeTipo(mapa, 'cofre')) {
      // el cofre del jefe aparece recién cuando se vence al minotauro (F4)
      if (c.props.tras_jefe === true) continue
      this.crearCofre(c)
    }
    for (const c of entidadesDeTipo(mapa, 'cartel')) {
      const icono = String(c.props.icono ?? 'flecha_norte')
      const key = escena.textures.exists(K.ui(`cartel_${icono}`)) ? K.ui(`cartel_${icono}`) : K.ui('icono_mapa')
      const burbuja = escena.add.image(c.x, c.y - 30, key).setDepth(PROF.OBJETOS + c.y + 600).setAlpha(0)
      this.carteles.push({ e: c, icono, texto: String(c.props.texto ?? ''), burbuja, ph: hash2(c.x, c.y) * 6 })
    }
    for (const c of entidadesDeTipo(mapa, 'punto_guardado')) {
      this.fogatas.push({ e: c, id: String(c.props.id ?? llaveEntidad(c)), nombre: String(c.props.nombre ?? ''), listo: true })
    }
    const rotos = new Set(deps.partida().rompibles)
    for (const c of entidadesDeTipo(mapa, 'rompible')) {
      const objeto = String(c.props.objeto ?? 'caja')
      const def = m.mundo.objetos[objeto]
      const tex = K.obj(objeto, 'idle')
      if (!def || !escena.textures.exists(tex)) continue
      const llave = llaveEntidad(c)
      const roto = rotos.has(llave)
      const s = escena.add.sprite(c.x, c.y, tex, 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + c.y).setVisible(!roto)
      this.rompibles.push({ e: c, s, objeto, llave, roto })
    }
    for (const d of mapa.decos) if (d.sprite === 'abuelo_roble_v3') this.abuelos.push({ x: d.x, y: d.y })
  }

  /** Lo que hay bajo un toque en el mundo (con un poco de margen para el dedo), o null */
  golpe(x: number, y: number): Objetivo | null {
    let mejor: Objetivo | null = null
    let mejorD = Infinity
    const probar = (o: Objetivo, dentro: boolean) => {
      if (!dentro) return
      const d = Math.hypot(x - o.x, y - (o.y - 14))
      if (d < mejorD) {
        mejorD = d
        mejor = o
      }
    }
    for (const c of this.cofres) probar(this.objCofre(c), Math.abs(x - c.e.x) < 24 + PAD && y > c.e.y - 46 - PAD && y < c.e.y + 8 + PAD)
    for (const f of this.fogatas) probar(this.objFogata(f), Math.abs(x - f.e.x) < 34 + PAD && y > f.e.y - 58 - PAD && y < f.e.y + 14 + PAD)
    for (const c of this.carteles) probar(this.objCartel(c), Math.abs(x - c.e.x) < 16 + PAD && y > c.e.y - 28 - PAD && y < c.e.y + 30 + PAD)
    for (const r of this.rompibles) if (!r.roto) probar(this.objRompible(r), Math.abs(x - r.e.x) < 18 + PAD && y > r.e.y - 34 - PAD && y < r.e.y + 6 + PAD)
    for (const a of this.abuelos) probar(this.objAbuelo(a), Math.abs(x - a.x) < 44 && y > a.y - 80 && y < a.y + 34)
    return mejor
  }

  private objCofre(c: Cofre): Objetivo {
    return { tipo: 'cofre', x: c.e.x, y: c.e.y, radio: 40, parada: { x: c.e.x, y: c.e.y + 22 }, llave: c.llave }
  }
  private objRompible(r: Rompible): Objetivo {
    return { tipo: 'rompible', x: r.e.x, y: r.e.y, radio: 36, parada: { x: r.e.x, y: r.e.y + 22 }, llave: r.llave }
  }
  private objCartel(c: Cartel): Objetivo {
    return { tipo: 'cartel', x: c.e.x, y: c.e.y, radio: 46, parada: { x: c.e.x, y: c.e.y + 26 }, llave: llaveEntidad(c.e) }
  }
  private objFogata(f: Fogata): Objetivo {
    return { tipo: 'fogata', x: f.e.x, y: f.e.y, radio: 46, parada: { x: f.e.x, y: f.e.y + 26 }, llave: f.id }
  }
  private objAbuelo(a: { x: number; y: number }): Objetivo {
    return { tipo: 'abuelo', x: a.x, y: a.y, radio: 64, parada: { x: a.x, y: a.y + 30 }, llave: `abuelo:${a.x}:${a.y}` }
  }

  private crearCofre(c: Entidad): void {
    const escena = this.escena
    const ya = new Set(this.deps.partida().cofres)
    const nivel = String(c.props.nivel ?? 'madera')
    const quieto = `cofre_${nivel}_quieto`
    if (!escena.anims.exists(quieto)) return
    const llave = llaveEntidad(c)
    const abierto = ya.has(llave)
    const s = escena.add.sprite(c.x, c.y, 'atlas_mundo', `${quieto}_0`).setOrigin(0.5, 0.9).setDepth(PROF.OBJETOS + c.y)
    if (abierto) s.setFrame(`cofre_${nivel}_abrir_9`)
    else s.play({ key: quieto, startFrame: Math.floor(hash2(c.x, c.y) * 8) % 8 })
    this.cofres.push({ e: c, s, nivel, llave, abierto, abriendo: false, secreto: c.props.secreto === true })
  }

  /** El cofre legendario del jefe aparece al vencerlo, con su haz de luz del set */
  mostrarCofresTrasJefe(): void {
    if (this.cofresJefeListos) return
    this.cofresJefeListos = true
    for (const c of entidadesDeTipo(this.mapa, 'cofre')) {
      if (c.props.tras_jefe !== true) continue
      this.crearCofre(c)
      const nuevo = this.cofres[this.cofres.length - 1]
      if (!nuevo || nuevo.abierto || !this.escena.anims.exists('haz_set')) continue
      const haz = this.escena.add.sprite(c.x, c.y, 'atlas_mundo', 'haz_set_0').setOrigin(0.5, 0.92).setDepth(PROF.OBJETOS + c.y - 1).setAlpha(0.9)
      haz.play('haz_set')
    }
  }

  /** Todo lo que se puede usar, para las pruebas */
  objetivos(): Objetivo[] {
    return [...this.cofres.map((c) => this.objCofre(c)), ...this.carteles.map((c) => this.objCartel(c)), ...this.fogatas.map((f) => this.objFogata(f)), ...this.rompibles.filter((r) => !r.roto).map((r) => this.objRompible(r)), ...this.abuelos.map((a) => this.objAbuelo(a))]
  }

  usar(o: Objetivo): void {
    if (o.tipo === 'cofre') this.abrirCofre(o.llave)
    else if (o.tipo === 'rompible') this.romper(o.llave)
    else if (o.tipo === 'cartel') {
      const c = this.carteles.find((q) => llaveEntidad(q.e) === o.llave)
      if (c) this.deps.alLeerCartel(c.icono, c.texto)
    } else if (o.tipo === 'fogata') {
      const f = this.fogatas.find((q) => q.id === o.llave)
      if (f) {
        this.guardarEn(f)
        this.deps.alUsarFogata?.({ id: f.id, nombre: f.nombre, x: f.e.x, y: f.e.y })
      }
    } else this.deps.alAbrazar(o.x, o.y)
  }

  /* ---------- cofres ---------- */

  abrirCofre(llave: string): boolean {
    const c = this.cofres.find((q) => q.llave === llave)
    if (!c || c.abierto || c.abriendo) return false
    c.abriendo = true
    const abrir = `cofre_${c.nivel}_abrir`
    c.s.play(abrir)
    this.deps.sonido.efecto('cofre_abrir', { volumen: 0.8 })
    // a mitad de la apertura sale la moneda
    this.escena.time.delayedCall(330, () => this.salirMoneda(c))
    c.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      c.abierto = true
      c.abriendo = false
    })
    const p = this.deps.partida()
    if (!p.cofres.includes(c.llave)) p.cofres.push(c.llave)
    if (c.secreto) {
      const pista = String(c.e.props.pista ?? '')
      this.deps.alSecreto(c.llave, nombreDePista(pista))
    }
    this.deps.alAbrirCofre(c.llave)
    return true
  }

  /** Rompe una caja, barril o vasija: sale su premio y queda guardado que ya se rompió */
  romper(llave: string): boolean {
    const r = this.rompibles.find((q) => q.llave === llave)
    if (!r || r.roto) return false
    r.roto = true
    const rom = K.obj(r.objeto, 'romper')
    this.deps.sonido.efecto('romper', { volumen: 0.8, rate: 0.9 + hash2(r.e.x, r.e.y) * 0.3 })
    if (this.escena.textures.exists(rom)) {
      const def = this.m.mundo.objetos[r.objeto]!
      const key = `romper_${r.objeto}`
      if (!this.escena.anims.exists(key)) {
        const a = def.anims.romper!
        this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(rom, { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: 0 })
      }
      r.s.play(key)
      r.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.s.setVisible(false))
    } else r.s.setVisible(false)
    const p = this.deps.partida()
    if (!p.rompibles.includes(r.llave)) p.rompibles.push(r.llave)
    this.deps.alPremio({ tipo: 'rompible' }, r.e.x, r.e.y)
    this.deps.alAbrirCofre(r.llave)
    return true
  }

  private salirMoneda(c: Cofre): void {
    if (this.escena.textures.exists('atlas_mundo') && this.escena.anims.exists('moneda_gira')) {
      const moneda = this.escena.add.sprite(c.e.x, c.e.y - 24, 'atlas_mundo', 'moneda_gira_0').setDepth(PROF.OBJETOS + c.e.y + 700)
      moneda.play('moneda_gira')
      this.escena.tweens.add({ targets: moneda, y: c.e.y - 56, duration: 260, ease: 'Quad.easeOut', yoyo: false })
      this.escena.tweens.add({ targets: moneda, alpha: 0, delay: 520, duration: 260, onComplete: () => moneda.destroy() })
    }
    this.deps.sonido.efecto('moneda', { volumen: 0.8 })
    this.deps.alPremio({ tipo: 'cofre', nivel: c.nivel, pista: c.secreto ? String(c.e.props.pista ?? '') : undefined, tutorial: c.e.props.tutorial === true }, c.e.x, c.e.y + 6)
  }

  /* ---------- fogatas ---------- */

  private guardarEn(f: Fogata): void {
    this.deps.sonido.efecto(this.m.audio.guardado ? 'guardado' : 'curar', { volumen: 0.8 })
    this.deps.alGuardar({ id: f.id, nombre: f.nombre, x: f.e.x, y: f.e.y })
  }

  /** Un número que sube y se desvanece con el ícono del oro (o un texto suelto) */
  flotante(x: number, y: number, contenido: string, icono = 'icono_oro', tinte = 0xffd27a): void {
    const c = this.escena.add.container(Math.round(x), Math.round(y)).setDepth(PROF.OBJETOS + 9000)
    const t = texto(this.escena, 0, 0, contenido, 'fuente_ui', 1, { origen: [0, 0.5], tinte })
    const ic = this.escena.add.image(0, 0, K.ui(icono)).setOrigin(0, 0.5)
    const total = ic.displayWidth + 2 + t.displayWidth
    ic.setX(-total / 2)
    t.setX(-total / 2 + ic.displayWidth + 2)
    c.add([ic, t])
    this.escena.tweens.add({ targets: c, y: c.y - 26, alpha: 0, duration: 1500, ease: 'Sine.easeOut', onComplete: () => c.destroy() })
  }

  /** Cada cuadro: las burbujas de los carteles se asoman cuando la heroína está cerca y las fogatas guardan al pasar */
  update(t: number, heroe: { x: number; y: number }, puedeGuardar: boolean): void {
    for (const c of this.carteles) {
      const d = Math.hypot(heroe.x - c.e.x, heroe.y - c.e.y)
      const a = Phaser.Math.Clamp((220 - d) / 90, 0, 1)
      c.burbuja.setAlpha(a).setVisible(a > 0.01)
      if (a > 0.01) c.burbuja.setPosition(c.e.x, Math.round(c.e.y - 30 + Math.sin(t * 3 + c.ph) * 2))
    }
    for (const f of this.fogatas) {
      const d = Math.hypot(heroe.x - f.e.x, heroe.y - f.e.y)
      if (d > 96) f.listo = true
      else if (d < 48 && f.listo && puedeGuardar) {
        f.listo = false
        this.guardarEn(f)
      }
    }
  }

  fogataCercana(heroe: { x: number; y: number }): { id: string; nombre: string; x: number; y: number } | null {
    let mejor: Fogata | null = null
    let mejorD = Infinity
    for (const f of this.fogatas) {
      const d = Math.hypot(heroe.x - f.e.x, heroe.y - f.e.y)
      if (d < mejorD) {
        mejorD = d
        mejor = f
      }
    }
    return mejor ? { id: mejor.id, nombre: mejor.nombre, x: mejor.e.x, y: mejor.e.y } : null
  }
}
