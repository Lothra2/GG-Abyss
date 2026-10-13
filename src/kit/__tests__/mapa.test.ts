import { describe, expect, it } from 'vitest'
import { leerJson } from '../../../scripts/lib/verificacion'
import { entidadesDeTipo, llaveEntidad, nombresParticulasConocidas, parsearMapa, superficieEn, totalSecretos, totalZonasDescubribles, traducirParticulas } from '../mapa'
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
    // las llaves guardan lo abierto y lo roto: tienen que ser únicas en todo lo que se guarda (las criaturas no)
    const llaves = mapa.entidades.filter((e) => e.tipo !== 'criatura').map(llaveEntidad)
    expect(new Set(llaves).size).toBe(llaves.length)
  })

  it('el agua anima con al menos 2 cuadros y 220 ms', () => {
    expect(mapa.aguaCuadros).toBeGreaterThanOrEqual(2)
    expect(mapa.aguaMs).toBe(220)
    expect(mapa.agua.some((v) => v > 0)).toBe(true)
  })

  it('la capa de superficie dice qué suena al pisar: pasto, tierra, piedra, madera y agua', () => {
    const vistas = new Set<string>()
    for (let ty = 0; ty < mapa.alto; ty += 2) for (let tx = 0; tx < mapa.ancho; tx += 2) vistas.add(superficieEn(mapa, tx * 32 + 16, ty * 32 + 16))
    for (const sup of ['pasto', 'tierra', 'piedra', 'madera', 'agua']) expect(vistas.has(sup), sup).toBe(true)
    // el puente del trol es de madera
    const puentes = mapa.decos.filter((d) => d.sprite === 'puente')
    expect(puentes.length).toBeGreaterThanOrEqual(1)
    expect(superficieEn(mapa, puentes[0]!.x, puentes[0]!.y - 20)).toBe('madera')
    // fuera del mapa es pasto, sin romper
    expect(superficieEn(mapa, -50, -50)).toBe('pasto')
    // el inicio de la heroína es pasto o tierra, no agua
    const ini = entidadesDeTipo(mapa, 'jugador_inicio')[0]!
    expect(['pasto', 'tierra']).toContain(superficieEn(mapa, ini.x, ini.y))
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

describe('F12: el mapa del Puerto Ahogado', () => {
  const m4 = (manifest.mundos ?? []).find((x) => x.id === 'mundo4')
  const mapa = m4 ? parsearMapa(leerJson(KIT + m4.mapa)) : null

  it('trae la marea: caminos que se tapan con la alta y muelles que se pisan con la alta', () => {
    if (!mapa) return
    expect(mapa.marea.filter((v) => v === 1).length).toBeGreaterThanOrEqual(1)
    expect(mapa.marea.filter((v) => v === 2).length).toBeGreaterThanOrEqual(1)
  })

  it('con las dos mareas, desde cualquier cuadro que se camina se llega a un farol del muelle', () => {
    if (!mapa) return
    const faroles = mapa.entidades.filter((e) => e.tipo === 'farol_muelle')
    expect(faroles.length).toBeGreaterThanOrEqual(1)
    for (const alta of [false, true]) {
      const pasa = (i: number) => mapa.colision[i] === 0 && (mapa.marea[i] === 0 || (mapa.marea[i] === 1 ? !alta : alta))
      // a lo ancho desde todos los faroles a la vez (cada uno desde el cuadro libre más cercano a su pie)
      const visto = new Uint8Array(mapa.ancho * mapa.alto)
      let borde: number[] = []
      for (const f of faroles) {
        const tx = Math.floor(f.x / mapa.cuadro)
        const ty = Math.floor(f.y / mapa.cuadro)
        let puesto = false
        for (let r = 0; r <= 3 && !puesto; r++)
          for (let dy = -r; dy <= r && !puesto; dy++)
            for (let dx = -r; dx <= r && !puesto; dx++) {
              const i = (ty + dy) * mapa.ancho + tx + dx
              if (!pasa(i)) continue
              puesto = true
              if (!visto[i]) {
                visto[i] = 1
                borde.push(i)
              }
            }
        expect(puesto, `farol en ${f.x},${f.y}`).toBe(true)
      }
      while (borde.length) {
        const sig: number[] = []
        for (const i of borde) {
          const x = i % mapa.ancho
          for (const j of [i - 1, i + 1, i - mapa.ancho, i + mapa.ancho]) {
            if (j < 0 || j >= visto.length || visto[j] || !pasa(j)) continue
            if ((j === i - 1 && x === 0) || (j === i + 1 && x === mapa.ancho - 1)) continue
            visto[j] = 1
            sig.push(j)
          }
        }
        borde = sig
      }
      let sueltos = 0
      for (let i = 0; i < visto.length; i++) if (pasa(i) && !visto[i]) sueltos++
      // islitas de 1 o 2 cuadros sueltos entre objetos no cuentan: lo grande tiene que estar conectado
      const caminables = Array.from(visto.keys()).filter((i) => pasa(i)).length
      expect(sueltos / caminables, `marea ${alta ? 'alta' : 'baja'}`).toBeLessThan(0.02)
    }
  })
})
