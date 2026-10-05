import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";

// -----------------------------------------------------------------------------
// CONFIGURACIÓN GENERAL
// -----------------------------------------------------------------------------

const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

// Se analiza el video de forma uniforme a 10 muestras por segundo.
// No se inventan frames intermedios: cada muestra corresponde a un instante real
// del video que el navegador decodifica y MediaPipe analiza.
const TARGET_SAMPLES_PER_SECOND = 10;

// Un landmark debe superar este umbral tanto en visibilidad como en presencia.
const LANDMARK_CONFIDENCE_THRESHOLD = 0.6;

// MediaPipe Pose Landmarker: índices oficiales de los 33 landmarks.
const LANDMARK_INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftHip: 23,
  rightHip: 24,
};

const REQUIRED_LANDMARKS = Object.values(LANDMARK_INDEX);

// -----------------------------------------------------------------------------
// ELEMENTOS DE LA INTERFAZ
// -----------------------------------------------------------------------------

const videoInput = document.getElementById("videoInput");
const loadButton = document.getElementById("loadButton");
const analyzeButton = document.getElementById("analyzeButton");
const resetButton = document.getElementById("resetButton");
const videoElement = document.getElementById("videoElement");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const overlayCanvas = document.getElementById("overlayCanvas");
const overlayContext = overlayCanvas.getContext("2d");
const fileName = document.getElementById("fileName");
const messageBox = document.getElementById("messageBox");
const progressArea = document.getElementById("progressArea");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressDetail = document.getElementById("progressDetail");

const resultsSection = document.getElementById("resultsSection");
const chartSection = document.getElementById("chartSection");
const symmetrySection = document.getElementById("symmetrySection");
const maxFrameSection = document.getElementById("maxFrameSection");
const interpretationSection = document.getElementById("interpretationSection");

const rightMaxElement = document.getElementById("rightMax");
const leftMaxElement = document.getElementById("leftMax");
const differenceMaxElement = document.getElementById("differenceMax");
const rightMaxTimeElement = document.getElementById("rightMaxTime");
const leftMaxTimeElement = document.getElementById("leftMaxTime");
const qualitySummary = document.getElementById("qualitySummary");
const symmetryFormula = document.getElementById("symmetryFormula");
const interpretationText = document.getElementById("interpretationText");
const maxFrameCanvas = document.getElementById("maxFrameCanvas");
const maxFrameContext = maxFrameCanvas.getContext("2d");
const maxFrameCaption = document.getElementById("maxFrameCaption");

// -----------------------------------------------------------------------------
// ESTADO DE LA APLICACIÓN
// -----------------------------------------------------------------------------

let currentVideoUrl = null;
let poseLandmarker = null;
let visionFileset = null;
let analysisRows = [];
let chartInstance = null;
let overlayAnimationFrame = null;
let isAnalyzing = false;

// -----------------------------------------------------------------------------
// EVENTOS PRINCIPALES
// -----------------------------------------------------------------------------

loadButton.addEventListener("click", () => videoInput.click());
videoInput.addEventListener("change", handleVideoSelection);
analyzeButton.addEventListener("click", analyzeMovement);
resetButton.addEventListener("click", resetApplication);

videoElement.addEventListener("play", startOverlayLoop);
videoElement.addEventListener("pause", drawOverlayForCurrentTime);
videoElement.addEventListener("seeked", drawOverlayForCurrentTime);
videoElement.addEventListener("timeupdate", () => {
  if (videoElement.paused) drawOverlayForCurrentTime();
});

window.addEventListener("resize", () => {
  if (videoElement.readyState >= 1) resizeOverlayCanvas();
  drawOverlayForCurrentTime();
});

// -----------------------------------------------------------------------------
// CARGA Y VALIDACIÓN DEL VIDEO
// -----------------------------------------------------------------------------

function handleVideoSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  clearMessage();
  clearPreviousResults();

  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["mp4", "webm", "mov"];

  if (!allowedExtensions.includes(extension)) {
    showMessage(
      "El archivo seleccionado no corresponde a un formato admitido. Utilice MP4, WebM o MOV.",
      "error"
    );
    videoInput.value = "";
    return;
  }

  if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
  currentVideoUrl = URL.createObjectURL(file);

  fileName.textContent = file.name;
  analyzeButton.disabled = true;
  videoElement.pause();
  videoElement.removeAttribute("src");
  videoElement.load();
  videoElement.src = currentVideoUrl;

  const onLoadedMetadata = () => {
    if (!Number.isFinite(videoElement.duration) || videoElement.duration <= 0) {
      showMessage("No fue posible leer la duración del video.", "error");
      return;
    }

    videoPlaceholder.classList.add("hidden");
    videoElement.style.display = "block";
    resizeOverlayCanvas();
    analyzeButton.disabled = false;
    showMessage(
      `Video cargado correctamente. Duración: ${formatTime(videoElement.duration)}.`,
      "success"
    );
  };

  const onVideoError = () => {
    analyzeButton.disabled = true;
    showMessage(
      "El navegador no pudo reproducir este archivo. Si es MOV, intente convertirlo a MP4 (H.264) o utilice otro navegador moderno.",
      "error"
    );
  };

  videoElement.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
  videoElement.addEventListener("error", onVideoError, { once: true });
  videoElement.load();
}

// -----------------------------------------------------------------------------
// INICIALIZACIÓN DE MEDIAPIPE
// -----------------------------------------------------------------------------

async function createPoseLandmarker() {
  if (poseLandmarker) {
    poseLandmarker.close();
    poseLandmarker = null;
  }

  if (!visionFileset) {
    visionFileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_CDN}/wasm`);
  }

  const commonOptions = {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  };

  // Se intenta usar GPU por rendimiento. Si el navegador/dispositivo no la admite,
  // se vuelve a crear el modelo en CPU para priorizar compatibilidad.
  try {
    poseLandmarker = await PoseLandmarker.createFromOptions(visionFileset, {
      ...commonOptions,
      baseOptions: {
        ...commonOptions.baseOptions,
        delegate: "GPU",
      },
    });
    return "GPU";
  } catch (gpuError) {
    console.warn("GPU no disponible; se utilizará CPU.", gpuError);
    poseLandmarker = await PoseLandmarker.createFromOptions(visionFileset, {
      ...commonOptions,
      baseOptions: {
        ...commonOptions.baseOptions,
        delegate: "CPU",
      },
    });
    return "CPU";
  }
}

// -----------------------------------------------------------------------------
// ANÁLISIS COMPLETO DEL MOVIMIENTO
// -----------------------------------------------------------------------------

async function analyzeMovement() {
  if (isAnalyzing) return;

  if (!currentVideoUrl || !videoElement.src) {
    showMessage("Primero debe cargar un video.", "error");
    return;
  }

  if (!Number.isFinite(videoElement.duration) || videoElement.duration <= 0) {
    showMessage("No fue posible leer correctamente el video cargado.", "error");
    return;
  }

  if (typeof window.Chart === "undefined") {
    showMessage(
      "No fue posible cargar Chart.js. Revise la conexión a internet y vuelva a cargar la página.",
      "error"
    );
    return;
  }

  isAnalyzing = true;
  analyzeButton.disabled = true;
  loadButton.disabled = true;
  videoElement.pause();
  clearPreviousResults();
  clearMessage();
  showProgress(0, "Preparando el modelo de estimación de pose.");

  try {
    const delegateUsed = await createPoseLandmarker();
    showProgress(2, `Modelo cargado. Procesando el video con ${delegateUsed}.`);

    const duration = videoElement.duration;
    const interval = 1 / TARGET_SAMPLES_PER_SECOND;
    const totalSamples = Math.max(1, Math.floor(duration / interval) + 1);
    const validRows = [];

    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
      const requestedTime = Math.min(sampleIndex * interval, Math.max(0, duration - 0.001));

      await seekVideo(requestedTime);

      // El timestamp debe crecer de manera monótona en modo VIDEO.
      const timestampMs = sampleIndex * Math.round(1000 / TARGET_SAMPLES_PER_SECOND);
      const result = poseLandmarker.detectForVideo(videoElement, timestampMs);

      const landmarks = result.landmarks?.[0];
      if (landmarks && requiredLandmarksAreReliable(landmarks)) {
        const rightAngle = calculateShoulderAngle(
          landmarks[LANDMARK_INDEX.rightShoulder],
          landmarks[LANDMARK_INDEX.rightHip],
          landmarks[LANDMARK_INDEX.rightElbow],
          videoElement.videoWidth,
          videoElement.videoHeight
        );

        const leftAngle = calculateShoulderAngle(
          landmarks[LANDMARK_INDEX.leftShoulder],
          landmarks[LANDMARK_INDEX.leftHip],
          landmarks[LANDMARK_INDEX.leftElbow],
          videoElement.videoWidth,
          videoElement.videoHeight
        );

        if (Number.isFinite(rightAngle) && Number.isFinite(leftAngle)) {
          const row = {
            time: requestedTime,
            rightRaw: rightAngle,
            leftRaw: leftAngle,
            landmarks: copyKeyLandmarks(landmarks),
          };
          validRows.push(row);
          drawPoseOverlay(row.landmarks, rightAngle, leftAngle, overlayCanvas, overlayContext);
        }
      }

      const processed = sampleIndex + 1;
      const percentage = Math.min(99, Math.round((processed / totalSamples) * 100));
      showProgress(
        percentage,
        `Frame analizado ${processed} de ${totalSamples}. Frames válidos: ${validRows.length}.`
      );

      // Permite que el navegador actualice la barra de progreso entre inferencias.
      await nextBrowserPaint();
    }

    const minimumValidFrames = Math.max(5, Math.ceil(totalSamples * 0.2));
    if (validRows.length < minimumValidFrames) {
      throw new AnalysisQualityError(
        "No fue posible detectar de forma confiable los puntos anatómicos necesarios. Intente utilizar un video grabado de frente, con mejor iluminación y con el cuerpo visible."
      );
    }

    analysisRows = applyLightMedianSmoothing(validRows);

    const summary = calculateSummary(analysisRows);
    showProgress(100, "Análisis completado.");
    renderResults(summary, analysisRows.length, totalSamples);
    renderChart(summary);
    renderSymmetry(summary);
    await renderMaximumFrame(summary.combinedPeakRow);
    renderInterpretation(summary);

    showMessage(
      `Análisis completado con ${analysisRows.length} frames válidos de ${totalSamples} analizados.`,
      "success"
    );

    // Deja el video listo al inicio y dibuja la medición precalculada más cercana.
    await seekVideo(0);
    drawOverlayForCurrentTime();
  } catch (error) {
    console.error(error);

    if (error instanceof AnalysisQualityError) {
      showMessage(error.message, "error");
    } else {
      showMessage(
        "Ocurrió un error durante el análisis. Revise la conexión a internet, utilice un navegador moderno y vuelva a intentarlo.",
        "error"
      );
    }
  } finally {
    isAnalyzing = false;
    analyzeButton.disabled = !currentVideoUrl;
    loadButton.disabled = false;
    setTimeout(() => progressArea.classList.add("hidden"), 500);
  }
}

class AnalysisQualityError extends Error {}

// -----------------------------------------------------------------------------
// CONFIABILIDAD DE LANDMARKS
// -----------------------------------------------------------------------------

function requiredLandmarksAreReliable(landmarks) {
  return REQUIRED_LANDMARKS.every((index) => {
    const landmark = landmarks[index];
    if (!landmark) return false;

    const visibility = landmark.visibility ?? 1;
    const presence = landmark.presence ?? 1;

    return (
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      visibility >= LANDMARK_CONFIDENCE_THRESHOLD &&
      presence >= LANDMARK_CONFIDENCE_THRESHOLD
    );
  });
}

function copyKeyLandmarks(landmarks) {
  const copy = {};
  for (const [name, index] of Object.entries(LANDMARK_INDEX)) {
    const point = landmarks[index];
    copy[name] = {
      x: point.x,
      y: point.y,
      z: point.z ?? 0,
      visibility: point.visibility ?? 1,
      presence: point.presence ?? 1,
    };
  }
  return copy;
}

// -----------------------------------------------------------------------------
// CÁLCULO DEL ÁNGULO
// -----------------------------------------------------------------------------

function calculateShoulderAngle(shoulder, hip, elbow, videoWidth, videoHeight) {
  // MediaPipe entrega x e y normalizados entre 0 y 1. Para no distorsionar
  // el ángulo cuando el video no es cuadrado, primero convertimos a coordenadas
  // de píxeles usando el ancho y alto reales del video.
  const shoulderPx = {
    x: shoulder.x * videoWidth,
    y: shoulder.y * videoHeight,
  };
  const hipPx = {
    x: hip.x * videoWidth,
    y: hip.y * videoHeight,
  };
  const elbowPx = {
    x: elbow.x * videoWidth,
    y: elbow.y * videoHeight,
  };

  // Vector 1: hombro -> cadera (referencia del tronco)
  const trunkVector = {
    x: hipPx.x - shoulderPx.x,
    y: hipPx.y - shoulderPx.y,
  };

  // Vector 2: hombro -> codo (dirección del brazo/húmero)
  const armVector = {
    x: elbowPx.x - shoulderPx.x,
    y: elbowPx.y - shoulderPx.y,
  };

  const dotProduct = trunkVector.x * armVector.x + trunkVector.y * armVector.y;
  const trunkMagnitude = Math.hypot(trunkVector.x, trunkVector.y);
  const armMagnitude = Math.hypot(armVector.x, armVector.y);

  if (trunkMagnitude === 0 || armMagnitude === 0) return NaN;

  // El coseno puede quedar levemente fuera de [-1, 1] por redondeo numérico.
  const cosine = clamp(dotProduct / (trunkMagnitude * armMagnitude), -1, 1);
  const radians = Math.acos(cosine);
  return radians * (180 / Math.PI);
}

// -----------------------------------------------------------------------------
// SUAVIZADO LIGERO
// -----------------------------------------------------------------------------

function applyLightMedianSmoothing(rows) {
  // Filtro de mediana de 3 puntos: en cada punto interior se toma la mediana
  // de [anterior, actual, siguiente]. No se interpolan frames faltantes y no se
  // generan trayectorias artificiales. Los extremos mantienen su valor original.
  return rows.map((row, index) => {
    if (index === 0 || index === rows.length - 1) {
      return {
        ...row,
        rightAngle: row.rightRaw,
        leftAngle: row.leftRaw,
      };
    }

    const rightWindow = [rows[index - 1].rightRaw, row.rightRaw, rows[index + 1].rightRaw];
    const leftWindow = [rows[index - 1].leftRaw, row.leftRaw, rows[index + 1].leftRaw];

    return {
      ...row,
      rightAngle: median(rightWindow),
      leftAngle: median(leftWindow),
    };
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// -----------------------------------------------------------------------------
// RESUMEN NUMÉRICO
// -----------------------------------------------------------------------------

function calculateSummary(rows) {
  const rightPeakRow = rows.reduce((maxRow, row) =>
    row.rightAngle > maxRow.rightAngle ? row : maxRow
  );

  const leftPeakRow = rows.reduce((maxRow, row) =>
    row.leftAngle > maxRow.leftAngle ? row : maxRow
  );

  const combinedPeakRow = rows.reduce((maxRow, row) => {
    const currentMean = (row.rightAngle + row.leftAngle) / 2;
    const maxMean = (maxRow.rightAngle + maxRow.leftAngle) / 2;
    return currentMean > maxMean ? row : maxRow;
  });

  const difference = Math.abs(rightPeakRow.rightAngle - leftPeakRow.leftAngle);

  return {
    rightPeakRow,
    leftPeakRow,
    combinedPeakRow,
    difference,
  };
}

function renderResults(summary, validFrames, totalFrames) {
  const rightMax = summary.rightPeakRow.rightAngle;
  const leftMax = summary.leftPeakRow.leftAngle;

  rightMaxElement.textContent = `${rightMax.toFixed(1)}°`;
  leftMaxElement.textContent = `${leftMax.toFixed(1)}°`;
  differenceMaxElement.textContent = `${summary.difference.toFixed(1)}°`;
  rightMaxTimeElement.textContent = `${summary.rightPeakRow.time.toFixed(2)} s`;
  leftMaxTimeElement.textContent = `${summary.leftPeakRow.time.toFixed(2)} s`;

  const validPercentage = (validFrames / totalFrames) * 100;
  qualitySummary.textContent = `Se utilizaron ${validFrames} de ${totalFrames} frames analizados (${validPercentage.toFixed(
    1
  )}% válidos). Los frames con landmarks insuficientemente confiables fueron descartados.`;

  resultsSection.classList.remove("hidden");
}

function renderSymmetry(summary) {
  symmetryFormula.textContent = `|${summary.rightPeakRow.rightAngle.toFixed(1)}° − ${summary.leftPeakRow.leftAngle.toFixed(
    1
  )}°| = ${summary.difference.toFixed(1)}°`;
  symmetrySection.classList.remove("hidden");
}

function renderInterpretation(summary) {
  interpretationText.innerHTML = "";
  const paragraph = document.createElement("p");
  paragraph.textContent = `Durante el movimiento analizado, el hombro derecho alcanzó un ángulo máximo de ${summary.rightPeakRow.rightAngle.toFixed(
    1
  )}°, mientras que el hombro izquierdo alcanzó ${summary.leftPeakRow.leftAngle.toFixed(
    1
  )}°. La diferencia entre ambos ángulos máximos fue de ${summary.difference.toFixed(
    1
  )}°. Estos valores describen cuantitativamente el video analizado y no constituyen un diagnóstico clínico.`;
  interpretationText.appendChild(paragraph);
  interpretationSection.classList.remove("hidden");
}

// -----------------------------------------------------------------------------
// GRÁFICO CON CHART.JS
// -----------------------------------------------------------------------------

function renderChart(summary) {
  if (chartInstance) chartInstance.destroy();

  const canvas = document.getElementById("angleChart");
  const context = canvas.getContext("2d");

  const rightData = analysisRows.map((row) => ({ x: row.time, y: row.rightAngle }));
  const leftData = analysisRows.map((row) => ({ x: row.time, y: row.leftAngle }));

  chartInstance = new window.Chart(context, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Hombro derecho",
          data: rightData,
          borderColor: "#1f4e79",
          backgroundColor: "#1f4e79",
          borderWidth: 2.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.15,
        },
        {
          label: "Hombro izquierdo",
          data: leftData,
          borderColor: "#0f766e",
          backgroundColor: "#0f766e",
          borderWidth: 2.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.15,
        },
        {
          label: "Máximo derecho",
          data: [
            {
              x: summary.rightPeakRow.time,
              y: summary.rightPeakRow.rightAngle,
            },
          ],
          showLine: false,
          pointRadius: 6,
          pointHoverRadius: 7,
          borderColor: "#1f4e79",
          backgroundColor: "#1f4e79",
        },
        {
          label: "Máximo izquierdo",
          data: [
            {
              x: summary.leftPeakRow.time,
              y: summary.leftPeakRow.leftAngle,
            },
          ],
          showLine: false,
          pointRadius: 6,
          pointHoverRadius: 7,
          borderColor: "#0f766e",
          backgroundColor: "#0f766e",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: {
        mode: "nearest",
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: "Evolución del ángulo de abducción durante el movimiento",
          font: { size: 16, weight: "600" },
        },
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${Number(context.parsed.y).toFixed(1)}°`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Tiempo (s)",
          },
          ticks: {
            callback(value) {
              return Number(value).toFixed(1);
            },
          },
        },
        y: {
          suggestedMin: 0,
          suggestedMax: 180,
          title: {
            display: true,
            text: "Ángulo de abducción (°)",
          },
        },
      },
    },
  });

  chartSection.classList.remove("hidden");
}

// -----------------------------------------------------------------------------
// FRAME DE MÁXIMA ELEVACIÓN
// -----------------------------------------------------------------------------

async function renderMaximumFrame(row) {
  await seekVideo(row.time);

  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;
  const maxOutputWidth = 960;
  const scale = Math.min(1, maxOutputWidth / sourceWidth);

  maxFrameCanvas.width = Math.round(sourceWidth * scale);
  maxFrameCanvas.height = Math.round(sourceHeight * scale);

  maxFrameContext.clearRect(0, 0, maxFrameCanvas.width, maxFrameCanvas.height);
  maxFrameContext.drawImage(videoElement, 0, 0, maxFrameCanvas.width, maxFrameCanvas.height);
  drawPoseOverlay(
    row.landmarks,
    row.rightRaw,
    row.leftRaw,
    maxFrameCanvas,
    maxFrameContext,
    true
  );

  maxFrameCaption.textContent = `Captura aproximada a los ${row.time.toFixed(
    2
  )} s. Los ángulos escritos sobre la imagen corresponden al cálculo directo de ese frame antes del suavizado ligero de la serie.`;

  maxFrameSection.classList.remove("hidden");
}

// -----------------------------------------------------------------------------
// DIBUJO DE PUNTOS, LÍNEAS Y ÁNGULOS
// -----------------------------------------------------------------------------

function drawPoseOverlay(landmarks, rightAngle, leftAngle, canvas, context, preserveBackground = false) {
  if (!preserveBackground) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (!landmarks || !canvas.width || !canvas.height) return;

  const rightShoulder = toCanvasPoint(landmarks.rightShoulder, canvas);
  const rightElbow = toCanvasPoint(landmarks.rightElbow, canvas);
  const rightHip = toCanvasPoint(landmarks.rightHip, canvas);
  const leftShoulder = toCanvasPoint(landmarks.leftShoulder, canvas);
  const leftElbow = toCanvasPoint(landmarks.leftElbow, canvas);
  const leftHip = toCanvasPoint(landmarks.leftHip, canvas);

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  // Líneas derechas
  drawLine(context, rightShoulder, rightElbow, "#4da3ff", 5);
  drawLine(context, rightShoulder, rightHip, "#4da3ff", 5);

  // Líneas izquierdas
  drawLine(context, leftShoulder, leftElbow, "#2dd4bf", 5);
  drawLine(context, leftShoulder, leftHip, "#2dd4bf", 5);

  // Puntos anatómicos
  [rightShoulder, rightElbow, rightHip].forEach((point) => drawPoint(context, point, "#4da3ff"));
  [leftShoulder, leftElbow, leftHip].forEach((point) => drawPoint(context, point, "#2dd4bf"));

  drawAngleLabel(context, rightShoulder, `Derecho: ${rightAngle.toFixed(1)}°`, "#4da3ff", canvas);
  drawAngleLabel(context, leftShoulder, `Izquierdo: ${leftAngle.toFixed(1)}°`, "#2dd4bf", canvas);

  context.restore();
}

function drawLine(context, pointA, pointB, color, width) {
  context.beginPath();
  context.moveTo(pointA.x, pointA.y);
  context.lineTo(pointB.x, pointB.y);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function drawPoint(context, point, color) {
  context.beginPath();
  context.arc(point.x, point.y, 7, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#ffffff";
  context.stroke();
}

function drawAngleLabel(context, shoulder, text, color, canvas) {
  const fontSize = Math.max(14, Math.min(24, canvas.width / 45));
  context.font = `700 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "middle";

  const metrics = context.measureText(text);
  const boxWidth = metrics.width + 18;
  const boxHeight = fontSize + 14;
  const desiredX = shoulder.x + 12;
  const desiredY = shoulder.y - boxHeight - 10;
  const x = clamp(desiredX, 4, Math.max(4, canvas.width - boxWidth - 4));
  const y = clamp(desiredY, 4, Math.max(4, canvas.height - boxHeight - 4));

  context.fillStyle = "rgba(15, 23, 42, 0.82)";
  roundedRect(context, x, y, boxWidth, boxHeight, 8);
  context.fill();

  context.fillStyle = color;
  context.fillText(text, x + 9, y + boxHeight / 2);
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function toCanvasPoint(landmark, canvas) {
  return {
    x: landmark.x * canvas.width,
    y: landmark.y * canvas.height,
  };
}

// -----------------------------------------------------------------------------
// SUPERPOSICIÓN DURANTE LA REPRODUCCIÓN
// -----------------------------------------------------------------------------

function startOverlayLoop() {
  cancelAnimationFrame(overlayAnimationFrame);

  const loop = () => {
    drawOverlayForCurrentTime();
    if (!videoElement.paused && !videoElement.ended) {
      overlayAnimationFrame = requestAnimationFrame(loop);
    }
  };

  loop();
}

function drawOverlayForCurrentTime() {
  if (!analysisRows.length || !overlayCanvas.width || !overlayCanvas.height) {
    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    return;
  }

  const row = findNearestAnalysisRow(videoElement.currentTime);
  if (!row) return;

  drawPoseOverlay(row.landmarks, row.rightRaw, row.leftRaw, overlayCanvas, overlayContext);
}

function findNearestAnalysisRow(time) {
  if (!analysisRows.length) return null;

  let low = 0;
  let high = analysisRows.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (analysisRows[mid].time < time) low = mid + 1;
    else high = mid;
  }

  const rightCandidate = analysisRows[low];
  const leftCandidate = low > 0 ? analysisRows[low - 1] : rightCandidate;

  const nearest =
    Math.abs(rightCandidate.time - time) < Math.abs(leftCandidate.time - time)
      ? rightCandidate
      : leftCandidate;

  // Si existe un tramo largo sin frames válidos, no se dibuja una medición antigua.
  return Math.abs(nearest.time - time) <= 0.35 ? nearest : null;
}

function resizeOverlayCanvas() {
  if (!videoElement.videoWidth || !videoElement.videoHeight) return;
  overlayCanvas.width = videoElement.videoWidth;
  overlayCanvas.height = videoElement.videoHeight;
}

// -----------------------------------------------------------------------------
// UTILIDADES DE VIDEO Y PROGRESO
// -----------------------------------------------------------------------------

function seekVideo(timeInSeconds) {
  return new Promise((resolve, reject) => {
    const safeTime = clamp(timeInSeconds, 0, Math.max(0, videoElement.duration - 0.001));

    if (
      Math.abs(videoElement.currentTime - safeTime) < 0.002 &&
      videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      resolve();
      return;
    }

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("No fue posible acceder al frame solicitado del video."));
    };

    const cleanup = () => {
      videoElement.removeEventListener("seeked", onSeeked);
      videoElement.removeEventListener("error", onError);
    };

    videoElement.addEventListener("seeked", onSeeked, { once: true });
    videoElement.addEventListener("error", onError, { once: true });
    videoElement.currentTime = safeTime;
  });
}

function nextBrowserPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function showProgress(percentage, detail) {
  progressArea.classList.remove("hidden");
  progressBar.style.width = `${percentage}%`;
  progressText.textContent = `${percentage}%`;
  progressDetail.textContent = detail;
}

function showMessage(message, type) {
  messageBox.textContent = message;
  messageBox.className = `message message--${type}`;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "message hidden";
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} min ${remainingSeconds.toFixed(0)} s`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// -----------------------------------------------------------------------------
// REINICIO Y LIMPIEZA
// -----------------------------------------------------------------------------

function clearPreviousResults() {
  analysisRows = [];
  resultsSection.classList.add("hidden");
  chartSection.classList.add("hidden");
  symmetrySection.classList.add("hidden");
  maxFrameSection.classList.add("hidden");
  interpretationSection.classList.add("hidden");

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  maxFrameContext.clearRect(0, 0, maxFrameCanvas.width, maxFrameCanvas.height);
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
  progressArea.classList.add("hidden");
}

function resetApplication() {
  if (isAnalyzing) return;

  videoElement.pause();
  cancelAnimationFrame(overlayAnimationFrame);

  if (currentVideoUrl) {
    URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = null;
  }

  videoInput.value = "";
  fileName.textContent = "Ningún video seleccionado";
  videoElement.removeAttribute("src");
  videoElement.load();
  videoElement.style.display = "none";
  videoPlaceholder.classList.remove("hidden");
  analyzeButton.disabled = true;

  clearPreviousResults();
  clearMessage();
}
