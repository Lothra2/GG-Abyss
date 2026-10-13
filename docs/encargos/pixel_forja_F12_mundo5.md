# Encargo para PixelForja: Mundo 5, La Ciudad Dormida

Para la sesión que trabaja en `pixel_forja`. Este documento se entiende solo, sin leer el juego. La dirección completa del descenso está en `PLAN.md`, sección F12, del repo `gg-abyss`.

## Reglas de ramas (no se negocian)

- `pixel_forja` lo comparten dos proyectos. **Otro agente trabaja en `main` y en las ramas `claude/olimpico-*`.** Nada de eso se toca: ni commits, ni merges, ni PRs, ni borrar, ni rebase, ni force-push.
- Se trabaja solo en la rama `claude/abyss-mundo5`, que sale de `claude/abyss-mundo4` (de ahí sale hoy el kit de GG Abyss, en `243c319` o después). Si la rama no existe, se crea desde esa.
- Push normal a `claude/abyss-mundo5` y nada más. Nunca `--force`.
- Si algo del taller hace falta cambiarlo en código compartido (el motor, el pintor), se cambia en esta rama, de forma que los mundos 1 a 4 regeneren idénticos.

## Contexto rápido

- GG Abyss es un juego tipo Diablo para Sophie (8) y Alana (5). Phaser 3, pixel art con zoom entero.
- El juego carga todo desde `public/assets/kit/manifest.json`, que arma `npm run kit` con `buildGameKit`. Lo que esté en el manifest el juego lo carga solo.
- Medidas: cuadro de 32 px. Heroínas, Thor y el mercader en celda 48. Enemigos en 48 o 64. Jefes en 128. Ocho direcciones, una fila por dirección en el orden de `direcciones`.
- Objetos con el formato de siempre (`w`, `h`, `apoyo`, `solido`/`solidos`, `luz`, `anims`, `capa`, `sombra`). Los del Puerto (`mundos[3]`) son el mejor ejemplo.
- Nada de fotos de la familia. Créditos LPC al día. Los mundos 1 a 4 no pueden cambiar sin querer: regenerar el kit tiene que dar los mismos archivos de esos mundos (se verifica comparando).

## Lo que aprendimos del Mundo 4 (ya va pedido aquí)

- **La arena del jefe se piensa con el jefe.** El Pez Farol nadaba sobre piedra hasta que la arena pasó a ser una poza. El trono del Rey es un salón con lugar para pelear alrededor y las cuatro lámparas en su sitio.
- **Los puntos de luz que se mueven van cuadro por cuadro** (como la `antena` del pez): la corona del Rey y el farolito de la Ladrona.
- **Cada mecánica nueva trae su ícono redondo** para el botón de Alana, en `ui.habilidades`.
- **Cada mundo trae su portal** en `mundos[i].portal`.

## La idea del piso

Debajo del puerto hay una ciudad de piedra enorme y hermosa: plazas, fuentes, una torre del reloj, un palacio. Toda la gente quedó dormida de piedra en medio de lo que hacía: el panadero con la pala, niños jugando a la ronda, músicos con sus instrumentos, una señora regando flores. Silencio total. Cae polvo de sueño fino y lila.

**La luz te la roban.** Cada barrio tiene un farol de plaza apagado: la heroína lo prende y el barrio entero se aclara. La Ladrona (la figura de los ojos rojos, ahora con un farolito en la mano) aparece y les chupa la luz. Si llega a robarla, la luz se rompe en tres chispas que Thor rastrea. Las estatuas sonámbulas solo se mueven a oscuras.

Terror de cuento para Sophie: inquietante de verdad (una ciudad entera congelada, ojos que se prenden en lo oscuro), sin sangre, sin caras de terror, sin sustos de golpe. Lo que ataca siempre se ve antes de pegar. Y bello: tiene que ser el mundo más lindo hasta ahora, con una victoria de cuento donde la ciudad despierta.

**Calidad:** criterio premium en cada postal: tres planos (suelo, objetos y frente o fondo), un punto focal, luz y sombra en la misma pantalla, ningún objeto repetido igual en una pantalla y algo que se mueve (polvo de sueño, fuentes, banderines, el reloj).

**Luz y sombras:** como en el Puerto, sin sombras horneadas con dirección: cada objeto trae solo su sombra de contacto al pie. La luz es de los faroles de plaza, las lámparas del palacio y la corona del Rey.

## Parte 1. Mapa `mundo5_ciudad`

- **Tamaño:** 110 x 100 cuadros. Una ciudad bajo tierra: calles empedradas, plazas con fuente, escaleras entre niveles, puentes de piedra sobre el abismo, la caverna arriba que no se ve.
- **Paleta:**
  - Piedra de la ciudad gris azulada, de `#0c1018` a `#6a7488`, con musgo plateado `#9aa8b8`.
  - Estatuas de piedra clara, de `#3a4050` a `#c8ccd8`.
  - Polvo de sueño lila `#b89aff`.
  - Luz de los faroles de plaza dorada y cálida `#ffd890`.
  - Ojos de los sonámbulos celeste frío `#7ad0ff`.
  - La ciudad despierta (después del jefe): colores de verdad en ropas y toldos (rojos, verdes, amarillos suaves) y ventanas `#ffc070`.
- **Zonas:**

| Zona | Oscuridad | Bruma | Partículas | Ambiente | Momento |
|---|---|---|---|---|---|
| La Puerta de la Ciudad | 0.75 | 0.40 | polvo de sueño | ciudad | Llega por el portal. Primer farol de plaza: se enseña a prenderlo. Estatuas de guardias dormidos en la puerta |
| La Calle de los Panaderos | 0.85 | 0.45 | polvo de sueño | ciudad | Calle angosta, estatuas del panadero, la señora con la canasta, banderines rotos (capa `frente`) |
| La Plaza de la Fuente | 0.85 | 0.45 | polvo de sueño | ciudad | Plaza grande con la fuente, puestos dormidos, niños de piedra jugando a la ronda. Farol de plaza |
| El Barrio de los Músicos | 0.85 | 0.50 | polvo de sueño | cajita | La cajita de música que toca sola. Estatuas de músicos. El pedazo del mural `mural_5` |
| Los Jardines de Piedra | 0.85 | 0.55 | polvo de sueño | jardin | Laberinto de setos de piedra con flores de piedra. Rama opcional, secreto de Thor |
| La Torre del Reloj | 0.85 | 0.45 | polvo de sueño | reloj | Rama opcional: el minijefe, El Relojero, y su cofre dorado |
| El Puente de los Faroles | 0.85 | 0.60 | polvo de sueño | abismo | Puente largo sobre el abismo con faroles muertos y gárgolas posadas |
| El Palacio Dormido | 0.90 | 0.40 | polvo de sueño | jefe | Patio y sala del trono: la arena del Rey de Piedra |

- **Contenido:** 5 faroles de plaza (uno por barrio grande, hacen de fogata), al menos 3 ramas opcionales que vuelvan al camino principal, al menos 2 secretos para el olfato de Thor, 6 cofres o más, postales en cada zona.
- **Entidades:**
  - `portal_llegada` (con el portal del mundo, ver Parte 7) y `portal_volver` (al mundo4).
  - 5 `punto_guardado` con `farol_plaza: true` y `objeto: farol_plaza`, y al lado la entidad `farol_plaza` (el poste, `punto` = id del punto de guardado, `barrio` = el nombre exacto de la zona que alumbra).
  - **`chispa`**: puntos donde pueden caer las chispas de la luz robada, **al menos 6 por barrio con farol**, con `barrio` = el nombre de la zona. Caminables y lejos de las paredes. El juego elige tres.
  - **`figura`**: los puntos de la Ladrona, uno o dos por barrio con farol, con `barrio`. Uno con `alto: true` en el balcón del palacio.
  - **`estatua`**: los ciudadanos dormidos de decoración, con `variante` (ver Parte 2). Son sólidos. Al vencer al jefe despiertan.
  - Los enemigos: `sonambulo_piedra`, `gargola_dormida`, `duende_sueno`. El minijefe `relojero` con `elite: true` y `nombre: El Relojero`.
  - `arena_jefe` (radio 208) en la sala del trono, el `jefe` con `enemigo: rey_de_piedra`, `nombre: El Rey de Piedra` y `titulo` a gusto. **4 `lampara_trono`** alrededor de la arena (a unos 150 px del centro, en cruz o en diagonal). `portal_jefe` con `destino: mundo6`.
  - `mural` con `pieza: 5`, `cajita_musica` en el Barrio de los Músicos.
- **Prueba del mapa:** desde cualquier cuadro caminable hay camino a un farol de plaza. La sala del trono se camina entera alrededor del jefe (el Rey no se mueve mucho, pelea cerca del trono).

## Parte 2. Objetos

| Recurso | Tamaño | Cuadros y fps | Apoyo / sólido | Uso |
|---|---|---|---|---|
| `farol_plaza_apagado`, `farol_plaza_prendido` | 48 x 128 | 1, y 6 a 8 fps (la llama late) | [24, 124] / sólido 16 x 8 | El farol grande de cada barrio. Prendido con luz dorada de radio 320 |
| `farol_plaza_prenderse` | 48 x 128 | 10 a 14 fps | igual | Se prende: la llama nace y sube un anillo de luz. Se toca una vez |
| `farol_plaza_robado` | 48 x 128 | 8 a 10 fps | igual | La luz se va en un hilo hacia arriba y el vidrio queda negro. Se toca una vez |
| `chispa_luz` | 16 x 16 | 6 a 8 fps (flota y titila) | sin sólido, luz de radio 50 | Las tres chispas de la luz robada |
| `estatua_ciudadano_0..7` | 48 x 64 | `dormida` 1, `despertar` 10 a 12 fps, `despierta` 4 a 4 fps | [24, 60] / sólido 16 x 8 | Panadero con pala, señora con canasta, dos niños de la ronda, músico con violín, músico con tambor, guardia con lanza, señor leyendo. Dormidas: piedra clara con los ojos cerrados. Despertar: se estiran, bostezan, la piedra se cae como polvo y queda la persona de colores. Despierta: respiran y saludan |
| `casa_ciudad_0..9` | 128 x 160 | `dormida` 1, `despierta` 1 (las ventanas prendidas) | sólidas, apoyo en el pie de la fachada | Fachadas de piedra, todas distintas |
| `fuente_plaza` | 96 x 96 | `quieta` 1, `corre` 6 a 8 fps | sólida 64 x 24 | La fuente seca que vuelve a correr al final |
| `torre_reloj` | 128 x 288 | `parado` 1, `andando` 4 a 2 fps (las agujas) | sólida 96 x 32 | La torre del minijefe |
| `trono_rey` | 128 x 128 | 1 | sólido | El trono vacío detrás del Rey |
| `lampara_trono_apagada`, `lampara_trono_prendida` | 32 x 96 | 1, y 6 a 8 fps | [16, 92] / sólido 12 x 6 | Las cuatro del salón. Prendida con luz de radio 200 |
| `lampara_trono_prenderse` | 32 x 96 | 10 a 12 fps | igual | Se toca una vez |
| `cajita_musica` | 32 x 32 | 6 a 6 fps (la bailarina gira) | sólido chico | La que toca la canción de cuna |
| `seto_piedra_0..3`, `flor_piedra_0..3` | 64 x 64, 32 x 32 | 1 | sólidos los setos | Los jardines |
| `banderines_rotos_0..1`, `arco_calle_0..1`, `lampara_colgante_0..1` | 128 x 96 | 2 a 2 fps (se mecen) | `capa: "frente"` | Primer plano |
| `fondo_ciudad_lejos_0..2` | 512 x 256 | 1 | `capa: "fondo"` | Torres y cúpulas que se pierden en la caverna, con alguna ventana muerta |
| `mural_5` | 128 x 96 | 1 | en una pared del Barrio de los Músicos | El quinto pedazo: la figura bajando la luz de la ciudad por una escalera hacia una puerta grande con fuego. Sin texto |
| `figura_ladrona` | 48 x 64 | `idle` 4 a 4 fps, `robar` 8 a 8 fps (en bucle: levanta el farolito y la luz le llega en un hilo), `irse` 8 a 10 fps (se va en humo) | sin sólido, luz roja chiquita en los ojos | La figura de los ojos rojos con un farolito en la mano. **`farolito`: [x, y] por cuadro** de cada anim, desde el apoyo, para que el juego dibuje el hilo de luz hasta ahí |

**Calcomanías:** adoquines rotos, polvo de sueño acumulado, pétalos de piedra, charcos secos, marcas de tiza de una rayuela.

## Parte 3. Enemigos

| Recurso | Celda | Animaciones | Uso |
|---|---|---|---|
| `sonambulo_piedra` | 48 | `quieto` (piedra, ojos cerrados), `idle`, `walk` (arrastra los pies, lento), `attack` (empujón con las dos manos, 4 cuadros de preparación en los que **le brillan los ojos celeste**), `hit`, `die` (se desmorona en polvo y queda una florcita de piedra) | Ciudadano de piedra sonámbulo. En la luz el juego lo deja en `quieto`. Que dé tensión y no terror: ojos que se prenden suave, sin dientes ni garras |
| `gargola_dormida` | 48 | `posada` (piedra, quieta), `despertar`, `walk` (vuela), `attack` (picada, 6 cuadros de preparación arriba), `hit`, `die` (cae y se vuelve piedra rota). `vuela: true` | Gárgola chica, más simpática que fea. Posada parece una estatua más |
| `sombra_picada` | 48 x 24 | 6 cuadros que crecen | capa suelo | El aviso de la picada en el piso |
| `duende_sueno` | 48 | `idle`, `walk`, `attack` (tira arena), `hit`, `die` (se queda dormido y desaparece en polvo lila) | Chiquito, gorro de dormir largo, bolsa de arena. Dormilón, no malo |
| `proyectil_arena_<dir>`, `impacto_arena` | 16 y 32 | 4 y 6 cuadros | | La arena de sueño en las 8 direcciones |
| `relojero` (minijefe) | 64 | `idle`, `walk`, `attack` (llave), `attack_heavy` (levanta la llave, 7 cuadros o más de aviso), `warcry` (da cuerda: suena tic tac), `hit`, `die` (se libera: queda un relojero viejo de verdad que se arregla los anteojos y saluda) | Relojero de piedra con una llave de dar cuerda gigante. `elite: true` |
| `aviso_aguja` | 32 x 32 | 6 cuadros, en bucle | capa suelo | Se repite en línea: la aguja que va a barrer girando |

## Parte 4. Jefe: el Rey de Piedra

**`rey_de_piedra`**, celda 128, con todo lo de los jefes grandes (eventos, `aviso`, `elevacion`, pivote medido).

- **Animaciones:**
  - `idle` (dormido de pie, respira lento, la corona brilla).
  - `walk` (pasos pesados).
  - `attack` (el puño cae, 6 cuadros o más de preparación).
  - `attack_heavy` (pisotón: levanta el pie, 6 o más de aviso, `elevacion` si salta).
  - `barrido` (el brazo barre en línea delante de él, 6 de preparación).
  - `warcry` (canta la canción de cuna: abre la boca, salen notas de piedra).
  - `aturdido` (de rodillas, con las grietas brillando dorado: ahí se le pega).
  - `hit`.
  - `die` (se libera: la corona se rompe y la luz sale volando hacia arriba, la piedra se le cae como polvo y queda un rey viejito y bonachón que bosteza, se estira y saluda).
- **Look:** enorme, de piedra con musgo plateado, barba de piedra, ojos cerrados como dormido, y la corona con la luz robada de la ciudad, que es lo más brillante de la pantalla. Imponente pero de cuento.
- **`corona`:** en cada animación, **[x, y] por dirección y por cuadro** desde el pivote (como la `antena` del Pez Farol), o `null` si no se ve. En `die` hasta el cuadro donde se rompe.
- **`luz_corona`:** `{ color, radius }` en el personaje (como `luz_antena`).
- **fx:**
  - `aviso_puno`: 96 x 48, 8 cuadros, capa suelo. Donde cae el puño.
  - `grieta_luz`: 64 x 64, 6 cuadros. Brillo de las grietas cuando está aturdido.
  - `nota_cuna`: 16 x 16, 6 cuadros. Las notas de la canción que flotan.

## Parte 5. Audio

**Casi silencio en el piso.** La música entra solo en las peleas y en el despertar.

- `ambiente_ciudad`: 20 s en bucle. Viento entre calles vacías y un tic tac lejano.
- `ambiente_cajita`: la cajita de música con la canción de cuna, lejana y un poco desafinada, en bucle. Tierna y triste, sin dar miedo.
- `ambiente_jardin`: hojas de piedra que rozan, muy bajito.
- `ambiente_reloj`: el tic tac cerca y el mecanismo grande.
- `musica_jefe_rey`: grave y lenta, con la canción de cuna metida adentro, que se vuelve marcha. En bucle.
- `musica_relojero`: tic tac que acelera, corta, en bucle.
- `musica_despertar`: el tema de victoria. Campanas alegres, la canción de cuna en tono feliz y la ciudad que despierta, 30 s.
- **Efectos:**
  - `farol_plaza_prender` (un fwump cálido) y `luz_robada` (un suspiro que baja y se apaga).
  - `chispa_recoger` (un cristalito).
  - `figura_irse` (el de las Galerías sirve).
  - `estatua_paso` (piedra que se arrastra suave) y `estatua_quieta` (un crack chiquito al congelarse).
  - `gargola_despierta`, `gargola_picada`.
  - `arena_sueno` (un shhh) y `bostezo` (de niña, tierno).
  - `reloj_campanada` y `aguja_barre`.
  - `rey_puno`, `rey_pisoton`, `rey_canta` (un murmullo grave, no voz) y `corona_rompe`.
  - `ciudad_despierta` (campanas, gente que se estira y ríe bajito, sin palabras).
- **Reglas:** todo bajito, con pico de 0.5. Nada de gritos ni de sustos de golpe. Las zonas con `musica: ninguna` como en el Puerto, el Palacio con `musica: jefe_rey` y `musica_victoria: despertar`, la Torre del Reloj con `musica_pelea: relojero`.

## Parte 6. Íconos para Alana

En `ui.habilidades`, 40 x 40, redondos, con el estilo de los otros y aro dorado. Que se lean a 40 y a 80 px.

- `prender`: una mano que prende un farol con luz dorada. Es el botón de prender el farol de plaza o la lámpara cercana.
- `chispas`: tres chispas doradas en arco, y el contador de chispas lo pone el juego.

## Parte 7. El portal del mundo

- `portal_plata` en el formato de los portales nuevos (96 x 128, `girar`, `abrir`, `cerrar`, `arco`, `remolino`, `apagado`). Arco de piedra clara con runas plateadas y un remolino lila y plata, como un sueño. En `mundos[4].portal`.

## Cómo entregar

- **Commits:** uno por parte, con el kit regenerado y los tests del taller en verde. Push solo a `claude/abyss-mundo5` al terminar cada parte, así el juego va integrando.
- **Mundos anteriores:** regenerar no puede cambiar ningún archivo de los mundos 1 a 4. Se verifica regenerando y comparando.
- **Lámina de revisión** por parte:
  - el mapa entero chiquito;
  - una postal por zona, con la oscuridad y las luces como se ven en el juego;
  - las estatuas dormidas y despiertas lado a lado;
  - los enemigos al lado de la heroína;
  - el Rey de Piedra al lado de la heroína;
  - la Ladrona robando un farol;
  - el portal plata.
- **Si algo no se puede:** se dice qué y por qué. No se cambia el pedido por algo más fácil sin avisar.
- **Al terminar:** un resumen corto de lo entregado, con los nombres exactos de lo que quedó en el manifest y lo que falte, en `docs/entregas/abyss_mundo5.md` de `pixel_forja`. Y un aviso a la sesión del juego (abajo) con el hash.
