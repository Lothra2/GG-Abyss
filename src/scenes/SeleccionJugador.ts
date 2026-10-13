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
import { CapasSprite } from '../game/Capas'
import { recargarSiHayVersionNueva } from '../pwa'
import { aspectoDefecto } from '../logic/aspecto'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import { PROF, SELECCION } from '../config/juego'
import { pantallaChica } from '../logic/escala'

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
  /** la luz de su clase: el haz que cae de arriba, el brillo a los pies y las brasas que suben */
  haz: Phaser.GameObjects.Image
  brillo: Phaser.GameObjects.Image
  brasas: { img: Phaser.GameObjects.Image; x: number; y: number; v: number; vida: number; t: number }[]
  color: number
  /** el mouse encima: su luz se enciende un poco más */
  encima?: boolean
}

/** Las tarjetas van por encima de la bruma y la viñeta del fondo: si no, la niebla las lava */
const PROF_TARJETAS = PROF.VINETA + 50

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
  private titulo?: Phaser.GameObjects.BitmapText
  private tituloLuz?: Phaser.GameObjects.Image

  constructor() {
    super('SeleccionJugador')
  }

  create(): void {
    recargarSiHayVersionNueva(this)
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
    // arriba, la pregunta en grande con su resplandor; las tarjetas debajo
    this.titulo?.destroy()
    this.tituloLuz?.destroy()
    const esc = pantallaChica(escalaDe(this.game)) ? 1 : 2
    this.titulo = texto(this, Math.round(w / 2), 6, '¿Quién juega?', 'fuente_titulo', esc, { origen: [0.5, 0] }).setDepth(PROF_TARJETAS + 1)
    this.tituloLuz = this.add.image(Math.round(w / 2), 6 + this.titulo.displayHeight / 2, K.luz).setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(PROF_TARJETAS).setScale((this.titulo.displayWidth * 1.6) / 128, (this.titulo.displayHeight * 2.6) / 128)
    const d = disponerTarjetas(this.datos.length, w, h, 6 + this.titulo.displayHeight + 6)
    this.datos.forEach((t, i) => this.vistas.push(this.tarjeta(t, d.posiciones[i]!.x, d.posiciones[i]!.y, d.w, d.h, d.escalaHeroe, i)))
  }

  private tarjeta(t: TarjetaPerfil, x: number, y: number, w: number, h: number, s: number, i: number): VistaTarjeta {
    const m = manifestDe(this)
    const p = m.personajes[t.id]!
    const cont = this.add.container(x, y).setDepth(PROF_TARJETAS)
    const panel = this.add.nineslice(0, 0, K.ui('panel'), 0, w, h, 12, 12, 12, 12).setOrigin(0, 0)
    cont.add(panel)
    const color = SELECCION.color[t.clase] ?? 0xffd27a

    // el apodo, grande y dorado
    cont.add(texto(this, w / 2, 16, t.nombre, 'fuente_titulo', 1, { origen: [0.5, 0.5] }))

    // la luz de su clase: un haz que cae de arriba y un brillo en el piso, sumados (luz, no dibujo)
    const pies = 28 + p.pivote[1] * s
    const haz = this.add.image(w / 2, pies - 22 * s, K.luz).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setScale((w * 0.75) / 128, (60 * s) / 128)
    const brillo = this.add.image(w / 2, pies, K.luz).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale((40 * s) / 128, (14 * s) / 128)
    cont.add([haz, brillo])
    // el círculo mágico del kit a sus pies: está en el piso, va entero detrás de ella
    if (this.textures.exists(K.fx('circulo_magico'))) {
      const circ = this.add.sprite(w / 2, pies, K.fx('circulo_magico'), 0).setOrigin(0.5, 0.5).setScale(Math.max(1, s - 1)).setAlpha(0.6)
      if (this.anims.exists(K.animFx('circulo_magico'))) circ.play({ key: K.animFx('circulo_magico'), startFrame: i % 8 })
      cont.add(circ)
    }
    // las brasas de su color que suben despacito detrás de ella
    const brasas: VistaTarjeta['brasas'] = []
    for (let b = 0; b < SELECCION.brasas; b++) {
      const img = this.add.image(0, 0, K.luz).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(3 / 128)
      cont.add(img)
      brasas.push({ img, x: 0, y: 0, v: 0, vida: 0, t: 1 + b * 0.37 })
    }
    cont.add(this.add.image(w / 2, pies - 1, K.luz).setTint(0x000000).setAlpha(0.35).setScale((22 * s) / 96, ((22 * s) / 96) * 0.42))
    const dir = (i * 2) % 8
    const sprite = this.add.sprite(w / 2, pies, K.pers(t.id, 'idle'), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda).setScale(s)
    sprite.play(K.anim(t.id, 'idle', DIRECCIONES[dir]!))
    cont.add(sprite)
    // armada con lo de su clase (las capas de equipo de PixelForja)
    new CapasSprite(this, m, t.id, sprite, cont).poner(aspectoDefecto(p.capas))

    // el arma de su clase y, si ya juega, su nivel y su oro
    // debajo del círculo de sus pies
    const yInfo = pies + 14 * Math.max(1, s - 1) + 18
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

    const v: VistaTarjeta = { t, cont, sprite, w, h, x, y, escala: s, dir, pies, haz, brillo, brasas, color }
    const zona = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true })
    cont.add(zona)
    zona.on('pointerdown', () => !this.eligiendo && cont.setScale(0.97).setPosition(x + w * 0.015, y + h * 0.015))
    zona.on('pointerover', () => !this.eligiendo && (v.encima = true))
    zona.on('pointerout', () => {
      v.encima = false
      cont.setScale(1).setPosition(x, y)
    })
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

    // las otras se apagan y se hunden un poquito: todo el foco en la elegida
    for (const o of this.vistas) {
      if (o === v) continue
      this.tweens.add({ targets: o.cont, alpha: SELECCION.apagadas, y: o.y + 6, duration: 260, ease: 'Quad.easeOut' })
    }
    // salta la tarjeta
    this.tweens.add({ targets: v.cont, y: v.y - 10, duration: 150, yoyo: true, ease: 'Quad.easeOut' })
    // su luz se enciende: el haz se abre y el piso brilla
    this.tweens.add({ targets: v.haz, alpha: 0.55, duration: 220, ease: 'Quad.easeOut' })
    this.tweens.add({ targets: v.brillo, alpha: 0.85, duration: 220, ease: 'Quad.easeOut' })
    // el estallido de su elemento y el aura de nivel la rodean: mitad atrás del cuerpo y mitad adelante
    this.rodear(v, SELECCION.nova[v.t.clase] ?? 'nova_sagrado', 30 / 48, 0)
    this.time.delayedCall(140, () => this.rodear(v, 'aura_nivel', 37 / 48, 900))
    // un estallido de su luz que se abre desde ella (luz sumada, no dibujo)
    const estallido = this.add.image(v.x + v.w / 2, v.y + v.pies - 16 * v.escala, K.luz).setTint(v.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(PROF_TARJETAS + 4).setScale(0.2).setAlpha(0.9)
    this.tweens.add({ targets: estallido, scale: (v.w * 2.4) / 128, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => estallido.destroy() })
    // la heroína mira de frente
    v.sprite.play(K.anim(v.t.id, 'idle', 'down'))

    // Thor corre desde el borde más cercano y se sienta a su lado
    const w = this.scale.width
    const desdeIzq = v.x + v.w / 2 < w / 2
    const tp = m.personajes.thor!
    // se sienta a su lado, un poco adelante, sin taparla
    const yThor = v.y + v.pies + 3 * v.escala
    const xFin = Math.round(v.x + v.w / 2 + (desdeIzq ? -1 : 1) * 24 * v.escala)
    const th = this.add.sprite(desdeIzq ? -30 : w + 30, yThor, K.pers('thor', 'run'), 0).setOrigin(tp.pivote[0] / tp.celda, tp.pivote[1] / tp.celda).setScale(v.escala).setDepth(PROF_TARJETAS + 5)
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

  /**
   * Un efecto del kit alrededor de la heroína: el aro de adelante va delante del cuerpo y el de atrás detrás, como en
   * el juego (Combate.aura). `centro`: la fila del cuadro donde está el piso. `dura` 0: se queda hasta que termina
   */
  private rodear(v: VistaTarjeta, nombre: string, centro: number, dura: number): void {
    const tex = K.fx(nombre)
    if (!this.textures.exists(tex)) return
    const celda = manifestDe(this).fx[nombre]?.celda ?? 48
    const corte = Math.round(celda * centro)
    const anim = K.animFx(nombre)
    const mitad = (atras: boolean) => {
      const sp = this.add.sprite(v.w / 2, v.pies, tex, 0).setOrigin(0.5, corte / celda).setScale(v.escala)
      if (atras) sp.setCrop(0, 0, celda, corte)
      else sp.setCrop(0, corte, celda, celda - corte)
      if (this.anims.exists(anim)) sp.play(anim)
      return sp
    }
    const atras = mitad(true)
    const adelante = mitad(false)
    v.cont.addAt(atras, v.cont.getIndex(v.sprite))
    v.cont.add(adelante)
    const fin = () => {
      if (dura > 0) this.tweens.add({ targets: [atras, adelante], alpha: 0, delay: dura, duration: 300, onComplete: () => [atras, adelante].forEach((q) => q.destroy()) })
      else [atras, adelante].forEach((q) => q.destroy())
    }
    if (this.anims.exists(anim) && !manifestDe(this).fx[nombre]?.loop) atras.once(Phaser.Animations.Events.ANIMATION_COMPLETE, fin)
    else fin()
  }

  override update(_t: number, ms: number): void {
    const dt = Math.min(0.05, ms / 1000)
    this.t += dt
    this.fondo.update(dt)

    // la luz de cada tarjeta respira y sus brasas suben despacito
    for (const v of this.vistas) {
      if (!this.eligiendo) {
        const extra = v.encima ? 0.12 : 0
        v.haz.setAlpha(0.26 + extra + 0.06 * Math.sin(this.t * 1.7 + v.x * 0.01))
        v.brillo.setAlpha(0.42 + extra + 0.08 * Math.sin(this.t * 2.1 + v.x * 0.02))
      }
      for (const b of v.brasas) {
        b.t -= dt
        if (b.t <= 0) {
          // nace en el piso, cerca de sus pies, y sube
          b.x = v.w / 2 + (Math.random() - 0.5) * 30 * v.escala
          b.y = v.pies - Math.random() * 4
          b.v = (8 + Math.random() * 10) * v.escala
          b.vida = b.t = 1.6 + Math.random() * 1.4
        }
        b.y -= b.v * dt
        const f = b.t / b.vida
        b.img.setPosition(Math.round(b.x + Math.sin((1 - f) * 6 + b.vida) * 2), Math.round(b.y)).setAlpha(Math.min(1, f * 2.5) * 0.8 * (this.eligiendo && v.cont.alpha < 1 ? 0.3 : 1))
      }
    }

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
