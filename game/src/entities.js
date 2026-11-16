// The world of Ember Drift: every entity and the rules that move them.
// No drawing and no browser in here — step() advances one fixed step and reports
// what happened as bit flags, so the caller can play sounds and change screens
// without the world knowing about either.

import { BOSS, DASH, EMBER, FIELD, PLAYER, PULSE, WAVES } from './config.js';
import { kindStats, pickKind, waveSpec } from './waves.js';

export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_PULSE = 4;
export const EVENT_DASH = 8;
export const EVENT_WAVE = 16;
export const EVENT_BOSS = 32;
export const EVENT_WIN = 64;
export const EVENT_OVER = 128;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}

function removeAt(list, index) {
  list[index] = list[list.length - 1];
  list.pop();
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    wave: 1,
    waveTime: 0,
    between: 0,
    banner: '',
    bannerTimer: 0,
    lives: PLAYER.lives,
    over: false,
    won: false,
    shake: 0,
    pulseRing: 0,
    emberTimer: EMBER.interval,
    wispTimer: 1.2,
    attractEmberTimer: 0.4,
    attractWispTimer: 2,
    player: {
      x: FIELD.width / 2,
      y: FIELD.height - 110,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      invulnerable: 0,
      dashTime: 0,
      dashCooldown: 0,
      pulseCooldown: 0,
      faceX: 0,
      faceY: -1,
      trailTimer: 0,
    },
    embers: [],
    wisps: [],
    bullets: [],
    particles: [],
    floaters: [],
    boss: null,
  };

  function reset() {
    state.time = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.wave = 1;
    state.waveTime = 0;
    state.between = 0;
    state.banner = 'WAVE 1';
    state.bannerTimer = 2.5;
    state.lives = PLAYER.lives;
    state.over = false;
    state.won = false;
    state.shake = 0;
    state.pulseRing = 0;
    state.emberTimer = EMBER.interval;
    state.wispTimer = 1.2;
    state.embers.length = 0;
    state.wisps.length = 0;
    state.bullets.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.boss = null;
    const p = state.player;
    p.x = FIELD.width / 2;
    p.y = FIELD.height - 110;
    p.vx = 0;
    p.vy = 0;
    p.invulnerable = 0;
    p.dashTime = 0;
    p.dashCooldown = 0;
    p.pulseCooldown = 0;
    p.faceX = 0;
    p.faceY = -1;
    p.trailTimer = 0;
  }

  function addParticle(x, y, vx, vy, life, size, color) {
    state.particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      addParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.4 + random() * 0.4, 2 + random() * 3, color);
    }
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  function spawnEmber() {
    state.embers.push({
      x: 30 + random() * (FIELD.width - 60),
      y: -20,
      radius: EMBER.radius,
      speed: EMBER.fallSpeed + random() * EMBER.fallJitter,
      phase: random() * Math.PI * 2,
      flicker: 0.7 + random() * 0.6,
    });
  }

  function spawnWisp(kind, x, y) {
    const spec = waveSpec(state.wave);
    const stats = kindStats(kind, spec.wispSpeed);
    const px = x !== undefined ? x : 40 + random() * (FIELD.width - 80);
    const py = y !== undefined ? y : -30;
    const wisp = {
      kind,
      x: px,
      y: py,
      vx: 0,
      vy: stats.speed * 0.5,
      radius: stats.radius,
      speed: stats.speed,
      wobble: random() * Math.PI * 2,
      orbitX: state.player.x,
      orbitY: state.player.y - 160,
      orbitAngle: random() * Math.PI * 2,
      orbitRadius: 150,
    };
    state.wisps.push(wisp);
    return wisp;
  }

  function spawnBoss() {
    state.boss = {
      x: FIELD.width / 2,
      y: 150,
      vx: 0,
      vy: 0,
      radius: BOSS.radius,
      hp: BOSS.hp,
      maxHp: BOSS.hp,
      flash: 0,
      attackTimer: 2.2,
      attackIndex: 0,
      spiralTime: 0,
      spiralAngle: 0,
      spiralTimer: 0,
      strafePhase: random() * Math.PI * 2,
    };
    state.banner = 'THE HOLLOW STAR';
    state.bannerTimer = 3;
  }

  function killWisp(index, awardPoints) {
    const wisp = state.wisps[index];
    removeAt(state.wisps, index);
    burst(wisp.x, wisp.y, wispColor(wisp.kind), 10, 170);
    if (awardPoints) {
      state.score += PULSE.wispPoints;
      addFloater(wisp.x, wisp.y, `+${PULSE.wispPoints}`, '#d9d2ff');
    }
    if (wisp.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const mini = spawnWisp('mini', wisp.x + (i === 0 ? -14 : 14), wisp.y);
        mini.vx = (i === 0 ? -1 : 1) * 120;
        mini.vy = -60;
      }
    }
  }

  function wispColor(kind) {
    if (kind === 'chaser') return '#ff6b81';
    if (kind === 'splitter') return '#7ce0a3';
    if (kind === 'mini') return '#c9b8ff';
    if (kind === 'orbiter') return '#b678f0';
    return '#8b7cf6';
  }

  function hurtPlayer(fromX, fromY) {
    const p = state.player;
    if (p.invulnerable > 0 || state.over) return 0;
    state.lives -= 1;
    state.combo = 0;
    state.multiplier = 1;
    state.comboTimer = 0;
    p.invulnerable = PLAYER.invulnerableAfterHit;
    state.shake = 16;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    p.vx += (dx / len) * 420;
    p.vy += (dy / len) * 420;
    burst(p.x, p.y, '#5ef2e2', 16, 240);
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function firePulse() {
    const p = state.player;
    p.pulseCooldown = PULSE.cooldown;
    state.pulseRing = 1;
    state.shake = Math.max(state.shake, 6);
    let events = EVENT_PULSE;
    for (let i = state.wisps.length - 1; i >= 0; i -= 1) {
      const wisp = state.wisps[i];
      if (circleHit(p.x, p.y, PULSE.radius, wisp.x, wisp.y, wisp.radius)) killWisp(i, true);
    }
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      if (circleHit(p.x, p.y, PULSE.radius, bullet.x, bullet.y, bullet.radius)) {
        removeAt(state.bullets, i);
        state.score += PULSE.bulletPoints;
      }
    }
    if (state.boss && circleHit(p.x, p.y, PULSE.radius, state.boss.x, state.boss.y, state.boss.radius)) {
      damageBoss(PULSE.bossDamage);
      if (state.won) events |= EVENT_WIN;
    }
    return events;
  }

  function damageBoss(amount) {
    const boss = state.boss;
    if (!boss) return;
    boss.hp -= amount;
    boss.flash = 0.15;
    burst(boss.x, boss.y, '#ff4d6d', 8, 200);
    if (boss.hp <= 0) {
      state.score += BOSS.defeatPoints;
      addFloater(boss.x, boss.y, `+${BOSS.defeatPoints}`, '#ffd166');
      burst(boss.x, boss.y, '#ff4d6d', 60, 420);
      burst(boss.x, boss.y, '#ffd166', 40, 300);
      state.boss = null;
      state.bullets.length = 0;
      state.won = true;
      state.shake = 20;
    }
  }

  function fireRadial() {
    const boss = state.boss;
    for (let i = 0; i < BOSS.radialCount; i += 1) {
      const angle = (i / BOSS.radialCount) * Math.PI * 2 + boss.strafePhase;
      state.bullets.push({
        x: boss.x + Math.cos(angle) * (boss.radius + 8),
        y: boss.y + Math.sin(angle) * (boss.radius + 8),
        vx: Math.cos(angle) * BOSS.radialSpeed,
        vy: Math.sin(angle) * BOSS.radialSpeed,
        radius: BOSS.bulletRadius,
        life: 6,
      });
    }
  }

  function updatePlayer(dt, move, actions) {
    const p = state.player;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.pulseCooldown > 0) p.pulseCooldown -= dt;
    if (move.x !== 0 || move.y !== 0) {
      p.faceX = move.x;
      p.faceY = move.y;
    }

    let events = 0;
    if (actions.dash && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.dashTime = DASH.time;
      p.dashCooldown = DASH.cooldown;
      p.invulnerable = Math.max(p.invulnerable, DASH.time + 0.05);
      events |= EVENT_DASH;
      burst(p.x, p.y, '#5ef2e2', 8, 140);
    }
    if (actions.pulse && p.pulseCooldown <= 0) events |= firePulse();

    if (p.dashTime > 0) {
      p.dashTime -= dt;
      p.x += p.faceX * DASH.speed * dt;
      p.y += p.faceY * DASH.speed * dt;
    } else {
      p.vx += move.x * PLAYER.accel * dt;
      p.vy += move.y * PLAYER.accel * dt;
      const damp = Math.exp(-PLAYER.friction * dt);
      p.vx *= damp;
      p.vy *= damp;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > PLAYER.speed) {
        p.vx *= PLAYER.speed / speed;
        p.vy *= PLAYER.speed / speed;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.x = clamp(p.x, p.radius + 4, FIELD.width - p.radius - 4);
    p.y = clamp(p.y, p.radius + 4, FIELD.height - p.radius - 4);

    p.trailTimer -= dt;
    if (p.trailTimer <= 0 && (Math.hypot(p.vx, p.vy) > 200 || p.dashTime > 0)) {
      p.trailTimer = 0.03;
      addParticle(p.x, p.y, -p.vx * 0.08, -p.vy * 0.08, 0.35, 3, '#5ef2e2');
    }
    return events;
  }

  function updateEmbers(dt) {
    const p = state.player;
    let events = 0;
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const ember = state.embers[i];
      ember.y += ember.speed * dt;
      ember.x += Math.sin(state.time * EMBER.swaySpeed + ember.phase) * EMBER.sway * dt;
      if (ember.y > FIELD.height + 24) {
        removeAt(state.embers, i);
        continue;
      }
      if (circleHit(p.x, p.y, p.radius, ember.x, ember.y, ember.radius + 6)) {
        removeAt(state.embers, i);
        state.combo += 1;
        state.comboTimer = EMBER.comboWindow;
        state.multiplier = Math.min(EMBER.maxMultiplier, 1 + Math.floor(state.combo / EMBER.comboPerStep));
        const points = EMBER.basePoints * state.multiplier;
        state.score += points;
        addFloater(ember.x, ember.y - 10, `+${points}`, '#ffd166');
        burst(ember.x, ember.y, '#ffb347', 7, 130);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function updateWisps(dt) {
    const p = state.player;
    let events = 0;
    for (let i = state.wisps.length - 1; i >= 0; i -= 1) {
      const wisp = state.wisps[i];
      wisp.wobble += dt;
      const dx = p.x - wisp.x;
      const dy = p.y - wisp.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      if (wisp.kind === 'chaser' || wisp.kind === 'mini') {
        const turn = 3.2 * dt;
        const wantX = nx * wisp.speed;
        const wantY = ny * wisp.speed;
        wisp.vx += clamp(wantX - wisp.vx, -wisp.speed * turn, wisp.speed * turn);
        wisp.vy += clamp(wantY - wisp.vy, -wisp.speed * turn, wisp.speed * turn);
      } else if (wisp.kind === 'orbiter') {
        wisp.orbitAngle += dt * 2.1;
        wisp.orbitRadius = Math.max(64, wisp.orbitRadius - 7 * dt);
        wisp.orbitX += nx * 22 * dt;
        wisp.orbitY += ny * 22 * dt;
        const targetX = wisp.orbitX + Math.cos(wisp.orbitAngle) * wisp.orbitRadius;
        const targetY = wisp.orbitY + Math.sin(wisp.orbitAngle) * wisp.orbitRadius;
        wisp.vx = (targetX - wisp.x) * 6;
        wisp.vy = (targetY - wisp.y) * 6;
      } else {
        // Drifter and splitter: slow homing with a sideways wobble.
        const wob = Math.sin(wisp.wobble * 1.7) * 0.7;
        wisp.vx = nx * wisp.speed + -ny * wob * wisp.speed;
        wisp.vy = ny * wisp.speed + nx * wob * wisp.speed;
      }
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      wisp.x = clamp(wisp.x, wisp.radius, FIELD.width - wisp.radius);
      wisp.y = clamp(wisp.y, wisp.radius, FIELD.height - wisp.radius);
      if (circleHit(p.x, p.y, p.radius - 2, wisp.x, wisp.y, wisp.radius - 2)) {
        const hit = hurtPlayer(wisp.x, wisp.y);
        events |= hit;
        removeAt(state.wisps, i);
        burst(wisp.x, wisp.y, wispColor(wisp.kind), 12, 200);
        if (hit & EVENT_OVER) return events;
      }
    }
    return events;
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss) return 0;
    const p = state.player;
    let events = 0;
    if (boss.flash > 0) boss.flash -= dt;
    boss.strafePhase += dt;

    const dx = p.x - boss.x;
    const dy = p.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    let moveX = 0;
    let moveY = 0;
    if (dist > BOSS.keepDistance + 40) {
      moveX = nx;
      moveY = ny;
    } else if (dist < BOSS.keepDistance - 40) {
      moveX = -nx;
      moveY = -ny;
    } else {
      moveX = -ny * Math.sin(boss.strafePhase * 0.6);
      moveY = nx * Math.sin(boss.strafePhase * 0.6);
    }
    boss.x += moveX * BOSS.speed * dt;
    boss.y += moveY * BOSS.speed * dt;
    boss.x = clamp(boss.x, boss.radius, FIELD.width - boss.radius);
    boss.y = clamp(boss.y, boss.radius, FIELD.height - boss.radius);

    boss.attackTimer -= dt;
    if (boss.spiralTime > 0) {
      boss.spiralTime -= dt;
      boss.spiralTimer -= dt;
      if (boss.spiralTimer <= 0) {
        boss.spiralTimer = 0.085;
        boss.spiralAngle += 0.55;
        for (const offset of [0, Math.PI]) {
          const angle = boss.spiralAngle + offset;
          state.bullets.push({
            x: boss.x + Math.cos(angle) * (boss.radius + 8),
            y: boss.y + Math.sin(angle) * (boss.radius + 8),
            vx: Math.cos(angle) * BOSS.radialSpeed,
            vy: Math.sin(angle) * BOSS.radialSpeed,
            radius: BOSS.bulletRadius,
            life: 6,
          });
        }
      }
    } else if (boss.attackTimer <= 0) {
      boss.attackTimer = 3.4;
      const attacks = ['radial', 'spiral', 'summon'];
      const attack = attacks[boss.attackIndex % attacks.length];
      boss.attackIndex += 1;
      if (attack === 'radial') {
        fireRadial();
        boss.flash = 0.12;
      } else if (attack === 'spiral') {
        boss.spiralTime = 2.6;
        boss.spiralTimer = 0;
      } else {
        for (let i = 0; i < 3; i += 1) {
          const angle = (i / 3) * Math.PI * 2 + boss.strafePhase;
          spawnWisp('drifter', boss.x + Math.cos(angle) * 90, boss.y + Math.sin(angle) * 90);
        }
      }
    }

    if (circleHit(p.x, p.y, p.radius - 2, boss.x, boss.y, boss.radius - 4)) {
      events |= hurtPlayer(boss.x, boss.y);
    }
    return events;
  }

  function updateBullets(dt) {
    const p = state.player;
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -40 || bullet.x > FIELD.width + 40 || bullet.y < -40 || bullet.y > FIELD.height + 40) {
        removeAt(state.bullets, i);
        continue;
      }
      if (circleHit(p.x, p.y, p.radius - 2, bullet.x, bullet.y, bullet.radius - 1)) {
        removeAt(state.bullets, i);
        events |= hurtPlayer(bullet.x, bullet.y);
        if (events & EVENT_OVER) return events;
      }
    }
    return events;
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        removeAt(state.particles, i);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      floater.life -= dt;
      floater.y -= 42 * dt;
      if (floater.life <= 0) removeAt(state.floaters, i);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 42 * dt);
    if (state.pulseRing > 0) state.pulseRing = Math.max(0, state.pulseRing - dt / 0.35);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
  }

  function updateWaves(dt) {
    let events = 0;
    if (state.boss) return events;
    const spec = waveSpec(state.wave);
    if (state.between > 0) {
      state.between -= dt;
      state.emberTimer -= dt;
      if (state.emberTimer <= 0) {
        state.emberTimer = spec.emberInterval;
        spawnEmber();
      }
      return events;
    }
    state.waveTime += dt;
    state.emberTimer -= dt;
    if (state.emberTimer <= 0) {
      state.emberTimer = spec.emberInterval;
      spawnEmber();
    }
    state.wispTimer -= dt;
    if (state.wispTimer <= 0 && state.wisps.length < spec.maxWisps) {
      state.wispTimer = spec.wispInterval;
      spawnWisp(pickKind(spec, random));
    }
    if (state.waveTime >= spec.duration && state.wisps.length === 0) {
      state.score += WAVES.waveClearPoints * state.wave;
      events |= EVENT_WAVE;
      state.wave += 1;
      state.waveTime = 0;
      state.wispTimer = 1.0;
      if (state.wave >= WAVES.count) {
        spawnBoss();
        events |= EVENT_BOSS;
      } else {
        state.between = WAVES.between;
        state.banner = `WAVE ${state.wave}`;
        state.bannerTimer = 2.5;
      }
    }
    return events;
  }

  /** Attract mode behind the title screen: embers drift down, a few wisps float by. */
  function stepAttract(dt) {
    state.time += dt;
    state.attractEmberTimer -= dt;
    if (state.attractEmberTimer <= 0) {
      state.attractEmberTimer = 0.9;
      spawnEmber();
    }
    state.attractWispTimer -= dt;
    if (state.attractWispTimer <= 0 && state.wisps.length < 3) {
      state.attractWispTimer = 4;
      const wisp = spawnWisp('drifter');
      wisp.vy = 26;
      wisp.vx = (random() - 0.5) * 30;
    }
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const ember = state.embers[i];
      ember.y += ember.speed * 0.7 * dt;
      ember.x += Math.sin(state.time * EMBER.swaySpeed + ember.phase) * EMBER.sway * dt;
      if (ember.y > FIELD.height + 24) removeAt(state.embers, i);
    }
    for (let i = state.wisps.length - 1; i >= 0; i -= 1) {
      const wisp = state.wisps[i];
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      if (wisp.y > FIELD.height + 40) removeAt(state.wisps, i);
    }
    updateParticles(dt);
    return 0;
  }

  /**
   * Advance one fixed step. `move` is {x, y} in [-1, 1]; `actions` is
   * {pulse, dash}; `attract` runs the title-screen drift instead of the rules.
   */
  function step(dt, move, actions, attract) {
    if (attract) return stepAttract(dt);
    if (state.over || state.won) {
      updateParticles(dt);
      return 0;
    }
    state.time += dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }
    let events = 0;
    events |= updatePlayer(dt, move, actions);
    if (events & EVENT_WIN) return events;
    events |= updateEmbers(dt);
    events |= updateWisps(dt);
    if (events & EVENT_OVER) return events;
    events |= updateBoss(dt);
    if (events & EVENT_OVER) return events;
    if (state.won) return events | EVENT_WIN;
    events |= updateBullets(dt);
    if (events & EVENT_OVER) return events;
    events |= updateWaves(dt);
    updateParticles(dt);
    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    /** Jump straight to the boss wave (used by the ?shot=boss and ?shot=win scenes). */
    jumpToBoss() {
      reset();
      state.wave = WAVES.count;
      spawnBoss();
    },
    setBossHp(hp) {
      if (state.boss) state.boss.hp = Math.min(hp, state.boss.maxHp);
    },
    setScore(value) {
      state.score = value;
    },
    setPlayerInvulnerable(seconds) {
      state.player.invulnerable = seconds;
    },
    damageBoss,
  };
}
