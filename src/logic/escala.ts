/**
 * Escala entera, la misma regla del visor del taller.
 * El navegador pinta en pixeles físicos (css x dpr). El arte se dibuja en una vista lógica y se agranda
 * un número ENTERO de veces, así cada pixel del arte es un cuadrado de `zoom` x `zoom` pixeles físicos.
 */
export interface Escala {
  dpr: number
  /** pixeles físicos de la ventana */
  Wp: number
  Hp: number
  /** aumento entero */
  zoom: number
  /** vista lógica en pixeles del arte (Wp / zoom, Hp / zoom, redondeados hacia arriba para cubrir todo) */
  ancho: number
  alto: number
  /** tamaño del canvas en pixeles CSS para que cada pixel lógico mida `zoom` pixeles físicos */
  cssZoom: number
}

/** Alto lógico mínimo que se busca (si la pantalla lo permite) */
export const ALTO_LOGICO_MIN = 400

export function calcularEscala(anchoCss: number, altoCss: number, dpr: number): Escala {
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  const Wp = Math.max(1, Math.round(anchoCss * d))
  const Hp = Math.max(1, Math.round(altoCss * d))
  const zoom = Math.max(1, Math.floor(Hp / ALTO_LOGICO_MIN))
  return {
    dpr: d,
    Wp,
    Hp,
    zoom,
    ancho: Math.ceil(Wp / zoom),
    alto: Math.ceil(Hp / zoom),
    cssZoom: zoom / d,
  }
}

/**
 * Alto mínimo del mundo en pixeles del arte. La cámara del mundo se acerca un número entero de veces mientras
 * lo que se ve siga midiendo esto o más: en una compu de 720 p el mundo se ve x2 (640 x 360, unos 20 x 11 cuadros),
 * casi el mismo encuadre que la tablet. El HUD no cambia: vive en su propia escena sin este zoom.
 */
export const ALTO_MUNDO_MIN = 340

/** Aumento entero de la cámara del mundo sobre la vista lógica */
export function zoomCamara(altoLogico: number): number {
  return Math.max(1, Math.floor(altoLogico / ALTO_MUNDO_MIN))
}
