import { TILE } from './constants.js';
import { G } from './state.js';
import { spawnParticles } from './particles.js';

export class Wall {
  constructor(x, y, type = 'brick') {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
    this.type = type;
    this.alive = true;
    this.hp = type === 'brick' ? 2 : 999;
    this.maxHp = this.hp;
  }

  draw() {
    if (!this.alive) return;
    const ctx = G.ctx;

    if (this.type === 'brick') {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = '#922b21';
      ctx.lineWidth = 1;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.strokeRect(this.x + c * 15, this.y + r * 15, 15, 15);
        }
      }
      if (this.hp === 1) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x + 5, this.y + 5);
        ctx.lineTo(this.x + 20, this.y + 20);
        ctx.moveTo(this.x + 25, this.y + 10);
        ctx.lineTo(this.x + 10, this.y + 25);
        ctx.stroke();
      }
    } else {
      let grad = ctx.createLinearGradient(this.x, this.y, this.x + this.w, this.y + this.h);
      grad.addColorStop(0, '#7f8c8d');
      grad.addColorStop(0.5, '#95a5a6');
      grad.addColorStop(1, '#7f8c8d');
      ctx.fillStyle = grad;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = '#6c7a7a';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
      ctx.fillStyle = '#5d6d6e';
      [[4, 4], [this.w - 4, 4], [4, this.h - 4], [this.w - 4, this.h - 4]].forEach(([ox, oy]) => {
        ctx.beginPath();
        ctx.arc(this.x + ox, this.y + oy, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      spawnParticles(
        this.x + this.w / 2,
        this.y + this.h / 2,
        this.type === 'brick' ? '#c0392b' : '#95a5a6',
        10
      );
    }
  }
}
