# Encargo para PixelForja: Mundo 6, La Fragua de las Luces

Para la sesión que trabaja en `pixel_forja`. Este documento se entiende solo, sin leer el juego. La dirección completa del descenso está en `PLAN.md`, sección F12, del repo `gg-abyss`.

## Reglas de ramas (no se negocian)

- `pixel_forja` lo comparten dos proyectos. **Otro agente trabaja en `main` y en las ramas `claude/olimpico-*`.** Nada de eso se toca: ni commits, ni merges, ni PRs, ni borrar, ni rebase, ni force-push.
- Se trabaja solo en la rama `claude/abyss-mundo6`, que sale de `claude/abyss-mundo5` (de ahí sale hoy el kit de GG Abyss, en `cfa5d34` o después). Si la rama no existe, se crea desde esa.
- Push normal a `claude/abyss-mundo6` y nada más. Nunca `--force`.
- Si algo del taller hace falta cambiarlo en código compartido (el motor, el pintor), se cambia en esta rama, de forma que los mundos 1 a 5 regeneren idénticos.

## Contexto rápido

- GG Abyss es un juego tipo Diablo para Sophie (8) y Alana (5). Phaser 3, pixel art con zoom entero.
- El juego carga todo desde `public/assets/kit/manifest.json`, que arma `npm run kit` con `buildGameKit`. Lo que esté en el manifest el juego lo carga solo.
- Medidas: cuadro de 32 px. Heroínas, Thor y el mercader en celda 48. Enemigos en 48 o 64. Jefes en 128. Ocho direcciones, una fila por dirección en el orden de `direcciones`.
- Objetos con el formato de siempre (`w`, `h`, `apoyo`, `solido`/`solidos`, `luz`, `anims`, `capa`, `sombra`). La Ciudad (`mundos[4]`) y el Puerto (`mundos[3]`) son los mejores ejemplos.
- Nada de fotos de la familia. Créditos LPC al día. Los mundos 1 a 5 no pueden cambiar sin querer: regenerar el kit tiene que dar los mismos archivos de esos mundos (se verifica comparando).

## Lo que aprendimos de los mundos 4 y 5 (ya va pedido aquí)

- **La arena del jefe se piensa con el jefe.** Aquí la Dragona necesita lugar para moverse y cuatro surtidores en su sitio, con su palanca al lado.
- **Los puntos de luz que se mueven van cuadro por cuadro** (como la `antena` del pez y la `corona` del Rey): la boca de la Dragona y la jaula del farolero.
- **Las caras se tienen que leer a 48 px**: cabezas y ojos grandes, como en la pasada de pulido de la Ciudad.
- **Cada mecánica nueva trae su ícono redondo** para el botón de Alana, en `ui.habilidades`.
- **Cada mundo trae su portal** en `mundos[i].portal`.
- **Rendimiento:** la Ciudad ya es pesada. Este es el piso con más fuego: lava con pocos cuadros (4 a 6), nada de partículas horneadas en hojas grandes, y las luces chiquitas de las jaulas como luz de radio corto.

## La idea del piso

La escalera de la ciudad baja hasta la puerta grande con fuego del mural 5. Detrás hay una fragua del tamaño de una montaña: ríos lentos de lava, puentes de obsidiana, cadenas que cuelgan del techo y miles de jaulas chiquitas con luces adentro. **Son las luces que la Ladrona se fue robando piso por piso**: luciérnagas verdes del Bosque, velas de la Catedral, cristales de las Galerías, el oro del faro, los faroles de la ciudad. Aquí las funden para hacer fuego. Todo el lugar respira: unos fuelles gigantes soplan cada pocos segundos y con cada soplido las grietas del piso se ponen al rojo. Suben brasas, no cae nada.

**La luz quema.** La única luz es fuego, y el fuego calienta. Cerca del fuego se ve pero la heroína junta calor. La luz fría de las jaulas que se liberan alumbra sin calentar. Thor se moja en las fuentes frías y se sacude para enfriar.

Terror de cuento para Sophie: el piso más pesado hasta ahora (un lugar que respira, cadenas que se mecen con la luz del fuego, armaduras vacías que caminan, la Ladrona más cerca que nunca), sin sangre, sin caras de terror, sin sustos de golpe. Lo que ataca siempre se ve antes de pegar. Y bello: el contraste del rojo del fuego con los colores de las luces liberadas tiene que ser lo más lindo del juego, y la victoria (un río de luces que sube) el momento más grande.

**Calidad:** criterio premium en cada postal: tres planos (suelo, objetos y frente o fondo), un punto focal, luz y sombra en la misma pantalla, ningún objeto repetido igual en una pantalla y algo que se mueve (lava, brasas, cadenas, fuelles, jaulas que se mecen).

**Luz y sombras:** como en el Puerto y la Ciudad, sin sombras horneadas con dirección: cada objeto trae solo su sombra de contacto al pie. La luz es de la lava, los braseros, las grietas, las jaulas y la Dragona.

## Parte 1. Mapa `mundo6_fragua`

- **Tamaño:** 110 x 100 cuadros. Una caverna de fragua: piso de roca volcánica y obsidiana, ríos de lava que no se caminan, puentes de obsidiana y de cadenas, escaleras de basalto, el techo con jaulas que no se ve entero.
- **Paleta:**
  - Roca volcánica de `#0a0606` a `#4a3a36`, obsidiana con brillos violeta `#2a1e2e` a `#5a4a6a`.
  - Lava de `#5a1000` a `#ffb040`, con el corazón `#fff0a0`.
  - Grietas: apagadas `#2a1010`, aviso `#c04010`, al rojo `#ff7020`.
  - Hierro de cadenas, jaulas y faroleros de `#14100e` a `#6a5a50`, con óxido `#8a4a2a`.
  - Agua fría y escarcha celeste `#7ad0ff` a `#e0f6ff`.
  - Las luces liberadas, cada una con su mundo: verde Bosque `#9aff7a`, ámbar Catedral `#ffc070`, celeste Galerías `#8ae0ff`, oro faro `#ffe080`, oro Ciudad `#ffd890`.
  - La fragua apagada (después del jefe): la lava se vuelve piedra gris con vetas tibias `#a05030`.
- **Zonas:**

| Zona | Oscuridad | Bruma | Partículas | Ambiente | Momento |
|---|---|---|---|---|---|
| La Escalera de Ceniza | 0.80 | 0.35 | brasas | fragua | Llega por el portal. Primera fuente fría: se enseña el calor y que Thor se moja |
| El Río de Lava | 0.88 | 0.40 | brasas | lava | Puentes sobre la lava, las primeras grietas que respiran y las primeras jaulas |
| Las Jaulas Colgantes | 0.90 | 0.45 | brasas | jaulas | El techo lleno de jaulas, los faroleros cargando las suyas. El pedazo del mural `mural_6` |
| Los Fuelles | 0.88 | 0.50 | brasas | fuelles | Los fuelles gigantes que marcan el ritmo de todo el piso. Muchas grietas |
| El Bosque de Ceniza | 0.92 | 0.55 | ceniza | bosque_ceniza | Rama opcional: árboles de carbón con brasas como hojas, hollines y un secreto de Thor |
| La Cárcel de las Luces | 0.90 | 0.45 | brasas | carcel | Rama opcional: celdas de jaulas grandes, el minijefe El Carcelero y su cofre dorado |
| El Horno | 0.88 | 0.55 | brasas | horno | La boca enorme del horno, puentes de cadena sobre el fuego |
| El Corazón de la Fragua | 0.90 | 0.40 | brasas | jefe | La arena de la Dragona. Detrás, la Puerta Negra cerrada |

- **Contenido:** 5 fuentes frías (hacen de fogata), al menos 40 jaulas repartidas en todas las zonas (al menos 4 por zona), charcos de escarcha (al menos 2 por zona), al menos 3 ramas opcionales que vuelvan al camino principal, al menos 2 secretos para el olfato de Thor, 6 cofres o más, postales en cada zona.
- **Entidades:**
  - `portal_llegada` (con el portal del mundo, ver Parte 7) y `portal_volver` (al mundo5).
  - 5 `punto_guardado` con `fuente_fria: true` y `objeto: fuente_fria`.
  - **`jaula`**: cada jaula con `luz` = `bosque`, `catedral`, `galerias`, `faro` o `ciudad` (mezcladas), y `zona` con el nombre exacto de su zona. Cuelgan a una altura que la heroína alcanza a pegarle al candado (el juego toma el punto de la entidad como el candado). Dentro de una celda de 64 de la entidad no hay paredes.
  - **`charco_frio`**: los charcos de escarcha donde Thor se moja (también en la arena del jefe, uno o dos en el borde).
  - **`grieta`**: los parches de grietas que respiran, como rectángulos (`width` y `height` en múltiplos de 32), con `fase` de 0 a 1 para que no se prendan todas a la vez. Siempre caminables. Ningún camino obligado cruza más de 3 cuadros de grieta seguidos sin un rodeo o una jaula cerca.
  - **`fuelle`**: los fuelles gigantes, cada uno con `zona`. Marcan el ritmo: el juego hace soplar a todos juntos.
  - **`lava`**: la lava va en la capa de agua (ver abajo), no como entidad.
  - Los enemigos: `hollin`, `salamandra_brasa`, `farolero_cadenas` (los faroleros con `jaula: true` llevan una y cuentan como jaula). El minijefe `carcelero` con `elite: true` y `nombre: El Carcelero`, en una sala de La Cárcel de las Luces con **al menos 8 `jaula` con `carcel: true`** alrededor (se abren todas juntas al vencerlo).
  - `arena_jefe` (radio 224) en El Corazón de la Fragua, el `jefe` con `enemigo: dragona_brasa`, `nombre: La Dragona de Brasa` y `titulo` a gusto. **4 `surtidor`** dentro de la arena, a unos 130 px del centro, cada uno con su `palanca` (otra entidad con `surtidor` = id del surtidor) a unos 48 px hacia afuera. Las **cadenas de la Dragona**: 4 `cadena` del borde de la arena a la Dragona (decoración). `portal_jefe` con `destino: mundo7`.
  - `puerta_negra`: la Puerta Negra detrás de la arena, sólida, cerrada.
  - `mural` con `pieza: 6`, `figura` en 3 o 4 lugares (la Ladrona cargando jaulas, ver Parte 2), una con `alto: true` en la Puerta Negra.
- **Lava:** va en la capa `agua` del mapa, con su propia hoja (`mundos[5].agua`) y su `espuma` (aquí es el borde que brilla, 4 cuadros animados). Sin `reflejo` en la lava. La lava es la luz grande del piso: el juego pone luz a lo largo de sus orillas.
- **Prueba del mapa:** desde cualquier cuadro caminable hay camino a una fuente fría. La arena se camina entera alrededor de la Dragona y se llega a las 4 palancas. Cada `jaula` se puede alcanzar caminando.

## Parte 2. Objetos

| Recurso | Tamaño | Cuadros y fps | Apoyo / sólido | Uso |
|---|---|---|---|---|
| `fuente_fria` | 96 x 96 | `idle` 6 a 6 fps (el agua se mueve, la escarcha brilla) | sólida 64 x 24 | La fogata del piso, con luz celeste de radio 220 |
| `charco_frio` | 64 x 32 | `idle` 4 a 4 fps | capa suelo, sin sólido | Donde Thor se moja. Luz celeste chiquita, radio 60 |
| `jaula_luz_<luz>` (las 5 luces) | 32 x 64 | `cerrada` 6 a 6 fps (la luz late adentro y la jaula se mece), `abrir` 10 a 12 fps (salta el candado, se abre la puertita, la luz sale), `vacia` 2 a 2 fps (se mece) | apoyo arriba, en la cadena: [16, 4]. Sin sólido | Cuelga de una cadena del techo. **`candado`: [x, y] desde el apoyo** (donde se le pega). Cerrada con luz chiquita de su color, radio 40 |
| `luz_libre_<luz>` | 24 x 24 | `idle` 6 a 8 fps (flota y respira) | sin sólido | La luz liberada que queda flotando. Luz de su color, radio 260 |
| `grieta_brasa` | 64 x 64 (y variantes `_0..3`) | `apagada` 1, `aviso` 6 a 10 fps, `caliente` 4 a 8 fps | capa suelo | Se repite en los parches de `grieta`. Que las variantes encajen entre sí |
| `fuelle_gigante_0..1` | 192 x 160 | `quieto` 1, `soplar` 12 a 10 fps (se aplasta y sale un golpe de aire y brasas) | sólido en la base | El ritmo del piso |
| `brasero_0..2` | 32 x 64 | 6 a 8 fps | sólido 16 x 8 | Fuego con luz naranja de radio 180 |
| `surtidor` | 64 x 64 | `quieto` 1, `chorro` 10 a 12 fps (vapor y agua hacia arriba, 128 de alto si hace falta como `surtidor_chorro` aparte) | capa suelo, sin sólido | Los de la arena |
| `palanca` | 32 x 48 | `arriba` 1, `tirar` 8 a 10 fps | sólido chico | Al lado de cada surtidor |
| `cadena_dragona` | 32 x 32 | 1 | capa suelo | Eslabones gruesos que se repiten de la Dragona al borde |
| `cadena_colgante_0..2`, `jaulas_frente_0..1`, `humo_frente_0..1` | 128 x 128 | 2 a 4 fps (se mecen) | `capa: "frente"` | Primer plano |
| `fondo_fragua_lejos_0..2` | 512 x 256 | 1 | `capa: "fondo"` | Fuegos lejanos, chimeneas y cadenas que se pierden en lo oscuro |
| `arbol_ceniza_0..3` | 96 x 128 | `idle` 4 a 4 fps (brasas que titilan en las ramas) | sólido en el tronco | El Bosque de Ceniza. Que recuerde al Bosque del piso 1, quemado y quieto |
| `yunque`, `pila_carbon_0..1`, `molde_0..1`, `carretilla_fragua` | a gusto | 1 | sólidos | Utilería de fragua |
| `puerta_negra` | 256 x 256 | `cerrada` 1, `latido` 4 a 2 fps (el negro de adentro respira apenas) | sólida | La Puerta Negra al piso 7. Negra de verdad, con un marco de hierro y frío que sale. Sin ojos ni caras: solo oscuridad |
| La fragua apagada | según cada objeto | `dormido` en los fuelles, `apagado` en los braseros | igual que el objeto | Lo que cambia al vencer a la Dragona: los fuelles quietos, los braseros en brasa tibia y la lava hecha piedra. Para la lava, otra hoja `mundos[5].agua_apagada` con el mismo formato que `agua`, o lo que sea más simple, avisando |
| `mural_6` | 128 x 96 | 1 | en una pared de Las Jaulas Colgantes | El sexto pedazo: la figura entrando por una puerta negra donde solo se ven dos ojos rojos grandes muy arriba. Sin texto |
| `figura_cargadora` | 48 x 64 | `idle` 4 a 4 fps (camina despacio con jaulas colgadas de un palo), `irse` 8 a 10 fps (se va en humo) | sin sólido | La Ladrona cargando jaulas. Ojos rojos chiquitos |

**Calcomanías:** escoria, ceniza acumulada, marcas de carretilla, charquitos de metal frío, eslabones sueltos.

## Parte 3. Enemigos

| Recurso | Celda | Animaciones | Uso |
|---|---|---|---|
| `hollin` | 32 | `idle` (rebota), `walk` (rueda y salta), `attack` (salta a pegarse, 4 cuadros de preparación en que se agacha), `pegado` (encima de la heroína, en bucle, chiquito), `hit`, `die` (se deshace en polvo negro y una chispita) | Bichito de hollín redondo y peludo con dos ojitos blancos. Simpático y un poco inquietante en grupo. No vuela |
| `salamandra_brasa` | 48 | `idle`, `walk` (rápida, deja brasitas), `attack` (escupe: 4 cuadros de preparación con la boca brillando), `piedra` (mojada: negra y quieta, humea), `hit`, `die` (se apaga y queda una piedrita tibia) | Lagartija de brasa con ojos grandes. Que se lea en lo oscuro por su brillo |
| `proyectil_brasa_<dir>`, `impacto_brasa` | 16 y 32 | 4 y 6 cuadros | | La brasa que escupe en las 8 direcciones |
| `rastro_brasa` | 32 x 32 | 6 cuadros (se apaga) | capa suelo | El rastro que deja la salamandra |
| `farolero_cadenas` | 64 | `idle`, `walk` (lento, la jaula se mece en la espalda), `attack` (puñetazo de hierro), `attack_heavy` (gira la cadena: 7 cuadros o más de aviso), `hit`, `die` (la armadura se desarma en piezas y la jaula cae y se abre). **`jaula`: [x, y] por dirección y por cuadro** desde el pivote | Armadura vacía con dos brasas por ojos y una jaula de luz a la espalda. Que dé tensión, sin cara |
| `aviso_cadena` | 128 x 64 | 8 cuadros | capa suelo | El anillo donde va a girar la cadena |
| `carcelero` (minijefe) | 64 | `idle`, `walk`, `attack` (golpe de llavero), `attack_heavy` (lanza la cadena en línea: 7 cuadros o más de aviso), `jalar` (se jala hacia donde cayó la cadena), `warcry` (portazo: golpea el piso), `hit`, `die` (se le cae el aro de llaves, se quita el casco y queda un viejito herrero que saluda) | Carcelero de hierro enorme con aro de llaves. `elite: true` |
| `aviso_linea_cadena` | 32 x 32 | 6 cuadros, en bucle | capa suelo | Se repite en línea donde va a caer la cadena |
| `vapor` | 64 x 64 | 8 cuadros | | El vapor de cuando Thor se sacude cerca del fuego o el surtidor pega |

## Parte 4. Jefe: la Dragona de Brasa

**`dragona_brasa`**, celda 128, con todo lo de los jefes grandes (eventos, `aviso`, `elevacion`, pivote medido).

- **Animaciones:**
  - `idle` (respira, el pecho brilla con cada respiro, las cadenas pesan).
  - `walk` (pasos pesados, arrastra las cadenas).
  - `attack` (zarpazo, 6 cuadros o más de preparación).
  - `coletazo` (gira y barre con la cola medio círculo detrás, 6 de preparación).
  - `aliento` (echa fuego en línea delante: toma aire con el pecho al rojo 8 cuadros o más, después el chorro).
  - `encendida` (fase 2: cubierta de llamas, en bucle, para cuando está blindada; puede ser `idle` con fuego).
  - `warcry` (ruge al cielo, sale humo: llama hollines).
  - `apagada` (echada en el piso humeando, las escamas grises: ahí se le pega).
  - `hit`.
  - `die` (se libera: se rompen las cadenas, el fuego pasa de rojo a dorado, se encoge y queda una dragoncita dorada que ronronea y se enrosca).
- **Look:** enorme, de escamas rojo oscuro y brasas en las juntas, ojos grandes ámbar, nada de dientes a la vista. Grillete en el cuello y las patas. Imponente pero de cuento: más triste que mala.
- **`boca`:** en cada animación, **[x, y] por dirección y por cuadro** desde el pivote (como la `corona` del Rey), o `null` si no se ve. Para la luz de la boca y el origen del aliento.
- **`luz_boca`:** `{ color, radius }` en el personaje.
- **fx:**
  - `aviso_aliento`: 32 x 32, 6 cuadros en bucle, capa suelo. Se repite en línea donde va el fuego.
  - `fuego_piso`: 32 x 32, 8 cuadros en bucle. El piso ardiendo que queda después del aliento.
  - `aviso_cola`: 192 x 96, 8 cuadros, capa suelo. El medio círculo del coletazo.
  - `vapor_grande`: 96 x 128, 10 cuadros. El chorro del surtidor que la apaga.

## Parte 5. Audio

**El piso respira.** Casi sin música: el soplido de los fuelles marca el ritmo. La música entra solo en las peleas y en la liberación.

- `ambiente_fragua`: 20 s en bucle. Lava que burbujea grave, cadenas lejanas, crujido de roca caliente.
- `ambiente_jaulas`: cadenas que se mecen y, metidos bajito, los sonidos de los mundos de arriba (un grillo, una campanita, el eco de un cristal, una ola, la cajita de música), como recuerdos.
- `ambiente_bosque_ceniza`: brasas que crepitan y un viento seco, muy bajito.
- `ambiente_horno`: el rugido sordo del horno, grave, lejos.
- `musica_jefe_dragona`: grande y triste, con tambores de fragua, que se vuelve épica. En bucle.
- `musica_carcelero`: martillos y cadenas con ritmo, corta, en bucle.
- `musica_liberacion`: el tema de victoria más grande hasta ahora. Las luces que suben: con un pedacito de la música de cada mundo de arriba, 30 a 40 s.
- **Efectos:**
  - `fuelle_sopla` (un soplido enorme y lento que avisa: el juego lo pone 1 s antes de que las grietas se prendan) y `grieta_rojo` (un siseo).
  - `calor_sube` (un latido suave cuando el calor está alto) y `acalorada` (un resoplido de niña, tierno).
  - `jaula_abre` (un candado que salta y una campanita) y `luz_libre` (un suspiro alegre que sube, uno por cada tipo de luz si se puede).
  - `thor_mojarse` (chapuzón chico) y `thor_sacude` (perro sacudiéndose con gotas).
  - `hollin_pega` (un pff suave) y `hollin_suelta`.
  - `salamandra_escupe`, `salamandra_piedra` (un tsss de vapor).
  - `cadena_gira`, `farolero_paso` (hierro hueco que camina).
  - `carcelero_llaves`, `carcelero_portazo`.
  - `dragona_ruge` (grave, no aterrador), `dragona_aliento`, `surtidor_chorro`, `palanca`, `dragona_apagada` (un tsss largo y un suspiro), `cadenas_rompen`.
  - `puerta_negra` (un viento frío que sale, muy bajito).
- **Reglas:** todo bajito, con pico de 0.5. Nada de gritos ni de sustos de golpe. Las zonas con `musica: ninguna` como en la Ciudad, El Corazón con `musica: jefe_dragona` y `musica_victoria: liberacion`, La Cárcel con `musica_pelea: carcelero`.

## Parte 6. Íconos para Alana

En `ui.habilidades`, 40 x 40, redondos, con el estilo de los otros y aro dorado. Que se lean a 40 y a 80 px.

- `sacudir`: Thor sacudiéndose con gotas celestes alrededor. Y `sacudir_seco` igual en gris (sin agua).
- `calor`: una llamita roja dentro de un termómetro, para el medidor de calor.
- `jaula`: una jaula abierta con una luz que sale, para la cuenta de luces liberadas.
- `palanca`: una mano tirando de una palanca con vapor, para los surtidores de la arena.

## Parte 7. El portal del mundo

- `portal_brasa` en el formato de los portales nuevos (96 x 128, `girar`, `abrir`, `cerrar`, `arco`, `remolino`, `apagado`). Arco de obsidiana con grietas naranjas y un remolino rojo y dorado. En `mundos[5].portal`.

## Cómo entregar

- **Commits:** uno por parte, con el kit regenerado y los tests del taller en verde. Push solo a `claude/abyss-mundo6` al terminar cada parte, así el juego va integrando.
- **Mundos anteriores:** regenerar no puede cambiar ningún archivo de los mundos 1 a 5. Se verifica regenerando y comparando.
- **Lámina de revisión** por parte:
  - el mapa entero chiquito, con las jaulas y las grietas marcadas;
  - una postal por zona, con la oscuridad y las luces como se ven en el juego;
  - las cinco jaulas cerradas, abriéndose y su luz libre lado a lado;
  - las grietas en sus tres estados;
  - los enemigos al lado de la heroína;
  - la Dragona al lado de la heroína, encendida y apagada;
  - la Puerta Negra;
  - el portal brasa.
- **Si algo no se puede:** se dice qué y por qué. No se cambia el pedido por algo más fácil sin avisar.
- **Al terminar:** un resumen corto de lo entregado, con los nombres exactos de lo que quedó en el manifest y lo que falte, en `docs/entregas/abyss_mundo6.md` de `pixel_forja`. Y un aviso a la sesión del juego con el hash.
