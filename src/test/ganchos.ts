import type Phaser from 'phaser'
import { params } from '../config/params'
import { escalaDe } from '../game/Pantalla'
import { semillaActual } from '../logic/azar'

/** Ganchos de prueba (?test=1): window.__ABYSS__ (PLAN.md 3.6). Cada escena agrega los suyos. */
export type Ganchos = Record<string, (...args: never[]) => unknown>

declare global {
  interface Window {
    __ABYSS__?: Ganchos
  }
}

const OVERLAY = new Set(['HUD', 'Inventario', 'Pausa', 'Creditos'])

export function instalarGanchos(game: Phaser.Game): void {
  if (!params.test) return
  const api: Ganchos = {
    /** escena principal activa */
    escena: () => {
      const activas = game.scene.getScenes(true).map((s) => s.scene.key).filter((k) => !OVERLAY.has(k))
      return activas[activas.length - 1] ?? ''
    },
    escenasActivas: () => game.scene.getScenes(true).map((s) => s.scene.key),
    fps: () => Math.round(game.loop.actualFps * 10) / 10,
    semilla: () => semillaActual(),
    escala: () => {
      const e = escalaDe(game)
      return { zoom: e.zoom, ancho: e.ancho, alto: e.alto, dpr: e.dpr, Wp: e.Wp, Hp: e.Hp, cssZoom: e.cssZoom }
    },
    renderer: () => (game.renderer.type === 2 ? 'webgl' : 'canvas'),
  }
  window.__ABYSS__ = api
  // solo en modo prueba: para inspeccionar la escena desde Playwright
  ;(window as unknown as { __JUEGO__: Phaser.Game }).__JUEGO__ = game
}

/** Una escena suma o reemplaza ganchos. Se ignora si no es modo prueba. */
export function agregarGanchos(extra: Ganchos): void {
  if (!params.test || !window.__ABYSS__) return
  Object.assign(window.__ABYSS__, extra)
}

export function quitarGanchos(...nombres: string[]): void {
  if (!window.__ABYSS__) return
  for (const n of nombres) delete window.__ABYSS__[n]
}
