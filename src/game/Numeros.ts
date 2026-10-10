import Phaser from 'phaser'
import { K } from '../kit/claves'
import { COMBATE } from '../config/balance'
import { PROF } from '../config/juego'
import { escalaDe } from './Pantalla'

export type ColorNumero = 'blanco' | 'amarillo' | 'rojo' | 'verde' | 'azul'

const FILAS: ColorNumero[] = ['blanco', 'amarillo', 'rojo', 'verde', 'azul']
const CARACTERES = '0123456789+-!'

/**
 * Números de daño con `ui/numeros.png` (13 columnas por 5 filas, un color por fila). Suben 24 px y se desvanecen en 0.8 s.
 * Blanco daño normal, amarillo crítico, rojo daño recibido, verde curación, azul maná.
 */
export class Numeros {
  private activos = 0

  constructor(private escena: Phaser.Scene) {}

  mostrar(x: number, y: number, texto: string, color: ColorNumero, grande = false): void {
    if (this.activos >= COMBATE.topeNumeros) return
    const tex = K.ui('numeros')
    if (!this.escena.textures.exists(tex)) return
    const zoom = escalaDe(this.escena.game).zoom
    const escala = (zoom >= 3 ? 1 : 2) + (grande ? 1 : 0)
    const fila = FILAS.indexOf(color)
    const cont = this.escena.add.container(Math.round(x), Math.round(y)).setDepth(PROF.OBJETOS + 9500)
    let cx = 0
    const imgs: Phaser.GameObjects.Image[] = []
    for (const ch of texto) {
      const i = CARACTERES.indexOf(ch)
      if (i < 0) continue
      const img = this.escena.add.image(cx, 0, tex, fila * CARACTERES.length + i).setOrigin(0, 0.5).setScale(escala)
      imgs.push(img)
      cx += 7 * escala
    }
    // centrado, con un contorno oscuro dado por una copia desplazada
    const ancho = cx
    for (const img of imgs) img.x -= ancho / 2
    cont.add(imgs)
    this.activos++
    const fin = () => {
      this.activos--
      cont.destroy()
    }
    if (grande) {
      // el crítico salta, se queda un instante a la vista y recién ahí se va
      this.escena.tweens.chain({
        targets: cont,
        tweens: [
          { y: cont.y - 14, duration: 110, ease: 'Back.easeOut' },
          { y: cont.y - 16, duration: 260 },
          { y: cont.y - 34, alpha: 0, duration: 520, ease: 'Sine.easeIn' },
        ],
        onComplete: fin,
      })
    } else this.escena.tweens.add({ targets: cont, y: cont.y - 24, alpha: 0, duration: 800, ease: 'Sine.easeOut', onComplete: fin })
  }

  get cantidad(): number {
    return this.activos
  }
}
