import type { HojaIntro, Manifest, PanelIntro } from './tipos'

/**
 * Lo que el taller trae para el intro (manifest.intro): paneles en capas y hojas sueltas, mezclados con las notas y el
 * audio en el mismo objeto. Aquí se separan sin listas fijas: un panel es lo que trae `capas`, una hoja lo que trae
 * `archivo` y `cuadros`.
 */

export function panelesIntro(m: Manifest): Record<string, PanelIntro> {
  const out: Record<string, PanelIntro> = {}
  for (const [n, v] of Object.entries(m.intro ?? {})) {
    const p = v as Partial<PanelIntro> | null
    if (p && typeof p === 'object' && Array.isArray(p.capas) && typeof p.w === 'number' && typeof p.h === 'number') out[n] = p as PanelIntro
  }
  return out
}

export function hojasIntro(m: Manifest): Record<string, HojaIntro> {
  const out: Record<string, HojaIntro> = {}
  for (const [n, v] of Object.entries(m.intro ?? {})) {
    const h = v as Partial<HojaIntro> | null
    if (h && typeof h === 'object' && typeof h.archivo === 'string' && typeof h.cuadros === 'number' && typeof h.w === 'number') out[n] = h as HojaIntro
  }
  return out
}

/** El audio del intro: la música y el latido (llaves de manifest.audio) */
export function audioIntro(m: Manifest): { musica?: string; latido?: string } {
  const a = (m.intro?.audio ?? {}) as { musica?: unknown; latido?: unknown }
  return { musica: typeof a.musica === 'string' ? a.musica : undefined, latido: typeof a.latido === 'string' ? a.latido : undefined }
}

/** Qué panel va en cada momento del guion (GUION_INTRO) */
export const PANEL_DE_MOMENTO = {
  brasas: 'intro_bosque_noche',
  cueva: 'intro_corte_abismo',
  ojos: 'intro_ojos',
  guardianes: 'intro_guardianes',
  familia: 'intro_familia',
} as const

/** ¿Trae el kit los cinco paneles? Si falta uno, el intro sigue con las piezas prestadas */
export function introPintado(m: Manifest): boolean {
  const p = panelesIntro(m)
  return Object.values(PANEL_DE_MOMENTO).every((n) => !!p[n])
}

/** Escala entera que cubre la pantalla con el panel (sobra lo que haga falta para correrlo `margen` px por lado) */
export function escalaPanel(pw: number, ph: number, w: number, h: number, margen = 0): number {
  return Math.max(1, Math.ceil(Math.max((w + margen * 2) / pw, h / ph)))
}
