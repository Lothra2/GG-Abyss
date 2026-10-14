/**
 * F13: las cinemáticas del final (la bajada al infierno y el cierre), sin Phaser. El taller trae en el manifest un
 * objeto por cinemática (`cine_bajada`, `cine_fin`) con sus paneles en capas (el formato del intro), hojas sueltas,
 * `audio` y un `guion` opcional con la duración y el subtítulo de cada panel. Aquí se arma la línea de tiempo.
 */

export interface PanelCine {
  nombre: string
  w: number
  h: number
  capas: { nombre: string; archivo: string; cuadros: number; fps: number; paralaje: number }[]
}

export interface PlanoCine {
  panel: string
  desde: number
  dura: number
  texto: string
  /** el último (el título): se queda quieto y se oye el golpe */
  titulo: boolean
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

/** El guion del taller: por panel, la duración y el subtítulo (todo opcional) */
function guionDe(c: Record<string, unknown> | undefined): Record<string, { dura?: number; texto?: string }> {
  const g = (c?.guion ?? {}) as unknown
  const out: Record<string, { dura?: number; texto?: string }> = {}
  if (Array.isArray(g)) {
    for (const x of g as { panel?: string; dura?: number; duracion?: number; texto?: string; subtitulo?: string }[]) if (x && typeof x.panel === 'string') out[x.panel] = { dura: x.dura ?? x.duracion, texto: x.texto ?? x.subtitulo }
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
    const dura = g[p.nombre]?.dura ?? (titulo ? CINE.tituloS : CINE.duraS)
    const plano = { panel: p.nombre, desde: t, dura, texto: g[p.nombre]?.texto ?? textos[p.nombre] ?? '', titulo }
    t += dura
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
