import Phaser from 'phaser'

/**
 * Cuando un botón de la interfaz toma un toque, el mundo no debe caminar hacia ahí.
 * Las escenas no se avisan entre sí, así que el botón anota el id del dedo (y cuándo) aquí y Entrada lo revisa.
 */
const tomados = new Map<number, number>()
const instaladas = new WeakSet<Phaser.Scene>()

/** Un dedo anotado antes de esto respecto del toque que se revisa es de un toque viejo: no bloquea */
const MARGEN_MS = 250

export const Bloqueo = {
  tomar(id: number): void {
    tomados.set(id, performance.now())
  },
  /** `desde`: cuándo bajó el dedo que se revisa. Lo anotado mucho antes es de otro toque y se descarta. */
  tomado(id: number, desde?: number): boolean {
    const t = tomados.get(id)
    if (t === undefined) return false
    if (desde !== undefined && t < desde - MARGEN_MS) {
      tomados.delete(id)
      return false
    }
    return true
  },
  /** se suelta un instante después, para que Entrada alcance a revisarlo al levantar el dedo */
  soltarDiferido(id: number): void {
    const t = tomados.get(id)
    setTimeout(() => {
      if (tomados.get(id) === t) tomados.delete(id)
    }, 30)
  },
  /**
   * Engancha el soltar a la escena. Phaser borra los oyentes del input al apagar la escena, así que al apagarse
   * se olvida y la próxima vez que arranque se vuelve a enganchar (si no, el dedo quedaba tomado para siempre).
   */
  instalar(escena: Phaser.Scene): void {
    if (instaladas.has(escena)) return
    instaladas.add(escena)
    escena.input.on('pointerup', (p: Phaser.Input.Pointer) => Bloqueo.soltarDiferido(p.id))
    escena.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => Bloqueo.soltarDiferido(p.id))
    escena.events.once(Phaser.Scenes.Events.SHUTDOWN, () => instaladas.delete(escena))
    escena.events.once(Phaser.Scenes.Events.DESTROY, () => instaladas.delete(escena))
  },
}
