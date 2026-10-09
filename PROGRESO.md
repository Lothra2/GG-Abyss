# PROGRESO

Memoria de la sesión larga. Se actualiza al cerrar cada tarea.

## Estado

- Fase actual: F0 cerrada, siguiente F1a (Mundo vivo)
- F0 hecha: tooling (Vite, TS, Vitest, Playwright, Netlify), cargador del kit, mapa puro, azar, direccion, escala entera, config, Boot, SalaKit, verificar-kit, ganchos de prueba, 46 tests, 12 e2e (1 salta a propósito)

## Decisiones tomadas

- Escala: Phaser con Scale.NONE y el canvas a resolución LÓGICA (Wp/zoom x Hp/zoom), agrandado por CSS con `image-rendering: pixelated` en un múltiplo entero de pixeles físicos (cssZoom = zoom / dpr). Es la misma técnica del visor del taller, y da pixeles perfectos igual que una cámara con zoom, pero pinta 4 veces menos en el iPad. Cambio respecto a "Scale.RESIZE y cámara con zoom entero" del plan: el resultado visual es el mismo, la ventaja es el rendimiento. `src/game/Pantalla.ts` maneja resize, orientación y dpr.
- Render: WebGL funciona en Chromium headless con SwiftShader (flags en playwright.config.ts). El gancho `renderer()` lo confirma.
- Vite 8 usa Rolldown: manualChunks tiene que ser función.
- `tsc --noEmit` en vez de `tsc -b` (no hace falta proyecto compuesto).
- Los tests del kit y del mapa leen `public/assets/kit` con fs y piden "al menos" (postales >= 8, zonas >= 13, secretos >= 5, fogatas >= 3).
- `window.__JUEGO__` (solo con ?test=1) expone el Phaser.Game para inspeccionar escenas desde Playwright.
- El kit regenerado con `npm run kit` sale idéntico (verificado: sin diff).

## Lo que falta

F0, F1a, F1b, F2, F3, F4, F5 (ver PLAN.md sección 5)

## Comandos para retomar

```bash
cd /home/user/GG-Abyss
git status -sb && git log --oneline | head
npm run typecheck && npm test && npm run build && npm run e2e
```

## Para que Rick revise

(vacío)

## Pasos solo de Rick

(vacío)
