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
  capaSuelo: boolean
  /** rectángulo del sprite en el mundo */
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Resorte {
  a: number
  v: number
  e: number
  ve: number
}

export interface Activo {
  d: DefDeco
  s: Phaser.GameObjects.Sprite
  anim: string
  fr: number
  alfa: number
  despierto: boolean
  blinkAt: number
  blinkT: number
  res: Resorte
  empuje: number
}

/** Árboles y objetos que se vuelven transparentes cuando la heroína pasa detrás */
const RE_COPA = /^(roble|pino|arbol|sauce|abuelo)/

/** Pasto alto: se aparta al pasar */
const RESORTE = { k: 120, c: 9 }

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
        copa: RE_COPA.test(d.sprite) && def.h >= 64,
        hechizado: !!def.anims.despierto,
        pasto: d.sprite === 'pasto_alto',
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

  private activar(d: DefDeco): void {
    const s = this.libres.pop() ?? this.escena.add.sprite(0, 0, K.obj(d.nombre, d.anim), 0)
    s.setTexture(K.obj(d.nombre, d.anim), 0)
    s.setOrigin(d.def.apoyo[0] / d.def.w, d.def.apoyo[1] / d.def.h)
    s.setPosition(d.x, d.y)
    s.setAlpha(1).setAngle(0).setScale(1).setVisible(true).setActive(true)
    s.setDepth(d.capaSuelo ? PROF.SUELO_OBJ + d.y / 100000 : PROF.OBJETOS + d.y)
    this.activos.set(d.i, {
      d,
      s,
      anim: d.anim,
      fr: -1,
      alfa: 1,
      despierto: false,
      blinkAt: 2 + hash2(d.y, d.x) * 8,
      blinkT: -1,
      res: { a: 0, v: 0, e: 1, ve: 0 },
      empuje: 0,
    })
  }

  private soltar(a: Activo): void {
    this.activos.delete(a.d.i)
    a.s.setVisible(false).setActive(false)
    this.libres.push(a.s)
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
      let an = a.anim

      // árboles hechizados: duermen, despiertan cerca, parpadean
      if (d.hechizado) {
        const cerca = Math.hypot(d.x - heroe.x, d.y - 60 - heroe.y) < 130
        if (cerca && !a.despierto && t - this.despertarSonado > 6) {
          this.despertarSonado = t
          this.alDespertar?.(d.x, d.y)
        }
        a.despierto = cerca
        an = cerca ? 'despierto' : 'dormido'
        if (cerca && t > a.blinkAt && a.blinkT < 0) {
          a.blinkT = t
          a.blinkAt = t + 3 + hash2(d.i, Math.floor(t)) * 5
        }
        if (a.blinkT >= 0) {
          if (t - a.blinkT < 0.42) an = 'parpadeo'
          else a.blinkT = -1
        }
      }

      const info = def.anims[an]
      if (!info) continue
      const f = an === 'parpadeo' ? Math.min(info.cuadros - 1, Math.floor((t - a.blinkT) * info.fps)) : Math.floor(t * info.fps + d.ph * info.cuadros) % info.cuadros
      if (an !== a.anim) {
        a.anim = an
        a.fr = f
        a.s.setTexture(K.obj(d.nombre, an), f)
      } else if (f !== a.fr) {
        a.fr = f
        a.s.setFrame(f)
      }

      // luz propia del objeto
      if (def.luz) luces.push({ x: d.x, y: d.y - (def.luz.dy ?? 0), r: def.luz.radius, color: def.luz.color, flicker: def.luz.flicker, pulse: def.luz.pulse, ph: d.ph })
      // luz de los ojos de un árbol despierto
      if (a.despierto && an !== 'dormido') luces.push({ x: d.x, y: d.y - 54, r: 46, color: d.nombre.endsWith('1') ? COLOR.OJOS_HECHIZADO_1 : COLOR.OJOS_HECHIZADO, pulse: true, ph: d.ph })

      // copas: transparentes cuando la heroína pasa detrás
      if (d.copa) {
        const detras = heroe.x > d.x0 && heroe.x < d.x1 && heroe.y > d.y0 && heroe.y < d.y
        const meta = detras ? 0.45 : 1
        if (a.alfa !== meta) {
          a.alfa += (meta - a.alfa) * Math.min(1, dt * 14)
          if (Math.abs(a.alfa - meta) < 0.01) a.alfa = meta
          a.s.setAlpha(a.alfa)
        }
      }

      // pasto alto: se aparta con un resorte que rebota
      if (d.pasto) {
        const dx = heroe.x - d.x
        const dy = heroe.y - d.y
        const cerca = Math.abs(dx) < 20 && dy > -8 && dy < 14
        const r = a.res
        const metaA = cerca ? (dx > 0 ? -12 : 12) : 0
        const metaE = cerca ? 0.85 : 1
        if (cerca || Math.abs(r.a) > 0.02 || Math.abs(r.v) > 0.05 || Math.abs(r.e - 1) > 0.002 || Math.abs(r.ve) > 0.002) {
          const h = Math.min(dt, 0.033)
          r.v += (-RESORTE.k * (r.a - metaA) - RESORTE.c * r.v) * h
          r.a += r.v * h
          r.ve += (-RESORTE.k * (r.e - metaE) - RESORTE.c * r.ve) * h
          r.e += r.ve * h
          a.s.setAngle(r.a)
          a.s.setScale(1, r.e)
          a.empuje = cerca ? 1 : 0
        }
      }
    }
  }

  /** Suelta todo (al cerrar la escena) */
  destruir(): void {
    for (const a of this.activos.values()) a.s.destroy()
    for (const s of this.libres) s.destroy()
    this.activos.clear()
    this.libres = []
  }
}
