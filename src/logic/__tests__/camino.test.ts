import { describe, expect, it } from 'vitest'
import { Grilla } from '../grilla'
import { buscarCamino, largoCamino, RADIO_HEROINA } from '../camino'
import { leerJson } from '../../../scripts/lib/verificacion'
import { entidadesDeTipo, parsearMapa } from '../../kit/mapa'
import type { Manifest, MapaTiled } from '../../kit/tipos'

function mapaDe(filas: string[]): Grilla {
  const alto = filas.length
  const ancho = filas[0]!.length
  const colision = new Uint8Array(ancho * alto)
  filas.forEach((f, y) => [...f].forEach((c, x) => (colision[y * ancho + x] = c === '#' ? 1 : 0)))
  return new Grilla({ ancho, alto, cuadro: 32, colision })
}

describe('buscarCamino (A*)', () => {
  it('en campo abierto va derecho al destino', () => {
    const g = mapaDe(['........', '........', '........'])
    const c = buscarCamino(g, 16, 16, 240, 80)!
    expect(c.length).toBe(1)
    expect(c[0]).toEqual({ x: 240, y: 80 })
  })

  it('rodea una pared por el lado más corto', () => {
    const g = mapaDe([
      '.......',
      '...#...',
      '...#...',
      '...#...',
      '.......',
    ])
    const c = buscarCamino(g, 16, 80, 208, 80)!
    expect(c).not.toBeNull()
    // todos los tramos en línea recta tienen que estar libres
    let ant = { x: 16, y: 80 }
    for (const p of c) {
      expect(g.lineaLibre(ant.x, ant.y, p.x, p.y, RADIO_HEROINA)).toBe(true)
      ant = p
    }
    // pasa por arriba o por abajo, no atraviesa
    expect(c.some((p) => p.y < 32 || p.y > 128)).toBe(true)
    // la pared de 3 cuadros se rodea por abajo (más corto, la fila 4)
    expect(largoCamino({ x: 16, y: 80 }, c)).toBeLessThan(320)
  })

  it('no corta esquinas en diagonal', () => {
    // la diagonal de (0,0) a (1,1) pasa entre dos paredes que se tocan por la esquina
    const g = mapaDe(['.#', '#.'])
    expect(buscarCamino(g, 16, 16, 48, 48)).toBeNull()
  })

  it('un destino bloqueado va al cuadro caminable más cercano', () => {
    const g = mapaDe(['....', '.##.', '....'])
    const c = buscarCamino(g, 16, 16, 48, 48)!
    const fin = c[c.length - 1]!
    expect(g.circuloLibre(fin.x, fin.y, RADIO_HEROINA)).toBe(true)
  })

  it('un destino sin ningún cuadro caminable cerca da null', () => {
    const g = mapaDe(['.#####', '######', '######', '######', '######', '######'])
    expect(buscarCamino(g, 16, 16, 176, 176)).toBeNull()
  })

  it('un destino encerrado da null', () => {
    const g = mapaDe(['..#..', '..#..', '..#..'])
    expect(buscarCamino(g, 16, 16, 144, 16, { radioBusqueda: 0 })).toBeNull()
  })

  it('el camino más corto conocido en un pasillo en L', () => {
    const g = mapaDe([
      '.####',
      '.####',
      '.....',
    ])
    const c = buscarCamino(g, 16, 16, 144, 80)!
    // sin suavizar serían 2 + 4 pasos, el suavizado deja pocos puntos
    expect(c.length).toBeLessThanOrEqual(3)
    expect(largoCamino({ x: 16, y: 16 }, c)).toBeLessThan(64 + 128 + 20)
  })
})

describe('Bosque GG', () => {
  const KIT = 'public/assets/kit/'
  const manifest = leerJson<Manifest>(KIT + 'manifest.json')
  const mapa = parsearMapa(leerJson<MapaTiled>(KIT + manifest.mundo.mapa))
  const g = new Grilla(mapa)
  const inicio = entidadesDeTipo(mapa, 'jugador_inicio')[0]!

  it('todas las zonas del mapa se alcanzan caminando desde jugador_inicio', () => {
    for (const z of mapa.zonas) {
      // el punto caminable más cercano al centro de la zona
      const cx = z.x + z.w / 2
      const cy = z.y + z.h / 2
      const t = g.cuadroDe(cx, cy)
      const cerca = g.cercanoCaminable(t.tx, t.ty, 12)
      expect(cerca, `no hay cuadro caminable cerca del centro de ${z.nombre}`).not.toBeNull()
      const p = g.centroDe(cerca!.tx, cerca!.ty)
      const camino = buscarCamino(g, inicio.x, inicio.y, p.x, p.y)
      expect(camino, `no hay camino hasta ${z.nombre}`).not.toBeNull()
    }
  })

  it('la arena del jefe, los cofres, las fogatas y el portal del jefe se alcanzan', () => {
    for (const tipo of ['cofre', 'punto_guardado', 'portal_llegada', 'arena_jefe', 'jefe']) {
      for (const e of entidadesDeTipo(mapa, tipo)) {
        const t = g.cuadroDe(e.x, e.y)
        const cerca = g.cercanoCaminable(t.tx, t.ty, 4)
        expect(cerca, `${tipo} ${e.x},${e.y} sin cuadro caminable cerca`).not.toBeNull()
        const p = g.centroDe(cerca!.tx, cerca!.ty)
        expect(buscarCamino(g, inicio.x, inicio.y, p.x, p.y), `${tipo} ${e.x},${e.y}`).not.toBeNull()
      }
    }
  })

  it('el camino de la llegada al jefe es largo pero se calcula rápido', () => {
    const jefe = entidadesDeTipo(mapa, 'arena_jefe')[0]!
    const t0 = performance.now()
    const c = buscarCamino(g, inicio.x, inicio.y, jefe.x, jefe.y + 150)!
    const ms = performance.now() - t0
    expect(c).not.toBeNull()
    expect(largoCamino({ x: inicio.x, y: inicio.y }, c)).toBeGreaterThan(3000)
    expect(ms).toBeLessThan(150)
  })
})
