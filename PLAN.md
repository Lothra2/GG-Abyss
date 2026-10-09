# GG Abyss: plan

Este plan lo ejecuta Sonnet fase por fase sin poder preguntar. Si algo no está aquí, la regla es: lo que diga el kit real (`public/assets/kit/manifest.json` y `mundo/mundo1_bosque.json`) manda sobre lo que diga este plan, y la diferencia se anota en "Notas para después".

Referencias que hay que tener abiertas siempre:

- `CLAUDE.md`: reglas del repo.
- `tools/pixel_forja/docs/KIT_JUEGO.md`: formato del kit y cómo se carga en Phaser.
- `tools/pixel_forja/scripts/visor/runtime.js`: el visor vivo del Bosque GG. Es la referencia exacta de la atmósfera (orden de dibujo, viento, bruma, oscuridad, luces, partículas, criaturas). El juego tiene que verse igual o mejor.
- `ASSETS_PENDIENTES.md`: lo que le falta al kit y qué usar mientras tanto.

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Escala | Pixeles perfectos desde F0, igual que el visor. Nada de 960 x 540 fijo ni `Scale.FIT`. Zoom entero de cámara calculado del alto físico de la pantalla, vista lógica de al menos 400 de alto. El HUD se ancla a los bordes. Detalle en 3.2 |
| Texto | Todo el texto sale de las fuentes bitmap del kit (`manifest.ui.fuentes`): `fuente_ui` (8 px, se tiñe, escala entera x2 o x3), `fuente_titulo` (dorada) y `fuente_titulo_plata` (16 px). Nada de fuentes web ni `this.add.text`. |
| Conteos del mapa | Ningún test ni pantalla usa cantidades fijas de postales, zonas, cofres o fogatas. Todo se lee del mapa. Los tests exigen "al menos": postales >= 8, zonas >= 13, cofres secretos >= 5, puntos de guardado >= 3. El taller va a agregar más |
| Repos | `gg-abyss` y `pixel_forja` son privados. Netlify con deploy key (F5) |
| Kit para F0 | F0 arranca con el kit actual y no depende de nada pendiente. El taller ya está haciendo los imprescindibles de F1 y el botín de nivel bajo (ver `ASSETS_PENDIENTES.md`). Cuando lleguen: `git submodule update --remote tools/pixel_forja && npm run kit` |
| Oscuridad | Oscuridad final = `clamp(noche + zona.oscuridad, 0, 0.6)`. Noche por defecto 0.15 (hora dorada). Control "Noche" en ajustes de 0 a 0.55, guardado por perfil. En modo peque el control llega solo a 0.25 y la oscuridad final nunca pasa de 0.45. El farol de la heroína (92 px) siempre encendido. Igual que `runtime.js`. |
| Trol | El trol élite del Puente del Trol es un enemigo élite normal en F2: barra con nombre, más vida, golpe pesado avisado. Muere y suelta mejor botín. |
| Tablets | iPad y Android. Pruebas en los dos de verdad antes de cerrar F1 y F5. |
| Agua | 220 ms por cuadro, leído de la animación del tileset `agua` dentro de `mundo1_bosque.json`. No 260 ms: el kit manda. |
| Física | Sin Arcade Physics. Movimiento y colisión en `src/logic/` contra la grilla `colision` del mapa. Se puede probar sin Phaser. |
| Nivel de los objetos | Equipar NO pide nivel. El nivel del objeto solo decide en qué tablas de botín entra. |
| Stats | El catálogo trae stats estilo Diablo. El Mundo 1 usa este subconjunto: `damage`, `defense`, `life`, `mana`, `dmgPct`, `armorPct`, `atkSpeed`, `castSpeed`, `moveSpeed`, `critChance`, `lifeRegen`, `healPct`, `petDmg`, `petArmor`, `restoreLife`, `restoreMana`. El resto se muestra en el tooltip pero no hace nada todavía. |
| Nombres en tarjetas | Apodo por id en `src/config/juego.ts`: `rick` = "Papá", `steph` = "Mamá". Los demás usan `nombre` del manifest. |
| Llaves de guardado de entidades | `tipo:x:y` del punto en el mapa, por ejemplo `cofre:1808:912`. Si el taller mueve un cofre, ese cofre vuelve a estar cerrado. Aceptable. |
| Fases | F1 se parte en F1a (mundo vivo) y F1b (título, jugadoras y guardado). Es la fase más pesada y una sola sesión de Sonnet no la cierra con calidad. Las dos son jugables al terminar. |
| Versiones | Las mismas del taller para no pelear con dos juegos de herramientas: `phaser` 3.90.0 fijo, `typescript` ^5.9, `vite` ^8, `vitest` ^5, `@playwright/test` 1.56.1 fijo, `tsx` ^4. Node 22. |

---

## 1. Crítica del kit: qué falta o está mal para este juego

Lo bueno primero: el kit está sólido. Las 467 rutas del manifest existen, todas las hojas de personaje miden exactamente `cuadros x celda` por `8 x celda`, ninguna textura pasa de 4096 px y el mapa es alcanzable de punta a punta. Se puede arrancar ya. Lo que sigue es lo que va a doler si no se ataca.

**Bloqueantes por fase** (detalle y especificación en `ASSETS_PENDIENTES.md`):

1. **El botín del Mundo 1 es todo gris.** De los 393 objetos, los 135 que tienen nivel 1 a 10 son todos `normal`. No hay ningún `magic` en todo el catálogo, los `rare` son todos nivel 30 y el legendario más bajo es nivel 16. Con "úsalo tal cual" el haz de luz siempre sería blanco y se pierde lo más Diablo del juego. Mientras el taller no haga botín de nivel bajo, F3 usa tablas curadas: raros y legendarios en puntos fijos y con baja probabilidad en el trol y los cofres dorados.
2. **No hay flecha.** Sophie y los 13 goblins arqueros disparan flechas y el kit no tiene proyectil de flecha. Mientras tanto: `proyectil_sagrado` (el más parecido, amarillo y fino).
3. **No hay magia de naturaleza** para Alana. Mientras tanto: `proyectil_veneno` e `impacto_veneno` (verdes).
4. **No hay íconos de habilidad.** Los 8 botones de habilidad necesitan ícono porque Alana no lee. Mientras tanto: el primer cuadro del fx más parecido dentro de `casillero`.
5. **Carteles sin ícono.** Los 6 carteles del mapa piden `flecha_norte`, `peligro`, `corazon`, `cruce` y `estrella`, y ninguno existe en `ui/`. Para Alana un cartel sin ícono no sirve. Mientras tanto: `icono_mapa`.
6. **El minotauro es chico.** Celda 64 contra heroínas de 48. Un jefe tiene que llenar la pantalla. Mientras tanto: escala 1.5 en F4 (se ve un poco disparejo, por eso es pendiente imprescindible).
7. **Falta el aviso en línea** para la carga del minotauro. `aviso_jefe` es un óvalo. Mientras tanto: `aviso_jefe` estirado en x.
8. **Íconos de la PWA.** Sin ícono de app no hay instalación decente en la tablet.

**Datos que no cuadran con el prompt original** (ya resueltos en este plan):

- Hay 5 cofres secretos en el mapa, no 6: `tras_la_cascada`, `anillo_hadas`, `claro_escondido`, `pasto_alto` y `estanque_alto`. El sexto secreto es la zona Claro Escondido (`secreto: true`). Hoy el contador de secretos da 6: 5 cofres y 1 zona. El total siempre se calcula del mapa: cofres con `secreto` más zonas con `secreto`.
- El agua anima a 220 ms, no 260.
- El mapa trae un trol élite y el prompt no lo listaba. Queda como élite en F2.
- Los nombres de partículas de las zonas vienen en plural y no coinciden con las llaves del manifest. Además `fuegos_fatuos` y `murcielagos` son criaturas, no partículas. Tabla de traducción en la sección 3.
- `gota` existe pero ninguna zona la usa. La usamos como emisor local en la cascada.
- El kit trae objetos viejos que el mapa no usa (`arbol_roble_*`, `arbol_pino_*`, `abuelo_roble`, `sauce`, `arbusto`, `arbusto_moras`). El cargador solo carga los objetos que aparecen en el mapa, así no pesan.
- Thor con armadura solo trae `bite`, `howl`, `hurt`, `idle`, `run`, `walk`. Le faltan `bark`, `pickup`, `sit`, `wag` y `die`. Mientras tanto: en esas animaciones se usa la armadura en `idle` y el gesto se marca con sonido y un salto pequeño por tween.
- El trol tiene la misma celda que el goblin y casi la misma silueta. Como élite se escala x1.25 y se tiñe un poco. Pendiente de mejora.
- Rareza `unique`: hay color pero cero objetos. `cae_*` solo se usa para los de set y legendarios que tengan cuadros.
- Los sonidos nunca los escuchó nadie (lo dice KIT_JUEGO.md). F0 trae una "sala del kit" para que Rick los oiga todos antes de F1.

---

## 2. Dirección de arte del mundo

### 2.1 Crítica honesta de las postales

Lo que ya está increíble:

- Los árboles. Silueta, volumen y paleta al nivel de Stardew. Con el viento de 9 cuadros van a vivir.
- El río con cascada, vado y acantilado. La postal `cascada_y_vado` es la mejor del set.
- El Abuelo Roble con cara. Es el personaje del bosque y se reconoce de lejos.
- El Bosque Profundo: hongos gigantes, árboles secos y hechizados, suelo más oscuro. Con oscuridad 0.55, ojos y fuegos fatuos va a ser el "wow" del mundo.
- El mapa grande: la arena arriba a la derecha como meta visible, caminos que llevan, mesetas y escaleras.

Lo que se ve pobre:

- **Todo está iluminado igual.** Las postales son luz plana de mediodía, verde medio por todos lados. El "sombrío" hoy solo lo da el color del suelo del Bosque Profundo. La capa de atmósfera tiene que hacer el 60 % del trabajo: tinte por zona, oscuridad, pozos de luz, bruma y viñeta. Por eso F1a es casi toda atmósfera.
- **Praderas vacías.** Pradera de las Mariposas, el entorno del Puente del Trol, Las Alturas y el centro de la Colina de los Goblins son pasto con ruido. Cerca del 40 % de las pantallas no tienen nada que descubrir. En código lo mejoran mariposas, polen, sombras de nubes y pasto alto. En el taller hacen falta grupos de flores, piedras, troncos y pequeños rincones (pendiente de mejora con coordenadas).
- **Ruido fino.** Los caminos de tierra tienen piedritas blancas muy densas y las flores son puntitos de alto contraste. En una tablet a 1.2x se ve como estática. Pendiente para el taller: bajar densidad y contraste de las piedritas del camino.
- **Escala de lo importante.** La fogata (32 px) y los carteles (32 px) son diminutos al lado de árboles de 116 px. La fogata es donde se guarda y se reaparece y hoy no se nota. En código: pozo de luz grande, brasas y humo. En el taller: un "campamento de fogata" de 64 px.
- **Puente del Trol es la postal más floja.** Un puente genérico sobre el río con pasto vacío a los lados. No hay trol ni guarida. El trol élite aparece en F2, pero el lugar necesita una guarida bajo el puente.
- **Ruinas.** El piso de losas es una mancha uniforme con borde duro y la estatua de Thor es chica y gris, no se lee como un bóxer. Los pilares son iguales y equidistantes. En código: luz cálida sobre la estatua y polvo. En el taller: estatua más grande con placa dorada visible y bordes de losas rotas.
- **Colina de los Goblins no es colina.** Es plano con empalizada. Carpas chicas, centro vacío. En código: humo, antorchas y fogata con brasas. En el taller: dianas de práctica, barriles, una tarima.
- **Anillo de las Hadas chico.** 96 x 64 px y de poco contraste. Es el momento mágico secreto. En código: pulso de luz turquesa fuerte, brillos que suben y ambiente de magia.
- **Cobertura de postales.** Hay 8 para 13 zonas. Faltan Bosque Profundo, Claro Escondido, Lago Espejo, Campo de Calabazas y Las Alturas. Las capturas del juego leen la capa `postales` del mapa, así que cuando el taller agregue puntos salen solas.

### 2.2 Paleta de luz

- Base: hora dorada. Tinte de zona en modo soft light al 35 %, con el color `luz` de la zona. Fuera de zona: `#ffe2b0`.
- Oscuridad: color `rgb(3, 6, 18)` con alfa = oscuridad final. Hora dorada pura queda en 0.15, se nota como tarde y no como noche.
- Farol de la heroína: `#ffe2a8`, radio 92 px, alfa 0.75 al borrar la oscuridad, sin resplandor de color.
- Luces de objetos: las del manifest (`fogata` naranja `#ffa040`, `antorcha` `#ff8a3a`, `farol` `#ffd27a`, `portal_azul` `#6cb4ff`, `cascada` `#bfe6ff`, hongos `#4ad8ff` y `#c47aff`, `anillo_hadas` `#7affe0`, `cristales` `#b47aff`). `flicker` parpadea, `pulse` late.
- Árboles hechizados despiertos: luz de ojos de 46 px, `#7affc8` para el `_1` y `#ffd25a` para los demás, latiendo.
- Fuegos fatuos: 44 px, `#8af8ff` o `#c8a0ff` el violeta.
- Brasas: 10 px `#ff8a3a` por partícula.
- Viñeta: degradado radial de transparente al 35 % del lado corto a `rgba(2,4,10,0.75)` en la esquina.

### 2.3 Capas y orden de dibujo

Profundidades fijas en `src/config/juego.ts`:

| Profundidad | Capa | Desplazamiento |
|---|---|---|
| 0 | `agua` (tiles animados) | mundo |
| 1 | trozos de `suelo` | mundo |
| 2 | objetos con `capa: "suelo"` (puentes, piedras del vado, nenúfares, anillo) | mundo |
| 3 | sombras elípticas de personajes | mundo |
| 10 + y | objetos, personajes, criaturas y cofres ordenados por y del apoyo | mundo |
| 5000 | sombras de nubes | mundo |
| 5100 | partículas que no brillan (hojas, mariposas, motas, murciélagos) | mundo |
| 6000 | bruma, dos capas | pantalla |
| 7000 | oscuridad con pozos de luz borrados | pantalla |
| 7100 | resplandor de color aditivo de cada luz | mundo |
| 7200 | lo que brilla en la oscuridad: luciérnagas, fuegos fatuos, ojos | mundo |
| postFX | tinte de zona en soft light y viñeta | cámara |
| escena HUD | interfaz | aparte |

### 2.4 Atmósfera por zona

Oscuridad final con noche en 0.15. Las partículas vienen de la zona del mapa. Los emisores locales van pegados a objetos y funcionan en cualquier zona.

| Zona | Luz | Oscuridad final | Bruma | Partículas | Ambiente | Momento wow |
|---|---|---|---|---|---|---|
| Claro de la Llegada | `#ffe2b0` | 0.15 | 0.25 | polen | bosque | El portal azul late y la heroína sale con Thor. Paneo de presentación |
| Pradera de las Mariposas | `#fff0c0` | 0.15 | 0.15 | mariposas, polen | bosque | Mariposas de tres colores. El pasto alto se aparta. Sombras de nubes cruzando |
| El Abuelo Roble | `#ffe8b8` | 0.15 | 0.30 | hojas, luciérnagas | bosque | Tocar el Abuelo: brillo, sonido y corazones de `curar` |
| Bosque Profundo | `#7a8ab8` | 0.55 | 0.75 | luciérnagas, esporas, fuegos fatuos, murciélagos | noche | Se oscurece al entrar. Árboles que abren los ojos, ojos entre arbustos, hongos que alumbran |
| Anillo de las Hadas | `#a8fff0` | 0.55 | 0.55 | luciérnagas, brillos, fuegos fatuos | magia | El anillo late más fuerte cuando la heroína entra y suben brillos |
| Claro Escondido | `#d8b8ff` | 0.45 | 0.45 | brillos, luciérnagas | magia | Luz violeta, cristales. Banner plateado de secreto |
| Arroyo Cristalino | `#d8f0ff` | 0.15 | 0.50 | luciérnagas | agua | Cascada con gotas y bruma baja. Cuervos que huyen |
| Lago Espejo | `#d8f0ff` | 0.15 | 0.65 | luciérnagas, mariposas | agua | Bruma densa sobre el agua y nenúfares |
| Ruinas del Viejo Reino | `#ffe0c0` | 0.15 | 0.40 | polvo | viento | La estatua de Thor con su propia luz cálida. Thor ladra al verla |
| Colina de los Goblins | `#ffd0a0` | 0.15 | 0.25 | humo | viento | Humo de la fogata goblin, antorchas, estandartes al viento |
| Campo de Calabazas | `#ffd8a0` | 0.15 | 0.50 | hojas | bosque | Hojas de otoño y el espantapájaros |
| Las Alturas | `#fff4d8` | 0.15 | 0.20 | polen, hojas | viento | Al subir la escalera, la cámara se adelanta y muestra la arena a lo lejos |
| Arena del Minotauro | `#ffb08a` | 0.55 | 0.55 | brasas | cueva | Las piedras de la arena se encienden. Brasas. La cueva es la entrada al abismo |

En modo peque las tres zonas de 0.55 quedan en 0.45.

Traducción de nombres de partículas de zona a llaves del kit (en `src/kit/mapa.ts`):

| Zona dice | Kit |
|---|---|
| `polen` | `particulas.polen` |
| `mariposas` | `particulas.mariposa_azul`, `mariposa_naranja`, `mariposa_rosa` al azar |
| `hojas` | `particulas.hoja_verde` y `hoja_otono` mitad y mitad |
| `luciernagas` | `particulas.luciernaga` |
| `esporas` | `particulas.espora` |
| `brillos` | `particulas.brillo` |
| `humo` | `particulas.humo` |
| `polvo` | `particulas.polvo` |
| `brasas` | `particulas.brasa` |
| `fuegos_fatuos` | `criaturas.fuego_fatuo` y `fuego_fatuo_violeta` (40 % violeta) |
| `murcielagos` | `criaturas.murcielago` |
| otro nombre | `console.warn` una vez y se ignora |

Emisores locales: `fogata` echa `brasa` y `humo`, `cascada` echa `gota`, `hongo_gigante_*` echa `espora`, `cristales` y `anillo_hadas` echan `brillo`, `antorcha` echa `brasa`. Solo si el objeto está en pantalla.

### 2.5 Vida en código, con lo que trae el kit

Todo esto replica `runtime.js` y lo mejora:

- **Viento de árboles:** los árboles traen 9 cuadros. Cada uno arranca en un cuadro distinto (fase por hash de x, y). Un "animador de decorado" cambia el cuadro de todos los decorados activos con un solo reloj, sin un `anims` de Phaser por árbol. Ráfagas: cada 8 a 15 s el reloj del viento acelera a 1.6x durante 2 s y suben más hojas.
- **Árboles hechizados:** `dormido`, `despierto` cuando la heroína está a menos de 130 px del punto `(x, y - 60)`, y `parpadeo` cada 3 a 8 s mientras está despierto. Al despertar suena `ambiente_magia` bajito una vez.
- **Copas transparentes:** si la heroína está dentro del rectángulo del sprite de un árbol y su y es menor que la del apoyo del árbol, el árbol baja a alfa 0.45 con tween de 200 ms.
- **Pasto alto:** al pasar por encima, tween de ángulo de 12 grados hacia el lado contrario y escala y 0.85, regreso en 400 ms con rebote. Suena `paso` más bajo.
- **Sombra elíptica:** `mundo/luz.png` teñida de negro, alfa 0.35, escala x según celda, escala y 0.35. Es un asset del kit, no se dibuja nada.
- **Polvito de pasos:** cada 2 pasos una partícula `polvo` en los pies sobre tierra y piedra. Suena `paso` cada 2 cuadros de la caminata, con volumen y tono levemente al azar.
- **Sombras de nubes:** 6 `nube.png` a escala 2, alfa 0.8, cruzando el mapa a 7 a 13 px/s, igual que el visor.
- **Bruma:** `niebla_jirones` (12 px/s, alfa niebla x 0.85) y `niebla_nubes` (7 px/s, parallax 1.15, alfa niebla x 0.55), las dos a escala 2 y pegadas a la pantalla.
- **Agua:** los tiles del agua visibles cambian de índice cada 220 ms.
- **Cuervos:** `quieto`, a veces `picotear`, y huyen volando cuando la heroína pasa a menos de 46 px o los tocan. Vuelven a los 14 a 24 s.
- **Murciélagos:** cruzan la pantalla en el Bosque Profundo, máximo 2.
- **Ojos entre arbustos:** brillan con alfa `0.35 + oscuridad` y parpadean.
- **Luces:** cada objeto con `luz` borra la oscuridad con `luz.png` a `radius * 2 / 128` de escala y suma su resplandor de color en modo ADD a radio x 0.7 con alfa `0.22 + oscuridad x 0.25`.
- **Ambiente sonoro:** un loop por zona (`ambiente_<zona.ambiente>`) a 0.55 y los demás a 0, fundido de 1.2 s. Música `musica_<zona.musica>` aparte, fundido de 2 s.
- **Banner de descubrimiento:** la primera vez que entra a una zona con `descubrir`: "Descubriste" en `fuente_ui` x2 teñida `#ffd27a` y el nombre en `fuente_titulo` x2, aparece en 0.9 s, se queda 3.2 s, sale en 0.9 s. Para zonas con `secreto`: `fuente_titulo_plata` y sonido distinto. Contador en el HUD: zonas descubiertas y secretos encontrados sobre el total que se cuenta del mapa (hoy 13 zonas y 6 secretos).
- **Cámara:** sigue con lerp 0.12 y se adelanta 40 px hacia donde camina. Sin salirse del mapa. La primera vez de cada perfil hay paneo de presentación (F1b).

### 2.6 Postales y criterio de calidad

- Las postales salen de la capa `postales` del mapa, no de una lista fija.
- Playwright en el proyecto `postales` (ventana 960 x 540 con dpr 1, que da zoom 1 y vista lógica de 960 x 540, el mismo encuadre de las postales del kit) con `?test=1&seed=1&postal=1`: pone a la heroína en el punto más cercano caminable a la postal, cámara centrada exacta en el punto, Thor al lado, espera 3 s para que las partículas se asienten y guarda `docs/capturas/<fase>/<postal>.png`. Además guarda la misma postal en la vista tablet como `<postal>_tablet.png` para ver cómo se ve de verdad en el iPad.
- `scripts/comparar-postales.ts` arma `docs/capturas/comparar.html` con cada postal del kit al lado de la del juego para que Rick las revise.
- Criterio: cada postal del juego tiene que verse igual o mejor que la del kit. Rick decide. Si una no pasa, se anota qué falla en "Notas para después" y se arregla antes de cerrar la fase.
- Rendimiento: con `?test=1` hay medidor de fps en pantalla. Meta: 60 fps en el iPad y el Android reales con calidad alta y todo prendido. En Playwright el fps de Chromium sin GPU no sirve como medida, así que el e2e solo verifica límites que sí son deterministas: decorados activos menos de 450, partículas dentro del límite de la calidad, luces dentro del límite.

---

## 3. Técnica

### 3.1 Estructura de carpetas

```
gg-abyss/
  CLAUDE.md  PLAN.md  ASSETS_PENDIENTES.md
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts  playwright.config.ts  netlify.toml
  index.html
  public/
    assets/kit/                 generado por PixelForja. NO se toca a mano
    manifest.webmanifest        F5
  fichas/                       personajes del estudio (*.ficha.json)
  tools/pixel_forja/            submódulo, solo para regenerar el kit
  scripts/
    verificar-kit.ts            revisa manifest, archivos, tamaños de hojas, límite 4096
    comparar-postales.ts        arma docs/capturas/comparar.html
  docs/capturas/                postales del juego por fase
  e2e/                          pruebas de Playwright
  src/
    main.ts                     crea Phaser.Game con todas las escenas
    config/
      balance.ts                TODOS los números del juego
      juego.ts                  resolución, profundidades, apodos, límites de calidad, colores fijos
    kit/
      tipos.ts                  tipos del manifest y del mapa
      manifest.ts               carga y valida manifest.json, errores claros
      cargador.ts               encola en Phaser por grupo: inicio, heroes, mundo, botin, audio
      anims.ts                  crea anims por dirección para todo personaje del manifest
      mapa.ts                   convierte mundo1_bosque.json en datos puros
    logic/                      sin Phaser, todo con tests en src/logic/__tests__/
      azar.ts                   RNG con semilla (mulberry32)
      direccion.ts              vector a una de las 8 direcciones
      grilla.ts                 grilla de colisión, caminable, línea de vista
      camino.ts                 A* en 8 direcciones sin cortar esquinas, suavizado
      movimiento.ts             seguir camino, caminar hacia un punto, deslizar contra paredes
      zonas.ts                  zona en un punto (gana la más chica), mezcla de atmósfera, oscuridad final
      perfiles.ts               lista de jugadoras desde el manifest
      guardado.ts               esquema, versión, migración, leer y escribir
      descubrimiento.ts         zonas, secretos, contadores
      thor.ts                   seguir, morder, recoger, aullar, desenterrar
      stats.ts                  stats finales con equipo y nivel          F2
      combate.ts                daño, críticos, armadura, muerte y rescate F2
      habilidades.ts            recargas, maná, efectos por clase         F2
      ia.ts                     pasear, perseguir, atacar, volver         F2
      botin.ts                  tablas, rareza, oro                        F3
      inventario.ts             equipo, bolsa, cinturón, comparar          F3
      jefe.ts                   máquina de estados del minotauro           F4
    game/
      MundoVista.ts             agua, suelo, objetos del mapa
      Decos.ts                  activa decorados por celdas de 256 px y los anima con un reloj
      Heroina.ts  ThorSprite.ts  Criaturas.ts  Entidades.ts  Enemigos.ts  Proyectiles.ts
      Entrada.ts                toque, mantener, teclado a órdenes
      Camara.ts                 seguir, adelantarse, paneo
      Sonido.ts                 música, ambientes con fundido, efectos, desbloqueo de audio
      Texto.ts                  textos con las fuentes del kit y escalas enteras
    fx/
      Atmosfera.ts              orquesta todo y aplica calidad alta o baja
      Luces.ts                  oscuridad en RenderTexture y resplandor aditivo
      Bruma.ts  Nubes.ts  Particulas.ts  Agua.ts  Pasto.ts  Copas.ts  Pasos.ts  Sombras.ts
      AtmosferaFX.ts            postFX de tinte soft light y viñeta
    scenes/
      Boot.ts  Titulo.ts  SeleccionJugador.ts  Mundo.ts  HUD.ts  Inventario.ts
      Pausa.ts  Continuara.ts  Creditos.ts  SalaKit.ts
    test/
      ganchos.ts                window.__ABYSS__ con ?test=1
```

### 3.2 Render

- Escala entera, la misma regla del visor. Una función pura `calcularEscala(anchoCss, altoCss, dpr)` en `src/logic/escala.ts`, con tests:
  - `dpr = window.devicePixelRatio || 1`
  - `Wp = round(anchoCss * dpr)`, `Hp = round(altoCss * dpr)`: pixeles físicos
  - `zoom = max(1, floor(Hp / 400))`
  - vista lógica = `Wp / zoom` x `Hp / zoom`. Siempre al menos 400 de alto si la pantalla lo permite, y cada pixel del arte es un cuadrado de `zoom` x `zoom` pixeles físicos
  - Ejemplos: iPad 1180 x 820 con dpr 2 da zoom 4 y vista 590 x 410. Escritorio 1280 x 720 con dpr 1 da zoom 1 y vista 1280 x 720. 960 x 540 con dpr 1 da zoom 1 y vista 960 x 540
- Phaser con `Scale.RESIZE`, `pixelArt: true`, `roundPixels: true`, fondo `#070a12`. El canvas va en pixeles físicos (`Wp` x `Hp`) y por CSS ocupa la ventana. Las cámaras usan `setZoom(zoom)` entero. Se recalcula en cada `resize` y al girar la tablet. Si `Scale.RESIZE` no deja manejar el canvas en pixeles físicos, se usa `Scale.NONE` con el mismo cálculo a mano y se dice en el resumen.
- Nada se posiciona con coordenadas fijas de 960 x 540. El HUD se ancla a los bordes de la vista lógica (orbe de vida abajo a la izquierda, orbe de maná abajo a la derecha, cinturón abajo al centro, habilidades arriba del orbe de maná, contadores y pausa arriba) con márgenes de `config/juego.ts`, y se reacomoda en cada `resize`. Los paneles se centran con la vista.
- El inventario (280 x 410) va a x1. Si la vista lógica mide menos de 426 de alto (410 más 8 de margen arriba y abajo), la escena `Inventario` usa su propia cámara con un zoom entero menos, así cabe sin escalar en fracciones. Pasa en el iPad (410 de alto).
- Las fuentes se escalan solo x1, x2 o x3 sobre la vista lógica. Nunca 1.5.
- Oscuridad: una `RenderTexture` del tamaño de la vista lógica pegada a la pantalla, que se rehace en cada `resize`. Cada cuadro: limpiar, llenar con `rgb(3,6,18)` y alfa = oscuridad final, y borrar con `luz.png` en cada luz visible (stamp con modo ERASE). Escala de cada luz: `radio * 2 / 128` por el factor de parpadeo o latido de `runtime.js`.
- Resplandor: imágenes `luz.png` teñidas, modo ADD, en el mundo, profundidad 7100.
- Tinte y viñeta: un postFX propio (`AtmosferaFX`, un solo shader) con el color de zona en soft light al 35 % y la viñeta. En calidad baja no hay postFX: la viñeta pasa a ser una imagen de degradado radial (textura técnica) y el tinte un rectángulo en modo MULTIPLY al 12 %.
- Calidad alta o baja en ajustes. Baja: 50 partículas, 20 luces, una sola capa de bruma, sin nubes, sin postFX. Alta: 120 partículas, 40 luces. Por defecto alta, y si el fps promedio de los primeros 10 s baja de 45 pasa sola a baja y avisa con un ícono.
- Decorados: hay 2321 objetos en el mapa. Nunca se crean todos. Celdas de 256 px. Se crean los de las celdas visibles más un margen de 260 px y se devuelven a un pool al salir. Con eso hay unos 250 activos a la vez.

### 3.3 Carga

- `Boot`: carga `manifest.json`. Si no está, o `juego` no es "GG Abyss", o `version` no es 1, muestra un aviso en HTML plano (no hay fuentes todavía): "No encuentro el kit. Corre `npm run kit`." Luego carga el grupo `inicio`: fuentes, UI, retratos, `idle` y `walk` de las heroínas y de Thor, `portal_azul`, la postal de la arena, la bruma, la luz, `musica_bosque`, `ambiente_magia`, `click`.
- `Mundo` (pantalla de carga con barra de `ui/barra_xp`): el mapa, el agua, los 12 trozos de suelo, solo los objetos que aparecen en las capas `objetos` y `entidades`, criaturas, partículas, el resto de animaciones de la heroína elegida y de Thor, ambientes. Combate, botín y jefe se cargan en sus fases.
- El cargador recorre el manifest. Nada de listas fijas de nombres. Si el kit trae un personaje tipo `heroe` nuevo, sale en la selección sin tocar código.

### 3.4 Movimiento y controles

- Grilla de 120 x 90 desde la capa `colision` (distinto de 0 = no se pasa).
- A* en 8 direcciones, sin cortar esquinas, con costo 1 y 1.414. Suavizado por línea de vista. Si el destino no es caminable, va al caminable más cercano en un radio de 3 cuadros. Si no hay, sonido `error`.
- La heroína tiene un círculo de 8 px en los pies. Al chocar desliza por el eje libre.
- Tocar el piso: camina por el camino y pone `marca_destino` (4 cuadros) en el destino.
- Mantener presionado más de 250 ms: camina hacia el dedo, recalculando cada 100 ms.
- PC: WASD y flechas mueven directo. Clic izquierdo igual que tocar.
- Velocidad y animación: `walk` a 120 px/s. Si el camino mide más de 400 px usa `run` a 160 px/s.
- Dirección con la fórmula de KIT_JUEGO.md.
- Tablet en vertical: capa negra con el ícono de girar (pendiente) y la heroína en `idle`. El juego se pausa.

### 3.5 Guardado

Clave `ggabyss:v1:perfil:<id>`. Lista de perfiles en `ggabyss:v1:perfiles`.

```ts
interface Partida {
  version: 1
  id: string                 // id del personaje en el manifest
  creada: number
  actualizada: number
  nivel: number
  xp: number
  oro: number
  vida: number
  mana: number
  posicion: { x: number, y: number }
  ultimaFogata: string       // id del punto_guardado
  zonas: string[]            // nombres descubiertos
  secretos: string[]         // llaves de cofres secretos y zonas secretas
  cofres: string[]           // llaves tipo:x:y abiertos
  rompibles: string[]        // F3
  presentacionVista: boolean
  jefeVencido: boolean       // F4
  equipo: Record<string, string>      // casillero a id de objeto, F3
  bolsa: (string | null)[]            // 28 casillas, F3
  cinturon: (string | null)[]         // 4, F3
  ajustes: { noche: number, calidad: 'alta' | 'baja', musica: number, efectos: number, modoPeque: boolean }
}
```

- `migrar(json)` sube cualquier versión vieja a la actual. Si el JSON está roto, se guarda una copia en `ggabyss:v1:roto:<id>:<fecha>` y se crea partida nueva. Nunca se borra nada en silencio.
- Autoguardado en fogata, cofre, subida de nivel, portal y cada 30 s.
- `modoPeque` arranca en true para `alana` y false para las demás (lista en `balance.ts`).

### 3.6 Modo prueba

`?test=1` expone `window.__ABYSS__`:

```ts
{
  escena(): string
  estado(): Partida
  pos(): { x: number, y: number }
  teleport(x: number, y: number): void
  irAPostal(nombre: string): void
  postales(): string[]
  semilla(): number
  fps(): number
  conteos(): { decos: number, particulas: number, luces: number, enemigos: number }
  elegir(id: string): void         // salta título y selección
  zona(): string | null
  tocar(x: number, y: number): void // toque en coordenadas de mundo
}
```

`?seed=N` fija el RNG de juego y de partículas. `?heroe=<id>` entra directo al mundo con esa heroína. `?kit=1` abre la sala del kit.

### 3.7 Pruebas

- Vitest para `src/logic/` y para el kit (lee los archivos de `public/assets/kit` con `fs`).
- Playwright, tres proyectos: `escritorio` 1280 x 720 con dpr 1 y mouse, `tablet` 1180 x 820 con `deviceScaleFactor: 2`, `hasTouch: true` e `isMobile: true` (zoom 4, vista 590 x 410), y `postales` 960 x 540 con dpr 1 solo para las capturas. `webServer` con `vite preview` en el puerto 4173.
- Los tests del mapa y del kit nunca usan cantidades fijas: leen el mapa y exigen al menos postales >= 8, zonas >= 13, cofres secretos >= 5, puntos de guardado >= 3.
- Si la versión de Chromium no cuadra con la de Playwright, lanzar con `executablePath: '/opt/pw-browsers/chromium'` cuando exista esa ruta. Nunca `playwright install` en la nube.

---

## 4. Balance inicial

Todo en `src/config/balance.ts`. Ningún número de juego vive en otro archivo.

### Heroínas a nivel 1

| Id | Clase | Vida | Maná | Ataque básico | Daño | Alcance | Ataques/s |
|---|---|---|---|---|---|---|---|
| sophie | amazona | 60 | 30 | `shoot_bow`, flecha | 4 a 7 | 220 px | 1.0 |
| alana | druida | 55 | 50 | `cast`, proyectil de naturaleza | 3 a 6 | 200 px | 1.0 |
| rick | paladín | 90 | 20 | `attack`, `tajo` | 5 a 9 | 44 px | 1.1 |
| steph | hechicera | 50 | 60 | `cast`, bola de fuego | 5 a 8 | 220 px | 0.9 |
| heroína nueva del estudio | según `clase` del manifest, si no, amazona | | | | | | |

Por nivel: +10 vida, +5 maná, +8 % daño. Maná se regenera 3 por segundo. Vida se regenera 5 por segundo si no recibió daño en 4 s. Nivel máximo 10. XP para pasar de nivel n a n+1: `round(40 * n^1.5)`, o sea 40, 113, 208, 320, 447, 588, 741, 905, 1080.

### Habilidades

| Clase | Habilidad | Animación | Efecto | Maná | Recarga |
|---|---|---|---|---|---|
| amazona | Lluvia de flechas | `shoot_bow` | 3 flechas en abanico de 20 grados, 80 % de daño cada una | 6 | 4 s |
| amazona | Esquiva | `dodge` | salto de 90 px en 0.35 s, sin daño durante el salto | 0 | 3 s |
| druida | Llamar a Thor | `summon` | Thor hace `howl`, `escudo_de_thor` sobre Alana 4 s que absorbe 30 + 5 por nivel, y Thor muerde al enemigo más cercano por 300 % | 10 | 10 s |
| druida | Curar | `cast` + fx `curar` | cura 35 % de la vida máxima | 12 | 8 s |
| paladín | Torbellino | `whirlwind` | 1.2 s girando, golpea todo a 60 px cada 0.3 s al 70 % | 8 | 5 s |
| paladín | Bloqueo | `block_shield` | 1.5 s con 80 % menos daño | 0 | 4 s |
| hechicera | Nova de fuego | `nova` + `nova_fuego` x3 | 150 % de daño a todo en 110 px | 12 | 5 s |
| hechicera | Rayo canalizado | `channel` | mientras mantiene, un `proyectil_arcano` cada 0.2 s al 50 % | 3 por s | 0 |

### Thor

| Qué | Valor |
|---|---|
| Distancia al seguir | a 40 px del costado, se reacomoda si se aleja más de 90 px |
| Mordida | 3 a 5 + 1 por nivel, cada 2 s, enemigos a menos de 160 px de la heroína |
| Recoger monedas | radio 120 px |
| Aullido de rescate | con vida bajo 30 %, `escudo_de_thor` 5 s que absorbe 40 + 5 por nivel. Recarga 20 s |
| Desenterrar | fuera de combate, cada 60 a 90 s, 25 % de probabilidad: `bark`, luego `pickup` y aparece un objeto normal |
| Thor no muere | nunca. Si le pegan hace `hurt` |

### Enemigos

| Enemigo | Vida | Daño | Ataque | Vel. px/s | Ve a | XP | Oro |
|---|---|---|---|---|---|---|---|
| rata | 12 | 2 a 3 | `attack_thrust` cuerpo a cuerpo, 1/s | 70 | 140 px | 5 | 1 a 3 |
| calabaza | 30 | 3 a 5 | `attack` cuerpo a cuerpo, 0.8/s | 50 | 160 px | 12 | 2 a 5 |
| goblin_arquero | 22 | 3 a 5 | `shoot_bow` a 200 px, 0.7/s, se aleja si la heroína está a menos de 120 px | 60 | 220 px | 15 | 3 a 6 |
| trol élite | 140 | 7 a 10 | `attack` 0.6/s, y `attack_heavy` cada 6 s con aviso de 1.2 s en 70 px, 12 a 16. `warcry` al 50 %: +20 % velocidad | 55 | 200 px | 90 | 20 a 35 |
| minotauro | 650 | ver F4 | | 70 | arena | 400 | lluvia de oro |

Vuelven a su lugar si la heroína se aleja más de 320 px de su punto de inicio. Al volver se curan. El minotauro no.

### Modo peque

| Qué | Valor |
|---|---|
| Daño de enemigos | x 0.5 |
| Velocidad de enemigos | x 0.8 |
| Avisos | x 1.5 (1.2 s pasa a 1.8 s) |
| Apuntado | automático al enemigo más cercano en el alcance |
| Botones | x 1.25 |
| Noche máxima | 0.25 en el control, oscuridad final máxima 0.45 |

### Botín (F3)

| Fuente | Objeto | Oro | Rareza |
|---|---|---|---|
| rata | 25 % | 60 % | normal |
| calabaza | 35 % | 60 % | normal |
| goblin | 35 % | 70 % | normal |
| trol | 100 %, 2 objetos | 100 % | uno raro garantizado |
| rompible | 20 % | 50 % | normal, o poción 50 % de las veces |
| cofre madera | 1 objeto | 5 a 10 | normal |
| cofre reforzado | 2 objetos | 15 a 25 | normal, 15 % raro |
| cofre dorado | 3 objetos | 30 a 50 | 1 raro garantizado, 10 % legendario de nivel 16 a 24 |
| cofre legendario | arma personal + `pet_armor_3` | 200 | set |

Objetos normales: los de nivel menor o igual a `nivel de la heroína + 2`. Raros y legendarios: tablas curadas en `balance.ts` mientras no exista botín de nivel bajo en el kit.

Premios fijos para que cada secreto valga la pena:

| Cofre | Premio fijo además del azar |
|---|---|
| tutorial (`cofre:112:2640`) | `pet_armor_1`. La primera armadura de Thor en el primer minuto |
| `pasto_alto` | 3 pociones de vida |
| `tras_la_cascada` | un raro |
| `anillo_hadas` | `pet_armor_2` |
| `estanque_alto` | un raro |
| `claro_escondido` | un legendario de nivel 16 a 24 |

Arma personal por id: `sophie` `arco_de_sophie`, `alana` `varita_de_alana`, `rick` `juramento_de_rick`, `steph` `baculo_de_steph`. Heroína del estudio: `collar_de_thor`.

Pociones: vida restaura 40 % en 1 s, maná 50 %. Cinturón inicial: 2 de vida y 1 de maná.

---

## 5. Fases

Cada fase termina jugable, con `npm run typecheck`, `npm test`, `npm run build` y `npm run e2e` en verde y push.

### F0. Base

**Objetivo:** el proyecto compila, carga el kit desde el manifest, avisa claro si falta, y Rick puede ver y oír todo el kit en una sala.

**Tareas:**

1. `package.json` con scripts `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `test`, `e2e`, `kit` (`tsx tools/pixel_forja/scripts/game-kit.ts public/assets/kit --fichas fichas`), `verificar-kit` (`tsx scripts/verificar-kit.ts`). Dependencias de la sección 0.
2. `tsconfig.json` estricto, `vite.config.ts` con `base: './'`, `vitest.config.ts` (entorno node, `src/**/*.test.ts`), `playwright.config.ts` con los dos proyectos, `netlify.toml` (build `npm run build`, publish `dist`, `NODE_VERSION = "22"`).
3. `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`.
4. `src/kit/tipos.ts`: tipos que calcan el manifest real, incluido `ui.fuentes`, `mundo.criaturas`, `mundo.niebla`, `mundo.postales`, `botin.atlas`.
5. `src/kit/manifest.ts`, `src/kit/cargador.ts` y `src/kit/anims.ts` como en 3.3.
6. `src/kit/mapa.ts`: lee `mundo1_bosque.json` y devuelve grilla, objetos, entidades por tipo, zonas con sus props, postales y la duración de la animación del agua.
7. `src/logic/azar.ts`, `src/logic/direccion.ts`.
8. `src/config/juego.ts` y `src/config/balance.ts` con todo lo de la sección 4.
9. Escena `Boot` con el aviso de kit faltante. Escena `SalaKit` (`?kit=1`): cada personaje del manifest caminando en las 8 direcciones con un selector de animación, todos los fx en bucle, objetos, criaturas y partículas animados, las 3 fuentes con el texto "¡Ñandú, Thor! ¿Qué pasó? áéíóú", y una lista de todos los audios con botón para oír cada uno. Todo leído del manifest.
10. `scripts/verificar-kit.ts`: todas las rutas existen, hojas con el tamaño exacto, nada pasa de 4096, cada objeto del mapa existe en `manifest.mundo.objetos`, cada criatura y partícula de zona existe con la traducción.
11. `src/logic/escala.ts` y el manejo de `resize` de 3.2 desde ya. La pantalla de Boot y la sala del kit se acomodan a la vista lógica, sin coordenadas de 960 x 540.
12. `src/test/ganchos.ts` con `escena()`, `fps()`, `semilla()` y `escala()` (devuelve zoom y vista lógica).

**Aceptación:**

- `npm run dev` abre una pantalla negra con "GG Abyss" en `fuente_titulo` y no hay errores en la consola.
- Si se renombra `public/assets/kit/manifest.json`, sale el aviso "No encuentro el kit. Corre npm run kit." (se prueba en e2e interceptando la petición, no tocando el kit).
- `?kit=1` muestra todos los personajes y fx del manifest (hoy 15 y 66), y suena cada audio al tocarlo.
- `npm run verificar-kit` pasa.
- En la vista tablet `__ABYSS__.escala()` da zoom 4 y vista 590 x 410, y al cambiar el tamaño de la ventana el zoom se recalcula y sigue entero.

**Tests:** kit (rutas, tamaños, 4096, objetos del mapa en el manifest, traducción de partículas sin huecos), `azar` (misma semilla, misma secuencia), `direccion` (8 vectores dan las 8 direcciones del manifest en su orden), `mapa` (ancho y alto iguales a los del manifest, y al menos 3 puntos de guardado, 5 cofres secretos, 13 zonas y 8 postales, leídos del mapa, nunca cantidades exactas), `escala` (los 3 ejemplos de 3.2, alto lógico siempre >= 400 cuando `Hp >= 400`, zoom siempre entero, pantalla de menos de 400 de alto da zoom 1).

**E2E:** humo en escritorio y tablet: carga, escena Boot termina, sin errores, zoom esperado. Kit faltante. Sala del kit con todos los personajes del manifest (hoy 15).

**Postales:** ninguna.

**Demo:** solo Rick. Abre `?kit=1`, oye todos los sonidos y anota en `ASSETS_PENDIENTES.md` los que suenen feo.

### F1a. Mundo vivo

**Objetivo:** con `?heroe=sophie` (o cualquier heroína) se camina por el Bosque GG entero, con todas sus capas, la atmósfera completa, Thor al lado y banners de zona. Se ve como el visor o mejor.

**Tareas:**

1. `src/logic/grilla.ts`, `camino.ts`, `movimiento.ts`, `zonas.ts` (zona en punto, mezcla suave de luz, bruma y oscuridad con `k = min(1, dt * 1.2)`, oscuridad final con el tope de modo peque).
2. `src/game/MundoVista.ts` y `Decos.ts`: agua, suelo, objetos de suelo, decorados por celdas con pool y animador de viento.
3. `src/game/Heroina.ts`, `ThorSprite.ts` (seguir, `idle`, `walk`, `run`, `sit` cuando la heroína está quieta más de 5 s, `wag` al volver a moverse), `Criaturas.ts` (cuervos, ojos), `Entrada.ts`, `Camara.ts`.
4. `src/fx/`: `Luces`, `Bruma`, `Nubes`, `Particulas` (zona y emisores locales, con límites de calidad), `Agua`, `Pasto`, `Copas`, `Pasos`, `Sombras`, `AtmosferaFX`, y `Atmosfera` que los orquesta.
5. `src/game/Sonido.ts`: ambiente por zona y música con fundido. Desbloqueo con el primer toque.
6. Banner de descubrimiento con `fuente_titulo` y contadores de zonas y secretos en una escena `HUD` mínima.
7. Ganchos de prueba: `pos`, `teleport`, `irAPostal`, `postales`, `conteos`, `zona`, `tocar`. Medidor de fps en pantalla con `?test=1`.
8. `scripts/comparar-postales.ts`.
9. Los enemigos del mapa NO se crean todavía. Cofres, carteles y fogatas se dibujan pero no se usan (eso es F1b).

**Aceptación:**

- Desde el inicio se llega caminando, solo tocando el piso, a todas las zonas del mapa.
- Al entrar a cada zona por primera vez sale su banner, una sola vez.
- En el Bosque Profundo la oscuridad llega a 0.55 en 1 a 2 s y el farol de la heroína ilumina alrededor. Con `modoPeque` no pasa de 0.45.
- Los árboles se mecen desfasados, los hechizados despiertan al acercarse, los cuervos huyen, la bruma corre, las nubes cruzan, el agua se mueve.
- Las copas se vuelven transparentes con la heroína detrás. El pasto alto se aparta.
- Thor sigue sin tapar a la heroína y nunca se queda trabado más de 2 s (si se traba, se teletransporta detrás de ella fuera de cámara).
- Al cambiar de zona el ambiente sonoro cambia con fundido.
- Todas las postales de la capa `postales` (al menos 8) están en `docs/capturas/f1a/` y en `comparar.html`.
- El HUD queda pegado a los bordes en escritorio y en tablet, sin nada cortado ni flotando en el medio.

**Tests:** A* (camino más corto conocido, no corta esquinas, destino bloqueado va al caminable más cercano, todas las zonas del mapa alcanzables desde `jugador_inicio`), movimiento (desliza contra pared), zonas (gana la más chica, oscuridad final con y sin modo peque, tope 0.6), traducción de partículas.

**E2E:** caminar con toques de un punto a otro y llegar, teclado mueve en escritorio, mantener presionado mueve en tablet, `teleport` a cada zona cambia `zona()`, conteos dentro de límites en cada postal del mapa, postales.

**Postales:** todas las de la capa `postales`.

**Demo con las niñas:** todavía no. Rick la prueba en el iPad y en el Android y revisa `comparar.html`. Si una postal no está igual o mejor, no se pasa a F1b.

### F1b. Título, jugadoras y guardado

**Objetivo:** la demo para las niñas: título, elegir jugadora, explorar el bosque, abrir cofres, leer carteles con ícono, guardar en fogatas.

**Tareas:**

1. Escena `Titulo`: fondo con la postal `arena_del_minotauro` a x1 centrada en la cueva y recortada a la vista lógica (la cueva es la entrada al abismo), encima la bruma, oscuridad 0.45 con pozos de luz en la cueva y las antorchas de esa vista (calculadas desde los objetos del mapa dentro de ese encuadre), brasas subiendo. "GG Abyss" en `fuente_titulo` x3 y "Toca para empezar" en `fuente_ui` x2 latiendo. Suena `ambiente_magia`. El toque desbloquea el audio y pasa a la selección.
2. Escena `SeleccionJugador`: una tarjeta por cada personaje tipo `heroe` del manifest, en el orden `sophie`, `alana`, `rick`, `steph` y luego las del estudio. Las tarjetas se reparten a lo ancho de la vista lógica, en una fila si caben y si no en dos. Cada tarjeta: `panel` 9-slice, la heroína en `idle` a x2 (x3 si la vista lógica mide más de 720 de ancho) girando por las 8 direcciones cada 1.2 s, apodo en `fuente_titulo`, ícono de su arma del atlas `iconos` (`bow_1`, `wand`, `sword_1`, `staff` o el que corresponda por `base.icon`) y, si tiene partida, nivel y oro con `icono_oro`. Tocar: la tarjeta salta, aura `aura_nivel`, suena `subir_nivel`, Thor entra corriendo con `run` y se sienta al lado. Botón grande "Jugar" o "Continuar" con ícono. Borrar perfil: mantener 3 s sobre el ícono `icono_cerrar` con un anillo que se llena.
3. `src/logic/perfiles.ts` y `guardado.ts` con migración y autoguardado.
4. Paneo de presentación la primera vez de cada perfil: cámara arranca en la arena (1.5 s quieta), viaja a la postal `ruinas_y_estatua` y luego a `llegada` en 6 s con suavizado, el portal azul hace `abrir` y `girar`, la heroína sale del portal y Thor detrás. Se salta con un toque.
5. Entidades: cofres (`cofre_<nivel>_quieto` con brillo y `cofre_<nivel>_abrir`, sale una moneda `moneda_gira` que salta y suena `cofre_abrir` y `moneda`). Todos los cofres se abren menos el `tras_jefe`, que no aparece hasta F4. Los secretos suman al contador con su banner plateado "¡Secreto!". Carteles: tocar abre un panel con el ícono grande y el texto en `fuente_ui` x2. Fogatas: tocar o pasar a menos de 48 px guarda, suena `curar`, fx `curar` sobre la heroína, cartelito "Guardado" con ícono. Portal de llegada animado.
6. Escena `Pausa` (`icono_ajustes` arriba a la derecha, Esc en PC): control de Noche con la regla de la sección 0, calidad alta o baja, volumen de música y efectos, modo peque, cambiar de jugadora y créditos. Todo con ícono.
7. Escena `Creditos` con `CREDITOS.txt` en `fuente_ui`, desplazable.

**Aceptación:**

- De abrir el juego a estar caminando: 2 toques en la tablet.
- La selección muestra las 4 heroínas. Si se pone `fichas/prima.ficha.json` y se corre `npm run kit`, sale una quinta tarjeta sin tocar código.
- Abrir un cofre, salir, volver a entrar con la misma jugadora: el cofre sigue abierto y el oro sigue.
- Cada jugadora tiene su partida aparte.
- Alana llega a jugar sin leer: todo botón tiene ícono.
- El paneo sale solo la primera vez.

**Tests:** guardado (crear, leer, migrar de una versión 0 de prueba, JSON roto va a copia), perfiles (lee heroínas del manifest, apodos, modo peque por defecto), descubrimiento (los totales salen del mapa, con un mapa de prueba chico, y los secretos no se cuentan dos veces).

**E2E:** flujo completo en tablet: título, tocar, elegir Alana, presentación saltada, caminar a un cofre, abrirlo, recargar la página, continuar, el cofre sigue abierto. Pausa cambia la noche y no pasa de 0.25 en Alana. Las postales de nuevo con las entidades vivas.

**Postales:** todas las del mapa en `docs/capturas/f1b/`, más `titulo.png` y `seleccion.png` en escritorio y en tablet.

**Demo con las niñas:** cada una elige su tarjeta, sale del portal con Thor, busca los cofres secretos y descubre todas las zonas. Pregunta para Sophie: "¿cuál zona te gustó más?". Para Alana: ver si encuentra sola el Anillo de las Hadas siguiendo las luces.

**Notas de cierre F1b:** hecho con FondoAbismo en vez de recortar la postal a mano. La pausa usa `icono_pausa` (el taller lo entregó) en vez de `icono_ajustes`. Quedó para después: el Abuelo Roble solo sonríe al tocarlo, no al pasar cerca.

### F2. Combate

**Objetivo:** pelear con ratas, calabazas, goblins y el trol, con habilidades por clase, números de daño, orbes, XP y el rescate de Thor.

**Tareas:**

1. `src/logic/stats.ts`, `combate.ts`, `habilidades.ts`, `ia.ts`, y la parte de combate de `thor.ts`.
2. `src/game/Enemigos.ts`: los 29 enemigos del mapa, con `idle`, `walk`, `run` donde exista, ataque, `hit`, `die`. Barra `barra_vida_enemigo` sobre cada uno solo si recibió daño. El trol con `estandarte` y su nombre de `props.nombre` o "Trol del Puente".
3. `src/game/Proyectiles.ts`: proyectiles en 8 direcciones del manifest, impactos. Flecha y naturaleza con los reemplazos de la sección 1.
4. Tocar un enemigo: la heroína se acerca hasta su alcance y ataca sola hasta que muera o reciba otra orden. Contorno o tinte rojo suave al enemigo marcado.
5. HUD completo: `orbe_vida` a la izquierda y `orbe_mana` a la derecha con `orbe_*_ola` encima, `barra_xp` abajo, 2 botones de habilidad abajo a la derecha (círculo de recarga con un arco oscuro en código), cinturón al centro (todavía vacío o con las pociones iniciales).
6. Números de daño con `ui/numeros.png` (blanco normal, amarillo crítico, rojo daño recibido, verde curación, azul maná), suben 24 px y se desvanecen en 0.8 s.
7. Subir de nivel: `aura_nivel`, `subir_nivel`, vida y maná llenos, banner "¡Nivel 3!" con `fuente_titulo`.
8. Rescate de Thor: al llegar a 0, `die` de la heroína, Thor `howl` y `aullido`, fundido a negro en 1 s, "¡Thor te salvó!" en `fuente_titulo` x2, reaparece en la última fogata con vida y maná llenos. No se pierde nada.
9. Modo peque: daño, velocidad, avisos, apuntado automático y botones grandes.
10. PC: Q y W habilidades, 1 a 4 pociones.

**Aceptación:**

- Las 4 clases matan una rata, una calabaza y un goblin con su ataque básico y sus 2 habilidades.
- Los goblins disparan desde lejos y se alejan si la heroína se acerca.
- El trol avisa su golpe pesado 1.2 s antes (1.8 en modo peque) y se puede esquivar caminando.
- Morir nunca quita nada.
- Enemigos que se alejan de su sitio vuelven y se curan.

**Tests:** daño con armadura y crítico con semilla, recargas y maná, IA por estados con un reloj falso, Thor aúlla solo bajo 30 % y respeta los 20 s, rescate deja todo igual menos posición, vida y maná, XP y niveles con la tabla, modo peque multiplica bien.

**E2E:** con `?seed=1`, teleport cerca de una rata, tocarla, muere, sube la XP. Morir a propósito (gancho `danar(999)`) y reaparecer en la fogata.

**Postales:** `colina_goblin` y `puente_del_trol` con enemigos, más `combate_<clase>.png` con cada clase usando su habilidad 1.

**Demo con las niñas:** cada una pelea hasta nivel 3. Mirar si Alana entiende los dos botones sin explicación y si el aullido de Thor la hace reír.

**Notas de cierre F2:** hecho como dice el plan salvo tres ajustes: habilidades en Q y E (W camina), golpe pesado del trol con radio 48 (el aviso del kit mide 96) y los disparos pasan por encima de árboles y arbustos. Para después: el oro de los enemigos pasa a monedas del piso en F3.

### F3. Botín

**Objetivo:** el botín como en Diablo: cae, brilla, se recoge, se equipa y se nota.

**Tareas:**

1. `src/logic/botin.ts` e `inventario.ts` con las tablas de la sección 4.
2. Drops: el ícono sale con tween de rebote (o `cae_<id>` si existe), `haz_<rareza>` del color de su rareza, suena `recoger` al tomarlo, `legendario` si es set o legendario. Oro con `oro_<tamaño>` según cantidad, Thor lo recoge.
3. Cofres con botín real. Rompibles con `romper` y sonido `romper`.
4. Escena `Inventario` (I o `icono_bolsa`): `ui/inventario.png` centrado a x1, con su propia cámara de un zoom entero menos cuando la vista lógica mide menos de 426 de alto (ver 3.2), íconos del atlas de 32, equipo en los 11 casilleros del `layout` más el retrato, bolsa de 7 x 4, oro. Tocar un objeto de la bolsa lo equipa (o lo manda al cinturón si es poción). Tocar uno equipado lo devuelve a la bolsa. Mantener presionado muestra `tooltip` con nombre en el color de su rareza, stats y la comparación con `+` verde o `-` rojo de `numeros.png`.
5. Thor: el casillero `mascota` acepta `pet_armor_N` y cambia su sprite a `thor_armaduraN`.
6. Cinturón: 4 casillas, tocar toma la poción. Las pociones del suelo van directo al cinturón si hay lugar.
7. Guardado completo de equipo, bolsa, cinturón y rompibles.

**Aceptación:**

- El cofre tutorial da la armadura 1 de Thor y Thor cambia al equiparla.
- Equipar un arma cambia el daño de los números.
- Un raro cae con haz amarillo y sonido distinto.
- Con la bolsa llena, el objeto queda en el piso y suena `error`.

**Tests:** tablas con semilla dan siempre lo mismo, premios fijos de los cofres secretos, equipar y desequipar suma y resta stats, cinturón, bolsa llena, guardar y cargar inventario.

**E2E:** abrir el cofre tutorial, equipar `pet_armor_1` en Thor, verificar en `estado()`.

**Postales:** `inventario.png` y `botin_en_el_piso.png`.

**Demo con las niñas:** buscar los 5 cofres secretos con botín real. Ver quién arma primero a Thor.

**Notas de cierre F3:** hecho como el plan. Cambios: sin cámara aparte para el inventario (entra a x1 en la tablet), legendarios por clase en el Claro Escondido, mágicos `m_*` mezclados con los normales. Para después: las hombreras y pantalones necesitan casillero (hoy no se sortean), y los anillos y amuletos tipo charm tampoco.

### F4. El minotauro

**Objetivo:** la pelea final del Mundo 1 y el cierre.

**Tareas:**

1. `src/logic/jefe.ts`: máquina de estados con fases y temporizadores, sin Phaser.
2. Entrar a la arena (radio 192 de `arena_jefe`): todas las `piedra_arena` de la arena hacen `encendida` una tras otra, suena `musica_jefe` y `jefe_rugido`, sale el `estandarte` con "Minotauro del Bosque" y `barra_jefe` arriba. La salida de la arena se cierra mientras dure la pelea (colisión temporal en el borde).
3. Fase 1, 100 % a 60 %: golpe (`attack`, 10 a 14), golpe fuerte (`attack_heavy` con `aviso_jefe` en su frente, 14 a 18) y carga en línea (`charge`, aviso en línea, 16 a 22, choca con el borde y queda aturdido 1.5 s).
4. Fase 2, 60 % a 0: pisotón (`attack_heavy` con `aviso_jefe` que se llena, radio 100, 14 a 18, `jefe_pisoton` y sacudida de cámara), salto a la posición de la heroína (`leap` con aviso que se llena en el destino, 18 a 24, radio 80) y grito (`warcry` con `grito_de_guerra`, llama 2 ratas, máximo 4 ratas vivas).
5. Todo ataque grande avisa 1.2 s antes, 1.8 en modo peque. El minotauro no se cura nunca y su vida queda guardada si la heroína cae (al volver sigue donde quedó).
6. Victoria: `die`, `musica_victoria`, `lluvia_de_oro`, se abre `portal_jefe` (`portal_rojo` o el del color de `props.color`), aparece el cofre legendario con su `haz_set`.
7. Entrar al portal: escena `Continuara` con "Continuará... más abajo en el abismo" en `fuente_titulo` x2, resumen con íconos (nivel, oro, zonas, secretos, tiempo de juego) y guardado. Botón para volver al bosque.
8. Escala del minotauro 1.5 mientras el taller no entregue la versión grande.

**Aceptación:**

- La pelea se gana con cada clase a nivel 6 sin pociones en modo normal, y con Alana en modo peque a nivel 4.
- Ningún ataque grande pega sin aviso.
- La vida del jefe nunca sube.

**Tests:** transiciones de fase en el 60 %, avisos con la duración correcta en los dos modos, el jefe no se cura al morir la heroína, máximo de ratas, victoria abre portal y cofre.

**E2E:** con `?seed=1` y gancho para bajar la vida del jefe, ver el cambio de fase, ganar, entrar al portal, llegar a `Continuara`.

**Postales:** `arena_del_minotauro` en la pelea con un aviso en el piso, `victoria.png`, `continuara.png`.

**Demo con las niñas:** la pelea. Rick no ayuda. Ver cuánto tarda cada una y si Alana entiende los avisos del piso.

**Notas de cierre F4:** hecho como el plan, con los radios de aviso en 48 y 96 (ver PROGRESO). La pelea se corta si la heroína se aleja más de 60 px de la arena. Para después: el jefe no persigue a la heroína fuera de la arena ni hay segunda fase de música.

### F5. Pulido y deploy

**Objetivo:** que funcione bien en las tablets y quede en Netlify instalable.

**Tareas:**

1. Medir en el iPad y el Android con `?test=1`, con el zoom entero que dé cada uno. Ajustar límites de calidad hasta 60 fps en alta, o dejar baja por defecto en el aparato que no llegue y decirlo.
2. PWA: `manifest.webmanifest` (`display: fullscreen`, `orientation: landscape`, íconos del kit), service worker que guarda en caché el juego y el kit al instalar. Botón de pantalla completa en Android y PC. En iPad, instrucciones con ícono para "Agregar a inicio".
3. Aviso de girar la tablet.
4. Audio en iOS: verificar que el primer toque lo desbloquea, que vuelve al regresar de otra app (`visibilitychange`) y que los ambientes no se cortan en el bucle.
5. Ajustes de balance con lo que se vio en las demos.
6. Netlify: el repo y el submódulo son privados. Netlify clona los submódulos y va a fallar. Rick hace: en Netlify, Site configuration, Build and deploy, Deploy key, generar la llave, y pegarla como Deploy key de solo lectura en GitHub en `Lothra2/pixel_forja`. Si no funciona: GitHub Action que corre `npm run build` y `netlify deploy --prod --dir dist` con `NETLIFY_AUTH_TOKEN` y `NETLIFY_SITE_ID` como secretos, sin clonar el submódulo.
7. Créditos accesibles desde título y pausa.

**Aceptación:**

- Instalada como app en el iPad y el Android, abre en horizontal y a pantalla completa.
- Funciona sin red después de la primera carga.
- 60 fps o la calidad elegida dicha por escrito por aparato.
- Lighthouse PWA sin errores.

**Tests:** los de siempre. E2E: el service worker queda registrado en build de producción, modo sin red recarga bien.

**Postales:** todas las del mapa, finales, en `docs/capturas/f5/`.

**Demo con las niñas:** la app en su tablet, desde el ícono, sin Rick al lado.

**Notas de cierre F5:** hecho como el plan salvo: el kit ya está en el repo (no hace falta la llave del submódulo para construir, solo para actualizar el kit), no se pudo medir en el iPad ni en el Android ni correr Lighthouse (pasos de Rick en PROGRESO.md), y el panel de instalar en iPad usa texto porque faltan los íconos de Safari (ASSETS_PENDIENTES.md #28).

---

## 6. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Rendimiento de la atmósfera en tablet | Decorados por celdas con pool. Un solo reloj para el viento. Una RenderTexture para la oscuridad. Límites de partículas y luces por calidad. Calidad baja automática si el fps cae. Medir en aparatos reales desde F1a, no en F5 |
| Dibujar a resolución física | Con zoom entero el canvas va en pixeles físicos (2360 x 1640 en el iPad) y la bruma, la oscuridad y el postFX cubren toda la pantalla. La oscuridad se arma a tamaño de vista lógica. En calidad baja se usa dpr 1 con `image-rendering: pixelated` por CSS: el encuadre queda casi igual y se pinta 4 veces menos |
| Audio en iOS | Desbloqueo con el toque de "Toca para empezar". Reanudar el contexto en `visibilitychange`. WAV de 22 kHz que Safari decodifica sin problema. Probado en el iPad en F1b y F5 |
| Memoria de texturas en iPad | 12 trozos de suelo de 960 x 960 son unos 44 MB en la GPU. Solo se cargan los objetos del mapa. Combate, botín y jefe se cargan por fase. Si Safari se cae, los trozos lejanos se descargan por distancia |
| Tamaño del kit (23 MB) | Carga en dos grupos con barra. La PWA guarda todo después de la primera vez. Los WAV no se convierten porque sería tocar el kit |
| Tacto contra clic | Un solo módulo `Entrada.ts` convierte todo a órdenes. Toque corto, mantener y teclado probados en los dos proyectos de Playwright. Zonas de toque de al menos 48 px reales, 60 en modo peque |
| Submódulo privado en Netlify | Deploy key en `pixel_forja` o deploy con GitHub Actions (F5, tarea 6) |
| Regenerar el kit cambia el mapa | Las llaves de guardado son `tipo:x:y`. Si el taller mueve algo, ese algo se resetea y nada se rompe. `verificar-kit` corre en `npm test` y avisa si el mapa pide un objeto que el manifest no tiene |
| Sonidos que nadie oyó | Sala del kit en F0. Lo que suene feo se anota como pendiente |
| Botín gris | Tablas curadas en F3 hasta que el taller haga botín de nivel bajo |

---

## 7. Notas para después

Aquí van las cosas que aparezcan en una fase y sean de otra. Cada nota con fecha y fase.

- Ciclo de día y noche en el Mundo 2. El control de Noche ya deja todo listo.
- Exportar las heroínas con los 5 niveles de armadura cuando el juego lo pida.
- Mundo 2: el `portal_jefe` ya trae `destino: mundo2`.
- F1a: `niebla_jirones.png` no repite sin costura hacia los lados. El juego usa una copia espejada armada en código y se pidió al taller rehacerla (ASSETS_PENDIENTES.md #27).
- F1a: la zona Arena del Minotauro pide `musica: jefe`. La música del jefe solo la controla la pelea (F4), entrar a la arena sigue con la del bosque.
- F1a: el cálculo de decorados activos usa el rectángulo exacto de cada sprite (más 48 px para entrar y 96 para salir), no celdas de 256 px. Con eso hay unos 120 activos en la vista de la tablet y menos de 350 en 1280 x 720.
- F1a: la escala entera se resuelve con Scale.NONE y el canvas a resolución lógica agrandado con pixelado CSS (igual que el visor), no con Scale.RESIZE y zoom de cámara. El resultado en pantalla es el mismo y pinta 4 veces menos en el iPad.

---

## 8. Prompts para Sonnet

Cada bloque se pega en una sesión nueva de Claude Code con Sonnet en la raíz de `gg-abyss`.

### Prompt para Sonnet, fase 0

````text
Vas a ejecutar la FASE F0 (Base) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo y tools/pixel_forja/docs/KIT_JUEGO.md.

Reglas:
- Solo la fase F0. Lo que veas de otras fases va a PLAN.md bajo "Notas para después".
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Arranca con el kit que está hoy en public/assets/kit. F0 no depende de nada de ASSETS_PENDIENTES.md.
- Escala entera desde ya, como dice la sección 3.2 de PLAN.md: zoom = max(1, floor(Hp / 400)) con Hp en pixeles físicos, cámara con zoom entero, nada fijo en 960 x 540.
- Los tests del mapa y del kit nunca usan cantidades exactas: leen el mapa y exigen "al menos".
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). No dibujes sprites en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja. Solo se permiten texturas técnicas: degradados para luces, ruido y un pixel para partículas. Si falta algo, anótalo en ASSETS_PENDIENTES.md con especificación exacta y usa el asset más parecido del kit.
- Todo texto en pantalla usa las fuentes bitmap del kit (manifest.ui.fuentes). Nada de fuentes web.
- La lógica va en src/logic/ con tests de Vitest. Phaser en src/scenes/ y src/game/. Atmósfera en src/fx/. Números en src/config/balance.ts.
- Usa las versiones de la sección 0 de PLAN.md. Si Playwright no encuentra su Chromium, usa executablePath '/opt/pw-browsers/chromium' cuando exista. No corras playwright install.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo abrir la sala del kit (?kit=1) y qué revisar
  - qué quedó pendiente
  - qué no pudiste verificar
- Nunca digas que algo funciona si no lo corriste.
````

### Prompt para Sonnet, fase 1a

````text
Vas a ejecutar la FASE F1a (Mundo vivo) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo, tools/pixel_forja/docs/KIT_JUEGO.md y tools/pixel_forja/scripts/visor/runtime.js entero: es la referencia exacta de la atmósfera y el juego tiene que verse igual o mejor.

Reglas:
- Solo la fase F1a. Lo que veas de otras fases va a PLAN.md bajo "Notas para después". No crees enemigos ni uses cofres, carteles o fogatas todavía.
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer, en especial cómo vas a armar la oscuridad con pozos de luz y los decorados por celdas. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). No dibujes sprites en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja. Solo se permiten texturas técnicas: degradados para luces, ruido y un pixel para partículas. Si falta algo, anótalo en ASSETS_PENDIENTES.md con especificación exacta y usa el asset más parecido del kit.
- Oscuridad final = clamp(noche + zona.oscuridad, 0, 0.6), noche 0.15 por defecto, tope 0.45 en modo peque. El farol de la heroína siempre encendido.
- Todo texto con las fuentes bitmap del kit, escala entera.
- La lógica va en src/logic/ con tests de Vitest. Phaser en src/scenes/ y src/game/. Atmósfera en src/fx/ con interruptor de calidad alta y baja.
- El mundo tiene que verse increíble: respeta la sección 2 de PLAN.md y captura todas las postales de la capa postales del mapa en docs/capturas/f1a/. Corre scripts/comparar-postales.ts y mira tú mismo cada par antes de cerrar. Si una postal del juego se ve peor que la del kit, arréglala o dilo con la razón.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo probarlo en la tablet (URL con ?heroe=, qué tocar y qué debería pasar)
  - las postales y tu opinión honesta de cada una contra la del kit
  - qué quedó pendiente
  - qué no pudiste verificar (el fps real en tablet no se puede medir aquí: dilo)
- Nunca digas que algo funciona si no lo corriste.
````

### Prompt para Sonnet, fase 1b

````text
Vas a ejecutar la FASE F1b (Título, jugadoras y guardado) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo y tools/pixel_forja/docs/KIT_JUEGO.md. Mira el código de F1a antes de tocar nada.

Reglas:
- Solo la fase F1b. Lo que veas de otras fases va a PLAN.md bajo "Notas para después".
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). No dibujes sprites en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja. Solo se permiten texturas técnicas: degradados para luces, ruido y un pixel para partículas. Si falta algo, anótalo en ASSETS_PENDIENTES.md con especificación exacta y usa el asset más parecido del kit.
- Alana tiene 5 años y casi no lee: cada botón y cada aviso lleva ícono y sonido. Las tarjetas salen del manifest: una ficha nueva en fichas/ tiene que aparecer sola.
- La lógica va en src/logic/ con tests de Vitest. Phaser en src/scenes/ y src/game/. Atmósfera en src/fx/.
- Captura las postales de la fase en docs/capturas/f1b/, más titulo.png y seleccion.png.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo probarlo con las niñas (qué tocar y qué debería pasar)
  - las postales
  - qué quedó pendiente
  - qué no pudiste verificar
- Nunca digas que algo funciona si no lo corriste.
````

### Prompt para Sonnet, fase 2

````text
Vas a ejecutar la FASE F2 (Combate) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo y tools/pixel_forja/docs/KIT_JUEGO.md. Mira el código de F1 antes de tocar nada.

Reglas:
- Solo la fase F2. Lo que veas de otras fases va a PLAN.md bajo "Notas para después".
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). No dibujes sprites en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja. Solo se permiten texturas técnicas: degradados para luces, ruido y un pixel para partículas. Si falta algo, anótalo en ASSETS_PENDIENTES.md con especificación exacta y usa el asset más parecido del kit. Para flecha, naturaleza e íconos de habilidad usa los reemplazos que dice ASSETS_PENDIENTES.md.
- Usa solo animaciones que existan en el manifest. Todos los números salen de src/config/balance.ts.
- Nadie pierde: al caer, Thor rescata a la heroína en la última fogata sin quitarle nada.
- La lógica va en src/logic/ con tests de Vitest. Phaser en src/scenes/ y src/game/. Atmósfera en src/fx/.
- Captura las postales de la fase en docs/capturas/f2/.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo probarlo con las niñas (qué tocar y qué debería pasar)
  - las postales
  - qué quedó pendiente
  - qué no pudiste verificar
- Nunca digas que algo funciona si no lo corriste.
````

### Prompt para Sonnet, fase 3

````text
Vas a ejecutar la FASE F3 (Botín) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo y tools/pixel_forja/docs/KIT_JUEGO.md (sección Botín e Interfaz). Mira el código de F2 antes de tocar nada.

Reglas:
- Solo la fase F3. Lo que veas de otras fases va a PLAN.md bajo "Notas para después".
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). No dibujes sprites en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja. Solo se permiten texturas técnicas. Si falta algo, anótalo en ASSETS_PENDIENTES.md con especificación exacta y usa el asset más parecido del kit.
- catalogo.json se usa tal cual. Las tablas, premios fijos y el subconjunto de stats están en PLAN.md sección 0 y 4. Equipar no pide nivel.
- La lógica va en src/logic/ con tests de Vitest. Phaser en src/scenes/ y src/game/.
- Captura las postales de la fase en docs/capturas/f3/.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo probarlo con las niñas (qué tocar y qué debería pasar)
  - las postales
  - qué quedó pendiente
  - qué no pudiste verificar
- Nunca digas que algo funciona si no lo corriste.
````

### Prompt para Sonnet, fase 4

````text
Vas a ejecutar la FASE F4 (El minotauro) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo y tools/pixel_forja/docs/KIT_JUEGO.md. Mira el código de F2 y F3 antes de tocar nada.

Reglas:
- Solo la fase F4. Lo que veas de otras fases va a PLAN.md bajo "Notas para después".
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer, en especial la máquina de estados del jefe. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). No dibujes sprites en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja. Solo se permiten texturas técnicas. Si falta algo, anótalo en ASSETS_PENDIENTES.md con especificación exacta y usa el asset más parecido del kit.
- Todo ataque grande se avisa 1.2 s antes (1.8 s en modo peque). El jefe nunca se cura.
- La lógica del jefe va en src/logic/jefe.ts con tests de Vitest, sin Phaser.
- Captura las postales de la fase en docs/capturas/f4/.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo probarlo con las niñas (qué tocar y qué debería pasar)
  - las postales
  - qué quedó pendiente
  - qué no pudiste verificar
- Nunca digas que algo funciona si no lo corriste.
````

### Prompt para Sonnet, fase 5

````text
Vas a ejecutar la FASE F5 (Pulido y deploy) de PLAN.md en este repo (gg-abyss). Lee primero CLAUDE.md, PLAN.md completo (incluidas las "Notas para después") y ASSETS_PENDIENTES.md.

Reglas:
- Solo la fase F5. Lo que veas de un mundo futuro va a PLAN.md bajo "Notas para después".
- Antes de codear, explica en 5 a 10 líneas cómo la vas a hacer. Si el plan no cuadra con el código o el kit real, dilo y propone el ajuste mínimo.
- Todo el arte y el audio sale del kit de PixelForja (public/assets/kit, vía manifest.json). Los íconos de la PWA también. No dibujes nada en código, no bajes assets, no edites public/assets/kit ni tools/pixel_forja.
- Lo que solo Rick puede hacer (deploy key en Netlify y GitHub, probar en el iPad y el Android) déjalo escrito paso a paso en el resumen.
- Captura las postales finales en docs/capturas/f5/.
- Commit por cada tarea que funcione, con mensaje claro en español. Al final: npm run typecheck, npm test, npm run build y npm run e2e en verde, y push.
- Cierra con un resumen corto:
  - qué se hizo
  - cómo instalar la app en el iPad y en el Android
  - las postales
  - qué quedó pendiente
  - qué no pudiste verificar
- Nunca digas que algo funciona si no lo corriste.
````
