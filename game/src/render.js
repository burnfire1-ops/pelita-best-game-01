// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Everything is flat canvas shapes with soft glow: a
// dark sea, a warm temple island, a beam of sacred light, and shadow enemies with
// glowing eyes. All motion comes from the world's clock, so the same state always
// paints the same frame.

import {
  BEAM, COLOR_ORDER, COLORS, ENEMIES, FIELD, FONT, LANTERN, PALETTE, TEMPLE,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'night';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

// HUD layout, in field coordinates. main.js hit-tests these rects via buttonsFor.
const HUD = {
  bar: { x: 0, y: 0, w: 1280, h: 64 },
  hpBar: { x: 250, y: 20, w: 170, h: 24 },
  colors: [
    { id: 'color:gold', x: 960, y: 12, w: 72, h: 40 },
    { id: 'color:red', x: 1040, y: 12, w: 72, h: 40 },
    { id: 'color:blue', x: 1120, y: 12, w: 72, h: 40 },
  ],
  pause: { id: 'pause', x: 1204, y: 12, w: 56, h: 40 },
};
const TITLE_START = { id: 'start', x: 490, y: 540, w: 300, h: 64 };
const UPGRADE_NEXT = { id: 'next', x: 1050, y: 510, w: 180, h: 56 };
const OVER_RETRY = { id: 'retry', x: 490, y: 480, w: 300, h: 64 };
const WIN_AGAIN = { id: 'again', x: 490, y: 540, w: 300, h: 64 };

/** Upgrade-web node positions: 4 family columns x 3 tiers. */
export const WEB = {
  columns: [300, 540, 780, 1020],
  rows: [180, 280, 380],
  radius: 30,
};
/** Lantern slots as drawn on the upgrade screen (a schematic beach row). */
export const UPGRADE_SLOTS = [380, 500, 620, 740, 860, 980].map((x) => ({ x, y: 540, r: 26 }));

/** A deterministic wobble in [-0.5, 0.5) from the world's clock: screen shake must
 *  look random but paint the same frame for the same world time. */
function shakeNoise(time, salt) {
  const s = Math.sin(time * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

// Fixed stars, generated once from a tiny seeded generator (no Math.random).
function makeStars() {
  let state = 1234;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let v = state;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * 300, r: 0.6 + next() * 1.4, tw: next() * 6 });
  }
  return stars;
}
const STARS = makeStars();

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function font(size, weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'center', weight = '') {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowText(value, x, y, size, color, glow, align = 'center', weight = '700') {
    context.save();
    context.shadowColor = glow;
    context.shadowBlur = 18;
    text(value, x, y, size, color, align, weight);
    context.restore();
  }

  function ellipse(cx, cy, rx, ry) {
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawSky(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.seaDeep);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Stars, twinkling on the world clock.
    for (const star of STARS) {
      const alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(state.time * 1.4 + star.tw));
      context.fillStyle = `rgba(255,255,240,${alpha.toFixed(2)})`;
      ellipse(star.x, star.y, star.r, star.r);
    }
    // The moon, upper left, with a soft halo.
    context.save();
    context.shadowColor = '#fef9c3';
    context.shadowBlur = 40;
    context.fillStyle = '#f5f0d8';
    ellipse(150, 90, 34, 34);
    context.restore();
    context.fillStyle = 'rgba(10,18,48,0.5)';
    ellipse(138, 82, 8, 8);
    ellipse(160, 100, 6, 6);
  }

  function drawSea(state) {
    // The sea fills the lower half and the side edges; the island sits in it.
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, 470, FIELD.width, FIELD.height - 470);
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, 0, 90, FIELD.height);
    context.fillRect(FIELD.width - 90, 0, 90, FIELD.height);
    // Slow waves: three sine lines, phase from the world clock.
    context.strokeStyle = PALETTE.wave;
    context.lineWidth = 2;
    for (let row = 0; row < 3; row += 1) {
      const baseY = 520 + row * 62;
      context.beginPath();
      for (let x = 0; x <= FIELD.width; x += 16) {
        const y = baseY + Math.sin(x * 0.012 + state.time * 0.9 + row * 2.1) * 7;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    // Foam where the sea meets the island.
    context.strokeStyle = 'rgba(190,220,240,0.35)';
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(TEMPLE.x, TEMPLE.y + 30, 250, 120, 0, 0, Math.PI * 2);
    context.stroke();
  }

  function drawVillage(state) {
    // A fishing village along the top edge: hut silhouettes, warm windows.
    context.fillStyle = '#0c1424';
    const huts = [
      { x: 120, w: 90, h: 60 }, { x: 260, w: 70, h: 48 }, { x: 980, w: 80, h: 55 },
      { x: 1100, w: 95, h: 62 },
    ];
    for (const hut of huts) {
      context.fillRect(hut.x, 60 - hut.h, hut.w, hut.h);
      context.beginPath();
      context.moveTo(hut.x - 8, 60 - hut.h);
      context.lineTo(hut.x + hut.w / 2, 60 - hut.h - 26);
      context.lineTo(hut.x + hut.w + 8, 60 - hut.h);
      context.closePath();
      context.fill();
      // A warm window, flickering gently on the clock.
      const flicker = 0.75 + 0.25 * Math.sin(state.time * 2 + hut.x);
      context.fillStyle = `rgba(242,201,76,${flicker.toFixed(2)})`;
      context.fillRect(hut.x + hut.w / 2 - 7, 60 - hut.h + 14, 14, 14);
      context.fillStyle = '#0c1424';
    }
    // A fishing boat, bobbing on the right.
    const bob = Math.sin(state.time * 0.8) * 3;
    context.fillStyle = '#101c30';
    context.beginPath();
    context.moveTo(1150, 640 + bob);
    context.lineTo(1240, 640 + bob);
    context.lineTo(1225, 662 + bob);
    context.lineTo(1165, 662 + bob);
    context.closePath();
    context.fill();
    context.strokeStyle = '#101c30';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(1195, 640 + bob);
    context.lineTo(1195, 590 + bob);
    context.stroke();
  }

  function drawIsland(state) {
    // Sandy island ring around the temple, on rock.
    context.fillStyle = PALETTE.rock;
    ellipse(TEMPLE.x, TEMPLE.y + 34, 268, 132);
    context.fillStyle = PALETTE.sand;
    ellipse(TEMPLE.x, TEMPLE.y + 28, 238, 112);
    context.fillStyle = PALETTE.sandLight;
    ellipse(TEMPLE.x, TEMPLE.y + 22, 200, 92);
    // Beach grass tufts.
    context.strokeStyle = '#5d7a3a';
    context.lineWidth = 2;
    for (const [gx, gy] of [[430, 500], [850, 500], [470, 300], [820, 300], [640, 520]]) {
      context.beginPath();
      context.moveTo(gx, gy);
      context.lineTo(gx - 5, gy - 12);
      context.moveTo(gx + 4, gy);
      context.lineTo(gx + 8, gy - 13);
      context.stroke();
    }
  }

  function drawTemple(state) {
    const { x, y } = TEMPLE;
    const flicker = 0.8 + 0.2 * Math.sin(state.time * 6);
    // Stone base with steps.
    context.fillStyle = PALETTE.templeStone;
    context.fillRect(x - 58, y + 18, 116, 26);
    context.fillRect(x - 70, y + 40, 140, 12);
    context.fillStyle = '#2c313c';
    context.fillRect(x - 46, y - 6, 92, 26);
    // The glowing doorway.
    context.save();
    context.shadowColor = PALETTE.templeGold;
    context.shadowBlur = 22 * flicker;
    context.fillStyle = PALETTE.templeGold;
    context.fillRect(x - 12, y - 2, 24, 22);
    context.restore();
    // Three tiered roofs, dark with gold trim.
    const roofs = [
      { w: 130, y: -6, h: 16 },
      { w: 100, y: -26, h: 14 },
      { w: 70, y: -44, h: 12 },
    ];
    for (const roof of roofs) {
      context.fillStyle = PALETTE.templeRoof;
      context.beginPath();
      context.moveTo(x - roof.w / 2, roof.y);
      context.lineTo(x + roof.w / 2, roof.y);
      context.lineTo(x + roof.w / 2 - 10, roof.y - roof.h);
      context.lineTo(x - roof.w / 2 + 10, roof.y - roof.h);
      context.closePath();
      context.fill();
      context.strokeStyle = PALETTE.templeGold;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - roof.w / 2, roof.y);
      context.lineTo(x + roof.w / 2, roof.y);
      context.stroke();
    }
    // The flame on top, flickering on the clock.
    const flameH = 16 + 4 * Math.sin(state.time * 9);
    context.save();
    context.shadowColor = '#f59e0b';
    context.shadowBlur = 18;
    context.fillStyle = '#fbbf24';
    context.beginPath();
    context.moveTo(x, y - 58 - flameH);
    context.quadraticCurveTo(x + 9, y - 50, x, y - 42);
    context.quadraticCurveTo(x - 9, y - 50, x, y - 58 - flameH);
    context.fill();
    context.restore();
    // Guardian statues flanking the steps.
    for (const side of [-1, 1]) {
      context.fillStyle = '#232a36';
      ellipse(x + side * 82, y + 26, 10, 18);
      ellipse(x + side * 82, y + 4, 8, 10);
    }
  }

  function drawLanternSlots(state, interactive) {
    for (let i = 0; i < LANTERN.slots.length; i += 1) {
      const slot = LANTERN.slots[i];
      const placed = state.lanterns.find((lantern) => lantern.slot === i);
      if (placed) continue; // placed lanterns draw below, with their glow
      context.save();
      context.setLineDash([5, 5]);
      context.strokeStyle = interactive ? 'rgba(254,249,195,0.8)' : 'rgba(254,249,195,0.35)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(slot.x, slot.y, 20, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      context.fillStyle = 'rgba(254,249,195,0.6)';
      text('+', slot.x, slot.y + 6, 20, 'rgba(254,249,195,0.7)');
    }
  }

  function drawLanterns(state) {
    for (const lantern of state.lanterns) {
      // Its thin beam to the current target.
      if (lantern.target) {
        context.save();
        context.strokeStyle = 'rgba(253,230,138,0.85)';
        context.lineWidth = 3;
        context.shadowColor = '#fde68a';
        context.shadowBlur = 8;
        context.beginPath();
        context.moveTo(lantern.x, lantern.y - 6);
        context.lineTo(lantern.target.x, lantern.target.y);
        context.stroke();
        context.restore();
      }
      // The paper lantern itself: a warm glowing box on a post.
      context.fillStyle = '#3a2f1d';
      context.fillRect(lantern.x - 2, lantern.y, 4, 16);
      context.save();
      context.shadowColor = '#fde68a';
      context.shadowBlur = 16;
      context.fillStyle = '#fde68a';
      roundRect(lantern.x - 11, lantern.y - 22, 22, 22, 6);
      context.fill();
      context.restore();
      context.fillStyle = '#7c5a10';
      context.fillRect(lantern.x - 11, lantern.y - 14, 22, 2);
      context.fillRect(lantern.x - 11, lantern.y - 8, 22, 2);
    }
  }

  function drawBeam(state) {
    const color = COLORS[state.beamColor];
    const half = 0.16; // visual half-angle, matches the widest play width
    context.save();
    context.globalCompositeOperation = 'lighter';
    const gradient = context.createRadialGradient(TEMPLE.x, TEMPLE.y, 10, TEMPLE.x, TEMPLE.y, 700);
    gradient.addColorStop(0, color.hex);
    gradient.addColorStop(0.25, color.hex);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.globalAlpha = 0.5;
    context.beginPath();
    context.moveTo(TEMPLE.x, TEMPLE.y);
    const a1 = state.beamAngle - half;
    const a2 = state.beamAngle + half;
    context.lineTo(TEMPLE.x + Math.cos(a1) * 700, TEMPLE.y + Math.sin(a1) * 700);
    context.arc(TEMPLE.x, TEMPLE.y, 700, a1, a2);
    context.closePath();
    context.fill();
    // The hot core of the beam.
    context.globalAlpha = 0.9;
    context.strokeStyle = color.glow;
    context.lineWidth = 7;
    context.shadowColor = color.hex;
    context.shadowBlur = 18;
    context.beginPath();
    context.moveTo(TEMPLE.x, TEMPLE.y);
    context.lineTo(
      TEMPLE.x + Math.cos(state.beamAngle) * 700,
      TEMPLE.y + Math.sin(state.beamAngle) * 700,
    );
    context.stroke();
    context.restore();
  }

  function drawEnemy(enemy, state) {
    const def = ENEMIES[enemy.type];
    const color = enemy.type === 'boss' ? '#5eead4' : COLORS[enemy.affinity].hex;
    const x = enemy.x;
    const y = enemy.y;
    const r = enemy.radius;
    context.save();
    // Shadow body: a dark blob with a faint rim in its affinity colour.
    context.fillStyle = '#0d1117';
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.globalAlpha = 0.92;
    context.beginPath();
    if (enemy.type === 'terbang') {
      // Wings, flapping on the clock.
      const flap = Math.sin(state.time * 10 + enemy.phase) * 0.5;
      context.moveTo(x - r, y);
      context.quadraticCurveTo(x - r * 1.9, y - r - flap * 10, x - r * 0.6, y - r * 0.4);
      context.quadraticCurveTo(x, y - r * 1.1, x + r * 0.6, y - r * 0.4);
      context.quadraticCurveTo(x + r * 1.9, y - r - flap * 10, x + r, y);
      context.quadraticCurveTo(x + r * 0.8, y + r, x, y + r);
      context.quadraticCurveTo(x - r * 0.8, y + r, x - r, y);
      context.closePath();
    } else if (enemy.type === 'besar') {
      // A hulking blob with spikes.
      context.moveTo(x - r, y + r * 0.6);
      context.lineTo(x - r * 0.7, y - r * 0.4);
      context.lineTo(x - r * 0.3, y - r * 1.1);
      context.lineTo(x, y - r * 0.5);
      context.lineTo(x + r * 0.3, y - r * 1.1);
      context.lineTo(x + r * 0.7, y - r * 0.4);
      context.lineTo(x + r, y + r * 0.6);
      context.quadraticCurveTo(x, y + r * 1.1, x - r, y + r * 0.6);
      context.closePath();
    } else {
      context.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2);
    }
    context.fill();
    context.stroke();
    context.restore();
    // Glowing eyes, always in the affinity colour.
    const eyeY = y - r * 0.15;
    const eyeDx = r * 0.36;
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 10;
    context.fillStyle = color;
    ellipse(x - eyeDx, eyeY, 3, 4);
    ellipse(x + eyeDx, eyeY, 3, 4);
    context.restore();
    // Type marks, so the six kinds read apart at a glance.
    if (enemy.type === 'perisai') {
      context.save();
      context.strokeStyle = COLORS.gold.hex;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, r + 6, -Math.PI * 0.7, Math.PI * 0.7);
      context.stroke();
      context.restore();
    } else if (enemy.type === 'pemecah') {
      context.save();
      context.strokeStyle = 'rgba(239,68,68,0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - r * 0.4, y - r * 0.6);
      context.lineTo(x, y);
      context.lineTo(x - r * 0.2, y + r * 0.5);
      context.moveTo(x + r * 0.5, y - r * 0.4);
      context.lineTo(x + r * 0.1, y + r * 0.2);
      context.stroke();
      context.restore();
    } else if (enemy.type === 'penyembuh') {
      // A faint healing aura and a small cross above.
      context.save();
      context.strokeStyle = 'rgba(56,189,248,0.4)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, r + 14, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = COLORS.blue.hex;
      context.fillRect(x - 2, y - r - 14, 4, 12);
      context.fillRect(x - 6, y - r - 10, 12, 4);
      context.restore();
    }
    // Burn flash while the beam is on it.
    if (enemy.flash > 0) {
      context.save();
      context.globalAlpha = Math.min(1, enemy.flash * 4);
      context.fillStyle = '#fde68a';
      ellipse(x, y, r * 0.9, r * 0.8);
      context.restore();
    }
    // A small HP bar once it is hurt.
    if (enemy.hp < enemy.maxHp) {
      const w = r * 2;
      const frac = Math.max(0, enemy.hp / enemy.maxHp);
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x - w / 2, y - r - 12, w, 5);
      context.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
      context.fillRect(x - w / 2, y - r - 12, w * frac, 5);
    }
  }

  function drawBoss(boss, state) {
    if (!boss) return;
    const x = boss.x;
    const y = boss.y;
    const r = boss.radius;
    const glow = '#5eead4';
    context.save();
    // Long hair flowing behind her, swaying on the clock.
    const sway = Math.sin(state.time * 1.8) * 6;
    context.fillStyle = '#0d1117';
    context.strokeStyle = glow;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x - r * 0.7, y - r * 0.5);
    context.quadraticCurveTo(x - r * 1.5, y + sway, x - r * 0.9, y + r * 1.2);
    context.quadraticCurveTo(x, y + r * 1.5, x + r * 0.9, y + r * 1.2);
    context.quadraticCurveTo(x + r * 1.5, y + sway, x + r * 0.7, y - r * 0.5);
    context.closePath();
    context.fill();
    context.stroke();
    // Her body and crown.
    context.beginPath();
    context.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#f2c94c';
    context.beginPath();
    context.moveTo(x - 16, y - r * 0.75);
    context.lineTo(x - 8, y - r * 1.15);
    context.lineTo(x, y - r * 0.8);
    context.lineTo(x + 8, y - r * 1.15);
    context.lineTo(x + 16, y - r * 0.75);
    context.closePath();
    context.fill();
    context.restore();
    // Glowing teal eyes.
    context.save();
    context.shadowColor = glow;
    context.shadowBlur = 14;
    context.fillStyle = glow;
    ellipse(x - 13, y - r * 0.2, 4, 5);
    ellipse(x + 13, y - r * 0.2, 4, 5);
    context.restore();
    if (boss.flash > 0) {
      context.save();
      context.globalAlpha = Math.min(1, boss.flash * 4);
      context.fillStyle = '#fde68a';
      ellipse(x, y, r * 0.9, r * 0.9);
      context.restore();
    }
    // Boss HP bar, wide and centred near the top.
    const w = 420;
    const frac = Math.max(0, boss.hp / boss.maxHp);
    context.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(FIELD.width / 2 - w / 2, 76, w, 16, 8);
    context.fill();
    context.fillStyle = frac > 0.66 ? '#5eead4' : frac > 0.33 ? '#facc15' : '#ef4444';
    roundRect(FIELD.width / 2 - w / 2, 76, w * frac, 16, 8);
    context.fill();
    text('NYI RORO KIDUL', FIELD.width / 2, 70, 18, '#5eead4', 'center', '700');
    if (state.bossPhase === 3) {
      glowText('ENRAGE', FIELD.width / 2, 116, 20, '#ef4444', '#ef4444');
    } else if (state.bossPhase === 2) {
      text('GELOMBANG PASANG', FIELD.width / 2, 116, 18, '#7dd3fc', 'center', '700');
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.save();
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      ellipse(p.x, p.y, p.size, p.size);
      context.restore();
    }
    for (const f of state.floaters) {
      context.save();
      context.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 18, f.color, 'center', '700');
      context.restore();
    }
  }

  function drawHud(state) {
    // Top bar.
    context.fillStyle = 'rgba(6,12,26,0.78)';
    context.fillRect(HUD.bar.x, HUD.bar.y, HUD.bar.w, HUD.bar.h);
    text(`MALAM ${state.night}/7`, 24, 42, 28, PALETTE.text, 'left', '700');
    // Temple HP.
    text('PURA', 190, 42, 18, PALETTE.muted, 'left', '700');
    const frac = state.templeHp / TEMPLE.hp;
    context.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(HUD.hpBar.x, HUD.hpBar.y, HUD.hpBar.w, HUD.hpBar.h, 6);
    context.fill();
    context.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    roundRect(HUD.hpBar.x, HUD.hpBar.y, HUD.hpBar.w * frac, HUD.hpBar.h, 6);
    context.fill();
    text(`${state.templeHp}`, HUD.hpBar.x + HUD.hpBar.w / 2, HUD.hpBar.y + 19, 16, '#ffffff', 'center', '700');
    // Light owned.
    context.save();
    context.shadowColor = '#fde68a';
    context.shadowBlur = 10;
    context.fillStyle = '#fde68a';
    ellipse(462, 32, 9, 11);
    context.restore();
    text(`${state.light}`, 480, 42, 26, PALETTE.text, 'left', '700');
    // Colour buttons.
    for (const button of HUD.colors) {
      const key = button.id.split(':')[1];
      const active = state.beamColor === key;
      context.save();
      roundRect(button.x, button.y, button.w, button.h, 8);
      context.fillStyle = active ? COLORS[key].hex : 'rgba(255,255,255,0.08)';
      context.fill();
      if (active) {
        context.strokeStyle = COLORS[key].glow;
        context.lineWidth = 3;
        context.stroke();
      } else {
        context.strokeStyle = 'rgba(255,255,255,0.25)';
        context.lineWidth = 1;
        context.stroke();
      }
      context.restore();
      text(COLORS[key].name.toUpperCase(), button.x + button.w / 2, button.y + 27, 15,
        active ? '#0b1526' : PALETTE.text, 'center', '700');
    }
    // Pause button.
    roundRect(HUD.pause.x, HUD.pause.y, HUD.pause.w, HUD.pause.h, 8);
    context.fillStyle = 'rgba(255,255,255,0.08)';
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 1;
    context.stroke();
    text('II', HUD.pause.x + HUD.pause.w / 2, HUD.pause.y + 28, 18, PALETTE.text, 'center', '700');
    // Lantern count, bottom left.
    text(`Lampion: ${state.lanterns.length}/${LANTERN.max}`, 24, FIELD.height - 18, 18, PALETTE.muted, 'left');
    if (state.night < 7) {
      text('Klik lampion di layar jeda untuk memasang', FIELD.width - 24, FIELD.height - 18, 16, PALETTE.muted, 'right');
    }
  }

  function drawPanel(x, y, w, h) {
    context.fillStyle = 'rgba(8,15,30,0.88)';
    roundRect(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelLine;
    context.lineWidth = 2;
    context.stroke();
  }

  function drawButton(rect, label, sub) {
    context.save();
    context.shadowColor = PALETTE.templeGold;
    context.shadowBlur = 16;
    context.fillStyle = PALETTE.templeGold;
    roundRect(rect.x, rect.y, rect.w, rect.h, 10);
    context.fill();
    context.restore();
    context.fillStyle = '#3d2c05';
    text(label, rect.x + rect.w / 2, rect.y + 40, 28, '#3d2c05', 'center', '700');
    if (sub) text(sub, rect.x + rect.w / 2, rect.y + rect.h + 24, 16, PALETTE.muted);
  }

  function drawStats(state, x, y) {
    const rows = [
      ['Malam', `${Math.max(state.nightsCleared, state.night)} / 7`],
      ['Bayang terbakar', `${state.kills}`],
      ['Cahaya terkumpul', `${state.lightEarned}`],
      ['Lampion terpasang', `${state.lanternsPlaced}`],
    ];
    rows.forEach(([label, value], i) => {
      const rowY = y + i * 34;
      text(label, x, rowY, 20, PALETTE.muted, 'left');
      text(value, x + 420, rowY, 20, PALETTE.text, 'right', '700');
    });
  }

  function drawTitle(state, best) {
    glowText('PELITA', FIELD.width / 2, 150, 110, PALETTE.templeGold, '#f59e0b');
    text('Penjaga Api Desa  •  Beam defense 7 malam', FIELD.width / 2, 196, 24, PALETTE.text);
    text('Arahkan sorot api suci. Bakar bayang laut sebelum mereka mencapai pura.',
      FIELD.width / 2, 232, 18, PALETTE.muted);
    drawButton(TITLE_START, 'MULAI', 'Mouse: arahkan beam  •  1/2/3 atau Spasi: ganti warna  •  P: jeda');
    if (best > 0) {
      text(`Malam terjauh: ${best} / 7`, FIELD.width / 2, 660, 20, PALETTE.text, 'center', '700');
    }
  }

  function drawUpgrade(state) {
    context.fillStyle = 'rgba(4,10,20,0.74)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`JEDA ANTAR MALAM — MALAM ${state.night + 1} BERIKUTNYA`, FIELD.width / 2, 56, 28, PALETTE.text, 'center', '700');
    text(`Cahaya: ${state.light}`, FIELD.width - 40, 56, 26, PALETTE.templeGold, 'right', '700');
    // The web: one column per family, three tiers down.
    const families = [
      { key: 'api', name: 'Api' },
      { key: 'lebar', name: 'Lebar' },
      { key: 'lampion', name: 'Lampion' },
      { key: 'tempo', name: 'Tempo' },
    ];
    families.forEach((family, col) => {
      const cx = WEB.columns[col];
      text(family.name.toUpperCase(), cx, 116, 22, PALETTE.text, 'center', '700');
      for (let tier = 1; tier <= 3; tier += 1) {
        const cy = WEB.rows[tier - 1];
        const level = state.upgrades[family.key];
        const bought = tier <= level;
        const next = tier === level + 1;
        if (tier > 1) {
          context.strokeStyle = bought ? PALETTE.templeGold : 'rgba(255,255,255,0.2)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(cx, WEB.rows[tier - 2] + WEB.radius);
          context.lineTo(cx, cy - WEB.radius);
          context.stroke();
        }
        context.save();
        context.beginPath();
        context.arc(cx, cy, WEB.radius, 0, Math.PI * 2);
        context.fillStyle = bought ? PALETTE.templeGold : 'rgba(255,255,255,0.06)';
        context.fill();
        if (bought) {
          context.shadowColor = PALETTE.templeGold;
          context.shadowBlur = 12;
          context.fill();
        }
        context.strokeStyle = bought ? PALETTE.templeGold : next ? PALETTE.text : 'rgba(255,255,255,0.25)';
        context.lineWidth = bought || next ? 3 : 1.5;
        context.stroke();
        context.restore();
        const label = bought ? '✓' : next ? '○' : '–';
        text(label, cx, cy + 8, bought ? 24 : 18, bought ? '#3d2c05' : PALETTE.text);
      }
      // Tier labels under the column.
      const level = state.upgrades[family.key];
      const labels = { api: ['+25% dmg', '+50% dmg', '+100% dmg'], lebar: ['+30% lebar', '+60% lebar', 'Split 2 beam'], lampion: ['+30% dmg', 'Lampion slow', '+100% dmg'], tempo: ['+20% cahaya', '+40% cahaya', '+60% cahaya'] };
      const costs = { api: [40, 100, 180], lebar: [40, 100, 180], lampion: [50, 120, 200], tempo: [30, 80, 150] };
      labels[family.key].forEach((label, i) => {
        const cy = WEB.rows[i];
        text(label, cx, cy + WEB.radius + 18, 13, level > i ? PALETTE.templeGold : PALETTE.muted);
        if (level === i) text(`${costs[family.key][i]} cahaya`, cx, cy + WEB.radius + 36, 12, PALETTE.text);
      });
    });
    // The beach: six lantern slots in a row.
    context.strokeStyle = PALETTE.panelLine;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(60, 448);
    context.lineTo(FIELD.width - 60, 448);
    context.stroke();
    text('PANTAI — klik slot kosong untuk pasang lampion (40 cahaya)', 60, 482, 18, PALETTE.text, 'left', '700');
    UPGRADE_SLOTS.forEach((slot, i) => {
      const placed = state.lanterns.some((lantern) => lantern.slot === i);
      context.save();
      context.beginPath();
      context.arc(slot.x, slot.y, slot.r, 0, Math.PI * 2);
      context.fillStyle = placed ? '#fde68a' : 'rgba(255,255,255,0.06)';
      context.fill();
      if (placed) {
        context.shadowColor = '#fde68a';
        context.shadowBlur = 14;
        context.fill();
      }
      context.setLineDash(placed ? [] : [4, 4]);
      context.strokeStyle = placed ? PALETTE.templeGold : 'rgba(255,255,255,0.4)';
      context.lineWidth = 2;
      context.stroke();
      context.restore();
      text(placed ? '✓' : '40', slot.x, slot.y + 6, placed ? 22 : 15, placed ? '#3d2c05' : PALETTE.muted, 'center', '700');
    });
    drawButton(UPGRADE_NEXT, 'LANJUT', `ke malam ${state.night + 1}`);
    text('Beli secukupnya — 1-2 upgrade per jeda lebih baik daripada semuanya.',
      60, 640, 16, PALETTE.muted, 'left');
  }

  function drawOver(state, best) {
    context.fillStyle = 'rgba(10,4,8,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    glowText('DESA JATUH', FIELD.width / 2, 170, 84, '#ef4444', '#7f1d1d');
    text('Pura padam. Bayang laut menelan desa.', FIELD.width / 2, 214, 22, PALETTE.text);
    drawPanel(FIELD.width / 2 - 260, 260, 520, 160);
    drawStats(state, FIELD.width / 2 - 210, 306);
    if (best > 0) text(`Malam terjauh: ${best} / 7`, FIELD.width / 2, 452, 20, PALETTE.text, 'center', '700');
    drawButton(OVER_RETRY, 'COBA LAGI');
  }

  function drawWin(state, best) {
    // Dawn breaks over the sea: warm gold light replaces the night.
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, 'rgba(251,191,36,0.25)');
    gradient.addColorStop(0.5, 'rgba(251,191,36,0.08)');
    gradient.addColorStop(1, 'rgba(4,10,20,0.1)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    glowText('DESA SELAMAT', FIELD.width / 2, 150, 84, PALETTE.templeGold, '#f59e0b');
    text('Ratu Kidul tumbang. Fajar naik atas desa nelayan.', FIELD.width / 2, 196, 22, PALETTE.text);
    drawPanel(FIELD.width / 2 - 260, 240, 520, 160);
    drawStats(state, FIELD.width / 2 - 210, 286);
    if (best > 0) text(`Malam terjauh: ${best} / 7`, FIELD.width / 2, 432, 20, PALETTE.text, 'center', '700');
    drawButton(WIN_AGAIN, 'MAIN LAGI');
  }

  function drawPaused() {
    context.fillStyle = 'rgba(4,10,20,0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    glowText('JEDA', FIELD.width / 2, 330, 72, PALETTE.text, '#3b82f6');
    text('Tekan P atau klik untuk lanjut  •  R: mulai dari awal', FIELD.width / 2, 380, 20, PALETTE.muted);
  }

  function drawWorld(state, screen) {
    const shakeX = state.shake > 0 ? shakeNoise(state.time, 1) * state.shake * 22 : 0;
    const shakeY = state.shake > 0 ? shakeNoise(state.time, 2) * state.shake * 22 : 0;
    context.save();
    context.translate(shakeX, shakeY);
    drawSky(state);
    drawSea(state);
    drawVillage(state);
    drawIsland(state);
    drawLanternSlots(state, screen === SCREEN_UPGRADE);
    drawTemple(state);
    drawLanterns(state);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) drawBeam(state);
    for (const enemy of state.enemies) drawEnemy(enemy, state);
    drawBoss(state.boss, state);
    drawParticles(state);
    context.restore();
  }

  function draw(state, screen, best) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state);
      if (screen === SCREEN_PAUSED) drawPaused();
    } else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  /** Canvas buttons for the current screen, in field coordinates. The game
   *  hit-tests these on a click; the upgrade web nodes and beach slots are
   *  buttons too. */
  function buttonsFor(screen, state) {
    if (screen === SCREEN_TITLE) return [{ ...TITLE_START }];
    if (screen === SCREEN_PLAY) {
      return [...HUD.colors, { ...HUD.pause }];
    }
    if (screen === SCREEN_UPGRADE) {
      const buttons = [{ ...UPGRADE_NEXT }];
      const families = ['api', 'lebar', 'lampion', 'tempo'];
      families.forEach((family, col) => {
        for (let tier = 1; tier <= 3; tier += 1) {
          buttons.push({
            id: `upgrade:${family}:${tier}`,
            x: WEB.columns[col] - WEB.radius,
            y: WEB.rows[tier - 1] - WEB.radius,
            w: WEB.radius * 2,
            h: WEB.radius * 2,
          });
        }
      });
      UPGRADE_SLOTS.forEach((slot, i) => {
        buttons.push({ id: `lantern:${i}`, x: slot.x - slot.r, y: slot.y - slot.r, w: slot.r * 2, h: slot.r * 2 });
      });
      return buttons;
    }
    if (screen === SCREEN_OVER) return [{ ...OVER_RETRY }];
    if (screen === SCREEN_WIN) return [{ ...WIN_AGAIN }];
    return [];
  }

  return { draw, buttonsFor, view };
}
