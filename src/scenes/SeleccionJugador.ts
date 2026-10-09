import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import type { MapaJuego } from '../kit/mapa'
import { DIRECCIONES } from '../logic/direccion'
import { disponerTarjetas } from '../logic/disposicion'
import { almacenDelNavegador, borrarPartida, cargarOCrear, guardarPartida, type Almacen } from '../logic/guardado'
import { tarjetas as leerTarjetas, type TarjetaPerfil } from '../logic/perfiles'
import { FondoAbismo } from '../game/FondoAbismo'
import { alCambiarEscala, escalaDe, toqueMinimo } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { Bloqueo } from '../game/ui/Bloqueo'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

interface VistaTarjeta {
  t: TarjetaPerfil
  cont: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  w: number
  h: number
  x: number
  y: number
  escala: number
  dir: number
  /** pies de la heroína dentro de la tarjeta */
  pies: number
  borrar?: { zona: Phaser.GameObjects.Zone; anillo: Phaser.GameObjects.Graphics; desde: number; id: number }
}

/** Cuánto hay que mantener presionado para borrar un perfil */
const BORRAR_MS = 3000
const GIRO_S = 1.2

/**
 * Selección de jugadora (PLAN.md F1b, tarea 2): una tarjeta por cada heroína del manifest, con la heroína en reposo girando,
 * su apodo, el arma de su clase y su nivel y oro si ya tiene partida. Tocar la tarjeta la elige: pequeña celebración,
 * Thor corre a su lado y entra al mundo. Nada depende de leer: la cara y los íconos bastan.
 */
export class SeleccionJugador extends Phaser.Scene {
  private alm!: Almacen
  private fondo!: FondoAbismo
  private vistas: VistaTarjeta[] = []
  private datos: TarjetaPerfil[] = []
  private eligiendo = false
  private t = 0
  private ultimoGiro = -1

  constructor() {
    super('SeleccionJugador')
  }

  create(): void {
    const m = manifestDe(this)
    this.alm = (this.registry.get('almacen') as Almacen | undefined) ?? almacenDelNavegador()
    this.registry.set('almacen', this.alm)
    this.eligiendo = false
    this.t = 0
    this.ultimoGiro = -1
    this.fondo = new FondoAbismo(this, m, this.registry.get('mapa') as MapaJuego, { oscuridad: 0.5, bruma: 0.45 })
    this.datos = leerTarjetas(m, this.alm)
    Bloqueo.instalar(this)
    alCambiarEscala(this, () => this.armar())
    this.cameras.main.fadeIn(300, 7, 10, 18)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('seleccion', 'elegirTarjeta', 'borrarPerfil')
      this.fondo.destruir()
    })
    agregarGanchos({
      seleccion: () => ({
        eligiendo: this.eligiendo,
        zoom: escalaDe(this.game).zoom,
        tarjetas: this.vistas.map((v) => ({ id: v.t.id, nombre: v.t.nombre, x: v.x, y: v.y, w: v.w, h: v.h, escala: v.escala, tienePartida: v.t.tienePartida, nivel: v.t.nivel, oro: v.t.oro, clase: v.t.clase, modoPeque: v.t.modoPeque })),
      }),
      elegirTarjeta: ((id: string) => {
        const v = this.vistas.find((q) => q.t.id === id)
        if (v) this.elegir(v)
        return !!v
      }) as never,
      borrarPerfil: ((id: string) => {
        borrarPartida(this.alm, id)
        this.refrescar()
      }) as never,
    })
  }

  /** Vuelve a leer lo guardado y rearma las tarjetas */
  private refrescar(): void {
    this.datos = leerTarjetas(manifestDe(this), this.alm)
    this.armar()
  }

  private armar(): void {
    if (!this.fondo) return
    this.fondo.acomodar()
    for (const v of this.vistas) v.cont.destroy()
    this.vistas = []
    const w = this.scale.width
    const h = this.scale.height
    const d = disponerTarjetas(this.datos.length, w, h)
    this.datos.forEach((t, i) => this.vistas.push(this.tarjeta(t, d.posiciones[i]!.x, d.posiciones[i]!.y, d.w, d.h, d.escalaHeroe, i)))
  }

  private tarjeta(t: TarjetaPerfil, x: number, y: number, w: number, h: number, s: number, i: number): VistaTarjeta {
    const m = manifestDe(this)
    const p = m.personajes[t.id]!
    const cont = this.add.container(x, y).setDepth(10)
    const panel = this.add.nineslice(0, 0, K.ui('panel'), 0, w, h, 12, 12, 12, 12).setOrigin(0, 0).setAlpha(0.94)
    cont.add(panel)

    // el apodo, grande y dorado
    cont.add(texto(this, w / 2, 16, t.nombre, 'fuente_titulo', 1, { origen: [0.5, 0.5] }))

    // la heroína en reposo, con su sombra
    const pies = 28 + p.pivote[1] * s
    cont.add(this.add.image(w / 2, pies - 1, K.luz).setTint(0x000000).setAlpha(0.35).setScale((22 * s) / 96, ((22 * s) / 96) * 0.42))
    const dir = (i * 2) % 8
    const sprite = this.add.sprite(w / 2, pies, K.pers(t.id, 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda).setScale(s)
    sprite.play(K.anim(t.id, 'idle', DIRECCIONES[dir]!))
    cont.add(sprite)

    // el arma de su clase y, si ya juega, su nivel y su oro
    const yInfo = pies + 10 + 16
    if (this.textures.exists(K.atlas('iconos', '32'))) cont.add(this.add.image(w / 2 - (t.tienePartida ? 34 : 0), yInfo, K.atlas('iconos', '32'), t.iconoArma))
    if (t.tienePartida) {
      cont.add(texto(this, w / 2 + 6, yInfo - 8, `Nv ${t.nivel}`, 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a }))
      cont.add(this.add.image(w / 2 + 12, yInfo + 8, K.ui('icono_oro')).setScale(0.75))
      cont.add(texto(this, w / 2 + 26, yInfo + 8, String(t.oro), 'fuente_ui', 1, { origen: [0, 0.5] }))
    }

    // botón de jugar: es parte de la tarjeta, todo el cuadro es el botón
    const bw = w - 16
    cont.add(this.add.nineslice(w / 2, h - 18, K.ui('boton'), 0, bw, 24, 8, 8, 6, 6).setOrigin(0.5, 0.5))
    const etiqueta = texto(this, 0, h - 18, t.tienePartida ? 'Continuar' : 'Jugar', 'fuente_ui', 1, { origen: [0, 0.5] })
    const total = 24 + 4 + etiqueta.displayWidth
    const icono = this.add.image(w / 2 - total / 2 + 12, h - 18, K.ui('icono_jugar'))
    etiqueta.setX(w / 2 - total / 2 + 28)
    cont.add(icono)
    cont.add(etiqueta)

    const v: VistaTarjeta = { t, cont, sprite, w, h, x, y, escala: s, dir, pies }
    const zona = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true })
    cont.add(zona)
    zona.on('pointerdown', () => !this.eligiendo && cont.setScale(0.97).setPosition(x + w * 0.015, y + h * 0.015))
    zona.on('pointerout', () => cont.setScale(1).setPosition(x, y))
    zona.on('pointerup', () => {
      cont.setScale(1).setPosition(x, y)
      this.elegir(v)
    })

    // borrar el perfil: mantener 3 s sobre la X, con un anillo que se llena
    if (t.tienePartida) {
      const e = escalaDe(this.game)
      const lado = Math.max(28, toqueMinimo(e))
      const cx = w - 6 - lado / 2
      const cy = 6 + lado / 2 + 4
      cont.add(this.add.image(cx, cy, K.ui('icono_cerrar')))
      const anillo = this.add.graphics()
      cont.add(anillo)
      const zb = this.add.zone(cx, cy, lado, lado).setInteractive()
      cont.add(zb)
      zb.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        Bloqueo.tomar(ptr.id)
        v.borrar = { zona: zb, anillo, desde: performance.now(), id: ptr.id }
      })
      const soltar = () => {
        if (v.borrar) {
          v.borrar.anillo.clear()
          v.borrar = undefined
        }
      }
      zb.on('pointerup', soltar)
      zb.on('pointerout', soltar)
      zb.on('pointerupoutside', soltar)
      void cx
    }
    return v
  }

  /** La celebración: salta la tarjeta, aura, sonido, Thor corre a su lado, y entra al mundo */
  private elegir(v: VistaTarjeta): void {
    if (this.eligiendo) return
    this.eligiendo = true
    const m = manifestDe(this)
    const { partida, nueva } = cargarOCrear(this.alm, v.t.id)
    if (nueva) guardarPartida(this.alm, partida)
    this.registry.set('heroeId', v.t.id)
    this.registry.set('partida', partida)
    this.registry.set('partidaNueva', nueva)

    const sonido = this.cache.audio.exists(K.aud('elegir')) ? 'elegir' : 'subir_nivel'
    this.sound.play(K.aud(sonido), { volume: 0.8 })

    // salta la tarjeta
    this.tweens.add({ targets: v.cont, y: v.y - 12, duration: 160, yoyo: true, ease: 'Quad.easeOut', repeat: 1 })
    // un aura alrededor de la heroína
    const aura = this.add.sprite(v.x + v.w / 2, v.y + v.pies, K.fx('aura_nivel'), 0).setOrigin(0.5, 0.9).setScale(v.escala).setDepth(20)
    if (this.anims.exists(K.animFx('aura_nivel'))) aura.play(K.animFx('aura_nivel'))
    this.tweens.add({ targets: aura, alpha: 0, delay: 900, duration: 300 })
    // la heroína mira de frente
    v.sprite.play(K.anim(v.t.id, 'idle', 'down'))

    // Thor corre desde el borde más cercano y se sienta a su lado
    const w = this.scale.width
    const desdeIzq = v.x + v.w / 2 < w / 2
    const tp = m.personajes.thor!
    const yThor = v.y + v.pies + 6
    const xFin = v.x + v.w / 2 + (desdeIzq ? 1 : -1) * 30 * v.escala
    const th = this.add.sprite(desdeIzq ? -30 : w + 30, yThor, K.pers('thor', 'run'), 0).setOrigin(tp.pivote[0] / tp.celda, tp.pivote[1] / tp.celda).setScale(v.escala).setDepth(21)
    th.play(K.anim('thor', 'run', desdeIzq ? 'right' : 'left'))
    this.tweens.add({
      targets: th,
      x: xFin,
      duration: Math.max(500, Math.abs(xFin - th.x) / 0.32),
      ease: 'Sine.easeOut',
      onComplete: () => {
        th.play(K.anim('thor', 'sit', 'down'))
        if (this.cache.audio.exists(K.aud('ladrido'))) this.sound.play(K.aud('ladrido'), { volume: 0.7 })
      },
    })

    this.time.delayedCall(1500, () => {
      this.cameras.main.fadeOut(350, 7, 10, 18)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Mundo'))
    })
  }

  override update(_t: number, ms: number): void {
    const dt = Math.min(0.05, ms / 1000)
    this.t += dt
    this.fondo.update(dt)

    // cada 1.2 s la heroína gira a la dirección siguiente
    const giro = Math.floor(this.t / GIRO_S)
    if (giro !== this.ultimoGiro && !this.eligiendo) {
      this.ultimoGiro = giro
      for (const v of this.vistas) {
        v.dir = (v.dir + 1) % 8
        v.sprite.play({ key: K.anim(v.t.id, 'idle', DIRECCIONES[v.dir]!), startFrame: Math.max(0, (v.sprite.anims.currentFrame?.index ?? 1) - 1) })
      }
    }

    // el anillo de borrar se llena y a los 3 s borra
    const ahora = performance.now()
    for (const v of this.vistas) {
      const b = v.borrar
      if (!b) continue
      const prog = Math.min(1, (ahora - b.desde) / BORRAR_MS)
      const z = b.zona
      b.anillo.clear().lineStyle(3, 0xff6a6a, 1).beginPath().arc(z.x, z.y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog).strokePath()
      if (prog >= 1) {
        borrarPartida(this.alm, v.t.id)
        v.borrar = undefined
        this.refrescar()
        return
      }
    }
  }
}
