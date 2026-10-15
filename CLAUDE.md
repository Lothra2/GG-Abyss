# GG Abyss

Juego tipo Diablo de la familia GG (Sophie 8, Alana 5). Cada jefe abre un portal que baja un piso más hacia el abismo. Phaser 3 + TypeScript + Vite. Tablet y compu. Cada niña juega su propia partida.

## El taller: PixelForja
- Todo el arte y el audio sale de PixelForja (tools/pixel_forja, submódulo). El juego lo carga desde public/assets/kit/manifest.json.
- Nunca dibujar sprites en código, bajar assets ni editar public/assets/kit a mano. Solo se permiten texturas técnicas: degradados de luz, ruido y un pixel para partículas.
- Lo que falte va a ASSETS_PENDIENTES.md con especificación exacta (nombre, tamaño, animaciones, apoyo, sólido, para qué).
- Regenerar: `git submodule update --remote tools/pixel_forja && npm run kit`.
- El taller trabaja en su propia rama de `pixel_forja` (hoy `claude/abyss-final`, que une `claude/abyss-mundo7` y `claude/abyss-celestial`, las dos salen de `claude/abyss-mundo6`, y así hacia atrás hasta `claude/perfeccionar-ejecucion-smh3ad`). Nunca `main` ni las ramas `claude/olimpico-*`: son de otro proyecto de Rick.
- Personajes editados en el estudio: exportar la ficha a fichas/<id>.ficha.json y correr `npm run kit`.

## Reglas del juego
- Nadie pierde: al caer, Thor rescata a la heroína en la última fogata y no se pierde nada. En modo peque el jefe no se cura. En modo normal vuelve a la vida con la que empezó su fase (F13, decisión de Rick: "sigue muy fácil"). La arena de cada jefe se abre al vencer al minijefe del piso, el élite más cerca de ella.
- Sin IA y sin red. La partida vive en localStorage (ggabyss:v1:perfil:<id>).
- Para Alana todo con ícono y sonido. Textos en español.
- El mundo tiene que verse increíble: dirección de arte en PLAN.md, postales en docs/capturas/.
- El descenso (pisos 4 a 7): PLAN.md F12 manda. Cada piso más terrorífico que el anterior hasta el Diablo (terror de cuento, sin sangre ni sustos de golpe), con una mecánica de luz nueva, sombras con sentido e inmersión completa, sin perder nada de lo ya hecho.
- El final (Mundo 7, el Diablo, cinemáticas, heroína celestial, Ciclo 2): PLAN.md F13 manda. Decisión de Rick: el Mundo 7 es lo más oscuro del juego para todos, con demonios que dan miedo de verdad. Sin sustos de golpe. Sin sangre en todo el juego, salvo las alas del Diablo (pedido de Sophie, decisión de Rick): espinas y sangre oscura que gotea, nada más.
- Créditos LPC visibles en el juego. Los repos gg-abyss y pixel_forja son públicos (Netlify clona el submódulo sin llaves). Ninguna foto de la familia entra a ningún repo: las fotos van solo en `private/`, que git ignora.

## Código
- src/logic/: reglas puras sin Phaser, todo con tests.
- src/kit/: tipos y cargador del manifest. Lo que esté en el manifest se carga solo.
- src/scenes/, src/game/: Phaser. src/fx/: atmósfera con interruptor de calidad. El look premium (PLAN.md F14: gradación, rayos, niebla baja, brillo, tramado) vive en `PREMIUM` de config/juego.ts por mundo y el taller lo afina por zona con `grado` y `rayos`.
- Balance en un solo archivo de config.
- Pixeles perfectos: zoom = max(1, floor(Hp / 320)) con Hp en pixeles físicos (en un teléfono acostado, menos de 500 px CSS de alto, floor(Hp / 300): así ve lo mismo que la tablet), y baja uno mientras el inventario no quepa ni entero (426 de alto) ni partido (582 de ancho): por eso el iPad sigue en 590 x 410. Vista lógica = Wp/zoom x Hp/zoom (PLAN.md 3.2). La cámara del mundo tiene además su zoom entero `zoomCamara` (lo que se ve del mundo mide 320 px de alto o más, 300 en el teléfono), y en la entrada, el enojo y la muerte del jefe corta a un primer plano con un zoom entero más. El HUD va en su escena sin ese zoom. Textos e íconos x1 o x2 según `pantallaChica` (alto lógico), nunca según el zoom. Nada de 960x540 fijo ni Scale.FIT. El HUD se ancla a los bordes.
- Tests del mapa y del kit sin cantidades fijas: se lee del mapa y se exige "al menos". El taller agrega postales, zonas y cofres.

## Comandos
- npm run dev | build | typecheck | test | e2e | kit
- ?test=1 expone window.__ABYSS__ para Playwright. ?seed=N fija el azar.

## Cómo trabajar
- Una fase de PLAN.md a la vez. Commit por tarea, push al final con todo en verde.
- Nunca decir que algo está probado si no se corrió.
- Publicar: Netlify (gg-abyss.netlify.app) publica solo la rama `main`. Se trabaja en la rama de la sesión y, con todo en verde, se sube también a main (`git push origin HEAD:main`, sin reescribir historia). Después correr `npm run verificar-publicacion`: nunca decir "publicado" si no dio OK (compara el commit con /version.json del sitio en vivo). Si un deploy falla, a Rick le llega un correo de Netlify.
- Escribir en español venezolano casual: sin em dash, sin punto y coma, pocos paréntesis. Directo.
