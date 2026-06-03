const screenStart = document.getElementById("screenStart");
const screenScan = document.getElementById("screenScan");
const screenResult = document.getElementById("screenResult");

const btnEnter = document.getElementById("btnEnter");
const btnExit = document.getElementById("btnExit");
const btnContinue = document.getElementById("btnContinue");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scanStatus = document.getElementById("scanStatus");
const goodMatchesEl = document.getElementById("goodMatches");
const inliersEl = document.getElementById("inliers");
const detectionTextEl = document.getElementById("detectionText");

let stream = null;
let scanLoopActive = false;
let secretFound = false;

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenScan.classList.remove("active");
  screenResult.classList.remove("active");
  screenToShow.classList.add("active");
}

btnEnter.addEventListener("click", async () => {
  showScreen(screenScan);
  await startCamera();
  startScanningLoop();
});

btnExit.addEventListener("click", () => {
  stopScanning();
  stopCamera();
  secretFound = false;
  resetDebug();
  showScreen(screenStart);
});

btnContinue.addEventListener("click", () => {
  alert("Livello successivo / azione successiva");
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    scanStatus.textContent = "Scansione attiva...";
  } catch (error) {
    console.error("Errore accesso videocamera:", error);
    scanStatus.textContent = "Impossibile accedere alla videocamera";
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.srcObject = null;
}

function resetDebug() {
  goodMatchesEl.textContent = "0";
  inliersEl.textContent = "0";
  detectionTextEl.textContent = "NO";
  scanStatus.textContent = "In attesa...";
}

function stopScanning() {
  scanLoopActive = false;
}

function startScanningLoop() {
  if (!video.videoWidth || !video.videoHeight) {
    requestAnimationFrame(startScanningLoop);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  scanLoopActive = true;
  secretFound = false;
  scanFrame();
}

function scanFrame() {
  if (!scanLoopActive || secretFound) return;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // QUI devi richiamare la tua funzione vera di detection
  const result = detectTargetFromCurrentFrame();

  goodMatchesEl.textContent = result.goodMatches;
  inliersEl.textContent = result.inliers;
  detectionTextEl.textContent = result.detected ? "SI" : "NO";

  if (result.detected) {
    onTargetDetected();
    return;
  }

  requestAnimationFrame(scanFrame);
}

function onTargetDetected() {
  secretFound = true;
  scanLoopActive = false;

  scanStatus.textContent = "TARGET ACQUISITO";
  detectionTextEl.textContent = "SI";

  setTimeout(() => {
    stopCamera();
    showScreen(screenResult);
  }, 500);
}

/*
  ====== SOSTITUISCI QUESTA FUNZIONE CON LA TUA DETECTION REALE ======
  Questa adesso è solo un placeholder.
*/
function detectTargetFromCurrentFrame() {
  // ESEMPIO TEMPORANEO: sempre non rilevato
  return {
    detected: false,
    goodMatches: 0,
    inliers: 0
  };
}

