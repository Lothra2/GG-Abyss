import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { ABISMO } from '../config/balance'
import { avanceLuz, golpearCristal, reaccionFigura, reinaVulnerable, type Cristal } from '../logic/abismo'
import type { Luz } from './Decos'
import type { Objetivo } from './Entidades'

interface CristalVivo extends Cristal {
  forma: number
  s: Phaser.GameObjects.Sprite
}

export interface DepsGalerias {
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  brillo: (x: number, y: number) => void
  /** se prendió o se apagó un cristal: la partida guarda la lista */
  alCambiar: (prendidos: string[]) => void
  /** Thor gruñe (la figura está cerca) */
  thorGrune: () => void
  /** encontró el pedazo del mural */
  alMural: (pieza: number, x: number, y: number) => void
}

/**
 * Mundo 3, Las Galerías del Eco (PLAN.md F11). La luz es el progreso: los cristales se prenden al pegarles y quedan
 * prendidos (las reglas en logic/abismo.ts). También el carrito que empuja Thor, la figura de los ojos rojos que mira
 * desde el puente y se va si te acercas, y el tercer pedazo del mural.
 */
export class Galerias {
  readonly cristales: CristalVivo[] = []
  private carrito: { s: Phaser.GameObjects.Sprite; ruta: { x: number; y: number }[]; enFin: boolean; rodando: boolean } | null = null
  private figura: { s: Phaser.GameObjects.Sprite; x: number; y: number; estado: 'mirando' | 'se_va' | 'ida'; grunio: boolean } | null = null
  private mural: { x: number; y: number; pieza: number; visto: boolean } | null = null

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    mapa: MapaJuego,
    prendidos: readonly string[],
    private d: DepsGalerias,
  ) {
    const ya = new Set(prendidos)
    for (const c of mapa.cristales) {
      const prendido = ya.has(c.id)
      const s = escena.add.sprite(c.x, c.y, this.clave(c.grande, c.forma, prendido), 0)
      this.cristales.push({ id: c.id, x: c.x, y: c.y, grande: c.grande, prendido, forma: c.forma, s })
      this.vestir(this.cristales[this.cristales.length - 1]!, false)
    }
    const car = entidadesDeTipo(mapa, 'carrito')[0]
    if (car && this.existe('carrito_mina')) {
      const ruta = String(car.props.ruta ?? '')
        .split(';')
        .map((p) => p.split(',').map(Number))
        .filter((p) => p.length === 2 && p.every(Number.isFinite))
        .map(([tx, ty]) => ({ x: tx! * mapa.cuadro + mapa.cuadro / 2, y: ty! * mapa.cuadro + mapa.cuadro / 2 }))
      const def = m.mundo.objetos.carrito_mina!
      const s = escena.add.sprite(car.x, car.y, K.obj('carrito_mina', 'quieto'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + car.y)
      if (ruta.length >= 2) this.carrito = { s, ruta: [{ x: car.x, y: car.y }, ...ruta.slice(1)], enFin: false, rodando: false }
    }
    const fig = entidadesDeTipo(mapa, 'figura')[0]
    if (fig && this.existe('figura_ojos')) {
      const def = m.mundo.objetos.figura_ojos!
      const s = escena.add.sprite(fig.x, fig.y, K.obj('figura_ojos', 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + fig.y)
      this.anim('figura_ojos', 'idle', true)
      s.play('gal_figura_ojos_idle')
      this.figura = { s, x: fig.x, y: fig.y, estado: 'mirando', grunio: false }
    }
    const mu = entidadesDeTipo(mapa, 'mural')[0]
    if (mu) this.mural = { x: mu.x, y: mu.y, pieza: Number(mu.props.pieza ?? 3), visto: false }
  }

  private existe(id: string): boolean {
    const def = this.m.mundo.objetos[id]
    return !!def && this.escena.textures.exists(K.obj(id, Object.keys(def.anims)[0]!))
  }

  private clave(grande: boolean, forma: number, prendido: boolean, anim = 'idle'): string {
    const id = grande ? `cristal_grande_${prendido ? 'prendido' : 'apagado'}` : `cristal_${prendido ? 'prendido' : 'apagado'}_${forma}`
    return K.obj(id, anim)
  }

  private idObj(c: { grande: boolean; forma: number; prendido: boolean }): string {
    return c.grande ? `cristal_grande_${c.prendido ? 'prendido' : 'apagado'}` : `cristal_${c.prendido ? 'prendido' : 'apagado'}_${c.forma}`
  }

  private anim(id: string, nombre: string, loop: boolean): string {
    const key = `gal_${id}_${nombre}`
    const a = this.m.mundo.objetos[id]?.anims[nombre]
    if (a && !this.escena.anims.exists(key) && this.escena.textures.exists(K.obj(id, nombre))) {
      this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(K.obj(id, nombre), { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: loop ? -1 : 0 })
    }
    return key
  }

  /** Pone la textura y la animación que corresponden al estado. `prenderse`: la animación de prenderse antes del brillo */
  private vestir(c: CristalVivo, prenderse: boolean): void {
    const id = this.idObj(c)
    const def = this.m.mundo.objetos[id]
    if (!def) return
    c.s.setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + c.y)
    const brillo = this.anim(id, 'idle', true)
    if (prenderse && def.anims.prenderse) {
      const k = this.anim(id, 'prenderse', false)
      c.s.play(k)
      c.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.escena.anims.exists(brillo) && c.s.play(brillo))
    } else if (this.escena.anims.exists(brillo)) c.s.play(brillo)
    else c.s.setTexture(K.obj(id, 'idle'), 0)
  }

  private guardar(): void {
    this.d.alCambiar(this.cristales.filter((c) => c.prendido).map((c) => c.id))
  }

  /** Prende un cristal. Devuelve true si estaba apagado */
  prender(c: CristalVivo): boolean {
    if (!golpearCristal(c)) return false
    this.vestir(c, true)
    this.d.sonido('cristal_prender', { volumen: 0.6 })
    this.d.brillo(c.x, c.y - (c.grande ? 60 : 24))
    this.guardar()
    return true
  }

  /** La polilla de ceniza (o el polvo de la reina) apaga un cristal */
  apagar(id: string): void {
    const c = this.cristales.find((q) => q.id === id)
    if (!c || !c.prendido) return
    c.prendido = false
    this.vestir(c, false)
    this.d.sonido('cristal_apagar', { volumen: 0.5 })
    this.guardar()
  }

  /** El cristal bajo un toque (para ir a prenderlo) */
  golpe(x: number, y: number): Objetivo | null {
    for (const c of this.cristales) {
      const alto = c.grande ? 110 : 46
      if (Math.abs(x - c.x) < (c.grande ? 30 : 16) && y > c.y - alto && y < c.y + 8) return this.objetivo(c)
    }
    return null
  }

  private objetivo(c: CristalVivo): Objetivo {
    return { tipo: 'cristal', x: c.x, y: c.y, radio: c.grande ? 50 : 34, parada: { x: c.x, y: c.y + 22 }, llave: `cristal:${c.id}` }
  }

  /** Lo que se toca para usarlo: los cristales apagados y el carrito */
  objetivos(): Objetivo[] {
    const out = this.cristales.filter((c) => !c.prendido).map((c) => this.objetivo(c))
    if (this.carrito && !this.carrito.rodando) out.push(this.objCarrito())
    return out
  }

  private objCarrito(): Objetivo {
    const s = this.carrito!.s
    return { tipo: 'carrito', x: s.x, y: s.y, radio: 46, parada: { x: s.x + 30, y: s.y + 10 }, llave: 'carrito' }
  }

  golpeCarrito(x: number, y: number): Objetivo | null {
    const c = this.carrito
    if (!c || c.rodando) return null
    return Math.abs(x - c.s.x) < 30 && y > c.s.y - 48 && y < c.s.y + 10 ? this.objCarrito() : null
  }

  /** Usar un objetivo de las Galerías: prender el cristal o subirse al carrito */
  usar(o: Objetivo, alViajar: (x: number, y: number, ms: number) => void): boolean {
    if (o.tipo === 'cristal') {
      const c = this.cristales.find((q) => `cristal:${q.id}` === o.llave)
      return !!c && this.prender(c)
    }
    if (o.tipo === 'carrito' && this.carrito && !this.carrito.rodando) {
      const car = this.carrito
      const puntos = car.enFin ? [...car.ruta].reverse() : car.ruta
      car.rodando = true
      const anim = this.anim('carrito_mina', 'rodar', true)
      if (this.escena.anims.exists(anim)) car.s.play(anim)
      this.d.sonido('carrito_rodar', { volumen: 0.5 })
      // el carrito va de punto en punto a 160 px/s y la heroína viaja con él
      let ms = 0
      const tramos = puntos.slice(1).map((p, i) => {
        const a = puntos[i]!
        const dur = (Math.hypot(p.x - a.x, p.y - a.y) / 160) * 1000
        ms += dur
        return { p, dur }
      })
      const fin = puntos[puntos.length - 1]!
      alViajar(fin.x, fin.y, ms)
      this.escena.tweens.chain({
        targets: car.s,
        tweens: tramos.map((t) => ({ x: t.p.x, y: t.p.y, duration: t.dur, ease: 'Linear', onUpdate: () => car.s.setDepth(PROF.OBJETOS + car.s.y) })),
        onComplete: () => {
          car.rodando = false
          car.enFin = !car.enFin
          car.s.anims.stop()
          car.s.setTexture(K.obj('carrito_mina', 'quieto'), 0)
        },
      })
      return true
    }
    return false
  }

  /** Cristales al alcance de un golpe: el más cercano frente a la heroína, a menos de `alcance` */
  cercaDeGolpe(hx: number, hy: number, dirX: number, dirY: number, alcance = 46): CristalVivo | null {
    let mejor: CristalVivo | null = null
    let dm = Infinity
    for (const c of this.cristales) {
      if (c.prendido) continue
      const dx = c.x - hx
      const dy = c.y - hy
      const d = Math.hypot(dx, dy)
      const delante = d < 14 || dx * dirX + dy * dirY > 0
      if (d < alcance + (c.grande ? 16 : 0) && delante && d < dm) {
        dm = d
        mejor = c
      }
    }
    return mejor
  }

  /** Cada cuadro: la luz de los cristales prendidos (y de los ojos de la figura), y lo que pasa cerca de la heroína */
  update(heroe: { x: number; y: number }, luces: Luz[]): void {
    for (const c of this.cristales) {
      if (!c.prendido) continue
      const l = this.m.mundo.objetos[this.idObj(c)]?.luz
      if (l) luces.push({ x: c.x, y: c.y - (l.dy ?? 0), r: l.radius, color: l.color, pulse: l.pulse, ph: (c.x * 0.013) % 1, alto: l.dy ?? 0 })
    }
    const f = this.figura
    if (f && f.estado === 'mirando') {
      const r = reaccionFigura(f, heroe)
      if (r.thorGrunne && !f.grunio) {
        f.grunio = true
        this.d.thorGrune()
      }
      const l = this.m.mundo.objetos.figura_ojos?.luz
      if (l) luces.push({ x: f.x, y: f.y - (l.dy ?? 0), r: l.radius, color: l.color, pulse: true, ph: 0.4, alto: l.dy ?? 0 })
      if (r.estado === 'se_va') {
        f.estado = 'se_va'
        this.d.sonido('figura_irse', { volumen: 0.6 })
        const k = this.anim('figura_ojos', 'irse', false)
        if (this.escena.anims.exists(k)) {
          f.s.play(k)
          f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { f.s.setVisible(false); f.estado = 'ida' })
        } else {
          f.s.setVisible(false)
          f.estado = 'ida'
        }
      }
    }
    const mu = this.mural
    if (mu && !mu.visto && Math.hypot(heroe.x - mu.x, heroe.y - mu.y) < 80) {
      mu.visto = true
      this.d.alMural(mu.pieza, mu.x, mu.y)
    }
  }

  get info() {
    return {
      cristales: this.cristales.length,
      prendidos: this.cristales.filter((c) => c.prendido).length,
      avance: Math.round(avanceLuz(this.cristales) * 100) / 100,
      grandes: this.cristales.filter((c) => c.grande).map((c) => ({ id: c.id, x: c.x, y: c.y, prendido: c.prendido })),
      reinaVulnerable: reinaVulnerable(this.cristales),
      figura: this.figura?.estado ?? null,
      carrito: this.carrito ? { x: Math.round(this.carrito.s.x), y: Math.round(this.carrito.s.y), rodando: this.carrito.rodando, enFin: this.carrito.enFin } : null,
      mural: this.mural?.visto ?? null,
    }
  }

  /** Dónde va el carrito (la heroína viaja adentro mientras rueda) */
  get posCarrito(): { x: number; y: number } | null {
    return this.carrito ? { x: this.carrito.s.x, y: this.carrito.s.y } : null
  }

  /** El polvo de la reina apaga los cristales que tapa. En modo peque los grandes no */
  apagarConPolvo(x: number, y: number, radio: number, peque: boolean): string[] {
    const ids: string[] = []
    for (const c of this.cristales) {
      if (!c.prendido || (peque && c.grande)) continue
      if (Math.hypot(c.x - x, c.y - y) <= radio + (c.grande ? 16 : 0)) ids.push(c.id)
    }
    for (const id of ids) this.apagar(id)
    return ids
  }

  /** Para la reina: ¿los cuatro grandes prendidos? */
  get reinaVulnerable(): boolean {
    return reinaVulnerable(this.cristales)
  }

  /** El radio de luz de los cristales (para las sombras) */
  static radioLuz(grande: boolean): number {
    return grande ? ABISMO.cristal.radioLuzGrande : ABISMO.cristal.radioLuz
  }

  destruir(): void {
    for (const c of this.cristales) c.s.destroy()
    this.carrito?.s.destroy()
    this.figura?.s.destroy()
  }
}
