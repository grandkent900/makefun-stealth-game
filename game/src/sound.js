// Every sound is synthesised live with WebAudio. No audio files, no
// network: oscillators and filtered noise, shaped by small envelopes.
import { makeRng } from './rng.js';

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;
  let drone = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function thud(vol) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rng = makeRng((Math.random() * 1e9) | 0);
    for (let i = 0; i < len; i++) data[i] = (rng() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    // A guard's step: louder the closer the guard is (dist in tiles).
    footstep(dist, loud) {
      if (!ctx || muted) return;
      const vol = loud ? 0.16 : 0.05;
      const near = Math.max(0, 1 - dist / 9);
      thud(vol * (0.25 + 0.75 * near));
    },
    guardStep(dist) {
      this.footstep(dist, true);
    },
    coinRing() {
      tone(2093, 0.5, 'sine', 0.22);
      tone(2637, 0.7, 'sine', 0.16);
      tone(1568, 0.4, 'triangle', 0.1);
    },
    coinThrow() {
      tone(900, 0.18, 'sine', 0.08, 1400);
    },
    pickup(kind) {
      if (kind === 'artifact') {
        tone(523, 0.12, 'sine', 0.2);
        setTimeout(() => tone(659, 0.12, 'sine', 0.2), 90);
        setTimeout(() => tone(784, 0.25, 'sine', 0.22), 180);
      } else {
        tone(880, 0.1, 'sine', 0.18);
        setTimeout(() => tone(1318, 0.2, 'sine', 0.18), 80);
      }
    },
    key() {
      tone(392, 0.12, 'triangle', 0.2);
      setTimeout(() => tone(523, 0.2, 'triangle', 0.2), 100);
    },
    door() {
      tone(180, 0.5, 'sawtooth', 0.1, 90);
      thud(0.2);
    },
    alarm() {
      tone(660, 0.35, 'square', 0.12);
      setTimeout(() => tone(660, 0.35, 'square', 0.12), 380);
      setTimeout(() => tone(880, 0.6, 'square', 0.1), 760);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.16, 110);
      setTimeout(() => tone(110, 0.8, 'sawtooth', 0.14), 200);
    },
    clear() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.18), i * 110));
    },
    // A low night drone under the title screen.
    startDrone() {
      if (!ensure() || drone || muted) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      drone = { osc, lfo, gain };
    },
  };
}
