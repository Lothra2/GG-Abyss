import Phaser from 'phaser'
import { K } from '../kit/claves'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { texto } from '../game/Texto'
import { crearBoton, type Boton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { atlasDeIcono, frameDeIcono } from '../game/Botin'
import { itemDe } from '../logic/catalogo'
import { comprar, ofertas, precioVenta, semillaSurtido, sePuedeVender, surtido, vender, type EstadoOferta } from '../logic/tienda'
import { TIENDA } from '../config/balance'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo } from './Mundo'

type Pestana = 'comprar' | 'vender'
type Origen = 'fija' | 'surtido' | 'recompra' | 'bolsa'

/** Lo que muestra una tarjeta: algo que se compra o algo de la bolsa que se vende */
interface Item {
  clave: string
  id: string
  precio: number
  estado: EstadoOferta | 'no-vende'
  origen: Origen
  /** el hueco de la bolsa (para vender) */
  i?: number
}

interface Tarjeta {
  it: Item
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

const AVISO: Record<string, string> = { caro: 'Falta oro', lleno: 'Sin lugar', tiene: 'Ya lo tiene', 'no-vende': 'Es tuyo' }

/**
 * La tienda de Don Cachivache (el mercader de la fogata). Dos pestañas con ícono: Comprar (pociones, armaduras de
 * Thor y equipo de su nivel, con un arma de su clase) y Vender (lo de la bolsa, con un segundo toque para confirmar).
 * Lo vendido se puede recomprar al mismo precio mientras dure el mundo: nadie pierde nada por un toque sin querer.
 * Todo se entiende sin leer: el ícono, la moneda con el precio y un sonido distinto si se pudo o no.
 * Las reglas viven en `logic/tienda.ts`.
 */
export class Tienda extends Phaser.Scene {
  private mundo!: Mundo
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.NineSlice
  private titulo!: Phaser.GameObjects.BitmapText
  private oroIcono!: Phaser.GameObjects.Image
  private oroTexto!: Phaser.GameObjects.BitmapText
  private vacio!: Phaser.GameObjects.BitmapText
  private cerrar!: Boton
  private tabs!: Record<Pestana, Boton>
  private flechas!: { antes: Boton; despues: Boton }
  private tarjetas: Tarjeta[] = []
  private rect = { x: 0, y: 0, w: 0, h: 0 }
  private ultima: { id: string; ok: boolean; motivo?: string; vendido?: boolean } | null = null
  private escalaTexto = 1
  private pestana: Pestana = 'comprar'
  private pagina = 0
  private porPagina = 6
  /** la tarjeta de venta que espera el segundo toque */
  private confirmar: string | null = null

  constructor() {
    super('Tienda')
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    this.tarjetas = []
    this.ultima = null
    this.pestana = 'comprar'
    this.pagina = 0
    this.confirmar = null
    Bloqueo.instalar(this)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.72).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.velo.on('pointerup', (p: Phaser.Input.Pointer) => {
      const r = this.rect
      if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) this.salir()
    })
    this.panel = this.add.nineslice(0, 0, K.ui('panel'), undefined, 100, 100, 12, 12, 12, 12).setOrigin(0, 0)
    const nombre = this.mundo.manifest.personajes.mercader?.nombre
    this.titulo = texto(this, 0, 0, nombre ?? 'Tienda de la fogata', 'fuente_titulo', 1, { origen: [0.5, 0] })
    this.oroIcono = this.add.image(0, 0, K.ui('icono_oro')).setOrigin(0, 0.5)
    this.oroTexto = texto(this, 0, 0, '0', 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a })
    this.vacio = texto(this, 0, 0, 'La bolsa está vacía', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xb8b4c4 }).setVisible(false)
    this.cerrar = crearBoton(this, { x: 0, y: 0, icono: 'icono_cerrar', alToque: () => this.salir(), origen: [1, 0] })
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.tabs = {
      comprar: crearBoton(this, { x: 0, y: 0, icono: 'icono_bolsa', etiqueta: 'Comprar', escalaTexto: esc, alToque: () => this.cambiarPestana('comprar') }),
      vender: crearBoton(this, { x: 0, y: 0, icono: 'icono_oro', etiqueta: 'Vender', escalaTexto: esc, alToque: () => this.cambiarPestana('vender') }),
    }
    this.flechas = {
      antes: crearBoton(this, { x: 0, y: 0, etiqueta: '<', escalaTexto: esc, alToque: () => this.irAPagina(this.pagina - 1) }),
      despues: crearBoton(this, { x: 0, y: 0, etiqueta: '>', escalaTexto: esc, alToque: () => this.irAPagina(this.pagina + 1) }),
    }
    this.input.keyboard?.on('keydown-ESC', () => this.salir())
    this.mundo.sonido.efecto('abrir_inventario', { volumen: 0.6 })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('tiendaUI', 'tiendaComprar', 'tiendaVender', 'tiendaPestana', 'cerrarTienda'))
    alCambiarEscala(this, () => this.acomodar())
    this.rehacer()
    agregarGanchos({
      tiendaUI: () => ({
        abierta: true,
        oro: this.mundo.partida.oro,
        pestana: this.pestana,
        pagina: this.pagina,
        paginas: this.paginas(),
        titulo: this.titulo.text,
        // las que se ven ahora (con su lugar) y todas las de la pestaña
        ofertas: this.tarjetas.map((t) => ({ id: t.it.id, precio: t.it.precio, estado: t.it.estado, origen: t.it.origen, x: t.x, y: t.y, w: t.w, h: t.h })),
        todas: this.items().map((it) => ({ id: it.id, precio: it.precio, estado: it.estado, origen: it.origen, i: it.i })),
        confirmar: this.confirmar,
        ultima: this.ultima,
      }),
      tiendaComprar: ((id: string, origen?: Origen) => {
        const it = this.itemsComprar().find((q) => q.id === id && (!origen || q.origen === origen))
        return it ? this.comprar(it) : { ok: false, motivo: 'no-vende' }
      }) as never,
      tiendaVender: ((i: number) => {
        const it = this.itemsVender().find((q) => q.i === i)
        if (!it) return { ok: false, motivo: 'vacio' }
        this.confirmar = it.clave
        return this.vender(it)
      }) as never,
      tiendaPestana: ((p: Pestana) => this.cambiarPestana(p)) as never,
      cerrarTienda: (() => this.salir()) as never,
    })
  }

  override update(_t: number, ms: number): void {
    this.mundo.sonidoEnPausa(Math.min(0.05, ms / 1000))
  }

  /* ---------- lo que hay en cada pestaña ---------- */

  private itemsComprar(): Item[] {
    const m = this.mundo
    const p = m.partida
    const ses = m.tiendaSesion
    const eq = surtido(m.cat, p.nivel, m.combate.clase, semillaSurtido(p.id, m.idMundo, p.nivel)).filter((o) => !ses.comprados.includes(o.id))
    const grupos: [Origen, { id: string; precio: number }[]][] = [['fija', [...TIENDA.ofertas]], ['surtido', eq], ['recompra', ses.recompra]]
    const out: Item[] = []
    for (const [origen, lista] of grupos) {
      const est = ofertas(p.oro, m.inv(), m.cat, lista)
      est.forEach((o, k) => out.push({ clave: `${origen}:${k}:${o.id}`, id: o.id, precio: o.precio, estado: o.estado, origen }))
    }
    return out
  }

  private itemsVender(): Item[] {
    const m = this.mundo
    const out: Item[] = []
    m.partida.bolsa.forEach((id, i) => {
      const it = itemDe(m.cat, id)
      if (!id || !it) return
      out.push({ clave: `bolsa:${i}:${id}`, id, precio: precioVenta(it), estado: sePuedeVender(it) ? 'ok' : 'no-vende', origen: 'bolsa', i })
    })
    return out
  }

  private items(): Item[] {
    return this.pestana === 'comprar' ? this.itemsComprar() : this.itemsVender()
  }

  private paginas(): number {
    return Math.max(1, Math.ceil(this.items().length / Math.max(1, this.porPagina)))
  }

  private cambiarPestana(p: Pestana): void {
    if (this.pestana === p) return
    this.pestana = p
    this.pagina = 0
    this.confirmar = null
    this.mundo.sonido.efecto('click', { volumen: 0.5 })
    this.rehacer()
  }

  private irAPagina(n: number): void {
    const total = this.paginas()
    const nueva = Math.max(0, Math.min(total - 1, n))
    if (nueva === this.pagina) return
    this.pagina = nueva
    this.confirmar = null
    this.mundo.sonido.efecto('click', { volumen: 0.5 })
    this.rehacer()
  }

  /* ---------- comprar y vender ---------- */

  /** Compra: descuenta el oro, pone el objeto donde va y lo dice con sonido; si no se puede, la tarjeta tiembla */
  private comprar(it: Item): { ok: boolean; motivo?: string } {
    const m = this.mundo
    const t = this.tarjetas.find((x) => x.it.clave === it.clave)
    const r = comprar(m.partida, m.inv(), m.cat, it.id, [{ id: it.id, precio: it.precio }])
    if (r.ok) {
      this.ultima = { id: it.id, ok: true }
      if (it.origen === 'surtido') m.tiendaSesion.comprados.push(it.id)
      if (it.origen === 'recompra') {
        const k = m.tiendaSesion.recompra.findIndex((q) => q.id === it.id && q.precio === it.precio)
        if (k >= 0) m.tiendaSesion.recompra.splice(k, 1)
      }
      m.sonido.efecto('moneda', { volumen: 0.8 })
      m.sonido.efecto(r.donde === 'thor' ? 'ladrido' : 'recoger', { volumen: 0.7 })
      m.alCambioInventario()
      if (t) this.flotar(t, r.donde === 'thor' ? '¡Para Thor!' : '¡Listo!', 0xbfffb0)
    } else {
      this.ultima = { id: it.id, ok: false, motivo: r.motivo }
      m.sonido.efecto('error', { volumen: 0.6 })
      if (t) this.tweens.add({ targets: t.c, x: t.c.x + 3, duration: 40, yoyo: true, repeat: 2 })
    }
    this.rehacer(true)
    return r.ok ? { ok: true } : { ok: false, motivo: r.motivo }
  }

  /** Vender pide dos toques: el primero pregunta (la tarjeta se ilumina), el segundo vende */
  private vender(it: Item): { ok: boolean; motivo?: string; precio?: number } {
    const m = this.mundo
    const t = this.tarjetas.find((x) => x.it.clave === it.clave)
    if (it.estado === 'no-vende' || it.i === undefined) {
      this.ultima = { id: it.id, ok: false, motivo: 'no-vende' }
      m.sonido.efecto('error', { volumen: 0.6 })
      if (t) this.tweens.add({ targets: t.c, x: t.c.x + 3, duration: 40, yoyo: true, repeat: 2 })
      return { ok: false, motivo: 'no-vende' }
    }
    if (this.confirmar !== it.clave) {
      this.confirmar = it.clave
      m.sonido.efecto('click', { volumen: 0.6 })
      this.refrescar()
      return { ok: false, motivo: 'confirmar' }
    }
    this.confirmar = null
    const r = vender(m.partida, m.inv(), m.cat, it.i)
    if (!r.ok) return { ok: false, motivo: r.motivo }
    m.tiendaSesion.recompra.push({ id: r.id, precio: r.precio })
    this.ultima = { id: r.id, ok: true, vendido: true }
    m.sonido.efecto('moneda', { volumen: 0.8 })
    m.alCambioInventario()
    if (t) this.flotar(t, `+${r.precio}`, 0xffd27a)
    this.rehacer(true)
    return { ok: true, precio: r.precio }
  }

  private tocar(t: Tarjeta): void {
    if (this.pestana === 'comprar') this.comprar(t.it)
    else this.vender(t.it)
  }

  private flotar(t: Tarjeta, s: string, tinte: number): void {
    const f = texto(this, t.x + t.w / 2, t.y + 6, s, 'fuente_ui', escalaDe(this.game).zoom >= 3 ? 1 : 2, { origen: [0.5, 1], tinte }).setDepth(50)
    this.tweens.add({ targets: f, y: f.y - 16, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => f.destroy() })
  }

  /* ---------- dibujo ---------- */

  /** Vuelve a armar las tarjetas de la página (cambió la pestaña, la página o lo que hay) */
  private rehacer(mantenerPagina = false): void {
    for (const t of this.tarjetas) {
      t.c.destroy()
      t.zona.destroy()
    }
    this.tarjetas = []
    this.acomodar(mantenerPagina)
  }

  private crearTarjeta(it: Item): Tarjeta {
    const item = itemDe(this.mundo.cat, it.id)!
    const c = this.add.container(0, 0)
    const fondo = this.add.nineslice(0, 0, K.ui('panel_hundido'), undefined, 60, 80, 6, 6, 6, 6).setOrigin(0, 0)
    const icono = this.add.image(0, 0, atlasDeIcono(item), frameDeIcono(item)).setScale(2)
    const nombre = texto(this, 0, 0, it.origen === 'recompra' ? `Recomprar: ${item.name.es}` : item.name.es, 'fuente_ui', 1, { origen: [0.5, 0] })
    const moneda = this.add.image(0, 0, K.ui('icono_oro')).setOrigin(0, 0.5)
    const precio = texto(this, 0, 0, String(it.precio), 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a })
    const aviso = texto(this, 0, 0, '', 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: 0xff8a7a })
    const zona = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true })
    c.add([fondo, icono, nombre, moneda, precio, aviso])
    const t: Tarjeta = { it, c, fondo, icono, nombre, precio, moneda, aviso, zona, x: 0, y: 0, w: 60, h: 80 }
    zona.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    zona.on('pointerup', () => this.tocar(t))
    return t
  }

  private refrescar(): void {
    const vendiendo = this.pestana === 'vender'
    for (const t of this.tarjetas) {
      const e = t.it.estado
      const ok = e === 'ok'
      const preguntando = vendiendo && this.confirmar === t.it.clave
      t.icono.setAlpha(ok || e === 'caro' ? 1 : 0.45)
      t.precio.setTint(e === 'caro' ? 0xff7a6a : 0xffd27a)
      t.fondo.setTint(preguntando ? 0xffe6a0 : t.it.origen === 'recompra' ? 0xc8d8ff : 0xffffff)
      t.aviso.setTint(preguntando ? 0xffd27a : 0xff8a7a)
      t.aviso.setText(preguntando ? '¿Vender? Toca otra vez' : AVISO[e] ?? '')
      // con letra grande no entra el nombre: solo el aviso; con letra chica el nombre, o el aviso si no se puede
      t.nombre.setVisible(this.escalaTexto === 1 && ok && !preguntando)
      t.moneda.setVisible(e !== 'tiene' && e !== 'no-vende')
      t.precio.setVisible(e !== 'tiene' && e !== 'no-vende')
    }
    for (const [p, b] of Object.entries(this.tabs) as [Pestana, Boton][]) b.setAlpha(p === this.pestana ? 1 : 0.6)
    const total = this.paginas()
    this.flechas.antes.setVisible(total > 1).setActivo(this.pagina > 0)
    this.flechas.despues.setVisible(total > 1).setActivo(this.pagina < total - 1)
    this.vacio.setVisible(vendiendo && this.tarjetas.length === 0)
    this.oroTexto.setText(String(this.mundo.partida.oro))
  }

  private acomodar(mantenerPagina = true): void {
    if (!this.velo?.active) return
    const w = this.scale.width
    const h = this.scale.height
    const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
    this.escalaTexto = esc
    this.velo.setSize(w, h)
    this.oroTexto.setScale(esc)
    this.oroIcono.setScale(esc)
    this.vacio.setScale(esc)
    // tarjetas en filas de hasta 4; el ancho sale de lo que entra en pantalla
    const porFila = w >= 560 ? 4 : w >= 420 ? 3 : 2
    const sep = 8
    const maxTw = esc === 1 ? 112 : 150
    const tw = Math.max(76, Math.min(maxTw, Math.floor((w - 32 - sep * (porFila + 1)) / porFila)))
    const pw = tw * porFila + sep * (porFila + 1) + 8
    this.titulo.setScale(esc)
    if (this.titulo.displayWidth > pw - 2 * (this.cerrar.ancho + 8)) this.titulo.setScale(1)
    // alto de una tarjeta: ícono, nombre (o aviso) y precio
    const altoNombre = esc === 1 ? 20 : 9 * esc + 4
    const th = 8 + 64 + 6 + altoNombre + 6 + 9 * esc + 8
    const altoTabs = Math.max(this.tabs.comprar.alto, this.tabs.vender.alto)
    const cabeza = 12 + this.titulo.displayHeight + 6 + 12 * esc + 6 + altoTabs + 8
    const pie = Math.max(this.flechas.antes.alto, 0) + 10
    // cuántas filas entran: lo que sobra se pasa con las flechas
    const filasCaben = Math.max(1, Math.floor((h - 8 - cabeza - pie) / (th + sep)))
    this.porPagina = filasCaben * porFila
    const lista = this.items()
    const total = Math.max(1, Math.ceil(lista.length / this.porPagina))
    if (!mantenerPagina) this.pagina = 0
    this.pagina = Math.min(this.pagina, total - 1)
    const visibles = lista.slice(this.pagina * this.porPagina, (this.pagina + 1) * this.porPagina)
    if (this.tarjetas.length !== visibles.length || this.tarjetas.some((t, k) => t.it.clave !== visibles[k]!.clave)) {
      for (const t of this.tarjetas) {
        t.c.destroy()
        t.zona.destroy()
      }
      this.tarjetas = visibles.map((it) => this.crearTarjeta(it))
    } else this.tarjetas.forEach((t, k) => (t.it = visibles[k]!))
    for (const t of this.tarjetas) t.nombre.setScale(1).setMaxWidth(tw - 10).setCenterAlign()
    const filas = Math.max(1, Math.ceil(Math.max(1, this.tarjetas.length) / porFila))
    const ph = Math.min(h - 8, cabeza + filas * (th + sep) + (total > 1 ? pie : 10))
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
    // las pestañas, juntas y centradas debajo del oro
    const ty = Math.round(oy + 6 * esc + 6 + altoTabs / 2)
    const anchoTabs = this.tabs.comprar.ancho + 8 + this.tabs.vender.ancho
    this.tabs.comprar.setPosition(Math.round(w / 2 - anchoTabs / 2 + this.tabs.comprar.ancho / 2), ty)
    this.tabs.vender.setPosition(Math.round(w / 2 + anchoTabs / 2 - this.tabs.vender.ancho / 2), ty)
    this.tarjetas.forEach((t, i) => {
      const fila = Math.floor(i / porFila)
      const col = i % porFila
      const enFila = Math.min(porFila, this.tarjetas.length - fila * porFila)
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
      t.aviso.setScale(esc === 1 ? 1 : esc).setOrigin(0.5, 0).setPosition(Math.round(tw / 2), yNombre).setMaxWidth(Math.round((tw - 8) / (esc === 1 ? 1 : esc))).setCenterAlign()
      const py2 = th - 8 - Math.round(4.5 * esc)
      t.moneda.setScale(esc)
      t.precio.setScale(esc)
      const tot = t.moneda.displayWidth + 3 + t.precio.displayWidth
      t.moneda.setPosition(Math.round(tw / 2 - tot / 2), Math.round(py2))
      t.precio.setPosition(Math.round(tw / 2 - tot / 2 + t.moneda.displayWidth + 3), Math.round(py2))
      t.zona.setPosition(x, y).setSize(tw, th)
    })
    this.vacio.setPosition(Math.round(w / 2), Math.round(py + cabeza + th / 2))
    const fy = py + ph - 6 - this.flechas.antes.alto / 2
    this.flechas.antes.setPosition(Math.round(px + 14 + this.flechas.antes.ancho / 2), Math.round(fy))
    this.flechas.despues.setPosition(Math.round(px + pw - 14 - this.flechas.despues.ancho / 2), Math.round(fy))
    this.refrescar()
  }

  private salir(): void {
    if (!this.scene.isActive()) return
    this.scene.resume('Mundo')
    this.game.events.emit('inventario-cerrado')
    this.scene.stop()
  }
}
