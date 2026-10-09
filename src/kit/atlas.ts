import type Phaser from 'phaser'

/** Lo que dice el JSON del atlas del mundo (botin/mundo.json) de cada animación */
export interface AnimAtlas {
  frames: number
  fps: number
  loop: boolean
  w: number
  h: number
}

export interface DatosAtlas {
  anims: Record<string, AnimAtlas>
}

/**
 * Crea una animación de Phaser por cada entrada de `anims` del atlas (cofres, monedas, haces de luz...).
 * La clave es el mismo nombre del atlas, por ejemplo `cofre_madera_quieto`.
 */
export function crearAnimsAtlas(e: Phaser.Scene, atlasKey: string, datosKey: string): void {
  const datos = e.cache.json.get(datosKey) as DatosAtlas | undefined
  if (!datos?.anims) return
  for (const [nombre, a] of Object.entries(datos.anims)) {
    if (e.anims.exists(nombre)) continue
    e.anims.create({
      key: nombre,
      frames: e.anims.generateFrameNames(atlasKey, { prefix: `${nombre}_`, start: 0, end: a.frames - 1 }),
      frameRate: a.fps,
      repeat: a.loop ? -1 : 0,
    })
  }
}
