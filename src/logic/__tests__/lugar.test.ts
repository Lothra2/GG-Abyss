import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'
import { buscarCamino, RADIO_HEROINA } from '../camino'
import { lugarAbierto, puntosDeCaida, regionCaminable } from '../lugar'
import { leerJson } from '../../../scripts/lib/verificacion'
import { entidadesDeTipo, parsearMapa } from '../../kit/mapa'
import { mundosDe } from '../../kit/mundos'
import type { Manifest, MapaTiled } from '../../kit/tipos'

function mapaDe(filas: string[]): Grilla {
  const alto = filas.length
  const ancho = filas[0]!.length
  const colision = new Uint8Array(ancho * alto)
  filas.forEach((f, y) => [...f].forEach((c, x) => (colision[y * ancho + x] = c === '#' ? 1 : 0)))
  return new Grilla({ ancho, alto, cuadro: 32, colision })
}

describe('el lugar del mercader', () => {
  it('no se para en un paso angosto: busca un cuadro con todo libre alrededor', () => {
    // un pasillo de un cuadro (fila 3) que lleva a una sala abierta a la derecha
    const g = mapaDe([
      '################',
      '##########......',
      '##########......',
      '................',
      '##########......',
      '##########......',
      '################',
    ])
    const t = lugarAbierto(g, 7 * 32 + 16, 3 * 32 + 16, { x: 5 * 32, y: 3 * 32 + 16 })!
    expect(t).not.toBeNull()
    expect(t.tx).toBeGreaterThanOrEqual(11)
  })
  it('en los mapas del kit, el mercader al lado de cada fogata no corta ningún camino', () => {
    const KIT = 'public/assets/kit/'
    const m = leerJson<Manifest>(KIT + 'manifest.json')
    for (const mu of mundosDe(m)) {
      const mapa = parsearMapa(leerJson<MapaTiled>(KIT + mu.mapa))
      const sin = new Grilla(mapa)
      const con = new Grilla(mapa)
      const fogatas = entidadesDeTipo(mapa, 'punto_guardado')
      for (const f of fogatas) {
        const t = lugarAbierto(con, f.x + 64, f.y + 6, f)
        expect(t, `${mu.nombre}: lugar para el mercader de la fogata en ${f.x},${f.y}`).not.toBeNull()
        con.bloquearRect(t!.tx, t!.ty, t!.tx, t!.ty)
      }
      // desde el inicio se llega igual a todas las fogatas y a todas las zonas
      const ini = entidadesDeTipo(mapa, 'jugador_inicio')[0]!
      const metas = [...fogatas.map((f) => ({ x: f.x, y: f.y + 26 })), ...mapa.zonas.map((z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 }))]
      for (const p of metas) {
        const a = buscarCamino(sin, ini.x, ini.y, p.x, p.y, { radio: RADIO_HEROINA })
        if (!a) continue
        expect(buscarCamino(con, ini.x, ini.y, p.x, p.y, { radio: RADIO_HEROINA }), `${mu.nombre}: ${p.x},${p.y}`).not.toBeNull()
      }
    }
  }, 120_000)
})

describe('dónde cae el botín', () => {
  it('nunca encima de lo sólido: un cofre contra la pared suelta todo al frente, en el piso', () => {
    // pared arriba (filas 0 y 1) y el cofre en el cuadro (5, 2), sólido
    const g = mapaDe([
      '############',
      '############',
      '.....#......',
      '............',
      '............',
      '............',
    ])
    const cofre = { x: 5 * 32 + 16, y: 2 * 32 + 16 }
    const pts = puntosDeCaida(4, cofre.x, cofre.y, (x, y) => g.circuloLibre(x, y, RADIO_HEROINA + 2))
    expect(pts).toHaveLength(4)
    for (const p of pts) {
      expect(g.circuloLibre(p.x, p.y, RADIO_HEROINA), `${p.x},${p.y}`).toBe(true)
      expect(Math.hypot(p.x - cofre.x, p.y - cofre.y)).toBeLessThan(110)
    }
    // separados para que se vean y se agarren de a uno
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThanOrEqual(20)
    // el primero cae al frente (más abajo que el cofre)
    expect(pts[0]!.y).toBeGreaterThan(cofre.y)
  })
  it('nunca en un hueco encerrado: el caso del cofre del tutorial', () => {
    // el cuadro (4, 3) está libre pero rodeado de árboles: no se llega caminando
    const g = mapaDe([
      '..........',
      '..........',
      '...###....',
      '...#.#....',
      '...###....',
      '..........',
    ])
    const region = regionCaminable(g, 1 * 32 + 16, 1 * 32 + 16, 8)
    const pts = puntosDeCaida(6, 4 * 32 + 16, 1 * 32 + 16, (x, y) => g.circuloLibre(x, y, RADIO_HEROINA + 2) && region.has(g.idx(Math.floor(x / 32), Math.floor(y / 32))))
    for (const p of pts) expect(`${Math.floor(p.x / 32)},${Math.floor(p.y / 32)}`, 'el hueco').not.toBe('4,3')
    // y nunca dos cosas en el mismo punto
    expect(new Set(pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(pts.length)
  })
  it('en los cofres del Bosque todo lo que cae se puede agarrar caminando', () => {
    const KIT = 'public/assets/kit/'
    const m = leerJson<Manifest>(KIT + 'manifest.json')
    for (const mu of mundosDe(m)) {
      const mapa = parsearMapa(leerJson<MapaTiled>(KIT + mu.mapa))
      const g = new Grilla(mapa)
      const ini = entidadesDeTipo(mapa, 'jugador_inicio')[0]!
      for (const c of entidadesDeTipo(mapa, 'cofre')) {
        const llega = buscarCamino(g, ini.x, ini.y, c.x, c.y + 32, { radio: RADIO_HEROINA })
        if (!llega) continue
        const region = regionCaminable(g, c.x, c.y + 32, 8)
        for (const p of puntosDeCaida(3, c.x, c.y + 6, (x, y) => g.circuloLibre(x, y, RADIO_HEROINA + 2) && region.has(g.idx(Math.floor(x / 32), Math.floor(y / 32))))) {
          expect(buscarCamino(g, ini.x, ini.y, p.x, p.y, { radio: RADIO_HEROINA }), `${mu.nombre}: cofre en ${c.x},${c.y}`).not.toBeNull()
        }
      }
    }
  }, 120_000)
})
