import Phaser from 'phaser'
import { K } from '../kit/claves'
import { THOR } from '../config/balance'
import { PROF } from '../config/juego'
import { juego } from '../logic/azar'
import { tamanoOro } from '../logic/botin'
import { colorDeRareza, itemDe, type Catalogo, type ItemCat } from '../logic/catalogo'
import type { Resultado } from '../logic/inventario'
import type { Juicio } from '../logic/veredicto'
import { hexANumero, texto } from './Texto'
import { Sombra } from './Sombras'
import type { Heroina } from './Heroina'
import type { ThorSprite } from './ThorSprite'
import type { Sonido } from './Sonido'

interface Drop {
  id: string
  item: ItemCat
  x: number
  y: number
  edad: number
  icono: Phaser.GameObjects.Image
  haz: Phaser.GameObjects.Sprite | null
  caida: Phaser.GameObjects.Sprite | null
  sombra: Sombra
  avisoLlenaS: number
  /** flechita verde encima si conviene ponérselo */
  marca: Phaser.GameObjects.Image | null
}

interface Moneda {
  oro: number
  s: Phaser.GameObjects.Sprite
  x: number
  y: number
  edad: number
  sombra: Sombra
}

export interface DepsBotin {
  escena: Phaser.Scene
  cat: Catalogo
  heroina: Heroina
  thor: ThorSprite
  sonido: Sonido
  /** mete el objeto en la bolsa o el cinturón */
  recoger: (id: string) => Resultado
  /** suma oro a la partida (con su número flotante) */
  alOro: (n: number, x: number, y: number) => void
  /** ¿conviene ponérselo? (para la flechita verde sobre el objeto en el piso) */
  juicio?: (id: string) => Juicio | null
}

const RADIO_RECOGER = 26
const RADIO_MONEDA_HEROINA = 34
const ESPERA_S = 0.55

/** Nombre de la textura del atlas de un objeto: el atlas `iconos` es el de siempre, los demás vienen de `item.atlas` */
export function atlasDeIcono(item: ItemCat): string {
  return K.atlas(item.atlas, '32')
}

/** Frame del ícono: los animados traen `<icono>_0` a `<icono>_7` */
export function frameDeIcono(item: ItemCat): string {
  return item.animated ? `${item.icon}_0` : item.icon
}

/**
 * El botín en el piso (PLAN.md F3, tarea 2): el ícono cae con un rebote, un haz de luz del color de su rareza, se recoge pasando
 * cerca, y el oro son monedas que Thor recoge desde 120 px. Los únicos y los del set caen con su animación `cae_<id>`.
 */
export class Botin {
  private drops: Drop[] = []
  private monedas: Moneda[] = []

  constructor(private d: DepsBotin) {}

  get cantidad(): number {
    return this.drops.length
  }

  get cantidadMonedas(): number {
    return this.monedas.length
  }

  info() {
    return {
      drops: this.drops.map((x) => ({ id: x.id, x: Math.round(x.x), y: Math.round(x.y), rareza: x.item.rarity, haz: !!x.haz, cae: !!x.caida, mejor: !!x.marca })),
      monedas: this.monedas.map((m) => ({ oro: m.oro, x: Math.round(m.x), y: Math.round(m.y) })),
    }
  }

  /** Varios objetos de golpe: se reparten en abanico alrededor del punto */
  soltarObjetos(ids: readonly string[], x: number, y: number): void {
    ids.forEach((id, i) => {
      const ang = (Math.PI * 2 * i) / Math.max(1, ids.length) + juego().next() * 0.6
      const r = ids.length === 1 ? 0 : 22
      this.soltar(id, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.6 + 8)
    })
  }

  soltar(id: string, x: number, y: number): void {
    const e = this.d.escena
    const item = itemDe(this.d.cat, id)
    if (!item) return
    const atlas = atlasDeIcono(item)
    if (!e.textures.exists(atlas)) return
    const raro = item.rarity !== 'normal'
    const icono = e.add.image(x, y - 10, atlas, frameDeIcono(item)).setDepth(PROF.OBJETOS + y + 300).setVisible(true)
    const sombra = new Sombra(e, 18, 0.3)
    sombra.poner(x, y)

    let haz: Phaser.GameObjects.Sprite | null = null
    const nombreHaz = `haz_${item.rarity}`
    if (raro && e.anims.exists(nombreHaz)) {
      haz = e.add.sprite(x, y, 'atlas_mundo', `${nombreHaz}_0`).setOrigin(0.5, 0.92).setDepth(PROF.OBJETOS + y + 100).setAlpha(0.9)
      haz.play(nombreHaz)
    }
    let caida: Phaser.GameObjects.Sprite | null = null
    const nombreCae = `cae_${item.id}`
    if (e.anims.exists(nombreCae)) {
      icono.setVisible(false)
      caida = e.add.sprite(x, y, 'atlas_mundo', `${nombreCae}_0`).setOrigin(0.5, 0.9).setDepth(PROF.OBJETOS + y + 300)
      caida.play(nombreCae)
      caida.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        caida?.destroy()
        const dr = this.drops.find((q) => q.icono === icono)
        if (dr) dr.caida = null
        icono.setVisible(true)
      })
    } else {
      // rebote del ícono: sube y cae con rebote
      e.tweens.add({ targets: icono, y: { from: y - 44, to: y - 10 }, duration: 520, ease: 'Bounce.easeOut' })
    }
    const dr: Drop = { id, item, x, y, edad: 0, icono, haz, caida, sombra, avisoLlenaS: 0, marca: null }
    this.drops.push(dr)
    this.ponerMarca(dr)
    if (item.rarity === 'rare') this.d.sonido.efecto('descubrir', { volumen: 0.5 })
    else if (item.rarity === 'set' || item.rarity === 'legendary' || item.rarity === 'unique') this.d.sonido.efecto('legendario', { volumen: 0.6 })
  }

  soltarOro(oro: number, x: number, y: number): void {
    const e = this.d.escena
    if (oro <= 0) return
    const nombre = `oro_${tamanoOro(oro)}`
    if (!e.anims.exists(nombre)) {
      this.d.alOro(oro, x, y)
      return
    }
    const s = e.add.sprite(x, y - 6, 'atlas_mundo', `${nombre}_0`).setOrigin(0.5, 0.8).setDepth(PROF.OBJETOS + y + 200)
    s.play(nombre)
    const sombra = new Sombra(e, 12, 0.3)
    sombra.poner(x, y)
    e.tweens.add({ targets: s, y: { from: y - 34, to: y - 6 }, duration: 420, ease: 'Bounce.easeOut' })
    this.monedas.push({ oro, s, x, y, edad: 0, sombra })
  }

  /** El objeto del piso bajo un toque, para que la heroína camine hasta él */
  golpe(x: number, y: number): { x: number; y: number } | null {
    for (const dr of this.drops) if (Math.abs(x - dr.x) < 22 && y > dr.y - 40 && y < dr.y + 14) return { x: dr.x, y: dr.y }
    for (const m of this.monedas) if (Math.abs(x - m.x) < 20 && y > m.y - 36 && y < m.y + 12) return { x: m.x, y: m.y }
    return null
  }

  update(dt: number): void {
    const h = this.d.heroina
    const th = this.d.thor
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const dr = this.drops[i]!
      dr.edad += dt
      dr.avisoLlenaS = Math.max(0, dr.avisoLlenaS - dt)
      if (dr.marca) dr.marca.setY(Math.round(dr.y - 40 + Math.sin(dr.edad * 4) * 2))
      if (dr.edad < ESPERA_S) continue
      if (Math.hypot(h.x - dr.x, h.y - dr.y) > RADIO_RECOGER) continue
      const r = this.d.recoger(dr.id)
      if (r.ok) {
        const grande = dr.item.rarity === 'set' || dr.item.rarity === 'legendary' || dr.item.rarity === 'unique'
        this.d.sonido.efecto(grande ? 'legendario' : 'recoger', { volumen: 0.7 })
        this.nombreFlotante(h.x, h.y - 50, dr.item)
        this.quitar(dr)
        this.drops.splice(i, 1)
      } else if (r.motivo === 'llena' && dr.avisoLlenaS <= 0) {
        // la bolsa está llena: el objeto se queda en el piso
        dr.avisoLlenaS = 2
        this.d.sonido.efecto('error', { volumen: 0.5 })
        this.textoFlotante(h.x, h.y - 50, 'Bolsa llena', 0xff8a8a)
      }
    }

    for (let i = this.monedas.length - 1; i >= 0; i--) {
      const m = this.monedas[i]!
      m.edad += dt
      if (m.edad < ESPERA_S) continue
      const dh = Math.hypot(h.x - m.x, h.y - m.y)
      const dt_ = Math.hypot(th.x - m.x, th.y - m.y)
      let cobrar = dh <= RADIO_MONEDA_HEROINA
      if (!cobrar && dt_ <= THOR.recogerRadio) {
        // Thor la recoge: la moneda va hacia él
        const dx = th.x - m.x
        const dy = th.y - m.y
        const paso = Math.min(dt_, 260 * dt)
        m.x += (dx / (dt_ || 1)) * paso
        m.y += (dy / (dt_ || 1)) * paso
        m.s.setPosition(Math.round(m.x), Math.round(m.y - 6)).setDepth(PROF.OBJETOS + m.y + 200)
        m.sombra.poner(m.x, m.y)
        if (dt_ <= 14) {
          cobrar = true
          th.menearCola(0.8)
        }
      }
      if (cobrar) {
        this.d.sonido.efecto(m.oro > 25 ? 'oro_mucho' : 'moneda', { volumen: 0.6 })
        this.d.alOro(m.oro, m.x, m.y - 24)
        m.s.destroy()
        m.sombra.destroy()
        this.monedas.splice(i, 1)
      }
    }
  }

  private nombreFlotante(x: number, y: number, item: ItemCat): void {
    this.textoFlotante(x, y, item.name.es, hexANumero(colorDeRareza(this.d.cat, item.rarity)))
  }

  private textoFlotante(x: number, y: number, t: string, color: number): void {
    const e = this.d.escena
    const tx = texto(e, Math.round(x), Math.round(y), t, 'fuente_ui', 1, { origen: [0.5, 0.5], tinte: color, profundidad: PROF.OBJETOS + 9700 })
    e.tweens.add({ targets: tx, y: tx.y - 22, alpha: 0, duration: 1400, ease: 'Sine.easeOut', onComplete: () => tx.destroy() })
  }

  /** La flechita verde: aparece sobre lo que es mejor que lo puesto */
  private ponerMarca(dr: Drop): void {
    const e = this.d.escena
    const mejor = this.d.juicio?.(dr.id) === 'mejor'
    if (mejor && !dr.marca && e.textures.exists(K.ui('flecha_guia'))) {
      dr.marca = e.add.image(dr.x, dr.y - 40, K.ui('flecha_guia'), 4).setTint(0x7dff6a).setDepth(PROF.OBJETOS + dr.y + 320)
    } else if (!mejor && dr.marca) {
      dr.marca.destroy()
      dr.marca = null
    }
  }

  /** Cambió lo puesto: las flechitas se recalculan */
  refrescarMarcas(): void {
    for (const dr of this.drops) this.ponerMarca(dr)
  }

  private quitar(dr: Drop): void {
    dr.marca?.destroy()
    dr.icono.destroy()
    dr.haz?.destroy()
    dr.caida?.destroy()
    dr.sombra.destroy()
  }

  limpiar(): void {
    for (const dr of this.drops) this.quitar(dr)
    for (const m of this.monedas) {
      m.s.destroy()
      m.sombra.destroy()
    }
    this.drops = []
    this.monedas = []
  }
}
