import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { traducirParticulas, type MapaJuego } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { hash2 } from '../logic/azar'
import type { Luz } from './Decos'
import { Luces } from '../fx/Luces'
import { Bruma } from '../fx/Bruma'
import { Particulas } from '../fx/Particulas'
import { NOMBRE_FX, registrarAtmosferaFX, type AtmosferaFX } from '../fx/AtmosferaFX'

/** La postal que hace de fondo del título y de la selección: la entrada al abismo, con su cueva y sus antorchas */
const POSTAL = 'arena_del_minotauro'
const ANCHO_POSTAL = 960
const ALTO_POSTAL = 540
/** Dónde está lo importante dentro de la postal (la cueva arriba, el círculo en el medio) */
const FOCO = { x: 480, y: 215 }

export interface OpcionesFondo {
  /** 0 a 1: cuánto se oscurece (el título 0.45, la selección un poco más) */
  oscuridad: number
  bruma: number
}

/**
 * Fondo vivo del título (PLAN.md F1b, tarea 1): la postal `arena_del_minotauro` a escala entera, la bruma
 * corriendo, pozos de luz en la cueva y las antorchas, y brasas subiendo. Usa las mismas piezas de atmósfera del mundo.
 */
export class FondoAbismo {
  private img: Phaser.GameObjects.Image
  private luces: Luces
  private bruma: Bruma
  private particulas: Particulas
  private fx: AtmosferaFX | null = null
  private lucesLocales: { lx: number; ly: number; luz: Luz }[] = []
  private escala = 1
  private ox = 0
  private oy = 0
  private t = 0
  private emisores = traducirParticulas(['brasas', 'luciernagas'], () => {}).emisores

  constructor(
    private escena: Phaser.Scene,
    m: Manifest,
    mapa: MapaJuego,
    private op: OpcionesFondo,
  ) {
    const w = escena.scale.width
    const h = escena.scale.height
    const key = K.postal(POSTAL)
    this.img = escena.add.image(0, 0, key).setOrigin(0, 0).setDepth(PROF.SUELO)

    // las luces salen de los objetos del mapa que caen dentro del encuadre de la postal
    const p = mapa.postales.find((q) => q.nombre === POSTAL) ?? { x: 3280, y: 368 }
    const x0 = p.x - ANCHO_POSTAL / 2
    const y0 = p.y - ALTO_POSTAL / 2
    for (const d of mapa.decos) {
      const def = m.mundo.objetos[d.sprite]
      if (!def?.luz) continue
      if (d.x < x0 || d.x > x0 + ANCHO_POSTAL || d.y < y0 || d.y > y0 + ALTO_POSTAL) continue
      this.lucesLocales.push({
        lx: d.x - x0,
        ly: d.y - (def.luz.dy ?? 0) - y0,
        luz: { x: 0, y: 0, r: def.luz.radius, color: def.luz.color, flicker: def.luz.flicker, pulse: def.luz.pulse, ph: hash2(d.x, d.y) },
      })
    }

    this.luces = new Luces(escena, w, h)
    this.bruma = new Bruma(escena, w, h)
    this.particulas = new Particulas(escena, m)
    if (registrarAtmosferaFX(escena.game)) {
      escena.cameras.main.setPostPipeline(NOMBRE_FX)
      const inst = escena.cameras.main.getPostPipeline(NOMBRE_FX)
      this.fx = (Array.isArray(inst) ? inst[0] : inst) as AtmosferaFX
      this.fx.tinte = [1, 0.69, 0.54]
    }
    this.acomodar()
  }

  /** La escala entera más chica con la que la postal cubre toda la vista, centrada en la cueva */
  acomodar(): void {
    const w = this.escena.scale.width
    const h = this.escena.scale.height
    this.escala = Math.max(1, Math.ceil(Math.max(w / ANCHO_POSTAL, h / ALTO_POSTAL)))
    const s = this.escala
    this.ox = Math.round(Math.min(0, Math.max(w - ANCHO_POSTAL * s, w / 2 - FOCO.x * s)))
    this.oy = Math.round(Math.min(0, Math.max(h - ALTO_POSTAL * s, h / 2 - FOCO.y * s)))
    this.img.setScale(s).setPosition(this.ox, this.oy)
    this.luces.redimensionar(w, h)
    this.bruma.redimensionar(w, h)
  }

  update(dt: number): void {
    this.t += dt
    const w = this.escena.scale.width
    const h = this.escena.scale.height
    const vista = new Phaser.Geom.Rectangle(0, 0, w, h)
    const s = this.escala
    const luces: Luz[] = this.lucesLocales.map(({ lx, ly, luz }) => ({ ...luz, x: this.ox + lx * s, y: this.oy + ly * s, r: luz.r * s }))
    this.particulas.update(this.t, dt, vista, { emisores: this.emisores, noche: 0.2, luces, rafaga: false, decos: null })
    this.luces.update(this.t, vista, luces, this.op.oscuridad, 40)
    this.bruma.update(this.t, w / 2, h / 2, this.op.bruma, 2)
    if (this.fx) {
      this.fx.tinteK = 0.3
      this.fx.vineta = 0.8
    }
  }

  /** Donde quedó la cueva en pantalla, para ubicar el logo sin taparla */
  get topeCueva(): number {
    return this.oy + 100 * this.escala
  }

  destruir(): void {
    this.escena.cameras?.main?.resetPostPipeline(true)
    this.img.destroy()
    this.luces.destruir()
    this.bruma.destruir()
    this.particulas.destruir()
  }
}

