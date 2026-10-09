# PROGRESO

Memoria de la sesión larga. Se actualiza al cerrar cada tarea.

## Estado

- Fase actual: todas las fases del plan hechas (F0 a F5). Lo que falta es solo de Rick: publicar en Netlify y probar en las tablets de verdad (ver "Pasos solo de Rick").
- F1b hecha en código: Titulo (logo, Toca para empezar, botón Créditos), SeleccionJugador (tarjetas del manifest, aura y Thor), guardado con migración, Presentacion (paneo la primera vez), Entidades (cofres, carteles, fogatas, Abuelo), HUD (contadores, oro, pausa, panel de cartel), Pausa (Noche, Música, Efectos, calidad, modo peque, otra jugadora, créditos, seguir), Creditos (CREDITOS.txt con scroll)
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
- F1b, el título usa FondoAbismo (postal de la arena como fondo, luces desde los objetos del mapa, bruma y partículas) y la selección usa el mismo fondo más oscuro.
- F1b, entrar con `?heroe=<id>` ahora carga la partida guardada de ese perfil (antes empezaba siempre nueva). Con `?heroe=` no hay paneo salvo `?presentacion=1`.
- F1b, el botón `crearBoton` se hunde 1 px al presionarlo sin pisar la posición que le dé la escena (antes saltaba a la esquina y perdía el toque).
- F1b, la pausa deja el mundo en pausa con `scene.pause('Mundo')` y el sonido sigue vivo para oír los deslizadores. Los créditos se limpian de direcciones web para que quepan en pantalla.
- F2, los números y la IA van en src/logic (stats, combate, habilidades, ia, thorCombate, rescate) con tests. En Phaser: Enemigos (los 29 del mapa), Proyectiles (flecha, naturaleza, arcano y fuego del kit), Combate (ataque por toque, habilidades, pociones, XP, Thor, rescate), Numeros (ui/numeros.png) y HudCombate (orbes, XP, cinturón, botones con arco de recarga).
- F2, teclas: Q y E son las habilidades (no W como decía el plan porque W ya camina) y 1 a 4 las pociones del cinturón.
- F2, el golpe pesado del trol cae en una elipse de 48 px de radio (el plan decía 70): el aviso `aviso_jefe` del kit mide 96 px de ancho y escalarlo a 1.45 rompería los pixeles enteros. El número vive en `TROL_ELITE.golpePesadoRadio`.
- F2, los reemplazos de flecha y naturaleza ya no hacen falta: el taller entregó `proyectil_flecha` y `proyectil_naturaleza` con sus impactos y los 8 íconos de habilidad.
- F2, el oro de los enemigos entra directo a la bolsa con un número flotante. Los drops con haz y rebote llegan en F3.
- F2, el cinturón arranca con 2 pociones de vida y 1 de maná (`BOTIN.cinturonInicial`). Una poción no se gasta si la vida o el maná ya están llenos.
- F2, la lógica de las acciones (golpe, aviso, recarga) corre con el reloj del juego, no con el de las animaciones, así `avanzar()` es exacto en las pruebas.
- F3, el catálogo del kit se usa tal cual (`botin/catalogo.json`). Hombreras, pantalones, gemas, runas y amuletos tipo "charm" no tienen casillero en el layout del inventario, así que no se sortean en las tablas. Los mágicos `m_*` entran como el 25 % de los objetos normales cuando le tocan a su nivel y los raros `r_*` son la tabla de raros.
- F3, legendario del Claro Escondido por clase: Sophie `pluma_de_cuervo`, Alana `ramita_del_abuelo`, Rick `filo_del_alba`, Steph `rama_del_bosque_eterno` (el kit solo trae legendarios propios para Sophie y Alana).
- F3, el inventario va a escala entera (x1 en la tablet, x2 o x3 si sobra pantalla) y no usa cámara aparte: con la vista de 590 x 410 el panel de 280 x 410 entra justo. La bolsa de 28 casillas y el oro salen del `layout` del kit. El cinturón no está en esa imagen: se ve en el HUD.
- F3, el cofre del tutorial da `pet_armor_1` además del azar y Thor cambia de sprite al equiparla (`thor_armadura1` a 3 se cargan al entrar).
- F3, el oro de los enemigos y cofres cae como monedas `oro_<tamaño>`. Thor las recoge a 120 px de él, la heroína a 34 px.
- F3, Thor desentierra algo cada 60 a 90 s con 25 % de probabilidad, solo sin enemigos a 360 px.
- F4, el aviso del golpe fuerte usa `aviso_jefe` a x1 (radio 48) y el del pisotón y el salto a x2 (radio 96): el plan decía 70, 100 y 80, pero escalar con decimales rompía los pixeles. Los números viven en `JEFE`.
- F4, el minotauro usa su hoja de 96 px sin escalar (el taller ya la entregó): no hace falta el 1.5 de la nota del plan.
- F4, la salida de la arena se cierra con un anillo de cuadros bloqueados justo afuera del borde (el borde queda a 24 px de donde la heroína dispara la pelea). Si la heroína se aleja más de 60 px de la arena, la pelea se corta como si la hubieran rescatado.
- F5, la PWA: `public/manifest.webmanifest` (pantalla completa, horizontal, íconos de `manifest.app` del kit), `public/sw.js` como plantilla y `scripts/generar-sw.ts` que corre al final de `npm run build` y le pone la versión (hash de los archivos) y la lista de 628 archivos. El service worker guarda todo al instalar (cache primero) y sirve el index sin importar los parámetros. Solo se registra en la versión construida y no con `?test=1` (para que las pruebas no vean una versión vieja guardada): `?sw=1` lo fuerza, así lo prueba el e2e.
- F5, aviso de girar: es HTML con el ícono `ui/girar_tablet.png` del kit y sin texto (Alana no lee). Sale solo en aparatos táctiles en vertical (`(orientation: portrait) and (pointer: coarse)`) y el juego se duerme con `game.loop.sleep()` y el sonido se pausa.
- F5, audio: el contexto se despierta al volver a ver la página (`visibilitychange`, `pageshow`, `focus`) y en cada toque. Los bucles son de WebAudio, no se cortan.
- F5, pantalla completa: botón en la pausa (Android y PC). En iPad no existe la API y el botón dice "Instalar" y abre un panel con 3 pasos. Faltan los íconos de Safari: ASSETS_PENDIENTES.md #28.
- F5, el kit ya está guardado en el repo (`public/assets/kit`, 634 archivos), así que construir NO necesita el submódulo privado. Por eso el plan B de Netlify es mucho más simple de lo que decía el plan: un GitHub Action manual (`.github/workflows/netlify.yml`) sin llaves del submódulo.
- F1b, las pruebas e2e llegan a cofres, carteles y fogatas por la parada del objeto (`teleport` a la parada): la caminata larga ya la cubre F1a.

- Entrega del taller (5 tandas, submódulo en 8ba7f2a): adoptada en F1a. Decos usa tronco y copa por separado, pasto con sus anims, capa `superficie` para los pasos, 13 postales. Falta usar en sus fases: iconos de cartel (F1b), Abuelo que sonríe (F1b), títulos y logo (F1b), flecha y naturaleza (F2), botín bajo (F3), Thor cava (F3), minotauro 96 y carga (F4), íconos de app (F5). En balance se quitaron las escalas temporales del trol y del minotauro.

## Lo que falta

Nada del plan. Quedan cosas que solo pueden hacerse con las tablets en la mano: medir fps en el iPad y el Android, instalar la app, publicar en Netlify y la demo con las niñas. (ver PLAN.md sección 5)

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

### F1b (título, jugadoras, guardado)
- `docs/capturas/comparar.html`: arriba trae la sección "Pantallas del juego" con título, selección y pausa en escritorio y tablet. Las postales de `docs/capturas/f1b/` son las 13 del mapa con las entidades vivas.
- Para probar en la tablet: `npm run build && npm run preview`, abrir `http://<ip>:4173/` sin parámetros. Tocar el título, tocar tu tarjeta, tocar para saltar el paneo, caminar tocando el piso. El botón de pausa está arriba a la derecha.
- Cosas para mirar con las niñas: Sophie, "¿cuál zona te gustó más?". Alana, si encuentra sola el Anillo de las Hadas siguiendo las luces. Alana arranca con modo peque (Noche máximo 0.25, enemigos más suaves en F2).
- Para borrar un perfil: mantener 3 segundos el ícono de cerrar de su tarjeta. La partida borrada queda en una copia `ggabyss:v1:roto:<id>:borrada:<fecha>`.
- No pude medir fps reales en tablet. En Chromium con WebGL por software corre entre 5 y 25 fps, así que los números de rendimiento reales son tuyos.

### F2 (combate)
- `docs/capturas/f2/`: las 13 postales con enemigos vivos, `combate_amazona.png`, `combate_druida.png`, `combate_paladin.png` y `combate_hechicera.png` (cada clase usando su primera habilidad con la interfaz de combate puesta). `docs/capturas/comparar.html` las muestra junto con título, selección y pausa.
- Probar con las niñas: tocar una rata (el enemigo se pone rojizo suave y la heroína camina hasta su alcance y ataca sola). Los dos botones redondos abajo a la derecha son las habilidades, el arco oscuro es la recarga. Abajo al centro están el cinturón (tocar una poción la toma) y la barra de XP. Orbe rojo es la vida y azul el maná.
- En PC: Q y E son las habilidades (W ya camina), 1 a 4 son las pociones, clic para atacar.
- Para Alana (modo peque): ataca sola al enemigo que tenga cerca, los botones son más grandes, los enemigos pegan la mitad y avisan 1.8 s. Preguntar si entiende los dos botones sin explicación y si el aullido de Thor la hace reír.
- Thor: muerde cada 2 s lo que esté a menos de 160 px de la heroína y aúlla con un escudo si la vida baja de 30 %. Si la heroína cae, Thor aúlla, la pantalla se va a negro y reaparece en la última fogata con todo lleno ("¡Thor te salvó!"). No se pierde nada.
- Lo que no pude medir: cómo se siente el combate con el dedo en la tablet de verdad y los fps con 29 enemigos. Los lejanos (más de 900 px) ni piensan ni se dibujan.

### F3 (botín)
- `docs/capturas/f3/`: `botin_en_el_piso.png` (haces de luz de rareza, oro) e `inventario.png`, en escritorio y tablet (`_tablet`).
- Probar con las niñas: abrir el cofre del tutorial (cerca del inicio, al sur). Sale la armadura de Thor: se recoge pasando encima, se abre la mochila con el botón de arriba a la derecha (o I) y se toca la armadura. Thor cambia. Mantener presionado un objeto muestra el tooltip con el nombre en el color de su rareza y la comparación (+ verde, - rojo). Probar con rompibles (cajas, barriles, vasijas) y buscar los 5 cofres secretos.
- Para ver quién arma primero a Thor.
- Lo que no pude medir: el rendimiento con muchos objetos en el piso y la sensación del toque largo en la tablet de verdad.

### F4 (minotauro)
- La arena está al noreste del mapa (`arena_del_minotauro` en el comparador). Entrar caminando hasta el centro dispara la pelea. Probar con nivel 6 o más (Alana con nivel 4 en modo peque).
- Capturas en `docs/capturas/f4/`: `jefe_pelea.png` (con el aviso rojo en el piso), `victoria.png` (portal abierto, cofre, oro), `continuara.png`, y las 13 postales con la arena en pelea. Todas con su versión `_tablet`.
- Balance: `scripts/simular-jefe.ts` corre la máquina de estados real del jefe contra un modelo simple de la heroína (esquiva la mitad de los avisos, pega el 60 % del tiempo, Thor muerde). Con ese modelo todas las clases ganan casi siempre a nivel 6 sin pociones, la druida en modo peque gana a nivel 4, y el paladín pierde seguido a nivel 1 (59 % de victorias). Es un termómetro, no el juego: la prueba de verdad es verlas pelear.
- Para ganar rápido en una prueba: abrir `?test=1&heroe=rick` y en la consola `__ABYSS__.ponerNivel(10)`, `__ABYSS__.entrarArena()`, `__ABYSS__.danarJefe(9999)`.
- Los avisos grandes se ven en el piso: círculo que se llena (pisotón y salto), elipse delante (golpe fuerte) y línea roja (la carga). En modo peque duran 1.8 s.

## Pasos solo de Rick

### 1. Publicar en Netlify (la forma más corta, sin tocar el submódulo)

El juego ya trae el kit dentro del repo, así que Netlify no necesita clonar `pixel_forja`. Pero si conectas el repo a Netlify directo, Netlify igual intenta clonar el submódulo privado y falla. Dos caminos:

**Camino A (recomendado, 6 pasos, sin llaves SSH):**
1. En Netlify: Add new site, Deploy manually, arrastra cualquier carpeta vacía (solo para crear el sitio). Ponle un nombre.
2. En el sitio: Site configuration, Site information, copia el "Site ID".
3. En Netlify: tu foto, User settings, Applications, Personal access tokens, New access token. Cópialo.
4. En GitHub, repo `Lothra2/gg-abyss`: Settings, Secrets and variables, Actions, New repository secret. Crea `NETLIFY_AUTH_TOKEN` (el token) y `NETLIFY_SITE_ID` (el id).
5. Pestaña Actions, "Desplegar a Netlify", Run workflow (rama `claude/ecstatic-ramanujan-oq0r0o` o `main` cuando la mezcles). Tarda unos 3 minutos.
6. Abre la URL del sitio en la tablet. Para cada actualización repite el paso 5.

**Camino B (Netlify conectado al repo):** en Netlify, Add new site, Import from Git, elige `Lothra2/gg-abyss`. Cuando falle por el submódulo: Site configuration, Build and deploy, Deploy key, generar la llave y copiarla. En GitHub, repo `Lothra2/pixel_forja`, Settings, Deploy keys, Add deploy key, pega la llave (solo lectura). Reintenta el deploy. Si no funciona, usa el Camino A.

### 2. Instalar en la tablet
- **iPad:** abrir la URL en Safari, Compartir, Agregar a inicio, abrir desde el ícono. (El botón "Instalar" de la pausa lo explica.)
- **Android:** abrir en Chrome, menú de los tres puntos, Instalar app (o el aviso de abajo). Abre en horizontal y a pantalla completa.
- Probar sin red: abrir una vez con internet, esperar a que cargue el título, activar el modo avión y abrir la app desde el ícono.

### 3. Medir en los aparatos
- Abrir `https://<tu-sitio>/?test=1&heroe=sophie`: arriba a la derecha sale el medidor de fps en verde (55 o más), amarillo o rojo. Caminar por el Bosque Profundo y por la arena con el jefe, que es lo más pesado.
- Si un aparato no llega a 60 fps en calidad alta, ponerlo en calidad baja desde la pausa (queda guardado por jugadora). El juego también pasa solo a baja si el promedio de los primeros 10 segundos es menor de 45 fps.
- Anotar aquí el aparato, el fps y la calidad: iPad ___ / Android ___.

### 4. Lighthouse
En Chrome del escritorio, con el sitio abierto: F12, Lighthouse, Progressive Web App (si tu Chrome ya no trae la categoría, el panel Application, Manifest y Service workers muestran los mismos chequeos). No lo pude correr aquí: lo que sí está probado por pruebas automáticas es el manifest, el service worker y el modo sin red.

### 5. Demo con las niñas
Ver las secciones "Para que Rick revise" de cada fase.
