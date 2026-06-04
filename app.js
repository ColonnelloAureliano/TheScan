document.addEventListener("DOMContentLoaded", () => {
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

  const noticeStart = document.getElementById("noticeStart");
  const noticeScan = document.getElementById("noticeScan");

  let stream = null;
  let scanning = false;
  let startLocked = false; // evita doppio trigger iOS

  function showScreen(screen) {
    screenStart.classList.remove("active");
    screenScan.classList.remove("active");
    screenResult.classList.remove("active");
    screen.classList.add("active");
  }

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

  async function startCamera() {
    try {
      scanStatus.textContent = "Richiesta accesso fotocamera...";

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");

      await video.play();

      scanStatus.textContent = "Camera attiva ✅";
    } catch (err) {
      scanStatus.textContent = "Errore camera ❌";
      console.error(err);
      startLocked = false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    video.srcObject = null;
  }

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

  function scanFrame() {
    if (!scanning) return;

    ctx.drawImage(video, 0, 0);

    // DEMO placeholder: sostituiamo dopo con detection reale
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

  function onFound() {
    scanning = false;
    scanStatus.textContent = "TARGET TROVATO ✅";

    setTimeout(() => {
      stopCamera();
      showScreen(screenResult);
      startLocked = false;
    }, 500);
  }

  async function startFlow(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }

    if (startLocked) return;
    startLocked = true;

    showScreen(screenScan);
    updateOrientation();

    await startCamera();
    startScan();
  }

  // iOS: meglio touchstart + click con guardia anti doppio trigger
  btnEnter.addEventListener("touchstart", startFlow, { passive: false });
  btnEnter.addEventListener("click", startFlow);

  btnExit.addEventListener("click", () => {
    scanning = false;
    stopCamera();
    showScreen(screenStart);
    startLocked = false;
  });

  if (btnContinue) {
    btnContinue.addEventListener("click", () => {
      showScreen(screenStart);
      startLocked = false;
    });
  }

  updateOrientation();
});
