import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { MapaJuego } from '../kit/mapa'
import { entidadesDeTipo } from '../kit/mapa'
import { K } from '../kit/claves'
import { PROF } from '../config/juego'
import { PUERTO } from '../config/balance'
import type { Grilla } from '../logic/grilla'
import { alzarFarol, apagarFarol, caminableConMarea, farolNuevo, mareaEn, pasoFarol, radioFarolThor, secoMasCercano, type EstadoFarol, type FaseMarea } from '../logic/puerto'
import type { Luz } from './Decos'

interface FarolMuelle {
  id: string
  x: number
  y: number
  s: Phaser.GameObjects.Sprite | null
  prendido: boolean
  /** recién apagado por la figura: Thor espera esto antes de volver a prenderlo */
  esperaS?: number
}

export interface DepsPuerto {
  sonido: (nombre: string, op?: { volumen?: number; rate?: number }) => void
  /** se prendió un farol del muelle: se guarda la lista */
  alCambiar: (ids: string[]) => void
  /** la marea alcanzó a alguien: se lo lleva al seco (x, y del centro del cuadro) */
  alRescatar: (x: number, y: number) => void
  modoPeque: () => boolean
}

/**
 * El Mundo 4, El Puerto Ahogado (PLAN.md F12), con lo que trae el kit. La luz la carga Thor: un farol en la boca que
 * se dibuja encima de él cuadro por cuadro (con cualquier armadura), alumbra lo grande del piso, se apaga si lo toca una
 * medusa y crece cuando Thor lo alza. Los faroles del muelle hacen de fogata y los prende Thor al pasar. La marea sube
 * con la campana, tapa los caminos bajos y levanta los muelles flotantes.
 */
export class Puerto {
  private farol: EstadoFarol = farolNuevo()
  private capa: Phaser.GameObjects.Sprite | null = null
  private faroles: FarolMuelle[] = []
  private t = 0
  private fase: FaseMarea = 'baja'
  private liberar: (() => void) | null = null
  private bajas: number[] = []
  private altas: number[] = []
  private aguas: Phaser.GameObjects.Sprite[] = []
  private flotantes: { s: Phaser.GameObjects.Sprite; arriba: boolean }[] = []
  private tieneCapa: boolean

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
    private mapa: MapaJuego,
    private grilla: Grilla,
    prendidos: readonly string[],
    private deps: DepsPuerto,
  ) {
    this.tieneCapa = !!m.personajes.thor_farol
    // los faroles del muelle: arrancan apagados salvo los que ya prendió en esta partida
    const hay = new Set(prendidos)
    for (const e of entidadesDeTipo(mapa, 'farol_muelle')) {
      const id = String(e.props.id ?? `${e.x},${e.y}`)
      const f: FarolMuelle = { id, x: e.x, y: e.y, s: null, prendido: hay.has(id) }
      const nombre = f.prendido ? 'farol_muelle_prendido' : 'farol_muelle_apagado'
      if (this.anim(nombre)) {
        const def = m.mundo.objetos[nombre]!
        f.s = escena.add.sprite(e.x, e.y, K.obj(nombre, 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).setDepth(PROF.OBJETOS + e.y)
        f.s.play(`puerto_${nombre}`)
      }
      this.faroles.push(f)
    }
    // la marea: los cuadros que tapa la alta llevan agua encima, los que solo se pisan con la alta un muelle flotante
    const c = mapa.cuadro
    for (let i = 0; i < mapa.marea.length; i++) {
      if (mapa.marea[i] === 1) this.bajas.push(i)
      else if (mapa.marea[i] === 2) this.altas.push(i)
    }
    if (this.anim('agua_marea')) {
      for (const i of this.bajas) {
        const s = escena.add.sprite((i % mapa.ancho) * c + c / 2, Math.floor(i / mapa.ancho) * c + c / 2, K.obj('agua_marea', 'idle'), 0).setDepth(PROF.SUELO_OBJ + 0.2).setAlpha(0)
        s.play('puerto_agua_marea')
        this.aguas.push(s)
      }
    }
    if (this.anim('muelle_flotante')) {
      // un muelle de 2 cuadros por cada par de cuadros seguidos de la fila
      const usado = new Set<number>()
      for (const i of this.altas) {
        if (usado.has(i)) continue
        usado.add(i)
        const par = mapa.marea[i + 1] === 2 && (i + 1) % mapa.ancho !== 0
        if (par) usado.add(i + 1)
        const x = (i % mapa.ancho) * c + (par ? c : c / 2)
        const y = Math.floor(i / mapa.ancho) * c + c / 2
        const s = escena.add.sprite(x, y, K.obj('muelle_flotante', 'abajo'), 0).setDepth(PROF.SUELO_OBJ + 0.3)
        this.flotantes.push({ s, arriba: false })
      }
    }
    this.aplicarMarea('baja')
  }

  /** Crea la animación de un objeto del mundo (la primera que traiga) y dice si existe */
  private anim(nombre: string, cual?: string): boolean {
    const def = this.m.mundo.objetos[nombre]
    if (!def) return false
    const a = cual ?? Object.keys(def.anims)[0]!
    const info = def.anims[a]
    const tex = K.obj(nombre, a)
    if (!info || !this.escena.textures.exists(tex)) return false
    const key = cual ? `puerto_${nombre}_${a}` : `puerto_${nombre}`
    if (!this.escena.anims.exists(key)) this.escena.anims.create({ key, frames: this.escena.anims.generateFrameNumbers(tex, { start: 0, end: info.cuadros - 1 }), frameRate: info.fps, repeat: info.loop === false ? 0 : -1 })
    return true
  }

  /* ---------- el farol de Thor ---------- */

  /** Thor alza el farol (aullido): la luz crece y si estaba apagado vuelve a prender */
  alzar(): boolean {
    const r = alzarFarol(this.farol)
    if (!r.ok) return false
    this.farol = r.e
    this.deps.sonido(this.escena.cache.audio.exists(K.aud('thor_alza_farol')) ? 'thor_alza_farol' : 'aullido', { volumen: 0.6 })
    return true
  }

  /** Una medusa tocó a Thor */
  apagar(): void {
    const antes = this.farol.apagadoS
    this.farol = apagarFarol(this.farol, this.deps.modoPeque())
    if (this.farol.apagadoS > antes && this.escena.cache.audio.exists(K.aud('farol_apagar'))) this.deps.sonido('farol_apagar', { volumen: 0.5 })
  }

  get radioThor(): number {
    return radioFarolThor(this.farol, this.deps.modoPeque())
  }

  get farolApagado(): boolean {
    return this.farol.apagadoS > 0
  }

  get farolAlzado(): boolean {
    return this.farol.alzadoS > 0
  }

  /** Lo que falta para poder alzarlo otra vez (1 recién alzado, 0 listo): el arco del botón */
  get recargaFraccion(): number {
    return Math.max(0, Math.min(1, this.farol.recargaS / PUERTO.farol.recargaAlzarS))
  }

  /** El farol encima de Thor: el mismo cuadro de la misma animación en la capa del taller */
  private seguirThor(thor: Phaser.GameObjects.Sprite): void {
    if (!this.tieneCapa) return
    const key = thor.texture.key
    // p_<id>_<anim>: el anim es lo que va después del último id de Thor (thor o thor_armaduraN)
    const m = /^p_thor(?:_armadura\d+)?_(.+)$/.exec(key)
    const id = this.farol.apagadoS > 0 ? 'thor_farol_apagado' : 'thor_farol'
    const tex = m ? K.pers(id, m[1]!) : null
    if (!tex || !this.escena.textures.exists(tex)) {
      this.capa?.setVisible(false)
      return
    }
    if (!this.capa) this.capa = this.escena.add.sprite(0, 0, tex, 0)
    if (this.capa.texture.key !== tex) this.capa.setTexture(tex, thor.frame.name)
    else if (this.capa.frame.name !== thor.frame.name) this.capa.setFrame(thor.frame.name)
    this.capa.setVisible(thor.visible).setOrigin(thor.originX, thor.originY).setPosition(thor.x, thor.y).setFlipX(thor.flipX).setScale(thor.scaleX, thor.scaleY).setAlpha(thor.alpha).setDepth(thor.depth + 0.05)
  }

  /* ---------- la marea ---------- */

  get marea(): ReturnType<typeof mareaEn> {
    return mareaEn(this.t, this.deps.modoPeque())
  }

  private aplicarMarea(fase: FaseMarea): void {
    this.fase = fase
    this.liberar?.()
    const cerrados = [...this.bajas.filter(() => !caminableConMarea('baja', fase)), ...this.altas.filter(() => !caminableConMarea('alta', fase))]
    this.liberar = cerrados.length ? this.grilla.bloquearIndices(cerrados) : null
  }

  /* ---------- cada cuadro ---------- */

  update(dt: number, thor: { sprite: Phaser.GameObjects.Sprite; x: number; y: number }, gente: readonly { x: number; y: number }[], luces: Luz[]): void {
    this.t += dt
    this.farol = pasoFarol(this.farol, dt)
    this.seguirThor(thor.sprite)
    // la luz de Thor: la grande del piso, cálida y que titila apenas
    luces.push({ x: thor.x, y: thor.y - 18, r: this.radioThor, color: '#ffc070', flicker: true, ph: 0.6, alto: 18 })
    // los faroles del muelle: Thor los prende al pasar y quedan prendidos
    for (const f of this.faroles) {
      if (f.esperaS) f.esperaS = Math.max(0, f.esperaS - dt)
      if (!f.prendido && !f.esperaS && Math.hypot(thor.x - f.x, thor.y - f.y) < 64) this.prender(f)
      if (f.prendido) {
        const l = this.m.mundo.objetos.farol_muelle_prendido?.luz
        luces.push({ x: f.x, y: f.y - (l?.dy ?? 40), r: l?.radius ?? 180, color: l?.color ?? '#ffc070', flicker: true, ph: (f.x * 0.01) % 1, alto: l?.dy ?? 40 })
      }
    }
    // la marea: sube con la campana, tapa y destapa
    const ma = this.marea
    if (ma.fase !== this.fase) {
      if (ma.fase === 'subiendo') this.deps.sonido(this.escena.cache.audio.exists(K.aud('campana_lejos')) ? 'campana_lejos' : 'campana', { volumen: 0.45 })
      if (ma.fase === 'subiendo' && this.escena.cache.audio.exists(K.aud('marea_sube'))) this.deps.sonido('marea_sube', { volumen: 0.4 })
      this.aplicarMarea(ma.fase)
      // la marea alcanzó a alguien en un cuadro que se cerró: se lo lleva suave al seco más cercano
      for (const g of gente) {
        const { tx, ty } = this.grilla.cuadroDe(g.x, g.y)
        if (this.grilla.caminable(tx, ty)) continue
        const s = secoMasCercano(tx, ty, (x, y) => this.grilla.caminable(x, y))
        if (s) this.deps.alRescatar(s.x * this.mapa.cuadro + this.mapa.cuadro / 2, s.y * this.mapa.cuadro + this.mapa.cuadro / 2)
      }
    }
    for (const s of this.aguas) s.setAlpha(ma.agua * 0.92)
    const arriba = ma.fase === 'alta' || ma.fase === 'bajando'
    for (const fl of this.flotantes) {
      if (fl.arriba === arriba) continue
      fl.arriba = arriba
      fl.s.setTexture(K.obj('muelle_flotante', arriba ? 'arriba' : 'abajo'), 0)
      if (arriba && this.anim('muelle_flotante', 'arriba')) fl.s.play('puerto_muelle_flotante_arriba')
    }
  }

  private prender(f: FarolMuelle): void {
    f.prendido = true
    this.deps.sonido(this.escena.cache.audio.exists(K.aud('farol_prender')) ? 'farol_prender' : 'fogata_prender', { volumen: 0.6 })
    if (f.s && this.anim('farol_muelle_prenderse') && this.anim('farol_muelle_prendido')) {
      const def = this.m.mundo.objetos.farol_muelle_prendido!
      f.s.setTexture(K.obj('farol_muelle_prenderse', 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).play('puerto_farol_muelle_prenderse')
      f.s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => f.s?.play('puerto_farol_muelle_prendido'))
    }
    this.deps.alCambiar(this.faroles.filter((q) => q.prendido).map((q) => q.id))
  }

  /** La figura se fue y se llevó la luz del farol del muelle más cercano (Thor lo vuelve a prender al pasar) */
  apagarMuelleCerca(x: number, y: number, radio: number): string | null {
    const f = this.faroles.filter((q) => q.prendido && Math.hypot(q.x - x, q.y - y) <= radio).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]
    if (!f) return null
    f.prendido = false
    // Thor no lo vuelve a prender en el mismo instante: tiene que alejarse y volver
    f.esperaS = 3
    if (f.s && this.anim('farol_muelle_apagado')) {
      const def = this.m.mundo.objetos.farol_muelle_apagado!
      f.s.setTexture(K.obj('farol_muelle_apagado', 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).play('puerto_farol_muelle_apagado')
    }
    if (this.escena.cache.audio.exists(K.aud('farol_apagar'))) this.deps.sonido('farol_apagar', { volumen: 0.6, rate: 0.8 })
    this.deps.alCambiar(this.faroles.filter((q) => q.prendido).map((q) => q.id))
    return f.id
  }

  /** F12: el faro se prendió: todos los faroles del muelle se prenden (de a uno si se anima) */
  prenderTodos(animar: boolean): void {
    const apagados = this.faroles.filter((f) => !f.prendido)
    if (!animar) {
      for (const f of apagados) {
        f.prendido = true
        if (f.s && this.anim('farol_muelle_prendido')) {
          const def = this.m.mundo.objetos.farol_muelle_prendido!
          f.s.setTexture(K.obj('farol_muelle_prendido', 'idle'), 0).setOrigin(def.apoyo[0] / def.w, def.apoyo[1] / def.h).play('puerto_farol_muelle_prendido')
        }
      }
      if (apagados.length) this.deps.alCambiar(this.faroles.map((q) => q.id))
      return
    }
    apagados.forEach((f, i) => this.escena.time.delayedCall(400 + i * 350, () => !f.prendido && this.prender(f)))
  }

  /** Para las pruebas */
  get info() {
    const ma = this.marea
    return {
      marea: ma.fase,
      agua: Math.round(ma.agua * 100) / 100,
      cerrados: this.bajas.filter(() => !caminableConMarea('baja', ma.fase)).length + this.altas.filter(() => !caminableConMarea('alta', ma.fase)).length,
      faroles: this.faroles.map((f) => ({ id: f.id, x: f.x, y: f.y, prendido: f.prendido })),
      farol: { radio: this.radioThor, apagado: this.farolApagado, alzado: this.farolAlzado, capa: !!this.capa?.visible },
      // un cuadro de cada marea (el centro), para las pruebas
      celdaBaja: this.centro(this.bajas[Math.floor(this.bajas.length / 2)]),
      celdaAlta: this.centro(this.altas[Math.floor(this.altas.length / 2)]),
    }
  }

  private centro(i: number | undefined): { x: number; y: number } | null {
    if (i === undefined) return null
    const c = this.mapa.cuadro
    return { x: (i % this.mapa.ancho) * c + c / 2, y: Math.floor(i / this.mapa.ancho) * c + c / 2 }
  }

  /** Para las pruebas: adelanta el reloj de la marea */
  adelantar(s: number): void {
    this.t += s
  }

  destruir(): void {
    this.liberar?.()
    this.capa?.destroy()
    for (const f of this.faroles) f.s?.destroy()
    for (const s of this.aguas) s.destroy()
    for (const f of this.flotantes) f.s.destroy()
  }
}
