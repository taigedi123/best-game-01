// Every tuning number, colour and the seeded random source for Ember Drift.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 340,
  accel: 2600,
  friction: 6.5,
  lives: 3,
  invulnerableAfterHit: 2.0,
};

export const PULSE = {
  radius: 150,
  cooldown: 2.5,
  wispPoints: 25,
  bossDamage: 12,
  bulletPoints: 2,
};

export const DASH = {
  time: 0.22,
  speed: 980,
  cooldown: 1.4,
};

export const EMBER = {
  radius: 9,
  fallSpeed: 70,
  fallJitter: 55,
  sway: 42,
  swaySpeed: 1.6,
  interval: 0.85,
  basePoints: 10,
  comboWindow: 3.0,
  comboPerStep: 5, // every 5 chained pickups raises the multiplier by one
  maxMultiplier: 8,
};

export const WISP = {
  drifter: { radius: 15, speed: 62 },
  chaser: { radius: 14, speed: 118, turn: 3.2 },
  splitter: { radius: 20, speed: 78 },
  mini: { radius: 9, speed: 165, turn: 4.5 },
  orbiter: { radius: 13, speed: 150, orbit: 150 },
};

export const BOSS = {
  radius: 74,
  hp: 120,
  speed: 46,
  keepDistance: 230,
  radialCount: 14,
  radialSpeed: 150,
  bulletRadius: 7,
  defeatPoints: 1000,
};

export const WAVES = {
  duration: 18, // seconds of spawning per wave
  between: 2.5, // calm seconds between waves
  count: 10, // wave 10 is the boss
  waveClearPoints: 100,
};

export const PALETTE = {
  backdrop: '#070716',
  voidTop: '#0d0d26',
  voidBottom: '#050510',
  player: '#5ef2e2',
  playerCore: '#e8fffa',
  ember: '#ffb347',
  emberCore: '#ffe9b0',
  wisp: '#8b7cf6',
  wispCore: '#d9d2ff',
  chaser: '#ff6b81',
  splitter: '#7ce0a3',
  mini: '#c9b8ff',
  orbiter: '#b678f0',
  boss: '#3a2b5c',
  bossCore: '#ff4d6d',
  bullet: '#ff5c8a',
  text: '#f2f0ff',
  muted: '#8f8cb0',
  panel: 'rgba(16, 16, 44, 0.82)',
  panelEdge: '#4a3f8f',
  gold: '#ffd166',
  danger: '#ff5c6c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ember-drift.best';

/**
 * A seeded random source (splitmix32): the same seed gives the same game, which
 * is what makes the screenshot scenes repeatable.
 */
export function createRandom(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  };
}
