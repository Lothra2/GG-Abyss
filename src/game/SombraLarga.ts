import Phaser from 'phaser'
import { PROF } from '../config/juego'
import { cizallaSombra, tramosSombra, type CfgSombra } from '../logic/luzMundo'

/**
 * Una sombra larga hecha con el mismo cuadro de quien la tira, inclinada según la luz del mundo (logic/luzMundo.ts):
 * la base se queda pegada al pie y la punta cae hacia abajo a la derecha, igual que las sombras horneadas del taller.
 * Va en un contenedor que gira y escala, con el dibujo girado adentro: así se arma la inclinación que Phaser no tiene.
 * El dibujo va cortado en tramos de abajo hacia arriba y cada tramo más claro, como las del taller: oscura al pie,
 * se aclara hacia la punta.
 */
export class SombraLarga {
  readonly c: Phaser.GameObjects.Container
  private readonly partes: Phaser.GameObjects.Sprite[] = []
  /** alto del cuadro y pie con los que se cortaron los tramos */
  private corte = { h: -1, pie: -1 }
  /** la inclinación que tiene puesta y cuánto se ve (adentro cambian con las luces) */
  private kx = 0
  private ky = 0
  private fuerza = 1
  private fuerzaFuente = 1
  private apuntada = false

  constructor(
    escena: Phaser.Scene,
    private cfg: CfgSombra,
    tex: string,
    frame?: string | number,
  ) {
    const n = Math.max(1, cfg.tramos)
    for (let i = 0; i < n; i++) {
      const alfa = n === 1 ? 1 : 1 - (1 - cfg.alfaPunta / cfg.alfa) * (i / (n - 1))
      this.partes.push(escena.make.sprite({ x: 0, y: 0, key: tex, frame }, false).setTint(0x000000).setAlpha(alfa))
    }
    this.c = escena.add.container(0, 0, this.partes).setAlpha(cfg.alfa).setDepth(PROF.SOMBRAS)
    this.inclinar(cfg.kx, cfg.ky)
  }

  /** Pone la punta de alto h en (kx h, ky h) desde el pie */
  private inclinar(kx: number, ky: number): void {
    this.kx = kx
    this.ky = ky
    const z = cizallaSombra(kx, ky)
    // la escala negativa (la sombra va dada vuelta) pasa al dibujo de adentro, que se voltea sobre el pie, y entonces
    // su giro cambia de signo. Con escala y no con flipY: Phaser corre de lugar el recorte de un dibujo volteado
    const voltea = z.sy < 0
    for (const p of this.partes) p.setScale(1, voltea ? -1 : 1).setRotation(voltea ? -z.theta : z.theta)
    this.c.setRotation(z.fi).setScale(z.sx, Math.abs(z.sy))
  }

  /**
   * Adentro: la sombra apunta lejos de la luz (logic/luzMundo.ts, sombraDeLuces). Se acomoda de a poquito, así no
   * salta cuando la luz titila o cambia cuál alumbra más. `dt` 0 la pone de una
   */
  apuntar(kx: number, ky: number, fuerza: number, dt: number): void {
    const k = dt <= 0 || !this.apuntada ? 1 : Math.min(1, dt * 6)
    this.apuntada = true
    const nx = this.kx + (kx - this.kx) * k
    let ny = this.ky + (ky - this.ky) * k
    // cruzar de abajo a arriba pasa por cero: ahí la sombra sería una raya, se salta al otro lado
    if (Math.sign(ny) !== Math.sign(ky) && Math.abs(ny) < Math.abs(ky)) ny = ky
    if (Math.abs(nx - this.kx) > 0.004 || Math.abs(ny - this.ky) > 0.004) this.inclinar(nx, ny)
    this.fuerza += (fuerza - this.fuerza) * k
    this.c.setAlpha(this.cfg.alfa * this.fuerza * this.fuerzaFuente)
  }

  /** Copia el cuadro, el pivote y el volteo de `src` y se pone en su pie */
  seguir(src: Phaser.GameObjects.Sprite, x = src.x, y = src.y): void {
    const p0 = this.partes[0]!
    const otraTextura = p0.texture !== src.texture
    for (const p of this.partes) {
      if (otraTextura) p.setTexture(src.texture.key, src.frame.name)
      else if (p.frame !== src.frame) p.setFrame(src.frame.name, false, false)
      if (p.originX !== src.originX || p.originY !== src.originY) p.setOrigin(src.originX, src.originY)
      p.setFlipX(src.flipX)
    }
    const h = src.frame.realHeight
    const pie = Math.round(src.originY * h)
    if (this.corte.h !== h || this.corte.pie !== pie) this.cortar(h, pie)
    this.c.setPosition(Math.round(x), Math.round(y))
  }

  /** Cada parte muestra su tramo de filas del cuadro, del pie para arriba */
  private cortar(h: number, pie: number): void {
    this.corte = { h, pie }
    const t = tramosSombra(h, pie, this.partes.length)
    this.partes.forEach((p, i) => {
      const { desde, hasta } = t[i]!
      p.setCrop(0, desde, p.frame.realWidth, hasta - desde)
    })
  }

  /** La sombra sigue lo transparente de quien la tira (1 = normal) */
  setFuerza(f: number): this {
    this.fuerzaFuente = f
    this.c.setAlpha(this.cfg.alfa * this.fuerza * f)
    return this
  }

  /** Para las pruebas: hacia dónde cae y cuánto se ve */
  get info(): { kx: number; ky: number; alfa: number } {
    return { kx: this.kx, ky: this.ky, alfa: this.c.alpha }
  }

  setVisible(v: boolean): this {
    this.c.setVisible(v)
    return this
  }

  destroy(): void {
    this.c.destroy()
  }
}
