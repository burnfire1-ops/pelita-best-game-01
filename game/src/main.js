// Boot and the one loop: input is taken once per frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// night, upgrade, game over and the win. The beam is always burning and follows
// the pointer; colour switches are one-shot actions.
//
// ?seed=N fixes the random stream. ?shot=start|play|upgrade|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BOSS, EVENT_HIT, EVENT_KILL, EVENT_NIGHT_CLEAR, EVENT_OVER, EVENT_WIN, createWorld,
} from './world.js';
import {
  ACTION_COLOR_BLUE, ACTION_COLOR_CYCLE, ACTION_COLOR_GOLD, ACTION_COLOR_RED,
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const COLOR_CYCLE = ['gold', 'red', 'blue'];

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
    // Storage can be off (private windows): the best then lasts this visit only.
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
  let aimAngle = -Math.PI / 2;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.startRun();
    screen = SCREEN_PLAY;
    aimAngle = -Math.PI / 2;
    announce('Malam 1. Arahkan beam dengan mouse, ganti warna dengan 1, 2, 3.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.over();
    if (world.state.night > best) {
      best = world.state.night;
      saveBest(best);
    }
    announce(`Desa jatuh di malam ${world.state.night}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.win();
    best = 7;
    saveBest(best);
    announce('Desa selamat! Ratu Kidul tumbang.');
  }

  function nightCleared() {
    screen = SCREEN_UPGRADE;
    audio.clear();
    if (world.state.night > best) {
      best = world.state.night;
      saveBest(best);
    }
    announce(`Malam ${world.state.night} selesai. Belanja upgrade, lalu lanjut.`);
  }

  /** Convert a canvas click to field coordinates and hit-test the screen's buttons. */
  function clickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const view = renderer.view;
    const fx = (clientX - rect.left - view.x) / view.scale;
    const fy = (clientY - rect.top - view.y) / view.scale;
    const buttons = renderer.buttonsFor(screen, world.state);
    for (const button of buttons) {
      if (fx >= button.x && fx <= button.x + button.w && fy >= button.y && fy <= button.y + button.h) {
        return button.id;
      }
    }
    return null;
  }

  function handleButton(id) {
    if (id === null) return false;
    if (id === 'start') {
      audio.unlock();
      startGame();
      return true;
    }
    if (id === 'pause') {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
      return true;
    }
    if (id === 'retry' || id === 'again') {
      audio.unlock();
      startGame();
      return true;
    }
    if (id === 'next') {
      if (world.nextNight()) {
        screen = SCREEN_PLAY;
        announce(`Malam ${world.state.night}.`);
      }
      return true;
    }
    if (id.startsWith('color:')) {
      world.state.beamColor = id.slice('color:'.length);
      audio.color();
      return true;
    }
    if (id.startsWith('upgrade:')) {
      const [, family] = id.split(':');
      const level = world.state.upgrades[family];
      if (world.buy(family)) {
        audio.buy();
        announce(`${family} naik ke tier ${level + 1}.`);
      }
      return true;
    }
    if (id.startsWith('lantern:')) {
      const slot = Number.parseInt(id.split(':')[1], 10);
      if (world.placeLantern(slot)) {
        audio.place();
        announce('Lampion dipasang.');
      }
      return true;
    }
    return false;
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Suara mati.' : 'Suara hidup.');
    }
    if (actions & ACTION_RESTART) {
      audio.unlock();
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      return; // clicks only; the LANJUT button advances
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Lanjut.');
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Jeda.');
        return;
      }
      if (actions & ACTION_COLOR_GOLD) { world.state.beamColor = 'gold'; audio.color(); }
      else if (actions & ACTION_COLOR_RED) { world.state.beamColor = 'red'; audio.color(); }
      else if (actions & ACTION_COLOR_BLUE) { world.state.beamColor = 'blue'; audio.color(); }
      else if (actions & ACTION_COLOR_CYCLE) {
        const index = COLOR_CYCLE.indexOf(world.state.beamColor);
        world.state.beamColor = COLOR_CYCLE[(index + 1) % COLOR_CYCLE.length];
        audio.color();
      }
    }
  }

  function step() {
    const pointer = input.pointer();
    if (pointer) {
      const view = renderer.view;
      const fx = (pointer.x - view.x) / view.scale;
      const fy = (pointer.y - view.y) / view.scale;
      // The aim is measured from the temple, not the field centre.
      aimAngle = Math.atan2(fy - 400, fx - 640);
    }
    const events = world.step(STEP, { aimAngle });
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_BOSS) audio.phase();
    if (events & EVENT_NIGHT_CLEAR) nightCleared();
    else if (events & EVENT_WIN) winGame();
    else if (events & EVENT_OVER) endGame();
    if (screen === SCREEN_PLAY) audio.zap(world.state.time);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let stepped = false;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        stepped = true;
        accumulator -= STEP;
      }
      if (!stepped && screen === SCREEN_TITLE) {
        // Keep the title beam sweeping even on a fast display.
        world.step(0, {});
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  canvas.addEventListener('pointerdown', (event) => {
    const id = clickAt(event.clientX, event.clientY);
    if (id !== null) handleButton(id);
  });

  // Leaving the tab pauses a running game rather than letting the temple fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  // A read-only handle for automated playtests (and nothing else): the live state,
  // the current screen, and the best score. It never drives the game.
  window.__pelita = {
    state: world.state,
    screen: () => screen,
    best: () => best,
    world,
  };

  announce('PELITA. Klik MULAI atau tekan Enter untuk bermain.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
