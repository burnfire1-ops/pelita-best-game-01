// The upgrade web: 4 families x 3 tiers. The numbers live in config.js; this
// module answers what a level costs, what it does, and whether the player can buy
// it — the renderer and the world both ask it, so the rules live in one place.

import { LANTERN, UPGRADES, UPGRADE_FAMILIES } from './config.js';

/** The families in display order, with their tier tables. */
export function families() {
  return UPGRADE_FAMILIES.map((key) => ({ key, ...UPGRADES[key] }));
}

/** The tier definition for `family` at `level` (1-3), or null past the top. */
export function tierDef(family, level) {
  const def = UPGRADES[family];
  if (!def || level < 1 || level > 3) return null;
  return def.tiers[level - 1];
}

/** What the next tier of `family` costs, given the current level (0-3). */
export function nextCost(family, level) {
  const tier = tierDef(family, level + 1);
  return tier ? tier.cost : null;
}

/** Can the player buy the next tier of `family` right now? */
export function canBuy(family, level, light) {
  if (level >= 3) return false;
  const cost = nextCost(family, level);
  return cost !== null && light >= cost;
}

/** Buy the next tier: returns the new level, or the old one if it cannot be bought. */
export function buy(family, level, light) {
  if (!canBuy(family, level, light)) return { level, light };
  return { level: level + 1, light: light - nextCost(family, level) };
}

/** The beam's damage multiplier from the Api and Tempo tiers. */
export function beamDamageMul(upgrades) {
  const api = tierDef('api', upgrades.api);
  const tempo = tierDef('tempo', upgrades.tempo);
  let mul = 1;
  if (api && api.damageMul) mul *= api.damageMul;
  if (tempo && tempo.damageMul) mul *= tempo.damageMul;
  return mul;
}

/** The beam's width multiplier from the Lebar tier. */
export function beamWidthMul(upgrades) {
  const lebar = tierDef('lebar', upgrades.lebar);
  return lebar && lebar.widthMul ? lebar.widthMul : 1;
}

/** Whether the beam splits into two (Lebar tier 3). */
export function beamSplit(upgrades) {
  const lebar = tierDef('lebar', upgrades.lebar);
  return Boolean(lebar && lebar.split);
}

/** The lanterns' damage multiplier from the Lampion tier. */
export function lanternDamageMul(upgrades) {
  const def = tierDef('lampion', upgrades.lampion);
  return def && def.lanternMul ? def.lanternMul : 1;
}

/** Whether lanterns slow enemies (Lampion tier 2 and up). */
export function lanternSlow(upgrades) {
  const def = tierDef('lampion', upgrades.lampion);
  return Boolean(def && def.slow);
}

/** The light-drop multiplier from the Tempo tier. */
export function lightMul(upgrades) {
  const def = tierDef('tempo', upgrades.tempo);
  return def && def.lightMul ? def.lightMul : 1;
}

/** Can the player place another lantern? (cost and the 6-slot cap.) */
export function canPlaceLantern(light, placed) {
  return placed < LANTERN.max && light >= LANTERN.cost;
}
