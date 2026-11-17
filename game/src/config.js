// PELITA — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. Balance was tuned so a gold-only sweeping beam wins
// nights 1-3 and falls in nights 6-7, while a colour-switching player can win all 7.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The temple the shadows march on. Enemies that touch it damage it. */
export const TEMPLE = { x: 640, y: 400, radius: 52, hp: 100, repair: 25 };

/** The sea's surface (the horizon), in field coordinates. Visual only: the
 *  island's top edge is at y=302, so the surface sits above it and the whole
 *  island reads as sand in the water, never as a disc floating in the sky. */
export const SEA_TOP = 210;

/** Beam colours. Gold, red and blue; keys 1/2/3 or Space to switch. */
export const COLORS = {
  gold: { name: 'Emas', hex: '#f2c94c', glow: '#fde68a', dark: '#b45309' },
  red: { name: 'Merah', hex: '#ef4444', glow: '#fca5a5', dark: '#7f1d1d' },
  blue: { name: 'Biru', hex: '#38bdf8', glow: '#bae6fd', dark: '#0c4a6e' },
};
export const COLOR_ORDER = ['gold', 'red', 'blue'];

/** The sacred beam from the temple. Always burning, aimed with the mouse. */
export const BEAM = {
  baseDamage: 44, // damage per second on a target in the wedge
  baseHalfAngle: 0.16, // radians each side of the aim line
  length: 950,
  /** Affinity multipliers: matching the enemy's colour doubles damage, the wrong
   *  colour halves it, and a neutral target (the boss) always takes full damage. */
  match: 2,
  mismatch: 0.5,
  neutral: 1,
};

/** Lanterns: placed on beach slots, they auto-fire a thin gold beam at the
 *  nearest enemy in range. */
export const LANTERN = {
  cost: 40,
  max: 6,
  range: 280,
  baseDamage: 12, // damage per second
  slowRadius: 200, // Lampion tier 2: enemies inside this are slowed
  slowFactor: 0.7, // ...to 70% of their speed
  slots: [
    { x: 450, y: 520 },
    { x: 830, y: 520 },
    { x: 400, y: 360 },
    { x: 880, y: 360 },
    { x: 520, y: 240 },
    { x: 760, y: 240 },
  ],
};

/** Enemy types. `affinity` is the beam colour that deals double damage. */
export const ENEMIES = {
  kecil: {
    name: 'Bayang Kecil', hp: 20, speed: 55, damage: 5, light: 10, radius: 13,
    affinity: 'gold', firstNight: 1,
  },
  besar: {
    name: 'Bayang Besar', hp: 60, speed: 28, damage: 15, light: 20, radius: 21,
    affinity: 'red', firstNight: 2,
  },
  terbang: {
    name: 'Bayang Terbang', hp: 30, speed: 46, damage: 8, light: 15, radius: 14,
    affinity: 'blue', firstNight: 3, sineAmp: 26, sineFreq: 2.2,
  },
  perisai: {
    name: 'Bayang Perisai', hp: 55, speed: 32, damage: 10, light: 25, radius: 17,
    affinity: 'gold', firstNight: 4, armor: 0.5,
  },
  pemecah: {
    name: 'Bayang Pemecah', hp: 40, speed: 40, damage: 5, light: 15, radius: 15,
    affinity: 'red', firstNight: 5, splits: 2,
  },
  penyembuh: {
    name: 'Bayang Penyembuh', hp: 45, speed: 35, damage: 8, light: 30, radius: 15,
    affinity: 'blue', firstNight: 6, healRate: 6, healRadius: 130,
  },
  wisp: {
    name: 'Wisp', hp: 12, speed: 72, damage: 3, light: 5, radius: 9,
    affinity: 'gold', firstNight: 7,
  },
};

/** Nyi Roro Kidul, the night-7 boss. Neutral affinity: every colour deals 1x. */
export const BOSS = {
  name: 'Nyi Roro Kidul', hp: 1500, speed: 17, light: 200, radius: 42,
  affinity: null,
  attackRange: 100, // stops here and bashes the temple
  attackInterval: 2.0, attackDamage: 8,
  enrageInterval: 1.4, enrageDamage: 12,
  summonInterval: 9, summonCount: 3, // phase 1: wisps
  tideInterval: 7, tideCount: 2, // phase 2: wisps, faster
  phase2At: 0.66, // below 66% hp
  phase3At: 0.33, // below 33% hp: enrage
  tideSpeed: 1.15, // phase 2 speed multiplier
  enrageSpeed: 1.5, // phase 3 speed multiplier
};

/** Night compositions: how many of each type spawn, spread over the night. */
export const NIGHTS = [
  { duration: 48, spawn: { kecil: 10 } },
  { duration: 48, spawn: { kecil: 7, besar: 4 } },
  { duration: 58, spawn: { kecil: 6, besar: 3, terbang: 4 } },
  { duration: 56, spawn: { kecil: 8, besar: 5, terbang: 5, perisai: 3 } },
  { duration: 70, spawn: { kecil: 8, besar: 5, terbang: 5, perisai: 2, pemecah: 1 } },
  { duration: 56, spawn: { kecil: 9, besar: 6, terbang: 6, perisai: 4, pemecah: 5, penyembuh: 4 } },
  {
    duration: 40,
    spawn: { kecil: 7, besar: 4, terbang: 4, perisai: 3, pemecah: 3, penyembuh: 2 },
    boss: true,
  },
];

/** The upgrade web: 4 families x 3 tiers. Prices rise per tier; a player should
 *  afford 1-2 upgrades per gap, never all of them. */
export const UPGRADES = {
  api: {
    name: 'Api', desc: 'Damage beam naik',
    tiers: [
      { level: 1, cost: 40, damageMul: 1.25, label: '+25% damage' },
      { level: 2, cost: 100, damageMul: 1.5, label: '+50% damage' },
      { level: 3, cost: 180, damageMul: 2.0, label: '+100% damage' },
    ],
  },
  lebar: {
    name: 'Lebar', desc: 'Beam lebih lebar, lalu terbelah',
    tiers: [
      { level: 1, cost: 40, widthMul: 1.3, label: '+30% lebar' },
      { level: 2, cost: 100, widthMul: 1.6, label: '+60% lebar' },
      { level: 3, cost: 180, widthMul: 1.6, split: true, label: 'Split 2 beam' },
    ],
  },
  lampion: {
    name: 'Lampion', desc: 'Lampion lebih kuat, lalu memperlambat',
    tiers: [
      { level: 1, cost: 50, lanternMul: 1.3, label: '+30% damage lampion' },
      { level: 2, cost: 120, lanternMul: 1.3, slow: true, label: 'Lampion slow' },
      { level: 3, cost: 200, lanternMul: 2.0, slow: true, label: '+100% damage lampion' },
    ],
  },
  tempo: {
    name: 'Tempo', desc: 'Cahaya lebih banyak, beam lebih cepat',
    tiers: [
      { level: 1, cost: 30, lightMul: 1.2, damageMul: 1.1, label: '+20% cahaya' },
      { level: 2, cost: 80, lightMul: 1.4, damageMul: 1.2, label: '+40% cahaya' },
      { level: 3, cost: 150, lightMul: 1.6, damageMul: 1.3, label: '+60% cahaya' },
    ],
  },
};
export const UPGRADE_FAMILIES = ['api', 'lebar', 'lampion', 'tempo'];

/** Sea and sky palette: deep night blues against warm gold light. */
export const PALETTE = {
  skyTop: '#0a1230',
  skyMid: '#0d1b3d',
  seaDeep: '#04101f',
  sea: '#0a2438',
  wave: '#16405e',
  sand: '#8a6d3b',
  sandLight: '#a8874f',
  rock: '#2b3442',
  rockDark: '#1c2330',
  templeStone: '#3a3f4a',
  templeRoof: '#1f2937',
  templeGold: '#f2c94c',
  text: '#fef9c3',
  muted: '#8fa3c4',
  panel: '#0b1526',
  panelLine: '#2a3a55',
  danger: '#ef4444',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the furthest night reached is kept between visits (this browser only). */
export const BEST_KEY = 'pelita.best';
