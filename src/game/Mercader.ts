import Phaser from 'phaser'
import { K } from '../kit/claves'
import type { Manifest } from '../kit/tipos'
import { crearAnimsPersonaje } from '../kit/anims'
import type { Grilla } from '../logic/grilla'
import { lugarAbierto } from '../logic/lugar'
import { indiceDireccion } from '../logic/direccion'
import { PROF } from '../config/juego'
import { Sombra } from './Sombras'
import type { Objetivo } from './Entidades'

/** El personaje del kit que hace de mercader */
export const ID_MERCADER = 'mercader'
/** a esta distancia mira a la heroína, y más cerca la saluda una vez */
const MIRA_PX = 160
const SALUDA_PX = 96

interface Puesto {
  x: number
  y: number
  s: Phaser.GameObjects.Sprite
  sombra: Sombra
  moneda: Phaser.GameObjects.Image | null
  liberar: () => void
  dir: number
  saludo: boolean
  ph: number
}

/**
 * Don Cachivache, el mercader (sale de PixelForja como personaje `npc`). Se para al lado de cada fogata, mira a la
 * heroína cuando se acerca, la saluda con un gesto y tiene una moneda que flota encima: así se sabe que ahí se compra.
 * Tocarlo lleva a la heroína hasta él y abre la tienda.
 */
export class Mercader {
  private puestos: Puesto[] = []

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    grilla: Grilla,
    lugares: { x: number; y: number }[],
  ) {
    const p = m.personajes[ID_MERCADER]
    if (!p || !escena.textures.exists(K.pers(ID_MERCADER, 'idle'))) return
    crearAnimsPersonaje(escena, m, ID_MERCADER)
    for (const l of lugares) {
      // al lado de la fogata, en un lugar abierto: su cuadro se bloquea y no puede cortar un paso angosto
      const t = lugarAbierto(grilla, l.x + 64, l.y + 6, l)
      if (!t) continue
      const { tx, ty } = t
      const pos = grilla.centroDe(tx, ty)
      const liberar = grilla.bloquearRect(tx, ty, tx, ty)
      const x = Math.round(pos.x)
      const y = Math.round(pos.y)
      const s = escena.add.sprite(x, y, K.pers(ID_MERCADER, 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda).setDepth(PROF.OBJETOS + y)
      const sombra = new Sombra(escena, 26)
      sombra.poner(x, y)
      const moneda = escena.textures.exists(K.ui('icono_oro')) ? escena.add.image(x, y - p.celda - 4, K.ui('icono_oro')).setDepth(PROF.OBJETOS + y + 900) : null
      const puesto: Puesto = { x, y, s, sombra, moneda, liberar, dir: 0, saludo: false, ph: (x * 0.011) % 6.28 }
      this.mirar(puesto, 0)
      this.puestos.push(puesto)
    }
  }

  get hay(): boolean {
    return this.puestos.length > 0
  }

  private mirar(p: Puesto, dir: number): void {
    p.dir = dir
    const d = this.m.direcciones[dir] ?? 'down'
    const key = K.anim(ID_MERCADER, 'idle', d)
    if (this.escena.anims.exists(key) && p.s.anims.currentAnim?.key !== key && !p.s.anims.currentAnim?.key.includes('_cast_')) p.s.play({ key, startFrame: Math.floor(p.ph) % 4 })
  }

  /** Cada cuadro: mira a la heroína si está cerca, la saluda una vez al llegar y la moneda flota */
  update(t: number, heroe: { x: number; y: number }): void {
    for (const p of this.puestos) {
      if (p.moneda) p.moneda.setY(Math.round(p.y - (this.m.personajes[ID_MERCADER]?.celda ?? 48) - 4 + Math.sin(t * 2.4 + p.ph) * 2))
      const d = Math.hypot(heroe.x - p.x, heroe.y - p.y)
      if (d > MIRA_PX) {
        p.saludo = false
        if (p.dir !== 0) this.mirar(p, 0)
        continue
      }
      const dir = indiceDireccion(heroe.x - p.x, heroe.y - p.y)
      if (dir !== p.dir) this.mirar(p, dir)
      if (d <= SALUDA_PX && !p.saludo) {
        p.saludo = true
        const key = K.anim(ID_MERCADER, 'cast', this.m.direcciones[dir] ?? 'down')
        if (this.escena.anims.exists(key)) {
          p.s.play(key)
          p.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            p.s.anims.stop()
            this.mirar(p, p.dir)
          })
        }
      }
    }
  }

  /** Un toque sobre el mercader (o su moneda) */
  golpe(x: number, y: number): Objetivo | null {
    for (const p of this.puestos) if (Math.abs(x - p.x) < 22 && y > p.y - 64 && y < p.y + 10) return this.objetivo(p)
    return null
  }

  private objetivo(p: Puesto): Objetivo {
    return { tipo: 'mercader', x: p.x, y: p.y, radio: 44, parada: { x: p.x - 30, y: p.y + 8 }, llave: `mercader:${p.x}:${p.y}` }
  }

  objetivos(): Objetivo[] {
    return this.puestos.map((p) => this.objetivo(p))
  }

  info() {
    return this.puestos.map((p) => ({ x: p.x, y: p.y, dir: p.dir, saludo: p.saludo, anim: p.s.anims.currentAnim?.key ?? null, moneda: !!p.moneda }))
  }

  destruir(): void {
    for (const p of this.puestos) {
      p.liberar()
      p.s.destroy()
      p.sombra.img.destroy()
      p.moneda?.destroy()
    }
    this.puestos = []
  }
}
