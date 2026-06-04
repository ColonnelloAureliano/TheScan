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

/* ORIENTAMENTO (SOLO AVVISO) */
function updateOrientation() {
  const landscape = window.innerWidth > window.innerHeight;

  if (noticeStart) {
    noticeStart.classList.toggle("vertical", !landscape);
  }

  if (noticeScan) {
    noticeScan.classList.toggle("vertical", !landscape);
  }
}

window.addEventListener("resize", updateOrientation);
window.addEventListener("orientationchange", updateOrientation);

/* ✅ FIX iPhone CLICK */
function startFlow() {
  showScreen(screenScan);
  updateOrientation();
  startCamera().then(() => startScan());
}

btnEnter.addEventListener("click", startFlow);
btnEnter.addEventListener("touchend", startFlow);

/* CAMERA */
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

  } catch (e) {
    scanStatus.textContent = "Errore camera ❌";
    console.error(e);
  }
}

/* SCAN */
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

/* LOOP */
function scanFrame() {

  if (!scanning) return;

  ctx.drawImage(video, 0, 0);

  // 🔥 placeholder detection
  const detected = Math.random() > 0.995;

  goodMatchesEl.textContent = Math.floor(Math.random() * 30);
  inliersEl.textContent = Math.floor(Math.random() * 20);
  detectionTextEl.textContent = detected ? "SI" : "NO";

  if (detected) {
    onFound();
    return;
  }

  requestAnimationFrame(scanFrame);
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

updateOrientation();

});
