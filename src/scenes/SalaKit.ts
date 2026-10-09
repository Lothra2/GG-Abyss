import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import { encolarTodo } from '../kit/cargador'
import { crearAnimFx, crearAnimsPersonaje } from '../kit/anims'
import { fuentesDe, uiImagenes } from '../kit/manifest'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto, escalaQueEntra } from '../game/Texto'
import { crearBoton } from '../game/ui/Boton'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'

/**
 * Sala del kit (?kit=1). Todo sale del manifest, nada de listas fijas:
 * personajes en 8 direcciones, fx, objetos del mundo, criaturas, partículas, audios y fuentes.
 * Sirve para que Rick vea y oiga todo el kit antes de jugar y anote lo que suene o se vea feo.
 */

interface Tile {
  sprite: Phaser.GameObjects.Sprite
  cuadros: number
  fps: number
  loop: boolean
  /** para personajes: fila de la hoja según la dirección que gira */
  celda?: number
  gira?: boolean
}

const PESTANAS = ['Personajes', 'Fx', 'Mundo', 'Audio', 'Texto'] as const

export class SalaKit extends Phaser.Scene {
  private m!: Manifest
  private pestana = 0
  private cab!: Phaser.GameObjects.Container
  private contenido!: Phaser.GameObjects.Container
  private tiles: Tile[] = []
  private altoCab = 0
  private altoContenido = 0
  private scrollY = 0
  private arrastre: { y0: number; s0: number; movido: boolean } | null = null
  private animActual = 'walk'
  private personajeSel = ''
  private sonando: Phaser.Sound.BaseSound[] = []
  private conteos = { personajes: 0, fx: 0, objetos: 0, criaturas: 0, particulas: 0, audios: 0, uis: 0, fuentes: 0 }
  private etiquetaAnim?: Phaser.GameObjects.BitmapText

  constructor() {
    super('SalaKit')
  }

  preload(): void {
    this.m = manifestDe(this)
    const avance = texto(this, 0, 0, 'Cargando todo el kit... 0%', 'fuente_ui', 2, { origen: [0.5, 0.5] })
    alCambiarEscala(this, () => avance.active && avance.setPosition(this.scale.width / 2, this.scale.height / 2))
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => avance.setText(`Cargando todo el kit... ${Math.round(v * 100)}%`))
    this.load.once(Phaser.Loader.Events.COMPLETE, () => avance.destroy())
    encolarTodo(this, this.m)
  }

  create(): void {
    const m = this.m
    for (const id of Object.keys(m.personajes)) crearAnimsPersonaje(this, m, id)
    for (const n of Object.keys(m.fx)) crearAnimFx(this, m, n)
    this.personajeSel = Object.keys(m.personajes).find((id) => m.personajes[id]!.tipo === 'heroe') ?? Object.keys(m.personajes)[0]!

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const n = Number(ev.key)
      if (n >= 1 && n <= PESTANAS.length) this.irA(n - 1)
      if (ev.key === 'Escape') this.scene.start('Titulo')
    })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < this.altoCab) return
      this.arrastre = { y0: p.y, s0: this.scrollY, movido: false }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.arrastre) return
      const dy = p.y - this.arrastre.y0
      if (Math.abs(dy) > 6) this.arrastre.movido = true
      if (this.arrastre.movido) this.scrollar(this.arrastre.s0 + dy)
    })
    this.input.on('pointerup', () => this.time.delayedCall(0, () => (this.arrastre = null)))
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollar(this.scrollY - dy))

    alCambiarEscala(this, () => this.armar())

    agregarGanchos({
      sala: () => ({ ...this.conteos, pestana: this.pestana, personajeSel: this.personajeSel, anim: this.animActual }),
      salaPestana: ((i: number) => this.irA(i)) as never,
      salaAudios: () => Object.keys(m.audio),
      salaTocarAudio: ((n: string) => this.tocarAudio(n)) as never,
      salaPersonaje: ((id: string) => this.elegirPersonaje(id)) as never,
      salaAnimsDe: ((id: string) => Object.keys(m.personajes[id]?.anims ?? {}).map((a) => this.anims.exists(K.anim(id, a, 'down')))) as never,
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      quitarGanchos('sala', 'salaPestana', 'salaAudios', 'salaTocarAudio', 'salaPersonaje', 'salaAnimsDe')
      this.detenerSonidos()
    })
  }

  /* ---------- armado ---------- */

  private irA(i: number): void {
    this.pestana = Phaser.Math.Clamp(i, 0, PESTANAS.length - 1)
    this.scrollY = 0
    this.armar()
  }

  private elegirPersonaje(id: string): void {
    if (!this.m.personajes[id]) return
    this.personajeSel = id
    if (this.pestana === 0) this.armar()
  }

  private armar(): void {
    this.cab?.destroy()
    this.contenido?.destroy()
    this.tiles = []
    const ancho = this.scale.width
    const esc = escalaDe(this.game)

    // cabecera fija
    this.cab = this.add.container(0, 0).setDepth(100)
    const titulo = texto(this, 8, 6, 'Sala del kit', 'fuente_titulo', 1)
    const tabs = PESTANAS.map((n, i) => ({ n, i }))
    const hBoton = Math.max(20, Math.ceil(48 / esc.zoom))
    const yTabs = 6 + 24
    let x = 8
    let y = yTabs
    let hFila = 0
    this.cab.add(titulo)
    for (const { n, i } of tabs) {
      const b = crearBoton(this, { x, y, h: hBoton, etiqueta: n, origen: [0, 0], alToque: () => this.irA(i) })
      if (x + b.ancho > ancho - 8 && x > 8) {
        // no entra en la fila: baja a otra
        x = 8
        y += hFila + 4
        b.setPosition(x, y)
      }
      b.setAlpha(i === this.pestana ? 1 : 0.7)
      this.cab.add(b)
      hFila = Math.max(hFila, b.alto)
      x += b.ancho + 4
    }
    this.altoCab = y + hFila + 6
    const velo = this.add.rectangle(0, 0, ancho, this.altoCab, 0x0a080c).setOrigin(0, 0)
    this.cab.addAt(velo, 0)

    this.contenido = this.add.container(0, this.altoCab)
    this.altoContenido = [this.pPersonajes, this.pFx, this.pMundo, this.pAudio, this.pTexto][this.pestana]!.call(this, ancho)
    this.scrollar(0)
  }

  private scrollar(y: number): void {
    const visible = this.scale.height - this.altoCab
    const min = Math.min(0, visible - this.altoContenido)
    this.scrollY = Phaser.Math.Clamp(y, min, 0)
    this.contenido.y = this.altoCab + this.scrollY
  }

  /** Grilla simple de elementos de tamaño fijo */
  private grilla(ancho: number, y0: number, w: number, h: number, n: number): { pos: (i: number) => [number, number]; alto: number } {
    const margen = 8
    const cols = Math.max(1, Math.floor((ancho - margen) / (w + 4)))
    const pos = (i: number): [number, number] => [margen + (i % cols) * (w + 4), y0 + Math.floor(i / cols) * (h + 4)]
    return { pos, alto: Math.ceil(n / cols) * (h + 4) }
  }

  private titulo(y: number, t: string): number {
    this.contenido.add(texto(this, 8, y, t, 'fuente_ui', 2, { tinte: 0xffd27a }))
    return y + 22
  }

  private fondoTile(x: number, y: number, w: number, h: number): void {
    this.contenido.add(this.add.nineslice(x, y, K.ui('panel_hundido'), undefined, w, h, 6, 6, 6, 6).setOrigin(0, 0))
  }

  private etiqueta(x: number, y: number, t: string, ancho: number): void {
    const e = texto(this, x + ancho / 2, y, t.replace(/_/g, ' '), 'fuente_ui', 1, { origen: [0.5, 0], ancho, alinear: 'centro' })
    this.contenido.add(e)
  }

  /* ---------- pestañas ---------- */

  private pPersonajes(ancho: number): number {
    const m = this.m
    const ids = Object.keys(m.personajes)
    this.conteos.personajes = ids.length
    let y = 8

    // selector de animación (la unión de todas las animaciones del manifest)
    const frec = new Map<string, number>()
    for (const p of Object.values(m.personajes)) for (const a of Object.keys(p.anims)) frec.set(a, (frec.get(a) ?? 0) + 1)
    const anims = [...frec.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([a]) => a)
    if (!anims.includes(this.animActual)) this.animActual = anims[0]!
    const mover = (d: number) => {
      const i = (anims.indexOf(this.animActual) + d + anims.length) % anims.length
      this.animActual = anims[i]!
      this.armar()
    }
    const bAnt = crearBoton(this, { x: 8, y, w: 28, h: 24, etiqueta: '<', origen: [0, 0], alToque: () => mover(-1) })
    this.contenido.add(bAnt)
    this.etiquetaAnim = texto(this, 8 + bAnt.ancho + 8, y + bAnt.alto / 2, `Animación: ${this.animActual}`, 'fuente_ui', 2, { origen: [0, 0.5] })
    this.contenido.add(this.etiquetaAnim)
    this.contenido.add(crearBoton(this, { x: this.etiquetaAnim.x + this.etiquetaAnim.displayWidth + 8, y, w: 28, h: 24, etiqueta: '>', origen: [0, 0], alToque: () => mover(1) }))
    y += bAnt.alto + 8

    // detalle: el personaje elegido en sus 8 direcciones con animaciones de Phaser
    const sel = m.personajes[this.personajeSel]!
    this.contenido.add(texto(this, 8, y, `${sel.nombre} (${this.personajeSel}, celda ${sel.celda}): toca otro abajo para cambiarlo`, 'fuente_ui', 1))
    y += 14
    const esc = Math.max(1, Math.min(3, Math.floor((ancho - 16) / (8 * (sel.celda + 4)))))
    const paso = sel.celda * esc + 4 * esc
    const anim = sel.anims[this.animActual] ? this.animActual : (sel.anims.idle ? 'idle' : Object.keys(sel.anims)[0]!)
    m.direcciones.forEach((dir, i) => {
      const colsFila = Math.max(1, Math.floor((ancho - 16) / paso))
      const cx = 8 + (i % colsFila) * paso
      const cy = y + Math.floor(i / colsFila) * (sel.celda * esc + 16)
      this.fondoTile(cx, cy, sel.celda * esc + 4 * esc - 2, sel.celda * esc + 14)
      const s = this.add.sprite(cx + (sel.celda * esc) / 2 + 2 * esc - 1, cy + sel.celda * esc - 2 * esc, K.pers(this.personajeSel, anim), 0)
      s.setScale(esc).setOrigin(sel.pivote[0] / sel.celda, sel.pivote[1] / sel.celda)
      s.play(K.anim(this.personajeSel, anim, dir))
      this.contenido.add(s)
      this.contenido.add(texto(this, cx + 2, cy + sel.celda * esc + 2, dir.replace('_', ' '), 'fuente_ui', 1))
    })
    const colsFila = Math.max(1, Math.floor((ancho - 16) / paso))
    y += Math.ceil(8 / colsFila) * (sel.celda * esc + 16) + 8

    // todos los personajes del manifest, girando por las 8 direcciones
    y = this.titulo(y, `Todos (${ids.length})`)
    const w = 72
    const h = 84
    const g = this.grilla(ancho, y, w, h, ids.length)
    ids.forEach((id, i) => {
      const p = m.personajes[id]!
      const [x, yy] = g.pos(i)
      this.fondoTile(x, yy, w, h)
      const an = p.anims[this.animActual] ? this.animActual : p.anims.idle ? 'idle' : Object.keys(p.anims)[0]!
      const a = p.anims[an]!
      const s = this.add.sprite(x + w / 2, yy + 62, K.pers(id, an), 0).setOrigin(p.pivote[0] / p.celda, p.pivote[1] / p.celda)
      this.contenido.add(s)
      this.tiles.push({ sprite: s, cuadros: a.cuadros, fps: a.fps, loop: a.loop, celda: p.celda, gira: true })
      this.etiqueta(x, yy + 66, id, w)
      const zona = this.add.zone(x, yy, w, h).setOrigin(0, 0).setInteractive()
      zona.on('pointerup', () => { if (!this.arrastre?.movido) this.elegirPersonaje(id) })
      this.contenido.add(zona)
    })
    return y + g.alto + 16
  }

  private pFx(ancho: number): number {
    const nombres = Object.keys(this.m.fx)
    this.conteos.fx = nombres.length
    let y = this.titulo(8, `Fx (${nombres.length})`)
    const w = 72
    const h = 76
    const g = this.grilla(ancho, y, w, h, nombres.length)
    nombres.forEach((n, i) => {
      const f = this.m.fx[n]!
      const [x, yy] = g.pos(i)
      this.fondoTile(x, yy, w, h)
      const s = this.add.sprite(x + w / 2, yy + 26, K.fx(n), 0)
      this.contenido.add(s)
      this.tiles.push({ sprite: s, cuadros: f.cuadros, fps: f.fps, loop: f.loop })
      this.etiqueta(x, yy + 52, n, w)
    })
    y += g.alto
    return y + 16
  }

  private pMundo(ancho: number): number {
    const mu = this.m.mundo
    let y = 8
    const seccion = (nombre: string, items: { id: string; key: string; w: number; h: number; ax: number; ay: number; cuadros: number; fps: number; loop: boolean }[]) => {
      y = this.titulo(y, `${nombre} (${items.length})`)
      const w = 88
      const h = 104
      const g = this.grilla(ancho, y, w, h, items.length)
      items.forEach((it, i) => {
        const [x, yy] = g.pos(i)
        this.fondoTile(x, yy, w, h)
        const reduc = Math.max(1, Math.ceil(Math.max(it.w, it.h) / 72))
        const s = this.add.sprite(x + w / 2, yy + 80, it.key, 0).setOrigin(it.ax / it.w, it.ay / it.h).setScale(1 / reduc)
        this.contenido.add(s)
        this.tiles.push({ sprite: s, cuadros: it.cuadros, fps: it.fps, loop: it.loop })
        this.etiqueta(x, yy + 82, it.id, w)
      })
      y += g.alto + 8
    }
    const pref = (anims: Record<string, { cuadros: number; fps: number; loop: boolean }>) => (anims.idle ? 'idle' : anims.girar ? 'girar' : anims.flotar ? 'flotar' : Object.keys(anims)[0]!)
    const objetos = Object.entries(mu.objetos).map(([id, o]) => {
      const an = pref(o.anims)
      const a = o.anims[an]!
      return { id, key: K.obj(id, an), w: o.w, h: o.h, ax: o.apoyo[0], ay: o.apoyo[1], cuadros: a.cuadros, fps: a.fps, loop: a.loop }
    })
    const criaturas = Object.entries(mu.criaturas).map(([id, c]) => {
      const an = pref(c.anims)
      const a = c.anims[an]!
      return { id, key: K.cri(id, an), w: c.w, h: c.h, ax: c.w / 2, ay: c.h, cuadros: a.cuadros, fps: a.fps, loop: true }
    })
    const particulas = Object.entries(mu.particulas).map(([id, p]) => ({ id, key: K.par(id), w: p.w, h: p.h, ax: p.w / 2, ay: p.h, cuadros: p.cuadros, fps: p.fps, loop: true }))
    this.conteos.objetos = objetos.length
    this.conteos.criaturas = criaturas.length
    this.conteos.particulas = particulas.length
    seccion('Objetos del mundo', objetos)
    seccion('Criaturas', criaturas)
    seccion('Partículas', particulas)
    return y + 8
  }

  private pAudio(ancho: number): number {
    const nombres = Object.keys(this.m.audio)
    this.conteos.audios = nombres.length
    let y = this.titulo(8, `Audio (${nombres.length}). Toca para oír`)
    const bStop = crearBoton(this, { x: 8, y, w: 120, h: 24, etiqueta: 'Detener todo', origen: [0, 0], alToque: () => this.detenerSonidos() })
    this.contenido.add(bStop)
    y += bStop.alto + 8
    const w = 148
    const h = 26
    const g = this.grilla(ancho, y, w, h, nombres.length)
    nombres.forEach((n, i) => {
      const [x, yy] = g.pos(i)
      const dur = this.cache.audio.exists(K.aud(n)) ? (this.cache.audio.get(K.aud(n)) as AudioBuffer | undefined)?.duration : undefined
      const rotulo = `${n} ${dur ? dur.toFixed(1) + 's' : ''}`
      const b = crearBoton(this, { x, y: yy, w, h, etiqueta: rotulo.length > 24 ? rotulo.slice(0, 24) : rotulo, origen: [0, 0], alToque: () => { if (!this.arrastre?.movido) this.tocarAudio(n) } })
      this.contenido.add(b)
    })
    return y + g.alto + 16
  }

  private pTexto(ancho: number): number {
    const m = this.m
    const muestra = '¡Ñandú, Thor! ¿Qué pasó? áéíóú'
    let y = this.titulo(8, 'Fuentes del kit')
    const fuentes = Object.keys(fuentesDe(m)) as ('fuente_ui' | 'fuente_titulo' | 'fuente_titulo_plata')[]
    this.conteos.fuentes = fuentes.length
    for (const f of fuentes) {
      this.contenido.add(texto(this, 8, y, f, 'fuente_ui', 1, { tinte: 0x9a9caa }))
      y += 12
      const base = f === 'fuente_ui' ? 2 : 1
      const t = texto(this, 8, y, muestra, f, escalaQueEntra(muestra.length * (f === 'fuente_ui' ? 5 : 9), ancho - 16, base + 1))
      this.contenido.add(t)
      y += t.height * t.scaleY + 10
    }
    const uis = Object.entries(uiImagenes(m))
    this.conteos.uis = uis.length
    y = this.titulo(y + 6, `Interfaz (${uis.length})`)
    const w = 96
    const h = 80
    const g = this.grilla(ancho, y, w, h, uis.length)
    uis.forEach(([n, u], i) => {
      const [x, yy] = g.pos(i)
      this.fondoTile(x, yy, w, h)
      const key = K.ui(n)
      const frames = this.textures.get(key).frameTotal - 1
      const reduc = Math.max(1, Math.ceil(Math.max(u.w, u.h) / 56))
      let obj: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice | Phaser.GameObjects.Sprite
      if (u.nueve) obj = this.add.nineslice(x + w / 2, yy + 30, key, 0, Math.max(u.w, 24) * 1, Math.max(u.h, 12), ...u.nueve)
      else obj = this.add.image(x + w / 2, yy + 30, key, 0)
      obj.setScale(1 / reduc)
      this.contenido.add(obj)
      if (frames > 1 && !u.nueve) {
        const s = obj as Phaser.GameObjects.Image
        this.tiles.push({ sprite: s as unknown as Phaser.GameObjects.Sprite, cuadros: Math.min(frames, 12), fps: 6, loop: true })
      }
      this.etiqueta(x, yy + 58, n, w)
    })
    return y + g.alto + 16
  }

  /* ---------- audio ---------- */

  private tocarAudio(nombre: string): void {
    const key = K.aud(nombre)
    if (!this.cache.audio.exists(key)) return
    const larga = nombre.startsWith('musica_') || nombre.startsWith('ambiente_')
    if (larga) this.detenerSonidos()
    const s = this.sound.add(key, { loop: larga, volume: larga ? 0.7 : 0.9 })
    s.play()
    this.sonando.push(s)
  }

  private detenerSonidos(): void {
    for (const s of this.sonando) { s.stop(); s.destroy() }
    this.sonando = []
  }

  /* ---------- animación manual de las muestras ---------- */

  override update(tiempo: number): void {
    const t = tiempo / 1000
    const dirIdx = Math.floor(t / 1.2) % 8
    for (const tl of this.tiles) {
      if (!tl.sprite.active) continue
      const { cuadros, fps } = tl
      let f: number
      if (tl.loop) f = Math.floor(t * fps) % cuadros
      else {
        const ciclo = cuadros / fps + 0.7
        f = Math.min(cuadros - 1, Math.floor((t % ciclo) * fps))
      }
      if (tl.gira) f += dirIdx * cuadros
      tl.sprite.setFrame(f)
    }
  }
}
