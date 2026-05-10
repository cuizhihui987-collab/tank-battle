import { W, H, TILE } from './constants.js';
import { G } from './state.js';
import { spawnParticles } from './particles.js';

// --- Experience Table ---
export const EXP_TABLE = [0, 30, 80, 150, 250, 400, 600, 850, 1150, 1500, 2000];

export function getExpToNextLevel(level) {
  if (level >= EXP_TABLE.length)
    return EXP_TABLE[EXP_TABLE.length - 1] * 2;
  return EXP_TABLE[level];
}

export function getLevelBaseStats(level) {
  return {
    maxHp: 3 + Math.floor((level - 1) / 2),
    attack: 1 + Math.floor((level - 1) / 2),
    baseDefense: Math.floor((level - 1) / 3),
    speed: 2 + Math.floor((level - 1) / 5) * 0.2,
  };
}

// --- Item & Equipment Definitions ---
export const ITEMS = {
  HEALTH:   { name: '恢复', color: '#2ecc71', label: 'HP' },
  ATK_BOOST: { name: '攻击', color: '#e74c3c', label: 'ATK' },
  SPD_BOOST: { name: '速度', color: '#3498db', label: 'SPD' },
  SHIELD:   { name: '护盾', color: '#f1c40f', label: 'SHD' },
};

export const WEAPONS = [
  { name: '基础炮管', attack: 1, fireRate: 0 },
  { name: '速射炮',   attack: 1, fireRate: -5 },
  { name: '重型炮',   attack: 3, fireRate: 10 },
  { name: '狙击炮',   attack: 5, fireRate: 20 },
  { name: '散弹炮',   attack: 2, fireRate: 5 },
];

export const ARMORS = [
  { name: '布甲', defense: 0 },
  { name: '轻甲', defense: 1 },
  { name: '重甲', defense: 2 },
  { name: '板甲', defense: 3 },
];

// --- PickupItem ---
export class PickupItem {
  constructor(x, y, data) {
    this.x = x - TILE / 2 + 2;
    this.y = y - TILE / 2 + 2;
    this.w = TILE - 8;
    this.h = TILE - 8;
    this.alive = true;
    this.data = data;
    this.lifetime = 600;
    this.bob = 0;
  }

  draw() {
    if (!this.alive) return;
    const ctx = G.ctx;
    this.bob++;
    const bobY = Math.sin(this.bob * 0.06) * 2;

    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2 + bobY);

    ctx.shadowColor = this._color();
    ctx.shadowBlur = 12;
    ctx.fillStyle = this._color();
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._label(), 0, 0);
    ctx.restore();
  }

  _color() {
    if (this.data.type === 'weapon') return '#e74c3c';
    if (this.data.type === 'armor') return '#8e44ad';
    return this.data.data.color || '#f39c12';
  }

  _label() {
    if (this.data.type === 'weapon') return 'W';
    if (this.data.type === 'armor') return 'A';
    return this.data.data.label || '?';
  }

  static rollDrop(x, y, enemyLevel) {
    const r = Math.random();
    if (r < 0.35) return null;

    if (r < 0.55) return new PickupItem(x, y, { type: 'item', data: ITEMS.HEALTH });
    if (r < 0.65) return new PickupItem(x, y, { type: 'item', data: ITEMS.ATK_BOOST });
    if (r < 0.75) return new PickupItem(x, y, { type: 'item', data: ITEMS.SPD_BOOST });
    if (r < 0.80) return new PickupItem(x, y, { type: 'item', data: ITEMS.SHIELD });

    // Equipment (20 %)
    if (r < 0.90) {
      const idx = Math.min(Math.floor(Math.random() * WEAPONS.length), enemyLevel || 1);
      return new PickupItem(x, y, { type: 'weapon', data: WEAPONS[idx] });
    }
    const idx = Math.min(Math.floor(Math.random() * ARMORS.length), enemyLevel || 1);
    return new PickupItem(x, y, { type: 'armor', data: ARMORS[idx] });
  }
}

// --- Player RPG State Management ---
export function initPlayerRPG() {
  G.playerRPG = {
    level: 1,
    exp: 0,
    expToNext: getExpToNextLevel(1),
    hp: 3,
    maxHp: 3,
    weapon: { name: '基础炮管', attack: 1, fireRate: 0 },
    armor: { name: '布甲', defense: 0 },
    skills: {
      shield: { cooldown: 0, maxCd: 600, duration: 0 },
      powerShot: { cooldown: 0, maxCd: 480 },
    },
    buffs: [],
  };
  G.pickups = [];
}

export function addExp(amount) {
  const rpg = G.playerRPG;
  if (!rpg) return;
  rpg.exp += amount;

  while (rpg.exp >= rpg.expToNext && rpg.level < EXP_TABLE.length) {
    rpg.exp -= rpg.expToNext;
    rpg.level++;
    rpg.expToNext = getExpToNextLevel(rpg.level);

    const stats = getLevelBaseStats(rpg.level);
    const hpGain = stats.maxHp - rpg.maxHp;
    rpg.maxHp = stats.maxHp;
    rpg.hp = Math.min(rpg.hp + hpGain, rpg.maxHp);

    if (G.player) {
      spawnParticles(G.player.cx, G.player.cy, '#f1c40f', 25);
    }
    G.screenShakeTimer = 8;
    return true;
  }
  return false;
}

// --- Pickup application ---
function hpEffect() {
  const rpg = G.playerRPG;
  rpg.hp = Math.min(rpg.maxHp, rpg.hp + 2);
}

function applyBuff(type, duration, bonus) {
  const rpg = G.playerRPG;
  // Extend existing buff of same type
  const existing = rpg.buffs.find(b => b.type === type);
  if (existing) {
    existing.duration = Math.max(existing.duration, duration);
    return;
  }
  rpg.buffs.push({ type, duration, bonus });
}

export function applyPickup(pickup) {
  const rpg = G.playerRPG;
  if (!rpg) return;
  const ctx = G.ctx;
  const cx = pickup.x + pickup.w / 2;
  const cy = pickup.y + pickup.h / 2;

  if (pickup.data.type === 'item') {
    const item = pickup.data.data;
    if (item === ITEMS.HEALTH) hpEffect();
    else if (item === ITEMS.ATK_BOOST) applyBuff('attack', 600, 2);
    else if (item === ITEMS.SPD_BOOST) applyBuff('speed', 600, 0.5);
    else if (item === ITEMS.SHIELD) applyBuff('shield', 300, 0);

    spawnParticles(cx, cy, item.color, 12);
    // Floating text
    G.floatingTexts = G.floatingTexts || [];
    G.floatingTexts.push({ x: cx, y: cy, text: '+' + item.name, color: item.color, life: 40 });

  } else if (pickup.data.type === 'weapon') {
    rpg.weapon = pickup.data.data;
    spawnParticles(cx, cy, '#e74c3c', 12);
    G.floatingTexts = G.floatingTexts || [];
    G.floatingTexts.push({ x: cx, y: cy, text: '装备: ' + pickup.data.data.name, color: '#e74c3c', life: 50 });
  } else if (pickup.data.type === 'armor') {
    rpg.armor = pickup.data.data;
    spawnParticles(cx, cy, '#8e44ad', 12);
    G.floatingTexts = G.floatingTexts || [];
    G.floatingTexts.push({ x: cx, y: cy, text: '装备: ' + pickup.data.data.name, color: '#8e44ad', life: 50 });
  }

  pickup.alive = false;
}

// --- Buffs update ---
export function updateBuffs() {
  const rpg = G.playerRPG;
  if (!rpg) return;
  for (let i = rpg.buffs.length - 1; i >= 0; i--) {
    rpg.buffs[i].duration--;
    if (rpg.buffs[i].duration <= 0) rpg.buffs.splice(i, 1);
  }

  // Skills
  const sk = rpg.skills;
  if (sk.shield.cooldown > 0) sk.shield.cooldown--;
  if (sk.shield.duration > 0) {
    sk.shield.duration--;
    if (G.player) G.player.shieldTimer = 180;
  }
  if (sk.powerShot.cooldown > 0) sk.powerShot.cooldown--;

  // Shield from item buffs
  const hasShieldBuff = rpg.buffs.some(b => b.type === 'shield');
  if (hasShieldBuff && G.player) {
    G.player.shieldTimer = Math.max(G.player.shieldTimer, 3);
  }
}

// --- Skills ---
export function useSkill(name) {
  const rpg = G.playerRPG;
  if (!rpg || !G.player || !G.player.alive) return false;

  if (name === 'shield') {
    if (rpg.skills.shield.cooldown > 0) return false;
    rpg.skills.shield.cooldown = rpg.skills.shield.maxCd;
    rpg.skills.shield.duration = 180;
    G.player.shieldTimer = 180;
    spawnParticles(G.player.cx, G.player.cy, '#f1c40f', 20);
    return true;
  }

  if (name === 'powerShot') {
    if (rpg.skills.powerShot.cooldown > 0) return false;
    rpg.skills.powerShot.cooldown = rpg.skills.powerShot.maxCd;
    const b = G.player.shoot();
    if (b) {
      b.damage *= 3;
      b.speed *= 1.5;
      b.isPowerShot = true;
      b.color = '#e74c3c';
      G.bullets.push(b);
      spawnParticles(G.player.cx, G.player.cy, '#e74c3c', 15);
    }
    return true;
  }

  return false;
}

// --- Computed stats ---
export function getEffectiveAttack() {
  const rpg = G.playerRPG;
  if (!rpg) return 1;
  let atk = getLevelBaseStats(rpg.level).attack + rpg.weapon.attack;
  for (const b of rpg.buffs) {
    if (b.type === 'attack') atk += b.bonus;
  }
  return atk;
}

export function getEffectiveDefense() {
  const rpg = G.playerRPG;
  if (!rpg) return 0;
  let def = getLevelBaseStats(rpg.level).baseDefense + rpg.armor.defense;
  for (const b of rpg.buffs) {
    if (b.type === 'defense') def += b.bonus;
  }
  return def;
}

// --- Pickups lifetime & collision ---
export function updatePickups() {
  if (!G.pickups) return;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    G.pickups[i].lifetime--;
    if (G.pickups[i].lifetime <= 0) G.pickups.splice(i, 1);
  }
}

export function checkPickupCollision() {
  if (!G.player || !G.player.alive || !G.pickups) return;
  const p = G.player;
  for (const pi of G.pickups) {
    if (!pi.alive) continue;
    if (p.x < pi.x + pi.w && p.x + p.w > pi.x &&
        p.y < pi.y + pi.h && p.y + p.h > pi.y) {
      applyPickup(pi);
    }
  }
}

// --- Floating Text ---
export function updateFloatingTexts() {
  const ft = G.floatingTexts;
  if (!ft) return;
  for (let i = ft.length - 1; i >= 0; i--) {
    ft[i].y -= 1;
    ft[i].life--;
    if (ft[i].life <= 0) ft.splice(i, 1);
  }
}

function drawFloatingTexts() {
  const ft = G.floatingTexts;
  if (!ft) return;
  const ctx = G.ctx;
  for (const f of ft) {
    ctx.globalAlpha = f.life / 50;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// --- RPG HUD ---
export function drawRpgHud() {
  const rpg = G.playerRPG;
  if (!rpg) return;
  const ctx = G.ctx;

  // ---- HP bar (top-left) ----
  const hx = 5, hy = 5, hw = 155, hh = 13;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(hx, hy, hw, hh);
  const hpR = rpg.hp / rpg.maxHp;
  ctx.fillStyle = hpR > 0.5 ? '#2ecc71' : hpR > 0.25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(hx + 1, hy + 1, (hw - 2) * hpR, hh - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(hx, hy, hw, hh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HP ' + rpg.hp + '/' + rpg.maxHp, hx + hw / 2, hy + hh / 2);

  // ---- EXP bar ----
  const ey = hy + hh + 3;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(hx, ey, hw, 6);
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(hx + 1, ey + 1, (hw - 2) * (rpg.exp / rpg.expToNext), 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(hx, ey, hw, 6);

  // ---- Level ----
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Lv.' + rpg.level, hx + hw + 5, hy);

  // ---- Equipment (top-right) ----
  const rx = W - 5;
  ctx.textAlign = 'right';
  ctx.font = '10px Arial';
  ctx.fillStyle = '#e74c3c';
  ctx.fillText('ATK ' + getEffectiveAttack() + ' [' + rpg.weapon.name + ']', rx, 5);
  ctx.fillStyle = '#8e44ad';
  ctx.fillText('DEF ' + getEffectiveDefense() + ' [' + rpg.armor.name + ']', rx, 18);

  // ---- Buff indicators ----
  let bx = 5;
  for (const b of rpg.buffs) {
    const col = b.type === 'attack' ? '#e74c3c' : b.type === 'speed' ? '#3498db' : '#f1c40f';
    const secs = (b.duration / 60).toFixed(1);
    ctx.fillStyle = col;
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(b.type.toUpperCase() + ' ' + secs + 's', bx, 55);
    bx += 55;
  }

  // ---- Skill bar (bottom) ----
  const skillY = H - 28;
  drawSkillBox(8, skillY, 50, 20, 'Q', '护盾', rpg.skills.shield.cooldown, rpg.skills.shield.maxCd, '#f1c40f');
  drawSkillBox(64, skillY, 50, 20, 'E', '强击', rpg.skills.powerShot.cooldown, rpg.skills.powerShot.maxCd, '#e74c3c');

  // ---- Floating texts ----
  drawFloatingTexts();
}

function drawSkillBox(x, y, w, h, key, name, cd, maxCd, color) {
  const ctx = G.ctx;
  const ready = cd <= 0;
  ctx.fillStyle = ready ? color + '55' : 'rgba(50,50,50,0.7)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = ready ? color : '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Cooldown overlay
  if (!ready && maxCd > 0) {
    const pct = cd / maxCd;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y, w, h * pct);
    ctx.fillStyle = '#fff';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((cd / 60).toFixed(1) + 's', x + w / 2, y + h / 2);
  } else {
    ctx.fillStyle = color;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[' + key + ']', x + w / 2 - 1, y + h / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '8px Arial';
    ctx.fillText(name, x + w / 2, y + h / 2 + 10);
  }
}
