import type Phaser from 'phaser'

/**
 * El juego nunca se congela. Phaser pide el cuadro siguiente después de dibujar el actual: si algo truena en medio,
 * no lo pide más y todo queda quieto (la pantalla y los botones). Aquí el cuadro que falla se avisa en la consola
 * (las pruebas lo ven como error) y el siguiente llega igual. El aviso sale una vez cada tanto para no llenar la consola.
 */
export function instalarAguante(game: Phaser.Game, avisoCadaMs = 3000): void {
  const paso = game.step.bind(game)
  let ultimoAviso = -Infinity
  let fallos = 0
  game.step = (time: number, delta: number) => {
    try {
      paso(time, delta)
    } catch (e) {
      fallos++
      if (time - ultimoAviso >= avisoCadaMs) {
        ultimoAviso = time
        console.error(`Un cuadro falló y el juego siguió (${fallos} en total):`, e)
      }
    }
  }
}
