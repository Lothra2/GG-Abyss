import Phaser from 'phaser'
import { PROF, REFLEJO } from '../config/juego'
import { aguaDebajo, meneoReflejo, type MapaAgua } from '../logic/luzMundo'

/**
 * La heroína y Thor se reflejan cuando caminan a la orilla del agua (PLAN.md F10). Es el mismo cuadro dado vuelta
 * debajo del suelo: el suelo lo tapa donde no hay agua, así que solo se ve en el agua.
 */
export class Reflejos {
  private pares: { src: Phaser.GameObjects.Sprite; k: Phaser.GameObjects.Sprite; ph: number }[] = []
  activo = true

  constructor(
    escena: Phaser.Scene,
    private agua: MapaAgua,
    fuentes: Phaser.GameObjects.Sprite[],
  ) {
    fuentes.forEach((src, i) => {
      const k = escena.add.sprite(src.x, src.y, src.texture.key, src.frame.name).setTint(REFLEJO.tinte).setAlpha(REFLEJO.alfa).setDepth(PROF.REFLEJO).setVisible(false)
      this.pares.push({ src, k, ph: i * 0.37 })
    })
  }

  update(t: number): void {
    for (const p of this.pares) {
      const { src, k } = p
      const ver = this.activo && src.visible && src.active && aguaDebajo(this.agua, src.x, src.y, REFLEJO.cerca)
      k.setVisible(ver)
      if (!ver) continue
      if (k.texture !== src.texture) k.setTexture(src.texture.key, src.frame.name)
      else if (k.frame !== src.frame) k.setFrame(src.frame.name)
      k.setOrigin(src.originX, src.originY).setScale(src.scaleX, -Math.abs(src.scaleY)).setFlipX(src.flipX)
      k.setPosition(Math.round(src.x) + meneoReflejo(t, p.ph), Math.round(src.y))
    }
  }

  get visibles(): number {
    return this.pares.filter((p) => p.k.visible).length
  }

  destruir(): void {
    for (const p of this.pares) p.k.destroy()
    this.pares = []
  }
}
