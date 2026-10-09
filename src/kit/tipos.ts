/**
 * Tipos que calcan el manifest.json del kit de PixelForja y el mapa de Tiled.
 * Lo que dice el kit real manda: si el taller agrega campos, se agregan aquí como opcionales.
 */

export type Direccion = 'down' | 'down_left' | 'left' | 'up_left' | 'up' | 'up_right' | 'right' | 'down_right'

export interface AnimHoja {
  archivo: string
  cuadros: number
  fps: number
  loop: boolean
}

export interface AnimFx extends AnimHoja {
  celda: number
}

export interface Personaje {
  tipo: 'heroe' | 'mascota' | 'enemigo' | 'jefe' | string
  nombre: string
  clase?: string
  retrato?: string
  celda: number
  pivote: [number, number]
  desde_estudio?: boolean
  anims: Record<string, AnimHoja>
}

export interface AtlasRutas {
  '32': string
  '64': string
}

export interface Botin {
  atlas: Record<string, AtlasRutas>
  mundo: string
  catalogo: string
  notas?: string
}

export interface LuzObjeto {
  color: string
  radius: number
  flicker?: boolean
  pulse?: boolean
  dy?: number
}

/** [dx, dy, ancho, alto] relativos al punto de apoyo */
export type Rect4 = [number, number, number, number]

export interface ObjetoMundo {
  w: number
  h: number
  apoyo: [number, number]
  solido?: Rect4 | null
  solidos?: Rect4[]
  capa?: 'suelo'
  luz?: LuzObjeto
  anims: Record<string, AnimHoja>
}

export interface ParticulaDef {
  archivo: string
  w: number
  h: number
  cuadros: number
  fps: number
}

export interface CriaturaDef {
  w: number
  h: number
  anims: Record<string, AnimHoja>
}

export interface SueloTrozo {
  archivo: string
  x: number
  y: number
}

export interface MundoManifest {
  mapa: string
  nombre: string
  ancho: number
  alto: number
  cuadro: number
  trozo: number
  agua: string
  suelo: SueloTrozo[]
  vista: string
  postales: Record<string, string>
  objetos: Record<string, ObjetoMundo>
  particulas: Record<string, ParticulaDef>
  criaturas: Record<string, CriaturaDef>
  luz: string
  nube: string
  niebla: { nubes: string; jirones: string; notas?: string }
  referencia?: string
  notas?: string
}

export interface UiImagen {
  archivo: string
  w: number
  h: number
  cuadros: number
  nueve?: [number, number, number, number]
  layout?: LayoutInventario
  caracteres?: string
  filas?: string[]
}

export interface LayoutInventario {
  w: number
  h: number
  titulo: Rect4
  equipo: Record<string, Rect4>
  rejilla: { x: number; y: number; cols: number; filas: number; celda: number }
  oro: { icono: [number, number, number, number]; texto: Rect4 }
}

export interface FuenteDef {
  png: string
  fnt: string
  alto_linea: number
  base: number
}

export type FuentesManifest = Record<string, FuenteDef | string>

/** `fuentes` convive con las demás imágenes de ui, por eso el tipo de ui es abierto */
export interface UiManifest {
  fuentes: FuentesManifest
  [nombre: string]: UiImagen | FuentesManifest
}

export interface Manifest {
  juego: string
  generado_con: string
  version: number
  cuadro_mundo: number
  direcciones: Direccion[]
  notas?: string
  personajes: Record<string, Personaje>
  fx: Record<string, AnimFx>
  botin: Botin
  mundo: MundoManifest
  ui: UiManifest
  audio: Record<string, string>
  creditos: string
}

/* ---------- mapa de Tiled ---------- */

export interface PropTiled {
  name: string
  type: string
  value: string | number | boolean
}

export interface ObjetoTiled {
  id: number
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  properties?: PropTiled[]
}

export interface CapaTiled {
  id: number
  name: string
  type: 'tilelayer' | 'objectgroup' | 'group' | 'imagelayer'
  data?: number[]
  objects?: ObjetoTiled[]
  layers?: CapaTiled[]
  width?: number
  height?: number
}

export interface TilesetTiled {
  firstgid: number
  name: string
  image: string
  tilecount: number
  tiles?: { id: number; animation?: { tileid: number; duration: number }[] }[]
}

export interface MapaTiled {
  width: number
  height: number
  tilewidth: number
  tileheight: number
  layers: CapaTiled[]
  tilesets: TilesetTiled[]
  properties?: PropTiled[]
}
