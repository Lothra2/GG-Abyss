import type Phaser from 'phaser'

/**
 * Cuando un botón de la interfaz toma un toque, el mundo no debe caminar hacia ahí.
 * Las escenas no se avisan entre sí, así que el botón anota el id del dedo aquí y Entrada lo revisa.
 */
const tomados = new Set<number>()
const instaladas = new WeakSet<Phaser.Scene>()

export const Bloqueo = {
  tomar(id: number): void {
    tomados.add(id)
  },
  tomado(id: number): boolean {
    return tomados.has(id)
  },
  /** se suelta un instante después, para que Entrada alcance a revisarlo al levantar el dedo */
  soltarDiferido(id: number): void {
    setTimeout(() => tomados.delete(id), 30)
  },
  /** engancha el soltar a la escena (una vez) */
  instalar(escena: Phaser.Scene): void {
    if (instaladas.has(escena)) return
    instaladas.add(escena)
    escena.input.on('pointerup', (p: Phaser.Input.Pointer) => Bloqueo.soltarDiferido(p.id))
    escena.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => Bloqueo.soltarDiferido(p.id))
  },
}
