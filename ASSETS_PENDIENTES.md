# Assets pendientes para PixelForja

Lo que el juego necesita y el kit no trae. Cada pieza dice qué usa el juego mientras tanto, así ninguna fase se bloquea.

Formato de cada pieza: nombre en el manifest, tamaño en px, animaciones con cuadros y fps, punto de apoyo, si es sólido y para qué es.

Cuando el taller entregue algo: `git submodule update --remote tools/pixel_forja && npm run kit`, se pasa a "Entregado" con la fecha y el juego lo toma solo desde el manifest.

---

## Pendiente

### 27. La bruma `niebla_jirones.png` no repite hacia los lados

- **Qué pasa:** el kit dice que las texturas de bruma "pegan por los 4 lados", pero `niebla_jirones.png` (256 x 256) tiene el borde izquierdo y el derecho distintos (alfa 128, 64, 32, 0 contra 0, 112, 0, 32). Arriba y abajo sí empatan. Al repetirla se ve una costura vertical cada 512 px (a escala 2), y el visor del taller la tiene igual.
- **Pedido:** rehacer `mundo/niebla_jirones.png` para que repita sin costura en horizontal. `niebla_nubes.png` está bien.
- **Mientras tanto:** el juego la usa junto a una copia espejada (512 x 256) armada en código, que empata en los bordes.

### 28. Íconos para instalar en el iPad y para la pantalla completa

- **Qué pasa:** la pausa tiene un botón "Pantalla completa" (Android y PC) y, en el iPad, un panel "Instalar" con 3 pasos. Hoy los pasos son solo texto porque el kit no trae los íconos de Safari. Alana no lee: necesita ícono.
- **Pedido:** `ui/icono_compartir.png` (24 x 24, el cuadrado con la flecha hacia arriba de Safari), `ui/icono_agregar_inicio.png` (24 x 24, un cuadrado con un +) y `ui/icono_pantalla_completa.png` (24 x 24, cuatro esquinas apuntando hacia afuera). Una sola imagen cada uno, sin animación.
- **Mientras tanto:** el botón usa `icono_mapa` (pantalla completa) o `icono_guardado` (instalar) y el panel de instalar muestra el ícono de la app (`manifest.app.icono_192`).

### 29. Madera del puente (F7)

- **Qué pasa:** F7 pide detalles de ambiente según la cercanía (agua, madera, viento, piedra). Agua y viento ya están (`ambiente_agua` por cercanía y `ambiente_viento` por zona). No hay un sonido de madera para los puentes.
- **Pedido:** `audio/ambiente_madera.wav`, 12 s en bucle sin corte, crujidos sueltos de tablas y una cuerda que se tensa, bajito (pico 0.5 como los otros ambientes).
- **Mientras tanto:** los puentes suenan solo al pisarlos (`paso_madera_*`).

### 30. F8, lo que falta de la Catedral

Ya entregado por el taller (ver abajo): el puente de piedra, las losas del vado, la forja en sus 4 estados, la brasa, la campana corrompida y libre, la raicita, el vigía de las raíces y el Guardián de la Campana. Falta:

| Recurso | Tamaño | Cuadros y tiempos | Apoyo / sólido | Uso | Mientras tanto |
|---|---|---|---|---|---|
| `aviso_onda` | 352 x 352 | 8 cuadros que se llenan, anillo con el centro libre | capa suelo | la onda de campana | anillo violeta con el centro turquesa dibujado como capa técnica (como la línea de la carga del minotauro) |
| `aviso_raiz` | 96 x 48 | 8 cuadros | capa suelo | las manchas de la llamada de raíces | `aviso_jefe` teñido de violeta |
| `puerta_atajo` | 64 x 64 | cerrada 1, abrir 6 a 10 fps | sólida cerrada | el atajo del claustro | `raices_cortina` que se recoge al abrirse |
| Audio | — | — | — | `musica_jefe_campana`, `musica_forja`, `ambiente_agua_negra`, `fuelle`, `campana`, `brasa_recoger`, `raices` | la campana suena con `bloqueo` grave, la brasa con `legendario`, las raíces con `romper`; en la arena suena `musica_jefe` |
| Mundo 3 | — | — | — | lo que hay más abajo del campanario | el portal rojo lleva a Continuará |

### 31. Equipo visible: lo que todavía no se dibuja

Las capas de equipo ya salen de PixelForja (arma por tipo, mano libre, pecho por línea y nivel, casco). Falta:

| Recurso | Tamaño | Cuadros y tiempos | Uso | Mientras tanto |
|---|---|---|---|---|
| Colores de rareza en el arma de la mano | las capas `arma` de cada heroína, celda 48 | las 21 animaciones | un arma legendaria, de set o única se ve con sus colores (`mainLoot`) | se ve el arma de su tipo con los colores de siempre |
| Hombreras, guantes y botas | capas nuevas `hombros`, `manos`, `pies`, celda 48 | las 21 animaciones | que se noten en la heroína | dan stats y no se dibujan (a 48 px casi no se leen) |
| Mano libre `escudo_heater` y `cabeza_reducida` | capas `mano` | las 21 animaciones | hoy usan el dibujo de `shield` y `orb` | se ven como escudo y orbe comunes |
| Voz o sonido del mercader | `audio/mercader_hola.wav`, 0.6 s | — | cuando saluda a la heroína | saluda solo con el gesto |

---

## Entregado por el taller

El taller entregó 5 tandas (entregas 1, 2, 3a, 3b y 3c, submódulo en `8ba7f2a`). El juego ya las usa o las usa en la fase que toca:

| Pieza | Dónde se usa |
|---|---|
| Íconos de cartel (`ui.iconos_cartel`) | F1b, panel del cartel |
| Íconos del HUD y la pausa (`icono_pausa`, `icono_secreto`, `icono_zona`, `icono_luna`, `icono_sonido`, `icono_silencio`, `icono_calidad`, `icono_jugadora`, `icono_peque`, `icono_jugar`, `icono_guardado`) | HUD (F1a ya usa `icono_zona` e `icono_secreto`), F1b |
| Sonidos `descubrir`, `secreto`, `elegir`, `guardado` | F1a banners, F1b selección y fogatas |
| `campamento_fogata` en los 3 puntos de guardado | F1a, con brasas y humo |
| Botín de nivel bajo (24 mágicos, 8 raros, 2 legendarios del Claro Escondido) | F3 |
| Tronco y copa por separado | F1a, solo la copa se vuelve transparente |
| Pasto alto que se aparta (`apartar_izq`, `apartar_der`) | F1a |
| El Abuelo Roble sonríe (`sonreir`, `tronco_sonreir`) | F1b, al tocarlo |
| Pasos por superficie (capa `superficie` y `paso_<superficie>_<0..2>`) | F1a |
| `musica_titulo`, logo `ui.logo` | F1b, pantalla de título |
| Cambios al mapa: guarida del trol, ruinas, colina goblin, anillo de las hadas, praderas, menos piedritas | F1a |
| Postales nuevas: `bosque_profundo`, `claro_escondido`, `lago_espejo`, `campo_calabazas`, `las_alturas` | F1a, las capturas salen solas desde el mapa |
| Flecha (`proyectil_flecha_<dir>`, `impacto_flecha`) | F2 |
| Magia de naturaleza (`proyectil_naturaleza_<dir>`, `impacto_naturaleza`, `nova_naturaleza`) | F2 |
| Íconos de habilidad (`ui.habilidades`) | F2 |
| `arco`, `esquiva`, `bloqueo`, `thor_rescate` | F2 |
| Trol grande (celda 64) | F2 |
| Thor con todas las animaciones en las 5 armaduras | F3 |
| Thor cava (`dig`, `fx.tierra_cavada`) | F3 |
| Minotauro grande (celda 96), `aviso_carga`, `onda_pisoton` | F4 |
| `ui.continuara` | F4 |
| Íconos de la app (`manifest.app`) y `ui.girar_tablet` | F5 |
| F8 rebanada: la Catedral (mapa, losas, muros tallados), columnas, arco roto, braseros, pedestal de brasas, raíces, escombros, haz de luz, luciérnaga turquesa, Guardián de cobre, `musica_catedral`, `ambiente_catedral` | F8 |
| F8 completo: `puente_piedra`, `losa_hundida_0/1`, `forja_0` a `forja_3`, `brasa`, `campana` y `campana_libre`, raicita, vigía de las raíces, Guardián de la Campana (celda 96) | F8 |

---

## Sonidos para revisar

Se llena en F0 cuando Rick oiga todo en la sala del kit (`?kit=1`). Formato: nombre, qué suena mal, cómo debería sonar.

- (vacío)
