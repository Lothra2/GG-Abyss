import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { traducirParticulas, type EmisorZona, type MapaJuego, type Zona } from '../kit/mapa'
import { CALIDAD, COLOR, PROF, type Calidad } from '../config/juego'
import { atmosferaDe, mezclar, nocheEfectiva, oscuridadFinal, zonaEn, type Atmosfera as EstadoAtm, type RGB } from '../logic/zonas'
import type { Ajustes } from '../logic/guardado'
import type { Activo, Luz } from '../game/Decos'
import { Luces } from './Luces'
import { radioFarol } from '../logic/luzMundo'
import { Bruma } from './Bruma'
import { Nubes } from './Nubes'
import { Particulas } from './Particulas'
import { AtmosferaFX, NOMBRE_FX, registrarAtmosferaFX } from './AtmosferaFX'

export interface InfoAtmosfera {
  zona: string | null
  oscuridad: number
  oscuridadZona: number
  niebla: number
  luz: RGB
  luces: number
  particulas: number
  topeParticulas: number
  capasBruma: number
  calidad: Calidad
  postFx: boolean
}

/**
 * Orquesta toda la atmósfera del mundo (PLAN.md 2.2 a 2.5): zona actual, mezcla suave de bruma,
 * oscuridad y tinte, luces, partículas y nubes. Aplica la calidad alta o baja.
 */
export class Atmosfera {
  zona: Zona | null = null
  atm: EstadoAtm = atmosferaDe(null)
  private emisores: EmisorZona[] = []
  readonly luces: Luces
  readonly bruma: Bruma
  readonly nubes: Nubes
  readonly particulas: Particulas
  private oscFinal = 0
  private calidad: Calidad = 'alta'
  private calidadAplicada: Calidad | null = null
  private webgl: boolean
  private fx: AtmosferaFX | null = null
  private vinetaImg: Phaser.GameObjects.Image | null = null
  private tinteRect: Phaser.GameObjects.Rectangle | null = null
  private ultimasLuces = 0
  /** F8: cuánto queda de la oscuridad de las zonas (1 normal; la Catedral liberada se aclara) */
  aclarado = 1
  /** F8: en un interior (la Catedral), si un punto cae sobre un muro */
  private sobreMuro: ((x: number, y: number) => boolean) | null = null
  /** se llama al cambiar de zona (el mundo descubre la zona y cambia el sonido) */
  alCambiarZona?: (z: Zona | null) => void

  constructor(
    private escena: Phaser.Scene,
    m: Manifest,
    private mapa: MapaJuego,
    private ajustes: () => Ajustes,
    private ancho: number,
    private alto: number,
  ) {
    if (mapa.bioma !== 'bosque') {
      const c = mapa.cuadro
      this.sobreMuro = (x, y) => {
        const tx = Math.floor(x / c), ty = Math.floor(y / c)
        return tx < 0 || ty < 0 || tx >= mapa.ancho || ty >= mapa.alto || mapa.colision[ty * mapa.ancho + tx] === 1
      }
    }
    this.luces = new Luces(escena, ancho, alto)
    this.bruma = new Bruma(escena, ancho, alto)
    this.nubes = new Nubes(escena, mapa.ancho * mapa.cuadro, mapa.alto * mapa.cuadro)
    this.particulas = new Particulas(escena, m)
    this.webgl = registrarAtmosferaFX(escena.game)
  }

  get oscuridadFinal(): number {
    return this.oscFinal
  }

  private ox = 0
  private oy = 0

  /**
   * `ancho` x `alto` es lo que se ve del mundo (la vista lógica dividida por el zoom de la cámara). Lo pegado a la
   * pantalla va en `ox, oy` para que, agrandado desde el centro, la cubra justo.
   */
  redimensionar(ancho: number, alto: number, ox = 0, oy = 0, zoom = 1): void {
    this.ancho = ancho
    this.alto = alto
    this.ox = ox
    this.oy = oy
    this.luces.redimensionar(ancho, alto, ox, oy)
    this.bruma.redimensionar(ancho, alto, ox, oy, zoom)
    if (this.vinetaImg) this.armarFallback()
  }

  /** Salta de golpe a una zona, sin la mezcla suave (capturas, teletransporte) */
  saltarA(z: Zona | null): void {
    this.cambiarZona(z)
    this.atm = atmosferaDe(z)
    this.particulas.limpiar()
  }

  private cambiarZona(z: Zona | null): void {
    if (z === this.zona) return
    this.zona = z
    this.emisores = traducirParticulas(z?.particulas ?? []).emisores
    this.alCambiarZona?.(z)
  }

  /* ---------- calidad ---------- */

  private aplicarCalidad(c: Calidad): void {
    if (c === this.calidadAplicada) return
    this.calidadAplicada = c
    this.calidad = c
    this.particulas.setCalidad(c)
    const cam = this.escena.cameras.main
    const usaFx = CALIDAD[c].postFx && this.webgl
    if (usaFx) {
      this.quitarFallback()
      cam.setPostPipeline(NOMBRE_FX)
      const inst = cam.getPostPipeline(NOMBRE_FX)
      this.fx = (Array.isArray(inst) ? inst[0] : inst) as AtmosferaFX
    } else {
      cam.resetPostPipeline(true)
      this.fx = null
      this.armarFallback()
    }
  }

  /** Sin postFX: viñeta como imagen de degradado radial (textura técnica) y tinte como rectángulo MULTIPLY al 12 % */
  private armarFallback(): void {
    this.quitarFallback()
    const key = 'vineta_tecnica'
    if (this.escena.textures.exists(key)) this.escena.textures.remove(key)
    const tex = this.escena.textures.createCanvas(key, Math.ceil(this.ancho), Math.ceil(this.alto))
    if (!tex) return
    const ctx = tex.getContext()
    const g = ctx.createRadialGradient(this.ancho / 2, this.alto / 2, Math.min(this.ancho, this.alto) * 0.35, this.ancho / 2, this.alto / 2, Math.max(this.ancho, this.alto) * 0.75)
    g.addColorStop(0, 'rgba(2,4,10,0)')
    g.addColorStop(1, 'rgba(2,4,10,0.75)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.ancho, this.alto)
    tex.refresh()
    this.vinetaImg = this.escena.add.image(this.ox, this.oy, key).setOrigin(0, 0).setScrollFactor(0).setDepth(PROF.VINETA)
    this.tinteRect = this.escena.add.rectangle(this.ox, this.oy, this.ancho, this.alto, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(PROF.VINETA - 1).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.12)
  }

  private quitarFallback(): void {
    this.vinetaImg?.destroy()
    this.tinteRect?.destroy()
    this.vinetaImg = null
    this.tinteRect = null
  }

  /* ---------- cuadro ---------- */

  /**
   * `lucesObjetos` trae las luces de los decorados de este cuadro. `decos` recorre los decorados activos
   * para los emisores locales.
   */
  update(
    t: number,
    dt: number,
    vista: Phaser.Geom.Rectangle,
    heroe: { x: number; y: number },
    lucesObjetos: Luz[],
    decos: (fn: (a: Activo) => void) => void,
    rafaga: boolean,
  ): void {
    const aj = this.ajustes()
    this.aplicarCalidad(aj.calidad)

    this.cambiarZona(zonaEn(this.mapa.zonas, heroe.x, heroe.y))
    this.atm = mezclar(this.atm, atmosferaDe(this.zona), dt)
    this.oscFinal = oscuridadFinal(aj.noche, this.atm.oscuridad * this.aclarado, aj.modoPeque)

    const noche = nocheEfectiva(aj.noche, aj.modoPeque) + this.atm.oscuridad
    const luces = lucesObjetos
    this.particulas.update(t, dt, vista, { emisores: this.emisores, noche, luces, rafaga, decos, ...(this.sobreMuro ? { sobreMuro: this.sobreMuro } : {}) })

    // el farol de la heroína siempre está encendido
    luces.unshift({ x: heroe.x, y: heroe.y - 8, r: radioFarol(t, COLOR.FAROL_RADIO, aj.modoPeque, COLOR.FAROL_EXTRA_PEQUE), color: COLOR.FAROL, ph: 0, heroina: true })
    this.luces.update(t, vista, luces, this.oscFinal, CALIDAD[this.calidad].luces)
    this.ultimasLuces = this.luces.ultimas

    this.bruma.update(t, vista.x + vista.width / 2, vista.y + vista.height / 2, this.atm.niebla, CALIDAD[this.calidad].bruma)
    this.nubes.update(t, vista, CALIDAD[this.calidad].nubes)

    // tinte de la zona
    const [r, g, b] = this.atm.luz
    if (this.fx) {
      this.fx.tinte = [r / 255, g / 255, b / 255]
      this.fx.tinteK = 0.35
      this.fx.vineta = 0.75
    } else if (this.tinteRect) {
      this.tinteRect.setFillStyle(Phaser.Display.Color.GetColor(r, g, b))
    }
  }

  info(): InfoAtmosfera {
    return {
      zona: this.zona?.nombre ?? null,
      oscuridad: this.oscFinal,
      oscuridadZona: this.atm.oscuridad,
      niebla: this.atm.niebla,
      luz: this.atm.luz,
      luces: this.ultimasLuces,
      particulas: this.particulas.cantidad,
      topeParticulas: this.particulas.tope,
      capasBruma: this.bruma.capasVisibles,
      calidad: this.calidad,
      postFx: !!this.fx,
    }
  }

  destruir(): void {
    this.escena.cameras?.main?.resetPostPipeline(true)
    this.luces.destruir()
    this.bruma.destruir()
    this.nubes.destruir()
    this.particulas.destruir()
    this.quitarFallback()
  }
}
