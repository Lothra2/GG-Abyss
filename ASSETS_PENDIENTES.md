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

### 30. F8, lo que falta de la Catedral (se hace en el taller en las próximas entregas)

| Recurso | Tamaño | Cuadros y tiempos | Apoyo / sólido | Uso |
|---|---|---|---|---|
| `puente_piedra` | 128 x 48 | 1 | capa suelo, se camina | la nave inundada |
| `forja` | 160 x 128 | apagada 1, 1 a 3 brasas 1 cada una, encendida 8 a 10 fps | apoyo [80, 120], sólido 120 x 20 | el centro del mundo |
| `brasa` | 32 x 32 | 8 a 10 fps | haz ámbar | las tres brasas que se recogen |
| `campana` | 96 x 128 | quieta 1, sonar 6 a 12 fps | capa alta | la arena del jefe |
| `puerta_atajo` | 64 x 64 | cerrada 1, abrir 6 a 10 fps | sólida cerrada | el atajo de los claustros |
| Vigía de las raíces | celda 48, pivote [24, 46] | idle, walk, cast 6 a 12, hit, die, 8 direcciones | radio 8 | a distancia, proyectil violeta `proyectil_raiz_*` 4 cuadros |
| Raicita | celda 32, pivote [16, 30] | idle 4, run 6 a 12, attack 4 a 12, hit, die | radio 6 | pequeña, se distrae con Thor |
| Guardián de la Campana | celda 96, pivote [48, 93] | idle, walk, attack_heavy 7 a 12, golpe_campana 8 a 10, llamar_raices 8 a 10, hit, die, liberado | radio 30 | jefe |
| `aviso_onda` y `aviso_raiz` | 192 x 192 y 48 x 48, 8 cuadros | — | capa suelo | patrones del jefe |
| Audio | — | — | — | `musica_jefe_campana`, `musica_forja`, `ambiente_agua_negra`, `fuelle`, `campana`, `brasa_recoger`, `raices` |

- **Mientras tanto:** la nave y el atajo están cerrados con `raices_cortina`, y la Catedral no tiene jefe todavía (el chip del objetivo no lo pide).

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

---

## Sonidos para revisar

Se llena en F0 cuando Rick oiga todo en la sala del kit (`?kit=1`). Formato: nombre, qué suena mal, cómo debería sonar.

- (vacío)
