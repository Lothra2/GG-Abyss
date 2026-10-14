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
  /** movimiento premium del taller: en qué cuadro cae cada paso, golpe, grito o suelta */
  eventos?: EventoAnim[]
  /** pixeles por ciclo completo de la animación (caminar, correr, cargar): para que los pies no patinen */
  avance?: number
  /** px/s a los que el pie no patina con el fps de la hoja */
  velocidad_natural?: number
  /** jefes: [desde, hasta] cuadros de la preparación de un golpe fuerte */
  aviso?: [number, number]
  /** jefes: cuánto sube el sprite sobre su sombra en cada cuadro (el salto del minotauro) */
  elevacion?: number[]
  /** F12: la antena del Pez Farol: por dirección (fila de la hoja) y por cuadro, [x, y] desde el pivote o null bajo el agua */
  antena?: ([number, number] | null)[][]
  /** F12: la corona del Rey de Piedra, igual que la antena */
  corona?: ([number, number] | null)[][]
  /** F12: la boca de la Dragona de Brasa (su luz y de dónde sale el aliento), igual que la antena */
  boca?: ([number, number] | null)[][]
  /** F13: los ojos del Diablo por dirección y cuadro (la luz que se ve en la oscuridad) */
  ojos?: ([number, number] | null)[][]
  /** F12: la jaula que carga el farolero de cadenas, igual que la antena */
  jaula?: ([number, number] | null)[][]
}

export interface EventoAnim {
  tipo: 'paso' | 'impacto' | 'suelta' | 'grito' | 'despegue' | 'aterriza' | string
  cuadro: number
  fase?: number
  pie?: string
  /** dónde pega (desde el pivote), por dirección o uno solo */
  punto?: Record<string, [number, number]> | [number, number]
}

export interface AnimFx extends AnimHoja {
  celda: number
  /** los que no son cuadrados (la ola, el aviso de la mordida) traen su ancho y su alto */
  w?: number
  h?: number
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
  /** capas de equipo (heroínas): la hoja base va sin arma ni mano libre */
  capas?: CapasPersonaje
  /** vuela (no pisa el agua ni la marea) */
  vuela?: boolean
  /** capa que va encima de otro personaje, cuadro por cuadro (el farol de Thor) */
  capa_de?: string
  /** minijefe (el Capitán Ahogado) */
  elite?: boolean
  /** vive en el agua: la hoja ya trae lo de abajo de la superficie teñido (el Pez Farol) */
  en_agua?: boolean
  /** la luz que lleva en la antena (la luz robada del faro) */
  luz_antena?: { color: string; radius: number; notas?: string }
  /** la luz de la corona (la luz robada de la ciudad) */
  luz_corona?: { color: string; radius: number; notas?: string }
  /** la luz de la boca de la Dragona de Brasa */
  luz_boca?: { color: string; radius: number; notas?: string }
  luz_ojos?: { color: string; radius: number; notas?: string }
}

export type TipoCapa = 'pecho' | 'casco' | 'arma' | 'mano' | 'alas_detras' | 'alas_delante' | 'aura'

/** Una capa: una hoja con un bloque por animación (8 filas, una por dirección, y una columna por cuadro) */
export interface CapaHoja {
  archivo: string
  columnas: number
  /** F13: un bloque puede venir en su propia hoja (el `volar` de la celestial): `archivo` y `columnas` propios */
  bloques: Record<string, { x: number; y: number; cuadros: number; archivo?: string; columnas?: number }>
}

export interface CapasPersonaje {
  orden: TipoCapa[]
  /** lo que lleva sin nada puesto (el arma y la mano libre de su clase) */
  defecto: { arma: string | null; mano: string | null }
  arma: Record<string, CapaHoja>
  mano: Record<string, CapaHoja>
  pecho: Record<string, CapaHoja>
  casco: Record<string, CapaHoja>
  /** F13: la heroína celestial: las alas (detrás y delante del cuerpo) y la aureola, y en qué orden van con la base */
  alas_detras?: Record<string, CapaHoja>
  alas_delante?: Record<string, CapaHoja>
  aura?: Record<string, CapaHoja>
  orden_celestial?: string[]
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
  /** suelo: debajo de todo. frente: primer plano con paralaje. fondo: el abismo que se ve donde no hay piso (F10) */
  capa?: 'suelo' | 'frente' | 'fondo'
  /** sombra horneada por el taller, del mismo tamaño que el objeto (F10). Sin ella se usa la sombra larga */
  sombra?: string
  /** copia de otro objeto (por ejemplo `hongos_p` con su sombra): lo que se decide por nombre se busca con `base ?? id` */
  base?: string
  luz?: LuzObjeto
  /** línea donde el agua golpea abajo (cascada), relativa al apoyo [x0, y0, x1, y1] */
  espuma?: [number, number, number, number]
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
  /** F8: mundo1 el Bosque, mundo2 la Catedral. El `mundo` de siempre no lo trae (es el Bosque). */
  id?: string
  /** F12: el portal de este mundo (`portal_verde`, `portal_violeta`...): el de llegada y el del jefe */
  portal?: string
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
  /** F10: el abismo detrás del piso (la Catedral, las Galerías): capas `fondo` con su paralaje, de la más lejana */
  fondo?: { objeto: string; paralaje: number }[]
  /** F10: la espuma de las orillas, un atlas de piezas de 32 con `cuadros` animados (cada cuadro, `filas` más abajo) */
  espuma?: { archivo: string; capa: string; columnas: number; cuadros: number; fps: number }
  /** F10: la capa del mapa que marca el agua quieta donde hay reflejo */
  reflejo?: { capa: string }
  /** F12: la Fragua, la tira del agua para la lava ya enfriada (después de la Dragona) */
  agua_apagada?: string
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
  fps?: number
  loop?: boolean
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

/** Íconos sueltos: nombre a ruta del PNG (iconos_cartel de 24 x 24, habilidades de 40 x 40) */
export type IconosSueltos = Record<string, string>

/** `fuentes`, `iconos_cartel` y `habilidades` conviven con las demás imágenes de ui, por eso el tipo de ui es abierto */
export interface UiManifest {
  fuentes: FuentesManifest
  iconos_cartel?: IconosSueltos
  habilidades?: IconosSueltos
  [nombre: string]: UiImagen | FuentesManifest | IconosSueltos | undefined
}

export interface IconoApp {
  archivo: string
  tam: number
  uso: 'any' | 'maskable'
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
  /** el Bosque (lo que lee un juego de antes de F8) */
  mundo: MundoManifest
  /** F8: todos los mundos en orden de bajada, el primero es el Bosque */
  mundos?: MundoManifest[]
  ui: UiManifest
  /** íconos de la app para la PWA (entrega 3a del taller) */
  app?: Record<string, IconoApp>
  audio: Record<string, string>
  creditos: string
  /** F11, parte 4: los paneles pintados del intro, la pared de fuego, el humo y el logo en llamas (ver kit/intro.ts) */
  intro?: Record<string, unknown>
  /** F13: las cinemáticas del final, en el formato del intro (ver logic/cine.ts) */
  cine_bajada?: Record<string, unknown>
  cine_fin?: Record<string, unknown>
}

/** Una capa de un panel del intro: una tira de cuadros del tamaño del panel, corrida con su paralaje */
export interface CapaIntro {
  nombre: string
  archivo: string
  cuadros: number
  fps: number
  paralaje: number
}

export interface PanelIntro {
  w: number
  h: number
  notas?: string
  capas: CapaIntro[]
}

/** Una hoja suelta del intro (fuego_pared, humo_grande, logo_fuego). `columnas` si viene en grilla */
export interface HojaIntro {
  archivo: string
  w: number
  h: number
  cuadros: number
  fps: number
  loop?: boolean
  columnas?: number
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
