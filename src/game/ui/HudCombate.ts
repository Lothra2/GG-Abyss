import Phaser from 'phaser'
import { K } from '../../kit/claves'
import { JEFE, MODO_PEQUE } from '../../config/balance'
import { HUD as MARGENES } from '../../config/juego'
import { escalaDe, toqueMinimo } from '../Pantalla'
import { texto } from '../Texto'
import { Bloqueo } from './Bloqueo'
import type { Mundo } from '../../scenes/Mundo'

interface BotonHab {
  i: 0 | 1
  fondo: Phaser.GameObjects.Image
  icono: Phaser.GameObjects.Image
  arco: Phaser.GameObjects.Graphics
  tecla: Phaser.GameObjects.BitmapText
  zona: Phaser.GameObjects.Zone
  x: number
  y: number
  lado: number
  id: string
}

const LADO_ORBE = 72
const ANCHO_CINTURON = 154
const ALTO_CINTURON = 44
const SLOT = { x0: 23, paso: 36, y: 23 }

/**
 * La parte de combate del HUD (PLAN.md F2, tarea 5): orbe de vida a la izquierda, orbe de maná a la derecha, barra de XP,
 * cinturón al centro y los dos botones de habilidad con su recarga (un arco oscuro). Todo pegado al borde de abajo.
 */
export class HudCombate {
  private orbeVida: Phaser.GameObjects.Image
  private orbeMana: Phaser.GameObjects.Image
  private olaVida: Phaser.GameObjects.Sprite
  private olaMana: Phaser.GameObjects.Sprite
  private cinturon: Phaser.GameObjects.Image
  private slots: { icono: Phaser.GameObjects.Image | null; zona: Phaser.GameObjects.Zone; id: string | null }[] = []
  private marcoXp: Phaser.GameObjects.NineSlice
  private rellenoXp: Phaser.GameObjects.NineSlice
  private txtNivel: Phaser.GameObjects.BitmapText
  private botones: BotonHab[] = []
  private numVida: Phaser.GameObjects.BitmapText
  private numMana: Phaser.GameObjects.BitmapText
  private flashMana = 0
  private marcoJefe: Phaser.GameObjects.NineSlice
  private rellenoJefe: Phaser.GameObjects.NineSlice
  private nombreJefe: Phaser.GameObjects.BitmapText
  private anchoJefe = 240
  /** el rastro claro que queda atrás del daño y se achica después */
  private rastroJefe: Phaser.GameObjects.NineSlice
  private muescaJefe: Phaser.GameObjects.Rectangle
  private vidaVista = 1
  private rastro = 1
  private rastroEspera = 0
  private llenado = 0
  private temblor = 0
  private jefeVisto = false
  private atenuado = 1
  private xpAncho = ANCHO_CINTURON
  /** las piezas, por si las pruebas quieren saber dónde cayeron */
  readonly piezas: Record<string, Phaser.GameObjects.GameObject> = {}

  constructor(
    private escena: Phaser.Scene,
    private mundo: Mundo,
    private atlasIconos: string,
  ) {
    const k = (n: string) => K.ui(n)
    this.orbeVida = escena.add.image(0, 0, k('orbe_vida'), 10).setOrigin(0, 1)
    this.orbeMana = escena.add.image(0, 0, k('orbe_mana'), 10).setOrigin(0, 1)
    this.olaVida = escena.add.sprite(0, 0, k('orbe_vida_ola'), 0).setOrigin(0, 1).setVisible(false)
    this.olaMana = escena.add.sprite(0, 0, k('orbe_mana_ola'), 0).setOrigin(0, 1).setVisible(false)
    // una ola por nivel: el cuadro (N - 1) * 4 + t es el nivel N (1 a 9) en el paso t
    for (const n of ['orbe_vida_ola', 'orbe_mana_ola']) {
      for (let nivel = 1; nivel <= 9; nivel++) {
        const key = `${n}_${nivel}`
        if (!escena.anims.exists(key)) escena.anims.create({ key, frames: escena.anims.generateFrameNumbers(k(n), { start: (nivel - 1) * 4, end: (nivel - 1) * 4 + 3 }), frameRate: 6, repeat: -1 })
      }
    }
    this.numVida = texto(escena, 0, 0, '', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xffe9e9 })
    this.numMana = texto(escena, 0, 0, '', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xe0ecff })
    this.cinturon = escena.add.image(0, 0, k('cinturon')).setOrigin(0, 1)
    for (let i = 0; i < 4; i++) {
      const zona = escena.add.zone(0, 0, 34, 40).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true })
      zona.on('pointerdown', (p: Phaser.Input.Pointer) => {
        Bloqueo.tomar(p.id)
        this.mundo.combate.pocion(i)
      })
      this.slots.push({ icono: null, zona, id: null })
    }
    this.marcoXp = escena.add.nineslice(0, 0, k('barra_marco'), undefined, ANCHO_CINTURON, 12, 6, 6, 6, 6).setOrigin(0, 1)
    this.rellenoXp = escena.add.nineslice(0, 0, k('barra_xp'), undefined, 1, 4, 1, 1, 1, 1).setOrigin(0, 0.5).setTint(0x6ab8ff)
    this.txtNivel = texto(escena, 0, 0, 'Nv 1', 'fuente_ui', 1, { origen: [1, 0.5], tinte: 0xffd27a })

    // la barra del jefe: arriba al centro, solo mientras dura la pelea
    this.marcoJefe = escena.add.nineslice(0, 0, k('barra_marco'), undefined, 240, 14, 6, 6, 6, 6).setOrigin(0.5, 0).setVisible(false)
    this.rastroJefe = escena.add.nineslice(0, 0, k('barra_jefe'), undefined, 10, 10, 1, 1, 2, 2).setOrigin(0, 0).setTint(0xffe6b0).setVisible(false)
    this.rellenoJefe = escena.add.nineslice(0, 0, k('barra_jefe'), undefined, 10, 10, 1, 1, 2, 2).setOrigin(0, 0).setVisible(false)
    // la marca donde se enoja (fase 2): una línea fina dorada
    this.muescaJefe = escena.add.rectangle(0, 0, 1, 10, 0xffd27a, 0.9).setOrigin(0.5, 0).setVisible(false)
    this.nombreJefe = texto(escena, 0, 0, 'Minotauro del Bosque', 'fuente_ui', 1, { origen: [0.5, 1], tinte: 0xffd27a }).setVisible(false)

    const ids = this.mundo.combate.habilidades
    for (const i of [0, 1] as const) {
      const id = ids[i].id
      const fondo = escena.add.image(0, 0, k('boton'), 0).setVisible(false)
      const icono = escena.add.image(0, 0, escena.textures.exists(k(`hab_${id}`)) ? k(`hab_${id}`) : k('icono_ajustes'))
      const arco = escena.add.graphics()
      const tecla = texto(escena, 0, 0, i === 0 ? 'Q' : 'E', 'fuente_ui', 1, { origen: [0, 0], tinte: 0xffd27a })
      const zona = escena.add.zone(0, 0, 40, 40).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true })
      zona.on('pointerdown', (p: Phaser.Input.Pointer) => {
        Bloqueo.tomar(p.id)
        this.mundo.combate.presionarHabilidad(i)
      })
      const soltar = () => this.mundo.combate.soltarHabilidad(i)
      zona.on('pointerup', soltar)
      zona.on('pointerout', soltar)
      this.botones.push({ i, fondo, icono, arco, tecla, zona, x: 0, y: 0, lado: 40, id })
    }
    escena.game.events.on('sin-mana', this.alSinMana, this)
    escena.events.once(Phaser.Scenes.Events.SHUTDOWN, () => escena.game.events.off('sin-mana', this.alSinMana, this))
  }

  private alSinMana(): void {
    this.flashMana = 0.5
  }

  /** Todo pegado al borde de abajo. Los botones crecen un cuarto en modo peque. */
  acomodar(): void {
    const w = this.escena.scale.width
    const h = this.escena.scale.height
    const mg = MARGENES.MARGEN
    const e = escalaDe(this.escena.game)
    const peque = this.mundo.combate.modoPeque
    const base = h - mg

    this.orbeVida.setPosition(mg, base)
    this.olaVida.setPosition(mg, base)
    this.orbeMana.setPosition(w - mg - LADO_ORBE, base)
    this.olaMana.setPosition(w - mg - LADO_ORBE, base)
    this.numVida.setPosition(mg + LADO_ORBE / 2, base - LADO_ORBE / 2)
    this.numMana.setPosition(w - mg - LADO_ORBE / 2, base - LADO_ORBE / 2)

    const cx = Math.round(w / 2 - ANCHO_CINTURON / 2)
    this.cinturon.setPosition(cx, base)
    this.slots.forEach((s, i) => {
      const sx = cx + SLOT.x0 + i * SLOT.paso
      const sy = base - ALTO_CINTURON + SLOT.y
      s.zona.setPosition(sx, sy)
      s.icono?.setPosition(sx, sy)
    })
    const yXp = base - ALTO_CINTURON - 3
    this.xpAncho = ANCHO_CINTURON
    this.marcoXp.setPosition(cx, yXp).setSize(ANCHO_CINTURON, 12)
    this.rellenoXp.setPosition(cx + 3, yXp - 6)
    this.txtNivel.setScale(e.zoom >= 3 ? 1 : 2).setPosition(cx - 6, yXp - 6)

    this.anchoJefe = Math.min(320, Math.max(120, w - 2 * 150))
    const esc = e.zoom >= 3 ? 1 : 2
    this.nombreJefe.setScale(esc)
    const yBarra = mg + 6 + this.nombreJefe.displayHeight
    this.marcoJefe.setPosition(Math.round(w / 2), yBarra).setSize(this.anchoJefe, 18)
    this.rellenoJefe.setPosition(Math.round(w / 2 - this.anchoJefe / 2 + 4), yBarra + 4)
    this.rastroJefe.setPosition(this.rellenoJefe.x, this.rellenoJefe.y)
    this.muescaJefe.setPosition(Math.round(this.rellenoJefe.x + (this.anchoJefe - 8) * (JEFE.fase2Pct / 100)), yBarra + 4)
    this.nombreJefe.setPosition(Math.round(w / 2), yBarra - 2)

    // botones de habilidad: a la izquierda del orbe de maná, con la separación y el área táctil que pide el modo
    const mult = peque ? MODO_PEQUE.botones : 1
    const min = toqueMinimo(e, peque)
    const lado = Math.ceil(Math.max(40, min) * mult)
    const sep = peque ? 10 : 6
    this.botones.forEach((b, n) => {
      b.lado = lado
      b.x = Math.round(w - mg - LADO_ORBE - 8 - lado / 2 - (1 - n) * 0 - n * (lado + sep) - 0)
      b.y = Math.round(base - lado / 2 - 2)
      b.icono.setPosition(b.x, b.y)
      b.zona.setPosition(b.x, b.y).setSize(lado, lado)
      b.tecla.setScale(1).setPosition(b.x - lado / 2 + 2, b.y - lado / 2 + 1)
    })
    // el primero queda más a la izquierda: se invierte el orden de n
    const [b0, b1] = this.botones as [BotonHab, BotonHab]
    const xs = [b0.x, b1.x].sort((a, c) => a - c)
    b0.x = xs[0]!
    b1.x = xs[1]!
    for (const b of this.botones) {
      b.icono.setPosition(b.x, b.y)
      b.zona.setPosition(b.x, b.y)
      b.tecla.setPosition(b.x - b.lado / 2 + 2, b.y - b.lado / 2 + 1)
    }
  }

  /** Áreas táctiles y posiciones para las pruebas */
  layout() {
    return {
      orbeVida: this.orbeVida.getBounds(),
      orbeMana: this.orbeMana.getBounds(),
      cinturon: this.cinturon.getBounds(),
      xp: this.marcoXp.getBounds(),
      jefe: { visible: this.marcoJefe.visible, marco: this.marcoJefe.getBounds(), relleno: this.rellenoJefe.getBounds(), rastro: this.rastroJefe.visible ? this.rastroJefe.getBounds() : null, llenado: Math.round(this.llenado * 100) / 100 },
      botones: this.botones.map((b) => ({ id: b.id, x: b.x, y: b.y, lado: b.lado })),
    }
  }

  update(dt: number): void {
    const c = this.mundo.combate
    const p = this.mundo.partida
    const fv = Phaser.Math.Clamp(p.vida / c.stats.vidaMax, 0, 1)
    const fm = Phaser.Math.Clamp(p.mana / c.stats.manaMax, 0, 1)
    this.pintarOrbe(this.orbeVida, this.olaVida, fv)
    this.pintarOrbe(this.orbeMana, this.olaMana, fm)
    this.numVida.setText(String(Math.ceil(p.vida)))
    this.numMana.setText(String(Math.floor(p.mana)))
    this.flashMana = Math.max(0, this.flashMana - dt)
    for (const o of [this.orbeMana, this.olaMana]) {
      if (this.flashMana > 0) o.setTint(0xff7070)
      else o.clearTint()
    }

    // barra del jefe
    const j = this.mundo.jefe
    const verJefe = !!j && j.peleando && j.vivo
    this.pintarBarraJefe(dt, verJefe)

    // XP y nivel
    const ancho = Math.max(1, Math.round((this.xpAncho - 6) * c.fraccionXp))
    this.rellenoXp.setSize(ancho, 4)
    this.txtNivel.setText(`Nv ${p.nivel}`)

    // cinturón: los íconos de las pociones que haya
    for (let i = 0; i < 4; i++) {
      const id = p.cinturon[i] ?? null
      const s = this.slots[i]!
      if (s.id === id) continue
      s.id = id
      s.icono?.destroy()
      s.icono = null
      if (id && this.escena.textures.exists(this.atlasIconos)) {
        const cx = Math.round(this.escena.scale.width / 2 - ANCHO_CINTURON / 2)
        const sx = cx + SLOT.x0 + i * SLOT.paso
        const sy = this.escena.scale.height - MARGENES.MARGEN - ALTO_CINTURON + SLOT.y
        s.icono = this.escena.add.image(sx, sy, this.atlasIconos, id)
      }
    }

    // botones: el arco oscuro es lo que falta de recarga, y se apagan si no alcanza el maná
    for (const b of this.botones) {
      const fr = c.recargas.fraccion(b.i)
      b.arco.clear()
      const r = b.lado / 2
      if (fr > 0) {
        b.arco.fillStyle(0x000000, 0.62)
        b.arco.slice(b.x, b.y, r, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * fr), false)
        b.arco.fillPath()
      }
      const hab = c.habilidades[b.i]
      const sinMana = p.mana + 1e-6 < hab.mana
      b.icono.setAlpha((sinMana && fr === 0 ? 0.55 : 1) * this.atenuado)
      b.arco.setDepth(b.icono.depth + 1)
      b.tecla.setDepth(b.icono.depth + 2)
    }
  }

  private pintarOrbe(img: Phaser.GameObjects.Image, ola: Phaser.GameObjects.Sprite, f: number): void {
    // vacío solo en 0 y lleno solo en 100 %: con 1 punto de vida todavía se ve un poquito de líquido
    const n = f <= 0 ? 0 : f >= 1 ? 10 : Phaser.Math.Clamp(Math.round(f * 10), 1, 9)
    // con líquido y aire la superficie siempre se mueve, cada nivel con su propia ola
    const usaOla = n >= 1 && n <= 9
    ola.setVisible(usaOla)
    img.setVisible(!usaOla)
    if (!usaOla) {
      img.setFrame(n)
      return
    }
    const key = `${ola === this.olaVida ? 'orbe_vida_ola' : 'orbe_mana_ola'}_${n}`
    // al cambiar de nivel sigue en el mismo paso de la ola, así no salta
    if (ola.anims.currentAnim?.key !== key) ola.play({ key, startFrame: ola.anims.currentFrame ? ola.anims.currentFrame.index - 1 : 0 })
  }

  /** El nivel que muestra cada orbe (0 a 10), para las pruebas */
  niveles() {
    const de = (img: Phaser.GameObjects.Image, ola: Phaser.GameObjects.Sprite) =>
      ola.visible ? Number(ola.anims.currentAnim?.key.split('_').pop()) : Number(img.frame.name)
    return { vida: de(this.orbeVida, this.olaVida), mana: de(this.orbeMana, this.olaMana) }
  }

  /** El HUD de combate se aparta durante el cine del jefe (1 = normal, 0 = invisible) */
  atenuar(a: number): void {
    if (a === this.atenuado) return
    this.atenuado = a
    const objs: { setAlpha(v: number): unknown }[] = [this.orbeVida, this.orbeMana, this.olaVida, this.olaMana, this.numVida, this.numMana, this.cinturon, this.marcoXp, this.rellenoXp, this.txtNivel]
    for (const s of this.slots) if (s.icono) objs.push(s.icono)
    for (const b of this.botones) objs.push(b.icono, b.arco, b.tecla, b.fondo)
    for (const o of objs) o.setAlpha(a)
  }

  /**
   * La barra del jefe: se llena al empezar, el daño deja un rastro claro que se achica después, tiembla con los
   * golpes grandes, tiene una marca donde se enoja y en la fase 2 se pone más roja.
   */
  private pintarBarraJefe(dt: number, verPelea: boolean): void {
    const j = this.mundo.jefe
    // durante la entrada la barra espera: aparece y se llena cuando él ya rugió
    const ver = verPelea && this.mundo.planoJefe.momento !== 'intro'
    for (const o of [this.marcoJefe, this.rastroJefe, this.rellenoJefe, this.nombreJefe]) o.setVisible(ver)
    if (!ver || !j) {
      this.jefeVisto = false
      this.muescaJefe.setVisible(false)
      return
    }
    const f = Phaser.Math.Clamp(j.vida / j.vidaMax, 0, 1)
    if (!this.jefeVisto) {
      // recién empieza: la barra se llena desde cero
      this.jefeVisto = true
      this.llenado = 0
      this.vidaVista = f
      this.rastro = f
    }
    this.llenado = Math.min(1, this.llenado + dt / 0.9)
    if (f < this.vidaVista - 0.001) {
      if (this.vidaVista - f > 0.02) this.temblor = 0.18
      this.rastroEspera = 0.45
      this.rellenoJefe.setTintFill(0xffffff)
      this.escena.time.delayedCall(60, () => this.rellenoJefe.active && this.pintarTonoJefe())
    }
    this.vidaVista = f
    this.rastroEspera = Math.max(0, this.rastroEspera - dt)
    if (this.rastroEspera <= 0) this.rastro = Math.max(f, this.rastro - dt * 0.6)
    if (this.rastro < f) this.rastro = f
    const ancho = this.anchoJefe - 8
    const lleno = Phaser.Math.Easing.Cubic.Out(this.llenado)
    this.rellenoJefe.setSize(Math.max(1, Math.round(ancho * f * lleno)), 10)
    this.rastroJefe.setSize(Math.max(1, Math.round(ancho * this.rastro * lleno)), 10).setVisible(this.rastro > f + 0.002)
    this.muescaJefe.setVisible(j.fase < 2)
    this.temblor = Math.max(0, this.temblor - dt)
    const dx = this.temblor > 0 ? Math.round(Math.sin(this.temblor * 90) * 2) : 0
    const w = this.escena.scale.width
    this.marcoJefe.x = Math.round(w / 2) + dx
    this.rellenoJefe.x = Math.round(w / 2 - this.anchoJefe / 2 + 4) + dx
    this.rastroJefe.x = this.rellenoJefe.x
    if (this.temblor <= 0) this.pintarTonoJefe()
  }

  private pintarTonoJefe(): void {
    const j = this.mundo.jefe
    const enojado = !!j && j.fase >= 2
    this.rellenoJefe.clearTint()
    if (enojado) this.rellenoJefe.setTint(0xff9a5a)
    this.nombreJefe.setTint(enojado ? 0xff8a6a : 0xffd27a)
  }

  destruir(): void {
    this.escena.game.events.off('sin-mana', this.alSinMana, this)
  }
}
