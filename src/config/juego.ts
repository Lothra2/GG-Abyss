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
/** Sombras largas de lo que no trae sombra horneada y de los personajes: la misma luz que las del taller */
export const SOMBRA_LARGA = {
  // afuera, el sol de las horneadas del taller (carpa del minero, pinos, robles): la punta cae 0.40 del alto a la
  // derecha y 0.16 abajo, oscura al pie y clarita en la punta. Acá un toque más marcadas: con la viñeta y la noche
  // las del taller se pierden en el pasto
  afuera: { alfa: 0.58, alfaPunta: 0.26, tramos: 5, kx: 0.44, ky: 0.2, altoMin: 24 },
  // adentro no hay sol: cada sombra cae lejos de la antorcha, el cristal o el farol que la alumbra (kx y ky son solo
  // el arranque). Debajo de la luz casi no sale, a 70 px ya es larga, y a oscuras no se ve
  adentro: {
    alfa: 0.5,
    alfaPunta: 0.14,
    tramos: 4,
    kx: 0.3,
    ky: 0.14,
    altoMin: 28,
    luces: { largo: 0.62, lejos: 70, aplaste: 0.55, kyMin: 0.07, ganancia: 1 },
  },
} as const

/** Reflejos en el agua quieta: el mismo cuadro dado vuelta, frío y transparente */
export const REFLEJO = { alfa: 0.32, tinte: 0x9cc4e8, cerca: 26 } as const

/** Colores del minimapa (un pixel por cuadro): suelo según la superficie (0 y 1 pasto, 2 tierra, 3 piedra, 4 madera, 5 agua) */
export const COLOR_MAPA = {
  suelo: [0x3d6140, 0x3d6140, 0x8a6a46, 0x7a7e88, 0x9a7444, 0x3a6a9a],
  agua: 0x3a6a9a,
  muro: 0x141c1a,
  borde: 0x2c3a34,
} as const

/** La selección de heroína: el color de la luz de cada clase y el elemento que estalla al elegirla */
export const SELECCION = {
  color: { amazona: 0x9ad8ff, druida: 0x6ee08a, paladin: 0xffd27a, hechicera: 0xc58aff } as Record<string, number>,
  nova: { amazona: 'nova_rayo', druida: 'nova_naturaleza', paladin: 'nova_sagrado', hechicera: 'nova_arcano' } as Record<string, string>,
  /** brasas que suben por tarjeta */
  brasas: 7,
  /** lo que se apagan las otras tarjetas al elegir una */
  apagadas: 0.28,
} as const

/** La luz que rodea a los portales (game/PortalFx.ts): el centro del remolino, las motas que se traga y el círculo del piso */
export const PORTAL_FX = {
  /** el centro del remolino a esta fracción del alto del dibujo del portal (desde arriba) */
  centroRelativo: 0.5,
  nucleo: [34, 56] as const,
  halo: 130,
  motas: 16,
  /** tamaño de cada mota */
  lado: 7,
  /** el óvalo por donde entran las motas */
  radio: [30, 44] as const,
  escalaCirculo: 2,
  /** desde esta distancia de la heroína se empieza a encender */
  radioCerca: 160,
} as const

/**
 * Lo que usa un solo mundo (logic/soloDeMundo.ts): fuera de él no se carga. El Mundo 7 trae su música por fase, sus
 * ambientes, los sonidos de sus demonios y los efectos del Diablo, de la Reina Escarcha y del Guardián de la Puerta.
 * Los proyectiles van por su base (el kit los trae en 8 direcciones).
 */
export const SOLO_EN_MUNDO = {
  mundo7: {
    audio: [
      'agua_helada', 'ambiente_bosque_hielo', 'ambiente_catacumbas', 'ambiente_ciudadela', 'ambiente_hielo', 'ambiente_lago', 'ambiente_puente', 'ambiente_puerta', 'ambiente_trono',
      'brasero_congela', 'brasero_hueso_prender', 'bruja_cura', 'bruja_muro', 'congelada', 'diablillo_fuego', 'diablillo_risa',
      'diablo_cae', 'diablo_nova', 'diablo_oscuridad', 'diablo_paso', 'diablo_pilares', 'diablo_rayo', 'diablo_ruge',
      'escudo_bloquea', 'espectro_rayo', 'frio_sube', 'guardian_carga', 'guardian_cruz', 'hielo_cruje', 'hielo_rompe', 'hoguera_prender',
      'jaula_huesos', 'jaula_rompe', 'lobo_aullido', 'lobo_mordida', 'luz_comida', 'luz_vuelve',
      'musica_diablo_1', 'musica_diablo_2', 'musica_diablo_3', 'musica_diablo_final', 'musica_guardian', 'musica_reina_escarcha',
      'reina_lanzas', 'reina_ventisca', 'ventisca_viene', 'viento_fuerte',
    ],
    fx: [
      'aviso_carga_diablo', 'aviso_cruz', 'aviso_lanza_hielo', 'aviso_nova', 'aviso_pilar', 'aviso_rayo', 'gota_sangre_diablo', 'impacto_rayo_hielo',
      'jaula_huesos_subir', 'jaula_huesos_quieta', 'jaula_huesos_romper', 'nova_fuego_diablo', 'pilar_fuego', 'rayo_rojo', 'proyectil_fuego_chico', 'proyectil_rayo_hielo',
    ],
  },
} as const
