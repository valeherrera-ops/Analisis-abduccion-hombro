# Análisis Bioinstrumental de la Zancada

Aplicación web académica para la asignatura **Análisis Bioinstrumental del Movimiento Humano** de Kinesiología.

## 1. Nombre del proyecto

**Análisis Bioinstrumental de la Zancada**

La aplicación analiza una **zancada hacia adelante (forward lunge)** a partir de un video grabado de perfil.

## 2. Objetivo

Cuantificar el movimiento de la rodilla durante una zancada mediante estimación de pose, evitando que la evaluación dependa únicamente de una apreciación visual subjetiva.

La aplicación:

- permite cargar un video local;
- permite seleccionar pierna derecha o izquierda;
- detecta cadera, rodilla y tobillo con MediaPipe Pose Landmarker;
- calcula el ángulo interno de la rodilla a lo largo del video;
- descarta frames donde los puntos requeridos no tienen suficiente confianza;
- entrega indicadores numéricos;
- genera un gráfico ángulo-tiempo;
- muestra una captura del instante correspondiente al menor ángulo detectado.

No realiza diagnóstico clínico ni clasifica el movimiento como correcto, incorrecto, normal, anormal o patológico.

## 3. Variable analizada

La variable principal es el **ángulo interno de rodilla en grados**.

Se utilizan tres puntos anatómicos de la pierna seleccionada:

1. cadera;
2. rodilla;
3. tobillo.

El vértice del ángulo es la **rodilla**.

En la convención utilizada por esta aplicación:

- una rodilla cercana a la extensión tiene un ángulo próximo a 180°;
- el ángulo disminuye al aumentar la flexión;
- por eso, el **momento de máxima flexión** se identifica como el momento en que aparece el **menor ángulo** de rodilla dentro del video.

## 4. Tecnologías utilizadas

- **HTML5**: estructura de la interfaz.
- **CSS3**: diseño responsive.
- **JavaScript**: lógica de carga, procesamiento, cálculo y resultados.
- **MediaPipe Tasks Vision / Pose Landmarker 1.0.1**: estimación de pose.
- **Chart.js 4.5.1**: gráfico de ángulo versus tiempo.
- **Canvas API**: dibujo de puntos, segmentos, ángulo y captura del frame.

No se utiliza backend.

### Recursos externos cargados por la aplicación

MediaPipe:
- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs`
- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm`

Modelo Pose Landmarker Lite:
- `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`

Chart.js:
- `https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js`

Por esta razón, la primera ejecución necesita conexión a Internet para descargar las bibliotecas y el modelo.

## 5. Cómo funciona el procesamiento

### Paso 1: carga del video

El usuario carga un archivo MP4, MOV o WebM.

El video se mantiene en el navegador mediante `URL.createObjectURL()`. La aplicación no necesita subirlo a un servidor propio.

### Paso 2: selección de pierna

La interfaz permite escoger:

- pierna derecha;
- pierna izquierda.

Los índices de MediaPipe utilizados son:

| Punto | Izquierda | Derecha |
|---|---:|---:|
| Cadera | 23 | 24 |
| Rodilla | 25 | 26 |
| Tobillo | 27 | 28 |

### Paso 3: estimación de pose

MediaPipe Pose Landmarker procesa los cuadros del video en modo `VIDEO`.

Cuando el navegador admite `requestVideoFrameCallback`, se procesan los frames que realmente va presentando el elemento `<video>` durante la reproducción. La aplicación reduce temporalmente la velocidad de reproducción para disminuir la pérdida de frames en equipos modestos.

Si esa API no existe, se utiliza un fallback que recorre el video en intervalos de 1/30 s.

### Paso 4: control de calidad

Para cada frame se revisa que:

- exista una pose;
- cadera, rodilla y tobillo estén disponibles;
- la visibilidad y presencia de los tres puntos sean al menos 0,5.

Si un frame no cumple estas condiciones, se ignora.

No se interpola ni se inventa un valor para reemplazarlo.

Si el número de detecciones válidas es insuficiente, la aplicación no genera resultados y solicita utilizar un video de mejor calidad.

### Paso 5: conversión a coordenadas de píxel

MediaPipe entrega coordenadas normalizadas.

Antes de calcular el ángulo se convierten a píxeles:

```text
x_pixel = x_normalizado × ancho_video
y_pixel = y_normalizado × alto_video
```

Esto evita distorsionar el ángulo por la relación de aspecto del video.

### Paso 6: cálculo del ángulo

Se construyen dos vectores con origen en la rodilla:

```text
u = cadera - rodilla
v = tobillo - rodilla
```

Luego se usa el producto punto.

## 6. Fórmula del ángulo

La fórmula es:

```text
θ = arccos[(u · v) / (|u| |v|)]
```

Donde:

- `u · v` es el producto punto;
- `|u|` es la magnitud del vector rodilla→cadera;
- `|v|` es la magnitud del vector rodilla→tobillo;
- `θ` es el ángulo interno de rodilla.

En el código está implementado en la función:

```javascript
calculateKneeAngle(hip, knee, ankle)
```

dentro de `script.js`.

### Indicadores finales

A partir de todos los frames válidos se calcula:

- ángulo mínimo;
- ángulo máximo;
- rango angular = máximo - mínimo;
- tiempo del video en que aparece el ángulo mínimo.

## 7. Cómo ejecutar la aplicación

### Opción recomendada: servidor local

No se recomienda abrir `index.html` haciendo doble clic si el navegador aplica restricciones a módulos o recursos externos.

#### Con Python

Ubíquese en la carpeta del proyecto y ejecute:

```bash
python -m http.server 8000
```

Luego abra:

```text
http://localhost:8000
```

#### Con Visual Studio Code

También puede utilizar la extensión **Live Server** y abrir `index.html` con esa extensión.

## 8. Cómo publicarla

### GitHub Pages

1. Cree un repositorio en GitHub.
2. Suba estos archivos a la raíz:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
3. Abra **Settings → Pages**.
4. En **Build and deployment**, seleccione publicación desde una rama.
5. Seleccione la rama principal y la carpeta raíz `/`.
6. Guarde los cambios.
7. GitHub entregará una URL pública.

### Netlify

1. Entre a Netlify.
2. Cree un sitio nuevo.
3. Suba la carpeta del proyecto o vincule el repositorio de GitHub.
4. No es necesario configurar un comando de build.
5. Use la raíz del proyecto como carpeta publicada.

## 9. Estructura de archivos

```text
analisis_zancada/
├── index.html
├── style.css
├── script.js
└── README.md
```

### `index.html`

Contiene:

- título y subtítulo;
- carga de video;
- reproductor;
- selector de pierna;
- botones;
- indicador de progreso;
- tarjetas de resultados;
- canvas del gráfico;
- captura de máxima flexión;
- interpretación;
- instrucciones de grabación.

### `style.css`

Contiene todo el diseño visual:

- fondo claro;
- tarjetas;
- botones;
- diseño responsive;
- grilla de resultados;
- estilos de progreso y mensajes;
- adaptación a computador y celular.

### `script.js`

Contiene toda la lógica funcional:

- validación y carga del video;
- carga de MediaPipe;
- análisis de los frames;
- selección de landmarks;
- control de confianza;
- cálculo del ángulo;
- dibujo sobre el video;
- almacenamiento de resultados;
- cálculo de mínimo, máximo y rango;
- gráfico con Chart.js;
- captura del momento de máxima flexión;
- manejo de errores;
- reinicio.

## Cómo se genera el gráfico

La función `renderChart()` toma el arreglo `analysisData`, donde cada elemento tiene:

```javascript
{
  time: tiempo_en_segundos,
  angle: angulo_en_grados,
  landmarks: puntos_detectados
}
```

Chart.js crea:

1. una serie de línea para el ángulo de rodilla a través del tiempo;
2. una serie tipo `scatter` con un único punto para destacar el ángulo mínimo.

## Qué hace MediaPipe en este proyecto

MediaPipe Pose Landmarker es un modelo de estimación de pose.

A partir de una imagen del video devuelve landmarks corporales. Este proyecto no le pide a MediaPipe que calcule directamente el ángulo de rodilla.

MediaPipe solo aporta las coordenadas estimadas de:

- cadera;
- rodilla;
- tobillo.

El cálculo biomecánico del ángulo se realiza después, en JavaScript, usando geometría vectorial.

## Qué debería poder explicar frente al profesor

Es importante poder explicar al menos lo siguiente:

1. **Cuál es la variable medida**  
   Ángulo interno de rodilla en grados durante la zancada.

2. **Qué puntos anatómicos se utilizan**  
   Cadera, rodilla y tobillo de la pierna seleccionada.

3. **Por qué la rodilla es el vértice**  
   Porque se quiere medir el ángulo formado por el segmento muslo y el segmento pierna.

4. **Qué hace MediaPipe**  
   Estima automáticamente la posición de puntos corporales en cada frame.

5. **Qué NO hace MediaPipe**  
   No entrega el resultado biomecánico final ni decide si el movimiento es correcto.

6. **Cómo se calcula el ángulo**  
   Se forman dos vectores desde la rodilla y se aplica producto punto y arccoseno.

7. **Por qué se convierten las coordenadas a píxeles**  
   Para respetar la proporción real entre el ancho y alto del video al realizar el cálculo 2D.

8. **Qué pasa si MediaPipe pierde la pierna**  
   El frame se descarta; no se inventa un valor.

9. **Cómo se identifica la máxima flexión**  
   En esta convención, corresponde al menor ángulo interno de rodilla.

10. **Cómo se genera el gráfico**  
    Se guarda cada par tiempo–ángulo válido y Chart.js los representa como una curva.

11. **Limitación principal**  
    Es un análisis 2D dependiente de la calidad y orientación del video. Una cámara fuera del plano sagital, oclusiones o mala iluminación pueden alterar la estimación.

12. **Por qué no se realizan diagnósticos**  
    La aplicación cuantifica una variable cinemática del video, pero no sustituye una evaluación clínica.

## Limitaciones técnicas importantes

- El análisis depende de que el navegador pueda decodificar el video.
- MOV es un contenedor: algunos archivos MOV pueden usar un códec que un navegador específico no soporte.
- La estimación se realiza sobre una imagen 2D.
- La precisión depende de la visibilidad corporal y de una cámara lo más perpendicular posible al plano de movimiento.
- Si el equipo no procesa todos los frames durante la reproducción, el navegador puede presentar menos frames al análisis.
- La aplicación no calibra distancias ni fuerzas; solo analiza el ángulo 2D de rodilla.
