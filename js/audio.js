'use strict';

const Sfx = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;

  function init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  const ready = () => ctx && !muted;

  function tone({ f = 440, t = 0.15, type = 'sine', v = 0.2, at = 0, slide = null, attack = 0.005 }) {
    if (!ready()) return;
    const now = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, now + t);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(v, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + t + 0.05);
  }

  function noise({ t = 0.2, v = 0.3, at = 0, freq = 1000, type = 'lowpass', q = 1 }) {
    if (!ready()) return;
    const now = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t);
    src.connect(flt).connect(g).connect(master);
    src.start(now);
    src.stop(now + t + 0.05);
  }

  function clink(at = 0, base = 2400) {
    tone({ f: base, t: 0.08, type: 'triangle', v: 0.14, at });
    tone({ f: base * 1.5, t: 0.14, type: 'sine', v: 0.08, at: at + 0.02 });
  }

  return {
    init,
    toggleMute() { muted = !muted; return muted; },
    isMuted: () => muted,

    coin() { clink(0, 2300 + Math.random() * 500); },
    pick() { tone({ f: 520, t: 0.06, type: 'square', v: 0.04 }); },
    error() { tone({ f: 170, t: 0.18, type: 'square', v: 0.06 }); },
    tick() { tone({ f: 1100, t: 0.05, type: 'square', v: 0.05 }); },

    insert(payment) {
      let at = 0;
      payment.forEach(v => {
        if (v === 100) noise({ t: 0.35, v: 0.12, at, freq: 2500, type: 'bandpass', q: 0.7 });
        else clink(at, 1700 + Math.random() * 400);
        at += 0.12;
      });
    },

    hum() {
      if (!ready()) return { stop() {} };
      const now = ctx.currentTime;
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o1.type = 'sawtooth'; o1.frequency.value = 100;
      o2.type = 'sine'; o2.frequency.value = 200;
      lfo.frequency.value = 7; lfoGain.gain.value = 0.015;
      flt.type = 'lowpass'; flt.frequency.value = 450;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.12);
      lfo.connect(lfoGain).connect(g.gain);
      o1.connect(flt); o2.connect(flt);
      flt.connect(g).connect(master);
      [o1, o2, lfo].forEach(o => o.start(now));
      let stopped = false;
      return {
        stop() {
          if (stopped) return;
          stopped = true;
          const t = ctx.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
          [o1, o2, lfo].forEach(o => o.stop(t + 0.15));
        },
      };
    },

    ding() {
      tone({ f: 1568, t: 1.0, v: 0.22 });
      tone({ f: 3136, t: 0.6, v: 0.06 });
    },

    drop() {
      noise({ t: 0.08, v: 0.2, freq: 1500 });
      tone({ f: 190, t: 0.28, slide: 50, v: 0.5, at: 0.06 });
      noise({ t: 0.15, v: 0.3, freq: 350, at: 0.06 });
    },

    cascade(n) {
      const count = Math.min(Math.max(n, 2), 12);
      for (let i = 0; i < count; i++) clink(i * 0.045 + Math.random() * 0.03, 1900 + Math.random() * 1800);
    },

    bang() {
      tone({ f: 120, t: 0.22, slide: 60, v: 0.45 });
      noise({ t: 0.15, v: 0.35, freq: 600 });
    },

    kick() {
      tone({ f: 85, t: 0.45, slide: 32, v: 0.9 });
      noise({ t: 0.3, v: 0.7, freq: 260 });
      noise({ t: 0.5, v: 0.1, freq: 3000, type: 'bandpass', at: 0.02 });
    },

    giggle() {
      [0, 0.09, 0.18].forEach((at, i) => tone({ f: 900 + i * 120, t: 0.07, type: 'triangle', v: 0.08, at }));
    },

    shiver() {
      tone({ f: 300, t: 0.4, type: 'triangle', v: 0.06, slide: 240 });
    },

    whistle() {
      tone({ f: 1800, t: 0.25, type: 'square', v: 0.07 });
      tone({ f: 1800, t: 0.6, type: 'square', v: 0.07, at: 0.3 });
    },

    stamp() {
      tone({ f: 70, t: 0.35, slide: 40, v: 0.9 });
      noise({ t: 0.2, v: 0.6, freq: 400 });
    },

    gulp() {
      [0, 0.2, 0.4].forEach(at => tone({ f: 320, t: 0.14, slide: 120, v: 0.22, at }));
      tone({ f: 600, t: 0.25, type: 'triangle', v: 0.06, slide: 900, at: 0.62 });
    },

    flush() {
      noise({ t: 1.6, v: 0.35, freq: 900, type: 'bandpass', q: 0.6 });
      noise({ t: 1.2, v: 0.25, freq: 300, at: 0.3 });
      tone({ f: 700, t: 0.5, slide: 200, type: 'triangle', v: 0.05, at: 1.2 });
    },

    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 0.3, type: 'triangle', v: 0.12, at: i * 0.12 }));
    },
  };
})();
