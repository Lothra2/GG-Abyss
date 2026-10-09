import Phaser from 'phaser'
import type { Manifest } from './tipos'
import { K } from './claves'
import { fuentesDe, uiImagenes } from './manifest'
import { RUTA_KIT } from '../config/juego'

/**
 * Encola en el cargador de Phaser lo que dice el manifest. No hay listas fijas de nombres:
 * si el kit trae un personaje, un objeto o un fx nuevo, entra aquí solo.
 */

export const rutaKit = (r: string): string => RUTA_KIT + r

type Escena = Phaser.Scene

const yaHay = (e: Escena, key: string) => e.textures.exists(key)

export function encolarFuentes(e: Escena, m: Manifest): void {
  for (const [nombre, f] of Object.entries(fuentesDe(m))) {
    if (!e.cache.bitmapFont.exists(nombre)) e.load.bitmapFont(nombre, rutaKit(f.png), rutaKit(f.fnt))
  }
}

/** Imágenes de ui. Con `solo` se cargan unas pocas (para la barra de carga). */
export function encolarUi(e: Escena, m: Manifest, solo?: string[]): void {
  for (const [nombre, u] of Object.entries(uiImagenes(m))) {
    if (solo && !solo.includes(nombre)) continue
    const key = K.ui(nombre)
    if (yaHay(e, key)) continue
    if (u.cuadros > 1 || u.caracteres) e.load.spritesheet(key, rutaKit(u.archivo), { frameWidth: u.w, frameHeight: u.h })
    else e.load.image(key, rutaKit(u.archivo))
  }
}

/** Hojas de un personaje (heroína, Thor, enemigo, jefe). `anims` limita cuáles se cargan. */
export function encolarPersonaje(e: Escena, m: Manifest, id: string, anims?: string[]): void {
  const p = m.personajes[id]
  if (!p) return
  for (const [nombre, a] of Object.entries(p.anims)) {
    if (anims && !anims.includes(nombre)) continue
    const key = K.pers(id, nombre)
    if (yaHay(e, key)) continue
    e.load.spritesheet(key, rutaKit(a.archivo), { frameWidth: p.celda, frameHeight: p.celda })
  }
  if (p.retrato && !yaHay(e, K.retrato(id))) e.load.image(K.retrato(id), rutaKit(p.retrato))
}

export function encolarFx(e: Escena, m: Manifest, nombres?: string[]): void {
  for (const [nombre, f] of Object.entries(m.fx)) {
    if (nombres && !nombres.includes(nombre)) continue
    const key = K.fx(nombre)
    if (!yaHay(e, key)) e.load.spritesheet(key, rutaKit(f.archivo), { frameWidth: f.celda, frameHeight: f.celda })
  }
}

/** Mapa, agua, suelo y texturas técnicas del mundo */
export function encolarMundoBase(e: Escena, m: Manifest): void {
  const mu = m.mundo
  if (!e.cache.json.exists(K.mapa)) e.load.json(K.mapa, rutaKit(mu.mapa))
  if (!yaHay(e, K.agua)) e.load.spritesheet(K.agua, rutaKit(mu.agua), { frameWidth: mu.cuadro, frameHeight: mu.cuadro })
  mu.suelo.forEach((s, i) => {
    if (!yaHay(e, K.suelo(i))) e.load.image(K.suelo(i), rutaKit(s.archivo))
  })
  for (const [key, ruta] of [[K.luz, mu.luz], [K.nube, mu.nube], [K.nieblaNubes, mu.niebla.nubes], [K.nieblaJirones, mu.niebla.jirones]] as const) {
    if (!yaHay(e, key)) e.load.image(key, rutaKit(ruta))
  }
}

/** Solo los objetos del mundo que se piden (los que aparecen en el mapa), no los 74 */
export function encolarObjetosMundo(e: Escena, m: Manifest, nombres: Iterable<string>): void {
  for (const nombre of nombres) {
    const o = m.mundo.objetos[nombre]
    if (!o) continue
    for (const [an, a] of Object.entries(o.anims)) {
      const key = K.obj(nombre, an)
      if (!yaHay(e, key)) e.load.spritesheet(key, rutaKit(a.archivo), { frameWidth: o.w, frameHeight: o.h })
    }
  }
}

export function encolarCriaturas(e: Escena, m: Manifest, nombres?: string[]): void {
  for (const [nombre, c] of Object.entries(m.mundo.criaturas)) {
    if (nombres && !nombres.includes(nombre)) continue
    for (const [an, a] of Object.entries(c.anims)) {
      const key = K.cri(nombre, an)
      if (!yaHay(e, key)) e.load.spritesheet(key, rutaKit(a.archivo), { frameWidth: c.w, frameHeight: c.h })
    }
  }
}

export function encolarParticulas(e: Escena, m: Manifest, nombres?: string[]): void {
  for (const [nombre, p] of Object.entries(m.mundo.particulas)) {
    if (nombres && !nombres.includes(nombre)) continue
    const key = K.par(nombre)
    if (!yaHay(e, key)) e.load.spritesheet(key, rutaKit(p.archivo), { frameWidth: p.w, frameHeight: p.h })
  }
}

/** Atlas del botín (íconos 32 y 64, especiales, armadura) y el atlas del mundo (cofres, monedas, haces) */
export function encolarBotin(e: Escena, m: Manifest, soloMundo = false): void {
  for (const [nombre, r] of soloMundo ? [] : Object.entries(m.botin.atlas)) {
    for (const tam of ['32', '64'] as const) {
      const key = K.atlas(nombre, tam)
      if (!yaHay(e, key)) e.load.atlas(key, rutaKit(r[tam].replace('.json', '.png')), rutaKit(r[tam]))
    }
  }
  if (!yaHay(e, 'atlas_mundo')) e.load.atlas('atlas_mundo', rutaKit(m.botin.mundo.replace('.json', '.png')), rutaKit(m.botin.mundo))
  if (!e.cache.json.exists('atlas_mundo_datos')) e.load.json('atlas_mundo_datos', rutaKit(m.botin.mundo))
  if (!soloMundo && !e.cache.json.exists(K.catalogo)) e.load.json(K.catalogo, rutaKit(m.botin.catalogo))
}

export function encolarAudio(e: Escena, m: Manifest, nombres?: string[]): void {
  for (const [nombre, ruta] of Object.entries(m.audio)) {
    if (nombres && !nombres.includes(nombre)) continue
    if (!e.cache.audio.exists(K.aud(nombre))) e.load.audio(K.aud(nombre), rutaKit(ruta))
  }
}

/** Postales del mundo (por nombre) para fondos de título y comparaciones */
export function encolarPostales(e: Escena, m: Manifest, nombres?: string[]): void {
  for (const [nombre, ruta] of Object.entries(m.mundo.postales)) {
    if (nombres && !nombres.includes(nombre)) continue
    if (!yaHay(e, K.postal(nombre))) e.load.image(K.postal(nombre), rutaKit(ruta))
  }
}

/** Los créditos del kit como texto */
export function encolarCreditos(e: Escena, m: Manifest): void {
  if (!e.cache.text.exists('creditos')) e.load.text('creditos', rutaKit(m.creditos))
}

/** Todo el kit: para la sala del kit */
export function encolarTodo(e: Escena, m: Manifest): void {
  encolarFuentes(e, m)
  encolarUi(e, m)
  for (const id of Object.keys(m.personajes)) encolarPersonaje(e, m, id)
  encolarFx(e, m)
  encolarObjetosMundo(e, m, Object.keys(m.mundo.objetos))
  encolarCriaturas(e, m)
  encolarParticulas(e, m)
  encolarAudio(e, m)
  encolarCreditos(e, m)
}
