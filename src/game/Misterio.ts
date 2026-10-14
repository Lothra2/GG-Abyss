import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { ABISMO } from '../config/balance'
import { reaccionFigura } from '../logic/abismo'
import type { Luz } from './Decos'

export interface DepsMisterio {
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  /** Thor gruñe (la figura está cerca) */
  thorGrune: () => void
  /** encontró el pedazo del mural */
  alMural: (pieza: number, x: number, y: number) => void
  /** la figura se fue de aquí (en el Puerto apaga el farol del muelle que tenga cerca) */
  alIrse?: (x: number, y: number) => void
}

interface Figura {
  s: Phaser.GameObjects.Sprite
  x: number
  y: number
  /** en lo alto del faro: se ve de lejos y se va antes, cuando la heroína se acerca a la arena */
  alto: boolean
  estado: 'mirando' | 'se_va' | 'ida'
  grunio: boolean
  def: string
}

/**
 * El misterio de los pisos de abajo sin cristales (PLAN.md F12): la figura de los ojos rojos, que mira desde lejos y se va
 * si te acercas (en el Puerto, mojada, y más de una), y el pedazo del mural. Las Galerías siguen con lo suyo.
 */
export class Misterio {
  private figuras: Figura[] = []
  private mural: { x: number; y: number; pieza: number; visto: boolean } | null = null

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    mapa: MapaJuego,
    private d: DepsMisterio,
  ) {
    // la figura mojada del Puerto si el kit la trae, si no la de las Galerías
    const def = this.existe('figura_ojos_mojada') ? 'figura_ojos_mojada' : this.existe('figura_ojos') ? 'figura_ojos' : null
    if (def) {
      const o = m.mundo.objetos[def]!
      // las figuras con barrio son la Ladrona de la Ciudad Dormida (las maneja Ciudad): acá solo las que miran
      for (const e of entidadesDeTipo(mapa, 'figura').filter((q) => q.props.barrio === undefined || q.props.alto === true)) {
        const alto = e.props.alto === true
        const s = escena.add.sprite(e.x, e.y, K.obj(def, 'idle'), 0).setOrigin(o.apoyo[0] / o.w, o.apoyo[1] / o.h)
        // en lo alto del faro se dibuja encima de la torre
        s.setDepth(PROF.OBJETOS + e.y + (alto ? 400 : 0))
        const k = this.anim(def, 'idle', true)
        if (escena.anims.exists(k)) s.play({ key: k, startFrame: e.id % 3 })
        this.figuras.push({ s, x: e.x, y: e.y, alto, estado: 'mirando', grunio: false, def })
      }
    }
    const mu = entidadesDeTipo(mapa, 'mural')[0]
    if (mu) this.mural = { x: mu.x, y: mu.y, pieza: Number(mu.props.pieza ?? 4), visto: false }
  }

  private existe(id: string): boolean {
    const def = this.m.mundo.objetos[id]
    return !!def && this.escena.textures.exists(K.obj(id, Object.keys(def.anims)[0]!))
  }

  private anim(id: string, nombre: string, loop: boolean): string {
    const key = `mis_${id}_${nombre}`
    const a = this.m.mundo.objetos[id]?.anims[nombre]
    if (a && !this.escena.anims.exists(key) && this.escena.textures.exists(K.obj(id, nombre))) {
      this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(K.obj(id, nombre), { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: loop ? -1 : 0 })
    }
    return key
  }

  /** Cada cuadro: los ojos de las figuras alumbran un poquito, se van si te acercas, y el mural se descubre al pasar */
  update(heroe: { x: number; y: number }, luces: Luz[]): void {
    for (const f of this.figuras) {
      if (f.estado !== 'mirando') continue
      const r = reaccionFigura(f, heroe)
      // la del faro mira de lejos: se va cuando la heroína ya está cerca de la arena
      const seVa = f.alto ? Math.hypot(f.x - heroe.x, f.y - heroe.y) <= ABISMO.figura.seVaA * 2.4 : r.estado === 'se_va'
      if (r.thorGrunne && !f.grunio) {
        f.grunio = true
        this.d.thorGrune()
      }
      const l = this.m.mundo.objetos[f.def]?.luz
      if (l) luces.push({ x: f.x, y: f.y - (l.dy ?? 0), r: l.radius, color: l.color, pulse: true, ph: 0.4, alto: l.dy ?? 0 })
      if (!seVa) continue
      f.estado = 'se_va'
      this.d.sonido('figura_irse', { volumen: f.alto ? 0.4 : 0.6 })
      this.d.alIrse?.(f.x, f.y)
      const k = this.anim(f.def, 'irse', false)
      if (this.escena.anims.exists(k)) {
        f.s.play(k)
        f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          f.s.setVisible(false)
          f.estado = 'ida'
        })
      } else {
        f.s.setVisible(false)
        f.estado = 'ida'
      }
    }
    const mu = this.mural
    if (mu && !mu.visto && Math.hypot(heroe.x - mu.x, heroe.y - mu.y) < 80) {
      mu.visto = true
      this.d.alMural(mu.pieza, mu.x, mu.y)
    }
  }

  get info() {
    return { figuras: this.figuras.map((f) => ({ x: f.x, y: f.y, alto: f.alto, estado: f.estado })), mural: this.mural?.visto ?? null }
  }

  destruir(): void {
    for (const f of this.figuras) f.s.destroy()
    this.figuras = []
  }
}
