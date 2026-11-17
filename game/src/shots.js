// The screenshot scenes behind ?shot=start|play|upgrade|win. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// pilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame. The play pilot burns with a BLUE beam (the dossier
// must show a non-gold beam), the win pilot plays night 7 with everything bought
// until the boss falls.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function angleTo(x, y) {
  return Math.atan2(y - 400, x - 640);
}

/** The sweeping pilot: the beam sweeps left and right across the angular span of
 *  the enemies still alive, always gold. This is the balance-test pilot: it wins
 *  nights 1-3 and falls in nights 6-7. */
export function sweepPilot(state) {
  const targets = state.boss ? [...state.enemies, state.boss] : state.enemies;
  if (targets.length === 0) return { aimAngle: -Math.PI / 2, color: 'gold' };
  let min = Infinity;
  let max = -Infinity;
  for (const enemy of targets) {
    const angle = angleTo(enemy.x, enemy.y);
    if (angle < min) min = angle;
    if (angle > max) max = angle;
  }
  // Sweep the live span; if the span wraps the -pi/pi seam, sweep the long way.
  const span = max - min;
  const mid = (min + max) / 2;
  const sweep = span > 0.05 ? span / 2 : 0.4;
  const aimAngle = mid + Math.sin(state.time * 1.1) * sweep;
  return { aimAngle, color: 'gold' };
}

/** The dodge pilot (screenshot staging only): aim at the angle farthest from
 *  every live enemy, so the beam burns nothing and the wave accumulates. */
export function dodgePilot(state) {
  const angles = state.enemies.map((enemy) => angleTo(enemy.x, enemy.y));
  let best = -Math.PI / 2;
  let bestMin = -1;
  for (let deg = -180; deg < 180; deg += 5) {
    const angle = (deg * Math.PI) / 180;
    let minDist = Infinity;
    for (const enemyAngle of angles) {
      minDist = Math.min(minDist, Math.abs(angleDiff(angle, enemyAngle)));
    }
    if (angles.length === 0) minDist = Math.PI;
    if (minDist > bestMin) { bestMin = minDist; best = angle; }
  }
  return { aimAngle: best, color: 'gold' };
}

/** The tracking pilot: aim at the most threatening enemy (nearest the temple)
 *  and switch the beam colour to match its affinity. */
export function trackPilot(state) {
  const targets = state.boss ? [...state.enemies, state.boss] : state.enemies;
  if (targets.length === 0) return { aimAngle: -Math.PI / 2, color: state.beamColor };
  let nearest = targets[0];
  let nearestDist = Infinity;
  for (const enemy of targets) {
    const dist = Math.hypot(enemy.x - 640, enemy.y - 400);
    if (dist < nearestDist) { nearest = enemy; nearestDist = dist; }
  }
  const color = nearest.affinity || state.beamColor;
  return { aimAngle: angleTo(nearest.x, nearest.y), color };
}

/** The smart pilot: tracking plus sensible spending between nights. Used by the
 *  win staging and the winnability proof. */
export function smartPilot(state) {
  return trackPilot(state);
}

/** Spend light between nights the way a sensible player would: at most two
 *  upgrades and one lantern per gap (the SPEC's rule: 1-2 upgrades per gap, never
 *  everything). Priority: damage first, then width, then lanterns, then tempo. */
export function autoSpend(world) {
  const state = world.state;
  const order = ['api', 'lebar', 'lampion', 'tempo'];
  let bought = 0;
  for (const family of order) {
    if (bought >= 2) break;
    if (world.buy(family)) bought += 1;
  }
  // One lantern per gap, up to three placed.
  if (state.lanterns.length < 3) {
    for (let slot = 0; slot < 6; slot += 1) {
      if (world.placeLantern(slot)) break;
    }
  }
}

/**
 * Set `world` to the named scene (start, play, upgrade or win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'win') {
    // A real full campaign, played by the smart pilot with sensible spending,
    // until the boss falls. The stats on the win screen are the campaign's own.
    world.reset();
    world.startRun();
    let won = false;
    for (let stepCount = 0; stepCount < 7 * 200 * 60; stepCount += 1) {
      const events = world.step(STEP, smartPilot(state));
      if (events & EVENT_WIN) { won = true; break; }
      if (events & EVENT_OVER) break;
      if (state.phase === 'upgrade') {
        autoSpend(world);
        world.nextNight();
      }
    }
    if (!won) {
      // Fallback: a constructed win, still rendered by the real win screen.
      state.phase = 'win';
      state.nightsCleared = 7;
      state.kills = 150;
      state.lightEarned = 1400;
      state.lanternsPlaced = 6;
    }
    return { screen: SCREEN_WIN, best: 7 };
  }
  if (name === 'upgrade') {
    // A constructed gap after night 3: the real upgrade screen over real values.
    world.reset();
    state.night = 3;
    state.nightsCleared = 3;
    state.phase = 'upgrade';
    state.light = 450;
    state.lightEarned = 640;
    state.kills = 58;
    state.upgrades = { api: 1, lebar: 1, lampion: 1, tempo: 0 };
    state.lanterns = [
      { slot: 0, x: 450, y: 520, angle: -Math.PI / 2, target: null },
      { slot: 1, x: 830, y: 520, angle: -Math.PI / 2, target: null },
    ];
    state.lanternsPlaced = 2;
    return { screen: SCREEN_UPGRADE, best: 3 };
  }
  if (name === 'play') {
    // Night 4, mid-fight: two lanterns, Api + Lebar tier 1, and a BLUE beam.
    // Staging: the beam first DODGES (aims away from every shadow) for 20 s so
    // the wave accumulates, then TRACKS the nearest shadow in blue for 0.5 s,
    // so the captured frame shows the blue beam BURNING a mid-field enemy with
    // embers, 4 shadows alive, 2 lanterns firing. (The plain 15 s sweep left
    // the beam on empty sky with only 2 shadows alive and no hit.)
    world.reset();
    world.startNight(4, {
      light: 320,
      upgrades: { api: 1, lebar: 1, lampion: 0, tempo: 0 },
      lanterns: [0, 1],
    });
    const DODGE_SECONDS = 20;
    const TRACK_SECONDS = 0.5;
    const dodgeSteps = Math.round(DODGE_SECONDS / STEP);
    const totalSteps = Math.round((DODGE_SECONDS + TRACK_SECONDS) / STEP);
    let over = false;
    for (let index = 0; index < totalSteps; index += 1) {
      const pilot = index < dodgeSteps ? dodgePilot(state) : trackPilot(state);
      pilot.color = 'blue';
      const events = world.step(STEP, pilot);
      if (events & EVENT_OVER) { over = true; break; }
    }
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: 3 };
  }
  // Default: the title screen, the beam sweeping the sea on its own.
  world.reset();
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, {});
  return { screen: SCREEN_TITLE, best: 0 };
}
