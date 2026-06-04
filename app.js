document.addEventListener("DOMContentLoaded", () => {

const screenStart = document.getElementById("screenStart");
const screenScan = document.getElementById("screenScan");
const screenResult = document.getElementById("screenResult");

const btnEnter = document.getElementById("btnEnter");
const btnExit = document.getElementById("btnExit");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scanStatus = document.getElementById("scanStatus");

const goodMatchesEl = document.getElementById("goodMatches");
const inliersEl = document.getElementById("inliers");
const detectionTextEl = document.getElementById("detectionText");

const targetImage = document.getElementById("targetImage");

let stream = null;
let scanning = false;
let startLocked = false;

// ===== OpenCV =====
let orb, matcher;
let targetKP, targetDesc;
let targetGray;
let cvReady = false;

// ===== NAVIGAZIONE =====
function showScreen(screen) {
  screenStart.classList.remove("active");
  screenScan.classList.remove("active");
  screenResult.classList.remove("active");
  screen.classList.add("active");
}

// ===== CAMERA =====
async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });

  video.srcObject = stream;
  video.setAttribute("playsinline", true);
  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");

  await video.play();

  scanStatus.textContent = "Camera attiva ✅";
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

// ===== INIT OPENCV =====
async function initCV() {

  scanStatus.textContent = "Carico detection...";

  await new Promise(resolve => {
    const check = setInterval(() => {
      if (window.cv && cv.Mat) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  orb = new cv.ORB(1000);
  matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);

  const img = cv.imread(targetImage);

  targetGray = new cv.Mat();
  cv.cvtColor(img, targetGray, cv.COLOR_RGBA2GRAY);

  targetKP = new cv.KeyPointVector();
  targetDesc = new cv.Mat();

  orb.detectAndCompute(targetGray, new cv.Mat(), targetKP, targetDesc);

  img.delete();

  cvReady = true;

  scanStatus.textContent = "Detection pronta ✅";
}

// ===== SCAN =====
function startScan() {

  const wait = () => {
    if (video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      scanning = true;
      scanFrame();
    } else {
      requestAnimationFrame(wait);
    }
  };

  wait();
}

// ===== DETECTION =====
function detectFrame() {

  if (!cvReady) return null;

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  let kp = new cv.KeyPointVector();
  let desc = new cv.Mat();

  orb.detectAndCompute(gray, new cv.Mat(), kp, desc);

  if (desc.empty()) {
    cleanup();
    return null;
  }

  let matches = new cv.DMatchVectorVector();
  matcher.knnMatch(targetDesc, desc, matches, 2);

  let good = [];

  for (let i = 0; i < matches.size(); i++) {
    let m = matches.get(i).get(0);
    let n = matches.get(i).get(1);

    if (m.distance < 0.75 * n.distance) {
      good.push(m);
    }

    m.delete();
    n.delete();
    matches.get(i).delete();
  }

  let detected = good.length > 20;

  goodMatchesEl.textContent = good.length;
  inliersEl.textContent = "-";
  detectionTextEl.textContent = detected ? "SI" : "NO";

  function cleanup() {
    src.delete();
    gray.delete();
    kp.delete();
    desc.delete();
    matches.delete();
  }

  cleanup();

  return detected;
}

// ===== LOOP =====

  let stabilityCounter = 0;

function detectFrameSimple() {

  if (!cvReady) return false;

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  let kp = new cv.KeyPointVector();
  let desc = new cv.Mat();

  orb.detectAndCompute(gray, new cv.Mat(), kp, desc);

  if (desc.empty()) {
    cleanup();
    return false;
  }

  let matches = new cv.DMatchVectorVector();
  matcher.knnMatch(targetDesc, desc, matches, 2);

  let good = [];

  for (let i = 0; i < matches.size(); i++) {

    let pair = matches.get(i);

    if (pair.size() >= 2) {
      let m = pair.get(0);
      let n = pair.get(1);

      // 👉 MATCH PIÙ "MORBIDO"
      if (m.distance < 0.85 * n.distance) {
        good.push(m);
      }

      m.delete();
      n.delete();
    }

    pair.delete();
  }

  // 👉 SOGLIA MOLTO PIÙ FACILE
  let detectedNow = good.length > 8;

  // 👉 STABILITÀ SU PIÙ FRAME
  if (detectedNow) {
    stabilityCounter++;
  } else {
    stabilityCounter = 0;
  }

  let detected = stabilityCounter > 3;

  // DEBUG
  goodMatchesEl.textContent = good.length;
  inliersEl.textContent = stabilityCounter;
  detectionTextEl.textContent = detected ? "SI" : "NO";

  function cleanup() {
    src.delete();
    gray.delete();
    kp.delete();
    desc.delete();
    matches.delete();
  }

  cleanup();

  return detected;
}
function scanFrame() {

  if (!scanning) return;

  ctx.drawImage(video, 0, 0);

  const detected = detectFrameSimple();

  if (detected) {
    onFound();
    return;
  }

  requestAnimationFrame(scanFrame);
}

// ===== TROVATO =====
function onFound() {
  scanning = false;
  scanStatus.textContent = "TARGET TROVATO ✅";

  setTimeout(() => {
    stopCamera();
    showScreen(screenResult);
    startLocked = false;
  }, 500);
}

// ===== START FLOW (iOS FIX) =====
async function startFlow(e) {

  e.preventDefault();

  if (startLocked) return;
  startLocked = true;

  showScreen(screenScan);

  await startCamera();
  await initCV();

  startScan();
}

btnEnter.addEventListener("click", startFlow);
btnEnter.addEventListener("touchstart", startFlow);

// ===== EXIT =====
btnExit.addEventListener("click", () => {
  scanning = false;
  stopCamera();
  showScreen(screenStart);
  startLocked = false;
});

});
