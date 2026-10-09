import Phaser from 'phaser'
import { K } from '../kit/claves'
import { COLOR, PROF } from '../config/juego'
import type { Luz } from '../game/Decos'

/**
 * Oscuridad con pozos de luz y resplandor de color (PLAN.md 2.5 y 3.2, pasos 7 y 8 del visor).
 * Una RenderTexture del tamaño de la vista se llena con el color de la noche y cada luz borra un pozo
 * con la textura `luz` del kit. Encima va el resplandor de color en modo aditivo.
 */
const LADO_LUZ = 128

const hexNum = (h: string): number => parseInt(h.replace('#', ''), 16)

export class Luces {
  private rt: Phaser.GameObjects.RenderTexture
  private sello: Phaser.GameObjects.Image
  private brillos: Phaser.GameObjects.Image[] = []
  private usados = 0
  /** cuántas luces dibujó el último cuadro (para las pruebas) */
  ultimas = 0

  constructor(
    private escena: Phaser.Scene,
    ancho: number,
    alto: number,
  ) {
    this.rt = escena.add.renderTexture(0, 0, ancho, alto).setOrigin(0, 0).setScrollFactor(0).setDepth(PROF.OSCURIDAD)
    // el sello no se muestra: solo se estampa en la textura
    this.sello = escena.make.image({ key: K.luz, add: false }).setOrigin(0.5, 0.5)
  }

  redimensionar(ancho: number, alto: number): void {
    this.rt.resize(ancho, alto)
  }

  private brillo(i: number): Phaser.GameObjects.Image {
    let b = this.brillos[i]
    if (!b) {
      b = this.escena.add.image(0, 0, K.luz).setDepth(PROF.BRILLO).setBlendMode(Phaser.BlendModes.ADD)
      this.brillos[i] = b
    }
    return b
  }

  /**
   * `luces` en coordenadas del mundo. `oscuridad` es la final (0 a 0.6). `tope` es el máximo de luces.
   * La luz de la heroína siempre entra.
   */
  update(t: number, vista: Phaser.Geom.Rectangle, luces: Luz[], oscuridad: number, tope: number): void {
    const cx = vista.x + vista.width / 2
    const cy = vista.y + vista.height / 2
    const margen = 160
    const heroina = luces.filter((l) => l.heroina)
    const resto = luces
      .filter((l) => !l.heroina && l.x > vista.x - l.r - margen && l.x < vista.right + l.r + margen && l.y > vista.y - l.r - margen && l.y < vista.bottom + l.r + margen)
      .map((l) => ({ l, d: (l.x - cx) ** 2 + (l.y - cy) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.max(0, tope - heroina.length))
      .map((x) => x.l)
    const todas = [...heroina, ...resto]
    this.ultimas = todas.length

    // pozos que borran la oscuridad
    this.rt.setVisible(oscuridad > 0.004)
    if (oscuridad > 0.004) {
      this.rt.clear()
      this.rt.fill(COLOR.OSCURIDAD, oscuridad)
      this.rt.beginDraw()
      for (const l of todas) {
        const k = l.flicker ? 0.86 + 0.14 * Math.sin(t * 11 + l.ph * 20) * Math.sin(t * 7.3 + l.ph * 9) : l.pulse ? 0.82 + 0.18 * Math.sin(t * 2 + l.ph * 6) : 1
        const R = l.r * k
        this.sello.setScale((R * 2) / LADO_LUZ).setAlpha(l.heroina ? 0.75 : 1)
        this.rt.batchDraw(this.sello, l.x - vista.x, l.y - vista.y)
      }
      this.rt.endDraw(true)
    }

    // resplandor de color de cada luz (la de la heroína no)
    let n = 0
    for (const l of todas) {
      if (l.heroina) continue
      const k = l.flicker ? 0.85 + 0.15 * Math.sin(t * 9 + l.ph * 13) : l.pulse ? 0.8 + 0.2 * Math.sin(t * 2 + l.ph * 6) : 1
      const R = l.r * 0.7 * k
      this.brillo(n++)
        .setVisible(true)
        .setPosition(Math.round(l.x), Math.round(l.y))
        .setScale((R * 2) / LADO_LUZ)
        .setAlpha(0.22 + oscuridad * 0.25)
        .setTint(hexNum(l.color))
    }
    for (let i = n; i < this.usados; i++) this.brillos[i]?.setVisible(false)
    this.usados = n
  }

  destruir(): void {
    this.rt.destroy()
    this.sello.destroy()
    for (const b of this.brillos) b.destroy()
    this.brillos = []
  }
}
