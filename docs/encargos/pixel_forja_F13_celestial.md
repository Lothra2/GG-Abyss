# Encargo para PixelForja: las cinemáticas del final y la heroína celestial

Para la sesión que trabaja en `pixel_forja`. Se entiende solo. La dirección completa está en `PLAN.md`, sección F13, del repo `gg-abyss`.

## Reglas de ramas (no se negocian)

- `pixel_forja` lo comparten dos proyectos. **Otro agente trabaja en `main` y en las ramas `claude/olimpico-*`.** Nada de eso se toca: ni commits, ni merges, ni PRs, ni borrar, ni rebase, ni force-push.
- Se trabaja solo en la rama `claude/abyss-celestial`, que sale de `claude/abyss-mundo6` (hoy en `b684504`). Si no existe, se crea desde esa.
- Push normal a `claude/abyss-celestial` y nada más. Nunca `--force`.
- **Hay otra sesión del taller en paralelo** en `claude/abyss-mundo7` haciendo el Mundo 7 y el Diablo. Al final esa sesión va a hacer merge de tu rama en la suya. Para que el merge sea fácil: **no toques los archivos de los mundos** (`src/engine/world/*` de otros mundos, los mapas) y agrega lo tuyo en archivos nuevos. Si tienes que tocar algo compartido (el que arma el manifest, el pintor de personajes), que sea un cambio chico y aislado.
- Los mundos 1 a 6 y las heroínas sin alas regeneran idénticos.

## Contexto rápido

- GG Abyss es un juego tipo Diablo para Sophie (8) y Alana (5). Phaser 3, pixel art con zoom entero. Todo sale del `manifest.json` que arma `npm run kit`.
- El intro ya usa paneles pintados en capas (`manifest.intro`, paneles de 480 x 270 con `capas` que el juego corre con su paralaje, más `fuego_pared`, `humo_grande` y `logo_fuego`). Las cinemáticas nuevas van en el mismo formato.
- Las heroínas (`rick`, `steph`, `sophie`, `alana`) tienen `capas` de equipo (`pecho`, `casco`, `arma`, `mano`): una hoja por pieza con un bloque por animación y 8 filas (una por dirección). El juego dibuja cada capa encima de la base, cuadro por cuadro.
- Nada de fotos de la familia.

## Parte 1. La cinemática de bajada al infierno (`manifest.cine_bajada`)

Se ve al cruzar el portal de la Fragua, antes de entrar al Mundo 7. Es el momento más épico del juego hasta ahí. Tono (decisión de Rick): lo más oscuro del juego, demonios que dan miedo de verdad, **sin sangre** y sin sustos de golpe.

Seis paneles en el formato del intro (480 x 270, o 480 x 540 si baja la cámara), cada uno con 2 a 4 `capas` con su `paralaje`, cuadros animados donde haga falta y `notas`:

1. `bajada_puerta`: la Puerta Negra se abre de a poco. Sale un viento helado que apaga las brasas de la fragua. Escarcha que avanza por el piso.
2. `bajada_escalera`: una escalera interminable baja al hielo, con la heroína y Thor chiquitos, de espaldas, con su luz (480 x 540, la cámara baja).
3. `bajada_lago`: el lago congelado enorme con gigantes atrapados adentro mirando hacia arriba. Nieve negra.
4. `bajada_ladrona`: la Ladrona camina por el hielo con la última llama en las manos hacia el trono, lejos.
5. `bajada_diablo`: el Diablo en su trono, de cerca. Se le abren los ojos rojos, la escarcha se le rompe de los cuernos, humo de la nariz. Es el primer plano más terrorífico del juego: cuernos, colmillos, garras. **Diseño propio** (rojo oscuro, enorme, cuernos, espinas, alas de murciélago rotas, grietas de brasa), no una copia de ningún juego. Que coincida con el `diablo` que dibuja la otra sesión: mirá su rama cuando lo tenga (solo leer).
6. `bajada_titulo`: un logo "El Corazón Helado" en letras de hielo con grietas rojas (como `logo_fuego`, que se arme cuadro por cuadro), sobre negro.

Más:
- `nieve_frente`: una hoja de nieve que cruza delante (como `humo_grande`).
- Audio: `cine_bajada_musica` (60 s, grave y épica, que crece hasta el título) y `cine_rugido` (el rugido del Diablo, grave, sin grito).
- En `manifest.cine_bajada.guion` (opcional): sugerencias de duración por panel y el subtítulo de cada uno, en español:
  1. "La Puerta Negra se abrió."
  2. "Abajo, más abajo que todo."
  3. "Donde el abismo se congeló."
  4. "La última llama tenía dueño."
  5. "Y él despertó."

## Parte 2. La cinemática de cierre (`manifest.cine_fin`)

Al vencer al Diablo. De terror a esperanza: empieza oscura y termina con el amanecer más lindo del juego.

1. `fin_cae`: el Diablo cae de rodillas en la arena y el hielo se rompe a su alrededor, con grietas de luz.
2. `fin_llama`: la última llama sale de su pecho y vuela a la Ladrona, que se vuelve luz. Es la **Primera Luz**, una niña hecha de luz dorada y blanca (que dé ternura).
3. `fin_pisos` (480 x 540): las luces suben por los siete pisos uno arriba del otro y cada uno se prende: el Bosque, la Catedral, las Galerías, el faro, la ciudad, la fragua.
4. `fin_amanecer`: amanece en el Bosque GG. La familia (las cuatro heroínas, sin caras de fotos, al estilo de sus personajes) y Thor en casa.
5. `fin_alas`: la Primera Luz le da las alas a la heroína: alas de luz que se abren.
6. `fin_titulo`: "Fin" en letras doradas que brillan, y abajo, chiquito, "¿o no?".
- Audio: `cine_fin_musica` (60 a 75 s, de oscura a luminosa, con el tema del Bosque al final).
- Subtítulos sugeridos: "Se apagó.", "La última llama volvió a casa.", "Y la luz subió por todo el abismo.", "Amaneció.", "La Primera Luz te dio sus alas."

## Parte 3. La heroína celestial

Al terminar el juego la heroína de ese perfil se vuelve celestial. Para las **cuatro heroínas** (`rick`, `steph`, `sophie`, `alana`):

- **Dos capas nuevas** en `capas`, con el formato de siempre (una hoja con un bloque por animación y 8 filas por dirección), para **todas** las animaciones que tenga cada heroína:
  - `alas_detras`: lo de las alas que queda **detrás** del cuerpo (el juego la dibuja debajo de la base).
  - `alas_delante`: lo que queda **delante** (sobre todo en las direcciones de espaldas, donde las alas tapan la espalda). El juego la dibuja encima de todo.
  - Alas blancas y doradas, grandes pero que no tapen la cara, que se mueven con cada animación (aletean suave al caminar, se abren en el ataque, se pliegan en `hurt`).
- **`aura`**: una capa encima (la aureola dorada sobre la cabeza y un brillo suave) para todas las animaciones.
- **`tunica_celestial`**: una pieza de `pecho` nueva (túnica blanca y dorada), con su ícono de botín, para que se vea celestial aunque no tenga armadura.
- **Retrato celestial** (`retrato_celestial` en cada heroína) para la selección de jugadora.
- **Anim `volar`** (en las 4 heroínas, 6 a 8 cuadros, las alas abiertas y los pies despegados del piso) para el poder Alas.
- **fx:** `lanza_luz` (32 x 32 en bucle, se repite en línea), `impacto_luz` (48 x 48, 8 cuadros), `estela_alas` (32 x 32, 6 cuadros, plumas de luz que caen) y `aura_celestial` (64 x 64, en bucle, el brillo al pie).
- **Íconos** en `ui.habilidades`: `alas` (alas de luz abiertas), `lanza_luz` (una lanza de luz) y `ciclo` (un espiral dorado, para el Ciclo 2).
- **Audio:** `alas_vuelo` (un aleteo de luz), `lanza_luz`, `celestial_despierta` (un coro sin palabras, corto).

## Parte 4. El Ciclo 2 en la interfaz

- `ui.marco_ciclo`: un marco chico dorado para el número de ciclo en el HUD (como los otros marcos, con `nueve`).
- Una variante dorada del logo del título (`logo_ciclo`) con un espiral, para el título cuando la jugadora ya terminó.

## Cómo entregar

- Un commit por parte, con el kit regenerado y los tests en verde. Push a `claude/abyss-celestial` al terminar cada parte.
- Láminas: los 12 paneles en su momento, las 4 heroínas celestiales al lado de las normales en 4 direcciones, el vuelo y la lanza.
- Si algo no se puede, se dice qué y por qué.
- Al terminar: `docs/entregas/abyss_celestial.md` y un aviso a la sesión del juego con el hash.
