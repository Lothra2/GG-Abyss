import type Phaser from 'phaser'
import type { Manifest } from './tipos'
import { K } from './claves'

/** Crea las animaciones de Phaser de un personaje: una por animación y dirección (fila de la hoja). */
export function crearAnimsPersonaje(e: Phaser.Scene, m: Manifest, id: string): void {
  const p = m.personajes[id]
  if (!p) return
  for (const [nombre, a] of Object.entries(p.anims)) {
    const tex = K.pers(id, nombre)
    if (!e.textures.exists(tex)) continue
    m.direcciones.forEach((dir, fila) => {
      const key = K.anim(id, nombre, dir)
      if (e.anims.exists(key)) return
      e.anims.create({
        key,
        frames: e.anims.generateFrameNumbers(tex, { start: fila * a.cuadros, end: fila * a.cuadros + a.cuadros - 1 }),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      })
    })
  }
}

/** Animación de un fx (una sola fila de cuadros) */
export function crearAnimFx(e: Phaser.Scene, m: Manifest, nombre: string): string | null {
  const f = m.fx[nombre]
  const tex = K.fx(nombre)
  if (!f || !e.textures.exists(tex)) return null
  const key = K.animFx(nombre)
  if (!e.anims.exists(key)) {
    e.anims.create({ key, frames: e.anims.generateFrameNumbers(tex, { start: 0, end: f.cuadros - 1 }), frameRate: f.fps, repeat: f.loop ? -1 : 0 })
  }
  return key
}
