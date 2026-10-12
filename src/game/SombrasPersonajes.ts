import type Phaser from 'phaser'
import { sombraDeLuces, type CfgSombra, type LuzQueAlumbra } from '../logic/luzMundo'
import { SombraLarga } from './SombraLarga'

export interface FuenteSombra {
  s: Phaser.GameObjects.Sprite
  /** el pie en el mundo (el jefe que salta sube el sprite, la sombra se queda en el piso) */
  x: number
  y: number
}

/**
 * Las sombras largas de los que se mueven (heroína, Thor, enemigos, jefe): la misma luz que los árboles y las carpas,
 * así todo el mundo está iluminado por el mismo sol. Una por sprite, se crea al aparecer y se va cuando él se va.
 * Adentro no hay sol: la sombra cae lejos de la antorcha, el cristal o el brillo de Thor que la alumbra.
 * La mancha redonda de contacto (Sombras.ts) sigue debajo de cada uno.
 */
export class SombrasPersonajes {
  private sombras = new Map<Phaser.GameObjects.Sprite, SombraLarga>()
  activo = true

  constructor(
    private escena: Phaser.Scene,
    private cfg: CfgSombra,
  ) {}

  /** `luces`: adentro cada sombra cae lejos de la luz que la alumbra (afuera manda el sol y no se usan) */
  update(fuentes: readonly FuenteSombra[], luces: readonly LuzQueAlumbra[] = [], dt = 0): void {
    const vistos = new Set<Phaser.GameObjects.Sprite>()
    if (this.activo) {
      for (const f of fuentes) {
        if (!f.s.active || !f.s.visible || f.s.alpha <= 0.02) continue
        vistos.add(f.s)
        let l = this.sombras.get(f.s)
        if (!l) {
          l = new SombraLarga(this.escena, this.cfg, f.s.texture.key, f.s.frame.name)
          this.sombras.set(f.s, l)
        }
        l.seguir(f.s, f.x, f.y)
        // se desvanece con quien la tira (la sombra a oscuras, el enemigo que se deshace)
        l.setFuerza(f.s.alpha)
        if (this.cfg.luces) {
          const z = sombraDeLuces(f.x, f.y, f.s.displayHeight * f.s.originY, luces, this.cfg.luces)
          l.apuntar(z.kx, z.ky, z.fuerza, dt)
        }
      }
    }
    for (const [s, l] of this.sombras) {
      if (vistos.has(s)) continue
      l.destroy()
      this.sombras.delete(s)
    }
  }

  /** Para las pruebas: la sombra de un sprite, si tiene */
  infoDe(s: Phaser.GameObjects.Sprite): { kx: number; ky: number; alfa: number } | null {
    return this.sombras.get(s)?.info ?? null
  }

  get cantidad(): number {
    return this.sombras.size
  }

  destruir(): void {
    for (const l of this.sombras.values()) l.destroy()
    this.sombras.clear()
  }
}
