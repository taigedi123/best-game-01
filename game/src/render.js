// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Glow comes from layered radial gradients —
// no images, no fonts loaded, nothing over the network.

import { FIELD, PALETTE } from './config.js';
import {
  drawBanner,
  drawBossBar,
  drawGameOverPanel,
  drawHud,
  drawPausedPanel,
  drawTitlePanel,
  drawVictoryPanel,
} from './ui.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/**
 * A soft glowing disc, pre-rendered once to an offscreen sprite and then blitted:
 * creating a radial gradient per entity per frame cost too much under software
 * rendering (the first playtest ran at ~21 fps), so each colour gets one sprite.
 */
function makeGlowSprite(coreColor, haloColor) {
  const size = 128;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const sctx = sprite.getContext('2d');
  const halo = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  halo.addColorStop(0, haloColor);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = halo;
  sctx.fillRect(0, 0, size, size);
  sctx.fillStyle = coreColor;
  sctx.beginPath();
  sctx.arc(size / 2, size / 2, size / 2 / 2.6, 0, Math.PI * 2);
  sctx.fill();
  return sprite;
}

/** Blit a glow sprite centred at (x, y) with the given core radius. */
function glowSprite(ctx, sprite, x, y, radius) {
  const half = radius * 2.6;
  ctx.drawImage(sprite, x - half, y - half, half * 2, half * 2);
}

function wispColors(kind) {
  if (kind === 'chaser') return { rim: '#ff6b81', core: '#ffd9de' };
  if (kind === 'splitter') return { rim: '#7ce0a3', core: '#dcf7e6' };
  if (kind === 'mini') return { rim: '#c9b8ff', core: '#efeaff' };
  if (kind === 'orbiter') return { rim: '#b678f0', core: '#ecd9ff' };
  return { rim: '#8b7cf6', core: '#d9d2ff' };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  // One glow sprite per colour, built once.
  const sprites = {
    ember: makeGlowSprite(PALETTE.emberCore, 'rgba(255, 179, 71, 0.45)'),
    player: makeGlowSprite(PALETTE.playerCore, 'rgba(94, 242, 226, 0.55)'),
    bullet: makeGlowSprite('#ffd9e4', 'rgba(255, 92, 138, 0.5)'),
    boss: makeGlowSprite(PALETTE.bossCore, 'rgba(255, 77, 109, 0.5)'),
    bossFlash: makeGlowSprite('#ffffff', 'rgba(255, 255, 255, 0.6)'),
    drifter: makeGlowSprite('#d9d2ff', 'rgba(139, 124, 246, 0.5)'),
    chaser: makeGlowSprite('#ffd9de', 'rgba(255, 107, 129, 0.5)'),
    splitter: makeGlowSprite('#dcf7e6', 'rgba(124, 224, 163, 0.5)'),
    mini: makeGlowSprite('#efeaff', 'rgba(201, 184, 255, 0.5)'),
    orbiter: makeGlowSprite('#ecd9ff', 'rgba(182, 120, 240, 0.5)'),
  };
  // The vignette never changes, so its gradient is built once too.
  const vignette = ctx.createRadialGradient(
    FIELD.width / 2,
    FIELD.height / 2,
    FIELD.height * 0.42,
    FIELD.width / 2,
    FIELD.height / 2,
    FIELD.height * 0.85,
  );
  vignette.addColorStop(0, 'rgba(2, 2, 12, 0)');
  vignette.addColorStop(1, 'rgba(2, 2, 12, 0.6)');
  // A fixed starfield, seeded by hand so every visit looks the same.
  const stars = [];
  let s = 1234567;
  const nextStar = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: nextStar() * FIELD.width,
      y: nextStar() * FIELD.height,
      r: 0.5 + nextStar() * 1.6,
      tw: nextStar() * Math.PI * 2,
      speed: 0.4 + nextStar() * 1.2,
    });
  }

  function fitCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return dpr;
  }

  function drawBackground(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.voidTop);
    gradient.addColorStop(1, PALETTE.voidBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Two slow nebula blobs drifting with time.
    const nebula = (x, y, r, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    nebula(300 + Math.sin(state.time * 0.05) * 40, 220, 340, 'rgba(72, 52, 160, 0.20)');
    nebula(1020 + Math.cos(state.time * 0.04) * 50, 520, 380, 'rgba(28, 90, 130, 0.16)');
    // Twinkling stars.
    for (const star of stars) {
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * star.speed + star.tw));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfd4ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawEmbers(state) {
    for (const ember of state.embers) {
      const flicker = 0.85 + 0.15 * Math.sin(state.time * 6 * ember.flicker + ember.phase);
      ctx.globalAlpha = flicker;
      glowSprite(ctx, sprites.ember, ember.x, ember.y, ember.radius);
      ctx.globalAlpha = 1;
    }
  }

  function drawWisps(state) {
    for (const wisp of state.wisps) {
      const colors = wispColors(wisp.kind);
      // A smoky tail behind the wisp.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = colors.rim;
      ctx.beginPath();
      ctx.arc(wisp.x - wisp.vx * 0.06, wisp.y - wisp.vy * 0.06, wisp.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      glowSprite(ctx, sprites[wisp.kind], wisp.x, wisp.y, wisp.radius * 0.62);
      ctx.strokeStyle = colors.rim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wisp.x, wisp.y, wisp.radius, 0, Math.PI * 2);
      ctx.stroke();
      // Two pale eyes give the wisp a face.
      ctx.fillStyle = '#1a1030';
      const eye = wisp.radius * 0.32;
      ctx.beginPath();
      ctx.arc(wisp.x - eye, wisp.y - eye * 0.4, eye * 0.45, 0, Math.PI * 2);
      ctx.arc(wisp.x + eye, wisp.y - eye * 0.4, eye * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBoss(state) {
    const boss = state.boss;
    if (!boss) return;
    // Spiky corona.
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(state.time * 0.25);
    ctx.fillStyle = 'rgba(255, 77, 109, 0.35)';
    const spikes = 12;
    for (let i = 0; i < spikes; i += 1) {
      const angle = (i / spikes) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle - 0.09) * boss.radius * 0.95, Math.sin(angle - 0.09) * boss.radius * 0.95);
      ctx.lineTo(Math.cos(angle) * boss.radius * 1.45, Math.sin(angle) * boss.radius * 1.45);
      ctx.lineTo(Math.cos(angle + 0.09) * boss.radius * 0.95, Math.sin(angle + 0.09) * boss.radius * 0.95);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const core = boss.flash > 0 ? '#ffffff' : PALETTE.bossCore;
    glowSprite(ctx, boss.flash > 0 ? sprites.bossFlash : sprites.boss, boss.x, boss.y, boss.radius * 0.55);
    ctx.strokeStyle = PALETTE.boss;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
    ctx.stroke();
    // The hollow eye.
    ctx.fillStyle = '#0b0618';
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = core;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.radius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawBullets(state) {
    for (const bullet of state.bullets) {
      glowSprite(ctx, sprites.bullet, bullet.x, bullet.y, bullet.radius);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    // Blink while invulnerable after a hit.
    if (p.invulnerable > 0 && p.dashTime <= 0 && Math.floor(state.time * 14) % 2 === 0) return;
    const speed = Math.hypot(p.vx, p.vy);
    const stretch = 1 + Math.min(0.25, speed / 2400);
    ctx.save();
    ctx.translate(p.x, p.y);
    const angle = Math.atan2(p.vy, p.vx);
    ctx.rotate(Number.isFinite(angle) && speed > 30 ? angle : -Math.PI / 2);
    ctx.scale(stretch, 1 / stretch);
    glowSprite(ctx, sprites.player, 0, 0, p.radius * 0.7);
    // The ember-sprite: a flame teardrop pointing where it moves.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(p.radius + 8, 0);
    ctx.quadraticCurveTo(0, -p.radius, -p.radius * 0.7, 0);
    ctx.quadraticCurveTo(0, p.radius, p.radius + 8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, p.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(state) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const floater of state.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawPulseRing(state) {
    if (state.pulseRing <= 0) return;
    const progress = 1 - state.pulseRing;
    const p = state.player;
    ctx.save();
    ctx.globalAlpha = state.pulseRing * 0.9;
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 5 * state.pulseRing + 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20 + progress * 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw(state, screen, best) {
    const dpr = fitCanvas();
    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;
    const scale = Math.min(viewWidth / FIELD.width, viewHeight / FIELD.height);
    const offsetX = (viewWidth - FIELD.width * scale) / 2;
    const offsetY = (viewHeight - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    // Screen shake: a random offset that shrinks as the shake decays.
    if (state.shake > 0) {
      const magnitude = state.shake * 0.6;
      ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
    }
    drawBackground(state);
    drawEmbers(state);
    drawWisps(state);
    drawBoss(state);
    drawBullets(state);
    drawPlayer(state);
    drawParticles(state);
    drawFloaters(state);
    drawPulseRing(state);
    drawVignette();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, state);
      drawBanner(ctx, state);
      if (state.boss) drawBossBar(ctx, state.boss);
    }
    if (screen === SCREEN_TITLE) {
      drawTitlePanel(ctx, best, state.time);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(4, 4, 16, 0.55)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      drawPausedPanel(ctx);
    } else if (screen === SCREEN_OVER) {
      drawGameOverPanel(ctx, state.score, best);
    } else if (screen === SCREEN_WIN) {
      drawVictoryPanel(ctx, state.score, best);
    }
  }

  return { draw };
}
