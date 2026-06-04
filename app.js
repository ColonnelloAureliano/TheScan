document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // DOM
  // =========================
  const screenStart = document.getElementById("screenStart");
  const screenScan = document.getElementById("screenScan");
  const screenResult = document.getElementById("screenResult");

  const btnEnter = document.getElementById("btnEnter");
  const btnExit = document.getElementById("btnExit");
  const btnContinue = document.getElementById("btnContinue");

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const scanStatus = document.getElementById("scanStatus");
  const goodMatchesEl = document.getElementById("goodMatches");
  const inliersEl = document.getElementById("inliers");
  const detectionTextEl = document.getElementById("detectionText");

  const noticeStart = document.getElementById("noticeStart");
  const noticeScan = document.getElementById("noticeScan");
  const targetImage = document.getElementById("targetImage");

  // =========================
  // STATO
  // =========================
  let stream = null;
  let scanning = false;
  let starting = false;
  let rafId = 0;
  let touchLock = false;

  // OpenCV
  let cvReady = false;
  let orb = null;
  let matcher = null;
  let targetKeypoints = null;
  let targetDesc = null;

  // parametri detection (volutamente “blandi”)
  const DETECT_THRESHOLD = 8;     // abbassa/alza qui se serve
  const STABILITY_REQUIRED = 3;   // numero frame consecutivi
  const MAX_PROCESS_WIDTH = 640;  // riduce carico mobile

  let stabilityCounter = 0;

  // =========================
  // UI
  // =========================
  function showScreen(screen) {
    screenStart.classList.remove("active");
    screenScan.classList.remove("active");
    screenResult.classList.remove("active");
    screen.classList.add("active");
  }

  function setStatus(text) {
    scanStatus.textContent = text;
  }

  function resetDebug() {
    goodMatchesEl.textContent = "0";
    inliersEl.textContent = "0";
    detectionTextEl.textContent = "NO";
    stabilityCounter = 0;
  }

  function updateOrientationNotice() {
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

  window.addEventListener("resize", updateOrientationNotice);
  window.addEventListener("orientationchange", updateOrientationNotice);

  // =========================
  // TAP robusto per iPhone
  // =========================
  function bindTap(element, handler) {
    element.addEventListener("touchend", (e) => {
      e.preventDefault();
      touchLock = true;
      handler(e);
      setTimeout(() => { touchLock = false; }, 400);
    }, { passive: false });

    element.addEventListener("click", (e) => {
      if (touchLock) {
        e.preventDefault();
        return;
      }
      handler(e);
    });
  }

  // =========================
  // Camera
  // =========================
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Fotocamera non supportata da questo browser");
    }

    setStatus("Richiesta fotocamera...");

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");

    await new Promise((resolve) => {
      if (video.readyState >= 1) {
        resolve();
      } else {
        video.onloadedmetadata = () => resolve();
      }
    });

    await video.play();
    setStatus("Camera attiva ✅");
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  // =========================
  // OpenCV init
  // =========================
  function waitForOpenCV() {
    return new Promise((resolve, reject) => {
      if (window.cv && typeof cv.Mat === "function") {
        resolve();
        return;
      }

      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if (window.cv && typeof cv.Mat === "function") {
          clearInterval(timer);
          resolve();
        } else if (tries > 300) {
          clearInterval(timer);
          reject(new Error("OpenCV non si è caricato"));
        }
      }, 100);
    });
  }

  function waitForTargetImage() {
    return new Promise((resolve, reject) => {
      if (!targetImage) {
        reject(new Error("Elemento targetImage non trovato"));
        return;
      }

      if (targetImage.complete && targetImage.naturalWidth > 0) {
        resolve();
        return;
      }

      targetImage.onload = () => resolve();
      targetImage.onerror = () => reject(new Error("target.jpg non caricato"));
    });
  }

  function createORB() {
    if (cv.ORB && typeof cv.ORB.create === "function") {
      return cv.ORB.create(900);
    }
    return new cv.ORB(900);
  }

  function createMatcher() {
    return new cv.BFMatcher(cv.NORM_HAMMING, false);
  }

  async function initDetection() {
    setStatus("Carico detection...");

    await waitForOpenCV();
    await waitForTargetImage();

    orb = createORB();
    matcher = createMatcher();

    const src = cv.imread(targetImage);

    if (src.empty()) {
      src.delete();
      throw new Error("target.jpg non leggibile");
    }

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    targetKeypoints = new cv.KeyPointVector();
    targetDesc = new cv.Mat();

    const emptyMask = new cv.Mat();
    orb.detectAndCompute(gray, emptyMask, targetKeypoints, targetDesc);

    emptyMask.delete();
    src.delete();
    gray.delete();

    if (targetDesc.empty() || targetKeypoints.size() === 0) {
      throw new Error("Nessun dettaglio trovato nel target");
    }

    cvReady = true;
    setStatus("KP target: " + targetKeypoints.size());
  }

  // =========================
  // Detection reale (blanda)
  // =========================
  function matchCurrentFrame() {
    if (!cvReady || !targetDesc || targetDesc.empty()) {
      return { detected: false, matches: 0 };
    }

    let src = null;
    let gray = null;
    let frameKeypoints = null;
    let frameDesc = null;
    let matches = null;

    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      frameKeypoints = new cv.KeyPointVector();
      frameDesc = new cv.Mat();

      const emptyMask = new cv.Mat();
      orb.detectAndCompute(gray, emptyMask, frameKeypoints, frameDesc);
      emptyMask.delete();

      if (frameDesc.empty()) {
        return { detected: false, matches: 0 };
      }

      matches = new cv.DMatchVectorVector();
      matcher.knnMatch(targetDesc, frameDesc, matches, 2);

      let goodCount = 0;

      for (let i = 0; i < matches.size(); i++) {
        const pair = matches.get(i);

        if (pair.size() >= 2) {
          const m = pair.get(0);
          const n = pair.get(1);

          // ratio test volutamente più morbido
          if (m.distance < 0.88 * n.distance) {
            goodCount++;
          }

          m.delete();
          n.delete();
        }

        pair.delete();
      }

      const detectedNow = goodCount >= DETECT_THRESHOLD;

      return {
        detected: detectedNow,
        matches: goodCount
      };

    } catch (err) {
      console.error("Errore detection:", err);
      return { detected: false, matches: 0 };
    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
      if (frameKeypoints) frameKeypoints.delete();
      if (frameDesc) frameDesc.delete();
      if (matches) matches.delete();
    }
  }

  // =========================
  // Scan loop
  // =========================
  function startScanLoop() {
    const waitForVideo = () => {
      if (!scanning) return;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const scale = Math.min(1, MAX_PROCESS_WIDTH / video.videoWidth);
        const w = Math.max(320, Math.round(video.videoWidth * scale));
        const h = Math.max(180, Math.round(video.videoHeight * scale));

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        processFrame();
      }

      rafId = requestAnimationFrame(waitForVideo);
    };

    scanning = true;
    rafId = requestAnimationFrame(waitForVideo);
  }

  function stopScanLoop() {
    scanning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function processFrame() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const result = matchCurrentFrame();

    if (result.detected) {
      stabilityCounter++;
    } else {
      stabilityCounter = 0;
    }

    goodMatchesEl.textContent = String(result.matches);
    inliersEl.textContent = String(stabilityCounter);
    detectionTextEl.textContent = stabilityCounter >= STABILITY_REQUIRED ? "SI" : "NO";

    if (stabilityCounter >= STABILITY_REQUIRED) {
      onFound();
    }
  }

  // =========================
  // Flusso principale
  // =========================
  async function startFlow(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (starting) return;
    starting = true;

    resetDebug();
    showScreen(screenScan);

    try {
      await startCamera();
      await initDetection();
      startScanLoop();
    } catch (err) {
      console.error(err);
      setStatus("Errore: " + err.message);
      starting = false;
    }
  }

  function onFound() {
    stopScanLoop();
    setStatus("TARGET TROVATO ✅");

    setTimeout(() => {
      stopCamera();
      showScreen(screenResult);
      starting = false;
    }, 400);
  }

  function goBackToStart(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    stopScanLoop();
    stopCamera();
    starting = false;
    resetDebug();
    showScreen(screenStart);
    setStatus("In attesa...");
  }

  function continueGame(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    showScreen(screenStart);
    starting = false;
  }

  // =========================
  // Bind eventi
  // =========================
  bindTap(btnEnter, startFlow);
  bindTap(btnExit, goBackToStart);
  bindTap(btnContinue, continueGame);

  updateOrientationNotice();
});
