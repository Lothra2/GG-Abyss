import type { Manifest, FuenteDef, Personaje, UiImagen } from './tipos'
import { NOMBRE_JUEGO, VERSION_KIT_ESPERADA, ORDEN_HEROES } from '../config/juego'

/** Error con mensaje claro para el aviso del kit faltante o roto */
export class KitError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'KitError'
  }
}

export const MENSAJE_KIT_FALTANTE = 'No encuentro el kit. Corre npm run kit.'

/** Revisa lo mínimo para que el juego arranque y devuelve el manifest tipado */
export function validarManifest(json: unknown): Manifest {
  if (!json || typeof json !== 'object') throw new KitError(MENSAJE_KIT_FALTANTE)
  const m = json as Partial<Manifest>
  if (m.juego !== NOMBRE_JUEGO) throw new KitError(`El kit no es de ${NOMBRE_JUEGO}. Corre npm run kit.`)
  if (m.version !== VERSION_KIT_ESPERADA) throw new KitError(`El kit es de la versión ${String(m.version)} y el juego espera la ${VERSION_KIT_ESPERADA}. Corre npm run kit.`)
  for (const campo of ['personajes', 'fx', 'botin', 'mundo', 'ui', 'audio'] as const) {
    if (!m[campo]) throw new KitError(`Al kit le falta "${campo}". Corre npm run kit.`)
  }
  if (!Array.isArray(m.direcciones) || m.direcciones.length !== 8) throw new KitError('El kit no trae las 8 direcciones. Corre npm run kit.')
  return m as Manifest
}

/** Nombres de fuentes bitmap del manifest (sin la llave `notas`) */
export function fuentesDe(m: Manifest): Record<string, FuenteDef> {
  const out: Record<string, FuenteDef> = {}
  for (const [n, v] of Object.entries(m.ui.fuentes)) if (typeof v === 'object') out[n] = v
  return out
}

/** Imágenes de ui (todo lo de `ui` menos `fuentes`) */
export function uiImagenes(m: Manifest): Record<string, UiImagen> {
  const out: Record<string, UiImagen> = {}
  for (const [n, v] of Object.entries(m.ui)) if (n !== 'fuentes' && v && typeof v === 'object' && 'archivo' in v) out[n] = v as UiImagen
  return out
}

export function ui(m: Manifest, nombre: string): UiImagen {
  const v = uiImagenes(m)[nombre]
  if (!v) throw new KitError(`El kit no trae ui.${nombre}`)
  return v
}

/** Heroínas jugables: todos los personajes tipo `heroe`, en el orden fijo y luego las del estudio por nombre */
export function heroes(m: Manifest): string[] {
  const ids = Object.entries(m.personajes)
    .filter(([, p]) => p.tipo === 'heroe')
    .map(([id]) => id)
  const conocidos = ORDEN_HEROES.filter((id) => ids.includes(id))
  const resto = ids.filter((id) => !ORDEN_HEROES.includes(id)).sort()
  return [...conocidos, ...resto]
}

export function personaje(m: Manifest, id: string): Personaje {
  const p = m.personajes[id]
  if (!p) throw new KitError(`El kit no trae el personaje ${id}`)
  return p
}

/** Armadura de Thor del nivel n (1 a 5), o el Thor base si es 0 */
export function idThor(nivelArmadura: number): string {
  return nivelArmadura > 0 ? `thor_armadura${Math.min(5, Math.max(1, nivelArmadura))}` : 'thor'
}

/** Todas las rutas de archivo que el manifest nombra, para verificarlas */
export function rutasDelManifest(m: Manifest): string[] {
  const out = new Set<string>()
  const add = (r?: string) => r && out.add(r)
  for (const p of Object.values(m.personajes)) {
    add(p.retrato)
    for (const a of Object.values(p.anims)) add(a.archivo)
  }
  for (const f of Object.values(m.fx)) add(f.archivo)
  for (const rutas of Object.values(m.botin.atlas)) {
    add(rutas['32'])
    add(rutas['32'].replace('.json', '.png'))
    add(rutas['64'])
    add(rutas['64'].replace('.json', '.png'))
  }
  add(m.botin.mundo)
  add(m.botin.mundo.replace('.json', '.png'))
  add(m.botin.catalogo)
  const mu = m.mundo
  add(mu.mapa)
  add(mu.agua)
  add(mu.vista)
  add(mu.luz)
  add(mu.nube)
  add(mu.niebla.nubes)
  add(mu.niebla.jirones)
  for (const s of mu.suelo) add(s.archivo)
  for (const r of Object.values(mu.postales)) add(r)
  for (const o of Object.values(mu.objetos)) for (const a of Object.values(o.anims)) add(a.archivo)
  for (const p of Object.values(mu.particulas)) add(p.archivo)
  for (const c of Object.values(mu.criaturas)) for (const a of Object.values(c.anims)) add(a.archivo)
  for (const [n, v] of Object.entries(m.ui)) {
    if (n === 'fuentes') {
      for (const f of Object.values(v as Record<string, FuenteDef | string>)) if (typeof f === 'object') { add(f.png); add(f.fnt) }
    } else if (v && typeof v === 'object' && 'archivo' in v) add((v as UiImagen).archivo)
  }
  for (const r of Object.values(m.audio)) add(r)
  add(m.creditos)
  return [...out]
}
