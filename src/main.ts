import Phaser from 'phaser'
import { params } from './config/params'
import { fijarSemilla } from './logic/azar'
import { escalaActual, instalarPantalla } from './game/Pantalla'
import { instalarGanchos } from './test/ganchos'
import { Boot } from './scenes/Boot'
import { Titulo } from './scenes/Titulo'
import { SeleccionJugador } from './scenes/SeleccionJugador'
import { SalaKit } from './scenes/SalaKit'
import { Mundo } from './scenes/Mundo'
import { HUD } from './scenes/HUD'
import { Pausa } from './scenes/Pausa'
import { Creditos } from './scenes/Creditos'
import { Inventario } from './scenes/Inventario'
import { Continuara } from './scenes/Continuara'

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
  scene: [Boot, Titulo, SeleccionJugador, SalaKit, Mundo, HUD, Pausa, Creditos, Inventario, Continuara],
  callbacks: { preBoot: (g) => g.registry.set('escala', escala) },
})

instalarPantalla(game)
instalarGanchos(game)
