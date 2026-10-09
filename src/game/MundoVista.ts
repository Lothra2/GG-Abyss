import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'

/**
 * Agua animada y suelo pintado (PLAN.md 2.3, capas 0 y 1).
 * El agua va DEBAJO del suelo: los trozos de suelo son transparentes donde hay agua.
 */
export class MundoVista {
  private agua: { img: Phaser.GameObjects.Image; id: number; x: number; y: number }[] = []
  private cuadroAgua = -1
  readonly suelo: Phaser.GameObjects.Image[] = []

  constructor(escena: Phaser.Scene, m: Manifest, private mapa: MapaJuego) {
    const c = mapa.cuadro
    for (let i = 0; i < mapa.agua.length; i++) {
      const id = mapa.agua[i]!
      if (!id) continue
      const tx = i % mapa.ancho
      const ty = (i - tx) / mapa.ancho
      const img = escena.add.image(tx * c, ty * c, K.agua, id === 1 ? 0 : id - 1).setOrigin(0, 0).setDepth(PROF.AGUA)
      this.agua.push({ img, id, x: tx * c, y: ty * c })
    }
    m.mundo.suelo.forEach((s, i) => {
      this.suelo.push(escena.add.image(s.x, s.y, K.suelo(i)).setOrigin(0, 0).setDepth(PROF.SUELO))
    })
  }

  /** Cambia el cuadro del agua cada `aguaMs` y esconde lo que no se ve */
  update(tSeg: number, vista: Phaser.Geom.Rectangle): void {
    const c = this.mapa.cuadro
    const f = Math.floor((tSeg * 1000) / this.mapa.aguaMs) % this.mapa.aguaCuadros
    const cambio = f !== this.cuadroAgua
    this.cuadroAgua = f
    const x0 = vista.x - c
    const x1 = vista.right + c
    const y0 = vista.y - c
    const y1 = vista.bottom + c
    for (const a of this.agua) {
      const visible = a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1
      if (a.img.visible !== visible) a.img.setVisible(visible)
      if (visible && cambio && a.id === 1) a.img.setFrame(f)
    }
  }

  get frameAgua(): number {
    return this.cuadroAgua
  }

  /** Cuántos cuadros de agua se están dibujando (para las pruebas) */
  aguaVisible(): number {
    return this.agua.reduce((n, a) => n + (a.img.visible ? 1 : 0), 0)
  }
}
