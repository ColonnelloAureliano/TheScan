const btn = document.getElementById("startBtn");
const status = document.getElementById("status");
const sub = document.getElementById("sub");
const progress = document.getElementById("progress");

const lvl = document.getElementById("lvl");
const dur = document.getElementById("dur");
const seq = document.getElementById("seq");

let ctx, analyser, data;
let running = false;

let threshold = 10;
let sequence = "";
let detecting = false;
let startSound = 0;

// CLICK
btn.onclick = async () => {
  if (running) return;

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();

    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const src = ctx.createMediaStreamSource(stream);

    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);

    data = new Uint8Array(analyser.frequencyBinCount);
    running = true;

    calibration();

  } catch(e) {
    alert("Errore microfono - usa HTTPS");
  }
};

function avg() {
  analyser.getByteFrequencyData(data);
  return data.reduce((a,b)=>a+b) / data.length;
}

// CALIBRAZIONE
function calibration() {
  btn.classList.add("calibrating");

  status.innerText = "Fai silenzio";
  sub.innerText = "Calibrazione...";

  let values = [];
  let start = Date.now();

  function loop() {
    values.push(avg());

    if (Date.now() - start < 3000) {
      requestAnimationFrame(loop);
    } else {
      threshold = (values.reduce((a,b)=>a+b)/values.length)*2;
      btn.classList.remove("calibrating");
      session();
    }
  }

  loop();
}

// SESSIONE 10s
function session() {
  status.innerText = "Ascolto";
  sub.innerText = "Fischia";

  let start = Date.now();

  function loop() {
    let a = avg();
    lvl.innerText = Math.round(a);

    if (a > threshold && !detecting) {
      detecting = true;
      startSound = Date.now();
      btn.classList.add("active");
    }

    if (a < threshold && detecting) {
      detecting = false;
      btn.classList.remove("active");

      let d = Date.now() - startSound;
      dur.innerText = d;

      let s = null;
      if (d > 200 && d < 450) s=".";
      if (d >= 500) s="-";

      if (s) {
        sequence += s;
        seq.innerText = sequence;
      }
    }

    progress.style.width = ((Date.now()-start)/100)+"%";

    if (Date.now() - start < 10000) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      status.innerText = "Fine";
    }
  }

  loop();
}
