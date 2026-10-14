import Phaser from 'phaser'
import { K } from '../kit/claves'
import type { MapaJuego } from '../kit/mapa'
import { totalSecretos, totalZonasDescubribles } from '../kit/mapa'
import { almacenDelNavegador, empezarCiclo, guardarPartida, type Almacen, type Partida } from '../logic/guardado'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { crearBoton } from '../game/ui/Boton'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import { pantallaChica } from '../logic/escala'

/** "1 h 12 min", "35 min" o "menos de 1 min" */
export function tiempoLegible(seg: number): string {
  const min = Math.floor(seg / 60)
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export interface ResumenFinal {
  nivel: number
  oro: number
  zonas: string
  secretos: string
  tiempo: string
}

export function resumenFinal(p: Partida, mapa: MapaJuego): ResumenFinal {
  return {
    nivel: p.nivel,
    oro: p.oro,
    zonas: `${p.zonas.length}/${totalZonasDescubribles(mapa)}`,
    secretos: `${p.secretos.length}/${totalSecretos(mapa)}`,
    tiempo: tiempoLegible(p.tiempoJugado ?? 0),
  }
}

/**
 * El cierre del Mundo 1 (PLAN.md F4, tarea 7): la imagen `ui/continuara.png` con "Continuará... más abajo en el abismo" en
 * `fuente_titulo`, el resumen de la partida con íconos y el botón para volver al bosque.
 */
export class Continuara extends Phaser.Scene {
  private fondo!: Phaser.GameObjects.Image
  private titulo!: Phaser.GameObjects.BitmapText
  private filas: { icono: Phaser.GameObjects.Image; texto: Phaser.GameObjects.BitmapText }[] = []
  private boton!: ReturnType<typeof crearBoton>
  /** F13: en el final, el botón para quedarse en el Corazón Helado (el principal empieza el ciclo celestial) */
  private quedarse: ReturnType<typeof crearBoton> | null = null
  private final = false
  private resumen!: ResumenFinal
  private saliendo = false

  constructor() {
    super('Continuara')
  }

  create(): void {
    this.saliendo = false
    const partida = this.registry.get('partida') as Partida
    const mapa = this.registry.get('mapa') as MapaJuego
    this.resumen = resumenFinal(partida, mapa)
    this.cameras.main.setBackgroundColor(0x05060c)
    this.cameras.main.fadeIn(900, 5, 6, 12)
    this.fondo = this.add.image(0, 0, K.ui('continuara')).setOrigin(0.5, 0.5)
    // F13: el final de verdad es vencer al Diablo en el piso 7
    this.final = partida.mundo === 'mundo7' && !!partida.jefeVencido
    this.quedarse = null
    const titulo = this.final ? '¡Venciste al Diablo!\nLa luz volvió al abismo' : 'Continuará...\nmás abajo en el abismo'
    this.titulo = texto(this, 0, 0, titulo, 'fuente_titulo', 2, { origen: [0.5, 0.5], alinear: 'centro', profundidad: 10 })
    const datos: [string, string][] = [
      ['icono_jugadora', `Nv ${this.resumen.nivel}`],
      ['icono_oro', String(this.resumen.oro)],
      ['icono_zona', this.resumen.zonas],
      ['icono_secreto', this.resumen.secretos],
      ['icono_luna', this.resumen.tiempo],
    ]
    for (const [ic, t] of datos) {
      this.filas.push({ icono: this.add.image(0, 0, K.ui(ic)).setOrigin(0, 0.5).setDepth(10), texto: texto(this, 0, 0, t, 'fuente_ui', 1, { origen: [0, 0.5], profundidad: 10 }) })
    }
    if (this.final) {
      // empezar otra vez con alas y todo más difícil, o quedarse a pasear por el Corazón Helado
      const alas = this.textures.exists(K.ui('icono_alas')) ? 'icono_alas' : 'icono_jugar'
      this.boton = crearBoton(this, { x: 0, y: 0, etiqueta: `Jugar con alas (ciclo ${(partida.ciclo || 1) + 1})`, icono: alas, alToque: () => this.cicloNuevo(), sonido: 'legendario' })
      this.quedarse = crearBoton(this, { x: 0, y: 0, etiqueta: 'Quedarme aquí', icono: 'icono_luna', alToque: () => this.volver(), sonido: 'click' })
      this.quedarse.setDepth(20)
    } else this.boton = crearBoton(this, { x: 0, y: 0, etiqueta: 'Volver al bosque', icono: 'icono_jugar', alToque: () => this.volver(), sonido: 'click' })
    this.boton.setDepth(20)
    if (this.cache.audio.exists(K.aud('musica_victoria')) && !this.sound.get(K.aud('musica_victoria'))) this.sound.play(K.aud('musica_victoria'), { loop: true, volume: 0.4 })
    this.input.keyboard?.on('keydown-ENTER', () => this.volver())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('continuara', 'volverAlBosque', 'cicloNuevo')
      this.sound.stopByKey(K.aud('musica_victoria'))
    })
    alCambiarEscala(this, () => this.acomodar())
    agregarGanchos({
      continuara: () => ({ abierto: true, resumen: this.resumen, titulo: this.titulo.text, final: this.final }),
      volverAlBosque: (() => this.volver()) as never,
      cicloNuevo: (() => this.cicloNuevo()) as never,
    })
  }

  private acomodar(): void {
    if (!this.fondo) return
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    this.fondo.setPosition(Math.round(w / 2), Math.round(h / 2))
    // el título a la escala entera más grande que entra
    this.titulo.setScale(1)
    const base = this.titulo.displayWidth
    this.titulo.setScale(escalaQueEntra(base, w - 24, 2))
    this.titulo.setPosition(Math.round(w / 2), Math.round(h * 0.17))
    // el resumen en una fila (o dos si la vista es angosta)
    const esc = pantallaChica(e) ? 1 : 2
    const anchos = this.filas.map((f) => 24 + 4 + (f.texto.setScale(esc), f.texto.displayWidth))
    const sep = 14
    const total = anchos.reduce((a, b) => a + b, 0) + sep * (anchos.length - 1)
    const unaFila = total <= w - 16
    const y1 = Math.round(h * 0.62)
    const colocar = (idx: number[], y: number) => {
      const t = idx.reduce((a, i) => a + anchos[i]!, 0) + sep * (idx.length - 1)
      let x = Math.round((w - t) / 2)
      for (const i of idx) {
        const f = this.filas[i]!
        f.icono.setPosition(x, y)
        f.texto.setPosition(x + 28, y)
        x += anchos[i]! + sep
      }
    }
    if (unaFila) colocar(this.filas.map((_, i) => i), y1)
    else {
      colocar([0, 1, 2], y1)
      colocar([3, 4], y1 + 30)
    }
    this.boton.setPosition(Math.round(w / 2), Math.round(h - this.boton.alto / 2 - 18))
    if (this.quedarse) {
      const y = Math.round(h - this.boton.alto / 2 - 18)
      const ancho = this.boton.ancho + this.quedarse.ancho + 16
      if (ancho <= w - 16) {
        this.boton.setPosition(Math.round(w / 2 - ancho / 2 + this.boton.ancho / 2), y)
        this.quedarse.setPosition(Math.round(w / 2 + ancho / 2 - this.quedarse.ancho / 2), y)
      } else this.quedarse.setPosition(Math.round(w / 2), y - this.boton.alto - 8)
    }
  }

  /** F13: el Ciclo 2 (y los siguientes). Se queda con su nivel y su equipo, gana las alas y el abismo vuelve a empezar */
  private cicloNuevo(): void {
    if (this.saliendo || !this.final) return
    this.saliendo = true
    const p = this.registry.get('partida') as Partida
    empezarCiclo(p)
    const alm = (this.registry.get('almacen') as Almacen | undefined) ?? almacenDelNavegador()
    guardarPartida(alm, p)
    this.cameras.main.flash(500, 255, 240, 200)
    this.cameras.main.fadeOut(900, 255, 250, 235)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Bajada', { nombre: `Ciclo ${p.ciclo}`, subir: true, piso: 1 }))
  }

  private volver(): void {
    if (this.saliendo) return
    this.saliendo = true
    this.cameras.main.fadeOut(400, 5, 6, 12)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Mundo'))
  }
}
