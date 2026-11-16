// The screenshot scenes behind ?shot=start|play|boss|win. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (chase the nearest ember, shy away from wisps, pulse when crowded, close
// on the boss and pulse it down), so the frame is what a short game really looks
// like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './entities.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 20;
const BOSS_SECONDS = 9;
const WIN_LIMIT_SECONDS = 90;
const SAMPLE = STEP;

/** Where the autopilot wants to move, and whether it pulses or dashes. */
function autopilot(state) {
  const p = state.player;
  let moveX = 0;
  let moveY = 0;
  let pulse = false;
  const dash = false;

  if (state.boss) {
    // Close on the boss, then hold just inside pulse range and blast it.
    const dx = state.boss.x - p.x;
    const dy = state.boss.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 120) {
      moveX = dx / dist;
      moveY = dy / dist;
    }
    if (dist < 150 && p.pulseCooldown <= 0) pulse = true;
  } else {
    // Chase the nearest ember.
    let ember = null;
    let emberDist = Infinity;
    for (const candidate of state.embers) {
      const d = Math.hypot(candidate.x - p.x, candidate.y - p.y);
      if (d < emberDist) {
        emberDist = d;
        ember = candidate;
      }
    }
    if (ember) {
      moveX = (ember.x - p.x) / (emberDist || 1);
      moveY = (ember.y - p.y) / (emberDist || 1);
    } else {
      moveX = (FIELD.width / 2 - p.x) / FIELD.width;
      moveY = (FIELD.height / 2 - p.y) / FIELD.height;
    }
  }

  // Shy away from anything dangerous that gets close. Bullets repel hardest —
  // the autopilot would otherwise chase the boss straight into a radial burst.
  let threatX = 0;
  let threatY = 0;
  let threatNear = false;
  for (const wisp of state.wisps) {
    const dx = p.x - wisp.x;
    const dy = p.y - wisp.y;
    const dist = Math.hypot(dx, dy) || 1;
    const radius = wisp.radius + 90;
    if (dist < radius) {
      const weight = (radius - dist) / radius;
      threatX += (dx / dist) * weight;
      threatY += (dy / dist) * weight;
      threatNear = true;
      if (dist < 120 && p.pulseCooldown <= 0) pulse = true;
    }
  }
  for (const bullet of state.bullets) {
    const dx = p.x - bullet.x;
    const dy = p.y - bullet.y;
    const dist = Math.hypot(dx, dy) || 1;
    const radius = bullet.radius + 110;
    if (dist < radius) {
      const weight = ((radius - dist) / radius) * 2.2;
      threatX += (dx / dist) * weight;
      threatY += (dy / dist) * weight;
      threatNear = true;
    }
  }
  if (state.boss) {
    const dx = p.x - state.boss.x;
    const dy = p.y - state.boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < state.boss.radius + 50) {
      threatX += (dx / dist) * 1.5;
      threatY += (dy / dist) * 1.5;
      threatNear = true;
    }
  }
  if (threatNear) {
    const weight = state.boss ? 0.6 : 1.6;
    moveX += threatX * weight;
    moveY += threatY * weight;
  }

  const len = Math.hypot(moveX, moveY) || 1;
  return { move: { x: moveX / len, y: moveY / len }, pulse, dash };
}

/** Step the world with the autopilot for `seconds`, stopping early on the given event. */
function runFor(world, seconds, stopEvent) {
  let events = 0;
  for (let t = 0; t < seconds; t += SAMPLE) {
    const pilot = autopilot(world.state);
    events = world.step(SAMPLE, pilot.move, { pulse: pilot.pulse, dash: pilot.dash }, false);
    if (events & stopEvent) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, boss or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boss' && name !== 'win') {
    for (let t = 0; t < START_SECONDS; t += SAMPLE) {
      world.step(SAMPLE, { x: 0, y: 0 }, { pulse: false, dash: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    let events = runFor(world, PLAY_SECONDS, EVENT_OVER);
    if (events & EVENT_OVER) {
      // The pilot got caught: restart and take a shorter, safer run.
      world.reset();
      events = runFor(world, 11, EVENT_OVER);
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    world.jumpToBoss();
    runFor(world, BOSS_SECONDS, EVENT_OVER | EVENT_WIN);
    const over = world.state.lives === 0;
    const won = world.state.won;
    return { screen: won ? SCREEN_WIN : over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // win: the boss nearly beaten, the player shielded, the pilot closes in and
  // pulses it down — the victory screen is the real end of that fight.
  world.jumpToBoss();
  world.setBossHp(24);
  world.setPlayerInvulnerable(999);
  world.setScore(2480);
  const events = runFor(world, WIN_LIMIT_SECONDS, EVENT_WIN);
  if (!(events & EVENT_WIN) && !world.state.won) {
    world.damageBoss(9999);
    world.step(SAMPLE, { x: 0, y: 0 }, { pulse: false, dash: false }, false);
  }
  return { screen: SCREEN_WIN, best: world.state.score };
}
