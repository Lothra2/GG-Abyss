import Phaser from 'phaser'
import { K } from '../kit/claves'
import type { CapaHoja, Manifest } from '../kit/tipos'
import type { PiezaVisible } from '../logic/aspecto'

interface Capa {
  pieza: PiezaVisible
  hoja: CapaHoja
  s: Phaser.GameObjects.Sprite
}

/**
 * Las capas de equipo encima de un personaje (el muñeco de papel): un sprite por pieza puesta, que copia cuadro a cuadro
 * lo que hace el sprite base (animación, dirección, posición, profundidad, alfa, tinte). Los dibujos salen de PixelForja:
 * cada capa trae un bloque por animación con las 8 direcciones.
 */
export class CapasSprite {
  private capas: Capa[] = []
  /** textura de la hoja base -> animación y cuántos cuadros tiene */
  private animDe = new Map<string, { nombre: string; cuadros: number }>()
  private sincronizar = () => this.sync()

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private id: string,
    private base: Phaser.GameObjects.Sprite,
    /** si el personaje va dentro de un contenedor (la selección), las capas van en el mismo, justo encima */
    private contenedor?: Phaser.GameObjects.Container,
  ) {
    const p = m.personajes[id]
    for (const [nombre, a] of Object.entries(p?.anims ?? {})) this.animDe.set(K.pers(id, nombre), { nombre, cuadros: a.cuadros })
    // después de que todo el mundo movió y animó al personaje
    escena.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sincronizar)
    escena.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destruir())
  }

  /** Lo que se ve puesto ahora (las piezas cuya hoja todavía no se cargó se ponen al llamar de nuevo) */
  poner(lista: readonly PiezaVisible[]): PiezaVisible[] {
    for (const c of this.capas) c.s.destroy()
    this.capas = []
    const faltan: PiezaVisible[] = []
    const capas = this.m.personajes[this.id]?.capas
    for (const pieza of lista) {
      const hoja = capas?.[pieza.tipo]?.[pieza.clave]
      if (!hoja) continue
      const key = K.capa(this.id, pieza.tipo, pieza.clave)
      if (!this.escena.textures.exists(key)) {
        faltan.push(pieza)
        continue
      }
      const s = this.escena.add.sprite(this.base.x, this.base.y, key, 0)
      if (this.contenedor) this.contenedor.addAt(s, this.contenedor.getIndex(this.base) + 1 + this.capas.length)
      this.capas.push({ pieza, hoja, s })
    }
    this.sync()
    return faltan
  }

  get puestas(): PiezaVisible[] {
    return this.capas.map((c) => c.pieza)
  }

  /** Copia el cuadro del sprite base en cada capa */
  sync(): void {
    const b = this.base
    if (!b.active) return
    const info = this.animDe.get(b.texture.key)
    const idx = Number(b.frame.name)
    this.capas.forEach((c, k) => {
      const bl = info ? c.hoja.bloques[info.nombre] : undefined
      if (!info || !bl || !Number.isFinite(idx)) {
        c.s.setVisible(false)
        return
      }
      const fila = Math.floor(idx / info.cuadros)
      const col = Math.min(idx % info.cuadros, bl.cuadros - 1)
      c.s.setFrame((bl.y + fila) * c.hoja.columnas + bl.x + col)
      c.s.setPosition(b.x, b.y).setOrigin(b.originX, b.originY).setScale(b.scaleX, b.scaleY).setFlip(b.flipX, b.flipY)
      c.s.setDepth(b.depth + 0.001 * (k + 1)).setAlpha(b.alpha).setVisible(b.visible)
      if (b.isTinted) {
        c.s.tintFill = b.tintFill
        c.s.setTint(b.tintTopLeft)
      } else if (c.s.isTinted) c.s.clearTint()
    })
  }

  info() {
    return this.capas.map((c) => ({ tipo: c.pieza.tipo, clave: c.pieza.clave, cuadro: Number(c.s.frame.name), visible: c.s.visible }))
  }

  destruir(): void {
    this.escena.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sincronizar)
    for (const c of this.capas) c.s.destroy()
    this.capas = []
  }
}
