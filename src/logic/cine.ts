/**
 * F13: las cinemáticas del final (la bajada al infierno y el cierre), sin Phaser. El taller trae en el manifest un
 * objeto por cinemática (`cine_bajada`, `cine_fin`) con sus paneles en capas (el formato del intro), hojas sueltas,
 * `audio` y un `guion` opcional con la duración y el subtítulo de cada panel. Aquí se arma la línea de tiempo.
 */

export interface PanelCine {
  nombre: string
  w: number
  h: number
  capas: { nombre: string; archivo: string; cuadros: number; fps: number; paralaje: number; bucle?: boolean; por_heroina?: Record<string, string> }[]
}

export interface PlanoCine {
  panel: string
  desde: number
  dura: number
  texto: string
  /** el último (el título): se queda quieto y se oye el golpe */
  titulo: boolean
  /** los sonidos del taller en este plano, en segundos desde el principio de la cinemática */
  sonidos: { nombre: string; en: number }[]
}

export const CINE = {
  /** cuánto dura cada panel si el guion no dice */
  duraS: 5.5,
  /** el título se queda un poco más */
  tituloS: 4,
  /** letras por segundo del subtítulo */
  letrasPorS: 26,
  /** el fundido entre paneles */
  fundidoS: 0.7,
}

/** Los paneles de una cinemática, en el orden en que vienen (lo que trae `capas`) */
export function panelesCine(c: Record<string, unknown> | undefined): PanelCine[] {
  const out: PanelCine[] = []
  for (const [nombre, v] of Object.entries(c ?? {})) {
    const p = v as Partial<PanelCine> | null
    if (p && typeof p === 'object' && Array.isArray(p.capas) && typeof p.w === 'number' && typeof p.h === 'number') out.push({ nombre, w: p.w, h: p.h, capas: p.capas as PanelCine['capas'] })
  }
  return out
}

type Sonido = { nombre: string; en: number }
type EntradaGuion = { dura?: number; desde?: number; texto?: string; sonidos?: Sonido[] }

/**
 * El guion del taller: por panel, cuándo va en la música (`desde` y `hasta` en segundos) o cuánto dura, su subtítulo y
 * sus sonidos (todo opcional)
 */
function guionDe(c: Record<string, unknown> | undefined): Record<string, EntradaGuion> {
  const g = (c?.guion ?? {}) as unknown
  const out: Record<string, EntradaGuion> = {}
  if (Array.isArray(g)) {
    for (const x of g as { panel?: string; dura?: number; duracion?: number; desde?: number; hasta?: number; texto?: string; subtitulo?: string; sonido?: Sonido[] }[]) {
      if (!x || typeof x.panel !== 'string') continue
      const dura = x.dura ?? x.duracion ?? (typeof x.desde === 'number' && typeof x.hasta === 'number' ? x.hasta - x.desde : undefined)
      out[x.panel] = { dura, desde: x.desde, texto: x.texto ?? x.subtitulo, sonidos: Array.isArray(x.sonido) ? x.sonido.filter((q) => q && typeof q.nombre === 'string' && typeof q.en === 'number') : undefined }
    }
  } else if (g && typeof g === 'object') {
    for (const [k, v] of Object.entries(g as Record<string, { dura?: number; duracion?: number; texto?: string; subtitulo?: string } | string>)) out[k] = typeof v === 'string' ? { texto: v } : { dura: v.dura ?? v.duracion, texto: v.texto ?? v.subtitulo }
  }
  return out
}

/** La línea de tiempo: un plano por panel, uno detrás del otro. El último es el título */
export function planosCine(c: Record<string, unknown> | undefined, textos: Record<string, string> = {}): PlanoCine[] {
  const ps = panelesCine(c)
  const g = guionDe(c)
  let t = 0
  return ps.map((p, i) => {
    const titulo = i === ps.length - 1 && /titulo/.test(p.nombre)
    const e = g[p.nombre]
    // si el guion dice en qué segundo de la música va, se respeta (así el golpe del título cae con la música)
    const desde = typeof e?.desde === 'number' ? e.desde : t
    const dura = e?.dura ?? (titulo ? CINE.tituloS : CINE.duraS)
    const plano: PlanoCine = { panel: p.nombre, desde, dura, texto: e?.texto ?? textos[p.nombre] ?? '', titulo, sonidos: e?.sonidos ?? [] }
    t = desde + dura
    return plano
  })
}

export function duracionCine(planos: readonly PlanoCine[]): number {
  return planos.reduce((s, p) => Math.max(s, p.desde + p.dura), 0)
}

/** Qué plano va en el tiempo `t` (y cuánto de él va, de 0 a 1), o null si ya terminó */
export function planoEn(planos: readonly PlanoCine[], t: number): { i: number; k: number } | null {
  for (let i = 0; i < planos.length; i++) {
    const p = planos[i]!
    if (t >= p.desde && t < p.desde + p.dura) return { i, k: (t - p.desde) / p.dura }
  }
  return null
}

/** Los nombres de todos los sonidos del guion (para cargarlos) */
export function sonidosCine(c: Record<string, unknown> | undefined): string[] {
  return [...new Set(planosCine(c).flatMap((p) => p.sonidos.map((q) => q.nombre)))]
}

/** Las hojas sueltas: el logo (sobre el título) y lo que cruza delante (la nieve, el humo) */
export function hojasCine(c: Record<string, unknown> | undefined): { logo: string | null; cruza: string[] } {
  const hojas = Object.entries(c ?? {}).filter(([, v]) => {
    const h = v as { archivo?: unknown; cuadros?: unknown; capas?: unknown } | null
    return !!h && typeof h === 'object' && typeof h.archivo === 'string' && typeof h.cuadros === 'number' && !Array.isArray(h.capas)
  }).map(([n]) => n)
  return { logo: hojas.find((n) => /^logo/.test(n)) ?? null, cruza: hojas.filter((n) => !/^logo/.test(n)) }
}

/** Cuántas letras del subtítulo se ven a los `s` segundos del plano */
export function letrasCine(texto: string, s: number): number {
  return Math.max(0, Math.min(texto.length, Math.floor((s - 0.4) * CINE.letrasPorS)))
}

/** Los subtítulos de siempre si el taller no trae guion */
export const TEXTOS_CINE: Record<string, Record<string, string>> = {
  cine_bajada: {
    bajada_puerta: 'La Puerta Negra se abrió.',
    bajada_escalera: 'Abajo, más abajo que todo.',
    bajada_lago: 'Donde el abismo se congeló.',
    bajada_ladrona: 'La última llama tenía dueño.',
    bajada_diablo: 'Y él despertó.',
  },
  cine_fin: {
    fin_cae: 'Se apagó.',
    fin_llama: 'La última llama volvió a casa.',
    fin_pisos: 'Y la luz subió por todo el abismo.',
    fin_amanecer: 'Amaneció.',
    fin_alas: 'La Primera Luz te dio sus alas.',
  },
}
