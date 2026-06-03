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

const targetImage = document.getElementById("targetImage");

let stream = null;
let scanLoopActive = false;
let secretFound = false;
let cvReady = false;

// OpenCV target data
let orb = null;
let bf = null;
let targetGray = null;
let targetKeypoints = null;
let targetDescriptors = null;

// Per evitare falsi positivi: richiedo più frame consecutivi validi
let consecutiveDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 3;

// Soglie detection
const MIN_GOOD_MATCHES = 18;
const MIN_INLIERS = 12;

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenScan.classList.remove("active");
  screenResult.classList.remove("active");
  screenToShow.classList.add("active");
}

btnEnter.addEventListener("click", async () => {
  showScreen(screenScan);

  // ✅ PRIMA la camera (serve per iPhone)
  await startCamera();

  // ✅ POI tutto il resto
  const ok = await initializeDetection();

  if (!ok) {
    scanStatus.textContent = "Errore inizializzazione";
    return;
  }

  startScanningLoop();
});

btnExit.addEventListener("click", () => {
  stopScanning();
  stopCamera();
  secretFound = false;
  consecutiveDetections = 0;
  resetDebug();
  showScreen(screenStart);
});

if (btnContinue) {
  btnContinue.addEventListener("click", () => {
    alert("Livello successivo / azione successiva");
  });
}

async function initializeDetection() {
  try {
    scanStatus.textContent = "Caricamento motore di riconoscimento...";

    await waitForOpenCv();
    await waitForImage(targetImage);

    if (!orb) {
      orb = new cv.ORB(1500);
    }

    if (!bf) {
      bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
    }

    prepareTargetFeatures();

    scanStatus.textContent = "Riconoscimento pronto";
    return true;
  } catch (error) {
    console.error("Errore initializeDetection:", error);
    return false;
  }
}

function waitForOpenCv() {
  return new Promise((resolve, reject) => {
    if (cvReady && window.cv) {
      resolve();
      return;
    }

    let attempts = 0;
    const maxAttempts = 200;

    const timer = setInterval(() => {
      attempts++;

      if (window.cv && typeof cv.Mat === "function") {
        cvReady = true;
        clearInterval(timer);
        resolve();
      }

      if (attempts > maxAttempts) {
        clearInterval(timer);
        reject(new Error("OpenCV non caricato"));
      }
    }, 100);
  });
}

function waitForImage(img) {
  return new Promise((resolve, reject) => {
    if (!img) {
      reject(new Error("Elemento targetImage non trovato"));
      return;
    }

    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }

    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Immagine target non caricata"));
  });
}

function prepareTargetFeatures() {
  cleanupTargetFeatures();

  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = targetImage.naturalWidth;
  tmpCanvas.height = targetImage.naturalHeight;

  const tmpCtx = tmpCanvas.getContext("2d");
  tmpCtx.drawImage(targetImage, 0, 0);

  const targetRgba = cv.imread(tmpCanvas);
  targetGray = new cv.Mat();
  cv.cvtColor(targetRgba, targetGray, cv.COLOR_RGBA2GRAY);

  targetKeypoints = new cv.KeyPointVector();
  targetDescriptors = new cv.Mat();

  orb.detectAndCompute(
    targetGray,
    new cv.Mat(),
    targetKeypoints,
    targetDescriptors
  );

  targetRgba.delete();

  console.log("Target keypoints:", targetKeypoints.size());
}

function cleanupTargetFeatures() {
  if (targetGray) {
    targetGray.delete();
    targetGray = null;
  }
  if (targetKeypoints) {
    targetKeypoints.delete();
    targetKeypoints = null;
  }
  if (targetDescriptors) {
    targetDescriptors.delete();
    targetDescriptors = null;
  }
}

async function startCamera() {
  try {
    scanStatus.textContent = "Richiesta accesso videocamera...";

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
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
  consecutiveDetections = 0;
  scanFrame();
}

function scanFrame() {
  if (!scanLoopActive || secretFound) return;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const result = detectTargetFromCurrentFrame();

  goodMatchesEl.textContent = result.goodMatches;
  inliersEl.textContent = result.inliers;
  detectionTextEl.textContent = result.detected ? "SI" : "NO";

  if (result.detected) {
    consecutiveDetections++;
    scanStatus.textContent = `Target quasi trovato... (${consecutiveDetections}/${REQUIRED_CONSECUTIVE_DETECTIONS})`;
  } else {
    consecutiveDetections = 0;
    scanStatus.textContent = "Scansione attiva...";
  }

  if (consecutiveDetections >= REQUIRED_CONSECUTIVE_DETECTIONS) {
    onTargetDetected();
    return;
  }

  requestAnimationFrame(scanFrame);
}

function detectTargetFromCurrentFrame() {
  if (!window.cv || !targetDescriptors || targetDescriptors.empty()) {
    return {
      detected: false,
      goodMatches: 0,
      inliers: 0
    };
  }

  let src = null;
  let gray = null;
  let frameKeypoints = null;
  let frameDescriptors = null;
  let matches = null;
  let goodMatches = [];
  let inliers = 0;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    frameKeypoints = new cv.KeyPointVector();
    frameDescriptors = new cv.Mat();

    orb.detectAndCompute(
      gray,
      new cv.Mat(),
      frameKeypoints,
      frameDescriptors
    );

    if (frameDescriptors.empty() || frameKeypoints.size() < 8 || targetKeypoints.size() < 8) {
      return {
        detected: false,
        goodMatches: 0,
        inliers: 0
      };
    }

    matches = new cv.DMatchVectorVector();
    bf.knnMatch(targetDescriptors, frameDescriptors, matches, 2);

    for (let i = 0; i < matches.size(); i++) {
      const pair = matches.get(i);
      if (pair.size() >= 2) {
        const m = pair.get(0);
        const n = pair.get(1);

        // Lowe ratio test
        if (m.distance < 0.75 * n.distance) {
          goodMatches.push(m);
        }

        m.delete();
        n.delete();
      }
      pair.delete();
    }

    if (goodMatches.length >= 8) {
      const srcPoints = [];
      const dstPoints = [];

      for (let i = 0; i < goodMatches.length; i++) {
        const gm = goodMatches[i];
        const kp1 = targetKeypoints.get(gm.queryIdx).pt;
        const kp2 = frameKeypoints.get(gm.trainIdx).pt;

        srcPoints.push(kp1.x, kp1.y);
        dstPoints.push(kp2.x, kp2.y);
      }

      const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPoints);
      const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPoints);
      const mask = new cv.Mat();

      const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0, mask);

      if (!H.empty()) {
        for (let i = 0; i < mask.rows; i++) {
          if (mask.data[i] === 1) {
            inliers++;
          }
        }
      }

      srcMat.delete();
      dstMat.delete();
      mask.delete();
      H.delete();
    }

    const detected = goodMatches.length >= MIN_GOOD_MATCHES && inliers >= MIN_INLIERS;

    return {
      detected,
      goodMatches: goodMatches.length,
      inliers
    };
  } catch (error) {
    console.error("Errore detectTargetFromCurrentFrame:", error);
    return {
      detected: false,
      goodMatches: 0,
      inliers: 0
    };
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (frameKeypoints) frameKeypoints.delete();
    if (frameDescriptors) frameDescriptors.delete();
    if (matches) matches.delete();
  }
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

window.addEventListener("beforeunload", () => {
  stopScanning();
  stopCamera();
  cleanupTargetFeatures();
});
