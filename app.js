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

const noticeStart = document.getElementById("noticeStart");
const noticeScan = document.getElementById("noticeScan");

let stream = null;
let scanning = false;

/* NAVIGAZIONE */
function showScreen(screen) {
  screenStart.classList.remove("active");
  screenScan.classList.remove("active");
  screenResult.classList.remove("active");
  screen.classList.add("active");
}

/* ORIENTAMENTO */
function updateOrientation() {
  const landscape = window.innerWidth > window.innerHeight;

  if (noticeStart) {
    noticeStart.classList.toggle("vertical", !landscape);
    noticeStart.textContent = landscape
      ? "📱 Orientamento OK"
      : "📱 Metti il telefono in orizzontale";
  }

  if (noticeScan) {
    noticeScan.classList.toggle("vertical", !landscape);
    noticeScan.textContent = landscape
      ? "📱 Pronto per la scansione"
      : "📱 Ruota il telefono in orizzontale";
  }
}

window.addEventListener("resize", updateOrientation);
window.addEventListener("orientationchange", updateOrientation);

/* CLICK ENTRA */
btnEnter.addEventListener("click", async () => {

  showScreen(screenScan);

  updateOrientation();

  await startCamera();

  startScan();
});

/* START CAMERA */
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = stream;
    video.setAttribute("playsinline", true);

    await video.play();

    scanStatus.textContent = "Camera attiva ✅";

  } catch (err) {
    scanStatus.textContent = "Errore camera ❌";
    console.error(err);
  }
}

/* LOOP SCAN */
function startScan() {

  const waitVideo = () => {
    if (video.readyState >= 2 && video.videoWidth > 0) {

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      scanning = true;
      scanFrame();

    } else {
      requestAnimationFrame(waitVideo);
    }
  };

  waitVideo();
}

/* LOOP FRAME */
function scanFrame() {

  if (!scanning) return;

  ctx.drawImage(video, 0, 0);

  // 🔥 DETECTION (FAKE → cambi poi)
  const detected = fakeDetection();

  goodMatchesEl.textContent = Math.floor(Math.random() * 30);
  inliersEl.textContent = Math.floor(Math.random() * 20);
  detectionTextEl.textContent = detected ? "SI" : "NO";

  if (detected) {
    onFound();
    return;
  }

  requestAnimationFrame(scanFrame);
}

/* DETECTION TEMPORANEA */
function fakeDetection() {
  // probabilità bassa → sembra reale
  return Math.random() > 0.995;
}

/* TROVATO */
function onFound() {
  scanning = false;

  scanStatus.textContent = "TARGET TROVATO ✅";

  setTimeout(() => {
    stopCamera();
    showScreen(screenResult);
  }, 500);
}

/* STOP CAMERA */
function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
}

/* USCITA */
btnExit.addEventListener("click", () => {
  scanning = false;
  stopCamera();
  showScreen(screenStart);
});

/* INIT */
updateOrientation();
