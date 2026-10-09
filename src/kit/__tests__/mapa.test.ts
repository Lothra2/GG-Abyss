import { describe, expect, it } from 'vitest'
import { leerJson } from '../../../scripts/lib/verificacion'
import { entidadesDeTipo, llaveEntidad, nombresParticulasConocidas, parsearMapa, totalSecretos, totalZonasDescubribles, traducirParticulas } from '../mapa'
import type { Manifest, MapaTiled } from '../tipos'

const KIT = 'public/assets/kit/'
const manifest = leerJson<Manifest>(KIT + 'manifest.json')
const mapa = parsearMapa(leerJson<MapaTiled>(KIT + manifest.mundo.mapa))

// El taller va a agregar postales, zonas y cofres: los tests piden "al menos", nunca cantidades exactas.
describe('mapa del Bosque GG', () => {
  it('mide lo que dice el manifest', () => {
    expect(mapa.ancho).toBe(manifest.mundo.ancho)
    expect(mapa.alto).toBe(manifest.mundo.alto)
    expect(mapa.colision.length).toBe(mapa.ancho * mapa.alto)
    expect(mapa.agua.length).toBe(mapa.ancho * mapa.alto)
  })

  it('trae al menos 3 puntos de guardado, cada uno con id y nombre', () => {
    const fogatas = entidadesDeTipo(mapa, 'punto_guardado')
    expect(fogatas.length).toBeGreaterThanOrEqual(3)
    for (const f of fogatas) {
      expect(typeof f.props.id).toBe('string')
      expect(typeof f.props.nombre).toBe('string')
    }
    expect(new Set(fogatas.map((f) => f.props.id)).size).toBe(fogatas.length)
  })

  it('trae al menos 5 cofres secretos con su pista', () => {
    const secretos = entidadesDeTipo(mapa, 'cofre').filter((c) => c.props.secreto === true)
    expect(secretos.length).toBeGreaterThanOrEqual(5)
    for (const c of secretos) expect(typeof c.props.pista).toBe('string')
  })

  it('trae al menos 13 zonas y al menos 8 postales', () => {
    expect(mapa.zonas.length).toBeGreaterThanOrEqual(13)
    expect(mapa.postales.length).toBeGreaterThanOrEqual(8)
  })

  it('los totales de zonas y secretos se calculan del mapa', () => {
    expect(totalZonasDescubribles(mapa)).toBe(mapa.zonas.filter((z) => z.descubrir).length)
    const cofres = entidadesDeTipo(mapa, 'cofre').filter((c) => c.props.secreto === true).length
    expect(totalSecretos(mapa)).toBe(cofres + mapa.zonas.filter((z) => z.secreto).length)
  })

  it('tiene el inicio de la heroína, de Thor, el portal de llegada y el jefe', () => {
    for (const tipo of ['jugador_inicio', 'thor_inicio', 'portal_llegada', 'jefe', 'portal_jefe', 'arena_jefe']) {
      expect(entidadesDeTipo(mapa, tipo).length, tipo).toBeGreaterThanOrEqual(1)
    }
  })

  it('cada zona trae área y ambiente, y las llaves de entidad son únicas', () => {
    for (const z of mapa.zonas) {
      expect(z.area).toBeGreaterThan(0)
      expect(z.ambiente.length).toBeGreaterThan(0)
    }
    const llaves = mapa.entidades.map(llaveEntidad)
    expect(new Set(llaves).size).toBe(llaves.length)
  })

  it('el agua anima con al menos 2 cuadros y 220 ms', () => {
    expect(mapa.aguaCuadros).toBeGreaterThanOrEqual(2)
    expect(mapa.aguaMs).toBe(220)
    expect(mapa.agua.some((v) => v > 0)).toBe(true)
  })

  it('el jugador arranca en un cuadro por el que se puede caminar', () => {
    const inicio = entidadesDeTipo(mapa, 'jugador_inicio')[0]!
    const tx = Math.floor(inicio.x / mapa.cuadro)
    const ty = Math.floor(inicio.y / mapa.cuadro)
    expect(mapa.colision[ty * mapa.ancho + tx]).toBe(0)
  })
})

describe('traducción de partículas de zona', () => {
  it('todas las partículas de todas las zonas del mapa se conocen y existen en el kit', () => {
    for (const z of mapa.zonas) {
      const t = traducirParticulas(z.particulas, () => {})
      expect(t.desconocidas, z.nombre).toEqual([])
      for (const e of t.emisores) {
        const tabla = e.tipo === 'particula' ? manifest.mundo.particulas : manifest.mundo.criaturas
        for (const llave of e.llaves) expect(tabla[llave], `${z.nombre}: ${llave}`).toBeDefined()
      }
    }
  })

  it('un nombre desconocido se avisa una sola vez y se ignora', () => {
    const avisos: string[] = []
    traducirParticulas(['pollo_volador', 'polen'], (m) => avisos.push(m))
    traducirParticulas(['pollo_volador'], (m) => avisos.push(m))
    expect(avisos.length).toBe(1)
    const t = traducirParticulas(['pollo_volador', 'polen'], () => {})
    expect(t.emisores.map((e) => e.nombre)).toEqual(['polen'])
    expect(t.desconocidas).toEqual(['pollo_volador'])
  })

  it('fuegos fatuos y murciélagos son criaturas, no partículas', () => {
    const t = traducirParticulas(['fuegos_fatuos', 'murcielagos'], () => {})
    expect(t.emisores.every((e) => e.tipo === 'criatura')).toBe(true)
    expect(nombresParticulasConocidas()).toContain('mariposas')
  })
})
