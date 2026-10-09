import Phaser from 'phaser'
import { K } from '../kit/claves'
import { validarManifest, KitError, MENSAJE_KIT_FALTANTE, heroes } from '../kit/manifest'
import {
  encolarAtmosfera, encolarAudio, encolarBotin, encolarCreditos, encolarFuentes, encolarFx, encolarMapa, encolarObjetosMundo, encolarParticulas,
  encolarPersonaje, encolarPostales, encolarUi, rutaKit,
} from '../kit/cargador'
import { crearAnimFx, crearAnimsPersonaje } from '../kit/anims'
import { parsearMapa } from '../kit/mapa'
import { manifestDe } from '../kit/contexto'
import type { Manifest } from '../kit/tipos'
import { params } from '../config/params'
import { alCambiarEscala } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { agregarGanchos } from '../test/ganchos'

/** Aviso en HTML plano: todavía no hay fuentes del juego cuando el kit falta */
export function mostrarAviso(titulo: string, detalle?: string): void {
  const el = document.getElementById('aviso')
  if (!el) return
  el.innerHTML = ''
  const t = document.createElement('div')
  t.textContent = titulo
  el.appendChild(t)
  if (detalle) {
    const d = document.createElement('small')
    d.textContent = detalle
    el.appendChild(d)
  }
  el.classList.add('ver')
}

/**
 * Carga el manifest, lo valida y trae lo mínimo para llegar a la pantalla de título:
 * fuentes, interfaz, las heroínas en reposo y caminando, Thor y la luz.
 */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload(): void {
    this.load.json(K.manifest, rutaKit('manifest.json'))
  }

  create(): void {
    let m: Manifest
    try {
      m = validarManifest(this.cache.json.get(K.manifest))
    } catch (err) {
      const msg = err instanceof KitError ? err.message : MENSAJE_KIT_FALTANTE
      mostrarAviso(msg, 'El juego no trae su arte adentro: sale del taller PixelForja y se genera con ese comando.')
      console.error('[Boot]', err)
      agregarGanchos({ kitFaltante: () => true })
      return
    }
    this.registry.set('manifest', m)

    // paso 1: lo justo para dibujar la barra de carga
    encolarFuentes(this, m)
    encolarUi(this, m, ['barra_marco', 'barra_xp'])
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.cargarInicio(m))
    this.load.start()
  }

  private cargarInicio(m: Manifest): void {
    const e = this
    const titulo = texto(e, 0, 0, 'GG Abyss', 'fuente_titulo', 3, { origen: [0.5, 0.5] })
    const marco = e.add.nineslice(0, 0, K.ui('barra_marco'), undefined, 240, 14, 6, 6, 6, 6)
    const relleno = e.add.nineslice(0, 0, K.ui('barra_xp'), undefined, 1, 6, 1, 1, 1, 1).setOrigin(0, 0.5)
    const dibujar = (progreso: number, ancho: number, alto: number) => {
      if (!marco.active || !relleno.active || !titulo.active) return
      const w = Math.min(240, Math.max(96, ancho - 40))
      titulo.setPosition(ancho / 2, alto / 2 - 28)
      marco.setSize(w, 14).setPosition(ancho / 2, alto / 2 + 12)
      relleno.setPosition(ancho / 2 - w / 2 + 3, alto / 2 + 12)
      relleno.setSize(Math.max(1, Math.round((w - 6) * progreso)), 6)
    }
    let avance = 0
    alCambiarEscala(this, () => dibujar(avance, this.scale.width, this.scale.height))
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => {
      avance = v
      dibujar(avance, this.scale.width, this.scale.height)
    })

    // paso 2: el grupo `inicio`
    encolarUi(this, m)
    for (const id of heroes(m)) encolarPersonaje(this, m, id, ['idle', 'walk', 'run'])
    encolarPersonaje(this, m, 'thor', ['idle', 'walk', 'run', 'sit', 'wag'])
    // el título y la selección: el mapa (para las luces), la postal de la arena, la bruma, brasas y el aura de la elección
    encolarMapa(this, m)
    encolarAtmosfera(this, m)
    encolarPostales(this, m, ['arena_del_minotauro'])
    encolarParticulas(this, m, ['brasa', 'luciernaga'])
    encolarFx(this, m, ['aura_nivel', 'curar'])
    encolarBotin(this, m, { atlas: ['iconos'], tamanos: ['32'], mundo: false, catalogo: false })
    encolarObjetosMundo(this, m, ['portal_azul'])
    encolarAudio(this, m, ['musica_titulo', 'musica_bosque', 'ambiente_magia', 'click', 'subir_nivel', 'elegir', 'ladrido'])
    encolarCreditos(this, m)
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.listo())
    this.load.start()
  }

  private listo(): void {
    const m = manifestDe(this)
    for (const id of [...heroes(m), 'thor']) crearAnimsPersonaje(this, m, id)
    crearAnimFx(this, m, 'aura_nivel')
    crearAnimFx(this, m, 'curar')
    const logo = m.ui.logo as { cuadros: number; fps: number } | undefined
    if (logo && !this.anims.exists('logo')) {
      this.anims.create({ key: 'logo', frames: this.anims.generateFrameNumbers(K.ui('logo'), { start: 0, end: logo.cuadros - 1 }), frameRate: logo.fps ?? 8, repeat: -1 })
    }
    this.registry.set('mapa', parsearMapa(this.cache.json.get(K.mapa)))
    this.cameras.main.fadeIn(250, 7, 10, 18)
    if (params.kit) return void this.scene.start('SalaKit')
    if (params.heroe && this.scene.manager.keys['Mundo']) {
      this.registry.set('heroeId', params.heroe)
      return void this.scene.start('Mundo')
    }
    this.scene.start(params.sinTitulo ? 'SeleccionJugador' : 'Titulo')
  }
}
