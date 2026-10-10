import Phaser from 'phaser'
import { K } from '../kit/claves'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { atlasDeIcono, frameDeIcono } from '../game/Botin'
import { itemDe } from '../logic/catalogo'
import { comprar, ofertas, type Oferta } from '../logic/tienda'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo } from './Mundo'

interface Tarjeta {
  o: Oferta
  c: Phaser.GameObjects.Container
  fondo: Phaser.GameObjects.NineSlice
  icono: Phaser.GameObjects.Image
  nombre: Phaser.GameObjects.BitmapText
  precio: Phaser.GameObjects.BitmapText
  moneda: Phaser.GameObjects.Image
  aviso: Phaser.GameObjects.BitmapText
  zona: Phaser.GameObjects.Zone
  x: number
  y: number
  w: number
  h: number
}

const AVISO: Record<string, string> = { caro: 'Falta oro', lleno: 'Sin lugar', tiene: 'Ya lo tiene' }

/**
 * La tienda de la fogata: se abre al tocar una fogata y vende pociones y las armaduras de Thor por oro.
 * Todo se entiende sin leer: el ícono, la moneda con el precio y un sonido distinto si se pudo o no comprar.
 * La regla de qué se puede comprar vive en `logic/tienda.ts`.
 */
export class Tienda extends Phaser.Scene {
  private mundo!: Mundo
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.NineSlice
  private titulo!: Phaser.GameObjects.BitmapText
  private oroIcono!: Phaser.GameObjects.Image
  private oroTexto!: Phaser.GameObjects.BitmapText
  private cerrar!: Boton
  private tarjetas: Tarjeta[] = []
  private rect = { x: 0, y: 0, w: 0, h: 0 }
  private ultima: { id: string; ok: boolean; motivo?: string } | null = null
  private escalaTexto = 1

  constructor() {
    super('Tienda')
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    this.tarjetas = []
    this.ultima = null
    Bloqueo.instalar(this)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.72).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.velo.on('pointerup', (p: Phaser.Input.Pointer) => {
      const r = this.rect
      if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) this.salir()
    })
    this.panel = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 12, 12, 12, 12).setOrigin(0, 0)
    this.titulo = texto(this, 0, 0, 'Tienda de la fogata', 'fuente_titulo', 1, { origen: [0.5, 0] })
    this.oroIcono = this.add.image(0, 0, K.ui('icono_oro')).setOrigin(0, 0.5)
    this.oroTexto = texto(this, 0, 0, '0', 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a })
    this.cerrar = crearBoton(this, { x: 0, y: 0, icono: 'icono_cerrar', alToque: () => this.salir(), origen: [1, 0] })
    for (const o of this.lista()) this.tarjetas.push(this.crearTarjeta(o))
    this.input.keyboard?.on('keydown-ESC', () => this.salir())
    this.mundo.sonido.efecto('abrir_inventario', { volumen: 0.6 })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('tiendaUI', 'tiendaComprar', 'cerrarTienda'))
    alCambiarEscala(this, () => this.acomodar())
    this.acomodar()
    agregarGanchos({
      tiendaUI: () => ({
        abierta: true,
        oro: this.mundo.partida.oro,
        ofertas: this.tarjetas.map((t) => ({ id: t.o.id, precio: t.o.precio, estado: t.o.estado, x: t.x, y: t.y, w: t.w, h: t.h })),
        ultima: this.ultima,
      }),
      tiendaComprar: ((id: string) => this.comprar(id)) as never,
      cerrarTienda: (() => this.salir()) as never,
    })
  }

  override update(_t: number, ms: number): void {
    this.mundo.sonidoEnPausa(Math.min(0.05, ms / 1000))
  }

  private lista(): Oferta[] {
    const p = this.mundo.partida
    return ofertas(p.oro, this.mundo.inv(), this.mundo.cat)
  }

  private crearTarjeta(o: Oferta): Tarjeta {
    const item = itemDe(this.mundo.cat, o.id)!
    const c = this.add.container(0, 0)
    const fondo = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 60, 80, 6, 6, 6, 6).setOrigin(0, 0)
    const icono = this.add.image(0, 0, atlasDeIcono(item), frameDeIcono(item)).setScale(2)
    const nombre = texto(this, 0, 0, item.name.es, 'fuente_ui', 1, { origen: [0.5, 0] })
    const moneda = this.add.image(0, 0, K.ui('icono_oro')).setOrigin(0, 0.5)
    const precio = texto(this, 0, 0, String(o.precio), 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a })
    const aviso = texto(this, 0, 0, '', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xff8a7a })
    const zona = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true })
    zona.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    zona.on('pointerup', () => this.comprar(o.id))
    c.add([fondo, icono, nombre, moneda, precio, aviso])
    return { o, c, fondo, icono, nombre, precio, moneda, aviso, zona, x: 0, y: 0, w: 60, h: 80 }
  }

  /** Compra: descuenta el oro, pone el objeto donde va y lo dice con sonido; si no se puede, la tarjeta tiembla */
  private comprar(id: string): { ok: boolean; motivo?: string } {
    const t = this.tarjetas.find((x) => x.o.id === id)
    const p = this.mundo.partida
    const r = comprar(p, this.mundo.inv(), this.mundo.cat, id)
    if (r.ok) {
      this.ultima = { id, ok: true }
      this.mundo.sonido.efecto('moneda', { volumen: 0.8 })
      this.mundo.sonido.efecto(r.donde === 'thor' ? 'ladrido' : 'recoger', { volumen: 0.7 })
      this.mundo.alCambioInventario()
      if (t) {
        this.tweens.add({ targets: t.icono, y: t.icono.y - 6, duration: 90, yoyo: true, ease: 'Quad.easeOut' })
        this.flotar(t, r.donde === 'thor' ? '¡Para Thor!' : '¡Listo!', 0xbfffb0)
      }
    } else {
      this.ultima = { id, ok: false, motivo: r.motivo }
      this.mundo.sonido.efecto('error', { volumen: 0.6 })
      if (t) this.tweens.add({ targets: t.c, x: t.c.x + 3, duration: 40, yoyo: true, repeat: 2 })
    }
    this.refrescar()
    return r.ok ? { ok: true } : { ok: false, motivo: r.motivo }
  }

  private flotar(t: Tarjeta, s: string, tinte: number): void {
    const f = texto(this, t.x + t.w / 2, t.y + 6, s, 'fuente_ui', escalaDe(this.game).zoom >= 3 ? 1 : 2, { origen: [0.5, 1], tinte })
    this.tweens.add({ targets: f, y: f.y - 16, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => f.destroy() })
  }

  private refrescar(): void {
    const nuevas = this.lista()
    for (const t of this.tarjetas) {
      const o = nuevas.find((x) => x.id === t.o.id)
      if (o) t.o = o
      const ok = t.o.estado === 'ok'
      t.icono.setAlpha(ok || t.o.estado === 'caro' ? 1 : 0.45)
      t.precio.setTint(t.o.estado === 'caro' ? 0xff7a6a : 0xffd27a)
      t.aviso.setText(AVISO[t.o.estado] ?? '')
      // con letra grande no entra el nombre: solo el aviso; con letra chica el nombre, o el aviso si no se puede comprar
      t.nombre.setVisible(this.escalaTexto === 1 && t.o.estado === 'ok')
      t.moneda.setVisible(t.o.estado !== 'tiene')
      t.precio.setVisible(t.o.estado !== 'tiene')
    }
    this.oroTexto.setText(String(this.mundo.partida.oro))
  }

  private acomodar(): void {
    if (!this.velo?.active) return
    const w = this.scale.width
    const h = this.scale.height
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.velo.setSize(w, h)
    this.oroTexto.setScale(esc)
    this.oroIcono.setScale(esc)
    // tarjetas en filas de hasta 3; el ancho sale de lo que entra en pantalla
    const n = this.tarjetas.length
    const porFila = w >= 420 ? 3 : 2
    const filas = Math.ceil(n / porFila)
    const sep = 8
    const maxTw = esc === 1 ? 112 : 150
    const tw = Math.max(76, Math.min(maxTw, Math.floor((w - 32 - sep * (porFila + 1)) / porFila)))
    const pw = tw * porFila + sep * (porFila + 1) + 8
    // el título baja a letra chica si no entra entre el borde y el botón de cerrar
    this.titulo.setScale(esc)
    if (this.titulo.displayWidth > pw - 2 * (this.cerrar.ancho + 8)) this.titulo.setScale(1)
    // el nombre va debajo del ícono (con letra chica); si no se puede comprar, en su lugar va el aviso
    let altoNombre = 9 * esc + 4
    for (const t of this.tarjetas) {
      t.nombre.setScale(1).setMaxWidth(tw - 10).setCenterAlign()
      if (esc === 1) altoNombre = Math.max(altoNombre, t.nombre.displayHeight)
    }
    const th = 8 + 64 + 6 + altoNombre + 6 + 9 * esc + 8
    const cabeza = 12 + this.titulo.displayHeight + 6 + 12 * esc + 8
    const ph = Math.min(h - 8, cabeza + filas * (th + sep) + 10)
    const px = Math.round((w - pw) / 2)
    const py = Math.round((h - ph) / 2)
    this.rect = { x: px, y: py, w: pw, h: ph }
    this.panel.setPosition(px, py).setSize(pw, ph)
    this.titulo.setPosition(Math.round(w / 2), py + 12)
    const oy = py + 12 + this.titulo.displayHeight + 6 + 6 * esc
    const totalOro = this.oroIcono.displayWidth + 4 + this.oroTexto.displayWidth
    this.oroIcono.setPosition(Math.round(w / 2 - totalOro / 2), Math.round(oy))
    this.oroTexto.setPosition(Math.round(w / 2 - totalOro / 2 + this.oroIcono.displayWidth + 4), Math.round(oy))
    this.cerrar.setPosition(px + pw - 6, py + 6)
    this.tarjetas.forEach((t, i) => {
      const fila = Math.floor(i / porFila)
      const col = i % porFila
      const enFila = Math.min(porFila, n - fila * porFila)
      const x0 = px + Math.round((pw - (enFila * tw + (enFila - 1) * sep)) / 2)
      const x = x0 + col * (tw + sep)
      const y = py + cabeza + fila * (th + sep)
      t.x = x
      t.y = y
      t.w = tw
      t.h = th
      t.c.setPosition(x, y)
      t.fondo.setSize(tw, th)
      t.icono.setPosition(Math.round(tw / 2), 8 + 32)
      const yNombre = 8 + 64 + 6
      t.nombre.setPosition(Math.round(tw / 2), yNombre)
      t.aviso.setScale(esc).setOrigin(0.5, 0).setPosition(Math.round(tw / 2), yNombre)
      const py2 = th - 8 - Math.round(4.5 * esc)
      t.moneda.setScale(esc)
      t.precio.setScale(esc)
      const tot = t.moneda.displayWidth + 3 + t.precio.displayWidth
      t.moneda.setPosition(Math.round(tw / 2 - tot / 2), Math.round(py2))
      t.precio.setPosition(Math.round(tw / 2 - tot / 2 + t.moneda.displayWidth + 3), Math.round(py2))
      t.zona.setPosition(x, y).setSize(tw, th)
    })
    this.escalaTexto = esc
    this.refrescar()
  }

  private salir(): void {
    if (!this.scene.isActive()) return
    this.scene.resume('Mundo')
    this.game.events.emit('inventario-cerrado')
    this.scene.stop()
  }
}
