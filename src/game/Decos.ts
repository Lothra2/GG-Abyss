import Phaser from 'phaser'
import type { Manifest, ObjetoMundo } from '../kit/tipos'
import type { Deco } from '../kit/mapa'
import { K } from '../kit/claves'
import { COLOR, DECOS, PROF } from '../config/juego'
import { hash2 } from '../logic/azar'

/** Una luz del mundo: pozo que borra la oscuridad y resplandor de color encima */
export interface Luz {
  x: number
  y: number
  /** radio en px */
  r: number
  color: string
  flicker?: boolean
  pulse?: boolean
  ph: number
  /** la luz de la heroína no suma resplandor de color */
  heroina?: boolean
}

export interface DefDeco {
  i: number
  nombre: string
  def: ObjetoMundo
  x: number
  y: number
  ph: number
  /** animación de fondo (idle, girar, dormido...) */
  anim: string
  copa: boolean
  hechizado: boolean
  pasto: boolean
  /** el kit trae tronco y copa por separado: la copa se dibuja aparte y es la que se vuelve transparente */
  separado: boolean
  capaSuelo: boolean
  /** rectángulo del sprite en el mundo */
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Estado del pasto alto: se abre cuando la heroína lo cruza y se cierra cuando se va */
type EstadoPasto = 'idle' | 'abriendo' | 'abierto' | 'cerrando'

export interface Activo {
  d: DefDeco
  /** el objeto entero, o el tronco si el kit lo trae separado */
  s: Phaser.GameObjects.Sprite
  /** la copa, si el kit trae tronco y copa por separado */
  c: Phaser.GameObjects.Sprite | null
  anim: string
  fr: number
  alfa: number
  despierto: boolean
  blinkAt: number
  blinkT: number
  /** pasto alto */
  pasto: EstadoPasto
  pastoLado: 'izq' | 'der'
  pastoT: number
  /** segundo del reloj en que empezó a sonreír (el Abuelo Roble), o -1 */
  sonrisaT: number
  /** una animación que se toca una vez encima de la de fondo (el portal que se abre) */
  forzada?: { anim: string; t0: number }
}

/** Árboles y objetos que se vuelven transparentes cuando la heroína pasa detrás */
const RE_COPA = /^(roble|pino|arbol|sauce|abuelo)/

/**
 * Decorados del mapa (PLAN.md 3.2). Hay más de 2000, nunca se crean todos:
 * solo los que tocan la pantalla (más un margen chico), sacados de una reserva de sprites.
 * El viento los anima con un solo reloj, sin una animación de Phaser por árbol.
 */
export class Decos {
  private defs: DefDeco[] = []
  private grilla = new Map<number, DefDeco[]>()
  private activos = new Map<number, Activo>()
  private libres: Phaser.GameObjects.Sprite[] = []
  private ultimaVista = { x: -1e9, y: -1e9, w: 0, h: 0 }
  private ext = { izq: 0, der: 0, arr: 0, aba: 0 }
  private despertarSonado = -100
  /** se llama cuando un árbol hechizado despierta (para el sonido) */
  alDespertar?: (x: number, y: number) => void

  constructor(
    private escena: Phaser.Scene,
    m: Manifest,
    decos: readonly Deco[],
  ) {
    decos.forEach((d, i) => {
      const def = m.mundo.objetos[d.sprite]
      if (!def) return
      const anim = def.anims.idle ? 'idle' : def.anims.girar ? 'girar' : def.anims.dormido ? 'dormido' : Object.keys(def.anims)[0]!
      if (!escena.textures.exists(K.obj(d.sprite, anim))) return
      const x0 = d.x - def.apoyo[0]
      const y0 = d.y - def.apoyo[1]
      const dd: DefDeco = {
        i,
        nombre: d.sprite,
        def,
        x: d.x,
        y: d.y,
        ph: hash2(d.x, d.y),
        anim,
        copa: (RE_COPA.test(d.sprite) && def.h >= 64) || !!def.anims.copa,
        hechizado: !!def.anims.despierto,
        pasto: d.sprite === 'pasto_alto' && !!def.anims.apartar_izq && !!def.anims.apartar_der,
        separado: !!def.anims.copa && !!(def.anims.tronco || def.anims.tronco_dormido),
        capaSuelo: def.capa === 'suelo',
        x0,
        y0,
        x1: x0 + def.w,
        y1: y0 + def.h,
      }
      this.defs.push(dd)
      const k = this.clave(dd.x, dd.y)
      const l = this.grilla.get(k)
      if (l) l.push(dd)
      else this.grilla.set(k, [dd])
      this.ext.izq = Math.max(this.ext.izq, def.apoyo[0])
      this.ext.der = Math.max(this.ext.der, def.w - def.apoyo[0])
      this.ext.arr = Math.max(this.ext.arr, def.apoyo[1])
      this.ext.aba = Math.max(this.ext.aba, def.h - def.apoyo[1])
    })
  }

  private clave(x: number, y: number): number {
    return Math.floor(y / DECOS.celda) * 4096 + Math.floor(x / DECOS.celda)
  }

  get total(): number {
    return this.defs.length
  }

  get cantidadActivos(): number {
    return this.activos.size
  }

  forEachActivo(fn: (a: Activo) => void): void {
    this.activos.forEach(fn)
  }

  /** Un activo por nombre de objeto, para las pruebas */
  activosDe(nombre: string): Activo[] {
    const out: Activo[] = []
    this.activos.forEach((a) => a.d.nombre === nombre && out.push(a))
    return out
  }

  private toca(d: DefDeco, v: Phaser.Geom.Rectangle, m: number): boolean {
    return d.x0 < v.right + m && d.x1 > v.x - m && d.y0 < v.bottom + m && d.y1 > v.y - m
  }

  private sprite(tex: string): Phaser.GameObjects.Sprite {
    const sp = this.libres.pop() ?? this.escena.add.sprite(0, 0, tex, 0)
    sp.setTexture(tex, 0).setAlpha(1).setAngle(0).setScale(1).setVisible(true).setActive(true)
    return sp
  }

  /** Animación de fondo del tronco (o del objeto entero) */
  private animBase(d: DefDeco): string {
    if (!d.separado) return d.anim
    return d.hechizado ? 'tronco_dormido' : 'tronco'
  }

  private activar(d: DefDeco): void {
    const anim = this.animBase(d)
    const s = this.sprite(K.obj(d.nombre, anim))
    s.setOrigin(d.def.apoyo[0] / d.def.w, d.def.apoyo[1] / d.def.h).setPosition(d.x, d.y)
    const prof = d.capaSuelo ? PROF.SUELO_OBJ + d.y / 100000 : PROF.OBJETOS + d.y
    s.setDepth(prof)
    let c: Phaser.GameObjects.Sprite | null = null
    if (d.separado) {
      // la copa va en el mismo lugar, un poquito más arriba en profundidad
      c = this.sprite(K.obj(d.nombre, 'copa'))
      c.setOrigin(d.def.apoyo[0] / d.def.w, d.def.apoyo[1] / d.def.h).setPosition(d.x, d.y).setDepth(prof + 0.5)
    }
    this.activos.set(d.i, {
      d,
      s,
      c,
      anim,
      fr: -1,
      alfa: 1,
      despierto: false,
      blinkAt: 2 + hash2(d.y, d.x) * 8,
      blinkT: -1,
      pasto: 'idle',
      pastoLado: 'izq',
      pastoT: 0,
      sonrisaT: -1,
    })
  }

  private soltar(a: Activo): void {
    this.activos.delete(a.d.i)
    for (const sp of [a.s, a.c]) {
      if (!sp) continue
      sp.setVisible(false).setActive(false)
      this.libres.push(sp)
    }
  }

  /** Activa y suelta decorados según lo que se ve */
  private reconciliar(v: Phaser.Geom.Rectangle, forzar: boolean): void {
    // los que ya no se ven
    for (const a of [...this.activos.values()]) if (!this.toca(a.d, v, DECOS.sale)) this.soltar(a)

    const u = this.ultimaVista
    const movio = Math.abs(v.x - u.x) >= 16 || Math.abs(v.y - u.y) >= 16 || v.width !== u.w || v.height !== u.h
    if (!movio && !forzar) return
    u.x = v.x
    u.y = v.y
    u.w = v.width
    u.h = v.height

    const m = DECOS.entra
    const cx0 = Math.floor((v.x - m - this.ext.der) / DECOS.celda)
    const cx1 = Math.floor((v.right + m + this.ext.izq) / DECOS.celda)
    const cy0 = Math.floor((v.y - m - this.ext.aba) / DECOS.celda)
    const cy1 = Math.floor((v.bottom + m + this.ext.arr) / DECOS.celda)
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const lista = this.grilla.get(cy * 4096 + cx)
        if (!lista) continue
        for (const d of lista) if (!this.activos.has(d.i) && this.toca(d, v, m)) this.activar(d)
      }
    }
  }

  /**
   * Un cuadro: reconcilia y anima. `t` es el reloj del viento en segundos, `dt` el tiempo real del cuadro.
   * Las luces de los objetos se suman a `luces`.
   */
  actualizar(t: number, dt: number, vista: Phaser.Geom.Rectangle, heroe: { x: number; y: number }, luces: Luz[], forzar = false): void {
    this.reconciliar(vista, forzar)

    for (const a of this.activos.values()) {
      const d = a.d
      const def = d.def
      let an = this.animBase(d)
      let frCopa: number | null = null

      // árboles hechizados: duermen, despiertan cerca, parpadean (la cara va en el tronco)
      if (d.hechizado) {
        const cerca = Math.hypot(d.x - heroe.x, d.y - 60 - heroe.y) < 130
        if (cerca && !a.despierto && t - this.despertarSonado > 6) {
          this.despertarSonado = t
          this.alDespertar?.(d.x, d.y)
        }
        a.despierto = cerca
        let estado = cerca ? 'despierto' : 'dormido'
        if (cerca && t > a.blinkAt && a.blinkT < 0) {
          a.blinkT = t
          a.blinkAt = t + 3 + hash2(d.i, Math.floor(t)) * 5
        }
        if (a.blinkT >= 0) {
          if (t - a.blinkT < 0.42) estado = 'parpadeo'
          else a.blinkT = -1
        }
        an = d.separado ? `tronco_${estado}` : estado
        if (estado === 'parpadeo') frCopa = 0
      }

      // el Abuelo Roble sonríe cuando lo tocan
      let sonrisa = false
      if (a.sonrisaT >= 0) {
        const infoS = def.anims[d.separado ? 'tronco_sonreir' : 'sonreir']
        if (infoS && t - a.sonrisaT < infoS.cuadros / infoS.fps) {
          an = d.separado ? 'tronco_sonreir' : 'sonreir'
          sonrisa = true
          frCopa = 0
        } else a.sonrisaT = -1
      }

      // pasto alto: se abre al cruzarlo y se cierra cuando la heroína se va
      let pastoAnim: string | null = null
      if (d.pasto) {
        const dx = heroe.x - d.x
        const dy = heroe.y - d.y
        const cerca = Math.abs(dx) < 20 && dy > -8 && dy < 14
        if (cerca && (a.pasto === 'idle' || a.pasto === 'cerrando')) {
          a.pasto = 'abriendo'
          a.pastoT = t
          a.pastoLado = dx > 0 ? 'izq' : 'der'
        } else if (!cerca && (a.pasto === 'abierto' || a.pasto === 'abriendo')) {
          a.pasto = 'cerrando'
          a.pastoT = t
        }
        if (a.pasto !== 'idle') {
          const ai = def.anims[`apartar_${a.pastoLado}`]!
          const dur = ai.cuadros / ai.fps
          const el = t - a.pastoT
          pastoAnim = `apartar_${a.pastoLado}`
          if (a.pasto === 'abriendo') {
            if (el >= dur) a.pasto = 'abierto'
            else a.fr = -2 // fuerza el cuadro
          } else if (a.pasto === 'cerrando' && el >= dur) a.pasto = 'idle'
          if (a.pasto === 'idle') pastoAnim = null
        }
      }

      let nombre = pastoAnim ?? an
      let forzadaF = -1
      if (a.forzada) {
        const fi = def.anims[a.forzada.anim]
        const el = t - a.forzada.t0
        if (fi && el < fi.cuadros / fi.fps) {
          nombre = a.forzada.anim
          forzadaF = Math.min(fi.cuadros - 1, Math.floor(el * fi.fps))
        } else a.forzada = undefined
      }
      const info = def.anims[nombre]
      if (!info) continue
      let f: number
      if (forzadaF >= 0) f = forzadaF
      else if (pastoAnim) {
        const el = t - a.pastoT
        const maxF = info.cuadros - 1
        if (a.pasto === 'abriendo') f = Math.min(maxF, Math.floor(el * info.fps))
        else if (a.pasto === 'abierto') f = maxF
        else f = Math.max(0, maxF - Math.floor(el * info.fps))
      } else if (an === 'parpadeo' || an === 'tronco_parpadeo') f = Math.min(info.cuadros - 1, Math.floor((t - a.blinkT) * info.fps))
      else if (sonrisa) f = Math.min(info.cuadros - 1, Math.floor((t - a.sonrisaT) * info.fps))
      else f = Math.floor(t * info.fps + d.ph * info.cuadros) % info.cuadros

      if (nombre !== a.anim) {
        a.anim = nombre
        a.fr = f
        a.s.setTexture(K.obj(d.nombre, nombre), f)
      } else if (f !== a.fr) {
        a.fr = f
        a.s.setFrame(f)
      }
      if (a.c) {
        const fc = frCopa ?? f
        if (a.c.frame.name !== String(fc)) a.c.setFrame(fc)
      }

      // luz propia del objeto
      if (def.luz) luces.push({ x: d.x, y: d.y - (def.luz.dy ?? 0), r: def.luz.radius, color: def.luz.color, flicker: def.luz.flicker, pulse: def.luz.pulse, ph: d.ph })
      // luz de los ojos de un árbol despierto
      if (a.despierto && !an.endsWith('dormido')) luces.push({ x: d.x, y: d.y - 54, r: 46, color: d.nombre.endsWith('1') ? COLOR.OJOS_HECHIZADO_1 : COLOR.OJOS_HECHIZADO, pulse: true, ph: d.ph })

      // copas: transparentes cuando la heroína pasa detrás. Con tronco y copa separados, solo baja la copa.
      if (d.copa) {
        const detras = heroe.x > d.x0 && heroe.x < d.x1 && heroe.y > d.y0 && heroe.y < d.y
        const meta = detras ? 0.45 : 1
        if (a.alfa !== meta) {
          a.alfa += (meta - a.alfa) * Math.min(1, dt * 14)
          if (Math.abs(a.alfa - meta) < 0.01) a.alfa = meta
          ;(a.c ?? a.s).setAlpha(a.alfa)
        }
      }
    }
  }

  /** Toca una animación una vez sobre los decorados activos con ese nombre (el portal que se abre) */
  reproducir(t: number, nombre: string, anim: string): boolean {
    let hubo = false
    for (const a of this.activos.values()) {
      if (a.d.nombre === nombre && a.d.def.anims[anim]) {
        a.forzada = { anim, t0: t }
        hubo = true
      }
    }
    return hubo
  }

  /** Un toque sobre el Abuelo Roble: sonríe. Devuelve true si había uno cerca del punto. */
  sonreir(t: number, x: number, y: number): boolean {
    for (const a of this.activos.values()) {
      const d = a.d
      if (!d.def.anims.sonreir && !d.def.anims.tronco_sonreir) continue
      if (x > d.x0 && x < d.x1 && y > d.y0 && y < d.y + 30) {
        a.sonrisaT = t
        return true
      }
    }
    return false
  }

  /** Suelta todo (al cerrar la escena) */
  destruir(): void {
    for (const a of this.activos.values()) {
      a.s.destroy()
      a.c?.destroy()
    }
    for (const s of this.libres) s.destroy()
    this.activos.clear()
    this.libres = []
  }
}
