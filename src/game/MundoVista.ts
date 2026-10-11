import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { idMundo } from '../kit/mundos'

/**
 * Agua animada y suelo pintado (PLAN.md 2.3, capas 0 y 1).
 * El agua va DEBAJO del suelo: los trozos de suelo son transparentes donde hay agua.
 */
export class MundoVista {
  private agua: { img: Phaser.GameObjects.Image; id: number; x: number; y: number }[] = []
  private cuadroAgua = -1
  readonly suelo: Phaser.GameObjects.Image[] = []
  /** F10: la espuma de las orillas, encima del suelo y debajo de los objetos */
  private espuma: { img: Phaser.GameObjects.Image; pieza: number; x: number; y: number }[] = []
  private cuadroEspuma = -1
  private espumaDef: { columnas: number; cuadros: number; fps: number } | null = null

  constructor(escena: Phaser.Scene, m: Manifest, private mapa: MapaJuego) {
    const c = mapa.cuadro
    const mundo = idMundo(m.mundo)
    for (let i = 0; i < mapa.agua.length; i++) {
      const id = mapa.agua[i]!
      if (!id) continue
      const tx = i % mapa.ancho
      const ty = (i - tx) / mapa.ancho
      const img = escena.add.image(tx * c, ty * c, K.aguaDe(mundo), id === 1 ? 0 : id - 1).setOrigin(0, 0).setDepth(PROF.AGUA)
      this.agua.push({ img, id, x: tx * c, y: ty * c })
    }
    m.mundo.suelo.forEach((s, i) => {
      this.suelo.push(escena.add.image(s.x, s.y, K.sueloDe(mundo, i)).setOrigin(0, 0).setDepth(PROF.SUELO))
    })
    const e = m.mundo.espuma
    if (e && escena.textures.exists(K.espumaDe(mundo))) {
      this.espumaDef = e
      for (let i = 0; i < mapa.espuma.length; i++) {
        const n = mapa.espuma[i]!
        if (!n) continue
        const tx = i % mapa.ancho
        const ty = (i - tx) / mapa.ancho
        const img = escena.add.image(tx * c, ty * c, K.espumaDe(mundo), n - 1).setOrigin(0, 0).setDepth(PROF.SUELO + 0.5)
        this.espuma.push({ img, pieza: n - 1, x: tx * c, y: ty * c })
      }
    }
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
    // la espuma: el cuadro f de cada pieza está f * filas * columnas cuadros más adelante en el atlas
    const d = this.espumaDef
    if (d) {
      const fe = Math.floor(tSeg * d.fps) % d.cuadros
      const cambioE = fe !== this.cuadroEspuma
      this.cuadroEspuma = fe
      const salto = fe * this.mapa.espumaFilas * d.columnas
      for (const e of this.espuma) {
        const visible = e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1
        if (e.img.visible !== visible) e.img.setVisible(visible)
        if (visible && cambioE) e.img.setFrame(e.pieza + salto)
      }
    }
  }

  /** Cuántas piezas de espuma hay (para las pruebas) */
  get espumas(): number {
    return this.espuma.length
  }

  get frameAgua(): number {
    return this.cuadroAgua
  }

  /** Cuántos cuadros de agua se están dibujando (para las pruebas) */
  aguaVisible(): number {
    return this.agua.reduce((n, a) => n + (a.img.visible ? 1 : 0), 0)
  }
}
