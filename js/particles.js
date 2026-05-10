import { G } from './state.js';

export function createExplosion(x, y, color) {
  G.explosions.push({ x, y, r: 5, maxR: 30 + Math.random() * 10, color, timer: 0, maxTimer: 25 });
  spawnParticles(x, y, color, 20);
  G.screenShakeTimer = 5;
}

export function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = 1 + Math.random() * 4;
    G.particles.push({
      x, y, color,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 30,
      maxLife: 30 + Math.random() * 30,
      size: 2 + Math.random() * 3
    });
  }
}

export function updateParticles() {
  for (let p of G.particles) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life--;
  }
  G.particles = G.particles.filter(p => p.life > 0);
}

export function updateExplosions() {
  for (let e of G.explosions) {
    e.timer++;
    e.r += (e.maxR - e.r) * 0.15;
  }
  G.explosions = G.explosions.filter(e => e.timer < e.maxTimer);
}

export function drawParticles() {
  const ctx = G.ctx;
  for (let p of G.particles) {
    let alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawExplosions() {
  const ctx = G.ctx;
  for (let e of G.explosions) {
    let alpha = 1 - e.timer / e.maxTimer;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
