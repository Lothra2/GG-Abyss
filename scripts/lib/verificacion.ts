import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Manifest, MapaTiled, UiImagen } from '../../src/kit/tipos'
import { rutasDelManifest, validarManifest, fuentesDe, uiImagenes, iconosCartel, iconosHabilidad } from '../../src/kit/manifest'
import { parsearMapa, traducirParticulas } from '../../src/kit/mapa'

/** Revisa que el kit sea coherente: rutas, tamaños de hojas, límite de 4096, y que el mapa pida solo lo que el manifest trae. */

export interface Resultado {
  errores: string[]
  avisos: string[]
  /** cuántas cosas se revisaron */
  revisado: { rutas: number; hojas: number; objetosMapa: number; items: number }
}

export const LIMITE_TEXTURA = 4096

export function tamanoPng(ruta: string): { w: number; h: number } {
  const b = readFileSync(ruta)
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) throw new Error(`No es un PNG: ${ruta}`)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

export function leerJson<T>(ruta: string): T {
  return JSON.parse(readFileSync(ruta, 'utf8')) as T
}

export function verificarKit(carpeta: string): Resultado {
  const errores: string[] = []
  const avisos: string[] = []
  const r: Resultado = { errores, avisos, revisado: { rutas: 0, hojas: 0, objetosMapa: 0, items: 0 } }
  const f = (rel: string) => join(carpeta, rel)

  if (!existsSync(f('manifest.json'))) {
    errores.push('No hay manifest.json. Corre npm run kit.')
    return r
  }
  let m: Manifest
  try {
    m = validarManifest(leerJson(f('manifest.json')))
  } catch (e) {
    errores.push((e as Error).message)
    return r
  }

  // 1. todas las rutas existen
  const rutas = rutasDelManifest(m)
  r.revisado.rutas = rutas.length
  for (const ruta of rutas) if (!existsSync(f(ruta))) errores.push(`Falta el archivo ${ruta}`)

  // 2. hojas con el tamaño exacto y nada pasa de 4096
  const hoja = (nombre: string, ruta: string, w: number, h: number) => {
    if (!existsSync(f(ruta)) || !ruta.endsWith('.png')) return
    r.revisado.hojas++
    const t = tamanoPng(f(ruta))
    if (t.w !== w || t.h !== h) errores.push(`${nombre}: ${ruta} mide ${t.w}x${t.h} y el manifest dice ${w}x${h}`)
    if (t.w > LIMITE_TEXTURA || t.h > LIMITE_TEXTURA) errores.push(`${nombre}: ${ruta} pasa de ${LIMITE_TEXTURA} px (${t.w}x${t.h})`)
  }
  for (const [id, p] of Object.entries(m.personajes)) {
    for (const [an, a] of Object.entries(p.anims)) hoja(`personaje ${id}.${an}`, a.archivo, a.cuadros * p.celda, 8 * p.celda)
    if (p.retrato) {
      const t = existsSync(f(p.retrato)) ? tamanoPng(f(p.retrato)) : null
      if (t && (t.w !== 40 || t.h !== 40)) avisos.push(`retrato de ${id} mide ${t.w}x${t.h} (se esperaba 40x40)`)
    }
  }
  for (const [n, fx] of Object.entries(m.fx)) hoja(`fx ${n}`, fx.archivo, fx.cuadros * fx.celda, fx.celda)
  for (const [n, o] of Object.entries(m.mundo.objetos)) for (const [an, a] of Object.entries(o.anims)) hoja(`objeto ${n}.${an}`, a.archivo, a.cuadros * o.w, o.h)
  for (const [n, c] of Object.entries(m.mundo.criaturas)) for (const [an, a] of Object.entries(c.anims)) hoja(`criatura ${n}.${an}`, a.archivo, a.cuadros * c.w, c.h)
  for (const [n, p] of Object.entries(m.mundo.particulas)) hoja(`partícula ${n}`, p.archivo, p.cuadros * p.w, p.h)
  for (const [n, u] of Object.entries(uiImagenes(m))) {
    if (u.caracteres && u.filas) hoja(`ui ${n}`, u.archivo, u.caracteres.length * u.w, u.filas.length * u.h)
    else hoja(`ui ${n}`, u.archivo, u.cuadros * u.w, u.h)
  }
  for (const [n, ruta] of Object.entries(iconosCartel(m))) hoja(`ícono de cartel ${n}`, ruta, 24, 24)
  for (const [n, ruta] of Object.entries(iconosHabilidad(m))) hoja(`ícono de habilidad ${n}`, ruta, 40, 40)
  for (const [n, ic] of Object.entries(m.app ?? {})) hoja(`ícono de app ${n}`, ic.archivo, ic.tam, ic.tam)
  for (const s of m.mundo.suelo) {
    if (existsSync(f(s.archivo))) {
      const t = tamanoPng(f(s.archivo))
      if (t.w > LIMITE_TEXTURA || t.h > LIMITE_TEXTURA) errores.push(`suelo ${s.archivo} pasa de ${LIMITE_TEXTURA} px`)
    }
  }
  // texturas de bruma: potencia de 2 para que repitan en WebGL
  for (const ruta of [m.mundo.niebla.nubes, m.mundo.niebla.jirones]) {
    if (existsSync(f(ruta))) {
      const t = tamanoPng(f(ruta))
      const pot = (n: number) => (n & (n - 1)) === 0
      if (!pot(t.w) || !pot(t.h)) errores.push(`${ruta} mide ${t.w}x${t.h}: la bruma tiene que ser potencia de 2 para repetirse`)
    }
  }

  // 3. fuentes: el .fnt apunta a su png
  for (const [n, fu] of Object.entries(fuentesDe(m))) {
    if (!existsSync(f(fu.fnt))) continue
    const xml = readFileSync(f(fu.fnt), 'utf8')
    if (!xml.includes('<char ')) errores.push(`La fuente ${n} no trae caracteres`)
    for (const id of [0xf1, 0xd1, 0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xa1, 0xbf]) {
      if (!xml.includes(`id="${id}"`)) errores.push(`La fuente ${n} no trae el carácter ${id} (ñ, tildes, ¡ o ¿)`)
    }
  }

  // 4. el mapa pide solo lo que el manifest trae
  if (existsSync(f(m.mundo.mapa))) {
    const json = leerJson<MapaTiled>(f(m.mundo.mapa))
    const mapa = parsearMapa(json)
    if (mapa.ancho !== m.mundo.ancho || mapa.alto !== m.mundo.alto) errores.push(`El mapa mide ${mapa.ancho}x${mapa.alto} y el manifest dice ${m.mundo.ancho}x${m.mundo.alto}`)
    const faltan = new Set<string>()
    for (const d of mapa.decos) if (!m.mundo.objetos[d.sprite]) faltan.add(d.sprite)
    r.revisado.objetosMapa = new Set(mapa.decos.map((d) => d.sprite)).size
    for (const n of faltan) errores.push(`El mapa usa el objeto "${n}" y el manifest no lo trae`)
    for (const e of mapa.entidades) {
      if (e.tipo === 'enemigo' || e.tipo === 'jefe') {
        const id = String(e.props.enemigo ?? '')
        if (!m.personajes[id]) errores.push(`El mapa pone al enemigo "${id}" y el manifest no lo trae`)
      }
      if (e.tipo === 'criatura') {
        const sp = String(e.props.especie ?? '')
        if (!m.mundo.criaturas[sp] && !m.mundo.criaturas[sp.replace(/_izq$/, '')]) errores.push(`El mapa pone la criatura "${sp}" y el manifest no la trae`)
      }
    }
    for (const z of mapa.zonas) {
      const tr = traducirParticulas(z.particulas, () => {})
      for (const d of tr.desconocidas) errores.push(`La zona "${z.nombre}" pide la partícula "${d}" y el juego no la conoce`)
      for (const e of tr.emisores) {
        const tabla = e.tipo === 'particula' ? m.mundo.particulas : m.mundo.criaturas
        for (const llave of e.llaves) if (!tabla[llave]) errores.push(`La zona "${z.nombre}" pide "${e.nombre}" y al kit le falta ${e.tipo} "${llave}"`)
      }
      if (z.luz && !/^#[0-9a-fA-F]{6}$/.test(z.luz)) errores.push(`La zona "${z.nombre}" trae un color de luz raro: ${z.luz}`)
      if (z.ambiente && !m.audio[`ambiente_${z.ambiente}`]) errores.push(`La zona "${z.nombre}" pide el ambiente "${z.ambiente}" y no existe audio.ambiente_${z.ambiente}`)
      if (z.musica && !m.audio[`musica_${z.musica}`]) avisos.push(`La zona "${z.nombre}" pide la música "${z.musica}" y no existe audio.musica_${z.musica}`)
    }
    for (const nombre of Object.keys(m.mundo.postales)) if (!mapa.postales.some((p) => p.nombre === nombre)) avisos.push(`La postal "${nombre}" del manifest no está en la capa postales del mapa`)
  }

  // 5. el catálogo del botín apunta a cuadros que existen
  if (existsSync(f(m.botin.catalogo))) {
    const cat = leerJson<{ items: { id: string; icon: string; atlas: string; animated?: boolean }[] }>(f(m.botin.catalogo))
    const frames: Record<string, Set<string>> = {}
    for (const [atlas, rr] of Object.entries(m.botin.atlas)) {
      if (existsSync(f(rr['32']))) frames[atlas] = new Set(Object.keys(leerJson<{ frames: Record<string, unknown> }>(f(rr['32'])).frames))
    }
    for (const it of cat.items) {
      r.revisado.items++
      const set = frames[it.atlas]
      if (!set) { errores.push(`El objeto ${it.id} dice atlas "${it.atlas}" y no existe`); continue }
      const nombre = it.animated ? `${it.icon}_0` : it.icon
      if (!set.has(nombre)) errores.push(`El objeto ${it.id}: falta el cuadro "${nombre}" en el atlas ${it.atlas}`)
    }
  }

  // 6. cosas de ui que el juego exige
  const necesarias: (keyof Manifest['ui'] | string)[] = ['barra_marco', 'barra_xp', 'boton', 'panel', 'panel_hundido', 'inventario', 'orbe_vida', 'orbe_mana', 'numeros', 'marca_destino']
  for (const n of necesarias) if (!uiImagenes(m)[n as string]) errores.push(`Al kit le falta ui.${n as string}`)
  const inv = uiImagenes(m).inventario as UiImagen | undefined
  if (inv && !inv.layout) errores.push('ui.inventario no trae su layout')

  return r
}
