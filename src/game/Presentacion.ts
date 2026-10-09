import type { MapaJuego } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import type { Camara } from './Camara'
import type { Decos } from './Decos'
import type { Heroina } from './Heroina'
import type { ThorSprite } from './ThorSprite'

interface Punto {
  x: number
  y: number
}

const SUAVE = (k: number) => k * k * (3 - 2 * k)

/** Tiempos de la presentación en segundos (PLAN.md F1b, tarea 4) */
export const TIEMPOS_PRESENTACION = {
  quietaEnLaArena: 1.5,
  haciaLasRuinas: 3,
  haciaLaLlegada: 3,
  portalAbre: 0.7,
  salida: 3.2,
}

/**
 * El paneo de presentación, la primera vez de cada perfil: la cámara arranca en la arena (1.5 s quieta),
 * viaja a las ruinas y de ahí a la llegada, el portal azul se abre y la heroína sale con Thor detrás.
 * Un toque la salta.
 */
export class Presentacion {
  activa = true
  private t = 0
  private fase: 'viaje' | 'portal' | 'sale' = 'viaje'
  private heroeAparecio = false
  private thorAparecio = false
  private puntos: [Punto, Punto, Punto]
  private portal: Punto
  private inicio: Punto
  private thorInicio: Punto

  constructor(
    mapa: MapaJuego,
    private camara: Camara,
    private heroina: Heroina,
    private thor: ThorSprite,
    private decos: Decos,
    private reloj: () => number,
    private alAbrirPortal: () => void,
    private alTerminar: () => void,
  ) {
    const post = (n: string, por: Punto): Punto => mapa.postales.find((p) => p.nombre === n) ?? por
    const ini = entidadesDeTipo(mapa, 'jugador_inicio')[0]!
    this.inicio = { x: ini.x, y: ini.y }
    const por = entidadesDeTipo(mapa, 'portal_llegada')[0]
    this.portal = por ? { x: por.x, y: por.y } : this.inicio
    const th = entidadesDeTipo(mapa, 'thor_inicio')[0]
    this.thorInicio = th ? { x: th.x, y: th.y } : this.inicio
    this.puntos = [post('arena_del_minotauro', this.inicio), post('ruinas_y_estatua', this.inicio), post('llegada', this.inicio)]
    camara.manual = true
    camara.centrarEn(this.puntos[0].x, this.puntos[0].y)
    // la heroína y Thor todavía no están
    heroina.teleport(this.portal.x, this.portal.y)
    heroina.sprite.setVisible(false)
    heroina.sombra.setVisible(false)
    thor.teleport(this.portal.x, this.portal.y)
    thor.sprite.setVisible(false)
    thor.sombra.setVisible(false)
  }

  get segundos(): number {
    return this.t
  }

  update(dt: number): void {
    if (!this.activa) return
    this.t += dt
    const T = TIEMPOS_PRESENTACION
    const [a, r, l] = this.puntos
    const t = this.t

    if (this.fase === 'viaje') {
      let p: Punto
      if (t < T.quietaEnLaArena) p = a
      else if (t < T.quietaEnLaArena + T.haciaLasRuinas) {
        const k = SUAVE((t - T.quietaEnLaArena) / T.haciaLasRuinas)
        p = { x: a.x + (r.x - a.x) * k, y: a.y + (r.y - a.y) * k }
      } else if (t < T.quietaEnLaArena + T.haciaLasRuinas + T.haciaLaLlegada) {
        const k = SUAVE((t - T.quietaEnLaArena - T.haciaLasRuinas) / T.haciaLaLlegada)
        p = { x: r.x + (l.x - r.x) * k, y: r.y + (l.y - r.y) * k }
      } else {
        p = l
        this.fase = 'portal'
        this.t = 0
        this.decos.reproducir(this.reloj(), 'portal_azul', 'abrir')
        this.alAbrirPortal()
      }
      this.camara.centrarEn(p.x, p.y)
      return
    }

    if (this.fase === 'portal') {
      if (t >= T.portalAbre) {
        this.fase = 'sale'
        this.t = 0
        this.aparecerHeroina()
      }
      return
    }

    // la heroína camina hasta su punto de inicio y Thor sale un momento después
    if (t > 0.6 && !this.thorAparecio) {
      this.thorAparecio = true
      this.thor.teleport(this.portal.x, this.portal.y + 8)
      this.thor.sprite.setVisible(true)
      this.thor.sombra.setVisible(true)
    }
    this.camara.centrarEn(this.camara.cx + (this.inicio.x - this.camara.cx) * Math.min(1, dt * 2), this.camara.cy + (this.inicio.y - this.camara.cy) * Math.min(1, dt * 2))
    if (t > T.salida || (!this.heroina.tieneOrden && t > 0.8)) this.terminar()
  }

  private aparecerHeroina(): void {
    if (this.heroeAparecio) return
    this.heroeAparecio = true
    this.heroina.sprite.setVisible(true).setAlpha(0)
    this.heroina.sombra.setVisible(true)
    this.heroina.sprite.scene.tweens.add({ targets: this.heroina.sprite, alpha: 1, duration: 300 })
    this.heroina.irA(this.inicio.x, this.inicio.y)
  }

  /** Salta todo: la heroína ya está en su lugar con Thor al lado */
  saltar(): void {
    if (!this.activa) return
    this.aparecerHeroina()
    this.heroina.teleport(this.inicio.x, this.inicio.y)
    this.heroina.sprite.setAlpha(1)
    this.camara.centrarEn(this.inicio.x, this.inicio.y - 12)
    this.thor.teleport(this.thorInicio.x, this.thorInicio.y)
    this.thor.sprite.setVisible(true)
    this.thor.sombra.setVisible(true)
    this.terminar()
  }

  private terminar(): void {
    this.activa = false
    this.camara.manual = false
    this.alTerminar()
  }
}
