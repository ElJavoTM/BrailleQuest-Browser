# BrailleQuest — Documento de Requisitos

> Versión 0.2 · 2026-10-11 · Estado: **Fase 0 cerrada — listo para prototipo**

---

## 1. Visión

Un RPG corto y rejugable en el que **leer y escribir braille es la mecánica principal**, no un minijuego añadido. Diseñado desde el principio para cerebros con TDAH: sesiones cortas, recompensa inmediata, estímulos sensoriales (sonido, color, vibración) que **refuerzan** el aprendizaje y que el jugador puede **subir o bajar** a su gusto.

**Promesa al jugador:** "En 10 minutos al día, aprende el alfabeto braille completo en 3–4 semanas mientras exploras un mundo de neón."

## 2. Público objetivo

| Perfil | Necesidad principal | Implicación de diseño |
|---|---|---|
| **A. Adolescente (13–17) con TDAH y resto visual adecuado** (principal) | Motivación y constancia para aprender braille | Braille visual como canal principal, reforzado con sonido y vibración |
| **B. Docentes / terapeutas** (secundario) | Seguir el progreso del alumno | Panel de progreso exportable |

> ✅ **Decidido (2026-10-11):** el usuario ve. La interfaz es **visual-first** y **no** necesita adaptarse a baja visión ni ceguera (sin lector de pantalla, sin línea braille, sin modo solo-audio). El sonido y la vibración son **refuerzo multisensorial**, no sustituto de la vista.

> ✅ **Decidido (2026-10-11):** jugador **adolescente (13–17)**. Tono juvenil y directo, con humor; **nada infantil** (sin personajes "de cuento", sin diminutivos ni felicitaciones exageradas). Retos que se sientan como un juego de verdad.

## 3. Alcance del aprendizaje

- **Sistema:** Braille español Grado 1 según la normativa de la **Comisión Braille Española (CBE/ONCE)**.
- **Progresión curricular** (aprovecha la estructura en "series" del braille):

| Nivel | Contenido | Por qué en este orden |
|---|---|---|
| 1 | Letras **a–j** (puntos 1-2-4-5) | Base de todo; solo 4 puntos |
| 2 | Letras **k–t** (= serie 1 + punto 3) | Patrón: "añade el punto 3" |
| 3 | Letras **u, v, x, y, z** (= serie 1 + puntos 3 y 6) | Patrón: "añade 3 y 6" |
| 4 | **ñ, w**, vocales acentuadas, **ü** | Excepciones del español |
| 5 | Signo de **número** (3-4-5-6) + dígitos (= a–j) | Reutiliza la serie 1 |
| 6 | **Mayúsculas** (4-6), puntuación básica | Lectura de frases reales |
| 7 | Palabras y frases cortas, velocidad lectora | Fluidez |

- **Habilidades:** reconocer visualmente (leer), producir (escribir con 6 teclas). El reconocimiento táctil queda como extensión opcional con láminas impresas (§8).
- **Fuera de alcance v1:** estenografía/abreviaturas, braille musical, matemático (CBE), otros idiomas.

## 4. Requisitos funcionales

### 4.1 Núcleo de aprendizaje
- **RF-01** Mostrar una celda braille de 6 puntos con representación visual, sonora y háptica sincronizadas.
- **RF-02** **Entrada espacial con el teclado**: el signo generador se "dibuja" en el teclado, con la misma forma que la celda:

  | Celda | Tecla | | Celda | Tecla |
  |---|---|---|---|---|
  | punto 1 | `Q` | | punto 4 | `W` |
  | punto 2 | `A` | | punto 5 | `S` |
  | punto 3 | `Z` | | punto 6 | `X` |

  Se detecta la **posición física** de la tecla (`event.code`: `KeyQ`, `KeyA`…), no la letra, para que funcione igual con cualquier distribución de teclado (QWERTY, AZERTY…).
- **RF-03** **Modo alternar (por defecto)**: cada tecla enciende/apaga su punto, la celda se ve formarse en pantalla, y `Espacio` o `Enter` confirma. `Retroceso` borra la celda.
- **RF-03b** **Modo rápido (opcional)**: pulsar las teclas a la vez; la celda se confirma al soltar la última.
- **RF-03c** **Variante para mano derecha** (opcional): `U J M` = puntos 1-2-3, `I K ,` = puntos 4-5-6.
- **RF-03d** Teclado en pantalla con las 6 teclas coloreadas con el color de su punto, visible mientras se aprende y ocultable después.
- **RF-04** Repetición espaciada (algoritmo **FSRS** o Leitner) por carácter y por par confundible (p. ej. `e`/`i`, `d`/`f`, `h`/`j`).
- **RF-05** Detección de confusiones frecuentes y ejercicios dirigidos a ellas.
- **RF-06** Mnemotecnias opcionales por letra (visual + frase sonora).
- **RF-07** Los errores castigan poco: el fallo da una pista y reintento inmediato, la letra baja **solo una caja** del repaso espaciado y el combo se queda **a la mitad** (no a cero).
- **RF-08** **Revancha tras un fallo**: la letra fallada vuelve **2 veces más** en la sesión, con 2 turnos de otras letras entre medias. Tiene prioridad sobre las letras nuevas. Fallar otra vez reinicia sus 2 rondas (no se acumulan).

### 4.1b Menú y modos
- **RF-09** **Menú inicial** con los modos de juego, navegable con flechas, números, `Enter` o ratón. `Esc` o el botón *Menú* vuelven a él desde cualquier modo.
  - **Aventura**: la sesión de 3 combates (RF-10 a RF-16). Antes se elige qué aprender: **Letras** (a–j) o **Números** (1–10). En números el signo de número (⠼) ya viene puesto y solo se escriben los dígitos, celda a celda, con un indicador de cuáles van escritas; cada 8 turnos, si hay ≥ 3 números aprendidos y caben en la vida del enemigo, sale una **ronda en orden** del 1 al último aprendido; el hechizo se lanza al completar el número. Progreso, cristales y ronda de lectura propios de cada opción.
  - **Calentamiento**: sin puntuación ni efecto en el progreso. Se elige un grupo (*Mis letras*, Serie 1 a–j, Serie 2 k–t, Serie 3 u–z, ñ/w o *Todas*), se dibuja **cualquier celda** y el juego dice **en directo qué letra es** (también si es de otro grupo, o si no es ninguna letra). Tabla del grupo con mini-celdas: al pulsar una letra se muestra su celda y sus teclas.
  - **Práctica de lectura**: 10 celdas de lectura (RF-16), disponible cuando hay ≥ 3 letras escritas bien al menos una vez. Al terminar, `Enter` hace otras 10 y `Esc` vuelve al menú.
  - **Contar del 1 al 10**: escribir los números del 1 al 10 en orden, en bucle (el signo de número ya viene puesto). Sin enemigo, sin puntuación y sin efecto en el progreso; pista de puntos para los números aún no aprendidos y tras un fallo. El HUD cuenta las vueltas.
  - **Números**: 10 números del 1 al 10 para leer (signo de número ⠼ + dígitos = a–j; el 10 es ⠼⠁⠚). Se teclean con `0`–`9` y se comprueban al tener tantos dígitos como el número; `Retroceso` borra. Pista de 3 opciones y revancha como en la lectura de letras, con estadísticas propias. Siempre disponible.

### 4.2 RPG
- **RF-10** Mapa del mundo dividido en regiones = niveles curriculares (§3).
- **RF-11** **Combate por hechizos:** cada hechizo es una letra/palabra; leerla o escribirla correctamente lo lanza. Combos = racha de aciertos.
- **RF-12** Personaje con progresión (nivel, equipo cosmético, compañero mascota).
  - ✅ **Hecho:** nivel = 1 + caracteres dominados (letras + números). Tres huecos de equipo que se abren por nivel: **Foco** (cómo vuela el hechizo, nivel 1), **Sello** (cómo estalla el impacto, nivel 3) y **Aura** (halo de la celda, nivel 5). 15 objetos (3 iniciales + 12 en cofres) en rareza común, rara y épica. Pantalla **Equipo** en el menú. Pendiente: compañero mascota.
- **RF-13** Jefes de región = palabras o frases que combinan todo lo aprendido.
- **RF-14** Botín y "cristales de letra" que se coleccionan al dominar cada carácter (dominio = SRS, no solo una respuesta correcta).
- **RF-16** **Ronda de lectura** entre bloques, una de cada dos pausas, cuando hay ≥ 3 letras escritas bien al menos una vez: 6 celdas encendidas (sin números de punto) y el jugador **pulsa la letra en el teclado normal**. Con pista de 3 opciones mientras no la haya leído bien nunca, o tras un fallo. Los fallos de lectura tienen revancha (RF-08) y estadísticas propias, separadas de las de escritura. `Esc` la salta.
- **RF-15** Misiones diarias cortas (3 misiones de ~3 min, una por bloque de sesión).

### 4.3 Estímulos sensoriales
- **RF-20** **Sonido por punto:** cada uno de los 6 puntos tiene una nota; una celda suena como un acorde único (sonificación). Columna izquierda graves, derecha agudos.
- **RF-21** **Color por punto** consistente en todo el juego (paleta apta para daltonismo).
- **RF-22** **Patrones de vibración** por celda cuando el dispositivo lo permita (Android); en escritorio e iPhone se omite sin error.
- **RF-23** Voz opcional que pronuncia la letra/palabra al acertar (síntesis de voz del navegador, `es-ES`).
- **RF-24** "Jugo" de feedback: brillos, partículas, sacudida suave, acorde de acierto — todo regulable.
- **RF-25** **Panel sensorial**: control independiente de sonido, voz, vibración, animaciones, partículas, destellos, y un modo "calma" con un solo clic.

### 4.4 Diseño para TDAH
- **RF-30** Sesión estándar de **10 minutos**, dividida en **3 bloques de ~3 min** con mini-recompensa y micro-pausa (5–10 s) entre bloques. Final claro ("¡sesión completa!").
- **RF-30b** Se puede **terminar tras cualquier bloque** sin penalización: el progreso cuenta igual.
- **RF-31** Objetivo visible en todo momento (qué hago ahora + cuánto falta).
- **RF-32** Feedback en **< 100 ms** tras cada respuesta.
- **RF-33** Recompensas variables (botín sorpresa) **sin** mecánicas de casino, compras ni presión.
  - ✅ **Hecho:** un **cofre** al derrotar a cada enemigo, con un objeto que aún no se tiene (nunca repite ni se pierde). La rareza mejora con los aciertos a la primera de ese combate; jugar mal nunca quita el cofre. Se ve en la pausa o al final, con `E` para equiparlo al momento.
- **RF-34** Rachas **con perdón**: "comodín" semanal, sin castigo por días perdidos.
- **RF-35** **Aviso anti-hiperfoco** configurable (sugerencia de pausa a los N minutos).
- **RF-36** Retomar en 1 toque exactamente donde se dejó.
- **RF-37** Variación constante: rotar tipos de ejercicio cada 3–5 ítems y cambiar de tipo de encuentro en cada bloque, para que 10 min no se hagan monótonos.
- **RF-38** Carga de memoria de trabajo mínima: máx. 2–3 caracteres nuevos por sesión.

### 4.5 Progreso y cuenta
- **RF-40** Progreso y ajustes guardados en **cookies propias** del juego (JSON repartido en trozos `bq_0…bq_n` de < 4 KB, caducidad 400 días). Al guardar por primera vez se migra el progreso antiguo de `localStorage`. Pendiente: exportar/importar a archivo (copia de seguridad o cambio de equipo).
- **RF-41** Estadísticas: caracteres dominados, precisión, confusiones, tiempo de práctica.
- **RF-42** Exportación de progreso (CSV / página imprimible) para docentes (perfil B).

## 5. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Legibilidad estándar para usuario vidente: buen contraste, paleta apta para daltonismo, celda braille grande y nítida. **No** se requiere compatibilidad con lectores de pantalla ni modos de baja visión. |
| RNF-02 | Respetar `prefers-reduced-motion` y no usar destellos > 3 Hz (riesgo de epilepsia). |
| RNF-03 | Latencia de entrada → feedback visual < 50 ms, sonoro < 100 ms. |
| RNF-04 | Funciona **offline**, sin red. |
| RNF-05 | Plataforma: **navegador de escritorio** actual (Chrome, Safari, Firefox, Edge) con teclado físico. HTML/CSS/JS sin dependencias ni compilación; se arranca desde la terminal **sin instalar nada**. Móvil, en una fase posterior. |
| RNF-06 | Privacidad (público adolescente): **sin cuentas, sin servidor, sin analítica ni cookies de terceros, sin recursos externos**. Todo el progreso queda en el navegador del jugador. Así no se tratan datos personales de menores. |
| RNF-07 | Tablas braille **validadas** contra la normativa CBE y revisadas por un transcriptor/docente de braille. |
| RNF-08 | Idioma inicial español; textos externalizados (i18n) para futuras traducciones. |

## 6. Restricciones técnicas conocidas

- En **modo rápido**, algunos teclados no registran tantas teclas a la vez (*ghosting*), y pulsar 5–6 teclas con una mano es incómodo → por eso el modo alternar es el predeterminado.
- Hay que ignorar la **repetición automática** de teclas (`event.repeat`) para no duplicar puntos.
- El **audio** del navegador solo arranca tras una interacción del usuario → pantalla inicial "pulsa una tecla".
- Los **módulos ES no cargan desde `file://`** → servir con `python3 -m http.server` (ya instalado).
- **Vibración** solo en Android (Safari/iOS y escritorio no la soportan).
- Las **cookies** se borran al limpiar datos del navegador y caducan como máximo a los 400 días sin jugar → exportar/importar progreso (RF-40).
- Cada cookie admite ~4 KB → el guardado se reparte en varias cookies.
- Las cookies son propias del dominio, sin terceros (RNF-06). Si se publica en una web, habrá que indicarlo en una nota de privacidad (son cookies técnicas, no necesitan consentimiento).

## 7. Métricas de éxito (MVP)

- **Aprendizaje:** el 70 % de quienes completan 15 sesiones reconocen a–z con ≥ 90 % de precisión.
- **Retención:** D1 ≥ 40 %, D7 ≥ 20 %.
- **Sesión:** duración mediana 8–12 min (si es mucho mayor, revisar hiperfoco; si es mucho menor, revisar si 10 min es demasiado).
- **Confort sensorial:** < 10 % de usuarios activan "modo calma" por saturación (si es más, los valores por defecto son demasiado intensos).

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sobrecarga sensorial (muchas personas con TDAH también tienen sensibilidad sensorial) | Alto | Panel sensorial, valores por defecto moderados, modo calma |
| Aprender braille *visual* no se transfiere al *táctil* | Medio | Dejar claro que el objetivo es leer/escribir braille a la vista; extensión opcional con láminas impresas en relieve |
| La gamificación distrae del aprendizaje | Medio | Toda recompensa está ligada a dominio real (SRS) |
| Errores en tablas braille | Alto | Revisión por experto CBE antes de beta |

## 9. Glosario

- **Celda:** matriz de 2×3 puntos (1-2-3 izquierda, 4-5-6 derecha).
- **Signo generador:** la celda de 6 puntos de la que salen todos los signos braille.
- **Teclas `QAZ`/`WSX`:** forman en el teclado dos columnas de 3, igual que la celda; columna `QAZ` = puntos 1-2-3, columna `WSX` = puntos 4-5-6.
- **SRS / FSRS:** repetición espaciada; programa los repasos justo antes de olvidar.

## 10. Decisiones (Fase 0)

1. ~~¿Público principal?~~ → **Resuelto:** persona con TDAH y resto visual adecuado; interfaz visual sin adaptaciones de baja visión.
2. ~~¿Edad?~~ → **Resuelto:** adolescente (13–17). Tono juvenil, nada infantil; privacidad máxima (RNF-06).
3. ~~¿Plataforma?~~ → **Resuelto:** navegador de escritorio, HTML/CSS/JS puro, sin instalaciones. Móvil, más adelante.
4. ~~¿Modelo de negocio?~~ → **Resuelto:** **gratuito para otros**, publicado como web estática. Sin anuncios ni compras. Sugerencia: código abierto (p. ej. licencia MIT) para que otras personas puedan mejorarlo.
5. ~~¿Equipo?~~ → **Resuelto:** **tú + Claude**, sin presupuesto. Todo el arte y sonido se genera con código (CSS/SVG/canvas, Web Audio).
6. ~~¿Estilo artístico?~~ → **Resuelto:** **neón geométrico** (ver §11).
7. ~~¿Duración de sesión?~~ → **Resuelto:** **10 min**, en 3 bloques (RF-30).
8. ~~¿Nombre?~~ → **Resuelto:** **BrailleQuest**.

## 11. Dirección visual: neón geométrico

- **Fondo oscuro** (casi negro azulado) para que los puntos brillen.
- **Formas simples:** enemigos, personaje y mapa hechos con polígonos, líneas y círculos (SVG/CSS). Nada de ilustración.
- **Brillo (glow)** en los puntos activos de la celda, cada uno con el color de su punto.
- **Paleta de 6 colores de punto** distinguibles con daltonismo, comprobada antes de fijarla.
- **Tipografía** del sistema, grande y limpia; sin fuentes externas.
- **Modo calma:** apaga brillos, partículas y animaciones; deja colores planos.
- Los destellos nunca superan 3 parpadeos por segundo (RNF-02).
