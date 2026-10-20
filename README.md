# BrailleQuest

**▶ Pruébalo en el navegador: [eljavotm.github.io/BrailleQuest-Browser](https://eljavotm.github.io/BrailleQuest-Browser/)**. No hace falta descargar ni instalar nada.

Un juego de navegador para aprender **braille español** (Grado 1, normativa CBE/ONCE) escribiendo con el teclado. Escribir braille es la mecánica del juego: cada letra bien escrita lanza un hechizo contra el enemigo.

- sesiones cortas, de unos 10 minutos;
- recompensa inmediata;
- cada punto de la celda tiene su color y su nota;
- un **modo calma** para bajar los estímulos cuando hace falta.

## Cómo se juega

La celda braille se **dibuja con el teclado**, con la misma forma que tiene:

| Celda | Tecla | | Celda | Tecla |
|---|---|---|---|---|
| punto 1 | `Q` | | punto 4 | `W` |
| punto 2 | `A` | | punto 5 | `S` |
| punto 3 | `Z` | | punto 6 | `X` |

Pulsa las teclas para encender los puntos y confirma la celda con `Enter` o `Espacio`; `Retroceso` la borra. El juego lee la posición física de cada tecla, así que funciona con cualquier distribución de teclado.

En **Ajustes** puedes cambiar a la mano derecha (`U J M` / `I K ,`) o al modo rápido, en el que pulsas todas las teclas a la vez y la celda se confirma al soltarlas.

## Modos

- **Aventura**: tres combates de unos tres minutos con letras o con números, con rondas de lectura entre medias. El último combate de letras es contra el **Guardián del Bosque**, que pide palabras enteras. Las letras nuevas se desbloquean cuando dominas las anteriores.
- **Equipo**: los cofres de la Aventura dan objetos que cambian cómo se ven los hechizos (foco, sello y aura). El nivel sale de las letras que dominas de verdad, no del tiempo de juego.
- **Calentamiento**: dibuja cualquier celda y el juego te dice qué letra o signo es. No hay puntuación.
- **Práctica de lectura**: lee celdas de las letras que ya sabes escribir.
- **Números** y **Contar del 1 al 10**: el signo de número (⠼) seguido de los dígitos, que se escriben como las letras a–j.
- **Leer un PDF**: sube un texto en braille y tradúcelo carácter a carácter. Se explica en la siguiente sección.

### Leer un PDF

1. Elige un PDF o suéltalo sobre la pantalla. El juego enseña sus líneas una a una, con una casilla debajo de cada celda.
2. Escribe en tinta lo que dice cada celda. El signo de mayúscula va junto con su letra, así que `⠨⠑` se escribe `E`.
3. Al acabar cada línea, el juego la corrige y marca los fallos en rojo. Con `Enter` vuelves a escribir solo lo que está mal; con `Tab`, ves la solución.

Para moverte, `↑` `↓` cambian de línea y `←` `→` se mueven entre letras. Lo que escribes en cada línea se queda guardado aunque cambies de línea o cierres el navegador.

Funciona con PDFs hechos con una fuente braille como **EDICO** (la de la ONCE) o escritos con braille Unicode (⠁⠃⠉…). Un PDF escaneado, que solo es una imagen de los puntos, no se puede leer.

## Arrancarlo

Hace falta un servidor local, porque los módulos de JavaScript no cargan desde `file://`. Solo se necesita **Python 3**:

```sh
./jugar.sh
```

Esto arranca `serve.py` y abre el juego en el navegador. `serve.py` es un servidor sin caché, para que el navegador cargue siempre la última versión de los archivos. Si no usas `serve.py` y un cambio no aparece, recarga sin caché con `Cmd+Shift+R` (`Ctrl+Shift+R` en Windows y Linux).

No hay que instalar nada ni compilar nada: es HTML, CSS y JavaScript sin dependencias. La única biblioteca externa es [pdf.js](https://github.com/mozilla/pdf.js), que va incluida en `vendor/` y solo se carga en el modo PDF.

## Tests

```sh
npm test   # o: node --test
```

Las pruebas cubren las partes que no dependen del navegador: la tabla braille, la repetición espaciada, el botín, las palabras, el guardado y la transcripción de PDFs.

## Estructura

```
index.html          pantallas del juego
styles/main.css     estilo (neón geométrico) y animaciones
src/
  main.js           arranque: ajustes, guardado, entrada y panel sensorial
  game.js           escenas: menú, aventura, lectura, equipo…
  braille.js        tabla braille española (letras, tildes, signos, números)
  input.js          teclado como signo generador (QAZ/WSX)
  learning.js       repetición espaciada tipo Leitner y confusiones
  loot.js           personaje, equipo y cofres
  words.js          palabras para el jefe del Bosque
  warmup.js         calentamiento
  pdfreader.js      pantalla «Leer un PDF»
  pdftext.js        texto del PDF línea a línea (pdf.js)
  transcribe.js     celdas → caracteres que hay que escribir, y corrección
  render.js         celda, teclado en pantalla y partículas
  senses.js         sonido, voz y vibración
  storage.js        guardado en cookies propias
  debug.js          herramientas de depuración (en Ajustes)
tests/              pruebas con node:test
docs/               requisitos y planificación del proyecto
vendor/pdfjs/       pdf.js 4.10.38 (Apache-2.0)
```

## Datos y privacidad

Todo se queda en tu navegador:

- el progreso y los ajustes se guardan en cookies propias del juego;
- el PDF que estás traduciendo y lo que llevas hecho se guardan en `localStorage`.

No hay servidor de datos ni servicios de terceros, y los PDF no salen de tu equipo. Desde **Ajustes → Depuración** puedes exportar, importar o borrar el progreso.

## Documentación

- [docs/REQUISITOS.md](docs/REQUISITOS.md): la visión, el público y los requisitos del juego.
- [docs/PLANIFICACION.md](docs/PLANIFICACION.md): el bucle de juego, las fases y las decisiones tomadas.

## Créditos y uso

Este proyecto se ha creado con ayuda de inteligencia artificial.

Cualquiera puede usar, copiar, modificar y compartir BrailleQuest libremente con **fines educativos y sin ánimo de lucro**. pdf.js, incluido en `vendor/pdfjs/`, mantiene su propia licencia (Apache-2.0).
