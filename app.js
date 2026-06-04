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
  let cvReady = false;
  let engineReady = false;
  let secretFound = false;
  let rafId = null;
  let lastProcessTs = 0;

  // soglie iniziali (ritoccabili)
  const MIN_GOOD_MATCHES = 18;
  const MIN_INLIERS = 10;
  const REQUIRED_CONSECUTIVE_DETECTIONS = 3;
  const PROCESS_EVERY_MS = 120; // riduce carico CPU
  const MAX_PROCESS_WIDTH = 960;

  let consecutiveDetections = 0;

  // OpenCV
  let orb = null;
  let matcher = null;
  let targetGray = null;
  let targetKeypoints = null;
  let targetDescriptors = null;

  // =========================
  // UI
  // =========================
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

  function setDebug(matches = 0, inliers = 0, detected = false) {
    if (goodMatchesEl) goodMatchesEl.textContent = String(matches);
    if (inliersEl) inliersEl.textContent = String(inliers);
    if (detectionTextEl) detectionTextEl.textContent = detected ? "SI" : "NO";
  }

  function resetDebug() {
    setDebug(0, 0, false);
    if (scanStatus) scanStatus.textContent = "In attesa...";
    consecutiveDetections = 0;
  }

  window.addEventListener("resize", updateOrientation);
  window.addEventListener("orientationchange", updateOrientation);

  // =========================
  // OpenCV init
  // =========================
  function waitForOpenCv() {
    return new Promise((resolve, reject) => {
      if (window.cv && typeof cv.Mat === "function") {
        cvReady = true;
        resolve();
        return;
      }

      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if (window.cv && typeof cv.Mat === "function") {
          clearInterval(timer);
          cvReady = true;
          resolve();
        } else if (tries > 250) {
          clearInterval(timer);
          reject(new Error("OpenCV non caricato"));
        }
      }, 100);
    });
  }

  function waitForImage(img) {
    return new Promise((resolve, reject) => {
      if (!img) {
        reject(new Error("targetImage non trovato"));
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

  function createORB() {
    // compatibilità tra build diverse di OpenCV.js
    if (window.cv && cv.ORB && typeof cv.ORB.create === "function") {
      return cv.ORB.create(1200);
