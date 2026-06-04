(() => {
  "use strict";

  // =========================
  // ELEMENTI DOM
  // =========================
  const $ = (id) => document.getElementById(id);

  const screenStart = $("screenStart");
  const screenScan = $("screenScan");
  const screenResult = $("screenResult");

  const btnEnter = $("btnEnter");
  const btnExit = $("btnExit");
  const btnContinue = $("btnContinue");

  const video = $("video");
  const canvas = $("canvas");
  const scanStatus = $("scanStatus");

  const goodMatchesEl = $("goodMatches");
  const inliersEl = $("inliers");
  const detectionTextEl = $("detectionText");

  const targetImage = $("targetImage");
  const orientationBlocker = $("orientationBlocker");
  const engineHint = $("engineHint");

  if (!video || !canvas || !scanStatus || !btnEnter || !btnExit || !screenStart || !screenScan || !screenResult) {
    console.error("Mancano elementi HTML obbligatori. Controlla gli ID nel file index.html.");
    return;
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // =========================
  // STATO APP
  // =========================
  let stream = null;
  let cameraReady = false;
  let engineReady = false;
  let scanLoopActive = false;
  let secretFound = false;
  let rafId = null;

  // Evita falsi positivi
