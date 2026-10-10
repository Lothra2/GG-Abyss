import { CLAVE_GUARDADO, CLAVE_PERFILES, CLAVE_ROTO, type Calidad } from '../config/juego'
import { BOTIN, MODO_PEQUE, OSCURIDAD } from '../config/balance'
import { nocheMaxima } from './zonas'

/**
 * La partida de una jugadora (PLAN.md 3.5). La clave en localStorage es `ggabyss:v1:perfil:<id>`.
 * F1a solo la usa en memoria. En F1b se le suma el guardado, la migración y la lista de perfiles.
 */

export interface Ajustes {
  /** control de Noche, 0 a 0.55 (0.25 en modo peque) */
  noche: number
  calidad: Calidad
  musica: number
  efectos: number
  modoPeque: boolean
  /** F7: sin sacudidas, destellos ni congelados (para quien se marea o se asusta) */
  efectosSuaves: boolean
  /** F7: las mejoras de inmersión prendidas (para comparar antes y después jugando) */
  mejorasF7: boolean
}

export interface Partida {
  version: 1
  /** id del personaje en el manifest */
  id: string
  creada: number
  actualizada: number
  nivel: number
  xp: number
  oro: number
  vida: number
  mana: number
  posicion: { x: number; y: number }
  ultimaFogata: string
  zonas: string[]
  secretos: string[]
  cofres: string[]
  rompibles: string[]
  presentacionVista: boolean
  jefeVencido: boolean
  equipo: Record<string, string>
  bolsa: (string | null)[]
  cinturon: (string | null)[]
  ajustes: Ajustes
  /** F2: vida del jefe si la heroína cayó en la pelea (el jefe no se cura) */
  jefeVida?: number
  /** segundos jugados, para el resumen de Continuará */
  tiempoJugado?: number
  /** F7: las demostraciones que ya vio (caminar, pegar, abrir) */
  tutorial: string[]
  /**
   * F8: el mundo donde está (mundo1 el Bosque, mundo2 la Catedral). Los campos de arriba que dependen del mapa
   * (posición, fogata, zonas, secretos, cofres, rompibles, presentación y jefe) son siempre los de este mundo. Los de
   * los otros mundos esperan en `otrosMundos` hasta que vuelva. Nivel, oro, equipo, bolsa y Thor son de la heroína.
   */
  mundo: string
  otrosMundos: Record<string, EstadoMundo>
  /** F8: las brasas de la Catedral que ya volvieron (son del mundo, viajan en `otrosMundos` como las zonas) */
  brasas: string[]
}

/** Lo que una partida recuerda de un mundo en el que no está */
export interface EstadoMundo {
  posicion: { x: number; y: number }
  ultimaFogata: string
  zonas: string[]
  secretos: string[]
  cofres: string[]
  rompibles: string[]
  presentacionVista: boolean
  jefeVencido: boolean
  jefeVida?: number
  brasas: string[]
}

export const MUNDO_INICIAL = 'mundo1'

export const VERSION_PARTIDA = 1

export function ajustesPorDefecto(id: string): Ajustes {
  return {
    noche: OSCURIDAD.nocheDefecto,
    calidad: 'alta',
    musica: 0.8,
    efectos: 0.9,
    modoPeque: MODO_PEQUE.porDefecto.includes(id),
    efectosSuaves: false,
    mejorasF7: true,
  }
}

export function partidaNueva(id: string, ahora: number = Date.now()): Partida {
  return {
    version: VERSION_PARTIDA,
    id,
    creada: ahora,
    actualizada: ahora,
    nivel: 1,
    xp: 0,
    oro: 0,
    vida: 0,
    mana: 0,
    posicion: { x: 0, y: 0 },
    ultimaFogata: '',
    zonas: [],
    secretos: [],
    cofres: [],
    rompibles: [],
    presentacionVista: false,
    jefeVencido: false,
    equipo: {},
    bolsa: Array.from({ length: 28 }, () => null),
    cinturon: [...BOTIN.cinturonInicial],
    ajustes: ajustesPorDefecto(id),
    tutorial: [],
    mundo: MUNDO_INICIAL,
    otrosMundos: {},
    brasas: [],
  }
}

/** Lo que la partida tiene del mundo donde está ahora (copias, no los mismos arreglos) */
export function estadoDeMundo(p: Partida): EstadoMundo {
  const e: EstadoMundo = {
    posicion: { ...p.posicion },
    ultimaFogata: p.ultimaFogata,
    zonas: [...p.zonas],
    secretos: [...p.secretos],
    cofres: [...p.cofres],
    rompibles: [...p.rompibles],
    presentacionVista: p.presentacionVista,
    jefeVencido: p.jefeVencido,
    brasas: [...p.brasas],
  }
  if (p.jefeVida !== undefined) e.jefeVida = p.jefeVida
  return e
}

/** Un mundo al que nunca fue: empieza en el inicio del mapa */
export function mundoNuevo(): EstadoMundo {
  return { posicion: { x: 0, y: 0 }, ultimaFogata: '', zonas: [], secretos: [], cofres: [], rompibles: [], presentacionVista: false, jefeVencido: false, brasas: [] }
}

/**
 * Cambia de mundo sin perder nada: lo del mundo actual queda guardado en `otrosMundos` (con la posición donde
 * conviene volver, por ejemplo junto al portal) y lo del destino pasa a los campos de siempre. Los arreglos de la
 * partida se vacían y se rellenan en el lugar, así quien los tenga en la mano sigue viendo los de ahora.
 */
export function cambiarDeMundo(p: Partida, destino: string, posicionAlVolver?: { x: number; y: number }): Partida {
  if (destino === p.mundo) return p
  const actual = estadoDeMundo(p)
  if (posicionAlVolver) actual.posicion = { ...posicionAlVolver }
  const otros = { ...p.otrosMundos, [p.mundo]: actual }
  const llega = otros[destino] ?? mundoNuevo()
  delete otros[destino]
  const poner = (a: string[], b: string[]) => a.splice(0, a.length, ...b)
  p.posicion = { ...llega.posicion }
  p.ultimaFogata = llega.ultimaFogata
  poner(p.zonas, llega.zonas)
  poner(p.secretos, llega.secretos)
  poner(p.cofres, llega.cofres)
  poner(p.rompibles, llega.rompibles)
  poner(p.brasas, llega.brasas)
  p.presentacionVista = llega.presentacionVista
  p.jefeVencido = llega.jefeVencido
  if (llega.jefeVida !== undefined) p.jefeVida = llega.jefeVida
  else delete p.jefeVida
  p.mundo = destino
  p.otrosMundos = otros
  return p
}

/** Lo que guardó de otro mundo, leído de un JSON viejo o roto sin romperse */
function leerEstadoMundo(v: unknown): EstadoMundo | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const pos = (o.posicion && typeof o.posicion === 'object' ? o.posicion : {}) as Record<string, unknown>
  const e: EstadoMundo = {
    posicion: { x: esNum(pos.x) ? pos.x : 0, y: esNum(pos.y) ? pos.y : 0 },
    ultimaFogata: typeof o.ultimaFogata === 'string' ? o.ultimaFogata : '',
    zonas: textos(o.zonas),
    secretos: textos(o.secretos),
    cofres: textos(o.cofres),
    rompibles: textos(o.rompibles),
    presentacionVista: o.presentacionVista === true,
    jefeVencido: o.jefeVencido === true,
    brasas: textos(o.brasas),
  }
  if (esNum(o.jefeVida)) e.jefeVida = Math.max(0, o.jefeVida)
  return e
}

/* ---------- almacenamiento ---------- */

/** Lo mínimo de localStorage que usa el juego, para poder probarlo con un almacén de memoria */
export interface Almacen {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export class AlmacenMemoria implements Almacen {
  readonly datos = new Map<string, string>()
  getItem(k: string): string | null {
    return this.datos.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.datos.set(k, v)
  }
  removeItem(k: string): void {
    this.datos.delete(k)
  }
  claves(): string[] {
    return [...this.datos.keys()]
  }
}

/** El localStorage del navegador, o un almacén en memoria si no se puede usar (modo privado, bloqueado) */
export function almacenDelNavegador(): Almacen {
  try {
    const t = '__ggabyss_prueba__'
    window.localStorage.setItem(t, '1')
    window.localStorage.removeItem(t)
    return window.localStorage
  } catch {
    return new AlmacenMemoria()
  }
}

export const claveDe = (id: string): string => `${CLAVE_GUARDADO}${id}`

const esNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const esLista = (v: unknown): v is unknown[] => Array.isArray(v)
const textos = (v: unknown): string[] => (esLista(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const limitar = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

/**
 * Sube cualquier partida vieja a la versión actual (PLAN.md 3.5): rellena lo que falte con los valores
 * por defecto, arregla tipos y recorta rangos. Devuelve null solo si no es una partida de nadie.
 */
export function migrar(json: unknown, idEsperado?: string): Partida | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const j = json as Record<string, unknown>
  const id = typeof j.id === 'string' && j.id ? j.id : idEsperado
  if (!id) return null
  const base = partidaNueva(id, esNum(j.creada) ? j.creada : Date.now())
  // la versión 0 de prueba llamaba `nivel` a `level` y `oro` a `gold`
  const nivel = esNum(j.nivel) ? j.nivel : esNum(j.level) ? j.level : base.nivel
  const oro = esNum(j.oro) ? j.oro : esNum(j.gold) ? j.gold : base.oro
  const aj = (j.ajustes && typeof j.ajustes === 'object' ? j.ajustes : {}) as Record<string, unknown>
  const modoPeque = typeof aj.modoPeque === 'boolean' ? aj.modoPeque : base.ajustes.modoPeque
  const pos = (j.posicion && typeof j.posicion === 'object' ? j.posicion : {}) as Record<string, unknown>
  const bolsa = esLista(j.bolsa) ? j.bolsa.slice(0, 28).map((x) => (typeof x === 'string' ? x : null)) : []
  while (bolsa.length < 28) bolsa.push(null)
  const cinto = esLista(j.cinturon) ? j.cinturon.slice(0, 4).map((x) => (typeof x === 'string' ? x : null)) : []
  while (cinto.length < 4) cinto.push(null)
  const equipo: Record<string, string> = {}
  if (j.equipo && typeof j.equipo === 'object') for (const [k, v] of Object.entries(j.equipo as Record<string, unknown>)) if (typeof v === 'string') equipo[k] = v

  const p: Partida = {
    version: VERSION_PARTIDA,
    id,
    creada: base.creada,
    actualizada: esNum(j.actualizada) ? j.actualizada : base.actualizada,
    nivel: Math.round(limitar(nivel, 1, 10)),
    xp: Math.max(0, esNum(j.xp) ? j.xp : 0),
    oro: Math.max(0, Math.round(oro)),
    vida: Math.max(0, esNum(j.vida) ? j.vida : 0),
    mana: Math.max(0, esNum(j.mana) ? j.mana : 0),
    posicion: { x: esNum(pos.x) ? pos.x : 0, y: esNum(pos.y) ? pos.y : 0 },
    ultimaFogata: typeof j.ultimaFogata === 'string' ? j.ultimaFogata : '',
    zonas: textos(j.zonas),
    secretos: textos(j.secretos),
    cofres: textos(j.cofres),
    rompibles: textos(j.rompibles),
    presentacionVista: j.presentacionVista === true,
    // una partida de antes de F7 que ya jugó no vuelve a ver las demostraciones
    tutorial: esLista(j.tutorial) ? textos(j.tutorial) : j.presentacionVista === true || textos(j.zonas).length > 1 ? ['caminar', 'pegar', 'abrir'] : [],
    jefeVencido: j.jefeVencido === true,
    // F8: las partidas de antes de la Catedral están todas en el Bosque
    mundo: typeof j.mundo === 'string' && j.mundo ? j.mundo : MUNDO_INICIAL,
    otrosMundos: {},
    brasas: textos(j.brasas),
    equipo,
    bolsa,
    cinturon: cinto,
    ajustes: {
      noche: limitar(esNum(aj.noche) ? aj.noche : OSCURIDAD.nocheDefecto, 0, nocheMaxima(modoPeque)),
      calidad: aj.calidad === 'baja' ? 'baja' : 'alta',
      musica: limitar(esNum(aj.musica) ? aj.musica : base.ajustes.musica, 0, 1),
      efectos: limitar(esNum(aj.efectos) ? aj.efectos : base.ajustes.efectos, 0, 1),
      modoPeque,
      efectosSuaves: typeof aj.efectosSuaves === 'boolean' ? aj.efectosSuaves : false,
      mejorasF7: typeof aj.mejorasF7 === 'boolean' ? aj.mejorasF7 : true,
    },
  }
  if (j.otrosMundos && typeof j.otrosMundos === 'object' && !Array.isArray(j.otrosMundos))
    for (const [k, v] of Object.entries(j.otrosMundos as Record<string, unknown>)) {
      const e = leerEstadoMundo(v)
      if (e && k !== p.mundo) p.otrosMundos[k] = e
    }
  if (esNum(j.jefeVida)) p.jefeVida = Math.max(0, j.jefeVida)
  if (esNum(j.tiempoJugado)) p.tiempoJugado = Math.max(0, j.tiempoJugado)
  return p
}

export interface ResultadoLeer {
  partida: Partida | null
  /** había algo guardado pero no se pudo leer: se dejó una copia */
  rota: boolean
  /** clave donde quedó la copia de lo roto */
  copia?: string
}

/** Lee la partida de un perfil. Si el JSON está roto deja una copia en `ggabyss:v1:roto:<id>:<fecha>` y no la borra. */
export function leerPartida(alm: Almacen, id: string, ahora: number = Date.now()): ResultadoLeer {
  const crudo = alm.getItem(claveDe(id))
  if (crudo === null) return { partida: null, rota: false }
  let json: unknown
  try {
    json = JSON.parse(crudo)
  } catch {
    json = undefined
  }
  const p = json === undefined ? null : migrar(json, id)
  if (p && p.id === id) return { partida: p, rota: false }
  const copia = `${CLAVE_ROTO}${id}:${ahora}`
  alm.setItem(copia, crudo)
  alm.removeItem(claveDe(id))
  return { partida: null, rota: true, copia }
}

export function listaPerfiles(alm: Almacen): string[] {
  try {
    const l = JSON.parse(alm.getItem(CLAVE_PERFILES) ?? '[]') as unknown
    return textos(l)
  } catch {
    return []
  }
}

export function guardarPartida(alm: Almacen, p: Partida, ahora: number = Date.now()): void {
  p.actualizada = ahora
  alm.setItem(claveDe(p.id), JSON.stringify(p))
  const l = listaPerfiles(alm)
  if (!l.includes(p.id)) alm.setItem(CLAVE_PERFILES, JSON.stringify([...l, p.id]))
}

/** Borra un perfil. Deja una copia por si se borró sin querer. */
export function borrarPartida(alm: Almacen, id: string, ahora: number = Date.now()): void {
  const crudo = alm.getItem(claveDe(id))
  if (crudo !== null) alm.setItem(`${CLAVE_ROTO}${id}:borrada:${ahora}`, crudo)
  alm.removeItem(claveDe(id))
  alm.setItem(CLAVE_PERFILES, JSON.stringify(listaPerfiles(alm).filter((x) => x !== id)))
}

/** Lee la partida o crea una nueva (sin guardarla todavía) */
export function cargarOCrear(alm: Almacen, id: string, ahora: number = Date.now()): { partida: Partida; nueva: boolean; rota: boolean } {
  const r = leerPartida(alm, id, ahora)
  if (r.partida) return { partida: r.partida, nueva: false, rota: false }
  return { partida: partidaNueva(id, ahora), nueva: true, rota: r.rota }
}
