// WebAudio synthesis: short, quiet, mutable sounds. No audio files.
let ac = null, master = null, drag = null, motor = null;
export const AUDIO = { on: true, vol: 0.5 };

function ctx() {
  if (!AUDIO.on) return null;
  try {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); master = ac.createGain(); master.connect(ac.destination); }
    master.gain.value = AUDIO.vol * 0.6;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  } catch (e) { return null; }
}
export function setAudio(on, vol) { AUDIO.on = on; AUDIO.vol = vol; if (master) master.gain.value = vol * 0.6; if (!on) { stopDrag(); stopMotor(); } }

function tone(freq, dur, type = 'sine', gain = 0.3, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, filt = 1200, gain = 0.25, q = 1, sweep = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(); s.buffer = b;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(filt, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(filt * sweep, t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  click: () => tone(660, 0.05, 'triangle', 0.08),
  cast: () => noise(0.35, 2500, 0.18, 0.8, 0.3),
  plop: () => { tone(420, 0.12, 'sine', 0.25, 0.4); noise(0.15, 900, 0.12); },
  reel: () => tone(1800, 0.02, 'square', 0.03),
  bite: () => { tone(110, 0.18, 'sine', 0.45, 0.6); tone(880, 0.08, 'triangle', 0.12, 1, 0.02); },
  hook: () => { noise(0.12, 3000, 0.25, 2); tone(220, 0.1, 'sawtooth', 0.12, 0.5); },
  snap: () => { noise(0.08, 5000, 0.35, 4); tone(1400, 0.15, 'square', 0.08, 0.3); },
  splash: () => noise(0.5, 700, 0.3, 0.7, 0.4),
  catch: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, 1, i * 0.09)); },
  lost: () => tone(300, 0.35, 'triangle', 0.18, 0.5),
  tick: () => tone(1200, 0.03, 'square', 0.05),
  fanfare: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, 1, i * 0.12)); noise(1.2, 1800, 0.08, 0.5, 0.6, 0.5); },
  cheer: () => noise(1.4, 1500, 0.14, 0.4, 0.8),
  warn: () => { tone(700, 0.15, 'square', 0.1); tone(700, 0.15, 'square', 0.1, 1, 0.25); },
  siren: () => { tone(500, 0.6, 'sawtooth', 0.08, 1.6); tone(800, 0.6, 'sawtooth', 0.08, 0.6, 0.6); },
};

// continuous drag buzz while fighting: pitch and level rise with tension
export function setDrag(tension, active) {
  const a = ctx(); if (!a) return;
  if (!active) { stopDrag(); return; }
  if (!drag) {
    const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    drag = { o, g, f };
  }
  drag.o.frequency.setTargetAtTime(60 + tension * 160, a.currentTime, 0.05);
  drag.g.gain.setTargetAtTime(tension > 0.6 ? 0.02 + (tension - 0.6) * 0.12 : 0.008, a.currentTime, 0.05);
}
export function stopDrag() { if (drag) { try { drag.o.stop(); } catch (e) { /* already stopped */ } drag = null; } }
export function startMotor() {
  const a = ctx(); if (!a || motor) return;
  const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = 48; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.05, a.currentTime + 0.3);
  o.connect(f); f.connect(g); g.connect(master); o.start(); motor = { o, g };
}
export function stopMotor() { if (motor) { const m = motor; motor = null; try { m.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.1); m.o.stop(ac.currentTime + 0.4); } catch (e) { /* noop */ } } }
