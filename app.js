const homeScreen = document.getElementById("homeScreen");
const scanScreen = document.getElementById("scanScreen");
const enterBtn = document.getElementById("enterBtn");
const backBtn = document.getElementById("backBtn");
const toggleScanBtn = document.getElementById("toggleScanBtn");

const video = document.getElementById("video");
const viewCanvas = document.getElementById("viewCanvas");
const processCanvas = document.getElementById("processCanvas");
const targetImg = document.getElementById("targetImg");

const statusText = document.getElementById("statusText");
const statusLed = document.getElementById("statusLed");

const goodMatchesValue = document.getElementById("goodMatchesValue");
const inliersValue = document.getElementById("inliersValue");
const foundValue = document.getElementById("foundValue");

const secretModal = document.getElementById("secretModal");
const closeModalBtn = document.getElementById("closeModalBtn");

let stream = null;
let cvReady = false;
let cameraReady = false;
let scanning = false;
let targetReady = false;
let matchLocked = false;
let scanInterval = null;

let targetData = null;
// targetData = { gray, keypoints, descriptors, width, height }

const CONFIG = {
  analyseEveryMs: 320,
  minGoodMatches: 16,
  minInliers: 10,
  ratioTest: 0.82,
  ransacThresh: 5.0,
  maxTargetSide: 900,
  maxFrameSide: 960,
  drawDebugPolygon: true,
  preferRearCamera: true
};

function setStatus(text, mode = "idle") {
  statusText.textContent = text;
  statusLed.className = "status-led";

  if (mode === "active") statusLed.classList.add("active");
  if (mode === "warning") statusLed.classList.add("warning");
  if (mode === "error") statusLed.classList.add("error");
}

function setViews(homeVisible) {
  homeScreen.classList.toggle("active", homeVisible);
  scanScreen.classList.toggle("active", !homeVisible);
}

function resetStats() {
  goodMatchesValue.textContent = "0";
  inliersValue.textContent = "0";
  foundValue.textContent = "NO";
}

function showSecret() {
  secretModal.classList.remove("hidden");
}

function hideSecret() {
  secretModal.classList.add("hidden");
}

closeModalBtn.addEventListener("click", hideSecret);

function stopCamera() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }

  scanning = false;
  toggleScanBtn.textContent = "Avvia scansione";
  resetOverlay();

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  cameraReady = false;
  setStatus("Fotocamera disattivata", "idle");
}

function resetOverlay() {
  const ctx = viewCanvas.getContext("2d");
  ctx.clearRect(0, 0, viewCanvas.width, viewCanvas.height);
}

function resizeCanvasToVideo() {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  viewCanvas.width = vw;
  viewCanvas.height = vh;
  processCanvas.width = vw;
  processCanvas.height = vh;
  resetOverlay();
}

async function startCamera() {
  try {
    setStatus("Richiesta accesso fotocamera...", "warning");

    const constraints = {
      video: CONFIG.preferRearCamera
        ? { facingMode: { ideal: "environment" } }
        : true,
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    await new Promise(resolve => {
      video.onloadedmetadata = () => resolve();
    });

    await video.play();
    resizeCanvasToVideo();

    cameraReady = true;
    setStatus("Fotocamera pronta", "active");
  } catch (err) {
    console.error(err);
    setStatus("Errore fotocamera / permesso negato", "error");
    alert("Impossibile accedere alla fotocamera. Verifica permessi browser e pagina HTTPS.");
  }
}

function waitForOpenCV() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.cv && cv.Mat) {
        cvReady = true;
        resolve();
      } else {
        setTimeout(check, 120);
      }
    };
    check();
  });
}

function limitMatSize(src, maxSide) {
  const w = src.cols;
  const h = src.rows;
  const scale = Math.min(1, maxSide / Math.max(w, h));

  if (scale === 1) return src.clone();

  const dst = new cv.Mat();
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  cv.resize(src, dst, new cv.Size(newW, newH), 0, 0, cv.INTER_AREA);
  return dst;
}

function preprocessToGray(srcMat) {
  const gray = new cv.Mat();
  if (srcMat.channels() === 4) {
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
  } else if (srcMat.channels() === 3) {
    cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
  } else {
    srcMat.copyTo(gray);
  }

  // lieve equalizzazione per ridurre impatti di luce diversa
  const eq = new cv.Mat();
  cv.equalizeHist(gray, eq);
  gray.delete();

  // piccolo blur per stabilizzare il rumore
  const blur = new cv.Mat();
  cv.GaussianBlur(eq, blur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
  eq.delete();

  return blur;
}

function computeTargetFeatures() {
  if (!cvReady) throw new Error("OpenCV non pronto");
  if (!targetImg.complete) throw new Error("Immagine target non caricata");

  let src = cv.imread(targetImg);
  let resized = limitMatSize(src, CONFIG.maxTargetSide);
  let gray = preprocessToGray(resized);

  const orb = new cv.ORB(1400);
  const keypoints = new cv.KeyPointVector();
  const descriptors = new cv.Mat();

  orb.detectAndCompute(gray, new cv.Mat(), keypoints, descriptors);

  if (descriptors.empty() || keypoints.size() < 8) {
    src.delete();
    resized.delete();
    gray.delete();
    orb.delete();
    keypoints.delete();
    descriptors.delete();
