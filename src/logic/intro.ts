/**
 * El intro al estilo Diablo (pedido de Rick): fuego, la cueva del abismo, dos ojos rojos, los guardianes que caen y la
 * familia que baja igual. Corto, sin sustos y sin texto que haga falta leer: cada momento tiene su sonido y su imagen.
 * Sale una vez por aparato, después del primer toque del título (así el sonido ya está desbloqueado en la tablet).
 */

export type Momento = 'brasas' | 'cueva' | 'ojos' | 'guardianes' | 'familia' | 'titulo'

export interface Beat {
  momento: Momento
  /** corte seco con negro al entrar (si no, el plano se suma al anterior) */
  corte: boolean
  /** desde y hasta (s) */
  t0: number
  t1: number
  texto: string
  /** el sonido que lo acompaña (llave de audio del kit) y su tono */
  sonido: string
  rate: number
}

export const GUION_INTRO: readonly Beat[] = [
  { momento: 'brasas', corte: false, t0: 0, t1: 4, texto: 'Hace mucho, debajo del Bosque GG...', sonido: 'ambiente_magia', rate: 0.7 },
  { momento: 'cueva', corte: false, t0: 4, t1: 9, texto: '...algo empezó a apagar la luz.', sonido: 'portal', rate: 0.6 },
  { momento: 'ojos', corte: true, t0: 9, t1: 13, texto: 'El Abismo despertó.', sonido: 'jefe_rugido', rate: 0.7 },
  { momento: 'guardianes', corte: true, t0: 13, t1: 18, texto: 'Sus guardianes cayeron en la oscuridad.', sonido: 'jefe_pisoton', rate: 0.8 },
  { momento: 'familia', corte: true, t0: 18, t1: 23, texto: 'Pero la familia GG no tiene miedo.', sonido: 'ladrido', rate: 1 },
  { momento: 'titulo', corte: false, t0: 23, t1: 27, texto: 'Siete pisos hasta el fondo', sonido: 'legendario', rate: 0.9 },
]

export const DURACION_INTRO = GUION_INTRO[GUION_INTRO.length - 1]!.t1

/** El momento que corre a los `t` segundos (el último se queda hasta el final) */
export function beatEn(t: number, guion: readonly Beat[] = GUION_INTRO): Beat {
  for (const b of guion) if (t < b.t1) return b
  return guion[guion.length - 1]!
}

/** De 0 a 1, cuánto lleva el momento (para entrar y salir suave) */
export function avanceBeat(t: number, b: Beat): number {
  return Math.max(0, Math.min(1, (t - b.t0) / (b.t1 - b.t0)))
}

/** Transparencia del texto de un momento: entra en 0.6 s, se queda y sale en 0.6 s */
export function alfaTexto(t: number, b: Beat): number {
  const entra = Math.min(1, (t - b.t0) / 0.6)
  const sale = Math.min(1, (b.t1 - t) / 0.6)
  return Math.max(0, Math.min(entra, sale))
}

export const LLAVE_INTRO = 'ggabyss:v1:intro'

/** ¿Se muestra el intro? Una vez por aparato. En modo prueba solo si se pide con ?intro=1 */
export function mostrarIntro(yaVisto: boolean, test: boolean, forzar: boolean): boolean {
  if (forzar) return true
  if (test) return false
  return !yaVisto
}

/** Cuántas letras del texto se ven: se escribe de a poco, como un subtítulo de cine */
export function letrasVisibles(t: number, b: Beat, porSeg = 26, espera = 0.35): number {
  return Math.max(0, Math.min(b.texto.length, Math.floor((t - b.t0 - espera) * porSeg)))
}

/** Medio segundo de silencio justo antes del título: después el golpe pega más */
export const SILENCIO_ANTES_TITULO = 0.5

/** ¿Va en silencio la música? (el hueco antes del título) */
export function enSilencio(t: number, guion: readonly Beat[] = GUION_INTRO): boolean {
  const ti = guion.find((b) => b.momento === 'titulo')
  return !!ti && t >= ti.t0 - SILENCIO_ANTES_TITULO && t < ti.t0
}

/** Los latidos de los ojos: uno cada `cada` segundos desde que se abren */
export function latidosHasta(t: number, b: Beat, cada = 0.85): number {
  if (b.momento !== 'ojos' || t < b.t0 + 0.6) return 0
  return 1 + Math.floor((Math.min(t, b.t1) - b.t0 - 0.6) / cada)
}
