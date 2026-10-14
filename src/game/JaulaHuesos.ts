import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { crearAnimFx } from '../kit/anims'
import { PROF } from '../config/juego'
import type { Atacable } from './Enemigos'

/**
 * F13: la jaula de huesos del Diablo. Sale del piso donde está la heroína y la encierra: no puede salir hasta romperla a
 * golpes (cada golpe cuenta uno, pegue lo que pegue). Thor la muerde desde afuera y también cuenta. Es un blanco más:
 * los golpes y las flechas de la heroína le llegan como a un enemigo.
 */
export class JaulaHuesos implements Atacable {
  readonly id = 888888
  readonly tipo = 'jaula_huesos'
  readonly cuerpo = { alto: 56, radio: 30 }
  readonly radioHit = 30
  readonly altura = 28
  private golpes: number
  private s: Phaser.GameObjects.Sprite | null = null
  private marcada = false
  private thorS = 0
  /** para Alana: el puño que rompe, arriba de la jaula */
  private icono: Phaser.GameObjects.Image | null = null
  vivo = true

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    readonly x: number,
    readonly y: number,
    private total: number,
    private al: { sonido: (n: string, op?: { volumen?: number; rate?: number }) => void; romper: () => void; fx: (n: string, x: number, y: number, esc?: number) => void },
  ) {
    this.golpes = total
    // el kit la trae en tres tiras: sube del piso, se queda quieta y se rompe
    const tex = K.fx('jaula_huesos_subir')
    const k = crearAnimFx(escena, m, 'jaula_huesos_subir')
    if (escena.textures.exists(tex)) {
      this.s = escena.add.sprite(Math.round(x), Math.round(y + 14), tex, 0).setOrigin(0.5, 1).setDepth(PROF.OBJETOS + y + 6)
      if (k) {
        this.s.play(k)
        this.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          const kq = crearAnimFx(escena, m, 'jaula_huesos_quieta')
          if (this.vivo && this.s?.active && kq) this.s.setTexture(K.fx('jaula_huesos_quieta'), 0).play(kq)
        })
      }
    }
    if (escena.textures.exists(K.ui('hab_romper'))) {
      this.icono = escena.add.image(Math.round(x), Math.round(y - 86), K.ui('hab_romper')).setScale(0.5).setDepth(PROF.OBJETOS + y + 600)
      escena.tweens.add({ targets: this.icono, y: this.icono.y - 4, duration: 300, yoyo: true, repeat: -1 })
    }
    al.sonido('jaula_huesos', { volumen: 0.7 })
  }

  get vida(): number {
    return this.golpes
  }
  get vidaMax(): number {
    return this.total
  }

  golpe(x: number, y: number, margen = 10): boolean {
    return this.vivo && Math.abs(x - this.x) <= this.cuerpo.radio + margen && y >= this.y - this.cuerpo.alto - margen && y <= this.y + 14 + margen
  }

  marcar(v: boolean): void {
    this.marcada = v
    if (this.s) {
      if (v) this.s.setTint(0xffa0a0)
      else this.s.clearTint()
    }
  }

  /** Cada golpe le quita uno, sin importar cuánto pegue */
  recibir(_dano: number): boolean {
    if (!this.vivo) return false
    this.golpes--
    this.al.sonido('romper', { volumen: 0.5, rate: 1.2 + (this.total - this.golpes) * 0.04 })
    if (this.s) {
      this.s.setTintFill(0xffffff)
      this.escena.time.delayedCall(70, () => this.s?.active && (this.marcada ? this.s.setTint(0xffa0a0) : this.s.clearTint()))
    }
    if (this.golpes <= 0) {
      this.romper()
      return true
    }
    return false
  }

  /** Thor la muerde desde afuera: cuenta un golpe cada tanto mientras está al lado */
  update(dt: number, thor: { x: number; y: number }): void {
    if (!this.vivo) return
    if (Math.hypot(thor.x - this.x, thor.y - this.y) > 70) {
      this.thorS = 0
      return
    }
    this.thorS += dt
    if (this.thorS >= 1.2) {
      this.thorS = 0
      this.al.sonido('ladrido', { volumen: 0.4, rate: 1.1 })
      this.recibir(0)
    }
  }

  /** ¿Sigue adentro? (no la deja salir más allá de este radio) */
  encierra(x: number, y: number): boolean {
    return this.vivo && Math.hypot(x - this.x, y - this.y) > 18
  }

  romper(): void {
    if (!this.vivo) return
    this.vivo = false
    this.icono?.destroy()
    this.icono = null
    this.al.sonido('jaula_rompe', { volumen: 0.8 })
    this.al.fx('impacto_hielo', this.x, this.y - 20, 2)
    // si el kit trae la hoja de romperse aparte, se rompe con ella
    const k = crearAnimFx(this.escena, this.m, 'jaula_huesos_romper')
    if (this.s && k) this.s.setTexture(K.fx('jaula_huesos_romper'), 0).play(k)
    if (this.s) this.escena.tweens.add({ targets: this.s, alpha: 0, duration: 600, delay: 200, onComplete: () => this.s?.destroy() })
    this.al.romper()
  }

  destruir(): void {
    this.vivo = false
    this.icono?.destroy()
    this.icono = null
    this.s?.destroy()
    this.s = null
  }
}
