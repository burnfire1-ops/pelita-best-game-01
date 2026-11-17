// PELITA's world: pure game logic, no DOM, no Math.random. Every step is a fixed
// 1/60 s advance of one state object, so the same seed and the same inputs always
// give the same game — the balance harness and the screenshot scenes both drive
// this module directly. The browser loop only feeds it an aim angle and a colour.

import { BEAM, BOSS, ENEMIES, FIELD, LANTERN, NIGHTS, TEMPLE } from './config.js';
import { affinityMultiplier, armorFactor, makeBoss, makeEnemy } from './enemies.js';
import {
  beamDamageMul, beamSplit, beamWidthMul, buy as buyUpgrade, canBuy,
  canPlaceLantern, lanternDamageMul, lanternSlow, lightMul,
} from './upgrades.js';

export const EVENT_KILL = 1;
export const EVENT_HIT = 2; // the temple took damage
export const EVENT_NIGHT_CLEAR = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_BOSS = 32; // boss spawned or changed phase

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function angleTo(x, y) {
  return Math.atan2(y - TEMPLE.y, x - TEMPLE.x);
}

export function createWorld(rng) {
  let nextId = 1;

  const state = {
    time: 0,
    night: 0,
    phase: 'title', // title | night | upgrade | over | win
    templeHp: TEMPLE.hp,
    light: 0,
    lightEarned: 0,
    kills: 0,
    lanternsPlaced: 0,
    beamColor: 'gold',
    beamAngle: -Math.PI / 2,
    upgrades: { api: 0, lebar: 0, lampion: 0, tempo: 0 },
    lanterns: [], // { slot, x, y, angle, target }
    enemies: [],
    boss: null,
    spawnQueue: [], // { type, at, side, x, y }
    nightTime: 0,
    nightDuration: 0,
    nightScale: 1, // late-night toughness multiplier (1 until night 5)
    particles: [], // { x, y, vx, vy, life, maxLife, color, size }
    floaters: [], // { x, y, life, text, color }
    shake: 0,
    bossPhase: 0,
    nightsCleared: 0,
  };

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 220) return;
      const angle = rng.range(0, TAU);
      const vel = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel - 30,
        life: rng.range(0.3, 0.7),
        maxLife: 0.7,
        color,
        size: rng.range(2, 5),
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, life: 1, text, color });
  }

  function spawnPoint(side) {
    if (side === 'left') return { x: -30, y: rng.range(90, 680) };
    if (side === 'right') return { x: FIELD.width + 30, y: rng.range(90, 680) };
    return { x: rng.range(120, FIELD.width - 120), y: FIELD.height + 30 };
  }

  function buildSpawnQueue(night) {
    const def = NIGHTS[night - 1];
    const queue = [];
    // Each type's spawns are spread evenly across the night, so the mix at any
    // moment is representative: no night opens with three tanks by bad luck.
    // Sides rotate (left, bottom, right) from one random offset per night, so
    // every night pressures all three shores evenly.
    const sides = ['left', 'bottom', 'right'];
    const sideOffset = Math.floor(rng.next() * 3);
    let index = 0;
    for (const [type, count] of Object.entries(def.spawn)) {
      for (let i = 0; i < count; i += 1) {
        const at = 1 + ((i + 0.5) / count) * def.duration + rng.range(-1.5, 1.5);
        const side = sides[(index + sideOffset) % 3];
        const point = spawnPoint(side);
        queue.push({ type, at: Math.max(0.5, at), side, x: point.x, y: point.y });
        index += 1;
      }
    }
    queue.sort((a, b) => a.at - b.at);
    return queue;
  }

  function reset() {
    nextId = 1;
    state.time = 0;
    state.night = 0;
    state.phase = 'title';
    state.templeHp = TEMPLE.hp;
    state.light = 0;
    state.lightEarned = 0;
    state.kills = 0;
    state.lanternsPlaced = 0;
    state.beamColor = 'gold';
    state.beamAngle = -Math.PI / 2;
    state.upgrades = { api: 0, lebar: 0, lampion: 0, tempo: 0 };
    state.lanterns = [];
    state.enemies = [];
    state.boss = null;
    state.spawnQueue = [];
    state.nightTime = 0;
    state.nightDuration = 0;
    state.nightScale = 1;
    state.particles = [];
    state.floaters = [];
    state.shake = 0;
    state.bossPhase = 0;
    state.nightsCleared = 0;
  }

  /** Begin night `n` (1-7). `opts` lets a screenshot stage a night with light,
   *  upgrades and lanterns already in place. */
  function startNight(n, opts = {}) {
    const def = NIGHTS[n - 1];
    state.night = n;
    state.phase = 'night';
    state.nightTime = 0;
    state.nightDuration = def.duration;
    state.spawnQueue = buildSpawnQueue(n);
    state.enemies = [];
    state.boss = null;
    state.bossPhase = 0;
    // Late nights hit harder: from night 6 the shadows are tougher and faster.
    // Nights 1-5 are unscaled, so the early curve stays as tuned.
    state.nightScale = 1 + 0.15 * Math.max(0, n - 5);
    if (opts.light !== undefined) state.light = opts.light;
    if (opts.upgrades) state.upgrades = { ...state.upgrades, ...opts.upgrades };
    if (opts.lanterns) {
      for (const slot of opts.lanterns) placeLantern(slot, true);
    }
    if (def.boss) {
      const boss = makeBoss(FIELD.width / 2, FIELD.height + 60, nextId);
      nextId += 1;
      boss.summonAt = 6;
      state.boss = boss;
      state.bossPhase = 1;
    }
  }

  function startRun() {
    reset();
    startNight(1);
  }

  function placeLantern(slotIndex, free = false) {
    const slot = LANTERN.slots[slotIndex];
    if (!slot) return false;
    if (state.lanterns.some((lantern) => lantern.slot === slotIndex)) return false;
    if (!free && !canPlaceLantern(state.light, state.lanterns.length)) return false;
    if (!free) state.light -= LANTERN.cost;
    state.lanterns.push({ slot: slotIndex, x: slot.x, y: slot.y, angle: -Math.PI / 2, target: null });
    state.lanternsPlaced += 1;
    return true;
  }

  function tryBuy(family) {
    const level = state.upgrades[family];
    if (!canBuy(family, level, state.light)) return false;
    const result = buyUpgrade(family, level, state.light);
    state.upgrades[family] = result.level;
    state.light = result.light;
    return true;
  }

  function beamAngles() {
    const half = BEAM.baseHalfAngle * beamWidthMul(state.upgrades);
    if (beamSplit(state.upgrades)) {
      return [
        { angle: state.beamAngle - 0.2, half: half * 0.85 },
        { angle: state.beamAngle + 0.2, half: half * 0.85 },
      ];
    }
    return [{ angle: state.beamAngle, half }];
  }

  function damageEnemy(enemy, base, color) {
    const affinity = affinityMultiplier(enemy.type, color);
    const armor = armorFactor(enemy.type, color);
    enemy.hp -= base * affinity * armor;
    enemy.flash = 0.12;
  }

  function applyBeam(dt) {
    const angles = beamAngles();
    const damage = BEAM.baseDamage * beamDamageMul(state.upgrades);
    const targets = state.boss ? [...state.enemies, state.boss] : state.enemies;
    for (const enemy of targets) {
      const dx = enemy.x - TEMPLE.x;
      const dy = enemy.y - TEMPLE.y;
      const dist = Math.hypot(dx, dy);
      if (dist > BEAM.length || dist < TEMPLE.radius) continue;
      const enemyAngle = Math.atan2(dy, dx);
      let hit = false;
      for (const beam of angles) {
        if (Math.abs(angleDiff(enemyAngle, beam.angle)) < beam.half) { hit = true; break; }
      }
      if (!hit) continue;
      damageEnemy(enemy, damage * dt, state.beamColor);
      if (rng.chance(0.25)) {
        burst(enemy.x, enemy.y, '#f2c94c', 1, 60);
      }
    }
  }

  function applyLanterns(dt) {
    const damage = LANTERN.baseDamage * lanternDamageMul(state.upgrades);
    for (const lantern of state.lanterns) {
      let nearest = null;
      let nearestDist = LANTERN.range;
      const targets = state.boss ? [...state.enemies, state.boss] : state.enemies;
      for (const enemy of targets) {
        const dist = Math.hypot(enemy.x - lantern.x, enemy.y - lantern.y);
        if (dist < nearestDist) { nearest = enemy; nearestDist = dist; }
      }
      lantern.target = nearest;
      if (!nearest) continue;
      lantern.angle = Math.atan2(nearest.y - lantern.y, nearest.x - lantern.x);
      // Lantern light is gold, so it uses the gold affinity against each type.
      damageEnemy(nearest, damage * dt, 'gold');
      if (rng.chance(0.2)) burst(nearest.x, nearest.y, '#fde68a', 1, 40);
    }
  }

  function applySlow() {
    const slowOn = lanternSlow(state.upgrades);
    const all = state.boss ? [...state.enemies, state.boss] : state.enemies;
    for (const enemy of all) {
      enemy.slow = 1;
      if (!slowOn) continue;
      for (const lantern of state.lanterns) {
        if (Math.hypot(enemy.x - lantern.x, enemy.y - lantern.y) < LANTERN.slowRadius) {
          enemy.slow = LANTERN.slowFactor;
          break;
        }
      }
    }
  }

  function moveEnemy(enemy, dt) {
    const dx = TEMPLE.x - enemy.x;
    const dy = TEMPLE.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    let angle = Math.atan2(dy, dx);
    const def = ENEMIES[enemy.type];
    if (def && def.sineAmp) {
      // Flyers weave sideways as they close in.
      angle += Math.sin(state.time * def.sineFreq + enemy.phase) * 0.42;
    }
    enemy.angle = angle;
    const speed = enemy.speed * enemy.slow * dt;
    enemy.x += Math.cos(angle) * speed;
    enemy.y += Math.sin(angle) * speed;
    enemy.travelled += speed;
  }

  function healStep(enemy, dt) {
    const def = ENEMIES[enemy.type];
    if (!def || !def.healRate) return;
    enemy.healAt -= dt;
    if (enemy.healAt > 0) return;
    enemy.healAt = 0.5;
    const targets = state.boss ? [...state.enemies, state.boss] : state.enemies;
    for (const other of targets) {
      if (other === enemy) continue;
      if (other.hp >= other.maxHp) continue;
      if (Math.hypot(other.x - enemy.x, other.y - enemy.y) > def.healRadius) continue;
      other.hp = Math.min(other.maxHp, other.hp + def.healRate * 0.5);
      if (rng.chance(0.3)) burst(other.x, other.y, '#7dd3fc', 1, 30);
    }
  }

  function killEnemy(enemy, index, events) {
    const gain = Math.round(enemy.light * lightMul(state.upgrades));
    state.light += gain;
    state.lightEarned += gain;
    state.kills += 1;
    floater(enemy.x, enemy.y - 14, `+${gain}`, '#fef9c3');
    burst(enemy.x, enemy.y, '#f2c94c', 8, 120);
    burst(enemy.x, enemy.y, '#1c2330', 6, 90);
    if (enemy.type === 'pemecah') {
      // It bursts into two small shadows that keep marching on the temple.
      for (let i = 0; i < ENEMIES.pemecah.splits; i += 1) {
        const split = makeEnemy(
          'kecil',
          enemy.x + rng.range(-14, 14),
          enemy.y + rng.range(-14, 14),
          nextId,
          rng,
        );
        nextId += 1;
        state.enemies.push(split);
      }
    }
    state.enemies.splice(index, 1);
    return events | EVENT_KILL;
  }

  function bossStep(dt, events) {
    const boss = state.boss;
    if (!boss) return events;
    const fraction = boss.hp / boss.maxHp;
    let phase = 1;
    if (fraction < BOSS.phase3At) phase = 3;
    else if (fraction < BOSS.phase2At) phase = 2;
    if (phase !== state.bossPhase) {
      state.bossPhase = phase;
      events |= EVENT_BOSS;
    }
    const speedMul = phase === 3 ? BOSS.enrageSpeed : phase === 2 ? BOSS.tideSpeed : 1;
    const dx = TEMPLE.x - boss.x;
    const dy = TEMPLE.y - boss.y;
    const dist = Math.hypot(dx, dy);
    if (dist > BOSS.attackRange) {
      const angle = Math.atan2(dy, dx);
      boss.angle = angle;
      const speed = boss.speed * speedMul * boss.slow * dt;
      boss.x += Math.cos(angle) * speed;
      boss.y += Math.sin(angle) * speed;
      boss.travelled += speed;
    } else {
      // Parked at the temple, bashing it.
      boss.attackAt -= dt;
      if (boss.attackAt <= 0) {
        boss.attackAt = phase === 3 ? BOSS.enrageInterval : BOSS.attackInterval;
        const damage = phase === 3 ? BOSS.enrageDamage : BOSS.attackDamage;
        state.templeHp -= damage;
        state.shake = 0.35;
        burst(TEMPLE.x, TEMPLE.y + 30, '#ef4444', 8, 110);
        events |= EVENT_HIT;
      }
    }
    // Wisp summons in phases 1 and 2.
    if (phase < 3) {
      boss.summonAt -= dt;
      if (boss.summonAt <= 0) {
        boss.summonAt = phase === 2 ? BOSS.tideInterval : BOSS.summonInterval;
        const count = phase === 2 ? BOSS.tideCount : BOSS.summonCount;
        for (let i = 0; i < count; i += 1) {
          const wisp = makeEnemy(
            'wisp',
            boss.x + rng.range(-40, 40),
            boss.y + rng.range(-40, 40),
            nextId,
            rng,
          );
          nextId += 1;
          state.enemies.push(wisp);
        }
      }
    }
    return events;
  }

  function stepNight(dt, events) {
    state.nightTime += dt;
    // Spawn what is due.
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.nightTime) {
      const spawn = state.spawnQueue.shift();
      const enemy = makeEnemy(spawn.type, spawn.x, spawn.y, nextId, rng);
      nextId += 1;
      // Late-night scaling: tougher, faster shadows from night 6 on.
      enemy.hp = Math.round(enemy.hp * state.nightScale);
      enemy.maxHp = enemy.hp;
      enemy.speed = enemy.speed * state.nightScale;
      state.enemies.push(enemy);
    }
    applySlow();
    applyBeam(dt);
    applyLanterns(dt);
    // The boss moves, summons and bashes before the regular enemies walk.
    events = bossStep(dt, events);
    // Walk the enemies; those that reach the temple damage it and vanish.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      if (enemy.hp > 0) {
        moveEnemy(enemy, dt);
        healStep(enemy, dt);
      }
      const dist = Math.hypot(enemy.x - TEMPLE.x, enemy.y - TEMPLE.y);
      if (enemy.hp > 0 && dist <= TEMPLE.radius + enemy.radius - 4) {
        state.templeHp -= enemy.damage;
        state.shake = 0.3;
        burst(enemy.x, enemy.y, '#ef4444', 6, 100);
        state.enemies.splice(i, 1);
        events |= EVENT_HIT;
      }
    }
    // Deaths: burn, pay light, split, and check the boss.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      if (enemy.hp <= 0) events = killEnemy(enemy, i, events);
    }
    if (state.boss && state.boss.hp <= 0) {
      const gain = Math.round(state.boss.light * lightMul(state.upgrades));
      state.light += gain;
      state.lightEarned += gain;
      state.kills += 1;
      floater(state.boss.x, state.boss.y - 40, `+${gain}`, '#fef9c3');
      burst(state.boss.x, state.boss.y, '#f2c94c', 24, 200);
      burst(state.boss.x, state.boss.y, '#7dd3fc', 16, 160);
      state.boss = null;
      events |= EVENT_KILL;
    }
    // Temple destroyed.
    if (state.templeHp <= 0) {
      state.templeHp = 0;
      state.phase = 'over';
      return events | EVENT_OVER;
    }
    // Night cleared: nothing left to spawn, nothing left alive.
    const queueEmpty = state.spawnQueue.length === 0;
    const fieldEmpty = state.enemies.length === 0 && state.boss === null;
    if (queueEmpty && fieldEmpty) {
      state.nightsCleared = Math.max(state.nightsCleared, state.night);
      if (state.night >= 7) {
        state.phase = 'win';
        return events | EVENT_WIN;
      }
      // The village repairs the temple between nights.
      state.templeHp = Math.min(TEMPLE.hp, state.templeHp + TEMPLE.repair);
      state.phase = 'upgrade';
      return events | EVENT_NIGHT_CLEAR;
    }
    return events;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt * 0.8;
      f.y -= 24 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    for (const enemy of state.enemies) {
      if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
    }
    if (state.boss && state.boss.flash > 0) {
      state.boss.flash = Math.max(0, state.boss.flash - dt);
    }
  }

  /** Advance the world one fixed step. `input` carries the aim angle (radians,
   *  absolute, from the temple) and an optional colour override. Returns an
   *  events bitmask. */
  function step(dt, input = {}) {
    state.time += dt;
    if (input.aimAngle !== undefined) state.beamAngle = input.aimAngle;
    if (input.color) state.beamColor = input.color;
    if (state.phase === 'title') {
      // The title beam sweeps the sea on its own, slow and golden.
      state.beamAngle = -Math.PI / 2 + Math.sin(state.time * 0.3) * 0.9;
      state.beamColor = 'gold';
      stepParticles(dt);
      return 0;
    }
    stepParticles(dt);
    if (state.phase !== 'night') return 0;
    return stepNight(dt, 0);
  }

  function nextNight() {
    if (state.phase !== 'upgrade') return false;
    startNight(state.night + 1);
    return true;
  }

  return {
    state,
    reset,
    startRun,
    startNight,
    step,
    placeLantern,
    buy: tryBuy,
    nextNight,
  };
}
