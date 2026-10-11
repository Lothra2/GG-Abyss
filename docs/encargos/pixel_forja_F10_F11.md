# Encargo para PixelForja: jefes grandes, mundos premium y el Mundo 3

Para el agente que trabaja en `pixel_forja`. Este documento se entiende solo, sin leer el juego.

## Contexto rápido

- GG Abyss es un juego tipo Diablo para Sophie (8) y Alana (5). Phaser 3, pixel art con zoom entero.
- El juego carga todo desde `public/assets/kit/manifest.json`, que arma `npm run kit` con `buildGameKit` (`src/engine/kit/gamekit.ts`). Lo que esté en el manifest el juego lo carga solo.
- Medidas fijas: cuadro del mundo de 32 px. Heroínas, Thor y el mercader en celda 48 (la heroína mide unos 44 px). Enemigos en 48 o 64. Ocho direcciones, una fila por dirección en el orden de `direcciones`.
- Objetos del mundo, formato actual (no se cambia, solo se agregan campos opcionales):

```json
"columna_raiz": { "w": 48, "h": 112, "apoyo": [24, 108], "solido": [-10, -6, 20, 6],
  "luz": { "color": "#5ae0d0", "radius": 46, "pulse": true, "dy": 44 },
  "anims": { "idle": { "archivo": "mundo/objetos/columna_raiz_idle.png", "cuadros": 1, "fps": 1, "loop": true } } }
```

- `apoyo` es el punto de los pies en px dentro del sprite. `solido` es `[dx, dy, ancho, alto]` relativo al apoyo. `capa: "suelo"` va debajo de todo.
- Reglas: nada de fotos de la familia en el repo. Créditos LPC al día en `creditos`. El Bosque y la Catedral no pueden cambiar sin querer: si una tarea no toca un mundo, regenerar el kit tiene que dar los mismos archivos de ese mundo.
- Cuando algo esté listo: commit y push en `pixel_forja`. Del lado del juego se corre `git submodule update --remote tools/pixel_forja && npm run kit`.

El orden de las partes es el orden de prioridad.

**Lo que el juego ya entiende.** Esto ya está programado y probado: en cuanto el manifest lo traiga, entra solo.

| Del manifest | Lo que hace el juego |
|---|---|
| `celda` 128 o 192 en un jefe | El cuerpo para recibir golpes y disparos crece en la misma proporción, igual que su sombra |
| `"capa": "frente"` en un objeto del mapa | Se dibuja encima de todo con paralaje 1.15 y baja a alfa 0.35 si tapa a la heroína |
| `"capa": "fondo"` en un objeto del mundo, aunque no esté en el mapa | Repite detrás de todo con paralaje 0.6, 0.75 y 0.9 en orden alfabético del nombre. **Donde va el fondo, el suelo del mapa tiene que quedar transparente**, si no, no se ve |
| `"sombra": "mundo/objetos/<id>_sombra.png"` | Reemplaza la sombra larga que hoy arma el juego con el mismo cuadro |
| animación `sacudir`, `rebotar` o `salpicar` en arbustos, flores, hongos o charcos | Se usa esa en vez del meneo que hace el juego hoy |


---

## Parte 1. Jefes grandes de verdad, sin agrandar

**Qué pasa hoy.** Los jefes se dibujan en celda 64 y `exportChar(..., 64, ..., 1.5)` los agranda x1.5 a celda 96 (`gamekit.ts`, el bloque "los jefes llenan la pantalla"). El pixel queda de 1.5 px, gordo y borroso al lado de la heroína, y el jefe se ve como un enemigo inflado, no como un jefe.

**Lo que se pide.** Dibujar los jefes en su tamaño final, pixel por pixel, con el detalle que ese tamaño permite.

### 1.1 Motor

1. `src/engine/sheet/ficha.ts`: sumar celdas `96 | 128 | 192` a `CellSize` y a `CELL_SIZES`. 192 es solo para el jefe del piso 7.
2. Todo lo que escala con `u = cell / 48` tiene que seguir funcionando. Pero **un jefe grande no es un jefe chico con todo más grueso**:
   - El contorno sigue siendo de 1 px a la resolución nativa (no 2 ni 3).
   - Más tonos por material: de 5 a 7 por rampa (piel, pelo, metal, piedra), con luz de arriba a la izquierda como el resto del kit.
   - Textura que a 48 no cabe: mechones de pelo, grietas en la piedra, remaches, venas de cristal, bordes gastados del metal.
   - Partes secundarias que se mueven solas: capa, cadenas, cola, pelo, alas, colgantes, con 1 o 2 cuadros de retraso respecto al cuerpo.
3. **Cabezas.** Las cabezas LPC son nativas de 64 y no sirven agrandadas. Para 96, 128 y 192 hay que dibujarlas a ese tamaño. Si `head3d` da un resultado limpio a 128 se usa ese camino. Si no, sellos de cabeza nuevos en `head/stamps.ts` para cada jefe. Nunca escalar una cabeza de 64 con vecino más cercano.
4. Exportar con `k = 1`. En el manifest `celda` es el tamaño real y `pivote` sale de los pies reales medidos (con la fórmula de hoy, 128 da `[64, 126]`). Si un jefe tiene una base más ancha, como la polilla en el aire, el pivote es el centro de su sombra.
5. Las hojas no pueden pasar de 4096 px por lado. A 128 entran 32 cuadros por fila. A 192 entran 21, así que una animación del piso 7 no puede tener más de 21 cuadros.

### 1.2 Animaciones de jefe

- **Base:** `idle`, `walk`, `attack`, `attack_heavy`, `warcry`, `hit`, `die`, más las propias de cada jefe (el Minotauro ya tiene `charge` y `leap`).
- **Aviso legible:** todo golpe fuerte tiene una preparación que se sostiene al menos 4 cuadros antes de pegar. Es lo que le permite a Alana esquivar. No se acorta.
- **Muerte larga:** al menos 12 cuadros, y que termine en "liberado", no en un cuerpo tirado. Los jefes de este juego se liberan del encantamiento, no mueren feo.
- **fps:** iguales a los de hoy para que el juego no cambie tiempos (`attack_heavy` y `charge` según el ritmo actual del minotauro).

### 1.3 Control de calidad

- Los controles de `src/engine/qa/checks.ts` tienen que correr a 96, 128 y 192: que quepa en la celda en todas las direcciones y cuadros, que no se corte nada en el borde y que los pies caigan en el pivote.
- Un control nuevo: el contorno nunca de más de 1 px, y no hay bloques de 2 x 2 o 3 x 3 del mismo color que delaten un escalado.
- Silueta: reducida al 50 % tiene que seguir leyéndose qué es. Si no se lee, la pose está mal.
- Una lámina de revisión para Rick en `docs/` del taller: la heroína (48) al lado de cada jefe en idle, attack_heavy y die, a zoom 4, sobre el suelo de su mundo.

### 1.4 Jefes que se piden

| Jefe | Celda | Tamaño del cuerpo | Notas |
|---|---|---|---|
| `minotauro` | 128 | unos 110 px de alto, 2.5 veces la heroína | Rehacer. Mismas animaciones y los mismos nombres. Cuernos grandes, hacha o mazo con peso, nariz con argolla. Pelo marrón con mechones, cuero con remaches |
| `guardian_campana` | 128 | unos 110 px | Rehacer. Cobre con verdín, la campana colgando como parte del cuerpo y moviéndose, raíces enredadas. Mantener las dos versiones de color (corrompido violeta, libre turquesa) |
| `polilla_reina` | 128 | alas abiertas unos 120 px de ancho | Nuevo, jefe del Mundo 3. Ver parte 3 |
| Pisos 4 a 7 | 128, el 7 en 192 | — | Más adelante. El del piso 7 es un Diablo de cuento: rojo, cuernos, fuego, imponente pero sin sangre ni cara de terror |

El juego ya toma `celda` y `pivote` del manifest. Del lado del juego se ajustan el radio de golpe y la barra de vida.

---

## Parte 2. Mundos 1 y 2 premium

**Qué pasa hoy.** Los mundos se sienten planos: una sola altura, el mismo árbol y el mismo cuadro repetidos en la misma pantalla, nada en primer plano, luz pareja y huecos negros en la Catedral. La referencia de calidad es Stardew Valley, donde cada esquina está compuesta a mano.

**Regla para todo lo que sigue:** primero el Bosque Profundo como piloto. Rick lo aprueba con postales y recién entonces se pasa al resto del Bosque y a la Catedral.

**Lo que Rick quiere, en sus palabras:** "realismo en mi pixel art, que el mundo se vea increíble e interactivo". Realismo en pixel art no es más resolución. La densidad no cambia: cuadro de 32 y personajes de 48. Realismo es que la luz, los materiales y la escala sean coherentes. Estas reglas valen para cada pieza nueva y para las que se rehagan:

1. **Una sola luz por mundo, siempre desde el mismo lado,** de arriba a la izquierda. Cada objeto tiene su lado iluminado, su lado en sombra y su sombra proyectada en la misma dirección. Un objeto con la luz de otro lado se rechaza.
2. **Rampas con cambio de tono, no solo de brillo.** Las luces van hacia el amarillo cálido y las sombras hacia el azul o el violeta. Nunca se oscurece agregando negro ni gris.
3. **Oclusión ambiental.** Donde dos cosas se tocan, como un tronco y el suelo, una piedra y el pasto o una pared y el piso, hay una franja más oscura de 1 a 3 px. Es lo que más asienta las cosas en el suelo.
4. **Materiales que se leen.** La madera tiene veta, la piedra grietas y bordes gastados, el metal un brillo duro de 1 o 2 px, el agua reflejo y el musgo crece donde llega la humedad, abajo y en el lado de la sombra.
5. **Perspectiva atmosférica.** Lo que está más lejos o más abajo, como el fondo de abismo o los barrancos, tiene menos contraste y tira al color de la bruma de la zona.
6. **Desgaste y uso.** Nada está nuevo. Los caminos están pisados, las cercas torcidas, las piedras con musgo y los ladrillos con esquinas rotas. Un mundo viejo se ve más real.
7. **Escala coherente.** La heroína mide 44 px. Una puerta mide unos 64, un árbol adulto de 120 a 200 y una piedra grande de 48 a 64. Hoy hay árboles que se ven del tamaño de un arbusto.

### 2.1 Relieve

| Recurso | Tamaño | Cuadros | Apoyo / sólido | Uso |
|---|---|---|---|---|
| Autotile `acantilado_bosque` | cuadros de 32, la cara mide 2 cuadros (64 px) | 1 | la cara y el borde son sólidos | Mesetas. Borde de arriba con pasto que cuelga, cara de roca con grietas y raíces, piedras y sombra al pie. Esquinas internas y externas, los 47 casos del autotile o el subconjunto que use el pintor |
| `rampa_tierra_n`, `_s`, `_e`, `_o` | 96 x 96 | 1 | caminable, bordes laterales sólidos | Subir y bajar de una meseta |
| `escalera_piedra_bosque` | 64 x 96 | 1 | caminable | Escalones tallados en el acantilado |
| Autotile `desnivel_catedral` | cuadros de 32, cara de 64 | 1 | sólido | Desniveles de piedra labrada con baranda arriba, para salas a dos alturas |
| `escalones_rotos` | 96 x 64 | 1 | caminable | Entre niveles de la Catedral |

El pintor (`world/paint.ts`) tiene que saber una altura por cuadro (0, 1, 2) y dibujar la cara donde una altura baja a otra. La grilla del juego sale de los sólidos, así que no hace falta nada más del lado del juego para caminar.

### 2.2 Suelo hecho a mano

- **Variantes:** 4 por tipo de suelo (pasto, pasto oscuro, tierra, piedra, musgo, losa de catedral), repartidas con ruido y no en cuadrícula.
- **Transiciones orgánicas:** entre tipos de suelo con una máscara de ruido, que no se vea el borde recto del cuadro.
- **Caminos gastados:** más claros al centro y con piedritas en los bordes.
- **Calcomanías** con `capa: "suelo"`, de 16 a 48 px, sin sólido, un cuadro cada una. Para el Bosque: `hojas_caidas_0..3`, `raiz_suelo_0..2`, `grieta_0..2`, `charco_chico_0..1`, `flores_suelo_0..3` y `piedritas_0..2`. Para la Catedral: `musgo_losa_0..3`, `grieta_losa_0..3`, `escombro_chico_0..2`, `cera_derretida_0..1` y `charco_negro_0..1`.
- **Densidad:** al menos 6 calcomanías por pantalla de 20 x 11 cuadros.

### 2.3 Objetos con variantes

- **Árboles:** cada especie en 3 tamaños y 3 formas de copa. Hoy hay roble, pino, hechizado y seco. Mismo formato de 9 cuadros de viento.
- **Grupos armados** como un solo objeto o como receta del pintor:
  - `claro_tronco_hongos`: tronco caído con hongos y flores.
  - `rocas_musgo_grupo`: 3 piedras con musgo y helechos.
  - `raices_expuestas`: raíces grandes saliendo del suelo, sólidas en el centro.
  - `arbusto_flores_grupo`.
- **Catedral:**
  - Ladrillo de pared en 6 variantes, más `ladrillo_musgo_0..2`, `ladrillo_roto_0..2` y `ladrillo_raiz_0..2`.
  - `banca_rota` (64 x 40, sólida).
  - `candelabro_pie` (32 x 64, sólido, luz ámbar de 90 que tiembla).
  - `estatua_santo_rota` (48 x 96, sólida).
  - `libros_tirados` (capa suelo).

### 2.4 Sombras horneadas y luz

- **Sombra de contacto:** cada objeto trae una sombra de contacto en un PNG aparte, `<id>_sombra.png`, del mismo tamaño que el objeto y negra con alfa. En el manifest va como `"sombra": "mundo/objetos/<id>_sombra.png"`.
- **Misma luz para todos:** las sombras salen de la misma luz del kit, de arriba a la izquierda, así que caen hacia abajo a la derecha, largas en los árboles y cortas en las piedras.
- **Si falta, nada se rompe:** si un objeto no trae `sombra`, el juego sigue usando la elipse de hoy.

### 2.5 Primer plano

Las piezas nuevas llevan un campo nuevo `"capa": "frente"`. El juego las dibuja encima de todo con paralaje 1.15 y baja su alfa a 0.35 si la heroína queda detrás. Ninguna es sólida.

| Recurso | Tamaño | Cuadros y fps | Uso |
|---|---|---|---|
| `frente_ramas_0..2` | 256 x 96 | 9 cuadros de viento, como los árboles | Ramas que cuelgan desde el borde de arriba en el Bosque Profundo |
| `frente_hojas_0..1` | 128 x 64 | 9 cuadros | Hojas del borde de abajo |
| `frente_columna` | 64 x 256 | 1 | Columna cerca de la cámara en la Catedral |
| `frente_raices_colgantes` | 128 x 160 | 4 cuadros a 4 fps | Raíces que cuelgan del techo de la Catedral |

### 2.6 La Catedral sin huecos negros

- **`fondo_abismo_0..2`.** 512 x 512 cada uno, que repita por los 4 lados, un cuadro. Un campo nuevo `"capa": "fondo"`.
  - El 0 son arcos y columnas lejanas en azul muy oscuro.
  - El 1 es niebla.
  - El 2 son chispas turquesa sueltas.
  - Van donde hoy hay negro, con paralaje 0.6, 0.75 y 0.9. Así se siente que la Catedral cuelga sobre un abismo.
- **`vitral_0..2`.** 48 x 96, en la pared, un cuadro, más su charco de luz `luz_vitral_0..2` de 96 x 64 en capa suelo, con colores ámbar, rosa y turquesa. La luz del charco va en `luz` con su color.
- **`haz_polvo`.** 64 x 192, 6 cuadros a 6 fps, capa suelo. Polvo flotando dentro del haz que entra por un vitral.

### 2.7 Agua

- **`orilla_espuma`:** autotile de borde de agua con espuma, 4 cuadros a 5 fps.
- **Máscara de reflejo:** el mapa trae una capa de cuadros donde se puede ver reflejo, el agua quieta. El juego refleja ahí a la heroína y los árboles de la orilla.

### 2.8 Mapa

- **Punto focal:** se revisa el mapa en cuadrantes de 20 x 11 cuadros y cada uno tiene que tener uno (un landmark, un grupo armado, una luz, agua).
- **Sin repetir lo idéntico:** dentro de un cuadrante no se repite el mismo objeto sin variante.
- **Zonas que pasan por el piloto:**
  - El Bosque Profundo, con una meseta y una rampa.
  - El Anillo de las Hadas, hundido un nivel.
  - Las Alturas, que ya son altas y deberían tener acantilado de verdad.
  - La nave de la Catedral, con las dos alturas.
- **Postales:** la capa `postales` gana al menos una postal por zona retocada, y los tests del juego las leen solas.

### 2.9 Un mundo que reacciona

Hoy reaccionan el pasto alto, los cuervos, los árboles hechizados y las cajas, barriles y vasijas. Hace falta mucho más. Cada pieza de esta tabla es una animación más del objeto, con el mismo formato de siempre (`anims` con su nombre). El juego las conecta del lado suyo.

| Objeto | Animación nueva | Cuadros y fps | Cuándo |
|---|---|---|---|
| Todos los arbustos | `sacudir` | 6 a 14 fps | La heroína pasa por al lado o le pega. Sueltan hojas |
| `arbusto_moras_*` | `sacudir` y `sin_moras` | 6 y 1 | Al pegarle sueltan moras que curan un poquito |
| `hongos`, `hongo_gigante_*` | `rebotar` | 6 a 14 fps | Al pisarlos se aplastan y vuelven, y largan esporas |
| `flores_grandes_*` | `cerrar` y `abrir` | 4 a 10 fps | Se cierran cuando pasa un enemigo y se abren después |
| `nenufar`, `juncos` | `mecer` | 6 a 10 fps | Al pasar por el agua al lado |
| Ranas, peces y ardillas, nuevos | `quieto`, `huir` | 4 y 8 a 12 fps | Criaturas chicas de 16 a 24 px que huyen como los cuervos. Ranas en la orilla, peces que saltan en el lago, ardillas que suben al árbol |
| `charco`, `charco_chico_*` | `salpicar` | 6 a 16 fps | Al pisarlo |
| `antorcha`, `farol`, `candelabro_pie` | `apagada` y `prender` | 1 y 6 a 12 fps | Las apagadas se prenden al pasar con la luz, y quedan prendidas |
| `palanca`, nueva | `arriba`, `bajar`, `abajo` | 1, 6 a 12 fps y 1 | Abre atajos y compuertas. 32 x 32, sólida 12 x 6 |
| `puerta_madera` y `reja_catedral`, nuevas | `cerrada`, `abrir`, `abierta` | 1, 8 a 10 fps y 1 | 64 x 64. Sólidas cerradas |
| `piedra_empujable`, nueva | `quieta` y `arrastrar` | 1 y 4 a 8 fps | 32 x 32. Thor la empuja para tapar un hueco o destapar un secreto |
| `campana_chica` en la Catedral | `sonar` | 8 a 12 fps | Al pegarle suena y espanta a los enemigos chicos un rato |
| Telarañas | `romper` | 6 a 14 fps | Al pasar se rompen y quedan colgando |

Cada interacción trae su sonido corto, de 0.2 a 0.8 s y con pico de 0.5: `arbusto_sacudir`, `hongo_rebote`, `charco_pisar`, `rana_salto`, `palanca`, `puerta_abrir`, `reja_abrir`, `piedra_arrastrar`, `campana_chica` y `telarana_romper`.

### 2.10 Lámina de calidad

Antes de entregar el piloto, una lámina con la misma pantalla del Bosque Profundo antes y después, a zoom 4. Al lado, una lista que diga cómo se cumple cada una de las 7 reglas de realismo de arriba. Si una regla no se cumple, se arregla antes de mandar.

---

## Parte 3. Mundo 3: Las Galerías del Eco

Minas de cristal abandonadas debajo de la Catedral. Mucho más oscuro que lo anterior, con el misterio subiendo. **La luz es el progreso:** los cristales se prenden al pegarles y quedan prendidos.

### 3.1 Mapa `mundo3_galerias`

- **Tamaño y pintor:** 100 x 80 cuadros, con el pintor en modo interior como la Catedral, pero con cuevas orgánicas y no salas rectas (autómata celular para las paredes, más salas talladas encima).
- **Paleta:**
  - Piedra azul gris fría, de `#0b0f17` a `#5a6a7e`.
  - Cristales cian `#5ae8ff`, violeta `#b07aff` y ámbar `#ffb35a`.
  - Madera vieja de mina, de `#2a1d14` a `#7a5a3c`.
- **Zonas:**

| Zona | Oscuridad | Bruma | Partículas | Ambiente | Momento |
|---|---|---|---|---|---|
| La Boca de la Mina | 0.60 | 0.30 | polvo | galerias | Llegada por el portal, el primer farol de minero y el primer cristal para enseñar a prenderlo |
| Los Rieles | 0.75 | 0.35 | polvo | galerias | El carrito que Thor empuja como atajo. Rieles que se pierden en lo oscuro |
| El Lago de Cristal | 0.70 | 0.60 | brillos | agua | Agua quieta con cristales que se reflejan |
| El Puente Colgante | 0.80 | 0.70 | brasas frías (motas azules) | viento | Puente de madera sobre el abismo, con fondo de abismo debajo |
| La Sala del Eco | 0.80 | 0.40 | brillos | eco | Cada sonido vuelve. Cristales enormes en el techo |
| El Campamento Abandonado | 0.65 | 0.30 | humo | galerias | Carpas, una olla fría y el pedazo del mural escondido |
| La Cueva de la Reina | 0.85 | 0.50 | ceniza | jefe | La arena con los 4 cristales grandes |

- **Contenido:** 3 faroles de minero (hacen de fogata), al menos 3 ramas opcionales que vuelvan al camino principal, al menos 2 secretos para el olfato de Thor, 6 o más cofres, al menos 40 cristales prendibles y postales en cada zona.
- **Capas del mapa:** las de siempre, más una capa `cristales` con los puntos y el color de cada uno.

### 3.2 Objetos

| Recurso | Tamaño | Cuadros y fps | Apoyo / sólido | Uso |
|---|---|---|---|---|
| `cristal_apagado_0..2` | 32 x 48 | 1 | [16, 44] / sólido 14 x 6 | Cristal apagado, tres formas |
| `cristal_prendido_0..2` | 32 x 48 | 6 a 6 fps | igual | Prendido, con luz de radio 80 del color del cristal |
| `cristal_prenderse` | 32 x 48 | 8 a 14 fps | igual | La transición, se toca una vez |
| `cristal_grande_apagado` y `_prendido` | 64 x 112 | 1 y 6 a 6 fps | [32, 106] / sólido 30 x 10 | Los 4 de la arena del jefe, luz de radio 180 |
| `farol_minero` | 32 x 64 | 6 a 8 fps | [16, 60] / sólido 12 x 6 | La fogata del Mundo 3, luz ámbar de radio 200 |
| `rieles_h`, `rieles_v`, `rieles_curva_*` | 32 x 32 | 1 | capa suelo | Vías de mina |
| `carrito_mina` | 48 x 48 | quieto 1, rodar 4 a 10 fps | [24, 44] / sólido 32 x 10 | El atajo que empuja Thor |
| `viga_mina` | 96 x 96 | 1 | dos patas sólidas | Marco de madera de la galería |
| `puente_colgante_h` y `_v` | 32 x 32 | 2 a 2 fps, se mece | capa suelo, caminable | Puente sobre el abismo |
| `pico_tirado`, `casco_minero`, `linterna_rota` | 32 x 32 | 1 | capa suelo | Pistas de que los mineros huyeron |
| `carpa_minero` | 96 x 80 | 1 | sólida | El campamento |
| `estalactitas_frente_0..1` | 128 x 96 | 1 | `capa: "frente"` | Primer plano desde el techo |
| `mural_3` | 128 x 96 | 1 | en la pared | El tercer pedazo del mural. Dibujos sin texto: mineros con faroles huyendo de dos ojos rojos que se llevan la luz |
| `figura_ojos` | 48 x 64 | idle 4 a 4 fps, irse 8 a 12 fps | [24, 60] / no sólida | La figura que mira de lejos: silueta oscura con ojos rojos que brillan. Al irse se deshace en humo. No da miedo, da curiosidad |

El fondo de abismo de la parte 2 se reusa en el Puente Colgante. Si sale en tonos de mina, mejor.

### 3.3 Enemigos

| Recurso | Celda | Animaciones | Uso |
|---|---|---|---|
| `polilla_ceniza` | 48 | idle (volando), walk, attack, hit, die en 8 direcciones | Vuela hacia la luz y apaga cristales. Gris ceniza, alas con ojos falsos, polvo que cae |
| `minero_piedra` | 64 | idle, walk, attack, attack_heavy (preparación de 4 cuadros o más), hit, die | Golem chico de roca con casco de minero y un cristal en el pecho. Lento, pega fuerte |
| `sombra` | 48 | idle, walk, attack, hit, die | Una silueta que solo se ve dentro de la luz. Ver nota |
| `sombra_ojos` | 16 x 8 | parpadeo 4 a 3 fps | Lo único que se ve de la sombra fuera de la luz |

Nota sobre la sombra: se dibuja como sprite normal y el juego la muestra solo dentro de la luz. Un contorno violeta de 1 px ayuda a que se lea.

### 3.4 Jefe

**`polilla_reina`**, celda 128, siguiendo todo lo de la parte 1.

- **Animaciones:** `idle` volando, `walk`, `attack` con un aleteo que empuja, `attack_heavy` con lluvia de polvo, `warcry` llamando a las polillas, `hit`, `die` liberándose (las alas pasan de ceniza a colores) y `aturdida` (posada en el suelo cuando los 4 cristales están prendidos).
- **Dos colores:** encantada en gris y violeta, libre en colores.
- **Avisos:**
  - `aviso_polvo`: 96 x 96, 8 cuadros, capa suelo. Mancha donde va a caer el polvo.
  - `nube_polvo`: 96 x 96, 10 cuadros a 12 fps. Apaga la luz donde cae.

### 3.5 Audio

**Música:**

- `musica_galerias`: 90 s en bucle. Lenta y misteriosa, con mucho espacio, campanitas de cristal y bajo grave.
- `musica_jefe_polilla`: más rítmica, con aleteo en la percusión.

**Ambiente:**

- `ambiente_galerias`: 12 s en bucle, con goteo, viento lejano y una piedra que cae a lo lejos.
- `ambiente_eco`: goteo con eco largo.

**Efectos:**

- `cristal_prender`: brillo que sube, 0.8 s.
- `cristal_apagar`: brillo que baja, 0.6 s.
- `polilla_aleteo`.
- `minero_golpe`: piedra contra piedra.
- `sombra_aparece`: un soplido suave, nada de gritos.
- `carrito_rodar`: 3 s en bucle.
- `figura_irse`: humo y un "plin" agudo.

**Reglas:** todo bajito, con pico de 0.5 como los otros ambientes, y nada que asuste de golpe.

---

## Cómo entregar

- **Commits:** uno por parte, con el kit regenerado y los tests del taller en verde (`npm test` en `pixel_forja`).
- **Mundos sin tocar:** si una parte no toca un mundo, regenerar no puede cambiar los archivos de ese mundo. Hay que verificarlo regenerando y comparando.
- **Lámina de revisión:** cada parte trae una para Rick: jefes al lado de la heroína, la postal del piloto antes y después, y las piezas del Mundo 3 sobre su suelo.
- **Si algo no se puede:** se dice qué y por qué. No se cambia el pedido por algo más fácil sin avisar.
