// Web Audio API sound effects: gunshots, engine, sirens, explosions, UI.
let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

export function resumeAudio() {
  ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.3; }
export function isMuted() { return muted; }

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
  ensure();
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), ctx.currentTime + dur);
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

function noise(dur, vol = 0.2, filterFreq = 1000) {
  ensure();
  if (!ctx || muted) return;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
  src.stop(ctx.currentTime + dur);
}

export function sGunshot() {
  tone(220, 0.08, 'square', 0.25, -160);
  noise(0.06, 0.25, 3000);
}
export function sReload() {
  tone(800, 0.05, 'square', 0.1);
  setTimeout(() => tone(500, 0.05, 'square', 0.1), 100);
}
export function sMelee() { noise(0.1, 0.15, 500); }
export function sHurt() { tone(150, 0.2, 'sawtooth', 0.2, -50); }
export function sSiren() {
  tone(800, 0.15, 'sine', 0.15);
  setTimeout(() => tone(600, 0.15, 'sine', 0.15), 200);
}
export function sExplosion() {
  noise(0.4, 0.4, 800);
  tone(80, 0.3, 'sawtooth', 0.3, -40);
}
export function sCarStart() { tone(120, 0.3, 'sawtooth', 0.2, 80); }
export function sCarHorn() { tone(400, 0.3, 'square', 0.15); }
export function sPickup() { tone(880, 0.1, 'sine', 0.2); setTimeout(() => tone(1320, 0.1, 'sine', 0.2), 80); }
export function sMissionComplete() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sine', 0.25), i * 100));
}
export function sMissionFail() { tone(200, 0.5, 'sawtooth', 0.3, -100); }
export function sMenuClick() { tone(600, 0.05, 'square', 0.1); }
export function sWanted() { tone(600, 0.1, 'square', 0.2); setTimeout(() => tone(900, 0.1, 'square', 0.2), 100); }

let engineOsc = null, engineGain = null;
export function startEngine() {
  ensure();
  if (!ctx || muted || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 60;
  engineGain.gain.value = 0.08;
  engineOsc.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
}
export function updateEngine(speedRatio) {
  if (!engineOsc || !ctx) return;
  engineOsc.frequency.value = 50 + speedRatio * 120;
  engineGain.gain.value = 0.05 + speedRatio * 0.06;
}
export function stopEngine() {
  if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc.disconnect(); engineOsc = null; }
  if (engineGain) { engineGain.disconnect(); engineGain = null; }
}

let sirenTimer = null;
export function startSiren() {
  if (sirenTimer) return;
  sirenTimer = setInterval(() => { if (!muted) sSiren(); }, 600);
}
export function stopSiren() {
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
}