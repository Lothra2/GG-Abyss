import Phaser from 'phaser'
import { K } from '../../kit/claves'
import type { MapaJuego } from '../../kit/mapa'
import { escalaDe } from '../Pantalla'
import { texto } from '../Texto'
import { Bloqueo } from './Bloqueo'
import { aMinimapa, type Niebla } from '../../logic/niebla'
import { COLOR_MAPA, HUD as MARGENES } from '../../config/juego'

export type MarcaMapa = { tipo: 'fogata' | 'mercader' | 'jefe' | 'portal'; x: number; y: number }

export interface FuenteMinimapa {
  mapa: MapaJuego
  niebla: Niebla
  /** sube cada vez que se descubre algo */
  version: () => number
  heroe: () => { x: number; y: number }
  marcas: () => MarcaMapa[]
}

/** cuántos cuadros del mundo muestra el minimapa chico */
const VISTA_CUADROS = { w: 40, h: 30 }
const ICONO: Record<MarcaMapa['tipo'], string> = { fogata: 'icono_guardado', mercader: 'icono_oro', jefe: 'icono_calavera', portal: 'icono_zona' }
const COLOR_MARCA: Record<MarcaMapa['tipo'], number> = { fogata: 0xffb050, mercader: 0xffe070, jefe: 0xff5a4a, portal: 0x8ac8ff }

/**
 * Minimapa (PLAN.md F9, 1): arriba a la derecha, al lado de la pausa. Muestra lo que ya se descubrió alrededor de la
 * heroína, con puntos para la fogata, el mercader, el jefe y el portal. Tocarlo lo agranda a todo el mapa con los
 * íconos del kit, y tocar otra vez lo cierra. El dibujo es una textura técnica: un pixel por cuadro del mapa,
 * del color de lo que hay (pasto, tierra, piedra, agua, muro). No es arte, es un plano.
 */
export class Minimapa {
  private tex: Phaser.Textures.CanvasTexture
  private img: Phaser.GameObjects.Image
  private marco: Phaser.GameObjects.NineSlice
  private puntos: Phaser.GameObjects.Graphics
  private zona: Phaser.GameObjects.Zone
  private versionDibujada = -1
  private esc = 1
  private x = 0
  private y = 0
  private t = 0
  // el grande
  private grande: Phaser.GameObjects.Container | null = null
  private abierto = false

  constructor(
    private escena: Phaser.Scene,
    private f: FuenteMinimapa,
    clave: string,
  ) {
    const m = f.mapa
    if (escena.textures.exists(clave)) escena.textures.remove(clave)
    this.tex = escena.textures.createCanvas(clave, m.ancho, m.alto)!
    this.marco = escena.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 32, 32, 6, 6, 6, 6).setOrigin(0, 0)
    this.img = escena.add.image(0, 0, clave).setOrigin(0, 0)
    this.puntos = escena.add.graphics()
    Bloqueo.instalar(escena)
    this.zona = escena.add.zone(0, 0, 32, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true })
    this.zona.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.zona.on('pointerup', () => this.alternar())
  }

  /** Tamaño en pantalla del chico (ancho x alto), para que el HUD acomode lo de alrededor */
  get tamano(): { w: number; h: number } {
    return { w: VISTA_CUADROS.w * this.esc + 6, h: VISTA_CUADROS.h * this.esc + 6 }
  }

  /** `derecha` es el borde derecho donde termina (a la izquierda de los botones) */
  acomodar(derecha: number, arriba: number): void {
    // pixeles lógicos por cuadro del mapa: en la tablet (zoom alto) 2, en la compu 3
    this.esc = escalaDe(this.escena.game).zoom >= 3 ? 2 : 3
    const { w, h } = this.tamano
    this.x = Math.round(derecha - w)
    this.y = Math.round(arriba)
    this.marco.setPosition(this.x, this.y).setSize(w, h)
    this.zona.setPosition(this.x, this.y).setSize(w, h)
    this.zona.input?.hitArea.setTo(0, 0, w, h)
    if (this.abierto) this.armarGrande()
  }

  private dibujar(): void {
    const m = this.f.mapa
    const n = this.f.niebla
    const ctx = this.tex.getContext()
    const datos = ctx.createImageData(m.ancho, m.alto)
    const d = datos.data
    const c = m.cuadro
    for (let ty = 0; ty < m.alto; ty++) {
      for (let tx = 0; tx < m.ancho; tx++) {
        const i = ty * m.ancho + tx
        const o = i * 4
        if (!n.vistoEn(tx * c + c / 2, ty * c + c / 2)) {
          d[o + 3] = 0
          continue
        }
        let col: number
        if (m.agua[i]) col = COLOR_MAPA.agua
        else if (m.colision[i]) {
          // los muros que tocan piso se ven un poco más claros: así se lee la forma del lugar
          const borde = [i - 1, i + 1, i - m.ancho, i + m.ancho].some((j) => j >= 0 && j < m.colision.length && !m.colision[j])
          col = borde ? COLOR_MAPA.borde : COLOR_MAPA.muro
        } else col = COLOR_MAPA.suelo[m.superficie[i] ?? 0] ?? COLOR_MAPA.suelo[0]!
        d[o] = (col >> 16) & 255
        d[o + 1] = (col >> 8) & 255
        d[o + 2] = col & 255
        d[o + 3] = 255
      }
    }
    ctx.putImageData(datos, 0, 0)
    this.tex.refresh()
    this.versionDibujada = this.f.version()
  }

  update(dt: number): void {
    this.t += dt
    if (this.versionDibujada !== this.f.version()) this.dibujar()
    const m = this.f.mapa
    const c = m.cuadro
    const h = this.f.heroe()
    const e = this.esc
    // la vista del chico, centrada en la heroína y sin salirse del mapa
    const vw = Math.min(VISTA_CUADROS.w, m.ancho)
    const vh = Math.min(VISTA_CUADROS.h, m.alto)
    const cx = Phaser.Math.Clamp(Math.round(h.x / c - vw / 2), 0, m.ancho - vw)
    const cy = Phaser.Math.Clamp(Math.round(h.y / c - vh / 2), 0, m.alto - vh)
    const ox = this.x + 3
    const oy = this.y + 3
    this.img.setScale(e).setCrop(cx, cy, vw, vh).setPosition(ox - cx * e, oy - cy * e)

    const vista = { x: cx * c, y: cy * c, w: vw * c, h: vh * c }
    const g = this.puntos.clear()
    for (const mk of this.f.marcas()) {
      if (!this.f.niebla.vistoEn(mk.x, mk.y)) continue
      const p = aMinimapa(mk.x, mk.y, vista, vw * e, vh * e)
      if (!p.dentro) continue
      g.fillStyle(0x000000, 0.8).fillRect(ox + p.x - 2, oy + p.y - 2, 2 + e * 2, 2 + e * 2)
      g.fillStyle(COLOR_MARCA[mk.tipo], 1).fillRect(ox + p.x - 1, oy + p.y - 1, e * 2, e * 2)
    }
    // la heroína late para que se encuentre de un vistazo
    const ph = aMinimapa(h.x, h.y, vista, vw * e, vh * e)
    const lado = e * 2 + (Math.sin(this.t * 6) > 0 ? e : 0)
    g.fillStyle(0x000000, 0.9).fillRect(ox + ph.x - lado / 2 - 1, oy + ph.y - lado / 2 - 1, lado + 2, lado + 2)
    g.fillStyle(0xffffff, 1).fillRect(ox + ph.x - lado / 2, oy + ph.y - lado / 2, lado, lado)
  }

  private alternar(): void {
    this.abierto = !this.abierto
    if (this.abierto) this.armarGrande()
    else this.cerrarGrande()
  }

  get info(): { abierto: boolean; avance: number; caja: { x: number; y: number; w: number; h: number } } {
    const { w, h } = this.tamano
    return { abierto: this.abierto, avance: Math.round(this.f.niebla.avance * 1000) / 1000, caja: { x: this.x, y: this.y, w, h } }
  }

  /** El mapa entero a escala entera, con los íconos del kit y el nombre de cada cosa */
  private armarGrande(): void {
    this.cerrarGrande(false)
    const e = this.escena
    const W = e.scale.width
    const H = e.scale.height
    const m = this.f.mapa
    const k = Math.max(1, Math.floor(Math.min((W * 0.86) / m.ancho, (H * 0.78) / m.alto)))
    const mw = m.ancho * k
    const mh = m.alto * k
    const x0 = Math.round((W - mw) / 2)
    const y0 = Math.round((H - mh) / 2) + 6
    const c = e.add.container(0, 0).setDepth(800)
    const velo = e.add.rectangle(0, 0, W, H, 0x02040a, 0.82).setOrigin(0, 0)
    const marco = e.add.nineslice(x0 - 8, y0 - 8, K.ui('panel'), undefined, mw + 16, mh + 16, 12, 12, 12, 12).setOrigin(0, 0)
    const img = e.add.image(x0, y0, this.tex.key).setOrigin(0, 0).setScale(k)
    c.add([velo, marco, img])
    const esc = escalaDe(e.game).zoom >= 3 ? 1 : 2
    const titulo = texto(e, W / 2, Math.max(MARGENES.MARGEN, y0 - 12 - 10 * esc), 'Mapa', 'fuente_titulo', esc, { origen: [0.5, 1] })
    c.add(titulo)
    const vista = { x: 0, y: 0, w: m.ancho * m.cuadro, h: m.alto * m.cuadro }
    for (const mk of this.f.marcas()) {
      if (!this.f.niebla.vistoEn(mk.x, mk.y)) continue
      const p = aMinimapa(mk.x, mk.y, vista, mw, mh)
      // el mercader está pegado a la fogata: su moneda va un poco al lado para que se vean los dos
      const dx = mk.tipo === 'mercader' ? 14 : mk.tipo === 'fogata' ? -6 : 0
      if (e.textures.exists(K.ui(ICONO[mk.tipo]))) c.add(e.add.image(x0 + p.x + dx, y0 + p.y, K.ui(ICONO[mk.tipo])).setOrigin(0.5, 0.8))
    }
    const h = this.f.heroe()
    const ph = aMinimapa(h.x, h.y, vista, mw, mh)
    const yo = e.textures.exists(K.ui('icono_jugadora')) ? e.add.image(x0 + ph.x, y0 + ph.y, K.ui('icono_jugadora')).setOrigin(0.5, 0.8) : null
    if (yo) {
      c.add(yo)
      e.tweens.add({ targets: yo, scale: 1.25, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    const cerrar = e.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive()
    cerrar.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    cerrar.on('pointerup', () => this.alternar())
    c.add(cerrar)
    this.grande = c
    this.abierto = true
  }

  private cerrarGrande(marcar = true): void {
    if (this.grande) {
      this.escena.tweens.killTweensOf(this.grande.list)
      this.grande.destroy()
    }
    this.grande = null
    if (marcar) this.abierto = false
  }

  /** Para la escena de prueba y el HUD: abrir o cerrar el grande */
  set grandeAbierto(v: boolean) {
    if (v !== this.abierto) this.alternar()
  }

  destruir(): void {
    this.cerrarGrande()
    this.img.destroy()
    this.marco.destroy()
    this.puntos.destroy()
    this.zona.destroy()
  }
}
