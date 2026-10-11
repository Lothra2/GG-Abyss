import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { crearAnimsPersonaje } from '../kit/anims'
import { encolarAudio, encolarObjetosMundo, encolarPersonaje, encolarPostales } from '../kit/cargador'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { alfaTexto, avanceBeat, beatEn, DURACION_INTRO, LLAVE_INTRO, type Beat, type Momento } from '../logic/intro'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/** La cueva del abismo: la misma postal del título, ahora con fuego */
const POSTAL = 'arena_del_minotauro'

/** Guarda que este aparato ya vio el intro (si el navegador no deja, no pasa nada: se verá otra vez) */
export function marcarIntroVista(): void {
  try {
    localStorage.setItem(LLAVE_INTRO, '1')
  } catch {
    /* modo privado: no se guarda */
  }
}

export function introVista(): boolean {
  try {
    return localStorage.getItem(LLAVE_INTRO) === '1'
  } catch {
    return false
  }
}

/**
 * El intro al estilo Diablo (ver logic/intro.ts): brasas que suben de la oscuridad, la cueva del abismo con una pared
 * de fuego, dos ojos rojos que se abren, los guardianes en silueta, la familia que camina hacia el portal con Thor y el
 * título entre llamas. Todo con piezas del kit (fogatas, brasas, personajes, la postal) y luz técnica. Un toque lo salta.
 */
export class Intro extends Phaser.Scene {
  private t = 0
  private beat: Momento | null = null
  private saliendo = false
  private capas: Record<Momento, Phaser.GameObjects.Container> = {} as never
  private fuego!: Phaser.GameObjects.Container
  private resplandor: Phaser.GameObjects.Image[] = []
  private postal: Phaser.GameObjects.Image | null = null
  private ojos: Phaser.GameObjects.Image[] = []
  private leyenda!: Phaser.GameObjects.BitmapText
  private saltar!: Boton
  private musica?: Phaser.Sound.BaseSound
  private brasas: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private esc = 1

  constructor() {
    super('Intro')
  }

  preload(): void {
    const m = manifestDe(this)
    for (const id of ['minotauro', 'guardian_campana']) encolarPersonaje(this, m, id, ['idle'])
    encolarObjetosMundo(this, m, ['fogata', 'campamento_fogata', 'antorcha', 'portal_azul'])
    encolarPostales(this, m, [POSTAL])
    encolarAudio(this, m, ['musica_amenaza', 'jefe_rugido', 'jefe_pisoton', 'portal', 'ladrido', 'legendario', 'ambiente_magia'])
  }

  create(): void {
    const m = manifestDe(this)
    this.t = 0
    this.beat = null
    this.saliendo = false
    this.cameras.main.setBackgroundColor(0x020205)
    for (const id of ['minotauro', 'guardian_campana', 'sophie', 'alana', 'thor']) crearAnimsPersonaje(this, m, id)
    const fogata = m.mundo.objetos.fogata
    if (fogata && !this.anims.exists('intro_fogata')) {
      this.anims.create({ key: 'intro_fogata', frames: this.anims.generateFrameNumbers(K.obj('fogata', 'idle'), { start: 0, end: fogata.anims.idle!.cuadros - 1 }), frameRate: fogata.anims.idle!.fps, repeat: -1 })
    }

    // la cueva va detrás del fuego, lo demás delante
    for (const k of ['brasas', 'cueva', 'ojos', 'guardianes', 'familia', 'titulo'] as Momento[]) this.capas[k] = this.add.container(0, 0).setAlpha(0).setDepth(k === 'cueva' ? 0 : 70)
    this.fuego = this.add.container(0, 0).setDepth(50).setAlpha(0)
    this.leyenda = texto(this, 0, 0, '', 'fuente_ui', 2, { origen: [0.5, 0.5], tinte: 0xffd8a0, profundidad: 200 }).setAlpha(0)

    if (this.cache.audio.exists(K.aud('musica_amenaza'))) {
      this.musica = this.sound.add(K.aud('musica_amenaza'), { loop: true, volume: 0 })
      this.musica.play()
      this.tweens.add({ targets: this.musica, volume: 0.55, duration: 2500 })
    }
    // la música del título se pausa y vuelve al terminar (la selección la sigue usando)
    const delTitulo = this.registry.get('musicaTitulo') as Phaser.Sound.BaseSound | undefined
    if (delTitulo?.isPlaying) {
      delTitulo.pause()
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delTitulo.resume())
    }

    Bloqueo.instalar(this)
    const escB = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.saltar = crearBoton(this, { x: 0, y: 0, etiqueta: 'Saltar', escalaTexto: escB, icono: 'icono_jugar', origen: [1, 0], sonido: 'click', alToque: () => this.terminar() })
    this.saltar.setDepth(300)
    // medio segundo de gracia para que el toque que lo abrió no lo salte
    const desde = performance.now()
    const saltable = () => performance.now() - desde > 500
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (saltable() && !Bloqueo.tomado(p.id)) this.terminar()
    })
    this.input.keyboard?.on('keydown', () => saltable() && this.terminar())

    alCambiarEscala(this, () => this.armar())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('intro', 'saltarIntro')
      this.musica?.stop()
    })
    agregarGanchos({
      intro: () => ({ t: Math.round(this.t * 10) / 10, momento: this.beat, texto: this.leyenda.text, duracion: DURACION_INTRO }),
      saltarIntro: (() => this.terminar()) as never,
    })
    this.cameras.main.fadeIn(600, 2, 2, 5)
  }

  /** Arma todo a la escala de la pantalla. Se llama de nuevo si cambia el tamaño */
  private armar(): void {
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    this.esc = e.zoom >= 3 ? 1 : 2
    const esc = this.esc
    for (const c of Object.values(this.capas)) c.removeAll(true)
    this.fuego.removeAll(true)
    this.resplandor = []
    this.ojos = []
    this.brasas?.destroy()
    this.brasas = null

    // la cueva: la postal a la escala entera que cubre la pantalla, oscurecida
    if (this.textures.exists(K.postal(POSTAL))) {
      const k = Math.max(1, Math.ceil(Math.max(w / 960, h / 540)))
      this.postal = this.add.image(Math.round(w / 2), Math.round(h / 2), K.postal(POSTAL)).setScale(k).setTint(0x8a6a60)
      this.capas.cueva.add(this.postal)
      this.capas.cueva.add(this.add.rectangle(0, 0, w, h, 0x05020a, 0.45).setOrigin(0, 0))
    }

    // la pared de fuego abajo: fogatas del kit en dos filas, agrandadas a escala entera, con las piedras fuera de cuadro.
    // Atrás más grandes y apagadas, adelante más chicas y vivas: así se ve una pared y no un campamento
    const kf = Math.max(3, Math.round(h / 130))
    for (const [k, alfa, sube] of [[kf + 2, 0.75, 0.42], [kf, 1, 0.3]] as const) {
      const paso = Math.round(32 * k * 0.5)
      for (let x = -paso / 2, i = 0; x < w + paso; x += paso, i++) {
        if (!this.textures.exists(K.obj('fogata', 'idle'))) break
        const f = this.add.sprite(Math.round(x), Math.round(h + 32 * k * sube) + (i % 2) * 2 * k, K.obj('fogata', 'idle'), i % 6).setOrigin(0.5, 1).setScale(k).setAlpha(alfa)
        if (this.anims.exists('intro_fogata')) f.play({ key: 'intro_fogata', startFrame: (i * 2 + (k > kf ? 3 : 0)) % 6 })
        this.fuego.add(f)
      }
    }
    for (let i = 0; i < 5; i++) {
      const g = this.add.image(Math.round((w * (i + 0.5)) / 5), h, K.luz).setTint(0xff6a20).setBlendMode(Phaser.BlendModes.ADD).setScale((w / 5 / 64) * 1.6, (h * 0.5) / 64).setAlpha(0.55)
      this.fuego.add(g)
      this.resplandor.push(g)
    }

    // brasas que suben desde el fuego (partícula del kit)
    if (this.textures.exists(K.par('brasa'))) {
      this.brasas = this.add.particles(0, 0, K.par('brasa'), {
        x: { min: 0, max: w },
        y: h + 4,
        lifespan: { min: 2500, max: 5000 },
        speedY: { min: -40 * esc, max: -90 * esc },
        speedX: { min: -12 * esc, max: 12 * esc },
        scale: { start: esc, end: esc },
        alpha: { start: 1, end: 0 },
        frequency: 70,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(60)
    }

    // los ojos rojos en el fondo de la cueva (luz técnica teñida)
    const oy = Math.round(h * 0.36)
    for (const dx of [-14 * esc, 14 * esc]) {
      const o = this.add.image(Math.round(w / 2 + dx), oy, K.luz).setTint(0xff2a10).setBlendMode(Phaser.BlendModes.ADD).setScale((14 * esc) / 64, (7 * esc) / 64).setAlpha(0)
      this.capas.ojos.add(o)
      this.ojos.push(o)
    }

    // los guardianes caídos, en silueta roja a los costados
    const kg = escalaQueEntra(96, w * 0.3, 3)
    for (const [id, x, flip] of [['minotauro', w * 0.2, false], ['guardian_campana', w * 0.8, true]] as const) {
      if (!this.textures.exists(K.pers(id, 'idle'))) continue
      const s = this.add.sprite(Math.round(x), Math.round(h * 0.72), K.pers(id, 'idle'), 0).setOrigin(0.5, 1).setScale(kg).setTint(0x3a0a08).setFlipX(flip)
      const anim = K.anim(id, 'idle', 'down')
      if (this.anims.exists(anim)) s.play(anim)
      const brillo = this.add.image(s.x, s.y - 40 * kg, K.luz).setTint(0xff3010).setBlendMode(Phaser.BlendModes.ADD).setScale((60 * kg) / 64).setAlpha(0.35)
      this.capas.guardianes.add([brillo, s])
    }

    // la familia camina hacia el portal, con su luz tibia
    const kh = escalaQueEntra(48, w * 0.12, 4)
    const py = Math.round(h * 0.7)
    if (this.textures.exists(K.obj('portal_azul', 'girar'))) {
      const p = this.add.sprite(Math.round(w / 2), Math.round(h * 0.52), K.obj('portal_azul', 'girar'), 0).setScale(Math.max(1, kh - 1))
      this.capas.familia.add([this.add.image(p.x, p.y, K.luz).setTint(0x4a8aff).setBlendMode(Phaser.BlendModes.ADD).setScale((90 * kh) / 64).setAlpha(0.5), p])
    }
    this.capas.familia.add(this.add.image(Math.round(w / 2), py - 20 * kh, K.luz).setTint(0xffd8a0).setBlendMode(Phaser.BlendModes.ADD).setScale((70 * kh) / 64).setAlpha(0.45))
    for (const [id, dx] of [['sophie', -22], ['alana', 22], ['thor', 0]] as const) {
      if (!this.textures.exists(K.pers(id, 'walk'))) continue
      const s = this.add.sprite(Math.round(w / 2 + dx * kh), py + (id === 'thor' ? 14 * kh : 0), K.pers(id, 'walk'), 0).setOrigin(0.5, 1).setScale(kh)
      const anim = K.anim(id, 'walk', 'up')
      if (this.anims.exists(anim)) s.play(anim)
      this.capas.familia.add(s)
    }

    // el título entre llamas
    const logo = this.textures.exists(K.ui('logo'))
      ? this.add.sprite(Math.round(w / 2), Math.round(h * 0.4), K.ui('logo'), 0).setScale(escalaQueEntra(288, w * 0.8, 4))
      : texto(this, Math.round(w / 2), Math.round(h * 0.4), 'GG Abyss', 'fuente_titulo', esc + 2, { origen: [0.5, 0.5] })
    if (logo instanceof Phaser.GameObjects.Sprite && this.anims.exists('logo')) logo.play('logo')
    this.capas.titulo.add([this.add.image(Math.round(w / 2), Math.round(h * 0.4), K.luz).setTint(0xff7a20).setBlendMode(Phaser.BlendModes.ADD).setScale((w * 0.9) / 64, (h * 0.5) / 64).setAlpha(0.35), logo])

    // la primera capa, las brasas solas en lo oscuro, no tiene más que eso y la leyenda
    this.leyenda.setScale(esc + 1).setPosition(Math.round(w / 2), Math.round(h * 0.13))
    this.saltar.setPosition(w - 6, 6)
    this.beat = null
  }

  private alEntrar(b: Beat): void {
    this.leyenda.setText(b.texto)
    const ancho = this.scale.width - 24
    this.leyenda.setScale(1).setScale(escalaQueEntra(this.leyenda.displayWidth, ancho, this.esc + 1))
    if (this.cache.audio.exists(K.aud(b.sonido))) this.sound.play(K.aud(b.sonido), { volume: b.momento === 'ojos' ? 0.8 : 0.55, rate: b.rate })
    if (b.momento === 'ojos') this.cameras.main.shake(500, 0.004)
    if (b.momento === 'titulo') this.cameras.main.flash(500, 255, 140, 60)
  }

  override update(_t: number, ms: number): void {
    if (this.saliendo) return
    // tiempo real (con tope por si la pestaña se durmió): en una tablet lenta dura lo mismo
    const dt = Math.min(0.25, ms / 1000)
    this.t += dt
    const b = beatEn(this.t)
    if (b.momento !== this.beat) {
      this.beat = b.momento
      this.alEntrar(b)
    }
    const k = avanceBeat(this.t, b)
    this.leyenda.setAlpha(alfaTexto(this.t, b))

    // qué se ve en cada momento (la cueva y el fuego se quedan de fondo desde que aparecen)
    const visto = (m: Momento) => this.t >= (this.capasT[m] ?? 99)
    const meta: Record<Momento, number> = {
      brasas: 0,
      cueva: visto('cueva') ? (b.momento === 'titulo' ? 0.5 : 1) : 0,
      ojos: b.momento === 'ojos' || b.momento === 'guardianes' ? 1 : 0,
      guardianes: b.momento === 'guardianes' ? 1 : 0,
      familia: b.momento === 'familia' ? 1 : 0,
      titulo: b.momento === 'titulo' ? 1 : 0,
    }
    for (const [m, c] of Object.entries(this.capas) as [Momento, Phaser.GameObjects.Container][]) c.setAlpha(c.alpha + (meta[m] - c.alpha) * Math.min(1, dt * 2.5))
    const fuegoMeta = visto('cueva') ? (b.momento === 'titulo' ? 1 : 0.85) : Math.min(0.5, this.t / 4)
    this.fuego.setAlpha(this.fuego.alpha + (fuegoMeta - this.fuego.alpha) * Math.min(1, dt * 2))

    // el fuego respira y se agita
    this.resplandor.forEach((g, i) => g.setAlpha(0.42 + 0.18 * Math.sin(this.t * 7 + i * 1.7) * Math.sin(this.t * 3.1 + i)))
    // la cueva se acerca despacito
    if (this.postal) this.postal.setY(Math.round(this.scale.height / 2 + (b.momento === 'cueva' ? -6 * this.esc * k : 0)))
    // los ojos se abren de a poco y parpadean
    if (b.momento === 'ojos' || b.momento === 'guardianes') {
      const abre = b.momento === 'ojos' ? Math.min(1, k * 2) : 1
      const parpadeo = Math.sin(this.t * 1.3) > 0.97 ? 0.1 : 1
      for (const o of this.ojos) o.setAlpha(abre * parpadeo).setScale(((14 * this.esc) / 64) * (0.9 + 0.1 * Math.sin(this.t * 5)), ((7 * this.esc) / 64) * abre * parpadeo + 0.001)
    }

    if (this.t >= DURACION_INTRO) this.terminar()
  }

  /** cuándo aparece cada capa por primera vez (la cueva se queda de fondo) */
  private get capasT(): Partial<Record<Momento, number>> {
    return { cueva: 4 }
  }

  private terminar(): void {
    if (this.saliendo) return
    this.saliendo = true
    marcarIntroVista()
    if (this.musica) this.tweens.add({ targets: this.musica, volume: 0, duration: 500 })
    this.cameras.main.fadeOut(600, 2, 2, 5)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('SeleccionJugador'))
  }
}
