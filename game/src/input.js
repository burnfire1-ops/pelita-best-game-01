// Mouse aim plus keyboard for PELITA. The beam is always burning and follows the
// pointer; colour switches are one-shot actions, queued as flags and taken once by
// the loop so a press between two frames is never lost and never counted twice.
// 1/2/3 pick gold/red/blue, Space cycles the colour, P pauses, M mutes, R restarts.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_COLOR_GOLD = 16;
export const ACTION_COLOR_RED = 32;
export const ACTION_COLOR_BLUE = 64;
export const ACTION_COLOR_CYCLE = 128;

const CONFIRM_KEYS = new Set(['Enter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const MUTE_KEYS = new Set(['KeyM']);
const RESTART_KEYS = new Set(['KeyR']);
const CYCLE_KEYS = new Set(['Space']);
const COLOR_KEYS = {
  Digit1: ACTION_COLOR_GOLD,
  Numpad1: ACTION_COLOR_GOLD,
  Digit2: ACTION_COLOR_RED,
  Numpad2: ACTION_COLOR_RED,
  Digit3: ACTION_COLOR_BLUE,
  Numpad3: ACTION_COLOR_BLUE,
};

export function createInput(target) {
  let actions = 0;
  // Pointer position in CSS pixels relative to the canvas; the game converts it
  // to field coordinates when it reads the aim.
  let pointerX = 640;
  let pointerY = 200;
  let pointerSeen = false;

  function queue(flag, event) {
    actions |= flag;
    if (event) event.preventDefault();
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (CONFIRM_KEYS.has(event.code)) queue(ACTION_CONFIRM, event);
    else if (PAUSE_KEYS.has(event.code)) queue(ACTION_PAUSE, event);
    else if (MUTE_KEYS.has(event.code)) queue(ACTION_MUTE, event);
    else if (RESTART_KEYS.has(event.code)) queue(ACTION_RESTART, event);
    else if (CYCLE_KEYS.has(event.code)) queue(ACTION_COLOR_CYCLE, event);
    else if (COLOR_KEYS[event.code]) queue(COLOR_KEYS[event.code], event);
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    pointerSeen = true;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    pointerSeen = true;
    // A click is a confirm on menus; the game hit-tests canvas buttons itself.
    queue(ACTION_CONFIRM, event);
  });
  return {
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queue an action from a canvas button the pointer landed on. */
    press(flag) {
      actions |= flag;
    },
    /** The pointer position in canvas CSS pixels, or null before any move. */
    pointer() {
      return pointerSeen ? { x: pointerX, y: pointerY } : null;
    },
  };
}
