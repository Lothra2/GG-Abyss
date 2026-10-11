# GG Abyss

Juego tipo Diablo de la familia GG (Sophie 8, Alana 5). Cada jefe abre un portal que baja un piso más hacia el abismo. Phaser 3 + TypeScript + Vite. Tablet y compu. Cada niña juega su propia partida.

## El taller: PixelForja
- Todo el arte y el audio sale de PixelForja (tools/pixel_forja, submódulo). El juego lo carga desde public/assets/kit/manifest.json.
- Nunca dibujar sprites en código, bajar assets ni editar public/assets/kit a mano. Solo se permiten texturas técnicas: degradados de luz, ruido y un pixel para partículas.
- Lo que falte va a ASSETS_PENDIENTES.md con especificación exacta (nombre, tamaño, animaciones, apoyo, sólido, para qué).
- Regenerar: `git submodule update --remote tools/pixel_forja && npm run kit`.
- Personajes editados en el estudio: exportar la ficha a fichas/<id>.ficha.json y correr `npm run kit`.

## Reglas del juego
- Nadie pierde: al caer, Thor rescata a la heroína en la última fogata y no se pierde nada. El jefe no se cura.
- Sin IA y sin red. La partida vive en localStorage (ggabyss:v1:perfil:<id>).
- Para Alana todo con ícono y sonido. Textos en español.
- El mundo tiene que verse increíble: dirección de arte en PLAN.md, postales en docs/capturas/.
- Créditos LPC visibles en el juego. Los repos gg-abyss y pixel_forja son públicos (Netlify clona el submódulo sin llaves). Ninguna foto de la familia entra a ningún repo: las fotos van solo en `private/`, que git ignora.

## Código
- src/logic/: reglas puras sin Phaser, todo con tests.
- src/kit/: tipos y cargador del manifest. Lo que esté en el manifest se carga solo.
- src/scenes/, src/game/: Phaser. src/fx/: atmósfera con interruptor de calidad.
- Balance en un solo archivo de config.
- Pixeles perfectos: zoom = max(1, floor(Hp / 400)) con Hp en pixeles físicos, cámara con zoom entero, vista lógica = Wp/zoom x Hp/zoom (PLAN.md 3.2). Nada de 960x540 fijo ni Scale.FIT. El HUD se ancla a los bordes.
- Tests del mapa y del kit sin cantidades fijas: se lee del mapa y se exige "al menos". El taller agrega postales, zonas y cofres.

## Comandos
- npm run dev | build | typecheck | test | e2e | kit
- ?test=1 expone window.__ABYSS__ para Playwright. ?seed=N fija el azar.

## Cómo trabajar
- Una fase de PLAN.md a la vez. Commit por tarea, push al final con todo en verde.
- Nunca decir que algo está probado si no se corrió.
- Escribir en español venezolano casual: sin em dash, sin punto y coma, pocos paréntesis. Directo.
