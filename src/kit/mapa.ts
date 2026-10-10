import type { CapaTiled, MapaTiled, ObjetoTiled } from './tipos'

/** Datos puros del mapa de Tiled: sin Phaser, para poder probarlos en Node. */

export type Props = Record<string, string | number | boolean>

export interface Deco {
  sprite: string
  x: number
  y: number
}

export interface Entidad {
  id: number
  tipo: string
  x: number
  y: number
  props: Props
}

export interface Zona {
  nombre: string
  x: number
  y: number
  w: number
  h: number
  area: number
  musica: string
  ambiente: string
  /** color hex del tinte de la zona */
  luz: string | null
  oscuridad: number
  niebla: number
  particulas: string[]
  descubrir: boolean
  secreto: boolean
  props: Props
}

export interface Postal {
  nombre: string
  x: number
  y: number
}

export interface MapaJuego {
  /** tamaño en cuadros */
  ancho: number
  alto: number
  cuadro: number
  /** 1 = no se pasa */
  colision: Uint8Array
  /** qué suena al pisar cada cuadro: 1 pasto, 2 tierra, 3 piedra, 4 madera, 5 agua (0 si el mapa no trae la capa) */
  superficie: Uint8Array
  /** 0 = no hay agua, si no es el id del tile del agua (0 animado + 1) */
  agua: Uint8Array
  aguaCuadros: number
  aguaMs: number
  decos: Deco[]
  entidades: Entidad[]
  zonas: Zona[]
  postales: Postal[]
  /** F8: el bioma del mapa (bosque, catedral). Un interior no tiene cielo: nada de ambiente flota sobre los muros */
  bioma: string
}

export function leerProps(o: { properties?: { name: string; value: string | number | boolean }[] }): Props {
  const p: Props = {}
  for (const x of o.properties ?? []) p[x.name] = x.value
  return p
}

function aplanar(capas: CapaTiled[]): CapaTiled[] {
  const out: CapaTiled[] = []
  for (const c of capas) {
    out.push(c)
    if (c.layers) out.push(...aplanar(c.layers))
  }
  return out
}

function objetosDe(capas: CapaTiled[], nombre: string): ObjetoTiled[] {
  return aplanar(capas).find((c) => c.name === nombre && c.objects)?.objects ?? []
}

export function parsearMapa(json: MapaTiled): MapaJuego {
  const ancho = json.width
  const alto = json.height
  const capas = aplanar(json.layers)
  const dataDe = (nombre: string): number[] => {
    const c = capas.find((l) => l.name === nombre && l.type === 'tilelayer')
    if (!c?.data || c.data.length !== ancho * alto) throw new Error(`El mapa no trae la capa "${nombre}" completa`)
    return c.data
  }

  const colData = dataDe('colision')
  const colision = new Uint8Array(ancho * alto)
  colData.forEach((v, i) => (colision[i] = v !== 0 ? 1 : 0))

  const aguaData = dataDe('agua')
  const agua = new Uint8Array(ancho * alto)
  aguaData.forEach((v, i) => (agua[i] = Math.min(255, v)))

  // capa de superficie para los pasos (el taller la agregó en la entrega 3b: si falta todo es pasto)
  const supCapa = capas.find((l) => l.name === 'superficie' && l.type === 'tilelayer')
  const superficie = new Uint8Array(ancho * alto)
  if (supCapa?.data && supCapa.data.length === ancho * alto) supCapa.data.forEach((v, i) => (superficie[i] = Math.min(255, v)))

  // animación del tile 0 del tileset del agua: cuántos cuadros y cuánto dura cada uno
  const ts = json.tilesets.find((t) => t.name === 'agua')
  const anim = ts?.tiles?.find((t) => t.id === 0)?.animation
  const aguaCuadros = anim?.length ?? 1
  const aguaMs = anim?.[0]?.duration ?? 220

  const decos: Deco[] = []
  for (const o of objetosDe(json.layers, 'objetos')) {
    const p = leerProps(o)
    const sprite = String(p.sprite ?? o.name)
    decos.push({ sprite, x: o.x, y: o.y })
  }

  const entidades: Entidad[] = objetosDe(json.layers, 'entidades').map((o) => ({
    id: o.id,
    tipo: o.type || o.name,
    x: o.x,
    y: o.y,
    props: leerProps(o),
  }))

  const zonas: Zona[] = objetosDe(json.layers, 'zonas').map((o) => {
    const p = leerProps(o)
    return {
      nombre: o.name,
      x: o.x,
      y: o.y,
      w: o.width,
      h: o.height,
      area: o.width * o.height,
      musica: String(p.musica ?? 'bosque'),
      ambiente: String(p.ambiente ?? 'bosque'),
      luz: typeof p.luz === 'string' ? p.luz : null,
      oscuridad: Number(p.oscuridad ?? 0),
      niebla: Number(p.niebla ?? 0.3),
      particulas: String(p.particulas ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      descubrir: p.descubrir === true,
      secreto: p.secreto === true,
      props: p,
    }
  })

  const postales: Postal[] = objetosDe(json.layers, 'postales').map((o) => ({ nombre: o.name, x: o.x, y: o.y }))

  const bioma = String(leerProps(json as unknown as { properties?: { name: string; value: string | number | boolean }[] }).bioma ?? 'bosque')
  return { ancho, alto, cuadro: json.tilewidth, colision, superficie, agua, aguaCuadros, aguaMs, decos, entidades, zonas, postales, bioma }
}

export type Superficie = 'pasto' | 'tierra' | 'piedra' | 'madera' | 'agua'
const NOMBRES_SUPERFICIE: Superficie[] = ['pasto', 'pasto', 'tierra', 'piedra', 'madera', 'agua']

/** Qué hay bajo los pies en un punto del mundo (px) */
export function superficieEn(m: Pick<MapaJuego, 'ancho' | 'alto' | 'cuadro' | 'superficie'>, x: number, y: number): Superficie {
  const tx = Math.floor(x / m.cuadro)
  const ty = Math.floor(y / m.cuadro)
  if (tx < 0 || ty < 0 || tx >= m.ancho || ty >= m.alto) return 'pasto'
  return NOMBRES_SUPERFICIE[m.superficie[ty * m.ancho + tx]!] ?? 'pasto'
}

export function entidadesDeTipo(m: MapaJuego, tipo: string): Entidad[] {
  return m.entidades.filter((e) => e.tipo === tipo)
}

/** Llave estable de una entidad para el guardado: `tipo:x:y` */
export function llaveEntidad(e: { tipo: string; x: number; y: number }): string {
  return `${e.tipo}:${Math.round(e.x)}:${Math.round(e.y)}`
}

/** Cofres secretos del mapa más las zonas secretas: el total de "secretos" que se cuenta en el juego */
export function totalSecretos(m: MapaJuego): number {
  return entidadesDeTipo(m, 'cofre').filter((c) => c.props.secreto === true).length + m.zonas.filter((z) => z.secreto).length
}

/** Zonas que se descubren (las que traen `descubrir`) */
export function totalZonasDescubribles(m: MapaJuego): number {
  return m.zonas.filter((z) => z.descubrir).length
}

/* ---------- partículas de zona a llaves del kit ---------- */

export interface EmisorZona {
  /** nombre que usa la zona */
  nombre: string
  tipo: 'particula' | 'criatura'
  /** llaves de manifest.mundo.particulas o manifest.mundo.criaturas, se elige una al azar */
  llaves: string[]
}

const TRADUCCION: Record<string, EmisorZona> = {
  polen: { nombre: 'polen', tipo: 'particula', llaves: ['polen'] },
  mariposas: { nombre: 'mariposas', tipo: 'particula', llaves: ['mariposa_azul', 'mariposa_naranja', 'mariposa_rosa'] },
  hojas: { nombre: 'hojas', tipo: 'particula', llaves: ['hoja_verde', 'hoja_otono'] },
  luciernagas: { nombre: 'luciernagas', tipo: 'particula', llaves: ['luciernaga'] },
  luciernagas_turquesa: { nombre: 'luciernagas_turquesa', tipo: 'particula', llaves: ['luciernaga_turquesa'] },
  esporas: { nombre: 'esporas', tipo: 'particula', llaves: ['espora'] },
  brillos: { nombre: 'brillos', tipo: 'particula', llaves: ['brillo'] },
  humo: { nombre: 'humo', tipo: 'particula', llaves: ['humo'] },
  polvo: { nombre: 'polvo', tipo: 'particula', llaves: ['polvo'] },
  brasas: { nombre: 'brasas', tipo: 'particula', llaves: ['brasa'] },
  gotas: { nombre: 'gotas', tipo: 'particula', llaves: ['gota'] },
  fuegos_fatuos: { nombre: 'fuegos_fatuos', tipo: 'criatura', llaves: ['fuego_fatuo', 'fuego_fatuo_violeta'] },
  murcielagos: { nombre: 'murcielagos', tipo: 'criatura', llaves: ['murcielago'] },
}

export interface TraduccionZona {
  emisores: EmisorZona[]
  desconocidas: string[]
}

const avisadas = new Set<string>()

/** Traduce los nombres en plural de una zona a llaves reales del kit. Los que no conoce se avisan una vez y se ignoran. */
export function traducirParticulas(nombres: string[], avisar: (msg: string) => void = (m) => console.warn(m)): TraduccionZona {
  const emisores: EmisorZona[] = []
  const desconocidas: string[] = []
  for (const n of nombres) {
    const e = TRADUCCION[n]
    if (e) emisores.push(e)
    else {
      desconocidas.push(n)
      if (!avisadas.has(n)) {
        avisadas.add(n)
        avisar(`Partícula de zona desconocida "${n}": se ignora`)
      }
    }
  }
  return { emisores, desconocidas }
}

export function nombresParticulasConocidas(): string[] {
  return Object.keys(TRADUCCION)
}
