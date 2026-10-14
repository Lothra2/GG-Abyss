import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { encolarAudio, encolarCine } from '../kit/cargador'
import { escalaPanel } from '../kit/intro'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { CINE, duracionCine, letrasCine, panelesCine, planoEn, planosCine, TEXTOS_CINE, type PanelCine, type PlanoCine } from '../logic/cine'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import { pantallaChica } from '../logic/escala'

export type NombreCine = 'cine_bajada' | 'cine_fin'

export interface DatosCine {
  cine: NombreCine
  /** a dónde sigue al terminar (o al saltarla) */
  luego: { escena: string; datos?: object }
}

interface CapaViva {
  s: Phaser.GameObjects.Sprite
  plano: number
  paralaje: number
  x: number
  /** si el panel es alto, cuánto mide ya escalado: la cámara baja por él */
  alto: number
}

/**
 * F13: las cinemáticas del final, la bajada al infierno y el cierre. Lee los paneles en capas que trae el taller en
 * `manifest.cine_bajada` y `manifest.cine_fin` (el formato del intro) y los pasa como película: franjas negras, la
 * cámara que se corre despacio con su paralaje (o baja por un panel alto), fundido entre planos, el subtítulo letra por
 * letra, nieve o humo que cruza delante y la música que crece. El título se queda quieto con un golpe. Un toque salta.
 * Si el kit no trae la cinemática, sigue derecho.
 */
export class Cine extends Phaser.Scene {
  private d!: DatosCine
  private planos: PlanoCine[] = []
  private paneles: PanelCine[] = []
  private grupos: Phaser.GameObjects.Container[] = []
  private capas: CapaViva[] = []
  private franjas: Phaser.GameObjects.Rectangle[] = []
  private leyenda!: Phaser.GameObjects.BitmapText
  private saltar: Boton | null = null
  private musica?: Phaser.Sound.BaseSound
  private t = 0
  private actual = -1
  private letras = 0
  private alto = 0
  private esc = 1
  private terminada = false
  private cruces = 0
  private golpes = 0

  constructor() {
    super('Cine')
  }

  init(d: DatosCine): void {
    this.d = d
    this.t = 0
    this.actual = -1
    this.letras = 0
    this.terminada = false
    this.cruces = 0
    this.golpes = 0
    this.grupos = []
    this.capas = []
    this.franjas = []
    this.saltar = null
    this.musica = undefined
  }

  preload(): void {
    const m = manifestDe(this)
    encolarCine(this, m, this.d.cine)
    const a = this.audioDe()
    encolarAudio(this, m, [a.musica, a.rugido, 'jefe_pisoton', 'legendario', 'portal', 'click'].filter((x): x is string => !!x))
  }

  private audioDe(): { musica?: string; rugido?: string } {
    const c = manifestDe(this)[this.d.cine] as Record<string, unknown> | undefined
    const a = (c?.audio ?? {}) as { musica?: string; rugido?: string }
    return { musica: a.musica ?? `${this.d.cine}_musica`, rugido: a.rugido ?? (this.d.cine === 'cine_bajada' ? 'cine_rugido' : undefined) }
  }

  create(): void {
    const c = manifestDe(this)[this.d.cine] as Record<string, unknown> | undefined
    this.paneles = panelesCine(c).filter((p) => p.capas.every((k) => this.textures.exists(K.cine(this.d.cine, `${p.nombre}_${k.nombre}`))))
    this.planos = planosCine(Object.fromEntries([...this.paneles.map((p) => [p.nombre, c?.[p.nombre]]), ['guion', c?.guion]]), TEXTOS_CINE[this.d.cine])
    agregarGanchos({
      cine: () => ({ cine: this.d.cine, t: Math.round(this.t * 10) / 10, plano: this.planos[this.actual]?.panel ?? null, planos: this.planos.map((p) => p.panel), texto: this.leyenda?.text ?? '', duracion: duracionCine(this.planos), capas: this.capas.length, cruces: this.cruces, golpes: this.golpes, terminada: this.terminada }),
      saltarCine: () => this.terminar(),
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('cine', 'saltarCine')
      this.musica?.stop()
    })
    this.cameras.main.setBackgroundColor(0x000000)
    if (!this.planos.length) {
      this.terminar(true)
      return
    }
    this.crearAnims()
    this.franjas = [0, 1].map(() => this.add.rectangle(0, 0, 16, 16, 0x000000, 1).setOrigin(0, 0).setDepth(190))
    this.leyenda = texto(this, 0, 0, '', 'fuente_ui', 2, { origen: [0.5, 0.5], tinte: this.d.cine === 'cine_fin' ? 0xffe8b0 : 0xc8e0ff, profundidad: 200 })
    const a = this.audioDe()
    if (a.musica && this.cache.audio.exists(K.aud(a.musica))) {
      this.musica = this.sound.add(K.aud(a.musica), { loop: false, volume: 0 })
      this.musica.play()
    }
    // la música de antes (el mundo o el título) se apaga
    const otra = this.registry.get('musicaTitulo') as Phaser.Sound.BaseSound | undefined
    if (otra?.isPlaying) this.tweens.add({ targets: otra, volume: 0, duration: 600, onComplete: () => otra.stop() })
    this.armar()
    alCambiarEscala(this, () => this.armar())
    // el botón Saltar aparece después de un ratico: así un toque apurado no se salta todo
    this.time.delayedCall(500, () => {
      const escB = pantallaChica(escalaDe(this.game)) ? 1 : 2
      this.saltar = crearBoton(this, { x: 0, y: 0, etiqueta: 'Saltar', escalaTexto: escB, icono: 'icono_jugar', origen: [1, 0.5], sonido: 'click', alToque: () => this.terminar() })
      this.saltar.setDepth(210).setAlpha(0)
      this.tweens.add({ targets: this.saltar, alpha: 0.75, duration: 400 })
      this.acomodarSaltar()
    })
    this.cameras.main.fadeIn(900, 0, 0, 0)
  }

  private crearAnims(): void {
    const n = this.d.cine
    const c = (manifestDe(this)[n] ?? {}) as Record<string, { cuadros?: number; fps?: number; capas?: { nombre: string; cuadros: number; fps: number }[] }>
    for (const p of this.paneles) {
      for (const k of p.capas) {
        const tex = K.cine(n, `${p.nombre}_${k.nombre}`)
        const key = `${tex}_anim`
        if (k.cuadros > 1 && !this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start: 0, end: k.cuadros - 1 }), frameRate: k.fps, repeat: /logo|titulo/.test(k.nombre) ? 0 : -1 })
      }
    }
    for (const [nombre, h] of Object.entries(c)) {
      if (!h || typeof h !== 'object' || Array.isArray(h.capas) || typeof h.cuadros !== 'number') continue
      const tex = K.cine(n, nombre)
      const key = `${tex}_anim`
      if (this.textures.exists(tex) && !this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start: 0, end: h.cuadros - 1 }), frameRate: h.fps ?? 8, repeat: -1 })
    }
  }

  /** Arma los paneles a escala entera que cubre la pantalla. Se llama de nuevo si cambia el tamaño */
  private armar(): void {
    const w = this.scale.width
    const h = this.scale.height
    this.esc = pantallaChica(escalaDe(this.game)) ? 1 : 2
    for (const g of this.grupos) g.destroy(true)
    this.grupos = []
    this.capas = []
    this.alto = Math.max(Math.min(Math.max(0, Math.round((h - w / 2.2) / 2)), Math.round(h * 0.12)), Math.round(26 * this.esc))
    this.franjas[0]!.setPosition(0, 0).setSize(w, this.alto)
    this.franjas[1]!.setPosition(0, h - this.alto).setSize(w, this.alto)
    this.leyenda.setScale(this.esc).setPosition(Math.round(w / 2), Math.round(h - this.alto / 2))
    this.planos.forEach((pl, i) => {
      const p = this.paneles.find((q) => q.nombre === pl.panel)!
      const alto = p.h > p.w ? p.h : 0
      const k = alto ? Math.max(1, Math.ceil(w / p.w)) : escalaPanel(p.w, p.h, w, h, 18 * this.esc)
      const g = this.add.container(0, 0).setDepth(10 + i).setAlpha(i === this.actual ? 1 : 0)
      for (const c of p.capas) {
        const tex = K.cine(this.d.cine, `${p.nombre}_${c.nombre}`)
        const x = Math.round(w / 2)
        const s = this.add.sprite(x, alto ? 0 : Math.round(h / 2), tex, 0).setOrigin(0.5, alto ? 0 : 0.5).setScale(k)
        g.add(s)
        this.capas.push({ s, plano: i, paralaje: c.paralaje, x, alto: alto * k })
        if (i === this.actual) this.animar(s, tex)
      }
      this.grupos.push(g)
    })
    this.acomodarSaltar()
  }

  private acomodarSaltar(): void {
    this.saltar?.setPosition(Math.round(this.scale.width - 10 * this.esc), Math.round(this.alto / 2))
  }

  private animar(s: Phaser.GameObjects.Sprite, tex: string): void {
    const key = `${tex}_anim`
    if (this.anims.exists(key)) s.play(key)
  }

  /** La cámara de cada panel: de lado según su paralaje, o bajando por el panel alto */
  private mover(i: number, k: number): void {
    const h = this.scale.height
    const pl = this.planos[i]!
    // el título no se mueve. Los demás se corren despacito, cada capa a su velocidad
    const corre = pl.titulo ? 0 : (k - 0.5) * 2 * 14 * this.esc
    for (const c of this.capas) {
      if (c.plano !== i) continue
      if (c.alto) c.s.setY(Math.round(-(c.alto - h) * (1 - Math.pow(1 - k, 2)) * c.paralaje))
      else c.s.setX(Math.round(c.x - corre * c.paralaje))
    }
  }

  private entrar(i: number): void {
    const antes = this.actual
    this.actual = i
    this.letras = 0
    this.leyenda.setText('')
    const pl = this.planos[i]!
    const g = this.grupos[i]!
    for (const c of this.capas) if (c.plano === i) this.animar(c.s, c.s.texture.key)
    // fundido: el nuevo aparece encima del viejo, y el viejo se apaga detrás
    this.tweens.add({ targets: g, alpha: 1, duration: CINE.fundidoS * 1000, ease: 'Sine.easeInOut' })
    if (antes >= 0) {
      const v = this.grupos[antes]!
      this.tweens.add({ targets: v, alpha: 0, duration: CINE.fundidoS * 1000, delay: CINE.fundidoS * 500 })
    }
    // lo que cruza delante: nieve en la bajada, humo o chispas en el cierre (lo que traiga el taller)
    if (!pl.titulo && i % 2 === 1) this.cruzar()
    const a = this.audioDe()
    if (/diablo|cae/.test(pl.panel)) {
      // el Diablo despierta (o cae): el rugido grave y la pantalla que tiembla, sin susto de golpe
      const r = a.rugido && this.cache.audio.exists(K.aud(a.rugido)) ? a.rugido : 'jefe_pisoton'
      if (this.cache.audio.exists(K.aud(r))) this.time.delayedCall(900, () => this.sound.play(K.aud(r), { volume: 0.75, rate: 0.85 }))
      this.time.delayedCall(1000, () => this.cameras.main.shake(1400, 0.004))
      this.golpes++
    }
    if (pl.titulo) {
      this.golpes++
      if (this.cache.audio.exists(K.aud('jefe_pisoton'))) this.sound.play(K.aud('jefe_pisoton'), { volume: 0.9, rate: 0.7 })
      if (this.d.cine === 'cine_fin' && this.cache.audio.exists(K.aud('legendario'))) this.sound.play(K.aud('legendario'), { volume: 0.6 })
      this.cameras.main.flash(500, this.d.cine === 'cine_fin' ? 255 : 120, this.d.cine === 'cine_fin' ? 230 : 20, this.d.cine === 'cine_fin' ? 170 : 10)
      // las franjas se abren: el título respira
      const h = this.scale.height
      this.tweens.add({ targets: this.franjas[0], y: -this.alto, duration: 900, delay: 600, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: this.franjas[1], y: h, duration: 900, delay: 600, ease: 'Sine.easeInOut' })
    }
  }

  /** Una hoja suelta del kit (nieve, humo) cruza la pantalla delante de todo */
  private cruzar(): void {
    const c = (manifestDe(this)[this.d.cine] ?? {}) as Record<string, { w?: number; cuadros?: number; capas?: unknown }>
    const nombre = Object.keys(c).find((n) => c[n] && typeof c[n] === 'object' && !Array.isArray(c[n]!.capas) && typeof c[n]!.cuadros === 'number' && this.textures.exists(K.cine(this.d.cine, n)))
    if (!nombre) return
    this.cruces++
    const w = this.scale.width
    const h = this.scale.height
    const tex = K.cine(this.d.cine, nombre)
    const hw = c[nombre]!.w ?? 64
    const k = Math.max(2, Math.round(h / 140))
    const s = this.add.sprite(-hw * k * 0.5, Math.round(h * 0.5), tex, 0).setScale(k).setDepth(120).setAlpha(0.7)
    this.animar(s, tex)
    this.tweens.add({ targets: s, x: w + hw * k * 0.5, duration: 4200, ease: 'Sine.easeInOut', onComplete: () => s.destroy() })
  }

  override update(_t: number, ms: number): void {
    if (this.terminada || !this.planos.length) return
    const dt = Math.min(0.1, ms / 1000)
    this.t += dt
    const en = planoEn(this.planos, this.t)
    if (!en) {
      this.terminar()
      return
    }
    if (en.i !== this.actual) this.entrar(en.i)
    this.mover(en.i, en.k)
    const pl = this.planos[en.i]!
    const n = letrasCine(pl.texto, this.t - pl.desde)
    if (n !== this.letras) {
      this.letras = n
      this.leyenda.setText(pl.texto.slice(0, n))
    }
    // la música crece hasta el título y se apaga al final
    if (this.musica) {
      const total = duracionCine(this.planos)
      const vol = this.t > total - 1.5 ? Math.max(0, (total - this.t) / 1.5) * 0.7 : Math.min(0.7, 0.35 + (this.t / total) * 0.45)
      ;(this.musica as unknown as { volume: number }).volume = vol
    }
  }

  /** Se acabó (o la saltaron): fundido a negro y sigue */
  private terminar(yaMismo = false): void {
    if (this.terminada) return
    this.terminada = true
    const seguir = () => this.scene.start(this.d.luego.escena, this.d.luego.datos)
    if (yaMismo) {
      seguir()
      return
    }
    if (this.musica) this.tweens.add({ targets: this.musica, volume: 0, duration: 500 })
    this.cameras.main.fadeOut(700, 0, 0, 0)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, seguir)
  }
}
