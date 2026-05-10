import { DIR, DX, DY, TILE, W, H } from './constants.js';
import { G } from './state.js';
import { createExplosion } from './particles.js';
import { Bullet } from './bullet.js';

let tankDeathCallback = null;

export function setTankDeathCallback(cb) {
  tankDeathCallback = cb;
}

export class Tank {
  constructor(x, y, color, isPlayer = false) {
    this.x = x; this.y = y;
    this.w = TILE - 2; this.h = TILE - 2;
    this.dir = DIR.UP;
    this.speed = isPlayer ? 2 : 1.2;
    this.color = color;
    this.isPlayer = isPlayer;
    this.alive = true;
    this.cooldown = 0;
    this.cooldownMax = isPlayer ? 15 : 40;
    this.moveTimer = 0;
    this.aiDir = DIR.UP;
    this.aiChangeTimer = 0;
    this.shootTimer = 0;
    this.shootDelay = isPlayer ? 0 : 30 + Math.random() * 40;
    this.hp = isPlayer ? 1 : 1;
    this.flash = 0;
    this.shieldTimer = isPlayer ? 120 : 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  draw() {
    if (!this.alive) return;
    const ctx = G.ctx;
    ctx.save();
    ctx.translate(this.cx, this.cy);

    if (this.shieldTimer > 0) {
      ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + 0.3 * Math.sin(this.shieldTimer * 0.2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.w * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    let angle = this.dir * Math.PI / 2;
    ctx.rotate(angle);

    const hw = this.w / 2, hh = this.h / 2;
    ctx.fillStyle = this.flash > 0 ? '#fff' : this.color;
    ctx.fillRect(-hw + 2, -hh + 2, this.w - 4, this.h - 4);

    ctx.fillStyle = this.flash > 0 ? '#ccc' : '#555';
    ctx.fillRect(-hw, -hh, 4, this.h);
    ctx.fillRect(hw - 4, -hh, 4, this.h);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = this.flash > 0 ? '#aaa' : '#444';
      ctx.fillRect(-hw + 1, -hh + 2 + i * 7, 2, 3);
      ctx.fillRect(hw - 3, -hh + 2 + i * 7, 2, 3);
    }

    ctx.fillStyle = this.flash > 0 ? '#ddd' : (this.isPlayer ? '#4a90d9' : '#c0392b');
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.flash > 0 ? '#eee' : '#333';
    ctx.fillRect(-2, -hh - 2, 4, hh - 6);

    ctx.restore();

    if (this.hp > 1) {
      ctx.fillStyle = '#333';
      ctx.fillRect(this.x, this.y - 6, this.w, 4);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(this.x, this.y - 6, this.w * (this.hp / 3), 4);
    }
  }

  canMove(nx, ny) {
    if (nx < 0 || ny < 0 || nx + this.w > W || ny + this.h > H) return false;
    for (let w of G.walls) {
      if (!w.alive) continue;
      if (nx < w.x + w.w && nx + this.w > w.x && ny < w.y + w.h && ny + this.h > w.y) return false;
    }
    if (!this.isPlayer) {
      for (let e of G.enemies) {
        if (e === this || !e.alive) continue;
        if (nx < e.x + e.w && nx + this.w > e.x && ny < e.y + e.h && ny + this.h > e.y) return false;
      }
    } else {
      for (let e of G.enemies) {
        if (!e.alive) continue;
        if (nx < e.x + e.w && nx + this.w > e.x && ny < e.y + e.h && ny + this.h > e.y) return false;
      }
    }
    return true;
  }

  move(dir) {
    this.dir = dir;
    let nx = this.x + DX[dir] * this.speed;
    let ny = this.y + DY[dir] * this.speed;

    if (this.canMove(nx, ny)) {
      this.x = nx; this.y = ny;
      return true;
    }
    if (DX[dir] !== 0 && this.canMove(nx, this.y)) {
      this.x = nx;
      return true;
    }
    if (DY[dir] !== 0 && this.canMove(this.x, ny)) {
      this.y = ny;
      return true;
    }
    return false;
  }

  shoot() {
    if (this.cooldown > 0) return null;
    this.cooldown = this.cooldownMax;
    let bx = this.cx + DX[this.dir] * (this.h / 2 + 2) - 3;
    let by = this.cy + DY[this.dir] * (this.h / 2 + 2) - 3;
    return new Bullet(bx, by, this.dir, this.isPlayer, this);
  }

  takeDamage(damage) {
    // Player uses RPG HP system
    if (this.isPlayer && G.playerRPG) {
      if (this.shieldTimer > 0) return;
      const def = G.playerRPG.armor.defense + Math.floor((G.playerRPG.level - 1) / 3);
      const actualDmg = Math.max(1, damage - def);
      G.playerRPG.hp -= actualDmg;
      this.flash = 8;
      if (G.playerRPG.hp <= 0) {
        this.alive = false;
        createExplosion(this.cx, this.cy, '#4a90d9');
        if (tankDeathCallback) tankDeathCallback(this);
      }
      return;
    }

    this.hp -= damage;
    this.flash = 8;
    if (this.hp <= 0) {
      this.alive = false;
      createExplosion(this.cx, this.cy, this.isPlayer ? '#4a90d9' : '#e74c3c');
      if (tankDeathCallback) tankDeathCallback(this);
    }
  }

  update() {
    if (this.cooldown > 0) this.cooldown--;
    if (this.flash > 0) this.flash--;
    if (this.shieldTimer > 0) this.shieldTimer--;
  }
}
