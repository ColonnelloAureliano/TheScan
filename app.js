const screenStart = document.getElementById("screenStart");
const screenScan = document.getElementById("screenScan");
const screenResult = document.getElementById("screenResult");

const btnEnter = document.getElementById("btnEnter");
const btnExit = document.getElementById("btnExit");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scanStatus = document.getElementById("scanStatus");

let stream = null;
let scanning = false;

/* NAVIGATION */
function showScreen(screen) {
  screenStart.classList.remove("active");
  screenScan.classList.remove("active");
  screenResult.classList.remove("active");
  screen.classList.add("active");
}

/* CLICK ENTRA */
btnEnter.addEventListener("click", async () => {

  showScreen(screenScan);

  // ✅ iPhone FIX → CAMERA SUBITO
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
    video.setAttribute("playsinline", true); // ✅ iOS fix

    await video.play();

    scanStatus.textContent = "Camera attiva ✅";

  } catch (err) {
    scanStatus.textContent = "Errore camera ❌";
    console.error(err);
  }
}

/* SCAN LOOP */
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

/* FRAME LOOP */
function scanFrame() {

  if (!scanning) return;

  ctx.drawImage(video, 0, 0);

  // 🔥 QUI SIMULO DETECTION (TEST)
  const detected = fakeDetection();

  if (detected) {
    onFound();
    return;
  }

  requestAnimationFrame(scanFrame);
}

/* FAKE DETECTION */
function fakeDetection() {
  // dopo 3 secondi simula detection
  return Math.random() > 0.995;
}

/* TARGET TROVATO */
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

/* ESCI */
btnExit.addEventListener("click", () => {
  scanning = false;
  stopCamera();
  showScreen(screenStart);
});
