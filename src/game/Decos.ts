import Phaser from 'phaser'
import type { Manifest, ObjetoMundo } from '../kit/tipos'
import type { Deco } from '../kit/mapa'
import { K } from '../kit/claves'
import { COLOR, DECOS, PROF, REFLEJO } from '../config/juego'
import { hash2 } from '../logic/azar'
import { aguaDebajo, meneoReflejo, tiraSombra, type CfgSombra, type MapaAgua } from '../logic/luzMundo'
import { meneo, reaccionDe, tocaReaccion, type Reaccion } from '../logic/reaccion'

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
  /** tira sombra larga (F10) */
  sombra: boolean
  /** está a la orilla del agua: se refleja */
  refleja: boolean
  /** se sacude, rebota o salpica al pasar (F10) */
  reac: Reaccion | null
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
  /** sombras largas del objeto (y de su copa), con el mismo cuadro */
  sh: Phaser.GameObjects.Sprite[]
  /** reflejos en el agua, con el mismo cuadro */
  rf: Phaser.GameObjects.Sprite[]
  /** reloj en que empezó a reaccionar (-1 quieto) y hacia qué lado lo empujaron */
  reacT: number
  reacLado: number
  /** estaba tocado el cuadro anterior: reacciona al entrar, no todo el rato */
  tocado: boolean
}

export interface OpcionesDecos {
  /** sombras largas del mundo, o null si no hay */
  sombra?: CfgSombra | null
  /** el agua del mapa, para los reflejos */
  agua?: MapaAgua | null
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
  /** algo reaccionó al paso: el juego suelta las partículas y el sonido */
  alReaccionar?: (r: Reaccion, x: number, y: number, ancho: number, alto: number) => void
  /** además de la heroína, quién más mueve los arbustos (Thor) */
  otros: { x: number; y: number }[] = []
  /** reloj propio de las reacciones: el del viento se acelera en las ráfagas */
  private reloj = 0
  private reacciones = 0

  private conSombras = true
  private conReflejos = true

  /** Se apagan en calidad baja: las que ya están en pantalla se van al momento, las que entran después ya no las traen */
  set sombrasLargas(v: boolean) {
    if (v === this.conSombras) return
    this.conSombras = v
    if (!v) this.activos.forEach((a) => this.quitarExtras(a.sh))
  }

  get sombrasLargas(): boolean {
    return this.conSombras
  }

  set reflejos(v: boolean) {
    if (v === this.conReflejos) return
    this.conReflejos = v
    if (!v) this.activos.forEach((a) => this.quitarExtras(a.rf))
  }

  get reflejos(): boolean {
    return this.conReflejos
  }

  private quitarExtras(lista: Phaser.GameObjects.Sprite[]): void {
    for (const k of lista) {
      k.setVisible(false).setActive(false)
      this.libres.push(k)
    }
    lista.length = 0
  }
  private cfgSombra: CfgSombra | null

  constructor(
    private escena: Phaser.Scene,
    m: Manifest,
    decos: readonly Deco[],
    op: OpcionesDecos = {},
  ) {
    this.cfgSombra = op.sombra ?? null
    const cfgS = this.cfgSombra
    const agua = op.agua ?? null
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
        sombra: !!cfgS && tiraSombra(d.sprite, def, cfgS),
        refleja: !!agua && def.capa !== 'suelo' && aguaDebajo(agua, d.x, d.y, REFLEJO.cerca),
        reac: reaccionDe(d.sprite),
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

  /** Cuántas sombras largas y reflejos hay en pantalla (para las pruebas) */
  contarEfectos(): { sombras: number; reflejos: number } {
    let sombras = 0, reflejos = 0
    this.activos.forEach((a) => {
      sombras += a.sh.length
      reflejos += a.rf.length
    })
    return { sombras, reflejos }
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
    sp.setTexture(tex, 0).setAlpha(1).setAngle(0).setScale(1).clearTint().setVisible(true).setActive(true)
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
    // sombras y reflejos: el mismo cuadro, sin dibujar nada nuevo
    const sh: Phaser.GameObjects.Sprite[] = []
    const rf: Phaser.GameObjects.Sprite[] = []
    const cs = this.cfgSombra
    for (const fuente of [s, c]) {
      if (!fuente) continue
      if (d.sombra && cs && this.sombrasLargas) {
        const k = this.sprite(fuente.texture.key)
        k.setOrigin(fuente.originX, fuente.originY).setPosition(d.x, d.y).setTint(0x000000).setAlpha(cs.alfa).setScale(1, -cs.largo).setAngle(cs.angulo).setDepth(PROF.SOMBRAS)
        sh.push(k)
      }
      if (d.refleja && this.reflejos) {
        const k = this.sprite(fuente.texture.key)
        k.setOrigin(fuente.originX, fuente.originY).setPosition(d.x, d.y).setTint(REFLEJO.tinte).setAlpha(REFLEJO.alfa).setScale(1, -1).setDepth(PROF.REFLEJO)
        rf.push(k)
      }
    }
    this.activos.set(d.i, {
      d,
      s,
      c,
      sh,
      rf,
      reacT: -1,
      reacLado: 1,
      tocado: false,
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
    for (const sp of [a.s, a.c, ...a.sh, ...a.rf]) {
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
    this.reloj += dt
    const quienes = [heroe, ...this.otros]

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
      // sombras y reflejos copian el cuadro (el primero es del objeto o del tronco, el segundo de la copa)
      if (a.sh.length || a.rf.length) {
        const copiar = (k: Phaser.GameObjects.Sprite, i: number) => {
          const src = i === 0 ? a.s : (a.c ?? a.s)
          if (k.texture !== src.texture) k.setTexture(src.texture.key, src.frame.name)
          else if (k.frame !== src.frame) k.setFrame(src.frame.name)
        }
        a.sh.forEach(copiar)
        a.rf.forEach((k, i) => {
          copiar(k, i)
          k.x = d.x + meneoReflejo(t, d.ph)
        })
      }

      if (d.reac) this.reaccionar(a, d.reac, quienes, t)

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

  /** Arbustos que se sacuden, hongos que rebotan, charcos que salpican. Con la animación del taller si la trae. */
  private reaccionar(a: Activo, r: Reaccion, quienes: { x: number; y: number }[], t: number): void {
    const d = a.d
    let quien: { x: number; y: number } | null = null
    for (const q of quienes) if (tocaReaccion(r, d.def.w, d.x, d.y, q.x, q.y)) quien = q
    const entra = !!quien && !a.tocado
    a.tocado = !!quien
    const el = this.reloj - a.reacT
    if (entra && (a.reacT < 0 || el > r.espera)) {
      a.reacT = this.reloj
      a.reacLado = quien!.x < d.x ? 1 : -1
      this.reacciones++
      if (d.def.anims[r.tipo]) a.forzada = { anim: r.tipo, t0: t }
      this.alReaccionar?.(r, d.x, d.y, d.def.w, d.def.h)
    }
    if (a.reacT < 0 || d.def.anims[r.tipo]) return
    const m = meneo(r, this.reloj - a.reacT, a.reacLado)
    for (const sp of [a.s, a.c]) sp?.setAngle(m.angulo).setScale(m.sx, m.sy).setX(d.x + m.dx)
    if (m.angulo === 0 && m.sy === 1 && m.sx === 1) a.reacT = -1
  }

  /** Cuántas veces reaccionó algo desde que empezó el mundo (para las pruebas) */
  get totalReacciones(): number {
    return this.reacciones
  }

  /** Posiciones de todos los decorados con ese nombre (las piedras de la arena) */
  posicionesDe(nombre: string): { x: number; y: number }[] {
    return this.defs.filter((d) => d.nombre === nombre).map((d) => ({ x: d.x, y: d.y }))
  }

  /** Cambia la animación de fondo de un decorado en (x, y): las piedras de la arena que se encienden una tras otra */
  fijarAnim(nombre: string, x: number, y: number, anim: string): boolean {
    let hubo = false
    for (const d of this.defs) {
      if (d.nombre === nombre && Math.abs(d.x - x) < 2 && Math.abs(d.y - y) < 2 && d.def.anims[anim]) {
        d.anim = anim
        hubo = true
      }
    }
    return hubo
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
      for (const k of [...a.sh, ...a.rf]) k.destroy()
    }
    for (const s of this.libres) s.destroy()
    this.activos.clear()
    this.libres = []
  }
}
