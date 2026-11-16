// Sound for Ember Drift: everything is synthesised with WebAudio, no audio files.
// A quiet ambient pad drones under play; short blips mark pickups, pulses and hits.
// The context is created on the first user gesture, never before.

export function createAudio() {
  let context = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!context || !master) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function noiseBurst(duration, volume, cutoff) {
    if (!context || !master) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    get muted() {
      return muted;
    },
    /** Create (or resume) the context from a user gesture. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.9;
    },
    /** Pickup blip: climbs a semitone per chained pickup, so a combo sounds like one. */
    collect(combo) {
      if (!ensure()) return;
      const step = Math.min(combo, 12);
      tone(520 * Math.pow(1.059, step), 0.14, 'sine', 0.22);
      tone(1040 * Math.pow(1.059, step), 0.1, 'triangle', 0.08);
    },
    pulse() {
      if (!ensure()) return;
      tone(180, 0.35, 'sine', 0.4, 48);
      noiseBurst(0.25, 0.25, 900);
    },
    hit() {
      if (!ensure()) return;
      tone(110, 0.3, 'sawtooth', 0.3, 55);
      noiseBurst(0.2, 0.3, 500);
    },
    dash() {
      if (!ensure()) return;
      noiseBurst(0.12, 0.12, 2400);
    },
    wave() {
      if (!ensure()) return;
      tone(392, 0.25, 'triangle', 0.16);
      tone(587, 0.35, 'triangle', 0.14);
    },
    roar() {
      if (!ensure()) return;
      tone(70, 0.9, 'sawtooth', 0.35, 38);
      noiseBurst(0.8, 0.2, 300);
    },
    win() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone(f, 0.4, 'triangle', 0.18), i * 120);
      });
    },
    startPad() {
      if (!ensure() || padNodes) return;
      const gain = context.createGain();
      gain.gain.value = 0.05;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const a = context.createOscillator();
      a.type = 'sine';
      a.frequency.value = 55;
      const b = context.createOscillator();
      b.type = 'sine';
      b.frequency.value = 82.41;
      const lfo = context.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 90;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      a.start();
      b.start();
      lfo.start();
      padNodes = { gain, a, b, lfo };
    },
    stopPad() {
      if (!padNodes || !context) return;
      const nodes = padNodes;
      padNodes = null;
      nodes.gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
      setTimeout(() => {
        try {
          nodes.a.stop();
          nodes.b.stop();
          nodes.lfo.stop();
        } catch {
          // Already stopped.
        }
      }, 500);
    },
  };
}
