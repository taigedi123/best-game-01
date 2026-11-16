// Boot and the one loop for Ember Drift: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between five screens:
// title, play, paused, game over and victory.
//
// ?seed=N fixes the pattern. ?shot=start|play|boss|win (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, PLAYER, STEP } from './config.js';
import { createRandom } from './config.js';
import {
  EVENT_BOSS,
  EVENT_DASH,
  EVENT_HIT,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_PULSE,
  EVENT_WAVE,
  EVENT_WIN,
  createWorld,
} from './entities.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_PULSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.startPad();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${PLAYER.lives} lives.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.win();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Victory. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function playEvents(events) {
    if (events & EVENT_PICKUP) audio.collect(world.state.combo);
    if (events & EVENT_PULSE) audio.pulse();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_BOSS) audio.roar();
    if (events & EVENT_HIT) {
      audio.hit();
      if (!(events & EVENT_OVER)) {
        announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
      }
    }
    if (events & EVENT_WIN) winGame();
    else if (events & EVENT_OVER) endGame();
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, { pulse: false, dash: false }, true);
      return;
    }
    const pulse = Boolean(actions & ACTION_PULSE);
    const dash = Boolean(actions & ACTION_DASH);
    const events = world.step(STEP, input.moveVector(), { pulse, dash }, false);
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        // One-shot presses belong to the first step of the frame only.
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting wisps drift unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for playtesting: the screen, score and lives, and the live world state.
  window.__game = {
    get screen() {
      return screen;
    },
    get score() {
      return world.state.score;
    },
    get lives() {
      return world.state.lives;
    },
    get wave() {
      return world.state.wave;
    },
    state: world.state,
  };

  announce('Ember Drift. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
