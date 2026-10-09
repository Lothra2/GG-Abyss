# Assets pendientes para PixelForja

Lo que el juego necesita y el kit no trae. Ordenado por cuándo hace falta. Cada pieza dice qué usa el juego mientras tanto, así ninguna fase se bloquea.

Formato de cada pieza: nombre en el manifest, tamaño en px, animaciones con cuadros y fps, punto de apoyo, si es sólido y para qué es.

Cuando el taller entregue algo: `git submodule update --remote tools/pixel_forja && npm run kit`, se marca aquí como hecho con la fecha y el juego lo toma solo desde el manifest.

---

## Imprescindible para F1

### 1. Íconos de cartel

- **Manifest:** `ui.iconos_cartel.<nombre>`, un PNG por ícono en `ui/carteles/`.
- **Nombres:** los que piden los carteles del mapa: `flecha_norte`, `peligro`, `corazon`, `cruce`, `estrella`. Y cualquier `icono` nuevo que traiga un cartel del mapa debe tener su PNG (que `verificar-kit` lo exija).
- **Tamaño:** 24 x 24, 1 cuadro. Contorno oscuro de 1 px para que se lea sobre el `panel`.
- **Apoyo:** no aplica, es interfaz. **Sólido:** no.
- **Para qué:** el panel del cartel y una burbuja chica que flota sobre cada cartel. Alana no lee: el ícono es el cartel.
- **Mientras tanto:** `icono_mapa`.

### 2. Íconos del HUD y de pausa

- **Manifest:** `ui.icono_<nombre>`, como los íconos que ya existen.
- **Tamaño:** 24 x 24, 1 cuadro, mismo estilo que `icono_ajustes` e `icono_bolsa`.
- **Lista:**
  - `icono_pausa`: dos barras. Botón de pausa arriba a la derecha.
  - `icono_secreto`: cofre chico con un signo de pregunta. Contador de secretos.
  - `icono_zona`: hoja o árbol. Contador de zonas descubiertas.
  - `icono_luna`: luna. Control de Noche.
  - `icono_sonido` y `icono_silencio`: volumen.
  - `icono_calidad`: estrella o diamante. Calidad alta o baja.
  - `icono_jugadora`: silueta de cabeza. Cambiar de jugadora.
  - `icono_peque`: chupete o carita. Modo peque.
  - `icono_jugar`: triángulo de play. Botón "Jugar" y "Continuar".
  - `icono_guardado`: pluma o disquete. Aviso de "Guardado" en las fogatas.
- **Sólido:** no.
- **Mientras tanto:** `icono_ajustes` para pausa y calidad, `icono_mapa` para zonas, primer cuadro de `cofre_madera_quieto` para secretos, `icono_bolsa` y retratos para el resto. Sin ícono de luna ni sonido, el control lleva solo la barra.

### 3. Sonido de descubrir

- **Manifest:** `audio.descubrir` y `audio.secreto`.
- **Formato:** WAV mono 16 bits a 22050 Hz, como el resto.
- **Duración:** `descubrir` 1.5 s, campanitas que suben. `secreto` 2 s, más mágico, con brillo al final.
- **Para qué:** banner de zona nueva y de secreto encontrado.
- **Mientras tanto:** `magia` para zona y `legendario` para secreto.

### 4. Sonidos de interfaz de la selección

- **Manifest:** `audio.elegir` (0.6 s, alegre) y `audio.guardado` (0.8 s, suave).
- **Para qué:** tocar una tarjeta de jugadora y guardar en fogata.
- **Mientras tanto:** `subir_nivel` y `curar`.

---

## Mejoras para F1 (el mundo se ve mejor con ellas)

### 5. Botín de nivel bajo

Esto es lo más importante de la lista aunque se use en F3: el taller necesita tiempo.

- **Problema:** los 135 objetos de nivel 1 a 10 son todos `normal`. No existe ningún `magic`, los `rare` son nivel 30 y el legendario más bajo es nivel 16. En el Mundo 1 nunca caería un haz de color.
- **Pedido para `catalogo.json` y los atlas:**
  - 24 mágicos de nivel 2 a 10: un arma por cada arma de clase (`bow`, `wand`, `sword`, `staff`, `shield`), 12 piezas de armadura repartidas en los 8 casilleros, 4 joyas (anillo y amuleto) y 3 más a gusto. Con 1 o 2 `mods` del subconjunto que usa el juego (sección 0 de PLAN.md).
  - 8 raros de nivel 5 a 10 con 2 o 3 `mods`, al menos uno por clase.
  - 2 legendarios de nivel 8 a 10 con 8 cuadros de brillo y `cae_<id>`, pensados para el cofre del Claro Escondido.
- **Mientras tanto:** tablas curadas en `balance.ts` con raros de nivel 30 y legendarios de nivel 16 a 24 en lugares fijos y con baja probabilidad.

### 6. Campamento de fogata

- **Manifest:** `mundo.objetos.campamento_fogata`.
- **Tamaño:** 64 x 48. **Apoyo:** [32, 40]. **Sólido:** [-14, -6, 28, 8].
- **Animaciones:** `idle` 6 cuadros a 10 fps, fuego más grande con troncos y piedras alrededor. `luz` `#ffa040`, radio 150, `flicker`, `dy` 10.
- **Para qué:** los 3 `punto_guardado`. Hoy la fogata de 32 px se pierde al lado de árboles de 116 px y es el lugar más importante para guardar y reaparecer.
- **Mientras tanto:** `fogata` con pozo de luz más grande y brasas.

### 7. Pasto alto que se aparta

- **Manifest:** `mundo.objetos.pasto_alto.anims.apartar_izq` y `apartar_der`.
- **Tamaño:** 32 x 32, igual que hoy. **Apoyo:** [16, 27].
- **Animaciones:** 4 cuadros a 12 fps, sin bucle, el pasto se abre hacia un lado y vuelve.
- **Mientras tanto:** tween de ángulo y escala en código.

### 8. Copas separadas de los troncos

- **Manifest:** en cada árbol grande (`roble_*`, `pino_*`, `roble_grande_0`, `roble_otono_1`, `sauce_v3`, `arbol_hechizado_*`, `arbol_seco_*`, `abuelo_roble_v3`) una segunda hoja `copa` con el mismo tamaño, apoyo y cuadros que `idle`, solo con la copa. Y `idle` solo con el tronco.
- **Para qué:** cuando la heroína pasa detrás, solo la copa se vuelve transparente y el tronco queda firme. Se ve mucho más pulido.
- **Mientras tanto:** todo el árbol baja a alfa 0.45.

### 9. El Abuelo Roble sonríe

- **Manifest:** `mundo.objetos.abuelo_roble_v3.anims.sonreir`.
- **Tamaño:** 240 x 228, igual que hoy. **Apoyo:** el mismo.
- **Animaciones:** 8 cuadros a 8 fps, sin bucle: abre los ojos y sonríe más, con hojitas que caen.
- **Para qué:** el cartel dice "Si lo abrazas, te sonríe". Tocarlo tiene que pasar algo.
- **Mientras tanto:** fx `curar` sobre el tronco, brillos y sonido.

### 10. Pasos por superficie

- **Manifest:** `audio.paso_pasto`, `paso_tierra`, `paso_piedra`, `paso_madera`, `paso_agua`. Y en el mapa una capa de tiles `superficie` con un índice por tipo.
- **Formato:** WAV de 0.15 s, 3 variantes por tipo si se puede (`paso_pasto_0` a `_2`).
- **Para qué:** cruzar el puente suena a madera, el vado a agua. Se nota mucho.
- **Mientras tanto:** `paso` con tono al azar.

### 11. Música del título

- **Manifest:** `audio.musica_titulo`, loop de 30 a 45 s, misteriosa y suave.
- **Mientras tanto:** `ambiente_magia`.

### 12. Logo "GG Abyss"

- **Manifest:** `ui.logo`, 288 x 96, 8 cuadros a 8 fps con brillo que recorre las letras.
- **Mientras tanto:** "GG Abyss" en `fuente_titulo` x3.

### 13. Cambios al mapa del Bosque GG

Coordenadas en cuadros de 32 px. El taller decide el detalle.

- **Caminos:** bajar a la mitad la densidad y el contraste de las piedritas blancas de la tierra en todo el mapa. En tablet se ven como estática.
- **Puente del Trol** (alrededor de x 52 a 58, y 52 a 58): guarida del trol bajo el puente en la orilla, con huesos de pescado, una olla y un trapo de cama. Hoy es la postal más floja.
- **Ruinas del Viejo Reino** (x 69 a 89, y 42 a 58): estatua de Thor más grande (al menos 128 x 192) con placa dorada visible. Bordes del piso de losas rotos y con pasto entrando, no una mancha con borde duro. Pilares de alturas distintas.
- **Colina de los Goblins** (x 94 a 118, y 38 a 72): que se lea como colina, con un desnivel o acantilado bajo. Dianas de práctica, barriles, una tarima, más carpas.
- **Praderas** (Pradera de las Mariposas x 17 a 43, y 61 a 79, y Las Alturas x 36 a 104, y 1 a 23): grupos de flores grandes, piedras, troncos, un tocón con hongos, un charco. Algo que descubrir cada media pantalla.
- **Anillo de las Hadas** (x 5 a 13, y 21 a 29): anillo de al menos 128 x 96, hongos más grandes y con más brillo.
- **Postales nuevas en la capa `postales`:** `bosque_profundo`, `claro_escondido`, `lago_espejo`, `campo_calabazas`, `las_alturas`. El juego las captura sola.

---

## Imprescindible para F2

### 14. Flecha

- **Manifest:** `fx.proyectil_flecha_<dir>` para las 8 direcciones, y `fx.impacto_flecha`.
- **Tamaño:** celda 48 como los demás proyectiles. Flecha de unos 20 px de largo.
- **Animaciones:** proyectil 2 cuadros a 14 fps en bucle (brillo leve). Impacto 5 cuadros a 16 fps sin bucle (astillas).
- **Para qué:** ataque básico y lluvia de flechas de Sophie, y los 13 goblins arqueros.
- **Mientras tanto:** `proyectil_sagrado_<dir>` e `impacto_sagrado`.

### 15. Magia de naturaleza

- **Manifest:** `fx.proyectil_naturaleza_<dir>` (8 direcciones), `fx.impacto_naturaleza`, `fx.nova_naturaleza`.
- **Tamaño:** celda 48. Verde hoja con pétalos, distinto del veneno.
- **Animaciones:** proyectil 6 cuadros a 14 fps en bucle, impacto 8 cuadros a 16 fps, nova 10 cuadros a 16 fps.
- **Para qué:** ataque básico de Alana.
- **Mientras tanto:** `proyectil_veneno_<dir>` e `impacto_veneno`.

### 16. Íconos de habilidad

- **Manifest:** `ui.habilidades.<nombre>`.
- **Tamaño:** 40 x 40, 1 cuadro, con fondo propio redondo para que se lean en el botón. El juego oscurece con tinte durante la recarga.
- **Lista:** `lluvia_flechas`, `esquiva`, `llamar_thor`, `curar`, `torbellino`, `bloqueo`, `nova_fuego`, `rayo_canalizado`. Y una por clase nueva si viene del estudio.
- **Para qué:** los 2 botones de habilidad. Alana no lee.
- **Mientras tanto:** primer cuadro de `proyectil_sagrado_up`, `tajo`, `escudo_de_thor`, `curar`, `tajo`, `escudo_de_thor`, `nova_fuego` y `proyectil_arcano_right`, en ese orden, dentro de `casillero`.

### 17. Sonidos de combate que faltan

- **Manifest:** `audio.arco` (disparo, 0.3 s), `audio.esquiva` (whoosh, 0.3 s), `audio.bloqueo` (clang de escudo, 0.4 s), `audio.thor_rescate` (aullido corto y alegre, 1.2 s).
- **Mientras tanto:** `espadazo`, `click`, `golpe` y `aullido`.

---

## Mejoras para F2

### 18. Trol más grande

- **Manifest:** `personajes.trol` con celda 64 y pivote [32, 62], mismas animaciones que hoy. Más ancho y alto que el goblin, piel gris verdosa, garrote grande.
- **Para qué:** hoy tiene la celda y casi la silueta del goblin. Como élite tiene que imponer.
- **Mientras tanto:** escala 1.25 y tinte.

### 19. Thor con armadura completo

- **Manifest:** en `thor_armadura1` a `thor_armadura5` agregar `bark`, `pickup`, `sit`, `wag` y `die`, con los mismos cuadros que Thor sin armadura.
- **Mientras tanto:** `idle` de la armadura y un salto por tween.

### 20. Thor cava

- **Manifest:** `personajes.thor.anims.dig` (8 direcciones, 6 cuadros a 10 fps) y `fx.tierra_cavada` (celda 48, 6 cuadros, sin bucle).
- **Para qué:** "desenterrar" un objeto.
- **Mientras tanto:** `bark` y luego `pickup`.

---

## Imprescindible para F4

### 21. Minotauro grande

- **Manifest:** `personajes.minotauro` con celda 96 y pivote [48, 92], las mismas 9 animaciones.
- **Para qué:** con celda 64 apenas es más grande que las heroínas. Un jefe tiene que llenar la pantalla.
- **Mientras tanto:** escala 1.5.

### 22. Aviso en línea para la carga

- **Manifest:** `mundo.objetos.aviso_carga`.
- **Tamaño:** 32 x 48 por segmento, que se repite a lo largo. **Apoyo:** [0, 24].
- **Animaciones:** `llenar` 8 cuadros a 8 fps sin bucle, como `aviso_jefe`.
- **Para qué:** marcar en el piso la línea de la carga del minotauro antes de que corra.
- **Mientras tanto:** `aviso_jefe` estirado en x.

### 23. Onda del pisotón

- **Manifest:** `fx.onda_pisoton`, celda 96, 8 cuadros a 16 fps sin bucle. Polvo y grietas que salen en anillo.
- **Mientras tanto:** `nova_sagrado` x2 con tinte café.

---

## Mejoras para F4

### 24. Ilustración de "Continuará"

- **Manifest:** `ui.continuara`, 960 x 540, la escalera que baja al abismo con la luz del portal.
- **Mientras tanto:** la postal `arena_del_minotauro` con oscuridad 0.5 y la luz del portal.

---

## Imprescindible para F5

### 25. Íconos de la app

- **Manifest:** `app.icono_192`, `app.icono_512`, `app.icono_maskable_512` (con margen de seguridad del 20 %), `app.apple_touch_180`, `app.favicon_32`.
- **Contenido:** Thor y la entrada al abismo, o la cara de Thor sobre el portal. Debe leerse a 48 px.
- **Para qué:** instalar la PWA en el iPad y el Android.
- **Mientras tanto:** ninguno decente. Sin esto no se cierra F5.

### 26. Girar la tablet

- **Manifest:** `ui.girar_tablet`, 64 x 64, 2 cuadros a 2 fps: tablet vertical y tablet acostada con una flecha curva.
- **Mientras tanto:** la heroína en `idle` y el texto "Gira la tablet" en `fuente_titulo`.

---

## Sonidos para revisar

Se llena en F0 cuando Rick oiga todo en la sala del kit (`?kit=1`). Formato: nombre, qué suena mal, cómo debería sonar.

- (vacío)
