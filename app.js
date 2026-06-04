const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const status = document.getElementById("status");
const matchesEl = document.getElementById("matches");

const startBtn = document.getElementById("startBtn");
const targetImage = document.getElementById("targetImage");

let stream;
let orb, matcher;
let targetKP, targetDesc;
let ready = false;

// ===== START FLOW =====
startBtn.addEventListener("click", start);

// ===== MAIN =====
async function start() {

  status.textContent = "Camera...";

  await startCamera();

  status.textContent = "Init OpenCV...";

  await initCV();

  status.textContent = "Scan attivo";

  scanLoop();
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
}

// ===== INIT CV =====
async function initCV() {

  // aspetta OpenCV
  await new Promise(resolve => {
    const t = setInterval(() => {
      if (window.cv && cv.Mat) {
        clearInterval(t);
        resolve();
      }
    }, 100);
  });

  orb = new cv.ORB(1000);
  matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);

  const img = cv.imread(targetImage);

  if (img.empty()) {
    status.textContent = "ERRORE target.jpg";
    return;
  }

  let gray = new cv.Mat();
  cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);

  targetKP = new cv.KeyPointVector();
  targetDesc = new cv.Mat();

  orb.detectAndCompute(gray, new cv.Mat(), targetKP, targetDesc);

  status.textContent = "KP target: " + targetKP.size();

  console.log("KP TARGET:", targetKP.size());

  img.delete();
  gray.delete();

  ready = true;
}

// ===== SCAN =====
function scanLoop() {

  if (!ready) return;

  if (video.videoWidth === 0) {
    requestAnimationFrame(scanLoop);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  detect();
  requestAnimationFrame(scanLoop);
}

// ===== DETECTION =====
function detect() {

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  let kp = new cv.KeyPointVector();
  let desc = new cv.Mat();

  orb.detectAndCompute(gray, new cv.Mat(), kp, desc);

  if (!desc.empty()) {

    let matches = new cv.DMatchVectorVector();
    matcher.knnMatch(targetDesc, desc, matches, 2);

    let good = 0;

    for (let i = 0; i < matches.size(); i++) {
      let pair = matches.get(i);

      if (pair.size() >= 2) {
        let m = pair.get(0);
        let n = pair.get(1);

        if (m.distance < 0.85 * n.distance) {
          good++;
        }

        m.delete();
        n.delete();
      }

      pair.delete();
    }

    matchesEl.textContent = good;

  }

  src.delete();
  gray.delete();
  kp.delete();
  desc.delete();
}

