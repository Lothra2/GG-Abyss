import Phaser from 'phaser'
import { K } from '../kit/claves'
import { PORTAL_FX, PROF } from '../config/juego'

interface Mota {
  img: Phaser.GameObjects.Image
  /** ángulo y cuánto le falta para llegar al centro (1 recién nace afuera, 0 se la tragó) */
  a: number
  f: number
  v: number
}

/**
 * La vida alrededor de un portal del taller (el dibujo es suyo, esto es solo luz técnica y un efecto del kit):
 * un círculo mágico que brilla en el piso, el centro que late con el color del portal y motas de luz que giran y se
 * meten al remolino, como si lo chupara. Cuando la heroína se acerca todo se enciende más y gira más rápido.
 */
export class PortalFx {
  private suelo: Phaser.GameObjects.Sprite | null = null
  private nucleo: Phaser.GameObjects.Image
  private halo: Phaser.GameObjects.Image
  private motas: Mota[] = []
  private fuerza = 0
  private t = Math.random() * 10
  private readonly cx: number
  private readonly cy: number

  constructor(
    escena: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    color: number,
  ) {
    const c = PORTAL_FX
    this.cx = x
    this.cy = y - c.alturaCentro
    const prof = PROF.OBJETOS + y
    if (escena.textures.exists(K.fx('circulo_magico'))) {
      this.suelo = escena.add.sprite(x, y - 2, K.fx('circulo_magico'), 0).setScale(c.escalaCirculo).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setDepth(PROF.SUELO_OBJ + 0.5)
      if (escena.anims.exists(K.animFx('circulo_magico'))) this.suelo.play(K.animFx('circulo_magico'))
    }
    this.halo = escena.add.image(this.cx, this.cy, K.luz).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof + 0.2).setScale(c.halo / 128)
    this.nucleo = escena.add.image(this.cx, this.cy, K.luz).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof + 0.3).setScale(c.nucleo[0] / 128, c.nucleo[1] / 128)
    for (let i = 0; i < c.motas; i++) {
      const img = escena.add.image(0, 0, K.luz).setTint(i % 3 === 0 ? 0xffffff : color).setBlendMode(Phaser.BlendModes.ADD).setDepth(prof + 0.4).setScale(c.lado / 128)
      this.motas.push({ img, a: (i / c.motas) * Math.PI * 2, f: i / c.motas, v: 0.35 + Math.random() * 0.3 })
    }
  }

  /** `cerca`: la heroína (para encenderse cuando se acerca) */
  update(dt: number, cerca: { x: number; y: number }): void {
    const c = PORTAL_FX
    this.t += dt
    const d = Math.hypot(cerca.x - this.x, cerca.y - this.y)
    const meta = d < c.radioCerca ? 1 - d / c.radioCerca : 0
    this.fuerza += (meta - this.fuerza) * Math.min(1, dt * 3)
    const k = 1 + this.fuerza * 0.8
    const late = 0.5 + 0.5 * Math.sin(this.t * 3.1)
    this.nucleo.setAlpha((0.32 + 0.18 * late) * k)
    this.halo.setAlpha((0.12 + 0.06 * late) * k)
    this.suelo?.setAlpha((0.45 + 0.15 * late) * k)
    for (const m of this.motas) {
      // giran hacia el centro: el radio se achica y la vuelta se acelera cuando falta poco
      m.f -= dt * m.v * k
      if (m.f <= 0) {
        m.f = 1
        m.a = Math.random() * Math.PI * 2
        m.v = 0.35 + Math.random() * 0.3
      }
      m.a += dt * (1.6 + (1 - m.f) * 4) * k
      const rx = c.radio[0] * m.f
      const ry = c.radio[1] * m.f
      m.img.setPosition(Math.round(this.cx + Math.cos(m.a) * rx), Math.round(this.cy + Math.sin(m.a) * ry))
      m.img.setAlpha(Math.min(1, (1 - m.f) * 3) * Math.min(1, m.f * 4) * 0.9)
    }
  }

  destroy(): void {
    this.suelo?.destroy()
    this.nucleo.destroy()
    this.halo.destroy()
    for (const m of this.motas) m.img.destroy()
  }
}
