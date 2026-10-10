import Phaser from 'phaser'
import { K } from '../kit/claves'
import type { Manifest, ObjetoMundo } from '../kit/tipos'
import { entidadesDeTipo, type MapaJuego } from '../kit/mapa'
import type { Grilla } from '../logic/grilla'
import { activo, brasaMasCercana, cambiosAl, estadoForja } from '../logic/brasas'
import { PROF } from '../config/juego'
import type { Luz } from './Decos'

/** Lo que el mundo le presta a los mecanismos */
export interface DepsMecanismos {
  escena: Phaser.Scene
  m: Manifest
  mapa: MapaJuego
  grilla: Grilla
  /** las brasas que ya volvieron (los ids, es el arreglo de la partida) */
  brasas: () => string[]
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  estallido: (x: number, y: number, llave: string, n: number) => void
  texto: (x: number, y: number, s: string, tinte: number) => void
  /** se recogió una brasa: el mundo guarda y avisa */
  alRecoger: (id: string, n: number) => void
  /** el jefe del mundo ya se liberó (la campana suena turquesa) */
  liberado: () => boolean
}

interface Pieza {
  s: Phaser.GameObjects.Sprite
  def: ObjetoMundo | undefined
  nombre: string
  x: number
  y: number
  ph: number
}

/** Los objetos que este módulo dibuja (para pedirlos en la carga) */
export const OBJETOS_MECANISMOS = ['pedestal_brasas_0', 'pedestal_brasas_1', 'pedestal_brasas_2', 'pedestal_brasas_3', 'brasero_apagado', 'brasero_cobre', 'forja_0', 'forja_1', 'forja_2', 'forja_3', 'brasa', 'raices_cortina', 'campana', 'campana_libre']

/**
 * F8, la forja de la Catedral (PLAN.md F8). Dibuja lo que cambia con las brasas: el pedestal del atrio con sus huecos,
 * los braseros que se prenden, la forja y las compuertas de raíces que cierran el paso (y lo bloquean en la grilla
 * mientras están cerradas). Las brasas se recogen pasando por encima. Todo cambio se ve y se oye.
 */
export class Mecanismos {
  private pedestal: Pieza | null = null
  private forja: Pieza | null = null
  private braseros: (Pieza & { requiere: number })[] = []
  private compuertas: (Pieza & { id: string; requiere: number; liberar: (() => void) | null; abierta: boolean })[] = []
  private piezasBrasa: (Pieza & { id: string; recogida: boolean })[] = []
  private campana: Pieza | null = null
  private aplicado = -1

  constructor(private d: DepsMecanismos) {
    const { mapa } = d
    const n = d.brasas().length
    for (const e of entidadesDeTipo(mapa, 'pedestal_brasas')) this.pedestal = this.pieza(`pedestal_brasas_${estadoForja(n)}`, e.x, e.y)
    for (const e of entidadesDeTipo(mapa, 'forja')) this.forja = this.pieza(`forja_${estadoForja(n)}`, e.x, e.y)
    for (const e of entidadesDeTipo(mapa, 'campana')) this.campana = this.pieza(d.liberado() ? 'campana_libre' : 'campana', e.x, e.y)
    for (const e of entidadesDeTipo(mapa, 'brasero_brasa')) {
      const requiere = Number(e.props.requiere ?? 1)
      const p = this.pieza(activo(requiere, n) ? 'brasero_cobre' : 'brasero_apagado', e.x, e.y)
      if (p) this.braseros.push({ ...p, requiere })
    }
    for (const e of entidadesDeTipo(mapa, 'compuerta_raices')) {
      const pr = e.props as Record<string, number | string>
      const requiere = Number(pr.requiere ?? 1)
      const p = this.pieza('raices_cortina', e.x, e.y)
      if (!p) continue
      const c = { ...p, id: String(pr.id ?? ''), requiere, liberar: null as (() => void) | null, abierta: false }
      if (activo(requiere, n)) {
        c.abierta = true
        c.s.setVisible(false)
      } else c.liberar = d.grilla.bloquearRect(Number(pr.x0), Number(pr.y0), Number(pr.x1), Number(pr.y1))
      this.compuertas.push(c)
    }
    for (const e of entidadesDeTipo(mapa, 'brasa')) {
      const id = String(e.props.id ?? '')
      const p = this.pieza('brasa', e.x, e.y)
      if (!p) continue
      const recogida = d.brasas().includes(id)
      p.s.setVisible(!recogida)
      this.piezasBrasa.push({ ...p, id, recogida })
    }
    this.aplicado = n
  }

  /** Si este mundo tiene la misión de las brasas */
  get hay(): boolean {
    return this.piezasBrasa.length > 0
  }

  get total(): number {
    return this.piezasBrasa.length
  }

  private pieza(nombre: string, x: number, y: number): Pieza | null {
    const def = this.d.m.mundo.objetos[nombre]
    const key = K.obj(nombre, 'idle')
    if (!def || !this.d.escena.textures.exists(key)) return null
    const s = this.d.escena.add.sprite(Math.round(x), Math.round(y), key, 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h)
    s.setDepth(def.capa === 'suelo' ? PROF.SUELO + 2 : PROF.OBJETOS + y)
    return { s, def, nombre, x, y, ph: (x * 0.013 + y * 0.007) % 6.28 }
  }

  /** Cambia una pieza a otro objeto (apagado a encendido) */
  private cambiar(p: Pieza, nombre: string): void {
    const def = this.d.m.mundo.objetos[nombre]
    const key = K.obj(nombre, 'idle')
    if (!def || !this.d.escena.textures.exists(key)) return
    p.s.setTexture(key, 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h)
    p.def = def
    p.nombre = nombre
  }

  /** Cada paso del mundo: recoger una brasa pasando por encima y aplicar lo que cambia */
  revisar(heroe: { x: number; y: number }): void {
    // recoger una brasa pasando por encima
    for (const b of this.piezasBrasa) {
      if (b.recogida || Math.hypot(heroe.x - b.x, heroe.y - b.y) > 26) continue
      b.recogida = true
      this.d.escena.tweens.add({ targets: b.s, y: b.s.y - 24, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => b.s.setVisible(false) })
      this.d.estallido(b.x, b.y - 10, 'brasa', 14)
      this.d.sonido('legendario', { volumen: 0.7 })
      const lista = this.d.brasas()
      if (!lista.includes(b.id)) lista.push(b.id)
      const n = lista.length
      this.d.texto(b.x, b.y - 40, `¡Brasa ${n} de ${this.total}!`, 0xffd27a)
      this.d.alRecoger(b.id, n)
    }
    const n = this.d.brasas().length
    if (n !== this.aplicado) this.aplicar(n)
  }

  /** Cada cuadro: animación por tiempo (como los decorados) y las luces */
  update(t: number, luces: Luz[]): void {
    for (const p of [this.pedestal, this.forja, this.campana, ...this.braseros, ...this.compuertas, ...this.piezasBrasa]) {
      if (!p || !p.s.visible || !p.def) continue
      const a = p.def.anims.idle
      if (a && a.cuadros > 1) p.s.setFrame(Math.floor(t * a.fps + p.ph * 3) % a.cuadros)
      const l = p.def.luz
      if (l) luces.push({ x: p.x, y: p.y - (l.dy ?? 0), r: l.radius, color: l.color, flicker: l.flicker, pulse: l.pulse, ph: p.ph })
    }
  }

  /** Lo que cambia con las brasas: se ve y se oye */
  private aplicar(n: number): void {
    const antes = this.aplicado
    this.aplicado = n
    // una brasa que ya está en la partida (llegó por otro lado) no se queda en el piso
    const lista = this.d.brasas()
    for (const b of this.piezasBrasa) if (!b.recogida && lista.includes(b.id)) {
      b.recogida = true
      b.s.setVisible(false)
    }
    if (this.pedestal) this.cambiar(this.pedestal, `pedestal_brasas_${estadoForja(n)}`)
    if (this.forja) this.cambiar(this.forja, `forja_${estadoForja(n)}`)
    for (const b of this.braseros) {
      if (b.nombre === 'brasero_apagado' && activo(b.requiere, n)) {
        this.cambiar(b, 'brasero_cobre')
        this.d.estallido(b.x, b.y - 26, 'brasa', 8)
      }
    }
    for (const c of this.compuertas) {
      if (c.abierta || !activo(c.requiere, n)) continue
      c.abierta = true
      c.liberar?.()
      c.liberar = null
      // las raíces se recogen hacia arriba y dejan brotes turquesa
      this.d.escena.tweens.add({ targets: c.s, scaleY: 0.1, alpha: 0, duration: 900, ease: 'Quad.easeIn', onComplete: () => c.s.setVisible(false) })
      this.d.estallido(c.x, c.y - 30, 'espora', 14)
      this.d.sonido('secreto', { volumen: 0.6, rate: 0.8 })
    }
    const cambios = cambiosAl(n, this.compuertas, this.braseros)
    if (n > antes && cambios.forjaEncendida && this.forja) {
      this.d.estallido(this.forja.x, this.forja.y - 60, 'brasa', 24)
      this.d.sonido('portal', { volumen: 0.7, rate: 0.6 })
    }
  }

  /** F8: el guardián se liberó: la campana deja la corrupción (violeta) y brota turquesa */
  liberar(): void {
    const c = this.campana
    if (!c || c.nombre === 'campana_libre') return
    this.cambiar(c, 'campana_libre')
    this.d.estallido(c.x, c.y - 60, 'espora', 24)
    for (const b of this.braseros) if (b.nombre === 'brasero_apagado') this.cambiar(b, 'brasero_cobre')
  }

  /** La brasa que falta más cerca (para Thor y la flecha) */
  brasaCercana(x: number, y: number): { x: number; y: number } | null {
    const b = brasaMasCercana(this.piezasBrasa, this.d.brasas(), x, y)
    return b ? { x: b.x, y: b.y } : null
  }

  info() {
    return {
      brasas: this.d.brasas().length,
      total: this.total,
      pedestal: this.pedestal?.nombre ?? null,
      forja: this.forja?.nombre ?? null,
      campana: this.campana?.nombre ?? null,
      braseros: this.braseros.map((b) => ({ requiere: b.requiere, encendido: b.nombre === 'brasero_cobre' })),
      compuertas: this.compuertas.map((c) => ({ id: c.id, requiere: c.requiere, abierta: c.abierta })),
      piezas: this.piezasBrasa.map((b) => ({ id: b.id, x: b.x, y: b.y, recogida: b.recogida })),
    }
  }

  destruir(): void {
    for (const c of this.compuertas) c.liberar?.()
    for (const p of [this.pedestal, this.forja, this.campana, ...this.braseros, ...this.compuertas, ...this.piezasBrasa]) p?.s.destroy()
  }
}
