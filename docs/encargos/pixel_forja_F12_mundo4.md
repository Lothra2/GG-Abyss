# Encargo para PixelForja: Mundo 4, El Puerto Ahogado (y los pendientes del juego)

Para la sesión que trabaja en `pixel_forja`. Este documento se entiende solo, sin leer el juego. La dirección completa del descenso está en `PLAN.md`, sección F12, del repo `gg-abyss`.

## Reglas de ramas (no se negocian)

- `pixel_forja` lo comparten dos proyectos. **Otro agente trabaja ahora en `main` y en las ramas `claude/olimpico-*`.** Nada de eso se toca: ni commits, ni merges, ni PRs, ni borrar, ni rebase, ni force-push.
- Se trabaja solo en la rama `claude/abyss-mundo4`, que sale de `claude/perfeccionar-ejecucion-smh3ad` (la rama de la que hoy sale el kit de GG Abyss). Si la rama no existe, se crea desde esa.
- Push normal a `claude/abyss-mundo4` y nada más. Nunca `--force`.
- Si algo del taller hace falta cambiarlo en código compartido (el motor, el pintor), se cambia en esta rama, de forma que el Bosque, la Catedral y las Galerías regeneren idénticos.

## Contexto rápido

- GG Abyss es un juego tipo Diablo para Sophie (8) y Alana (5). Phaser 3, pixel art con zoom entero.
- El juego carga todo desde `public/assets/kit/manifest.json`, que arma `npm run kit` con `buildGameKit`. Lo que esté en el manifest el juego lo carga solo.
- Medidas: cuadro de 32 px. Heroínas, Thor y el mercader en celda 48. Enemigos en 48 o 64. Jefes en 128. Ocho direcciones, una fila por dirección en el orden de `direcciones`.
- Objetos con el formato de siempre (`w`, `h`, `apoyo`, `solido`, `luz`, `anims`, `capa`, `sombra`). Ejemplo y explicación en `docs/encargos/pixel_forja_F10_F11.md` del juego, o en los objetos de las Galerías que ya están en el manifest.
- Nada de fotos de la familia. Créditos LPC al día. El Bosque, la Catedral y las Galerías no pueden cambiar sin querer: regenerar el kit tiene que dar los mismos archivos de esos mundos (se verifica comparando).

## La idea del piso

El piso 4 es donde se pasa un punto sin retorno. Un mar negro bajo tierra con un pueblo de pescadores medio hundido: casas vacías con las puertas abiertas, botes volteados, redes colgando, una campana que suena sola a lo lejos. En el centro, un faro gigante apagado. Cae ceniza fina siempre. **La luz la carga Thor en un farol que lleva en la boca**: fuera de esa luz casi no se ve nada. Terror de cuento para Sophie: tensión de verdad, sin sangre, sin caras de terror, sin sustos de golpe. Lo que ataca siempre se ve antes de pegar.

**Calidad:** tiene que ser el mundo más lindo hasta ahora, y el más inquietante. Cada postal cumple el criterio premium: tres planos (suelo, objetos y frente o fondo), un punto focal, luz y sombra en la misma pantalla, ningún objeto repetido igual en una pantalla y algo que se mueve (agua, redes, ceniza, faroles).

**Luz y sombras:** la luz del piso es puntual y se mueve (el farol de Thor, los faroles del muelle, el faro al final). El juego ya hace sombras que caen lejos de la luz que las alumbra. Por eso en este mundo **no se hornean sombras con dirección**: cada objeto trae solo su sombra de contacto al pie (oclusión donde toca el piso, oscura y corta). El campo `sombra` del manifest puede llevar esa sombra de contacto.

## Parte 1. Mapa `mundo4_puerto`

- **Tamaño y pintor:** 110 x 90 cuadros. Exterior bajo tierra: agua negra con orillas, muelles de madera, calles de piedra mojada entre casas, acantilado de roca alrededor y el techo de la caverna que no se ve.
- **Paleta:**
  - Agua negra verdosa, de `#03080a` a `#1c3a3a`, con brillos `#6fb8a8`.
  - Piedra mojada gris verde, de `#0d1414` a `#5c6e68`.
  - Madera podrida, de `#1a120c` a `#6a5038`.
  - Redes y sogas `#8a7a5a`.
  - Luz del farol de Thor ámbar cálido `#ffc070`, la única luz cálida del piso al principio.
  - Fuego fatuo de los marineros verde frío `#7affc8`. Medusas negras con borde violeta `#8a5aff`.
- **Zonas:**

| Zona | Oscuridad | Bruma | Partículas | Ambiente | Momento |
|---|---|---|---|---|---|
| El Muelle de Llegada | 0.70 | 0.40 | ceniza | puerto | Llega por el portal. Primer farol del muelle: Thor lo prende y se enseña el farol |
| La Calle de las Redes | 0.80 | 0.45 | ceniza | puerto | Calle angosta entre casas, redes colgando que se mueven y tapan (capa `frente`) |
| El Mercado Hundido | 0.80 | 0.50 | ceniza | puerto | Puestos volteados, cajones, la mitad bajo el agua. Rama opcional con cofre |
| La Iglesia de la Campana Ahogada | 0.85 | 0.55 | ceniza | campana | La campana que suena sola. Adentro, el pedazo del mural `mural_4` |
| Los Botes Volteados | 0.80 | 0.60 | ceniza | puerto | Donde más se nota la marea: caminos que se inundan y muelles flotantes |
| El Astillero | 0.85 | 0.50 | ceniza | puerto | Rama opcional con el minijefe, el Capitán Ahogado, y su cofre dorado |
| La Cueva de las Medusas | 0.85 | 0.60 | brillos | agua | Agua quieta con medusas negras flotando. Atajo de vuelta |
| El Faro | 0.90 | 0.50 | ceniza | jefe | La base del faro, la arena del Pez Farol en el agua de al lado |

- **Contenido:** 4 faroles del muelle (hacen de fogata), al menos 3 ramas opcionales que vuelvan al camino principal, al menos 2 secretos para el olfato de Thor, 6 cofres o más, postales en cada zona.
- **Capas nuevas del mapa (además de las de siempre):**
  - `marea_baja`: cuadros que solo se caminan con la marea baja (con la alta quedan bajo el agua).
  - `marea_alta`: cuadros que solo se caminan con la marea alta (muelles flotantes que suben y conectan).
  - Ninguna zona puede quedar sin salida con ninguna de las dos mareas: desde cualquier cuadro caminable hay camino al farol más cercano con las dos.
- **Entidades:** `portal_llegada` (color `rojo`), `portal_jefe` con `destino: mundo5` (si el kit no trae el 5, el juego muestra Continuará), `farol_muelle` x4, `jefe` con `enemigo: pez_farol`, el minijefe como `enemigo: capitan_ahogado` con `elite: true`, `campana_iglesia` (la que suena sola), `mural` con `pieza: 4`, puntos de la `figura` (uno en lo alto del faro) y los enemigos repartidos.

## Parte 2. Objetos

| Recurso | Tamaño | Cuadros y fps | Apoyo / sólido | Uso |
|---|---|---|---|---|
| `farol_muelle_apagado` y `farol_muelle_prendido` | 32 x 80 | 1 y 6 a 8 fps | [16, 76] / sólido 12 x 6 | La fogata del piso. Prendido con luz ámbar de radio 180 |
| `farol_muelle_prenderse` | 32 x 80 | 8 a 14 fps | igual | Thor lo prende, se toca una vez |
| `faro` | 128 x 320 | apagado 1, prendido 8 a 8 fps (la luz gira arriba) | [64, 312] / sólido 80 x 24 | El faro del centro. Prendido con luz de radio 420 |
| `muelle_h`, `muelle_v`, `muelle_esquina_*` | 32 x 32 | 1 | capa suelo, caminable | Muelles de madera |
| `muelle_flotante` | 64 x 32 | abajo 1, subir 6 a 10 fps, arriba 2 a 2 fps (se mece) | capa suelo | El que sube con la marea alta |
| `casa_pescador_0..3` | 128 x 128 | 1, más una ventana que titila apenas en 2 de ellas | sólidas, puerta abierta | Cuatro casas distintas, inclinadas, con tablas sueltas |
| `bote_volteado_0..2` | 96 x 48 | 1 | sólido | Botes boca abajo en la orilla |
| `bote_hundido` | 96 x 64 | 4 a 3 fps (se mece) | en el agua, no sólido | Un bote medio hundido |
| `red_colgando_0..2` | 64 x 96 | 4 a 4 fps (se mueve con el viento) | `capa: "frente"` en dos de ellas | Redes que cuelgan de vigas |
| `cajones_mercado`, `puesto_volteado`, `barril_pescado`, `ancla_vieja`, `cuerda_enrollada` | 32 a 64 | 1 | sólidos chicos | El mercado hundido |
| `campana_iglesia` | 64 x 96 | quieta 1, sonar 8 a 10 fps | [32, 92] / sólido 30 x 10 | La campana que suena sola |
| `iglesia_ruina` | 192 x 192 | 1 | sólida, con hueco de puerta | La iglesia hundida |
| `agua_marea` | 32 x 32 | 6 a 6 fps, borde que avanza | capa suelo | Lo que se dibuja en los cuadros que la marea va tapando |
| `rocas_frente_0..1`, `vigas_frente_0..1` | 128 x 96 | 1 | `capa: "frente"` | Primer plano |
| `fondo_mar_lejos_0..2` | 512 x 256 | 1 (la del medio con olas lentas, 4 a 3 fps) | `capa: "fondo"` | El mar negro que se pierde a lo lejos, con siluetas de mástiles y el faro chiquito |
| `mural_4` | 128 x 96 | 1 | en la pared de la iglesia | El cuarto pedazo del mural: la figura de los ojos rojos con los faroles del pueblo en las manos, los pescadores mirando desde los botes. Dibujos sin texto |
| `figura_ojos` | | | | La de las Galerías sirve. Si sale una versión mojada que gotea, mejor |

**Sombras:** cada objeto con su sombra de contacto al pie y nada más (ver "Luz y sombras").

## Parte 3. El farol de Thor

Es la pieza más importante del piso.

- **`thor_farol`**: un personaje del manifest con la misma celda (48), el mismo pivote, las mismas animaciones, los mismos cuadros y las mismas 8 direcciones que `thor` (`idle`, `walk`, `run`, `sit`, `wag`, `bite`, `howl`, `bark`, `pickup`, `dig`, `hurt`). Cada cuadro trae **solo el farol** colgando de la boca de Thor, en su lugar exacto para ese cuadro. El juego lo dibuja encima de Thor cuadro por cuadro, con cualquier armadura.
- **`thor_farol_apagado`**: lo mismo, con el farol apagado (vidrio oscuro, sin llama).
- **El farol:** de hierro negro con vidrio ámbar, una llamita que titila (2 tonos alternados en los cuadros) y un poquito de vaivén al caminar y correr. Que se lea a x1.
- **En `howl`** Thor levanta la cabeza: ahí el farol queda arriba. El juego usa esa animación para "alzar el farol".

## Parte 4. Enemigos

| Recurso | Celda | Animaciones | Uso |
|---|---|---|---|
| `marinero_niebla` | 48 | idle, walk, attack (gancho), hit, die (se deshace en niebla) en 8 direcciones | Silueta de pescador con gorro y gancho, hecha de niebla verde translúcida. En la luz del farol se ve entero y se deshace más rápido |
| `marinero_ojos` | 16 x 8 | parpadeo 4 a 3 fps | Las dos linternitas verdes que se ven del marinero fuera de la luz |
| `cangrejo_ceniza` | 48 | idle, walk (de costado), attack (tenaza), hit, die | Cangrejo gris ceniza con ojos naranjas. Chicos, vienen en grupos |
| `medusa_negra` | 48 | idle (flota y late), walk, hit, die | Negra con borde violeta que late. No ataca: si toca a Thor le apaga el farol. Que se vea en lo oscuro por el borde |
| `capitan_ahogado` (minijefe) | 64 | idle, walk, attack (ancla), attack_heavy (levanta el ancla, 6 cuadros o más de aviso), warcry (llama una ola), hit, die (se libera: se le va la niebla y queda un capitán viejo que saluda y se va) | Fantasma de capitán con abrigo largo, barba de algas y un ancla. Imponente, no grotesco |

## Parte 5. Jefe: el Pez Farol

**`pez_farol`**, celda 128, con todo lo de los jefes grandes (parte 1 del encargo F10/F11).

- **Animaciones:** `idle` (solo se ve la lucecita sobre el agua y la sombra del cuerpo debajo), `emerger`, `walk` (nada), `attack` (sale y muerde, 6 cuadros o más de preparación), `attack_heavy` (salto y ola), `warcry` (llama cangrejos y medusas), `hit`, `hundirse`, `die` (se libera: la luz robada se le escapa y vuela hacia el faro, y queda un pez farol chiquito y simpático que se va nadando) y `aturdido` (fuera del agua, boqueando, cuando Thor alza el farol).
- **Look:** enorme, oscuro, con dientes de cuento (redondos, no filosos de terror) y la antena con la luz del faro, que es lo más brillante de la pantalla. Encantado en negro verdoso, libre en azul y dorado.
- **Avisos:**
  - `aviso_mordida`: 128 x 64, 8 cuadros, capa suelo. Donde va a salir a morder.
  - `aviso_ola`: 32 x 32 que se repite en línea, 6 cuadros. La línea de la ola.
  - `ola`: 128 x 64, 8 cuadros a 12 fps. La ola que empuja.

## Parte 6. Audio

**Casi sin música en el piso.** La música entra solo en peleas y momentos clave.

- `ambiente_puerto`: 20 s en bucle. Agua que golpea los muelles, madera que cruje, viento bajo y, muy lejos y cada tanto, una campana.
- `ambiente_campana`: la iglesia por dentro, eco largo y gotas.
- `musica_jefe_pez`: grave y marina, con percusión de olas.
- `musica_capitan`: más corta, con un acordeón triste que se vuelve tenso.
- `musica_faro`: el tema de victoria cuando el faro se prende. Cálido, que abre, 30 s y después se calma.
- **Efectos:**
  - `campana_lejos` y `campana_cerca`.
  - `marea_sube` (6 s).
  - `farol_prender` y `farol_apagar`.
  - `thor_alza_farol` (un aullido corto y valiente).
  - `marinero_se_deshace` (un soplido con eco).
  - `cangrejo_tenaza`.
  - `medusa_toca` (un "blup" suave).
  - `ancla_golpe`.
  - `pez_emerge`, `pez_mordida` y `ola`.
  - `faro_prende` (un golpe grande y luminoso).
- **Reglas:** todo bajito, con pico de 0.5 como los otros ambientes. Nada de gritos ni de sustos de golpe.

## Parte 7. Pendientes del juego (también en esta rama)

Detalle exacto en `ASSETS_PENDIENTES.md` del juego (#38, #39 y #40).

- **#38, `ataque` en `ui.habilidades`:** 40 x 40, redondo, el mismo estilo de `nova_fuego` y `rayo_canalizado`. Dos espadas cruzadas claras sobre fondo oscuro con aro dorado (`#e8b850` a `#ffd27a`). Es el mismo para todas las heroínas.
- **#39, `cinturon` nuevo:** 190 x 44, 5 casillas de 36 con 5 px de borde, acero con remaches dorados, **sin números pintados** (los pone el juego). Opcional: `casillero_pocion` con un hueco redondo de vidrio.
- **#40, portales premium:** `portal_azul` y `portal_rojo` de 96 x 128 con apoyo abajo al centro.
  - El marco es un arco de piedra con runas que brillan, quieto.
  - Adentro va el remolino animado: `girar`, 12 cuadros, en espiral hacia el centro, con chispas que salen del borde.
  - `abrir` (8 cuadros): las runas se prenden una por una y el remolino nace en el centro. `cerrar` (6 cuadros).
  - Luz con `radius` 160. Si el arco va en otra capa que el remolino, mejor.
  - Esto cambia los portales de los cuatro mundos: es el único cambio que se permite en los mundos anteriores.

## Cómo entregar

- **Commits:** uno por parte, con el kit regenerado y los tests del taller en verde. Push solo a `claude/abyss-mundo4`.
- **Mundos anteriores:** salvo los portales (#40), regenerar no puede cambiar ningún archivo del Bosque, la Catedral ni las Galerías. Se verifica regenerando y comparando.
- **Lámina de revisión** por parte:
  - el mapa entero chiquito;
  - una postal por zona;
  - Thor con el farol en las 8 direcciones caminando;
  - los enemigos al lado de la heroína;
  - el Pez Farol al lado de la heroína;
  - los portales nuevos;
  - el ícono de ataque y el cinturón sobre el HUD.
- **Si algo no se puede:** se dice qué y por qué. No se cambia el pedido por algo más fácil sin avisar.
- **Al terminar:** un resumen corto de lo entregado, con los nombres exactos de lo que quedó en el manifest y lo que falte, en `docs/entregas/abyss_mundo4.md` de `pixel_forja`.
