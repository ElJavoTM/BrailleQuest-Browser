# BrailleQuest — Planificación y propuesta

> Versión 0.2 · 2026-10-11 · Complementa a [REQUISITOS.md](REQUISITOS.md)

---

## 1. Mis sugerencias principales

1. **El braille ES el combate.** No hagas un RPG con preguntas de braille entre medias; haz que escribir `f-u-e-g-o` en 6 teclas *lance* la bola de fuego. Cuanto más directa la conexión, más aprendizaje por minuto.
2. **Codificación multisensorial de cada punto.** Cada punto tiene un color y una nota fijos (y una vibración, cuando se juegue en un móvil Android), así que cada letra se *ve* y *suena* de forma única. La vista manda; el sonido refuerza la memoria y aporta el estímulo que el TDAH busca. Es la idea diferenciadora del proyecto.
3. **Empieza por escribir, no por leer.** Dibujar la celda con `QAZ`/`WSX` es físico, rítmico y activo — mejor para TDAH que mirar puntos pasivamente. Además la mano aprende la *forma* de la celda. Leer viene como segunda habilidad.
4. **Estímulo intenso pero regulable.** Por defecto "jugoso", pero con un botón de *modo calma* siempre visible. TDAH busca estímulo; muchas personas con TDAH también se saturan.
5. **Recompensa = dominio real.** El botín y los niveles salen del algoritmo de repetición espaciada, no de "jugar mucho". Así la gamificación no compite con el aprendizaje.
6. **Validar pronto, empezando por ti:** al final de cada fase te hago una ronda de preguntas (§6). Personas externas y docentes de braille, más adelante.

## 2. Bucle de juego propuesto

```
 ┌── Sesión (10 min = 3 bloques de ~3) ───┐
 │                                        │
 │  Mapa → elige encuentro (1 toque)      │
 │     ↓                                  │
 │  Combate: 6–10 "turnos"                │
 │   · Enemigo muestra/suena una celda    │
 │   · Tú la escribes (QAZWSX) o la lees  │
 │   · Acierto → hechizo + partículas     │
 │   · Fallo → pista sensorial + reintento│
 │     ↓                                  │
 │  Botín sorpresa + cristal de letra     │
 │     ↓                                  │
 │  Micro-pausa → siguiente bloque        │
 │  (se puede parar tras cualquier bloque)│
 │     ↓                                  │
 │  "¡Sesión completa!" → ¿otra? / salir  │
 └────────────────────────────────────────┘
        ↓ (entre sesiones)
  SRS decide qué letras repasar mañana
```

**Tipos de encuentro** (rotan para dar novedad):
- *Duelo*: escribe la letra que ves/oyes.
- *Eco*: oye el acorde de una celda y elige la celda correcta entre varias en pantalla.
- *Espejo*: elige entre 2 celdas confundibles (e/i, d/f…).
- *Forja*: construye una palabra letra a letra para crear un objeto.
- *Jefe*: palabra o frase completa con temporizador **opcional**.

## 3. Mundo (borrador)

| Región | Contenido | Idea temática |
|---|---|---|
| Bosque de los Diez | a–j | Árboles con 4 ramas (puntos 1-2-4-5) |
| Cuevas del Tercer Punto | k–t | Todo tiene una "raíz" extra (punto 3) |
| Costa de las Mareas | u–z | Dos anclas (3 y 6) |
| Ciudad de los Acentos | ñ, w, á é í ó ú ü | Ciudad mestiza, excepciones |
| Torre de los Números | signo de número + 0–9 | Reutiliza el Bosque |
| Biblioteca Viva | mayúsculas, puntuación, frases | Endgame, lectura fluida |

## 4. Stack técnico — navegador, sin instalar nada

> **Decidido (2026-10-11):** el juego se juega **en el navegador**, con **HTML + CSS + JavaScript puro**: sin npm, sin frameworks, sin paso de compilación. Requisito: **cero instalaciones** — solo lo que ya hay en la máquina (navegador, Python 3.12.5 y Node 22, ambos verificados).

| Capa | Elección | Por qué |
|---|---|---|
| Lenguaje | **JavaScript moderno (módulos ES)**, sin dependencias | Corre en cualquier navegador; nada que instalar |
| Interfaz | **HTML + CSS** (DOM) | Celda, menús y HUD nítidos; animaciones CSS baratas |
| Efectos | **CSS animations** + un `<canvas>` para partículas | El "jugo" (brillos, partículas, sacudidas) sin librerías |
| Celda braille | Celda grande con 6 círculos, color por punto, + carácter Unicode (`⠁`) | El Unicode solo es demasiado pequeño para aprender |
| Entrada | **`keydown` / `keyup`** con `event.code` de `Q A Z` / `W S X` | Posición física de la tecla: funciona con cualquier distribución de teclado |
| Sonido | **Web Audio API** (osciladores) | Nota por punto y acorde por celda en tiempo real, latencia de pocos ms |
| Voz | **`speechSynthesis`** con voz `es-ES` (opcional) | Dice la letra al acertar; en macOS usa la voz Mónica del sistema |
| Vibración | **Vibration API** — solo funciona en Android; en escritorio/iPhone se ignora sin error | Gratis cuando se juegue en el móvil |
| SRS | **Leitner/FSRS simplificado** escrito a mano | Sin dependencias; el algoritmo cabe en ~100 líneas |
| Datos | **Cookies propias** (JSON en trozos de < 4 KB) | Sin dependencias; exportar/importar progreso como archivo, más adelante |
| Tests | **`node --test`** (incluido en Node 22) | Prueba `braille.js` y `learning.js` sin instalar nada |
| Servidor local | **`python3 -m http.server`** | Los módulos ES no cargan desde `file://`; esto lo resuelve |

**Cómo se juega:**

```bash
cd braille-quest
./jugar.sh          # arranca python3 -m http.server y abre http://localhost:8000
```

**Entrada con el teclado (signo generador en `QAZ`/`WSX`):**

```
 Teclado            Celda braille
 ┌───┬───┐          ┌───┬───┐
 │ Q │ W │          │ 1 │ 4 │
 └┬──┴┬──┴┐         ├───┼───┤
  │ A │ S │         │ 2 │ 5 │
  └┬──┴┬──┴┐        ├───┼───┤
   │ Z │ X │        │ 3 │ 6 │
   └───┴───┘        └───┴───┘
```

- **Modo alternar (por defecto):** cada tecla enciende/apaga su punto; ves la celda formarse; `Espacio`/`Enter` confirma, `Retroceso` borra.
- **Modo rápido (opcional):** las teclas a la vez; la celda se confirma al soltar la última.
- **Mano derecha (opcional):** `U J M` / `I K ,`.
- Teclado en pantalla con cada tecla del color de su punto.

**Notas técnicas:**
- El audio del navegador necesita un primer clic/tecla del usuario para arrancar → pantalla de inicio "Pulsa cualquier tecla para empezar".
- Las fuentes y sonidos se generan o van incluidos; **ningún recurso externo** (funciona offline).
- La misma web se podrá abrir en el móvil (con entrada táctil de 6 zonas) sin reescribir nada.

## 5. Arquitectura (módulos)

```
braille-quest/
  index.html         punto de entrada
  jugar.sh           arranca servidor local + abre el navegador
  package.json       solo {"type": "module"} para node --test; sin dependencias
  src/
    braille.js       tablas CBE, celda ↔ carácter, validación (puro, 100 % testeado)
    learning.js      SRS, detector de confusiones, currículo (puro)
    input.js         mapa QAZ/WSX (event.code), modo alternar, modo rápido (+ táctil más adelante)
    senses.js        Web Audio, voz, vibración, panel sensorial
    render.js        celda grande, HUD, partículas en canvas
    game.js          escenas: mapa, combate, botín
    storage.js       guardado en cookies (+ exportar/importar)
    main.js          arranque y bucle de escenas
  styles/
    main.css         paleta por punto, animaciones, modo calma
  tests/             node --test
```

Regla: `braille.js` y `learning.js` **no tocan el DOM**. Así se testean con Node y son el núcleo reutilizable.

## 6. Fases y hitos

> **Decidido (2026-10-11):** de momento **no hay testers externos ni entrevistas**. Al final de cada fase, Claude te hace una **ronda de preguntas** a ti (vía preguntas de opción múltiple en el chat) y tus respuestas deciden si se avanza o se ajusta. La validación con terceros queda para más adelante (§6.3).

### 6.1 Fases

| Fase | Entregable | Ronda de preguntas para ti | Criterio para avanzar |
|---|---|---|---|
| **0. Descubrimiento** | Decisiones de [REQUISITOS §10](REQUISITOS.md#10-decisiones-fase-0) cerradas | R0 ✅ | **Completada (2026-10-11)** |
| **1. Prototipo del núcleo** | Celda + entrada QAZ/WSX + color/sonido por punto + letras a–j, sin arte | R1 ✅ | **Completada (2026-10-11)** |
| **2. Vertical slice** | Bosque de los Diez completo: mapa, combate, botín, SRS, panel sensorial | R2 | Reconoces y escribes a–j tras ≤ 5 sesiones y te apetece volver |
| **3. MVP navegador** | Regiones 1–3 (a–z), panel sensorial completo, offline | R3 | Completas a–z y las métricas de juego (§7 de requisitos) tienen sentido en tu uso |
| **4. Contenido completo** | Regiones 4–6, exportación de progreso | R4 | Validas el contenido; tablas braille comprobadas contra la norma CBE |
| **5. Publicación** | Web estática gratuita (p. ej. GitHub Pages), validación externa (§6.3) hecha | R5 | Tablas braille revisadas por un experto antes de publicar |
| **6. (Opcional) Móvil** | Entrada táctil 6 zonas, PWA instalable | — | Si hay demanda |

Cada fase se construye en iteraciones cortas: Claude implementa → tú juegas → ronda de preguntas → ajustes.

### 6.2 Rondas de preguntas (borrador)

**R0 — Descubrimiento** ✅ (respuestas del 2026-10-11)
- Edad → **adolescente (13–17)**
- Uso → **gratuito para otros**
- Equipo → **tú + Claude**
- Estilo visual → **neón geométrico**
- Duración de sesión → **10 min**
- Nombre → **BrailleQuest**

**R1 — Prototipo** ✅ (respuestas del 2026-10-11)
- Entrada → **natural, modo alternar**
- Teclado en pantalla → **muy útil, pero las letras QAZ/WSX destacaban demasiado y liaban** → *ajustado: número del punto en grande, tecla física en pequeño*
- Sonidos por punto → **ayudan**
- Colores → **se distinguen todos**
- Duración → **10 min justos**, pero **la pausa no debe bloquear** → *ajustado: el círculo de respiración se recomienda, `Enter` sigue al momento*
- Estímulo → **poco** → *ajustado: el hechizo vuela de la celda al enemigo, onda expansiva, número de daño, temblor de pantalla y «¡CRÍTICO!» con combo ≥ 5 (todo se apaga con modo calma)*
- Lo más divertido → **el combate**
- Lo que cambiaría → **mejor combate: más efectos, equipables…**

Preguntas originales:
- ¿La entrada `QAZ`/`WSX` te resulta natural? ¿Modo alternar o modo rápido?
- ¿Te ayuda el teclado en pantalla coloreado?
- ¿Los sonidos por punto te ayudan, te dan igual o te molestan?
- ¿Los 10 min se hacen cortos, justos o largos? ¿Ayudan los 3 bloques?
- ¿Los colores por punto se distinguen bien?
- Intensidad de estímulo: ¿poca, justa o demasiada?
- ¿Qué ha sido lo más divertido y lo más aburrido?

**R2 — Vertical slice**
- ¿Cuántas sesiones has jugado y cuánto duraron?
- ¿Qué letras confundes? (lo compararemos con las estadísticas del juego)
- ¿El combate te engancha o se hace repetitivo? ¿En qué momento?
- ¿El botín y los cristales te motivan?
- ¿Has usado el modo calma? ¿Por qué?

**R3 — MVP**
- ¿Sigues jugando a diario sin esfuerzo? Si no, ¿qué te frena?
- ¿Qué tipo de encuentro (Duelo, Eco, Espejo, Forja, Jefe) sobra o falta?
- ¿Te has quedado enganchado más tiempo del que querías? (aviso anti-hiperfoco)
- ¿Qué cambiarías antes de añadir más contenido?

**R4 — Contenido completo**
- ¿Los acentos, números y mayúsculas se entienden bien?
- ¿Puedes leer frases cortas en braille fuera del juego?
- ¿Quieres compartirlo con otras personas?

**R5 — Apertura (opcional)**
- ¿Publicamos? ¿Para quién?
- ¿Buscamos ahora validación externa? (ver §6.3)

### 6.3 Validación externa (obligatoria antes de publicar en la Fase 5)

Como el juego será **gratuito para otros**, antes de publicarlo:
- Revisión de las tablas braille por un **docente/transcriptor de braille** (ONCE / CBE).
- Pruebas con **5 personas con TDAH** (p. ej. vía FEAADAH).
- Medir las métricas de §7 de requisitos con datos reales.

## 7. Backlog de la Fase 1

- [x] Inicializar repo (`git init`, estructura de §5, `jugar.sh`, `node --test`) — *repo sin ningún commit todavía*
- [x] `braille.js`: tabla a–z + ñ, w con tests
- [x] Entrada `QAZ`/`WSX` por `event.code`: modo alternar + modo rápido (+ variante mano derecha)
- [x] Teclado en pantalla con teclas coloreadas por punto
- [x] Sonificación: 6 notas por punto, acorde por celda (Web Audio API)
- [x] Render HTML/CSS de celda grande con color por punto
- [x] Bucle mínimo: muestra letra → escribe → feedback (combate contra enemigo geométrico, 3 bloques con pausa)
- [x] Panel sensorial básico (volumen, voz, animaciones, vibración, teclado, modo calma)
- [x] Juegas el prototipo y respondes la ronda R1 (+ ajustes de R1 aplicados)

**Adelantado de la Fase 2 (hecho, 2026-10-11):**
- [x] Repetición espaciada (Leitner) con desbloqueo progresivo: entra una letra nueva cuando todas las anteriores están dominadas (caja 3), sin tope por sesión
- [x] Revancha tras fallo (RF-07, RF-08)
- [x] Ronda de lectura entre bloques (RF-16)
- [x] Guardado en cookies (RF-40)
- [x] Menú inicial con modos: Aventura, Calentamiento y Práctica de lectura (RF-09)
- [x] Modo **Números**: leer del 1 al 10 (adelanto de la Torre de los Números, RF-09)
- [x] Aventura de **números**: escribir del 1 al 10 en combate (signo + dígitos)

## 8. Pendiente para la Fase 2 (vertical slice)

**Prioridad tras R1** (lo más divertido es el combate y pides más combate, efectos y equipables):
1. Personaje con progresión y **equipables** (RF-12) + **botín sorpresa** que los suelte (RF-33)
2. **Jefe de región** con palabras (RF-13)
3. Más tipos de encuentro y rotación (RF-37) para que el combate no se repita
4. Mapa del mundo (RF-10)
5. El resto de la lista

Requisitos aún sin montar:
- [ ] Mapa del mundo (RF-10) — de momento solo existe el Bosque de los Diez, sin mapa
- [ ] Personaje con progresión y compañero (RF-12)
- [ ] Jefe de región con palabras (RF-13)
- [ ] Botín sorpresa (RF-33) — los cristales de letra (RF-14) ya existen
- [ ] Misiones diarias (RF-15)
- [ ] Más tipos de encuentro: *Eco*, *Espejo*, *Forja* (§2) y rotarlos (RF-37)
- [ ] Mnemotecnias por letra (RF-06)
- [ ] Rachas con perdón (RF-34) y aviso anti-hiperfoco (RF-35)
- [ ] Panel de estadísticas y confusiones (RF-41)
- [ ] Exportar/importar progreso a archivo (RF-40)
- [ ] Validar la paleta de colores con simulación de daltonismo (§11 de requisitos)

Tareas técnicas:
- [ ] Primer commit del repositorio
- [ ] `README.md` con cómo jugar
- [ ] `jugar.sh`: opción de no abrir el navegador del sistema (para usar Simple Browser de VS Code)

## 9. Próximos pasos

1. ~~**Ronda R0**~~ ✅ hecha: adolescente, gratuito, tú + Claude, neón geométrico, sesiones de 10 min, "BrailleQuest".
2. ~~Prototipo de la Fase 1~~ ✅ construido.
3. ~~Ronda R1~~ ✅ hecha y ajustes aplicados → **Fase 1 cerrada**.
4. **Fase 2**: empezar por equipables + botín (RF-12, RF-33), según la prioridad de §8.
