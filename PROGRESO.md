# PROGRESO

Memoria de la sesión larga. Se actualiza al cerrar cada tarea.

## Estado

- Fase actual: F1a cerrada (typecheck, 91 tests, build y 43 e2e en verde), siguiente F1b (título, jugadoras, guardado)
- F1a hecha: grilla, A*, movimiento, zonas, descubrimiento; MundoVista, Decos (pool por celdas, viento, hechizados, copas, pasto), Heroina, ThorSprite (sigue el rastro), Criaturas, Camara, Entrada (toque, mantener, teclado), Sonido; fx: Luces (RenderTexture con pozos), Bruma, Nubes, Particulas, AtmosferaFX (postFX soft light y viñeta), Atmosfera; escenas Mundo y HUD; postales en docs/capturas/f1a y comparar.html
- F0 hecha: tooling (Vite, TS, Vitest, Playwright, Netlify), cargador del kit, mapa puro, azar, direccion, escala entera, config, Boot, SalaKit, verificar-kit, ganchos de prueba, 46 tests, 12 e2e (1 salta a propósito)

## Decisiones tomadas

- Escala: Phaser con Scale.NONE y el canvas a resolución LÓGICA (Wp/zoom x Hp/zoom), agrandado por CSS con `image-rendering: pixelated` en un múltiplo entero de pixeles físicos (cssZoom = zoom / dpr). Es la misma técnica del visor del taller, y da pixeles perfectos igual que una cámara con zoom, pero pinta 4 veces menos en el iPad. Cambio respecto a "Scale.RESIZE y cámara con zoom entero" del plan: el resultado visual es el mismo, la ventaja es el rendimiento. `src/game/Pantalla.ts` maneja resize, orientación y dpr.
- Render: WebGL funciona en Chromium headless con SwiftShader (flags en playwright.config.ts). El gancho `renderer()` lo confirma.
- Vite 8 usa Rolldown: manualChunks tiene que ser función.
- `tsc --noEmit` en vez de `tsc -b` (no hace falta proyecto compuesto).
- Los tests del kit y del mapa leen `public/assets/kit` con fs y piden "al menos" (postales >= 8, zonas >= 13, secretos >= 5, fogatas >= 3).
- `window.__JUEGO__` (solo con ?test=1) expone el Phaser.Game para inspeccionar escenas desde Playwright.
- El kit regenerado con `npm run kit` sale idéntico (verificado: sin diff).
- F1a, bruma: `niebla_jirones.png` NO repite hacia los lados (bordes distintos), se ve una costura cada 512 px. Se usa una copia espejada armada en código (`Bruma.ts`) y quedó en ASSETS_PENDIENTES.md (#27).
- F1a, música de la arena: la zona Arena del Minotauro pide `musica: jefe`, pero en el juego la música del jefe solo suena durante la pelea (F4). Entrar a la arena sigue con la música del bosque.
- F1a, el mantener presionado se mide con `performance.now()` (reloj real), no con el reloj de juego, para que no dependa de los fps.
- F1a, las pruebas con ganchos: `avanzar(seg, parar)` mueve el mundo en pasos de 1/60 (uno completo cada 3), `teleport`, `irAPostal`, etc. Chromium sin GPU dibuja lento (5 a 25 fps en 1280 x 720), por eso los gestos reales se esperan con poll.
- F1a, postales: la heroína se para en el punto libre más cercano a (postal + 36, +56) para no tapar lo que muestra la postal. Con `?postal=1` no se abre el HUD.
- Calidad automática por fps: desactivada con `?test=1`.

- Entrega del taller (5 tandas, submódulo en 8ba7f2a): adoptada en F1a. Decos usa tronco y copa por separado, pasto con sus anims, capa `superficie` para los pasos, 13 postales. Falta usar en sus fases: iconos de cartel (F1b), Abuelo que sonríe (F1b), títulos y logo (F1b), flecha y naturaleza (F2), botín bajo (F3), Thor cava (F3), minotauro 96 y carga (F4), íconos de app (F5). En balance se quitaron las escalas temporales del trol y del minotauro.

## Lo que falta

F0, F1a, F1b, F2, F3, F4, F5 (ver PLAN.md sección 5)

## Comandos para retomar

```bash
cd /home/user/GG-Abyss
git status -sb && git log --oneline | head
npm run typecheck && npm test && npm run build && npm run e2e
```

## Para que Rick revise

### F1a (Mundo vivo)
- `docs/capturas/comparar.html`: cada postal del kit al lado de la del juego y de la vista tablet. Ábrelo en el navegador.
- Capturas del juego a 960 x 540: `docs/capturas/f1a/<postal>.png` (llegada, abuelo_roble, cascada_y_vado, puente_del_trol, ruinas_y_estatua, anillo_de_hadas, arena_del_minotauro, colina_goblin).
- Capturas en la vista tablet (1180 x 820, dpr 2): `docs/capturas/f1a/<postal>_tablet.png`.
- Mi opinión honesta: el Anillo de las Hadas, la Arena y el Abuelo Roble se ven mejor que las postales del kit (luz, bruma, brillos). El Puente del Trol y Las Ruinas se ven más apagados que las del kit por la bruma (niebla 0.4 a 0.5): si te parecen lavadas, bajo el alfa de la bruma o su escala.
- Probar en el iPad y el Android: `npm run build && npm run preview`, abrir `http://<ip>:4173/?heroe=sophie` (o `alana`, `rick`, `steph`). Con `&test=1` aparece el medidor de fps arriba a la derecha. Tocar el piso camina, mantener presionado sigue al dedo. Lo que no pude medir: los fps reales en tablet.
- Sonidos: la sala del kit (`?kit=1`, pestaña Audio) para oír los 35 y anotar los que suenen feos en ASSETS_PENDIENTES.md, sección "Sonidos para revisar".

## Pasos solo de Rick

(vacío)
