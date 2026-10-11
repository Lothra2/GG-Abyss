import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { bordeFrente, corrimientoTira } from '../logic/capas'

/**
 * El primer plano del taller (PLAN.md F10, encargo 2.5): ramas que cuelgan del borde de arriba y hojas que suben
 * del de abajo, pegadas a la pantalla mientras la heroína está en una zona que las pide (propiedad `frente`).
 * Se corren con paralaje 1.15 (un poco más rápido que el mundo) y entran y salen con un fundido de medio segundo.
 * Como la oscuridad, va pegado a la pantalla con el zoom de la cámara: mide lo que se ve del mundo.
 */
export class Frente {
  private capa: Phaser.GameObjects.Container
  private saliente: Phaser.GameObjects.Container | null = null
  private tiras: { c: Phaser.GameObjects.Container; periodo: number }[] = []
  private ids: string[] = []
  private ancho = 0
  private alto = 0
  private ox = 0
  private oy = 0

  constructor(private escena: Phaser.Scene, private m: Manifest) {
    this.capa = this.nuevaCapa()
  }

  private nuevaCapa(): Phaser.GameObjects.Container {
    return this.escena.add.container(this.ox, this.oy).setScrollFactor(0).setDepth(PROF.FRENTE).setAlpha(0)
  }

  /** Lo que se ve del mundo y dónde va para cubrir la pantalla (igual que la oscuridad) */
  redimensionar(ancho: number, alto: number, ox: number, oy: number): void {
    this.ancho = ancho
    this.alto = alto
    this.ox = ox
    this.oy = oy
    this.capa.setPosition(ox, oy)
    this.armar(this.capa, this.ids)
  }

  /** Cambia a los ids que pide la zona nueva (lista vacía: se va el primer plano) */
  zona(ids: string[]): void {
    const validos = ids.filter((id) => this.m.mundo.objetos[id] && this.escena.textures.exists(this.textura(id)))
    if (validos.join(',') === this.ids.join(',')) return
    this.ids = validos
    // la capa vieja se funde hacia afuera y la nueva hacia adentro
    const vieja = this.capa
    this.saliente?.destroy()
    this.saliente = vieja
    this.escena.tweens.add({ targets: vieja, alpha: 0, duration: 500, onComplete: () => { if (this.saliente === vieja) this.saliente = null; vieja.destroy() } })
    this.capa = this.nuevaCapa()
    this.armar(this.capa, validos)
    if (validos.length) this.escena.tweens.add({ targets: this.capa, alpha: 1, duration: 500 })
  }

  private textura(id: string): string {
    const def = this.m.mundo.objetos[id]
    const an = def?.anims.idle ? 'idle' : Object.keys(def?.anims ?? {})[0] ?? 'idle'
    return K.obj(id, an)
  }

  private anim(id: string): string | null {
    const def = this.m.mundo.objetos[id]
    const a = def?.anims.idle ?? Object.values(def?.anims ?? {})[0]
    if (!a || a.cuadros <= 1) return null
    const key = `frente_${id}`
    if (!this.escena.anims.exists(key)) this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(this.textura(id), { start: 0, end: a.cuadros - 1 }), frameRate: a.fps, repeat: -1 })
    return key
  }

  /** Una tira por borde: las piezas de ese borde una al lado de la otra, repetidas hasta cubrir el ancho y una más */
  private armar(capa: Phaser.GameObjects.Container, ids: string[]): void {
    capa.removeAll(true)
    this.tiras = []
    if (!ids.length || this.ancho <= 0) return
    for (const borde of ['arriba', 'abajo'] as const) {
      const piezas = ids.filter((id) => bordeFrente(this.m.mundo.objetos[id]!) === borde)
      if (!piezas.length) continue
      const tira = this.escena.add.container(0, 0)
      // cada pieza se solapa un cuarto con la siguiente para que la tira no tenga huecos
      const pasos = piezas.map((id) => Math.round(this.m.mundo.objetos[id]!.w * 0.75))
      const periodo = pasos.reduce((a, b) => a + b, 0)
      let x = 0
      let i = 0
      while (x < this.ancho + periodo * 2) {
        const id = piezas[i % piezas.length]!
        const def = this.m.mundo.objetos[id]!
        const y = borde === 'arriba' ? 0 : this.alto
        const s = this.escena.add.sprite(Math.round(x + def.w / 2), Math.round(y), this.textura(id), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h)
        const a = this.anim(id)
        // cada pieza arranca en un cuadro distinto, como los árboles con el viento
        if (a) s.play({ key: a, startFrame: (i * 3) % Math.max(1, (def.anims.idle?.cuadros ?? 1)) })
        tira.add(s)
        x += pasos[i % piezas.length]!
        i++
      }
      capa.add(tira)
      this.tiras.push({ c: tira, periodo })
    }
  }

  get visible(): boolean {
    return this.ids.length > 0 && this.capa.alpha > 0.01
  }

  get piezas(): string[] {
    return [...this.ids]
  }

  update(vista: Phaser.Geom.Rectangle): void {
    for (const t of this.tiras) t.c.x = corrimientoTira(vista.x, t.periodo) - t.periodo
  }

  destruir(): void {
    this.saliente?.destroy()
    this.capa.destroy()
  }
}
