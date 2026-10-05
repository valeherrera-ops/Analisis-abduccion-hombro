# Análisis Bioinstrumental de la Abducción de Hombro

Aplicación web académica para la asignatura **Análisis Bioinstrumental del Movimiento Humano**, de la carrera de Kinesiología. Permite cargar un video frontal de una persona realizando elevación lateral bilateral de brazos y cuantificar el ángulo de abducción de ambos hombros mediante estimación de pose.

> **Importante:** la aplicación entrega mediciones descriptivas obtenidas desde el video. No realiza diagnósticos clínicos, no clasifica una diferencia como normal o anormal y no reemplaza una evaluación profesional.

---

## 1. Problemática

La observación visual de la abducción de hombro puede variar entre observadores. El proyecto busca complementar esa observación con datos cuantitativos obtenidos directamente de un video, de manera reproducible y sin inventar valores.

La aplicación calcula:

- ángulo de abducción del hombro derecho;
- ángulo de abducción del hombro izquierdo;
- ángulo máximo alcanzado por cada lado;
- tiempo en que ocurre cada máximo;
- diferencia absoluta entre ambos máximos;
- evolución temporal de ambos ángulos.

---

## 2. Objetivo

Crear una interfaz web funcional que reciba un video real, detecte puntos anatómicos mediante MediaPipe Pose Landmarker y calcule matemáticamente el ángulo de elevación lateral de ambos brazos respecto del tronco.

---

## 3. Gesto motor seleccionado

**Elevación lateral de ambos brazos / abducción bilateral de hombro.**

La persona debe comenzar con los brazos a los costados del cuerpo y elevarlos lateralmente, idealmente mirando de frente a la cámara.

---

## 4. Variables analizadas

### Variable principal

Ángulo de abducción del hombro, en grados, calculado de forma independiente para:

- hombro derecho;
- hombro izquierdo.

### Variable secundaria

Diferencia angular entre los máximos de ambos lados:

```text
Diferencia = |máximo derecho - máximo izquierdo|
```

La diferencia se informa de forma descriptiva. La aplicación no la clasifica como buena, mala, normal, anormal o patológica.

---

## 5. Fuente de los datos

Los datos provienen **del video que carga el usuario**.

No existen valores simulados para los resultados. Para cada instante analizado, MediaPipe estima coordenadas de puntos corporales. Si los puntos necesarios presentan baja confiabilidad, ese frame se descarta y no se reemplaza por un número inventado.

La aplicación toma muestras uniformes a **10 frames por segundo de video**. Esta decisión reduce el costo computacional en el navegador y sigue recorriendo el video completo. Cada muestra corresponde a un instante real decodificado del archivo.

---

## 6. Tecnología utilizada

- HTML5
- CSS3
- JavaScript moderno (módulos ES)
- MediaPipe Tasks Vision 1.0.1
- MediaPipe Pose Landmarker Full
- Chart.js 4.5.1
- Canvas de HTML para dibujar puntos, líneas y etiquetas

No se utiliza backend. El procesamiento principal ocurre en el navegador.

La primera ejecución requiere conexión a internet porque las bibliotecas y el modelo se descargan desde CDN/almacenamiento oficial.

---

## 7. Puntos anatómicos detectados por MediaPipe

Pose Landmarker entrega 33 landmarks corporales. En este proyecto se utilizan seis:

| Punto | Índice MediaPipe |
|---|---:|
| Hombro izquierdo | 11 |
| Hombro derecho | 12 |
| Codo izquierdo | 13 |
| Codo derecho | 14 |
| Cadera izquierda | 23 |
| Cadera derecha | 24 |

MediaPipe etiqueta izquierda y derecha según el cuerpo de la persona, no según el lado de la pantalla.

---

## 8. Cómo se calcula el ángulo de cada hombro

El vértice del ángulo se ubica en el **hombro**.

Para cada lado se forman dos vectores en el plano de la imagen:

1. `hombro → cadera`: representa una referencia aproximada de la dirección del tronco;
2. `hombro → codo`: representa la dirección del brazo proximal o húmero.

El ángulo entre ambos vectores se calcula mediante producto punto:

```text
cos(θ) = (A · B) / (|A| |B|)
θ = arccos(cos(θ))
```

Luego el resultado se convierte de radianes a grados.

### Detalle técnico importante

MediaPipe entrega `x` e `y` normalizados entre 0 y 1. El código **no calcula el ángulo directamente con esos valores**, porque un video rectangular podría distorsionar la geometría. Primero convierte cada coordenada a píxeles reales:

```text
x_pixel = x_normalizado × ancho_del_video
y_pixel = y_normalizado × alto_del_video
```

Después calcula el ángulo con esas coordenadas 2D corregidas por la proporción real del video.

Interpretación geométrica aproximada:

- brazo junto al cuerpo: cercano a 0°;
- brazo a la altura del hombro: cercano a 90°;
- brazo por sobre la cabeza: mayor a 90°.

---

## 9. Por qué se utilizan hombro, codo y cadera

Se necesitan tres puntos para formar dos segmentos que se encuentren en un mismo vértice.

- El **hombro** es el vértice porque el movimiento estudiado ocurre en esa articulación.
- La **cadera** ayuda a representar la dirección del tronco.
- El **codo** ayuda a representar la dirección del brazo o húmero.

Usar el codo en vez de la mano también disminuye la influencia que podría tener la posición de muñeca o mano sobre la medición del hombro.

---

## 10. Control de confiabilidad

Para un frame válido deben detectarse correctamente los seis puntos necesarios.

El código exige un umbral mínimo de **0.60** para:

- `visibility`;
- `presence`.

Si cualquiera de los seis landmarks queda bajo el umbral, ese frame completo se descarta.

La aplicación no interpola ni rellena artificialmente esos datos faltantes.

Si menos del 20% de los frames analizados son válidos, con un mínimo absoluto de 5 frames, el análisis se considera insuficiente y se muestra un mensaje para repetir la grabación en mejores condiciones.

---

## 11. Suavizado de los datos

Se aplica un suavizado ligero mediante **filtro de mediana de 3 puntos**.

Para cada punto interior de la serie se consideran:

```text
[valor anterior, valor actual, valor siguiente]
```

y se utiliza la mediana.

Este método ayuda a reducir pequeños saltos aislados de la estimación de pose. No interpola frames perdidos. Los extremos de la serie se mantienen sin modificar.

Los resultados máximos y el gráfico se calculan sobre esta serie suavizada.

---

## 12. Cómo se obtiene el ángulo máximo

Después de procesar todo el video, la aplicación recorre los frames válidos y busca:

- el mayor ángulo derecho;
- el mayor ángulo izquierdo.

También conserva el tiempo asociado a cada máximo.

Ejemplo conceptual:

```text
máximo derecho = mayor valor encontrado en la serie derecha
máximo izquierdo = mayor valor encontrado en la serie izquierda
```

Los números reales dependen únicamente del video cargado.

---

## 13. Cómo se calcula la diferencia entre ambos hombros

Se utiliza el valor absoluto de la resta entre los máximos:

```text
Diferencia = |máximo derecho - máximo izquierdo|
```

Por ejemplo, si un video real produjera 92° y 88°, la diferencia sería 4°. Ese ejemplo no está programado como resultado fijo.

---

## 14. Cómo se procesa el video

Flujo principal:

1. El usuario carga un archivo MP4, WebM o MOV compatible con su navegador.
2. El video se muestra dentro de la página.
3. Al presionar **Analizar movimiento**, se carga MediaPipe Pose Landmarker.
4. La aplicación recorre el video a 10 muestras por segundo.
5. En cada instante, MediaPipe intenta detectar la pose.
6. Se revisa la confiabilidad de hombros, codos y caderas.
7. Si el frame es válido, se calculan ambos ángulos.
8. Si no es válido, se descarta.
9. Se aplica un filtro de mediana de 3 puntos a la serie válida.
10. Se calculan máximos, tiempos y diferencia.
11. Se dibuja el gráfico.
12. Se captura el frame cercano a la mayor elevación conjunta.
13. Se genera una interpretación descriptiva sin diagnóstico.

---

## 15. Cómo se genera el gráfico

Se utiliza Chart.js.

- Eje X: tiempo del video en segundos.
- Eje Y: ángulo de abducción en grados.
- Curva 1: hombro derecho.
- Curva 2: hombro izquierdo.
- Punto especial: máximo derecho.
- Punto especial: máximo izquierdo.

Los puntos del gráfico se generan desde `analysisRows`, que contiene los datos válidos calculados desde el video.

---

## 16. Frame de máxima elevación

La aplicación busca el frame válido con el mayor promedio entre ambos ángulos:

```text
(ángulo derecho + ángulo izquierdo) / 2
```

En ese instante captura el video y dibuja encima:

- hombro derecho;
- codo derecho;
- cadera derecha;
- hombro izquierdo;
- codo izquierdo;
- cadera izquierda;
- líneas hombro-codo;
- líneas hombro-cadera;
- ambos ángulos.

La elección por promedio se utiliza solo para seleccionar una imagen representativa de máxima elevación bilateral. Los máximos individuales siguen calculándose por separado.

---

## 17. Requisitos y dependencias

### Navegador recomendado

- Google Chrome moderno
- Microsoft Edge moderno
- Firefox moderno
- Safari moderno, sujeto a compatibilidad con el formato de video

### Conexión

Se requiere conexión a internet al menos para descargar:

- MediaPipe Tasks Vision;
- modelo Pose Landmarker Full;
- Chart.js.

### Formatos de video

- MP4: recomendado;
- WebM: compatible en navegadores modernos;
- MOV: depende del códec y del navegador.

Para máxima compatibilidad, se recomienda MP4 con video H.264.

---

## 18. Cómo ejecutar la aplicación

### Opción recomendada: servidor local simple

No se recomienda abrir `index.html` directamente con doble clic porque algunos navegadores restringen módulos JavaScript cuando se usan desde `file://`.

#### Con Python instalado

Abra una terminal dentro de la carpeta del proyecto y ejecute:

```bash
python -m http.server 8000
```

Luego abra en el navegador:

```text
http://localhost:8000
```

#### Con VS Code

También puede instalar la extensión **Live Server**, abrir `index.html` y elegir **Open with Live Server**.

---

## 19. Cómo publicarla en internet

### GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Suba `index.html`, `style.css`, `script.js` y `README.md` a la raíz del repositorio.
3. En GitHub abra **Settings → Pages**.
4. En **Build and deployment**, seleccione la rama principal (`main`) y la carpeta raíz (`/root`).
5. Guarde los cambios.
6. GitHub entregará un enlace público.

### Netlify

1. Ingrese a Netlify.
2. Cree un nuevo sitio.
3. Arrastre la carpeta del proyecto o conecte el repositorio de GitHub.
4. Como es un proyecto estático, no necesita comando de compilación.

### Vercel

1. Cree un proyecto nuevo.
2. Importe el repositorio.
3. Seleccione configuración de sitio estático.
4. Publique.

---

## 20. Estructura de archivos

```text
abduccion_hombro_app/
├── index.html
├── style.css
├── script.js
└── README.md
```

### `index.html`

Contiene la estructura visible de la aplicación:

- título;
- instrucciones;
- carga del video;
- reproductor;
- botones;
- tarjetas de resultados;
- canvas del gráfico;
- canvas del frame máximo;
- interpretación.

### `style.css`

Controla la presentación:

- colores;
- tarjetas;
- botones;
- distribución responsive;
- barra de progreso;
- adaptación a computador y celular.

### `script.js`

Contiene toda la lógica funcional:

- carga y validación del video;
- inicialización de MediaPipe;
- análisis frame a frame muestreado;
- control de confiabilidad;
- cálculo de ángulos;
- filtro de mediana;
- máximos y diferencia;
- superposición gráfica;
- Chart.js;
- captura del frame máximo;
- mensajes de error;
- reinicio.

### `README.md`

Documenta la problemática, metodología, cálculos, ejecución, publicación y limitaciones del proyecto.

---

## 21. Limitaciones del análisis

### 1. Un video frontal es una representación 2D de un movimiento 3D

La abducción real ocurre en tres dimensiones. La cámara registra una proyección plana. Si el brazo se mueve hacia adelante o hacia atrás, el ángulo observado en la imagen puede diferir del ángulo anatómico real.

### 2. La rotación del tronco modifica la proyección

Si la persona gira, inclina o desplaza el tronco, cambian las coordenadas observadas y puede modificarse la medición.

### 3. La cámara debe estar bien posicionada

Una cámara inclinada, muy alta, muy baja o desplazada lateralmente puede introducir errores de perspectiva.

### 4. La ropa y la oclusión afectan la estimación

Ropa muy holgada, poca luz, brazos fuera de cuadro o partes del cuerpo tapadas pueden reducir la confiabilidad de MediaPipe.

### 5. MediaPipe estima landmarks, no palpa referencias óseas

Los puntos son estimaciones computacionales basadas en imagen. No equivalen exactamente a marcadores biomecánicos físicos ni a una goniometría clínica estandarizada.

### 6. No se corrige movimiento escapular ni compensaciones específicas

El cálculo describe el ángulo visual entre brazo y tronco. No separa movimiento glenohumeral de contribución escapulotorácica.

### 7. Muestreo temporal

La aplicación utiliza 10 muestras por segundo. Movimientos extremadamente rápidos podrían alcanzar un pico entre dos muestras y ese máximo podría no quedar registrado exactamente.

### 8. No es una herramienta diagnóstica

Los resultados sirven para análisis descriptivo académico y no para diagnosticar lesiones o patologías.

---

## 22. Partes del código que conviene saber explicar al profesor

### A. Los índices de MediaPipe

Debe poder explicar que los puntos relevantes son:

- 11 y 12: hombros;
- 13 y 14: codos;
- 23 y 24: caderas.

### B. El cálculo del ángulo

La función principal es:

```js
calculateShoulderAngle(...)
```

Debe explicar que:

1. convierte coordenadas normalizadas a píxeles;
2. crea un vector hombro-cadera;
3. crea un vector hombro-codo;
4. calcula el producto punto;
5. aplica `Math.acos`;
6. convierte el resultado a grados.

### C. El filtro de confianza

La función:

```js
requiredLandmarksAreReliable(...)
```

descarta frames si los puntos necesarios tienen baja visibilidad o presencia.

### D. El procesamiento del video

La función:

```js
analyzeMovement()
```

recorre el video completo, solicita cada instante, ejecuta MediaPipe y guarda solo datos válidos.

### E. El suavizado

La función:

```js
applyLightMedianSmoothing(...)
```

reduce pequeños saltos aislados usando la mediana de tres puntos.

### F. Los máximos

La función:

```js
calculateSummary(...)
```

busca el mayor valor derecho, el mayor izquierdo, los tiempos correspondientes y la diferencia absoluta.

### G. El gráfico

La función:

```js
renderChart(...)
```

toma los datos reales de `analysisRows` y los representa con Chart.js.

### H. El frame de máxima elevación

La función:

```js
renderMaximumFrame(...)
```

captura el video en el instante de mayor elevación bilateral promedio y dibuja los puntos y líneas sobre la imagen.

---

## 23. Explicación corta para una presentación oral

> “La aplicación usa MediaPipe para identificar hombros, codos y caderas en un video frontal. Para cada lado se construyen dos vectores con vértice en el hombro: uno hacia la cadera, que representa el tronco, y otro hacia el codo, que representa el brazo. A partir del producto punto se calcula el ángulo entre ambos vectores. Los frames con baja confiabilidad se descartan. Con los datos válidos se obtiene la evolución temporal, el máximo de cada hombro y la diferencia entre ambos. Finalmente, Chart.js grafica los ángulos a lo largo del tiempo. Como el video es 2D y el movimiento humano es 3D, el resultado es una estimación descriptiva y no un diagnóstico clínico.”

---

## 24. Referencias técnicas principales

- Google MediaPipe Pose Landmarker para Web: documentación oficial de Google AI Edge.
- Modelo `pose_landmarker_full.task` publicado en el repositorio oficial de modelos MediaPipe.
- Chart.js 4.5.1.

