import Phaser from 'phaser'
import type { Manifest } from '../kit/tipos'
import type { EmisorZona } from '../kit/mapa'
import { K } from '../kit/claves'
import { COLOR, PROF, CALIDAD, type Calidad } from '../config/juego'
import { fx } from '../logic/azar'
import type { Activo, Luz } from '../game/Decos'

/**
 * Partículas del mundo (PLAN.md 2.4 y 2.5): las de cada zona, los emisores pegados a objetos
 * (brasas de la fogata, gotas de la cascada...) y las criaturas que flotan (fuegos fatuos, murciélagos).
 * Se simulan a mano como en el visor del taller y están limitadas por la calidad.
 */

type Tipo = 'luciernaga' | 'fuego' | 'hoja' | 'mariposa' | 'mota' | 'murcielago'

interface Particula {
  tipo: Tipo
  /** nombre del kit: polen, brasa, hoja_verde... */
  llave: string
  s: Phaser.GameObjects.Sprite
  x: number
  y: number
  vx: number
  vy: number
  edad: number
  vida: number
  ph: number
  tex: string
  cuadros: number
  fps: number
  w: number
  h: number
  /** el cuadro avanza con la edad y no en ciclo (el humo crece) */
  porEdad: boolean
  /** afectada por la gravedad (gotas) */
  gravedad: number
  violeta: boolean
  fr: number
  /** nace de un emisor local y no cuenta para el tope de la zona */
  local: boolean
  alfaMax: number
  /** aparece de golpe (las huellas) en vez de entrar de a poco */
  sinEntrada?: boolean
}

export interface ContextoParticulas {
  emisores: readonly EmisorZona[]
  /** noche + oscuridad de la zona, como en el visor */
  noche: number
  /** las luces que dejan brasas y fuegos fatuos se suman aquí */
  luces: Luz[]
  /** mientras sopla una ráfaga salen más hojas */
  rafaga: boolean
  /** decorados activos con emisor propio */
  decos: ((fn: (a: Activo) => void) => void) | null
  /** F8: en un interior las partículas de ambiente no nacen sobre los muros (ahí no hay aire, es techo) */
  sobreMuro?: (x: number, y: number) => boolean
}

const BRILLAN = new Set<Tipo>(['luciernaga', 'fuego'])

export class Particulas {
  private lista: Particula[] = []
  private libres: Phaser.GameObjects.Sprite[] = []
  private calidad: Calidad = 'alta'
  private acumLocal = new Map<string, number>()

  constructor(
    private escena: Phaser.Scene,
    private m: Manifest,
  ) {}

  setCalidad(c: Calidad): void {
    this.calidad = c
    // al bajar el tope se sueltan las que sobran, no se esperan a que mueran solas
    while (this.lista.length > this.tope) this.soltar(this.lista.pop()!)
  }

  get cantidad(): number {
    return this.lista.length
  }

  get tope(): number {
    return CALIDAD[this.calidad].particulas
  }

  private factor(): number {
    return CALIDAD[this.calidad].particulas / CALIDAD.alta.particulas
  }

  private cuenta(tipo: Tipo, llave?: string): number {
    let n = 0
    for (const p of this.lista) if (p.tipo === tipo && (!llave || p.llave === llave) && !p.local) n++
    return n
  }

  /** Todas las de una llave, también las de emisores locales (para las pruebas) */
  cuantasDe(llave: string): number {
    return this.lista.reduce((n, p) => n + (p.llave === llave ? 1 : 0), 0)
  }

  private crear(tipo: Tipo, llave: string, x: number, y: number, extra: Partial<Particula> = {}): Particula | null {
    if (this.lista.length >= this.tope) return null
    let tex: string
    let cuadros: number
    let fps: number
    let w: number
    let h: number
    if (tipo === 'fuego') {
      const nombre = extra.violeta ? 'fuego_fatuo_violeta' : 'fuego_fatuo'
      const a = this.m.mundo.criaturas[nombre]!.anims.flotar!
      tex = K.cri(nombre, 'flotar')
      cuadros = a.cuadros
      fps = a.fps
      w = 16
      h = 16
    } else if (tipo === 'murcielago') {
      const a = this.m.mundo.criaturas.murcielago!.anims.volar!
      tex = K.cri('murcielago', 'volar')
      cuadros = a.cuadros
      fps = a.fps
      w = 16
      h = 8
    } else {
      const d = this.m.mundo.particulas[llave]
      if (!d || !this.escena.textures.exists(K.par(llave))) return null
      tex = K.par(llave)
      cuadros = d.cuadros
      fps = d.fps
      w = d.w
      h = d.h
    }
    const s = this.libres.pop() ?? this.escena.add.sprite(0, 0, tex, 0)
    s.setTexture(tex, 0).setActive(true).setVisible(true).setAlpha(0).setScale(1).setAngle(0).setFlipX(false).setOrigin(0.5, 0.5).clearTint()
    const brilla = BRILLAN.has(tipo) || llave === 'brillo'
    s.setBlendMode(brilla ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
    s.setDepth(brilla ? PROF.BRILLA_EN_OSCURO : PROF.PARTICULAS)
    const p: Particula = {
      tipo, llave, s, x, y, vx: 0, vy: 0, edad: 0, vida: 6, ph: fx().next() * 9, tex, cuadros, fps, w, h,
      porEdad: false, gravedad: 0, violeta: false, fr: -1, local: false, alfaMax: 1, ...extra,
    }
    this.lista.push(p)
    return p
  }

  /** Polvito bajo los pies */
  polvo(x: number, y: number): void {
    for (let i = 0; i < 2; i++) {
      this.crear('mota', 'polvo', x + (fx().next() - 0.5) * 8, y - 1, { vx: (fx().next() - 0.5) * 14, vy: -4 - fx().next() * 6, vida: 0.5 + fx().next() * 0.3, local: true, alfaMax: 0.9 })
    }
  }

  /**
   * Un puñado de partículas que salta de un objeto al tocarlo (F10): hojas de un arbusto, esporas de un hongo, gotas
   * de un charco. Las gotas suben y caen, el resto se va flotando hacia arriba.
   */
  rocio(llave: string, x: number, y: number, n: number, ancho: number): void {
    const cae = llave === 'gota'
    const hoja = llave.startsWith('hoja')
    for (let i = 0; i < n; i++) {
      const ox = x + (fx().next() - 0.5) * ancho * 0.7
      if (hoja) this.crear('hoja', llave, ox, y - 6 - fx().next() * 10, { vx: (fx().next() - 0.5) * 24, vy: 10 + fx().next() * 10, vida: 1.6 + fx().next(), local: true, sinEntrada: true })
      else this.crear('mota', llave, ox, y - 2 - (cae ? 0 : fx().next() * 10), {
        vx: (fx().next() - 0.5) * (cae ? 40 : 10),
        vy: cae ? -40 - fx().next() * 30 : -6 - fx().next() * 8,
        gravedad: cae ? 220 : 0,
        vida: cae ? 0.45 + fx().next() * 0.2 : 1.4 + fx().next(),
        local: true,
        sinEntrada: true,
      })
    }
  }

  /** Hojas de una ráfaga de viento */
  hojasDeRafaga(vista: Phaser.Geom.Rectangle): void {
    const n = Math.round(6 * this.factor())
    for (let i = 0; i < n; i++) {
      const llave = fx().next() < 0.5 ? 'hoja_otono' : 'hoja_verde'
      this.crear('hoja', llave, vista.x + fx().next() * vista.width, vista.y - 8 - fx().next() * 30, {
        vx: 16 + fx().next() * 14, vy: 14 + fx().next() * 10, vida: 12, local: true,
      })
    }
  }

  /** Suelta todo lo que hay (al cambiar de calidad o de zona de golpe) */
  limpiar(): void {
    for (const p of this.lista) this.soltar(p)
    this.lista = []
  }

  private soltar(p: Particula): void {
    p.s.setVisible(false).setActive(false)
    this.libres.push(p.s)
  }

  update(t: number, dt: number, vista: Phaser.Geom.Rectangle, c: ContextoParticulas): void {
    this.aparecerZona(dt, vista, c)
    this.aparecerLocales(dt, c)

    const cx = vista.x + vista.width / 2
    const cy = vista.y + vista.height / 2
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const p = this.lista[i]!
      p.edad += dt
      switch (p.tipo) {
        case 'luciernaga':
          p.x += Math.sin(t * 0.7 + p.ph) * 8 * dt
          p.y += Math.cos(t * 0.9 + p.ph * 1.3) * 6 * dt
          break
        case 'fuego':
          p.x += Math.sin(t * 0.4 + p.ph) * 14 * dt
          p.y += Math.cos(t * 0.6 + p.ph) * 9 * dt
          break
        case 'hoja':
          p.x += (p.vx + Math.sin(t * 2 + p.ph) * 14) * dt
          p.y += p.vy * dt
          break
        case 'mariposa':
          p.x += Math.sin(t * 1.3 + p.ph) * 22 * dt
          p.y += Math.sin(t * 2.1 + p.ph * 2) * 16 * dt
          break
        default:
          p.vy += p.gravedad * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
      }

      const lejos = Math.abs(p.x - cx) > vista.width || Math.abs(p.y - cy) > vista.height
      if (p.edad > p.vida || lejos) {
        this.soltar(p)
        this.lista.splice(i, 1)
        continue
      }

      // transparencia: entra y sale de a poco
      const fade = Math.min(1, p.sinEntrada ? 1 : p.edad / 0.8, (p.vida - p.edad) / 0.8)
      let alfa = fade * p.alfaMax
      if (p.tipo === 'luciernaga') alfa *= 0.6 + 0.4 * Math.sin(t * 3 + p.ph)
      else if (p.tipo === 'mota') alfa *= 0.9
      else if (p.llave === 'brillo') alfa *= 0.5 + 0.5 * Math.sin(t * 7 + p.ph * 3)
      else if (p.llave === 'humo') alfa *= 0.55
      p.s.setAlpha(Math.max(0, alfa))

      const f = p.porEdad ? Math.min(p.cuadros - 1, Math.floor((p.edad / p.vida) * p.cuadros)) : Math.floor(t * p.fps + p.ph) % p.cuadros
      if (f !== p.fr) {
        p.fr = f
        p.s.setFrame(f)
      }
      const dy = p.tipo === 'fuego' ? Math.sin(t * 2 + p.ph) * 3 : p.tipo === 'murcielago' ? Math.sin(t * 6) * 3 : 0
      p.s.setPosition(Math.round(p.x), Math.round(p.y + dy))
      if (p.tipo === 'murcielago') p.s.setFlipX(p.vx < 0)

      if (p.tipo === 'fuego') c.luces.push({ x: p.x, y: p.y, r: 44, color: p.violeta ? COLOR.FUEGO_FATUO_VIOLETA : COLOR.FUEGO_FATUO, pulse: true, ph: p.ph })
      else if (p.llave === 'brasa') c.luces.push({ x: p.x, y: p.y, r: 10, color: COLOR.BRASA, ph: p.ph })
    }
  }

  /** Lo que pide la zona, con el tope por tipo escalado por la calidad */
  private aparecerZona(dt: number, v: Phaser.Geom.Rectangle, c: ContextoParticulas): void {
    const q = this.factor()
    const quiere = (n: string) => c.emisores.some((e) => e.nombre === n)
    // en un interior se prueban unos puntos hasta caer sobre el piso (si no, el ambiente sobre el techo parece cielo)
    const punto = (): [number, number] => {
      let x = v.x + fx().next() * v.width
      let y = v.y + fx().next() * v.height
      for (let i = 0; i < 6 && c.sobreMuro?.(x, y); i++) {
        x = v.x + fx().next() * v.width
        y = v.y + fx().next() * v.height
      }
      // si no encontró piso, nace lejos de la vista y se apaga sola en el mismo cuadro
      return c.sobreMuro?.(x, y) ? [v.x - v.width * 3, v.y] : [x, y]
    }
    let ultimo: [number, number] = [0, 0]
    // sin muros que evitar (el Bosque) se sortea igual que siempre: x e y por separado
    const rx = c.sobreMuro ? () => (ultimo = punto())[0] : () => v.x + fx().next() * v.width
    const ry = c.sobreMuro ? () => ultimo[1] : () => v.y + fx().next() * v.height
    const r = () => fx().next()

    // en la Catedral las luciérnagas son turquesa (los rastros de vida); en el Bosque, amarillas
    const turquesa = quiere('luciernagas_turquesa')
    if ((quiere('luciernagas') || turquesa || c.noche > 0.6) && this.cuenta('luciernaga') < Math.round((14 + c.noche * 16) * q)) {
      this.crear('luciernaga', turquesa ? 'luciernaga_turquesa' : 'luciernaga', rx(), ry(), { vida: 6 + r() * 6 })
    }
    if (quiere('fuegos_fatuos') && this.cuenta('fuego') < Math.max(2, Math.round(4 * q)) && r() < dt * 0.6) {
      this.crear('fuego', 'fuego', rx(), ry(), { vida: 10 + r() * 8, violeta: r() < 0.4 })
    }
    if ((quiere('hojas') || quiere('polen') || r() < 0.2) && this.cuenta('hoja') < Math.round(10 * q) && r() < dt * (c.rafaga ? 8 : 2)) {
      this.crear('hoja', fx().next() < 0.5 ? 'hoja_otono' : 'hoja_verde', rx(), v.y - 8, { vx: 6 + r() * 10, vy: 12 + r() * 10, vida: 14 })
    }
    if (quiere('mariposas') && this.cuenta('mariposa') < Math.max(2, Math.round(5 * q)) && r() < dt) {
      this.crear('mariposa', ['mariposa_azul', 'mariposa_naranja', 'mariposa_rosa'][Math.floor(r() * 3)]!, rx(), ry(), { vida: 12 })
    }
    // motas: cada tipo que pide la zona, con su tope
    const motas: [string, string, number, number, number, number, number][] = [
      // zona, llave, tope, tasa/s, vy min, vy rango, vida
      ['polen', 'polen', 20, 8, -3, -4, 5],
      ['esporas', 'espora', 20, 7, -3, -4, 6],
      ['polvo', 'polvo', 16, 5, -2, -3, 5],
      ['brasas', 'brasa', 24, 10, -10, -10, 4],
      ['brillos', 'brillo', 12, 3, -3, -4, 3],
      ['humo', 'humo', 8, 1.5, -8, -4, 3.2],
      // gotas que caen del techo de la Catedral
      ['gotas', 'gota', 8, 2, 70, 40, 1.4],
    ]
    for (const [zn, llave, tope, tasa, vy0, vyR, vida] of motas) {
      if (!quiere(zn) || this.cuenta('mota', llave) >= Math.max(2, Math.round(tope * q)) || r() >= dt * tasa) continue
      this.crear('mota', llave, rx(), ry(), {
        vx: (r() - 0.3) * 6,
        vy: vy0 + r() * vyR,
        vida: vida * (0.7 + r() * 0.6),
        porEdad: llave === 'humo',
        alfaMax: llave === 'humo' ? 0.8 : 1,
      })
    }
    if (quiere('murcielagos') && this.cuenta('murcielago') < 2 && r() < dt * 0.15) {
      const izq = r() < 0.5
      this.crear('murcielago', 'murcielago', izq ? v.x - 20 : v.right + 20, ry() - 40, { vx: izq ? 70 : -70, vy: -6, vida: 12 })
    }
  }

  /** Un puñado de partículas que saltan desde un punto (el polvo del jefe al deshacerse) */
  estallido(x: number, y: number, llave: string, n: number): void {
    const r = () => fx().next()
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2
      this.crear('mota', llave, x + Math.cos(a) * 10 * r(), y + Math.sin(a) * 6 * r(), { vx: Math.cos(a) * (10 + r() * 20), vy: -12 - r() * 26, vida: 0.9 + r() * 0.8, local: true, alfaMax: 0.95, sinEntrada: true })
    }
  }

  /** Una huella de Thor en el piso (debajo de los personajes), que se apaga sola */
  huella(x: number, y: number, vida: number): void {
    // las huellas importan más que el ambiente: si no hay lugar, se va la partícula de ambiente más vieja
    if (this.lista.length >= this.tope) {
      const i = this.lista.findIndex((q) => !q.local)
      if (i >= 0) this.soltar(this.lista.splice(i, 1)[0]!)
    }
    const p = this.crear('mota', 'huella', Math.round(x), Math.round(y), { vx: 0, vy: 0, vida, local: true, alfaMax: 0.95, sinEntrada: true })
    p?.s.setDepth(PROF.SOMBRAS + 1).setAlpha(0.95).setPosition(Math.round(x), Math.round(y))
  }

  /** Emisores pegados a objetos que se ven: fogata, antorcha, cascada, hongos, cristales, anillo */
  private aparecerLocales(dt: number, c: ContextoParticulas): void {
    if (!c.decos) return
    const r = () => fx().next()
    c.decos((a) => {
      const d = a.d
      const emite = (clave: string, tasa: number, fn: () => void) => {
        const k = `${d.i}:${clave}`
        const acum = (this.acumLocal.get(k) ?? 0) + dt * tasa
        const n = Math.floor(acum)
        this.acumLocal.set(k, acum - n)
        for (let i = 0; i < n; i++) fn()
      }
      switch (d.nombre) {
        case 'fogata':
        case 'campamento_fogata':
          emite('b', 6, () => this.crear('mota', 'brasa', d.x + (r() - 0.5) * 10, d.y - 8, { vx: (r() - 0.5) * 10, vy: -18 - r() * 18, vida: 0.7 + r() * 1.0, local: true }))
          emite('h', 1.2, () => this.crear('mota', 'humo', d.x + (r() - 0.5) * 6, d.y - 22, { vx: 3 + r() * 4, vy: -9 - r() * 4, vida: 2.8, porEdad: true, alfaMax: 0.8, local: true }))
          break
        case 'brasero_cobre':
          emite('b', 4, () => this.crear('mota', 'brasa', d.x + (r() - 0.5) * 12, d.y - 26, { vx: (r() - 0.5) * 10, vy: -16 - r() * 16, vida: 0.7 + r() * 0.9, local: true }))
          emite('h', 0.8, () => this.crear('mota', 'humo', d.x + (r() - 0.5) * 6, d.y - 40, { vx: 2 + r() * 3, vy: -8 - r() * 4, vida: 2.6, porEdad: true, alfaMax: 0.6, local: true }))
          break
        case 'antorcha':
          emite('b', 3.5, () => this.crear('mota', 'brasa', d.x + (r() - 0.5) * 4, d.y - 40, { vx: (r() - 0.5) * 8, vy: -14 - r() * 12, vida: 0.6 + r() * 0.7, local: true }))
          break
        case 'cascada': {
          // a lo largo de la línea donde el agua golpea: gotas que saltan y bruma blanca que sube
          const e = d.def.espuma ?? [-50, 0, 50, 0]
          const punto = (): [number, number] => {
            const u = r()
            return [d.x + e[0] + (e[2] - e[0]) * u, d.y + e[1] + (e[3] - e[1]) * u]
          }
          const largo = Math.hypot(e[2] - e[0], e[3] - e[1])
          emite('g', largo * 0.18, () => {
            const [x, y] = punto()
            this.crear('mota', 'gota', x, y - 2 + r() * 4, { vx: (r() - 0.5) * 24, vy: -30 - r() * 30, gravedad: 120, vida: 0.7, local: true })
          })
          emite('h', largo * 0.025, () => {
            const [x, y] = punto()
            const p = this.crear('mota', 'humo', x, y - 4, { vx: (r() - 0.5) * 6, vy: -6 - r() * 6, vida: 2.4, porEdad: true, alfaMax: 0.45, local: true })
            p?.s.setTint(0xdff2ff)
          })
          break
        }
        case 'hongo_gigante_azul':
        case 'hongo_gigante_morado':
          emite('e', 1.6, () => this.crear('mota', 'espora', d.x + (r() - 0.5) * 24, d.y - 46 - r() * 8, { vx: (r() - 0.5) * 4, vy: -4 - r() * 4, vida: 3 + r() * 2, local: true }))
          break
        case 'cristales':
          emite('s', 1.2, () => this.crear('mota', 'brillo', d.x + (r() - 0.5) * 24, d.y - 14 - r() * 24, { vx: 0, vy: -5, vida: 1.6, local: true }))
          break
        case 'anillo_hadas':
          emite('s', 3, () => this.crear('mota', 'brillo', d.x + (r() - 0.5) * 80, d.y - 8 - r() * 12, { vx: 0, vy: -8 - r() * 6, vida: 2.2, local: true }))
          break
      }
    })
    // no dejar crecer el acumulador de objetos que ya no están
    if (this.acumLocal.size > 800) this.acumLocal.clear()
  }

  destruir(): void {
    for (const p of this.lista) p.s.destroy()
    for (const s of this.libres) s.destroy()
    this.lista = []
    this.libres = []
  }
}
