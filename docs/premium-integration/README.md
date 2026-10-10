# Pixel Forja Premium — integración piloto de Rick

Rama: `codex/pixel-forja-premium-integration`. Submódulo Pixel Forja: `e0a5581` (el kit de 48 px se generó en `0d54491`; los commits siguientes ajustan el ataque de 32 px, el estudio, la documentación y el JSON genérico, sin cambiar los PNG de 48 px ni el manifest del kit).

El kit se generó desde ese submódulo en una carpeta temporal, con `npm exec -- tsx tools/pixel_forja/scripts/game-kit.ts out/premium-kit --fichas fichas`. La carpeta `fichas/` solo tenía `.gitkeep`. Se compararon los 635 archivos con el kit previo: mismo conjunto de rutas; los cambios de contenido relevantes fueron `manifest.json` y siete PNG de Rick. Se copiaron esos archivos desde la generación, sin editar PNG ni manifest a mano. El verificador inspeccionó 633 rutas y 516 hojas sin errores.

El lector acepta `perfil_movimiento`, `eventos` y `locomocion` como campos opcionales. Rick usa los contactos de pie y la distancia real recorrida para avanzar el ciclo, incluido el giro. Un bloqueo que impide avanzar no genera pasos de desplazamiento. Las acciones escalan la reproducción a la duración del reloj existente; el evento de impacto del kit sustituye la fracción anterior cuando está presente. Los demás personajes conservan el comportamiento de su kit clásico.

Verificaciones: `npm ci`, `npm run typecheck`, `npm test` (255), `npm run build`, `npm run verificar-kit`, `npx playwright test e2e/premium.spec.ts --project=escritorio` (movimiento/giro y pausa/cancelación) y la prueba de Rick en `e2e/combate.spec.ts`. El segundo caso cruza la fase de impacto una vez, comprueba que una pausa real no despacha el golpe y que cancelar una acción retira el golpe pendiente. La captura de Chrome `rick-game.png` muestra el piloto cargado en el mundo. No equivale a validación en tablet física.

Pendiente de aceptación visual: la distancia de 96 u/ciclo al caminar y 91,43 u/ciclo al correr conserva la cadencia anterior, pero la zancada dibujada es corta y sigue deslizándose. También faltan pruebas de pared, control táctil, equipo que cambia velocidad y transición de todas las habilidades. Esta rama no está fusionada ni publicada en producción.
