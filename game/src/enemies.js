// The enemy roster: six shadow types plus the boss's wisps. The numbers live in
// config.js; this module turns them into spawned enemies and answers the two
// questions combat asks: how hard does a beam colour hit this type, and what does
// it drop when it burns.

import { BEAM, BOSS, ENEMIES } from './config.js';

/** The damage multiplier for a beam of `color` against an enemy of `type`.
 *  Matching affinity doubles it, the wrong colour halves it, and the boss is
 *  neutral: every colour deals full damage so no single colour dominates night 7. */
export function affinityMultiplier(type, color) {
  if (type === 'boss') return BEAM.neutral;
  const affinity = ENEMIES[type].affinity;
  return affinity === color ? BEAM.match : BEAM.mismatch;
}

/** Armor (Perisai only): incoming damage is halved unless the beam colour
 *  matches the enemy's affinity. */
export function armorFactor(type, color) {
  const def = ENEMIES[type];
  if (!def || !def.armor) return 1;
  return def.affinity === color ? 1 : 1 - def.armor;
}

/** A fresh enemy of the given type at a position, with a seeded id. */
export function makeEnemy(type, x, y, id, rng) {
  const def = ENEMIES[type];
  return {
    id,
    type,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    radius: def.radius,
    damage: def.damage,
    light: def.light,
    affinity: def.affinity,
    // Sine drift for flyers, a phase so two flyers never move in lockstep.
    phase: rng ? rng.range(0, Math.PI * 2) : 0,
    // Distance travelled; used to offset the sine sideways motion.
    travelled: 0,
    // Slow from lanterns, recomputed every step; 1 means full speed.
    slow: 1,
    // Healers pulse on a timer so the heal is not applied every frame.
    healAt: 0,
    // The angle this enemy is facing (towards the temple), for drawing.
    angle: 0,
    // Flash timer after taking a hit, for the burn glow.
    flash: 0,
  };
}

/** The boss, Nyi Roro Kidul: a big shadow with three phases. */
export function makeBoss(x, y, id) {
  return {
    id,
    type: 'boss',
    x,
    y,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    speed: BOSS.speed,
    radius: BOSS.radius,
    damage: BOSS.attackDamage,
    light: BOSS.light,
    affinity: null,
    phase: 1,
    travelled: 0,
    slow: 1,
    attackAt: 0, // next temple bash
    summonAt: 6, // first wisp summon, seconds into the night
    angle: 0,
    flash: 0,
  };
}
