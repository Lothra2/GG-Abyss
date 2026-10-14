# Encargo para PixelForja: Mundo 7, El Corazón Helado, y el Diablo

Para la sesión que trabaja en `pixel_forja`. Se entiende solo. La dirección completa está en `PLAN.md`, sección F13, del repo `gg-abyss`.

## Reglas de ramas (no se negocian)

- `pixel_forja` lo comparten dos proyectos. **Otro agente trabaja en `main` y en las ramas `claude/olimpico-*`.** Nada de eso se toca: ni commits, ni merges, ni PRs, ni borrar, ni rebase, ni force-push.
- Se trabaja solo en la rama `claude/abyss-mundo7`, que sale de `claude/abyss-mundo6` (hoy en `b684504`). Si no existe, se crea desde esa.
- Push normal a `claude/abyss-mundo7` y nada más. Nunca `--force`.
- **Hay otra sesión del taller en paralelo** en `claude/abyss-celestial` (también sale de `b684504`) haciendo las cinemáticas y la heroína celestial. Al final, cuando las dos estén listas, el juego te va a pedir que hagas `git merge origin/claude/abyss-celestial` en tu rama (merge normal, sin rebase) y resuelvas los choques. Hasta entonces no toques su rama.
- Los mundos 1 a 6 regeneran idénticos (se verifica comparando).

## Contexto rápido

- GG Abyss es un juego tipo Diablo para Sophie (8) y Alana (5). Phaser 3, pixel art con zoom entero. Todo sale del `manifest.json` que arma `npm run kit`.
- Cuadro de 32. Heroínas, Thor y mercader en celda 48. Enemigos en 48 o 64. Jefes en 128. **El Diablo en 192.** Ocho direcciones.
- Objetos con el formato de siempre. La Fragua (`mundos[5]`) y la Ciudad (`mundos[4]`) son los mejores ejemplos. **Ningún nombre de objeto puede repetir uno de otro mundo con otra forma** (ya lo vigila `choquesDeObjetos`).
- Nada de fotos de la familia. Créditos LPC al día.

## La idea del piso

Detrás de la Puerta Negra no hay fuego: el fondo del abismo está congelado. Un lago de hielo negro enorme con gigantes congelados adentro mirando hacia arriba, columnas de hielo, cadenas con escarcha, una ventisca que nunca para y, en el centro, el trono del Diablo, mitad hielo y mitad brasa. Todas las luces robadas eran para él: el Diablo tiene frío y se come la luz para no apagarse. Cae nieve negra mezclada con ceniza.

**Tono (decisión de Rick):** es el piso más oscuro y terrorífico del juego, para todos. Los demonios tienen cara de verdad: cuernos, colmillos, ojos que queman. Da miedo de verdad. **Se mantiene: sin sangre ni vísceras** (los enemigos se deshacen en hielo, ceniza o humo) y lo que ataca siempre avisa antes. El Diablo es **diseño propio**, inspirado en el clásico (rojo oscuro, enorme, cuernos, espinas, alas de murciélago), no una copia de ningún juego.

**Calidad:** el mundo más épico del juego. Criterio premium en cada postal: tres planos, punto focal, luz y sombra, nada repetido igual en una pantalla y algo que se mueve (nieve, ventisca, cadenas, aliento helado, brasas del trono). Contraste: el azul negro del hielo contra el rojo de los ojos y las brasas.

**Luz y sombras:** sin sombras horneadas con dirección, solo la de contacto al pie. La luz es de las hogueras de hueso, los braseros de la arena, el farol de la heroína, sus luces compañeras y los ojos y grietas del Diablo.

## Parte 1. Mapa `mundo7_corazon`

- **Tamaño:** 120 x 110 cuadros (el más grande).
- **Paleta:** hielo negro `#05070c` a `#3a4a62`, escarcha `#9ab8d8` a `#e8f4ff`, nieve sucia `#6a7480`, roca `#14161c`, brasas del trono `#5a1000` a `#ff6a20`, ojos y grietas demoníacas `#ff2a1a`, fuego de hoguera de hueso `#ffb060`.
- **Zonas:**

| Zona | Oscuridad | Bruma | Partículas | Ambiente | Momento |
|---|---|---|---|---|---|
| La Escalera Helada | 0.90 | 0.40 | nieve | hielo | Llegada por el portal. Primera hoguera de hueso, se enseña el frío |
| El Bosque de Escarcha | 0.95 | 0.55 | nieve | bosque_hielo | Árboles de hielo, manadas de lobos |
| El Lago de los Gigantes | 0.95 | 0.45 | nieve | lago | Hielo fino, gigantes congelados en el hielo, la Reina Escarcha (rama opcional) |
| Las Catacumbas de Hielo | 0.97 | 0.60 | ceniza | catacumbas | Pasillos oscuros, sombras devoradoras, secreto de Thor, el pedazo del mural `mural_7` |
| La Ciudadela Congelada | 0.95 | 0.50 | nieve | ciudadela | Caballeros congelados y brujas de escarcha |
| El Puente de las Cadenas | 0.95 | 0.65 | ventisca | puente | Puente largo sobre el vacío, siempre en ventisca |
| La Puerta del Trono | 0.95 | 0.45 | ceniza | puerta | El Guardián de la Puerta |
| El Corazón Helado | 0.95 | 0.35 | ceniza | trono | El trono y la arena del Diablo |

- **Contenido:** 5 hogueras de hueso (fogatas), al menos 3 ramas opcionales, 2 secretos para Thor, 8 cofres o más, postales en cada zona y **el doble de enemigos que la Fragua** (grupos grandes).
- **Entidades:**
  - `portal_llegada` (con su portal, ver Parte 7) y `portal_volver` (al mundo6).
  - 5 `punto_guardado` con `hoguera: true` y `objeto: hoguera_hueso`.
  - **`columna_hielo`** y **`gigante`**: los refugios de la ventisca (son sólidos y su lado de sotavento protege). Ponlos en todo el mapa, más en el Puente y el Lago. El juego toma el punto como el centro del refugio.
  - **`hielo_fino`**: rectángulos (`width` y `height` en múltiplos de 32) sobre el lago, caminables. Ningún camino obligado cruza más de 4 cuadros seguidos sin hielo firme.
  - Los enemigos: `lobo_escarcha` (en grupos de 4 a 6), `espectro_helado`, `diablillo` (grupos de 5 a 8), `caballero_congelado`, `bruja_escarcha`, `sombra_devoradora`. Los minijefes `reina_escarcha` y `guardian_puerta` con `elite: true` y su `nombre`.
  - `arena_jefe` (radio 256) en El Corazón Helado, el `jefe` con `enemigo: diablo`, `nombre: El Diablo` y `titulo` a gusto. **4 `brasero_hueso`** en la arena a unos 170 px del centro. `portal_jefe` con `destino: fin` (el juego pone la cinemática de cierre).
  - `trono_diablo`: el trono detrás de la arena.
  - `mural` con `pieza: 7`, y `figura` con `alto: true` al lado del trono (la Ladrona entregando la última llama).
- **Prueba del mapa:** desde cualquier cuadro caminable hay camino a una hoguera. La arena se camina entera alrededor del Diablo y se llega a los 4 braseros.

## Parte 2. Objetos

| Recurso | Tamaño | Cuadros y fps | Apoyo / sólido | Uso |
|---|---|---|---|---|
| `hoguera_hueso` | 64 x 64 | `idle` 8 a 8 fps | sólida 32 x 12 | La fogata del piso. Luz cálida `#ffb060` de radio 240 |
| `columna_hielo_0..3` | 64 x 160 | 1 | sólida en la base | Refugio de la ventisca. Escarcha que brilla apenas |
| `gigante_congelado_0..2` | 192 x 160 | 1, `respira` 2 a 1 fps (casi nada: se le mueve un ojo) | sólido | Gigantes atrapados en el hielo, mirando hacia arriba. Inquietantes |
| `hielo_fino` | 64 x 64 (variantes `_0..3`) | `quieto` 1, `cruje` 6 a 8 fps, `roto` 1 | capa suelo | El hielo que se rompe |
| `arbol_hielo_0..3` | 96 x 160 | `idle` 2 a 2 fps | sólido en el tronco | El Bosque de Escarcha |
| `brasero_hueso` | 48 x 80 | `apagado` 1, `prenderse` 8 a 12 fps, `prendido` 6 a 8 fps, `congelado` 1 | sólido chico | Los cuatro de la arena. Prendido con luz de radio 220 |
| `trono_diablo` | 256 x 256 | `idle` 6 a 4 fps (las brasas laten) | sólido | Mitad hielo y mitad brasa, con calaveras de demonio de piedra (sin sangre) |
| `cadena_helada_0..2`, `nieve_frente_0..1`, `estalactitas_frente_0..1` | 128 x 128 | 2 a 4 fps | `capa: "frente"` | Primer plano |
| `fondo_hielo_lejos_0..2` | 512 x 256 | 1 | `capa: "fondo"` | Torres de hielo, gigantes lejanos y el vacío |
| `mural_7` | 128 x 96 | 1 | en una pared de Las Catacumbas | La Ladrona de luz, antes de ser sombra, una niña brillante. Sin texto |
| `figura_ultima_llama` | 48 x 64 | `idle` 4 a 4 fps (la Ladrona con la llama en las manos), `irse` 8 a 10 fps | sin sólido, luz roja chiquita | La Ladrona en el trono |
| Utilería | a gusto | 1 | sólidos | Armas congeladas, escudos rotos, calaveras de demonio de piedra, banderas heladas |

**Calcomanías:** nieve acumulada, grietas en el hielo, huellas de lobo, escarcha, ceniza.

## Parte 3. Enemigos (más y más duros)

| Recurso | Celda | Animaciones | Uso |
|---|---|---|---|
| `lobo_escarcha` | 48 | `idle`, `walk`, `run`, `attack` (mordida, 4 de aviso), `aullar`, `hit`, `die` (se deshace en nieve) | Manada. Ojos celestes que brillan en lo oscuro |
| `espectro_helado` | 48 | `idle`, `walk` (flota), `cast` (rayo de hielo, 6 de aviso), `hit`, `die` (se rompe en escarcha). `vuela: true` | Fantasma de hielo con cara hueca y ojos fríos |
| `proyectil_hielo_<dir>`, `impacto_hielo` | 16 y 32 | 4 y 6 cuadros | | El rayo de hielo |
| `diablillo` | 32 | `idle`, `walk`, `attack` (tira fuego, 4 de aviso), `hit`, `die` (se apaga en humo) | Demonio chiquito, cuernos, sonrisa de colmillos, en grupos grandes |
| `proyectil_fuego_chico_<dir>` | 16 | 4 cuadros | | La bolita de fuego |
| `caballero_congelado` | 64 | `idle`, `walk`, `attack`, `attack_heavy` (7 de aviso), `bloquear` (el escudo de frente), `hit`, `die` (la armadura cae vacía) | Armadura de hielo con escudo. Ojos rojos adentro del yelmo |
| `bruja_escarcha` | 48 | `idle`, `walk`, `cast` (muro de hielo o curar), `hit`, `die` (se vuelve nieve) | Bruja de hielo encorvada, manos largas |
| `muro_hielo` | 32 x 64 | `subir` 6 a 12 fps, `quieto` 1, `romper` 6 a 12 fps | sólido mientras dura | El muro que levanta la bruja |
| `sombra_devoradora` | 48 | `idle`, `walk`, `attack` (se traga una luz, 4 de aviso), `hit`, `die` | Sombra con boca grande y ojos blancos, sin cuerpo claro |
| `reina_escarcha` (minijefe) | 64 | `idle`, `walk` (flota), `attack`, `cast` (lanzas de hielo), `warcry` (ventisca), `dividirse`, `hit`, `die` (se rompe en mil cristales). `elite: true`, `vuela: true` | Reina de hielo con corona de estalactitas |
| `aviso_lanza_hielo` | 48 x 32 | 8 cuadros | capa suelo | Donde cae cada lanza |
| `guardian_puerta` (minijefe) | 64 | `idle`, `walk`, `attack` (golpe en cruz), `attack_heavy` (7 de aviso), `charge` (carga), `hit`, `die` (cae de rodillas y se apaga). `elite: true` | Demonio caballero enorme con espada de fuego negro |
| `aviso_cruz` | 128 x 128 | 8 cuadros | capa suelo | El golpe en cruz |

## Parte 4. El Diablo

**`diablo`**, **celda 192**, con todo lo de los jefes grandes (eventos, `aviso`, `elevacion`, pivote medido). Es el personaje más detallado del juego: que se lean los cuernos, los colmillos, las garras, las espinas, las alas rotas y las grietas de brasa a 192 px.

- **Animaciones:**
  - `idle` (respira pesado, humo de la nariz, las grietas laten).
  - `walk` (pasos que tiemblan).
  - `attack` (zarpazo, 6 o más de aviso).
  - `nova` (levanta los brazos, 8 de aviso, y sale el anillo de fuego).
  - `charge` (carga encorvado).
  - `rayo` (abre la boca, 8 de aviso, y sale el rayo rojo; el juego lo hace girar).
  - `pilares` (golpea el piso con los puños: salen los pilares).
  - `oscuridad` (se envuelve en sombra, solo quedan los ojos).
  - `jaula` (señala a la heroína: salen los huesos del piso).
  - `warcry` (ruge al cielo: llama demonios).
  - `aturdido` (de rodillas con los braseros prendidos, la piel se enfría: ahí se le pega).
  - `hit`.
  - `die` (cae de rodillas, se le rompe el hielo de los cuernos, la última llama sale de su pecho y él se deshace en ceniza y escarcha).
- **`ojos`:** en cada animación, **[x, y] por dirección y por cuadro** desde el pivote (como la `boca` de la Dragona), para la luz de los ojos que se ve en la oscuridad. `luz_ojos: { color, radius }` en el personaje.
- **fx:**
  - `nova_fuego_diablo`: 256 x 256, 10 cuadros. El anillo que se expande (el juego lo escala).
  - `aviso_nova`: 256 x 256, 8 cuadros, capa suelo.
  - `rayo_rojo`: 32 x 32, 6 cuadros en bucle. Se repite en línea.
  - `aviso_rayo`: 32 x 32, 6 cuadros, en bucle, capa suelo.
  - `pilar_fuego`: 64 x 128, 12 cuadros (sale del piso, arde, se apaga).
  - `aviso_pilar`: 64 x 32, 8 cuadros, capa suelo.
  - `jaula_huesos`: 96 x 96, `subir` 8 cuadros, `quieta` 1, `romper` 8 cuadros. Encierra a la heroína.
  - `aviso_carga_diablo`: 32 x 32, en bucle, la línea de la carga.

## Parte 5. Audio

- `ambiente_hielo` (20 s, viento helado y hielo que cruje), `ambiente_bosque_hielo` (lobos lejos), `ambiente_lago` (el hielo que suena bajo los pies), `ambiente_catacumbas` (goteo helado y susurros sin palabras), `ambiente_ciudadela`, `ambiente_puente` (ventisca), `ambiente_trono` (un latido grave).
- `musica_reina_escarcha`, `musica_guardian` (cortas, en bucle).
- **El Diablo:** `musica_diablo_1` a `musica_diablo_3` (cada vez más fuerte y más rápida, en bucle, que encajen entre sí: el juego pasa de una a otra con las fases) y `musica_diablo_final` (la fase 5, la más épica del juego).
- **Efectos:** `ventisca_viene` (el aullido que avisa), `viento_fuerte`, `frio_sube`, `congelada`, `hielo_cruje`, `hielo_rompe`, `agua_helada`, `hoguera_prender`, `luz_comida` (una sombra se traga una luz), `luz_vuelve`, `lobo_aullido`, `lobo_mordida`, `espectro_rayo`, `diablillo_risa` (bajita), `diablillo_fuego`, `escudo_bloquea`, `bruja_muro`, `bruja_cura`, `reina_lanzas`, `reina_ventisca`, `guardian_cruz`, `guardian_carga`, `diablo_ruge`, `diablo_paso`, `diablo_nova`, `diablo_rayo`, `diablo_pilares`, `diablo_oscuridad`, `jaula_huesos`, `jaula_rompe`, `brasero_hueso_prender`, `brasero_congela`, `diablo_cae`.
- **Reglas:** pico de 0.6. El rugido del Diablo puede ser fuerte y grave, pero nunca un grito de golpe.

## Parte 6. Íconos para Alana

En `ui.habilidades`, 40 x 40, redondos, con aro dorado. Que se lean a 40 y a 80 px.
- `frio`: un copo de nieve dentro de un termómetro azul (el medidor del frío).
- `compañeras`: tres lucecitas de colores en círculo (las luces compañeras).
- `brasero`: una mano que prende un brasero de hueso.
- `romper`: un puño rompiendo huesos (la jaula).

## Parte 7. El portal del mundo

- `portal_hielo`: arco de hielo negro con runas rojas y un remolino blanco y rojo. En `mundos[6].portal`. Formato de los portales nuevos.

## Cómo entregar

- Un commit por parte, con el kit regenerado y los tests en verde. Push a `claude/abyss-mundo7` al terminar cada parte.
- **Orden pedido:** primero las partes 1 y 2 (mapa y objetos) y la 3 (enemigos). **El Diablo (parte 4) al final**: apenas el kit trae al `diablo`, el juego habilita el Mundo 7.
- Láminas de revisión por parte (mapa chiquito, postal por zona, enemigos al lado de la heroína, el Diablo al lado de la heroína y al lado de la Dragona para comparar tamaño).
- Si algo no se puede, se dice qué y por qué.
- Al terminar: `docs/entregas/abyss_mundo7.md` y un aviso a la sesión del juego con el hash.
