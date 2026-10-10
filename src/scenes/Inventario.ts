import Phaser from 'phaser'
import { K } from '../kit/claves'
import { manifestDe } from '../kit/contexto'
import type { LayoutInventario } from '../kit/tipos'
import { alCambiarEscala, escalaDe } from '../game/Pantalla'
import { hexANumero, texto } from '../game/Texto'
import { crearBoton } from '../game/ui/Boton'
import { Bloqueo } from '../game/ui/Bloqueo'
import { atlasDeIcono, frameDeIcono } from '../game/Botin'
import { colorDeRareza, itemDe, lineasDeStats, ranuraDe, type ItemCat, type Ranura } from '../logic/catalogo'
import { comparar } from '../logic/equipo'
import { agregarGanchos, quitarGanchos } from '../test/ganchos'
import type { Mundo } from './Mundo'

const MANTENER_MS = 420
/** lo que hay que mover el dedo para que el toque pase a ser un arrastre */
const ARRASTRE_PX = 10
const FILAS_NUMERO = { blanco: 0, amarillo: 1, rojo: 2, verde: 3, azul: 4 } as const
const CARACTERES = '0123456789+-!'

type Origen = { tipo: 'bolsa'; i: number } | { tipo: 'equipo'; ranura: Ranura } | { tipo: 'cinturon'; i: number }

interface Casilla {
  origen: Origen
  x: number
  y: number
  w: number
  h: number
  id: string | null
}

/**
 * El inventario (PLAN.md F3, tarea 4): `ui/inventario.png` con sus casilleros, la bolsa de 7 x 4 y el oro.
 * Tocar un objeto de la bolsa lo equipa, tocar uno puesto lo devuelve. Mantener presionado muestra su tooltip
 * con el nombre en el color de su rareza y la comparación con lo que ya lleva puesto.
 */
export class Inventario extends Phaser.Scene {
  private mundo!: Mundo
  private layout!: LayoutInventario
  private velo!: Phaser.GameObjects.Rectangle
  private panel!: Phaser.GameObjects.Container
  private dinamico: Phaser.GameObjects.GameObject[] = []
  private casillas: Casilla[] = []
  private tooltip: Phaser.GameObjects.Container | null = null
  private tooltipInfo: { nombre: string; lineas: string[]; dif: { etiqueta: string; delta: number }[] } | null = null
  private pulsado: { c: Casilla; timer: Phaser.Time.TimerEvent; largo: boolean; x0: number; y0: number } | null = null
  /** un objeto que se arrastra: afuera de la mochila cae al piso, sobre otra casilla se acomoda */
  private arrastre: { c: Casilla; icono: Phaser.GameObjects.Image; aviso: Phaser.GameObjects.BitmapText } | null = null
  private escala = 1
  private origen = { x: 0, y: 0 }
  private cerrar!: ReturnType<typeof crearBoton>
  private mensaje?: Phaser.GameObjects.BitmapText

  constructor() {
    super('Inventario')
  }

  create(): void {
    this.mundo = this.scene.get('Mundo') as Mundo
    const m = manifestDe(this)
    this.layout = (m.ui.inventario as { layout: LayoutInventario }).layout
    this.pulsado = null
    this.arrastre = null
    this.tooltip = null
    Bloqueo.instalar(this)
    this.velo = this.add.rectangle(0, 0, 10, 10, 0x070a12, 0.72).setOrigin(0, 0).setInteractive()
    this.velo.on('pointerdown', (p: Phaser.Input.Pointer) => Bloqueo.tomar(p.id))
    this.velo.on('pointerup', (p: Phaser.Input.Pointer) => {
      // un toque fuera del panel cierra (soltar algo arrastrado afuera no)
      if (!this.arrastre && !this.dentroDelPanel(p.x, p.y)) this.salir()
    })
    this.panel = this.add.container(0, 0)
    this.panel.add(this.add.image(0, 0, K.ui('inventario')).setOrigin(0, 0))
    this.cerrar = crearBoton(this, { x: 0, y: 0, icono: 'icono_cerrar', alToque: () => this.salir(), origen: [1, 0] })
    this.input.keyboard?.on('keydown-ESC', () => this.salir())
    this.input.keyboard?.on('keydown-I', () => this.salir())
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.mover(p))
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.soltar(p))
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.soltar(p))

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => quitarGanchos('inventarioUI', 'cerrarInventario', 'tooltipDe', 'tocarCasilla', 'arrastrarCasilla'))
    alCambiarEscala(this, () => this.acomodar())
    agregarGanchos({
      inventarioUI: () => ({
        abierto: true,
        escala: this.escala,
        panel: { x: this.origen.x, y: this.origen.y, w: this.layout.w * this.escala, h: this.layout.h * this.escala },
        casillas: this.casillas.map((c) => ({ tipo: c.origen.tipo, i: 'i' in c.origen ? c.origen.i : -1, ranura: 'ranura' in c.origen ? c.origen.ranura : '', x: c.x, y: c.y, w: c.w, h: c.h, id: c.id })),
        tooltip: this.tooltipInfo ? { visible: !!this.tooltip, ...this.tooltipInfo } : null,
        cerrar: this.cerrar.getBounds(),
      }),
      cerrarInventario: (() => this.salir()) as never,
      tooltipDe: ((tipo: 'bolsa' | 'equipo', clave: string | number) => {
        const c = this.casillas.find((q) => q.origen.tipo === tipo && ('i' in q.origen ? q.origen.i === clave : (q.origen as { ranura: string }).ranura === clave))
        if (c) this.mostrarTooltip(c)
        return !!c && !!this.tooltip
      }) as never,
      arrastrarCasilla: ((tipo: 'bolsa' | 'equipo', clave: string | number, px: number, py: number) => {
        const c = this.casillas.find((q) => q.origen.tipo === tipo && ('i' in q.origen ? q.origen.i === clave : (q.origen as { ranura: string }).ranura === clave))
        if (!c || !c.id) return false
        const it = itemDe(this.mundo.cat, c.id)!
        this.arrastre = { c, icono: this.add.image(px, py, atlasDeIcono(it), frameDeIcono(it)), aviso: texto(this, 0, 0, '', 'fuente_ui', 1) }
        this.terminarArrastre(px, py)
        return true
      }) as never,
      tocarCasilla: ((tipo: 'bolsa' | 'equipo', clave: string | number) => {
        const c = this.casillas.find((q) => q.origen.tipo === tipo && ('i' in q.origen ? q.origen.i === clave : (q.origen as { ranura: string }).ranura === clave))
        if (c) this.accion(c)
        return !!c
      }) as never,
    })
    this.sound.play(K.aud('abrir_inventario'), { volume: 0.6 })
  }

  private dentroDelPanel(px: number, py: number): boolean {
    return px >= this.origen.x && py >= this.origen.y && px <= this.origen.x + this.layout.w * this.escala && py <= this.origen.y + this.layout.h * this.escala
  }

  /** Todo se dibuja a escala entera: x1 si la vista es chica, x2 o más si sobra lugar */
  private acomodar(): void {
    if (!this.velo || !this.panel.active) return
    const w = this.scale.width
    const h = this.scale.height
    this.escala = Math.max(1, Math.min(3, Math.floor(Math.min(w / (this.layout.w + 12), h / this.layout.h))))
    this.velo.setSize(w, h)
    const pw = this.layout.w * this.escala
    const ph = this.layout.h * this.escala
    this.origen = { x: Math.round((w - pw) / 2), y: Math.max(0, Math.round((h - ph) / 2)) }
    this.panel.setPosition(this.origen.x, this.origen.y).setScale(this.escala)
    this.cerrar.setPosition(this.origen.x + pw - 4, this.origen.y + 4)
    this.redibujar()
  }

  /** Vuelve a poner los íconos de lo que lleva puesto y de la bolsa */
  private redibujar(): void {
    for (const o of this.dinamico) o.destroy()
    this.dinamico = []
    this.casillas = []
    this.cerrarTooltip()
    const p = this.mundo.partida
    const cat = this.mundo.cat
    const e = this.escala
    const L = this.layout
    const poner = (o: GameObject, hijo = true) => {
      this.dinamico.push(o)
      if (hijo) this.panel.add(o)
      return o
    }
    type GameObject = Phaser.GameObjects.GameObject

    // título
    poner(texto(this, L.titulo[0] + L.titulo[2] / 2, L.titulo[1] + L.titulo[3] / 2, 'Mochila', 'fuente_titulo', 1, { origen: [0.5, 0.5] }))

    // equipo
    for (const [clave, r] of Object.entries(L.equipo)) {
      const [rx, ry, rw, rh] = r
      if (clave === 'retrato') {
        const id = this.mundo.heroina.id
        if (this.textures.exists(K.retrato(id))) poner(this.add.image(rx + rw / 2, ry + rh / 2, K.retrato(id)))
        continue
      }
      const id = p.equipo[clave] ?? null
      const it = itemDe(cat, id)
      if (it) this.iconoEn(poner, it, rx + rw / 2, ry + rh / 2)
      this.casillas.push({ origen: { tipo: 'equipo', ranura: clave as Ranura }, x: this.origen.x + rx * e, y: this.origen.y + ry * e, w: rw * e, h: rh * e, id })
    }

    // bolsa
    const g = L.rejilla
    for (let i = 0; i < g.cols * g.filas; i++) {
      const cx = g.x + (i % g.cols) * g.celda
      const cy = g.y + Math.floor(i / g.cols) * g.celda
      const id = p.bolsa[i] ?? null
      const it = itemDe(cat, id)
      if (it) this.iconoEn(poner, it, cx + g.celda / 2, cy + g.celda / 2)
      this.casillas.push({ origen: { tipo: 'bolsa', i }, x: this.origen.x + cx * e, y: this.origen.y + cy * e, w: g.celda * e, h: g.celda * e, id })
    }

    // oro
    poner(this.add.image(L.oro.icono[0], L.oro.icono[1], K.ui('icono_oro')).setOrigin(0, 0))
    poner(texto(this, L.oro.texto[0], L.oro.texto[1] + L.oro.texto[3] / 2, String(p.oro), 'fuente_ui', 1, { origen: [0, 0.5], tinte: 0xffd27a }))

    // las zonas de toque van fuera del contenedor, en coordenadas de la vista, para no pelear con la escala
    for (const c of this.casillas) {
      const z = poner(this.add.zone(c.x, c.y, c.w, c.h).setOrigin(0, 0).setInteractive({ useHandCursor: !!c.id }), false) as Phaser.GameObjects.Zone
      z.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.alBajar(c, ptr))
    }
  }

  private iconoEn(poner: (o: Phaser.GameObjects.GameObject, h?: boolean) => Phaser.GameObjects.GameObject, it: ItemCat, x: number, y: number): void {
    const atlas = atlasDeIcono(it)
    if (!this.textures.exists(atlas)) return
    // los que no son normales llevan un marco del color de su rareza
    if (it.rarity !== 'normal') poner(this.add.image(x, y, K.ui('casillero_activo')).setTint(hexANumero(colorDeRareza(this.mundo.cat, it.rarity))).setAlpha(0.9))
    poner(this.add.image(x, y, atlas, frameDeIcono(it)))
  }

  /* ---------- toque y mantener ---------- */

  private alBajar(c: Casilla, p: Phaser.Input.Pointer): void {
    Bloqueo.tomar(p.id)
    if (!c.id) return
    this.pulsado?.timer.remove()
    const timer = this.time.delayedCall(MANTENER_MS, () => {
      if (!this.pulsado) return
      this.pulsado.largo = true
      this.mostrarTooltip(c)
    })
    this.pulsado = { c, timer, largo: false, x0: p.x, y0: p.y }
  }

  /** El dedo se mueve con un objeto apretado: empieza (o sigue) el arrastre */
  private mover(p: Phaser.Input.Pointer): void {
    const pu = this.pulsado
    if (!pu || !p.isDown) return
    if (!this.arrastre) {
      if (Math.hypot(p.x - pu.x0, p.y - pu.y0) < ARRASTRE_PX) return
      if (pu.c.origen.tipo === 'cinturon') return
      const it = itemDe(this.mundo.cat, pu.c.id)
      if (!it || !this.textures.exists(atlasDeIcono(it))) return
      pu.timer.remove()
      this.cerrarTooltip()
      const icono = this.add.image(p.x, p.y, atlasDeIcono(it), frameDeIcono(it)).setScale(this.escala).setDepth(1100).setAlpha(0.9)
      const esc = escalaDe(this.game).zoom >= 3 ? 1 : 2
      const aviso = texto(this, Math.round(this.scale.width / 2), Math.max(10, Math.round(this.origen.y - 12 * esc)), 'Suéltalo afuera para dejarlo en el piso', 'fuente_ui', esc, { origen: [0.5, 0.5], tinte: 0xd8d2c4, profundidad: 1100 })
      this.arrastre = { c: pu.c, icono, aviso }
      this.sound.play(K.aud('click'), { volume: 0.4 })
    }
    this.arrastre.icono.setPosition(Math.round(p.x), Math.round(p.y))
    this.arrastre.aviso.setTint(this.dentroDelPanel(p.x, p.y) ? 0xd8d2c4 : 0xffd27a)
  }

  /** Termina un arrastre: afuera de la mochila cae al piso, sobre una casilla se acomoda o se pone */
  private terminarArrastre(px: number, py: number): void {
    const a = this.arrastre!
    this.arrastre = null
    a.icono.destroy()
    a.aviso.destroy()
    const o = a.c.origen
    if (o.tipo === 'cinturon') return
    const m = this.mundo
    if (!this.dentroDelPanel(px, py)) {
      if (m.soltarDeInventario(o)) {
        this.sound.play(K.aud('recoger'), { volume: 0.6, rate: 0.7 })
        this.avisar('Quedó en el piso', 0xffd27a)
      }
      this.redibujar()
      return
    }
    const destino = this.casillas.find((c) => px >= c.x && py >= c.y && px < c.x + c.w && py < c.y + c.h)
    if (!destino || destino === a.c) return
    let ok = false
    if (o.tipo === 'bolsa' && destino.origen.tipo === 'bolsa') ok = m.moverEnLaBolsa(o.i, destino.origen.i)
    else if (o.tipo === 'bolsa' && destino.origen.tipo === 'equipo') ok = m.equiparDeBolsa(o.i).ok
    else if (o.tipo === 'equipo' && destino.origen.tipo === 'bolsa') ok = m.desequiparRanura(o.ranura).ok
    if (ok) this.sound.play(K.aud('recoger'), { volume: 0.6 })
    this.redibujar()
  }

  private soltar(ptr?: Phaser.Input.Pointer): void {
    const p = this.pulsado
    if (!p) return
    p.timer.remove()
    this.pulsado = null
    if (this.arrastre) {
      this.terminarArrastre(ptr?.x ?? p.x0, ptr?.y ?? p.y0)
      return
    }
    if (p.largo) {
      this.cerrarTooltip()
      return
    }
    this.accion(p.c)
  }

  /** Un toque corto: de la bolsa se equipa y de lo puesto vuelve a la bolsa */
  private accion(c: Casilla): void {
    if (!c.id) return
    const m = this.mundo
    const r = c.origen.tipo === 'bolsa' ? m.equiparDeBolsa(c.origen.i) : c.origen.tipo === 'equipo' ? m.desequiparRanura(c.origen.ranura) : { ok: false as const, motivo: 'vacio' as const }
    if (r.ok) this.sound.play(K.aud('recoger'), { volume: 0.6 })
    else {
      this.sound.play(K.aud('error'), { volume: 0.5 })
      this.avisar(r.motivo === 'llena' ? 'Bolsa llena' : 'Eso no se puede poner')
    }
    this.redibujar()
  }

  private avisar(t: string, tinte = 0xff8a8a): void {
    this.mensaje?.destroy()
    const e = escalaDe(this.game)
    const esc = e.zoom >= 3 ? 1 : 2
    this.mensaje = texto(this, Math.round(this.scale.width / 2), Math.round(this.origen.y + 24 * this.escala), t, 'fuente_ui', esc, { origen: [0.5, 0.5], tinte, profundidad: 900 })
    this.tweens.add({ targets: this.mensaje, alpha: 0, delay: 900, duration: 500, onComplete: () => this.mensaje?.destroy() })
  }

  /* ---------- tooltip ---------- */

  private cerrarTooltip(): void {
    this.tooltip?.destroy()
    this.tooltip = null
  }

  private mostrarTooltip(c: Casilla): void {
    this.cerrarTooltip()
    const cat = this.mundo.cat
    const it = itemDe(cat, c.id)
    if (!it) return
    const p = this.mundo.partida
    const clase = this.mundo.combate.clase
    // se compara con lo que ya tiene puesto en ese casillero (solo si el objeto viene de la bolsa)
    let actual: ItemCat | null = null
    if (c.origen.tipo === 'bolsa') {
      const r = ranuraDe(it)
      const ranura = r === 'anillo' ? (p.equipo.anillo_1 ? 'anillo_2' : 'anillo_1') : r
      actual = ranura ? itemDe(cat, p.equipo[ranura]) : null
    }
    const dif = c.origen.tipo === 'bolsa' ? comparar(it, actual, clase) : []
    const lineas = lineasDeStats(it)
    if (it.set) lineas.push(`Set: ${cat.sets[it.set]?.name.es ?? it.set}`)
    this.tooltipInfo = { nombre: it.name.es, lineas, dif }

    const e = escalaDe(this.game)
    const esc = e.zoom >= 3 ? 1 : 2
    const ancho = Math.min(this.scale.width - 8, 170 * (esc === 1 ? 1 : 1.4))
    const cont = this.add.container(0, 0).setDepth(1000)
    let y = 8
    const nombre = texto(this, 8, y, it.name.es, 'fuente_ui', esc, { origen: [0, 0], tinte: hexANumero(colorDeRareza(cat, it.rarity)), ancho: ancho - 16, alinear: 'izq' })
    cont.add(nombre)
    y += nombre.displayHeight + 4
    for (const l of lineas) {
      const t = texto(this, 8, y, l, 'fuente_ui', esc, { origen: [0, 0], ancho: ancho - 16, alinear: 'izq', tinte: l.startsWith('Set:') ? 0x7affc8 : 0xe8e4dc })
      cont.add(t)
      y += t.displayHeight + 2
    }
    if (dif.length > 0) {
      y += 4
      for (const d of dif.slice(0, 6)) {
        const lab = texto(this, 8, y, d.etiqueta, 'fuente_ui', esc, { origen: [0, 0], tinte: 0xb8b4c4 })
        cont.add(lab)
        const num = this.numero(`${d.delta > 0 ? '+' : '-'}${Math.abs(Math.round(d.delta * 10) / 10 | 0)}`, d.delta > 0 ? 'verde' : 'rojo', esc)
        num.setPosition(ancho - 8 - num.getData('ancho'), y + (lab.displayHeight - 9 * esc) / 2)
        cont.add(num)
        y += lab.displayHeight + 3
      }
    }
    // cómo se suelta: así se descubre sin explicarlo
    y += 2
    const pista = texto(this, 8, y, 'Arrástralo afuera para soltarlo', 'fuente_ui', esc, { origen: [0, 0], ancho: ancho - 16, alinear: 'izq', tinte: 0x8a8698 })
    cont.add(pista)
    y += pista.displayHeight + 2
    const alto = y + 6
    cont.addAt(this.add.nineslice(0, 0, K.ui('tooltip'), undefined, ancho, alto, 6, 6, 6, 6).setOrigin(0, 0), 0)
    // junto a la casilla: a la derecha si cabe y si no a la izquierda, sin salirse de la vista
    let tx = c.x + c.w + 4
    if (tx + ancho > this.scale.width - 2) tx = c.x - ancho - 4
    tx = Math.max(2, Math.min(this.scale.width - ancho - 2, tx))
    const ty = Math.max(2, Math.min(this.scale.height - alto - 2, c.y))
    cont.setPosition(Math.round(tx), Math.round(ty))
    this.tooltip = cont
  }

  /** Un número con los glifos de `ui/numeros.png` (7 x 9): blanco, amarillo, rojo, verde o azul */
  private numero(t: string, color: keyof typeof FILAS_NUMERO, escala: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0)
    let x = 0
    for (const ch of t) {
      const i = CARACTERES.indexOf(ch)
      if (i < 0) continue
      c.add(this.add.image(x, 0, K.ui('numeros'), FILAS_NUMERO[color] * CARACTERES.length + i).setOrigin(0, 0).setScale(escala))
      x += 7 * escala
    }
    c.setData('ancho', x)
    return c
  }

  private salir(): void {
    if (!this.scene.isActive()) return
    this.cerrarTooltip()
    this.scene.resume('Mundo')
    this.game.events.emit('inventario-cerrado')
    this.scene.stop()
  }
}
