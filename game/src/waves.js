// Wave design for Ember Drift: what each wave throws at the player, and when.
// Waves 1-9 escalate in count, speed and variety; wave 10 is the boss alone.

import { WAVES, WISP } from './config.js';

export const WAVE_KINDS = ['drifter', 'chaser', 'splitter', 'orbiter'];

/** The spawn plan for wave `n` (1-9; wave 10 is the boss, handled by the world). */
export function waveSpec(n) {
  const t = Math.min(n, 9);
  return {
    duration: WAVES.duration,
    wispInterval: Math.max(0.55, 1.7 - 0.13 * (t - 1)),
    wispSpeed: 1 + 0.09 * (t - 1),
    emberInterval: Math.max(0.55, 0.95 - 0.04 * (t - 1)),
    maxWisps: Math.min(16, 4 + t * 2),
    kinds: WAVE_KINDS.filter((kind) => {
      if (kind === 'drifter') return true;
      if (kind === 'chaser') return n >= 2;
      if (kind === 'splitter') return n >= 4;
      if (kind === 'orbiter') return n >= 6;
      return false;
    }),
  };
}

/** Pick a wisp kind for this wave, weighted toward the newer threats. */
export function pickKind(spec, random) {
  const kinds = spec.kinds;
  const roll = random();
  if (kinds.length > 2 && roll < 0.22) return kinds[kinds.length - 1];
  if (kinds.length > 1 && roll < 0.45) return kinds[kinds.length - 2];
  return kinds[0];
}

/** Radius and speed for a kind, scaled by the wave's speed factor. */
export function kindStats(kind, speedScale) {
  const base = WISP[kind];
  return { radius: base.radius, speed: base.speed * speedScale };
}
