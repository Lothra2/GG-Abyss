import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { crearAnimsPersonaje } from '../kit/anims'
import { encolarAudio, encolarObjetosMundo, encolarParticulas, encolarPersonaje, encolarPostales } from '../kit/cargador'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { escalaQueEntra, texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { avanceBeat, beatEn, DURACION_INTRO, enSilencio, latidosHasta, letrasVisibles, LLAVE_INTRO, type Beat, type Momento } from '../logic/intro'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/** La cueva del abismo: la misma postal del título, ahora con fuego */
const POSTAL = 'arena_del_minotauro'
const PLANOS: Momento[] = ['brasas', 'cueva', 'ojos', 'guardianes', 'familia', 'titulo']

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
 * El intro al estilo Diablo (ver logic/intro.ts), dirigido como cine:
 * - franjas negras arriba y abajo, con el subtítulo que se escribe letra por letra en la de abajo
 * - planos con corte seco (un instante de negro) en los momentos fuertes y fundido en los suaves
 * - profundidad: la pared de fuego adelante y las brasas subiendo, cada una a su velocidad
 * - los ojos en primer plano con latidos, relámpagos que dejan ver a los guardianes en silueta, la familia a
 *   contraluz del portal con sus sombras largas hacia la cámara, y el título que cae después de un silencio
 * Todo con piezas del kit (fogatas, brasas, personajes, la postal) y luz técnica. Un toque lo salta.
 * Cuando el taller entregue los paneles de cine (encargo, parte 4) reemplazan lo prestado.
 */
export class Intro extends Phaser.Scene {
  private t = 0
  private beat: Momento | null = null
  private saliendo = false
  private planos: Record<Momento, Phaser.GameObjects.Container> = {} as never
  private fuego!: Phaser.GameObjects.Container
  private resplandor: Phaser.GameObjects.Image[] = []
  private postal: Phaser.GameObjects.Image | null = null
  private ojos: Phaser.GameObjects.Image[] = []
  private siluetas: Phaser.GameObjects.Sprite[] = []
  private thor: Phaser.GameObjects.Sprite | null = null
  private thorLadro = false
  private logo: Phaser.GameObjects.GameObject | null = null
  private logoEscala = 1
  private franjas: Phaser.GameObjects.Rectangle[] = []
  private negro!: Phaser.GameObjects.Rectangle
  private leyenda!: Phaser.GameObjects.BitmapText
  private saltar!: Boton
  private musica?: Phaser.Sound.BaseSound
  private brasas: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private esc = 1
  private alto = 0
  private latidos = 0
  private letras = 0
  private relampagos = 0
  private cortes = 0
  private golpeTitulo = false

  constructor() {
    super('Intro')
  }

  preload(): void {
    const m = manifestDe(this)
    for (const id of ['minotauro', 'guardian_campana']) encolarPersonaje(this, m, id, ['idle', 'warcry'])
    encolarPersonaje(this, m, 'thor', ['idle', 'walk', 'bark'])
    encolarObjetosMundo(this, m, ['fogata', 'portal_azul'])
    encolarPostales(this, m, [POSTAL])
    encolarParticulas(this, m, ['brasa'])
    encolarAudio(this, m, ['musica_amenaza', 'jefe_rugido', 'jefe_pisoton', 'portal', 'ladrido', 'legendario', 'ambiente_magia', 'click'])
  }

  create(): void {
    const m = manifestDe(this)
    this.t = 0
    this.beat = null
    this.saliendo = false
    this.latidos = 0
    this.letras = 0
    this.relampagos = 0
    this.cortes = 0
    this.golpeTitulo = false
    this.thorLadro = false
    this.cameras.main.setBackgroundColor(0x020205)
    for (const id of ['minotauro', 'guardian_campana', 'sophie', 'alana', 'thor']) crearAnimsPersonaje(this, m, id)
    const fogata = m.mundo.objetos.fogata
    if (fogata && !this.anims.exists('intro_fogata')) {
      this.anims.create({ key: 'intro_fogata', frames: this.anims.generateFrameNumbers(K.obj('fogata', 'idle'), { start: 0, end: fogata.anims.idle!.cuadros - 1 }), frameRate: fogata.anims.idle!.fps, repeat: -1 })
    }

    // la cueva va detrás del fuego, lo demás delante. El negro de los cortes y las franjas de cine, encima de todo
    for (const k of PLANOS) this.planos[k] = this.add.container(0, 0).setAlpha(0).setDepth(k === 'cueva' ? 0 : 70)
    this.fuego = this.add.container(0, 0).setDepth(50).setAlpha(0)
    this.negro = this.add.rectangle(0, 0, 16, 16, 0x020205, 1).setOrigin(0, 0).setDepth(180).setAlpha(0)
    this.franjas = [0, 1].map(() => this.add.rectangle(0, 0, 16, 16, 0x000000, 1).setOrigin(0, 0).setDepth(190))
    this.leyenda = texto(this, 0, 0, '', 'fuente_ui', 2, { origen: [0.5, 0.5], tinte: 0xffd8a0, profundidad: 200 })

    if (this.cache.audio.exists(K.aud('musica_amenaza'))) {
      this.musica = this.sound.add(K.aud('musica_amenaza'), { loop: true, volume: 0 })
      this.musica.play()
    }
    // la música del título se pausa y vuelve al terminar (la selección la sigue usando)
    const delTitulo = this.registry.get('musicaTitulo') as Phaser.Sound.BaseSound | undefined
    if (delTitulo?.isPlaying) {
      delTitulo.pause()
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delTitulo.resume())
    }

    Bloqueo.instalar(this)
    const escB = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.saltar = crearBoton(this, { x: 0, y: 0, etiqueta: 'Saltar', escalaTexto: escB, icono: 'icono_jugar', origen: [1, 0.5], sonido: 'click', alToque: () => this.terminar() })
    this.saltar.setDepth(300).setAlpha(0.75)
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
      intro: () => ({ t: Math.round(this.t * 10) / 10, momento: this.beat, texto: this.leyenda.text, duracion: DURACION_INTRO, cortes: this.cortes, latidos: this.latidos, relampagos: this.relampagos, golpeTitulo: this.golpeTitulo, franjas: Math.round(this.franjas[0]?.height ?? 0) }),
      saltarIntro: (() => this.terminar()) as never,
    })
    this.cameras.main.fadeIn(800, 2, 2, 5)
  }

  /** Alto de cada franja de cine: deja la imagen en 2.2 : 1 más o menos */
  private altoFranja(w: number, h: number): number {
    return Math.max(0, Math.round((h - w / 2.2) / 2))
  }

  /** Arma todo a la escala de la pantalla. Se llama de nuevo si cambia el tamaño */
  private armar(): void {
    const w = this.scale.width
    const h = this.scale.height
    const e = escalaDe(this.game)
    this.esc = e.zoom >= 3 ? 1 : 2
    const esc = this.esc
    for (const c of Object.values(this.planos)) c.removeAll(true)
    this.fuego.removeAll(true)
    this.resplandor = []
    this.ojos = []
    this.siluetas = []
    this.thor = null
    this.logo = null
    this.brasas?.destroy()
    this.brasas = null
    this.negro.setSize(w, h)
    // en pantallas muy anchas la franja sale de la proporción; en la tablet, un mínimo para que entre el subtítulo
    this.alto = Math.max(Math.min(this.altoFranja(w, h), Math.round(h * 0.12)), Math.round(26 * esc))
    this.franjas[0]!.setPosition(0, 0).setSize(w, this.alto)
    this.franjas[1]!.setPosition(0, h - this.alto).setSize(w, this.alto)
    const cy = h / 2

    // plano 2, la cueva: la postal a escala entera que cubre la pantalla, oscurecida y con la luz roja del fuego
    if (this.textures.exists(K.postal(POSTAL))) {
      const k = Math.max(1, Math.ceil(Math.max(w / 960, h / 540)))
      this.postal = this.add.image(Math.round(w / 2), Math.round(cy), K.postal(POSTAL)).setScale(k).setTint(0x8a6a60)
      this.planos.cueva.add([this.postal, this.add.rectangle(0, 0, w, h, 0x05020a, 0.4).setOrigin(0, 0)])
    }

    // la pared de fuego abajo: fogatas del kit en dos filas, con las piedras fuera de cuadro. Atrás más grandes
    // y apagadas, adelante más chicas y vivas: así se ve una pared y no un campamento
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

    // brasas que suben del fuego (partícula del kit)
    if (this.textures.exists(K.par('brasa'))) {
      this.brasas = this.add.particles(0, 0, K.par('brasa'), {
        x: { min: 0, max: w }, y: h + 4,
        lifespan: { min: 2500, max: 5200 },
        speedY: { min: -40 * esc, max: -95 * esc }, speedX: { min: -14 * esc, max: 14 * esc },
        scale: esc, alpha: { start: 1, end: 0 }, frequency: 60, blendMode: Phaser.BlendModes.ADD,
      }).setDepth(60)
    }

    // plano 3, los ojos en primer plano: grandes, con su brillo y el reflejo rojo del fuego abajo
    const ox = 34 * esc
    const oy = Math.round(cy - 6 * esc)
    this.planos.ojos.add(this.add.image(Math.round(w / 2), oy + 60 * esc, K.luz).setTint(0x8a1008).setBlendMode(Phaser.BlendModes.ADD).setScale((w * 0.7) / 64, (90 * esc) / 64).setAlpha(0.5))
    for (const dx of [-ox, ox]) {
      const halo = this.add.image(Math.round(w / 2 + dx), oy, K.luz).setTint(0xff2a10).setBlendMode(Phaser.BlendModes.ADD).setScale((70 * esc) / 64, (34 * esc) / 64).setAlpha(0)
      const ojo = this.add.image(Math.round(w / 2 + dx), oy, K.luz).setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setScale((26 * esc) / 64, (10 * esc) / 64).setAlpha(0)
      this.planos.ojos.add([halo, ojo])
      this.ojos.push(halo, ojo)
    }

    // plano 4, los guardianes caídos: se ven en silueta con cada relámpago y quedan en rojo
    const kg = escalaQueEntra(96, w * 0.3, 3)
    this.planos.guardianes.add(this.add.image(Math.round(w / 2), Math.round(cy + h * 0.15), K.luz).setTint(0x5a0806).setBlendMode(Phaser.BlendModes.ADD).setScale((w * 0.9) / 64, (h * 0.5) / 64).setAlpha(0.55))
    for (const [id, x, flip] of [['minotauro', w * 0.27, false], ['guardian_campana', w * 0.73, true]] as const) {
      if (!this.textures.exists(K.pers(id, 'idle'))) continue
      const s = this.add.sprite(Math.round(x), Math.round(h - this.alto - 4 * esc), K.pers(id, 'idle'), 0).setOrigin(0.5, 1).setScale(kg).setTint(0x2a0604).setFlipX(flip)
      const anim = K.anim(id, 'idle', 'down')
      if (this.anims.exists(anim)) s.play(anim)
      this.planos.guardianes.add(s)
      this.siluetas.push(s)
    }

    // plano 5, la familia a contraluz del portal: caminan hacia él y sus sombras largas vienen hacia la cámara
    const kh = escalaQueEntra(48, w * 0.13, 5)
    const py = Math.round(h - this.alto - 16 * kh)
    if (this.textures.exists(K.obj('portal_azul', 'girar'))) {
      const p = this.add.sprite(Math.round(w / 2), Math.round(py - 46 * kh), K.obj('portal_azul', 'girar'), 0).setScale(Math.max(1, kh - 1))
      this.planos.familia.add([this.add.image(p.x, p.y, K.luz).setTint(0x4a8aff).setBlendMode(Phaser.BlendModes.ADD).setScale((110 * kh) / 64).setAlpha(0.55), p])
    }
    for (const [id, dx] of [['sophie', -20], ['alana', 20], ['thor', 0]] as const) {
      if (!this.textures.exists(K.pers(id, 'walk'))) continue
      const y = py + (id === 'thor' ? 12 * kh : 0)
      const x = Math.round(w / 2 + dx * kh)
      const sombra = this.add.sprite(x, y, K.pers(id, 'walk'), 0).setOrigin(0.5, 1).setScale(kh, -kh * 1.5).setTint(0x000000).setAlpha(0.45)
      const s = this.add.sprite(x, y, K.pers(id, 'walk'), 0).setOrigin(0.5, 1).setScale(kh).setTint(0x9aa8d8)
      const anim = K.anim(id, 'walk', 'up')
      if (this.anims.exists(anim)) {
        s.play(anim)
        sombra.play(anim)
      }
      this.planos.familia.add([sombra, s])
      if (id === 'thor') this.thor = s
    }
    // el borde de luz del portal sobre ellos
    this.planos.familia.add(this.add.image(Math.round(w / 2), py - 24 * kh, K.luz).setTint(0x8ab8ff).setBlendMode(Phaser.BlendModes.ADD).setScale((80 * kh) / 64).setAlpha(0.3))

    // plano 6, el título
    this.logoEscala = escalaQueEntra(288, w * 0.8, 4)
    this.logo = this.textures.exists(K.ui('logo'))
      ? this.add.sprite(Math.round(w / 2), Math.round(cy - 10 * esc), K.ui('logo'), 0).setScale(this.logoEscala)
      : texto(this, Math.round(w / 2), Math.round(cy - 10 * esc), 'GG Abyss', 'fuente_titulo', esc + 2, { origen: [0.5, 0.5] })
    if (this.logo instanceof Phaser.GameObjects.Sprite && this.anims.exists('logo')) this.logo.play('logo')
    this.planos.titulo.add([this.add.image(Math.round(w / 2), Math.round(cy), K.luz).setTint(0xff7a20).setBlendMode(Phaser.BlendModes.ADD).setScale((w * 0.9) / 64, (h * 0.55) / 64).setAlpha(0.4), this.logo])

    this.leyenda.setPosition(Math.round(w / 2), Math.round(h - this.alto / 2))
    this.saltar.setPosition(w - 6, Math.round(this.alto / 2))
    this.beat = null
  }

  /** Al empezar un plano: su sonido, el corte seco si lo pide, y el texto vacío para escribirlo de nuevo */
  private alEntrar(b: Beat): void {
    this.letras = 0
    this.leyenda.setText('')
    if (b.corte && this.t > 0.5) {
      this.cortes++
      // un instante de negro y el plano nuevo aparece de golpe
      this.negro.setAlpha(1)
      this.tweens.add({ targets: this.negro, alpha: 0, duration: 260, delay: 140 })
      for (const k of PLANOS) if (k !== b.momento) this.planos[k].setAlpha(0)
      this.planos[b.momento].setAlpha(1)
    }
    if (this.cache.audio.exists(K.aud(b.sonido)) && b.momento !== 'titulo') this.sound.play(K.aud(b.sonido), { volume: b.momento === 'ojos' ? 0.85 : 0.55, rate: b.rate })
    if (b.momento === 'ojos') this.cameras.main.shake(600, 0.005)
  }

  /** El golpe del título: después del silencio, el logo cae, tiembla todo, salta una lluvia de chispas y sube el fuego */
  private golpearTitulo(): void {
    this.golpeTitulo = true
    const w = this.scale.width
    const h = this.scale.height
    if (this.cache.audio.exists(K.aud('jefe_pisoton'))) this.sound.play(K.aud('jefe_pisoton'), { volume: 0.9, rate: 0.7 })
    if (this.cache.audio.exists(K.aud('legendario'))) this.sound.play(K.aud('legendario'), { volume: 0.6, rate: 0.9 })
    this.cameras.main.shake(450, 0.012)
    this.cameras.main.flash(380, 255, 150, 60)
    this.planos.titulo.setAlpha(1)
    const logo = this.logo as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha
    if (logo) {
      logo.setScale(this.logoEscala * 2)
      logo.setAlpha(0)
      this.tweens.add({ targets: logo, scale: this.logoEscala, alpha: 1, duration: 220, ease: 'Quad.easeIn' })
    }
    // la lluvia de chispas sale del logo hacia todos lados y cae
    if (this.textures.exists(K.par('brasa'))) {
      const esc = this.esc
      const chispas = this.add.particles(Math.round(w / 2), Math.round(h / 2 - 10 * esc), K.par('brasa'), {
        speed: { min: 60 * esc, max: 260 * esc }, angle: { min: 0, max: 360 }, gravityY: 90 * esc,
        lifespan: { min: 900, max: 2000 }, scale: { start: esc + 1, end: esc }, alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD, emitting: false,
      }).setDepth(150)
      chispas.explode(Math.round(120 * Math.max(1, w / 700)))
    }
    // el subtítulo pasa abajo del logo: las franjas se van y abajo queda el fuego
    const altoLogo = (this.logo as unknown as { displayHeight?: number }).displayHeight ?? 60
    this.tweens.add({ targets: this.leyenda, y: Math.round(h / 2 + altoLogo / 2 + 14 * this.esc), duration: 600, delay: 500, ease: 'Sine.easeInOut' })
    // las franjas se abren: se terminó la película
    this.tweens.add({ targets: this.franjas[0], y: -this.alto, duration: 900, delay: 600, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: this.franjas[1], y: h, duration: 900, delay: 600, ease: 'Sine.easeInOut' })
    // el fuego no sube (se verían las piedras de las fogatas): se aviva
    this.resplandor.forEach((g) => this.tweens.add({ targets: g, scaleY: g.scaleY * 1.35, duration: 500, ease: 'Back.easeOut' }))
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

    // el subtítulo se escribe letra por letra, con un tic suave cada tres
    const n = letrasVisibles(this.t, b)
    if (n !== this.letras) {
      if (Math.floor(n / 3) !== Math.floor(this.letras / 3) && this.cache.audio.exists(K.aud('click'))) this.sound.play(K.aud('click'), { volume: 0.06, rate: 1.6 })
      this.letras = n
      this.leyenda.setText(b.texto.slice(0, n))
      this.leyenda.setScale(1).setScale(escalaQueEntra(Math.max(1, this.leyenda.displayWidth), this.scale.width - 24, this.esc + 1))
    }
    this.leyenda.setAlpha(Math.min(1, (b.t1 - this.t) / 0.4))

    // la música: entra de a poco, baja en los ojos y se corta en el silencio antes del título
    if (this.musica) {
      const vol = enSilencio(this.t) || this.golpeTitulo ? 0 : b.momento === 'ojos' ? 0.3 : Math.min(0.55, this.t / 4)
      const actual = (this.musica as unknown as { volume: number }).volume
      ;(this.musica as unknown as { volume: number }).volume = actual + (vol - actual) * Math.min(1, dt * (enSilencio(this.t) ? 12 : 2))
    }

    // los planos suaves entran fundidos (los de corte ya entraron de golpe)
    const fundido: Partial<Record<Momento, number>> = {
      cueva: b.momento === 'cueva' ? 1 : b.momento === 'titulo' ? 0.45 : 0,
    }
    for (const [m, c] of Object.entries(this.planos) as [Momento, Phaser.GameObjects.Container][]) {
      const meta = fundido[m] ?? (m === b.momento ? 1 : 0)
      if (m === 'titulo' && !this.golpeTitulo) continue
      c.setAlpha(c.alpha + (meta - c.alpha) * Math.min(1, dt * 2.5))
    }
    // el fuego: tenue al principio, fuerte en la cueva y el título, se apaga en los primeros planos
    const fuegoMeta = b.momento === 'brasas' ? Math.min(0.5, this.t / 4) : b.momento === 'cueva' || b.momento === 'titulo' ? 1 : b.momento === 'guardianes' ? 0.7 : 0.25
    this.fuego.setAlpha(this.fuego.alpha + (fuegoMeta - this.fuego.alpha) * Math.min(1, dt * 2))
    this.resplandor.forEach((g, i) => g.setAlpha(0.42 + 0.18 * Math.sin(this.t * 7 + i * 1.7) * Math.sin(this.t * 3.1 + i)))

    // la cueva: la cámara baja despacio por ella
    if (this.postal) this.postal.setY(Math.round(this.scale.height / 2 + (b.momento === 'cueva' ? 14 * this.esc * (0.5 - k) : 0)))

    // los ojos: se abren de a poco, laten y parpadean una vez
    if (b.momento === 'ojos') {
      const abre = Math.min(1, Math.max(0, (this.t - b.t0 - 0.3) / 1.2))
      const parpadeo = k > 0.62 && k < 0.68 ? 0.05 : 1
      const lat = latidosHasta(this.t, b)
      if (lat > this.latidos) {
        this.latidos = lat
        if (this.cache.audio.exists(K.aud('jefe_pisoton'))) this.sound.play(K.aud('jefe_pisoton'), { volume: 0.35, rate: 0.45 })
      }
      const fase = ((this.t - b.t0 - 0.6) % 0.85) / 0.85
      const pulso = 1 + 0.15 * Math.max(0, 1 - fase * 4)
      for (let i = 0; i < this.ojos.length; i++) {
        const o = this.ojos[i]!
        const halo = i % 2 === 0
        const sx = ((halo ? 70 : 26) * this.esc) / 64
        const sy = ((halo ? 34 : 10) * this.esc) / 64
        o.setAlpha((halo ? 0.7 : 1) * abre * parpadeo).setScale(sx * pulso, Math.max(0.001, sy * abre * parpadeo * pulso))
      }
    }

    // los guardianes: dos relámpagos que los muestran negros contra la luz, después quedan en rojo
    if (b.momento === 'guardianes') {
      const rel = [0.25, 2.3].filter((r) => this.t - b.t0 >= r).length
      if (rel > this.relampagos) {
        this.relampagos = rel
        this.cameras.main.flash(90, 255, 235, 220)
        for (const s of this.siluetas) s.setTint(0x000000)
        this.time.delayedCall(160, () => this.siluetas.forEach((s) => s.setTint(0x5a0c08)))
      }
    }

    // la familia: Thor se da vuelta hacia la cámara y ladra
    if (b.momento === 'familia' && this.thor && !this.thorLadro && this.t - b.t0 > 2.6) {
      this.thorLadro = true
      const ladra = K.anim('thor', 'bark', 'down')
      const quieto = K.anim('thor', 'idle', 'down')
      if (this.anims.exists(ladra)) this.thor.play(ladra)
      else if (this.anims.exists(quieto)) this.thor.play(quieto)
      if (this.cache.audio.exists(K.aud('ladrido'))) this.sound.play(K.aud('ladrido'), { volume: 0.7 })
    }

    if (b.momento === 'titulo' && !this.golpeTitulo) this.golpearTitulo()
    if (this.t >= DURACION_INTRO) this.terminar()
  }

  private terminar(): void {
    if (this.saliendo) return
    this.saliendo = true
    marcarIntroVista()
    if (this.musica) this.tweens.add({ targets: this.musica, volume: 0, duration: 500 })
    this.cameras.main.fadeOut(700, 2, 2, 5)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('SeleccionJugador'))
  }
}
