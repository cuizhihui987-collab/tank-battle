import { DIR, DX, DY, W, H } from './constants.js';
import { G } from './state.js';
import { spawnParticles } from './particles.js';

export class Bullet {
  constructor(x, y, dir, isPlayer, owner) {
    this.x = x; this.y = y;
    this.w = 6; this.h = 6;
    this.dir = dir;
    this.speed = isPlayer ? 5 : 3.5;
    this.alive = true;
    this.isPlayer = isPlayer;
    this.owner = owner;
    this.trail = [];
    this.damage = isPlayer ? 1 : 1;
    this.bounceCount = isPlayer ? 1 : 0;
    this.isPowerShot = false;
    this.color = null;
  }

  setDamage(dmg) {
    this.damage = dmg;
  }

  draw() {
    if (!this.alive) return;
    const ctx = G.ctx;

    for (let i = 0; i < this.trail.length; i++) {
      ctx.fillStyle = `rgba(255, 255, 200, ${0.15 * (1 - i / this.trail.length)})`;
      ctx.beginPath();
      ctx.arc(this.trail[i].x + 3, this.trail[i].y + 3, 3 - i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const bulletColor = this.isPowerShot ? '#e74c3c' : (this.color || (this.isPlayer ? '#ffeb3b' : '#ff6b6b'));
    ctx.fillStyle = bulletColor;
    ctx.shadowColor = this.isPowerShot ? '#ff4444' : (this.isPlayer ? '#ffeb3b' : '#ff6b6b');
    ctx.shadowBlur = this.isPowerShot ? 16 : 8;
    ctx.beginPath();
    ctx.arc(this.x + 3, this.y + 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x + 3, this.y + 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  update() {
    if (!this.alive) return;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x += DX[this.dir] * this.speed;
    this.y += DY[this.dir] * this.speed;

    if (this.isPlayer && this.bounceCount > 0) {
      if (this.x < 0 || this.x + this.w > W) {
        if (this.x < 0) this.x = 0;
        if (this.x + this.w > W) this.x = W - this.w;
        if (this.dir === DIR.LEFT) this.dir = DIR.RIGHT;
        else if (this.dir === DIR.RIGHT) this.dir = DIR.LEFT;
        this.bounceCount--;
        return;
      }
      if (this.y < 0 || this.y + this.h > H) {
        if (this.y < 0) this.y = 0;
        if (this.y + this.h > H) this.y = H - this.h;
        if (this.dir === DIR.UP) this.dir = DIR.DOWN;
        else if (this.dir === DIR.DOWN) this.dir = DIR.UP;
        this.bounceCount--;
        return;
      }
    }

    if (this.x < -10 || this.x > W + 10 || this.y < -10 || this.y > H + 10) {
      this.alive = false;
      return;
    }

    for (let w of G.walls) {
      if (!w.alive) continue;
      if (this.x < w.x + w.w && this.x + this.w > w.x && this.y < w.y + w.h && this.y + this.h > w.y) {
        this.alive = false;
        w.takeDamage(this.damage);
        spawnParticles(this.x + 3, this.y + 3, '#aaa', 5);
        return;
      }
    }

    let targets = this.isPlayer ? G.enemies : (G.player && G.player.alive ? [G.player] : []);
    for (let t of targets) {
      if (!t.alive) continue;
      if (this.x < t.x + t.w && this.x + this.w > t.x && this.y < t.y + t.h && this.y + this.h > t.y) {
        this.alive = false;
        t.takeDamage(this.damage);
        return;
      }
    }

    for (let b of G.bullets) {
      if (b === this || !b.alive || b.isPlayer === this.isPlayer) continue;
      if (Math.abs(this.x - b.x) < 8 && Math.abs(this.y - b.y) < 8) {
        this.alive = false;
        b.alive = false;
        spawnParticles(this.x + 3, this.y + 3, '#fff', 8);
      }
    }
  }
}
