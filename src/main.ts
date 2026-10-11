import Phaser from 'phaser'
import { params } from './config/params'
import { fijarSemilla } from './logic/azar'
import { escalaActual, instalarPantalla } from './game/Pantalla'
import { instalarGanchos, agregarGanchos } from './test/ganchos'
import { estadoPwa, registrarServiceWorker } from './pwa'
import { instalarAudio } from './game/Audio'
import { Boot } from './scenes/Boot'
import { Titulo } from './scenes/Titulo'
import { SeleccionJugador } from './scenes/SeleccionJugador'
import { Intro } from './scenes/Intro'
import { SalaKit } from './scenes/SalaKit'
import { Mundo } from './scenes/Mundo'
import { HUD } from './scenes/HUD'
import { Pausa } from './scenes/Pausa'
import { Creditos } from './scenes/Creditos'
import { Inventario } from './scenes/Inventario'
import { Tienda } from './scenes/Tienda'
import { Album } from './scenes/Album'
import { Continuara } from './scenes/Continuara'
import { Bajada } from './scenes/Bajada'
import { Instalar } from './scenes/Instalar'

if (params.seed !== null) fijarSemilla(params.seed)

const escala = escalaActual()

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'juego',
  backgroundColor: '#070a12',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  disableContextMenu: true,
  // Scale.NONE: la pantalla la maneja Pantalla.ts con zoom entero (PLAN.md 3.2). Nada de Scale.FIT.
  scale: { mode: Phaser.Scale.NONE, width: escala.ancho, height: escala.alto, zoom: escala.cssZoom },
  render: { powerPreference: 'high-performance', mipmapFilter: 'NEAREST' },
  input: { activePointers: 3, touch: { capture: true } },
  scene: [Boot, Titulo, Intro, SeleccionJugador, SalaKit, Mundo, HUD, Pausa, Creditos, Inventario, Tienda, Album, Continuara, Bajada, Instalar],
  callbacks: { preBoot: (g) => g.registry.set('escala', escala) },
})

instalarPantalla(game)
instalarGanchos(game)

// PWA y audio
registrarServiceWorker()
const audio = instalarAudio(game)

// Aviso de girar la tablet: solo aparatos táctiles en vertical. El ícono lo pone la página (index.html) y aquí se pausa el juego.
const vertical = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
let pausadoPorGiro = false
const ajustarGiro = () => {
  const ico = document.querySelector<HTMLElement>('#girar .ico')
  if (ico) ico.style.setProperty('--esc', String(Math.max(2, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 160))))
  if (vertical.matches && !pausadoPorGiro) {
    pausadoPorGiro = true
    game.loop.sleep()
    game.sound.pauseAll()
  } else if (!vertical.matches && pausadoPorGiro) {
    pausadoPorGiro = false
    game.loop.wake()
    game.sound.resumeAll()
  }
}
vertical.addEventListener('change', ajustarGiro)
window.addEventListener('resize', ajustarGiro)
// si la página abre ya en vertical, el juego todavía no arrancó: se vuelve a pausar cuando esté listo
game.events.once(Phaser.Core.Events.READY, () => {
  if (pausadoPorGiro) {
    game.loop.sleep()
    game.sound.pauseAll()
  }
})
ajustarGiro()

agregarGanchos({
  pwa: () => ({ ...estadoPwa, soporta: 'serviceWorker' in navigator, manifest: !!document.querySelector('link[rel="manifest"]') }),
  audio: () => ({ estado: audio.estado() }),
  despertarAudio: (() => audio.despertar()) as never,
  giro: () => ({ vertical: vertical.matches, pausado: pausadoPorGiro, visible: getComputedStyle(document.getElementById('girar')!).display !== 'none' }),
})
