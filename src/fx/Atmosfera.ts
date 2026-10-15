import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { traducirParticulas, type EmisorZona, type MapaJuego, type Zona } from '../kit/mapa'
import { CALIDAD, COLOR, PREMIUM_FX, PROF, premiumDeMundo, type Calidad } from '../config/juego'
import { idMundo } from '../kit/mundos'
import { mezclarPremium, premiumDe, type Premium } from '../logic/grado'
import { Rayos } from './Rayos'
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
  /** F14: el look premium de este cuadro */
  rayos: number
  grado: { contraste: number; saturacion: number; sombras: RGB; luces: RGB }
  nieblaBaja: boolean
}

/**
 * Orquesta toda la atmósfera del mundo (PLAN.md 2.2 a 2.5): zona actual, mezcla suave de bruma,
 * oscuridad y tinte, luces, partículas y nubes. Aplica la calidad alta o baja.
 */
export class Atmosfera {
  /** el radio del farol de la heroína (en el Puerto Ahogado se achica: la luz grande es la de Thor) */
  radioHalo: number = COLOR.FAROL_RADIO
  zona: Zona | null = null
  atm: EstadoAtm = atmosferaDe(null)
  private emisores: EmisorZona[] = []
  readonly luces: Luces
  readonly bruma: Bruma
  readonly nubes: Nubes
  readonly particulas: Particulas
  readonly rayos: Rayos
  /** F14: el look de la base del mundo y el de este cuadro, que va hacia el de la zona */
  private premiumBase: Premium
  prem: Premium
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
  /** F11: lo más oscuro que puede ponerse este piso (sin esto, el tope de siempre) */
  tope?: (peque: boolean) => number

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
    this.rayos = new Rayos(escena)
    this.premiumBase = premiumDeMundo(idMundo(m.mundo))
    this.prem = this.premiumBase
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
    this.prem = premiumDe(z?.props, this.premiumBase)
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
    this.oscFinal = oscuridadFinal(aj.noche, this.atm.oscuridad * this.aclarado, aj.modoPeque, this.tope?.(aj.modoPeque))

    const noche = nocheEfectiva(aj.noche, aj.modoPeque) + this.atm.oscuridad
    const luces = lucesObjetos
    this.particulas.update(t, dt, vista, { emisores: this.emisores, noche, luces, rafaga, decos, ...(this.sobreMuro ? { sobreMuro: this.sobreMuro } : {}) })

    // el farol de la heroína siempre está encendido
    luces.unshift({ x: heroe.x, y: heroe.y - 8, r: radioFarol(t, this.radioHalo, aj.modoPeque, COLOR.FAROL_EXTRA_PEQUE), color: COLOR.FAROL, ph: 0, heroina: true, alto: 8 })
    this.luces.update(t, vista, luces, this.oscFinal, CALIDAD[this.calidad].luces)
    this.ultimasLuces = this.luces.ultimas

    const alta = CALIDAD[this.calidad].postFx
    this.prem = mezclarPremium(this.prem, premiumDe(this.zona?.props, this.premiumBase), Math.min(1, dt * 1.2))
    const pr = this.prem
    const tinteNiebla = Phaser.Display.Color.GetColor(Math.round(pr.niebla[0]), Math.round(pr.niebla[1]), Math.round(pr.niebla[2]))
    this.bruma.update(t, vista.x + vista.width / 2, vista.y + vista.height / 2, this.atm.niebla, CALIDAD[this.calidad].bruma, tinteNiebla, alta)
    this.rayos.update(t, vista, pr.rayos, this.oscFinal, alta)
    this.nubes.update(t, vista, CALIDAD[this.calidad].nubes)

    // tinte de la zona
    const [r, g, b] = this.atm.luz
    if (this.fx) {
      this.fx.tinte = [r / 255, g / 255, b / 255]
      this.fx.tinteK = 0.35
      this.fx.vineta = 0.75
      this.fx.premium = 1
      this.fx.sombras = [pr.grado.sombras[0] / 255, pr.grado.sombras[1] / 255, pr.grado.sombras[2] / 255]
      this.fx.luces = [pr.grado.luces[0] / 255, pr.grado.luces[1] / 255, pr.grado.luces[2] / 255]
      this.fx.contraste = pr.grado.contraste
      this.fx.saturacion = pr.grado.saturacion
      this.fx.brillo = pr.brillo
      this.fx.kSombras = PREMIUM_FX.kSombras
      this.fx.kLuces = PREMIUM_FX.kLuces
      this.fx.umbral = PREMIUM_FX.umbralBrillo
      this.fx.radio = PREMIUM_FX.radioBrillo
      this.fx.tramado = PREMIUM_FX.tramado
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
      rayos: this.rayos.visibles,
      grado: { contraste: this.prem.grado.contraste, saturacion: this.prem.grado.saturacion, sombras: this.prem.grado.sombras, luces: this.prem.grado.luces },
      nieblaBaja: this.bruma.bajaVisible,
    }
  }

  destruir(): void {
    this.escena.cameras?.main?.resetPostPipeline(true)
    this.luces.destruir()
    this.bruma.destruir()
    this.nubes.destruir()
    this.particulas.destruir()
    this.rayos.destruir()
    this.quitarFallback()
  }
}
