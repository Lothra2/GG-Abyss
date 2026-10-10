import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'
import { buscarCamino, RADIO_HEROINA } from '../camino'
import { lugarAbierto } from '../lugar'
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
