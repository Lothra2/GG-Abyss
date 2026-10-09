import type Phaser from 'phaser'

/**
 * Audio en iOS (PLAN.md F5): el primer toque lo desbloquea (Phaser lo hace solo), y cuando la tablet vuelve de otra app o de la pantalla
 * apagada el contexto queda `suspended` o `interrupted`: se despierta al volver a ver la página y en el siguiente toque.
 */
export function instalarAudio(game: Phaser.Game): { estado: () => string; despertar: () => void } {
  const ctx = () => (game.sound as unknown as { context?: AudioContext }).context
  const despertar = () => {
    const c = ctx()
    if (!c || c.state === 'running' || c.state === 'closed') return
    void c.resume().catch(() => undefined)
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') despertar()
  })
  window.addEventListener('pageshow', despertar)
  window.addEventListener('focus', despertar)
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, despertar, { passive: true })
  return { estado: () => ctx()?.state ?? 'sin-audio', despertar }
}
