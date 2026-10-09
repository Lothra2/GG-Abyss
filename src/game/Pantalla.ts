import Phaser from 'phaser'
import { calcularEscala, type Escala } from '../logic/escala'

/**
 * Escala entera (PLAN.md 3.2). El juego se dibuja en una vista lógica y el canvas se agranda
 * un número entero de veces con pixelado, igual que el visor del taller. Cada pixel del arte
 * mide `zoom` x `zoom` pixeles físicos, con dpr 1, 2 o el que sea.
 *
 * Phaser corre con Scale.NONE y esta clase manda el tamaño: no hay Scale.FIT ni 960 x 540 fijo.
 */

export const EVENTO_ESCALA = 'escala'

export function escalaActual(): Escala {
  return calcularEscala(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
}

export function escalaDe(game: Phaser.Game): Escala {
  return game.registry.get('escala') as Escala
}

function mismas(a: Escala, b: Escala): boolean {
  return a.ancho === b.ancho && a.alto === b.alto && a.zoom === b.zoom && a.dpr === b.dpr
}

function pintarCanvas(game: Phaser.Game, e: Escala): void {
  const c = game.canvas
  c.style.width = `${e.ancho * e.cssZoom}px`
  c.style.height = `${e.alto * e.cssZoom}px`
}

/** Engancha los cambios de tamaño y de orientación. Se llama una vez al crear el juego. */
export function instalarPantalla(game: Phaser.Game): void {
  pintarCanvas(game, escalaDe(game))
  game.scale.refresh()

  const aplicar = () => {
    const nueva = escalaActual()
    if (mismas(nueva, escalaDe(game))) return
    game.registry.set('escala', nueva)
    game.scale.setZoom(nueva.cssZoom)
    game.scale.resize(nueva.ancho, nueva.alto)
    pintarCanvas(game, nueva)
    game.scale.refresh()
    game.events.emit(EVENTO_ESCALA, nueva)
  }

  window.addEventListener('resize', aplicar)
  window.addEventListener('orientationchange', () => setTimeout(aplicar, 120))
  window.visualViewport?.addEventListener('resize', aplicar)
  // el dpr cambia al mover la ventana a otro monitor o al hacer zoom del navegador
  const vigilarDpr = () => {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    mq.addEventListener('change', () => { aplicar(); vigilarDpr() }, { once: true })
  }
  vigilarDpr()
}

/** Para escenas: ejecuta `fn` ahora y en cada cambio de escala, y se desengancha al cerrar la escena */
export function alCambiarEscala(escena: Phaser.Scene, fn: (e: Escala) => void): void {
  const game = escena.game
  const h = (e: Escala) => fn(e)
  game.events.on(EVENTO_ESCALA, h)
  escena.events.once(Phaser.Scenes.Events.SHUTDOWN, () => game.events.off(EVENTO_ESCALA, h))
  escena.events.once(Phaser.Scenes.Events.DESTROY, () => game.events.off(EVENTO_ESCALA, h))
  fn(escalaDe(game))
}

/** Alto mínimo táctil en pixeles lógicos: 48 pixeles físicos reales (60 en modo peque) */
export function toqueMinimo(e: Escala, peque = false): number {
  return Math.ceil((peque ? 60 : 48) / e.zoom)
}
