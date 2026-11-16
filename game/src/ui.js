// The HUD and the screens' panels for Ember Drift: numbers, bars and menus drawn
// on the canvas. The renderer draws the world; this file draws everything that
// talks to the player.

import { DASH, FIELD, PALETTE, PLAYER, PULSE } from './config.js';

function panel(ctx, x, y, width, height, radius) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
  ctx.stroke();
}

function centerText(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function leftText(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function bar(ctx, x, y, width, height, fraction, fill, empty) {
  ctx.fillStyle = empty;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(height, width * fraction), height, height / 2);
    ctx.fill();
  }
}

/** Score, combo, wave, lives, pulse and dash cooldowns, plus the controls footer. */
export function drawHud(ctx, state) {
  const p = state.player;
  leftText(ctx, `SCORE ${state.score.toLocaleString('en-US')}`, 28, 34, '700 30px system-ui, sans-serif', PALETTE.text);
  if (state.combo > 1) {
    leftText(
      ctx,
      `COMBO x${state.multiplier}  (${state.combo})`,
      28,
      66,
      '700 20px system-ui, sans-serif',
      PALETTE.gold,
    );
  }
  centerText(ctx, `WAVE ${Math.min(state.wave, 10)} / 10`, FIELD.width / 2, 34, '700 24px system-ui, sans-serif', PALETTE.text);
  // Lives as small ember diamonds, top right.
  for (let i = 0; i < PLAYER.lives; i += 1) {
    const x = FIELD.width - 36 - i * 34;
    const y = 34;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < state.lives ? PALETTE.player : 'rgba(94, 242, 226, 0.18)';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
  // Pulse cooldown, bottom left.
  const pulseFraction = 1 - p.pulseCooldown / PULSE.cooldown;
  leftText(ctx, 'PULSE  [SPACE]', 28, FIELD.height - 52, '600 15px system-ui, sans-serif', PALETTE.muted);
  bar(ctx, 28, FIELD.height - 38, 170, 10, pulseFraction, PALETTE.player, 'rgba(255,255,255,0.12)');
  if (pulseFraction >= 1) {
    leftText(ctx, 'READY', 206, FIELD.height - 32, '700 14px system-ui, sans-serif', PALETTE.player);
  }
  // Dash cooldown, below the pulse bar.
  const dashFraction = 1 - p.dashCooldown / DASH.cooldown;
  leftText(ctx, 'DASH  [SHIFT]', 28, FIELD.height - 16, '600 13px system-ui, sans-serif', PALETTE.muted);
  bar(ctx, 150, FIELD.height - 21, 48, 8, dashFraction, PALETTE.gold, 'rgba(255,255,255,0.12)');
  // Controls footer, bottom centre.
  centerText(
    ctx,
    'WASD / ARROWS move   ·   SPACE pulse   ·   SHIFT dash   ·   P pause   ·   M mute',
    FIELD.width / 2,
    FIELD.height - 18,
    '13px system-ui, sans-serif',
    PALETTE.muted,
  );
}

/** The boss health bar, under the wave label while the Hollow Star lives. */
export function drawBossBar(ctx, boss) {
  const width = 440;
  const x = (FIELD.width - width) / 2;
  const y = 58;
  // A dark backing so the label stays readable when the boss drifts behind it.
  ctx.fillStyle = 'rgba(5, 5, 16, 0.65)';
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 14, width + 40, 66, 12);
  ctx.fill();
  centerText(ctx, 'THE HOLLOW STAR', FIELD.width / 2, y + 8, '700 16px system-ui, sans-serif', PALETTE.bossCore);
  bar(ctx, x, y + 24, width, 14, Math.max(0, boss.hp / boss.maxHp), PALETTE.bossCore, 'rgba(255,255,255,0.14)');
}

/** The wave banner that flashes when a wave (or the boss) begins. */
export function drawBanner(ctx, state) {
  if (state.bannerTimer <= 0 || !state.banner) return;
  const alpha = Math.min(1, state.bannerTimer);
  ctx.save();
  ctx.globalAlpha = alpha;
  centerText(ctx, state.banner, FIELD.width / 2, 150, '700 54px system-ui, sans-serif', PALETTE.gold);
  ctx.restore();
}

const CONTROLS = [
  ['WASD / ARROWS', 'drift through the void'],
  ['SPACE / RIGHT-CLICK', 'pulse blast — shatter nearby wisps'],
  ['SHIFT', 'dash — brief invulnerability'],
  ['P / ESC', 'pause'],
  ['M', 'mute'],
];

export function drawTitlePanel(ctx, best, time) {
  const width = 660;
  const height = 470;
  const x = (FIELD.width - width) / 2;
  const y = 96;
  panel(ctx, x, y, width, height, 18);
  centerText(ctx, 'EMBER DRIFT', FIELD.width / 2, y + 66, '800 62px system-ui, sans-serif', PALETTE.gold);
  centerText(
    ctx,
    'One last ember against the dark. Gather light. Survive the Hollow Star.',
    FIELD.width / 2,
    y + 112,
    '17px system-ui, sans-serif',
    PALETTE.text,
  );
  let lineY = y + 168;
  for (const [keys, what] of CONTROLS) {
    leftText(ctx, keys, x + 64, lineY, '700 17px system-ui, sans-serif', PALETTE.player);
    leftText(ctx, what, x + 300, lineY, '16px system-ui, sans-serif', PALETTE.muted);
    lineY += 34;
  }
  centerText(ctx, 'Collect embers to raise your combo. 10 waves — the last holds the boss.', FIELD.width / 2, lineY + 12, '15px system-ui, sans-serif', PALETTE.muted);
  const blink = 0.55 + 0.45 * Math.sin(time * 4);
  ctx.save();
  ctx.globalAlpha = blink;
  centerText(ctx, 'PRESS ENTER OR CLICK TO START', FIELD.width / 2, y + height - 58, '700 22px system-ui, sans-serif', PALETTE.text);
  ctx.restore();
  if (best > 0) {
    centerText(ctx, `BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, y + height - 26, '600 16px system-ui, sans-serif', PALETTE.gold);
  }
}

export function drawPausedPanel(ctx) {
  const width = 420;
  const height = 180;
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  panel(ctx, x, y, width, height, 16);
  centerText(ctx, 'PAUSED', FIELD.width / 2, y + 62, '800 44px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'P / ESC to resume', FIELD.width / 2, y + 122, '17px system-ui, sans-serif', PALETTE.muted);
}

export function drawGameOverPanel(ctx, score, best) {
  const width = 560;
  const height = 300;
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  panel(ctx, x, y, width, height, 18);
  centerText(ctx, 'THE LIGHT FADES', FIELD.width / 2, y + 62, '800 42px system-ui, sans-serif', PALETTE.danger);
  centerText(ctx, `SCORE  ${score.toLocaleString('en-US')}`, FIELD.width / 2, y + 132, '700 30px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, `BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, y + 176, '600 20px system-ui, sans-serif', PALETTE.gold);
  centerText(ctx, 'PRESS ENTER OR CLICK TO DRIFT AGAIN', FIELD.width / 2, y + 238, '700 19px system-ui, sans-serif', PALETTE.text);
}

export function drawVictoryPanel(ctx, score, best) {
  const width = 620;
  const height = 320;
  const x = (FIELD.width - width) / 2;
  const y = (FIELD.height - height) / 2;
  panel(ctx, x, y, width, height, 18);
  centerText(ctx, 'THE HOLLOW STAR FALLS', FIELD.width / 2, y + 62, '800 40px system-ui, sans-serif', PALETTE.gold);
  centerText(ctx, 'VICTORY — the void is lit again', FIELD.width / 2, y + 108, '19px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, `SCORE  ${score.toLocaleString('en-US')}`, FIELD.width / 2, y + 168, '700 32px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, `BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, y + 214, '600 20px system-ui, sans-serif', PALETTE.gold);
  centerText(ctx, 'PRESS ENTER OR CLICK TO PLAY AGAIN', FIELD.width / 2, y + 272, '700 19px system-ui, sans-serif', PALETTE.text);
}
