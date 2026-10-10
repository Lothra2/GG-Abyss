import { describe, expect, it } from 'vitest'
import { verificarKit, leerJson, tamanoPng, LIMITE_TEXTURA } from '../../../scripts/lib/verificacion'
import { fuentesDe, heroes, iconosCartel, iconosHabilidad, idThor, personaje, rutasDelManifest, uiImagenes, validarManifest, KitError } from '../manifest'
import type { Manifest } from '../tipos'
import { existeMundo, manifestParaMundo, mundosDe } from '../mundos'
import { parsearMapa } from '../mapa'

const KIT = 'public/assets/kit'
const manifest = leerJson<Manifest>(`${KIT}/manifest.json`)

describe('kit de PixelForja', () => {
  const r = verificarKit(KIT)

  it('pasa la verificación completa sin errores', () => {
    expect(r.errores).toEqual([])
  })

  it('todas las rutas que nombra el manifest existen', () => {
    expect(rutasDelManifest(manifest).length).toBeGreaterThan(300)
    expect(r.errores.filter((e) => e.startsWith('Falta el archivo'))).toEqual([])
  })

  it('las hojas miden lo que dicen y ninguna textura pasa de 4096 px', () => {
    expect(r.revisado.hojas).toBeGreaterThan(300)
    expect(r.errores.filter((e) => e.includes('mide') || e.includes('pasa de'))).toEqual([])
    for (const s of manifest.mundo.suelo) {
      const t = tamanoPng(`${KIT}/${s.archivo}`)
      expect(t.w).toBeLessThanOrEqual(LIMITE_TEXTURA)
      expect(t.h).toBeLessThanOrEqual(LIMITE_TEXTURA)
    }
  })

  it('cada objeto que pone el mapa existe en el manifest', () => {
    expect(r.errores.filter((e) => e.includes('El mapa'))).toEqual([])
    expect(r.revisado.objetosMapa).toBeGreaterThan(30)
  })

  it('las 3 fuentes bitmap traen ñ, tildes, ¡ y ¿', () => {
    expect(Object.keys(fuentesDe(manifest)).sort()).toEqual(['fuente_titulo', 'fuente_titulo_plata', 'fuente_ui'])
    expect(r.errores.filter((e) => e.includes('fuente'))).toEqual([])
  })

  it('las 4 heroínas de la familia están y salen en orden', () => {
    const h = heroes(manifest)
    expect(h.slice(0, 4)).toEqual(['sophie', 'alana', 'rick', 'steph'])
    for (const id of h) expect(personaje(manifest, id).retrato).toBeTruthy()
  })

  it('cada heroína trae las animaciones que usan sus clases', () => {
    const necesarias = ['idle', 'walk', 'run', 'die', 'hit', 'attack', 'cast', 'shoot_bow', 'summon', 'whirlwind', 'block_shield', 'nova', 'channel', 'dodge']
    for (const id of heroes(manifest)) for (const a of necesarias) expect(manifest.personajes[id]!.anims[a], `${id}.${a}`).toBeDefined()
  })

  it('Thor y sus 5 armaduras existen', () => {
    expect(manifest.personajes[idThor(0)]).toBeDefined()
    for (let n = 1; n <= 5; n++) expect(manifest.personajes[idThor(n)], `armadura ${n}`).toBeDefined()
  })

  it('los enemigos del Mundo 1 y el jefe existen', () => {
    for (const id of ['rata', 'calabaza', 'goblin_arquero', 'trol', 'minotauro']) expect(manifest.personajes[id], id).toBeDefined()
    expect(manifest.personajes.minotauro!.tipo).toBe('jefe')
  })

  it('la interfaz que usa el juego está', () => {
    const ui = uiImagenes(manifest)
    for (const n of ['barra_marco', 'barra_xp', 'boton', 'panel', 'orbe_vida', 'orbe_mana', 'numeros', 'inventario', 'marca_destino', 'estandarte', 'barra_jefe']) {
      expect(ui[n], n).toBeDefined()
    }
  })

  it('trae lo que el taller entregó: íconos de cartel y de habilidad, logo, continuará, girar la tablet y los íconos de la app', () => {
    const ui = uiImagenes(manifest)
    for (const n of ['logo', 'continuara', 'girar_tablet', 'icono_pausa', 'icono_secreto', 'icono_zona', 'icono_luna', 'icono_sonido', 'icono_silencio', 'icono_calidad', 'icono_jugadora', 'icono_peque', 'icono_jugar', 'icono_guardado']) {
      expect(ui[n], n).toBeDefined()
    }
    expect(Object.keys(iconosCartel(manifest)).sort()).toEqual(['corazon', 'cruce', 'estrella', 'flecha_norte', 'peligro'])
    for (const n of ['lluvia_flechas', 'esquiva', 'llamar_thor', 'curar', 'torbellino', 'bloqueo', 'nova_fuego', 'rayo_canalizado']) expect(iconosHabilidad(manifest)[n], n).toBeDefined()
    for (const n of ['icono_192', 'icono_512', 'icono_maskable_512', 'apple_touch_180', 'favicon_32']) expect(manifest.app?.[n], n).toBeDefined()
    for (const n of ['descubrir', 'secreto', 'elegir', 'guardado', 'musica_titulo', 'arco', 'esquiva', 'bloqueo', 'thor_rescate', 'paso_pasto_0', 'paso_madera_2', 'paso_agua_1']) expect(manifest.audio[n], n).toBeDefined()
    expect(manifest.fx.proyectil_flecha_down).toBeDefined()
    expect(manifest.fx.proyectil_naturaleza_up).toBeDefined()
    expect(manifest.fx.onda_pisoton).toBeDefined()
    expect(manifest.personajes.minotauro!.celda).toBe(96)
    expect(manifest.personajes.thor!.anims.dig).toBeDefined()
  })

  it('al menos 8 postales del manifest, y todas las del manifest están en el mapa', () => {
    expect(Object.keys(manifest.mundo.postales).length).toBeGreaterThanOrEqual(8)
    expect(r.avisos.filter((a) => a.includes('postal'))).toEqual([])
  })

  it('validarManifest rechaza un kit que no es de GG Abyss o está viejo', () => {
    expect(() => validarManifest(null)).toThrow(KitError)
    expect(() => validarManifest({ ...manifest, juego: 'Otro' })).toThrow(KitError)
    expect(() => validarManifest({ ...manifest, version: 99 })).toThrow(/versión/)
    expect(() => validarManifest({ ...manifest, mundo: undefined })).toThrow(/mundo/)
    expect(validarManifest(manifest).juego).toBe('GG Abyss')
  })
})

describe('F8: los mundos del kit', () => {
  it('el Bosque sigue en `mundo` y `mundos` trae al menos el Bosque y la Catedral, en orden de bajada', () => {
    const ids = (manifest.mundos ?? []).map((m) => m.id)
    expect(ids.slice(0, 2)).toEqual(['mundo1', 'mundo2'])
    expect(manifest.mundos![0]!.mapa).toBe(manifest.mundo.mapa)
    expect(manifest.mundos![1]!.nombre).toBe('La Catedral de las Raíces')
  })
  it('la Catedral trae su mapa con zonas, sus objetos, el guardián y su sonido', () => {
    const cat = manifestParaMundo(manifest, 'mundo2')
    const mapa = parsearMapa(leerJson(`${KIT}/${cat.mundo.mapa}`))
    expect(mapa.bioma).toBe('catedral')
    expect(mapa.zonas.length).toBeGreaterThanOrEqual(3)
    expect(mapa.entidades.some((e) => e.tipo === 'portal_volver')).toBe(true)
    for (const d of mapa.decos) expect(cat.mundo.objetos[d.sprite], d.sprite).toBeDefined()
    for (const e of mapa.entidades.filter((q) => q.tipo === 'enemigo')) expect(manifest.personajes[String(e.props.enemigo)], String(e.props.enemigo)).toBeDefined()
    for (const n of ['portal_azul', 'aviso_jefe']) expect(cat.mundo.objetos[n], n).toBeDefined()
    for (const a of ['musica_catedral', 'ambiente_catedral']) expect(manifest.audio[a], a).toBeDefined()
    expect(cat.mundo.particulas.luciernaga_turquesa).toBeDefined()
    // el portal del jefe del Bosque baja a la Catedral
    const bosque = parsearMapa(leerJson(`${KIT}/${manifest.mundo.mapa}`))
    expect(bosque.entidades.find((e) => e.tipo === 'portal_jefe')!.props.destino).toBe('mundo2')
    expect(bosque.bioma).toBe('bosque')
  })
  it('un kit viejo sin `mundos` se ve como un solo mundo, el Bosque', () => {
    const viejo = { ...manifest, mundos: undefined }
    expect(mundosDe(viejo)).toHaveLength(1)
    expect(existeMundo(viejo, 'mundo2')).toBe(false)
    expect(manifestParaMundo(viejo, 'mundo2').mundo).toBe(viejo.mundo)
  })
})
