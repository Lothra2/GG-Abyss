import Phaser from 'phaser'

export type Fuente = 'fuente_ui' | 'fuente_titulo' | 'fuente_titulo_plata'

/** Texto con las fuentes bitmap del kit. La escala siempre es entera: nunca 1.5. */
export function texto(
  e: Phaser.Scene,
  x: number,
  y: number,
  contenido: string,
  fuente: Fuente = 'fuente_ui',
  escala = 1,
  opciones: { origen?: [number, number]; tinte?: number; alinear?: 'izq' | 'centro' | 'der'; ancho?: number; profundidad?: number } = {},
): Phaser.GameObjects.BitmapText {
  const t = e.add.bitmapText(x, y, fuente, contenido)
  t.setScale(Math.max(1, Math.round(escala)))
  const [ox, oy] = opciones.origen ?? [0, 0]
  t.setOrigin(ox, oy)
  if (opciones.tinte !== undefined) t.setTint(opciones.tinte)
  if (opciones.alinear === 'centro') t.setCenterAlign()
  else if (opciones.alinear === 'der') t.setRightAlign()
  if (opciones.ancho) t.setMaxWidth(opciones.ancho / Math.max(1, Math.round(escala)))
  if (opciones.profundidad !== undefined) t.setDepth(opciones.profundidad)
  return t
}

/** Ancho en pixeles lógicos que ocupa un texto ya creado */
export function anchoTexto(t: Phaser.GameObjects.BitmapText): number {
  return t.getTextBounds().global.width
}

/** Escala entera máxima (1 a `max`) para que un texto de `anchoBase` px entre en `disponible` px */
export function escalaQueEntra(anchoBase: number, disponible: number, max = 3): number {
  for (let s = max; s > 1; s--) if (anchoBase * s <= disponible) return s
  return 1
}

export function hexANumero(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}
