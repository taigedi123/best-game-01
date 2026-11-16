// Keyboard and pointer input for Ember Drift. Held keys give a movement vector;
// one-shot presses (confirm, pause, pulse, dash, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PULSE = 4;
export const ACTION_DASH = 8;
export const ACTION_MUTE = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const PULSE = new Set(['Space']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;

  function press(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (PULSE.has(code)) actions |= ACTION_PULSE;
    else if (DASH.has(code)) actions |= ACTION_DASH;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (
      CONFIRM.has(event.code) ||
      PAUSE.has(event.code) ||
      PULSE.has(event.code) ||
      DASH.has(event.code) ||
      MUTE.has(event.code)
    ) {
      if (!event.repeat) press(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      actions |= ACTION_PULSE;
      return;
    }
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector from the held keys, each axis -1, 0 or 1, normalised. */
    moveVector() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
