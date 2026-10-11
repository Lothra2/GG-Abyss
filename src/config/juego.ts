/** Constantes fijas del juego que no son balance: profundidades, calidad, colores, apodos. */

/** Carpeta del kit, relativa al index.html */
export const RUTA_KIT = 'assets/kit/'

export const NOMBRE_JUEGO = 'GG Abyss'
export const VERSION_KIT_ESPERADA = 1

/** Profundidades (PLAN.md 2.3). Los objetos y personajes usan OBJETOS + y. */
export const PROF = {
  /** el abismo que se ve donde no hay piso, detrás de todo */
  FONDO: -10,
  AGUA: 0,
  /** entre el agua y el suelo: el suelo tapa el reflejo donde no hay agua */
  REFLEJO: 0.5,
  SUELO: 1,
  SUELO_OBJ: 2,
  SOMBRAS: 3,
  OBJETOS: 10,
  NUBES: 5000,
  /** primer plano del taller (ramas, columnas), con paralaje */
  FRENTE: 5050,
  PARTICULAS: 5100,
  BRUMA_A: 6000,
  BRUMA_B: 6001,
  OSCURIDAD: 7000,
  BRILLO: 7100,
  BRILLA_EN_OSCURO: 7200,
  VINETA: 7300,
  HUD: 10000,
} as const

/** Apodos de las tarjetas. El resto usa el `nombre` del manifest. */
export const APODOS: Record<string, string> = {
  rick: 'Papá',
  steph: 'Mamá',
}

/** Cuadro del atlas `iconos` (32 px) con el arma de cada clase, para las tarjetas de jugadora */
export const ICONO_ARMA_CLASE: Record<string, string> = {
  amazona: 'bow_1',
  druida: 'wand_1',
  paladin: 'sword_1',
  hechicera: 'staff_1',
}

/** Orden fijo de las tarjetas. Las que no estén aquí (del estudio) salen después. */
export const ORDEN_HEROES = ['sophie', 'alana', 'rick', 'steph']

export type Calidad = 'alta' | 'baja'

export const CALIDAD = {
  alta: { particulas: 120, luces: 40, bruma: 2, nubes: true, postFx: true, decos: 450, sombrasLargas: true, reflejos: true },
  baja: { particulas: 50, luces: 20, bruma: 1, nubes: false, postFx: false, decos: 450, sombrasLargas: false, reflejos: false },
} as const

/** Si el promedio de fps de los primeros 10 s baja de esto, pasa sola a calidad baja */
export const FPS_MIN_CALIDAD = 45
export const FPS_VENTANA_S = 10

/** Colores fijos de la atmósfera (PLAN.md 2.2) */
export const COLOR = {
  OSCURIDAD: 0x030612,
  LUZ_DEFECTO: '#ffe2b0',
  FAROL: '#ffe2a8',
  /** el farol de la heroína: alumbra lo que tiene cerca (F10) */
  FAROL_RADIO: 118,
  FAROL_EXTRA_PEQUE: 32,
  FAROL_ALFA: 0.95,
  OJOS_HECHIZADO: '#ffd25a',
  OJOS_HECHIZADO_1: '#7affc8',
  FUEGO_FATUO: '#8af8ff',
  FUEGO_FATUO_VIOLETA: '#c8a0ff',
  BRASA: '#ff8a3a',
  DESCUBRISTE: 0xffd27a,
  BORDE_NEGRO: 0x070a12,
} as const

/** Rareza a color, el catálogo trae los mismos hex */
export const COLOR_RAREZA: Record<string, string> = {
  normal: '#e8e4dc',
  magic: '#6c8cff',
  rare: '#ffd84a',
  set: '#3fe07a',
  unique: '#c79a3c',
  legendary: '#ff8a1e',
}

/** Márgenes del HUD en pixeles lógicos, siempre anclado a los bordes de la vista */
export const HUD = {
  MARGEN: 6,
  ORBE: 72,
}

/**
 * Decorados: se activan los que tocan la pantalla más `entra` px, se sueltan al pasar `sale` px.
 * La grilla de búsqueda usa celdas de `celda` px. El tope de activos se prueba en e2e.
 */
export const DECOS = { celda: 128, entra: 48, sale: 96, topeActivos: 450 } as const

export const CLAVE_GUARDADO = 'ggabyss:v1:perfil:'
export const CLAVE_PERFILES = 'ggabyss:v1:perfiles'
export const CLAVE_ROTO = 'ggabyss:v1:roto:'

/**
 * Sombras largas (PLAN.md F10): la luz del kit viene de arriba a la izquierda, así que caen abajo a la derecha.
 * Adentro (la Catedral) la luz es de velas y vitrales: sombras más cortas y suaves.
 */
export const SOMBRA_LARGA = {
  afuera: { alfa: 0.4, largo: 0.5, angulo: -34, altoMin: 30 },
  adentro: { alfa: 0.26, largo: 0.32, angulo: -14, altoMin: 40 },
} as const

/** Reflejos en el agua quieta: el mismo cuadro dado vuelta, frío y transparente */
export const REFLEJO = { alfa: 0.32, tinte: 0x9cc4e8, cerca: 26 } as const
