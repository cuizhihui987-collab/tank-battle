import { W, H, TILE, COLS, ROWS, DIR } from './constants.js';
import { G } from './state.js';
import { Tank } from './tank.js';
import { Bullet } from './bullet.js';
import { Wall } from './wall.js';
import { drawParticles, drawExplosions, spawnParticles } from './particles.js';

// Object pools
let player1Tank = null;
let player2Tank = null;
const enemyTanks = [];
const bulletPool = [];
let wallList = [];
let lastWallJson = '';
let lastExplosionCount = 0;
let localParticles = [];

export function resetPeerRenderer() {
  wallList = [];
  lastWallJson = '';
  lastExplosionCount = 0;
  localParticles = [];
}

function syncWalls(wallsData) {
  if (JSON.stringify(wallsData) === lastWallJson) return;
  lastWallJson = JSON.stringify(wallsData);

  wallList = wallsData.map(w => {
    const wall = new Wall(w.x, w.y, w.type);
    wall.hp = w.hp;
    wall.alive = w.alive;
    return wall;
  });
}

function updateObject(obj, data, fields) {
  for (const f of fields) {
    if (data[f] !== undefined) obj[f] = data[f];
  }
}

export function renderSnapshot(state) {
  const ctx = G.ctx;
  ctx.save();

  // Screen shake
  if (state.screenShakeTimer > 0) {
    const intensity = state.screenShakeTimer * 0.5;
    ctx.translate(
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity
    );
  }

  // Background
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * TILE, 0); ctx.lineTo(i * TILE, H); ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * TILE); ctx.lineTo(W, i * TILE); ctx.stroke();
  }

  // Walls
  if (state.walls) syncWalls(state.walls);
  for (const w of wallList) w.draw();

  // Bullets
  while (bulletPool.length < (state.bullets || []).length) {
    bulletPool.push(new Bullet(0, 0, 0, false, null));
  }
  if (bulletPool.length > (state.bullets || []).length) {
    bulletPool.length = state.bullets.length;
  }
  (state.bullets || []).forEach((bd, i) => {
    updateObject(bulletPool[i], bd, ['x', 'y', 'dir', 'alive', 'isPlayer', 'speed', 'bounceCount', 'trail']);
    bulletPool[i].draw();
  });

  // Enemies
  while (enemyTanks.length < (state.enemies || []).length) {
    enemyTanks.push(new Tank(0, 0, '#e74c3c', false));
  }
  if (enemyTanks.length > (state.enemies || []).length) {
    enemyTanks.length = state.enemies.length;
  }
  (state.enemies || []).forEach((ed, i) => {
    updateObject(enemyTanks[i], ed, ['x', 'y', 'dir', 'alive', 'hp', 'flash', 'shieldTimer', 'color', 'speed']);
    enemyTanks[i].w = TILE - 2;
    enemyTanks[i].h = TILE - 2;
    enemyTanks[i].draw();
  });

  // Player 2
  if (state.player2) {
    if (!player2Tank) player2Tank = new Tank(0, 0, state.player2.color || '#3498db', true);
    updateObject(player2Tank, state.player2, ['x', 'y', 'dir', 'alive', 'hp', 'flash', 'shieldTimer', 'color']);
    player2Tank.w = TILE - 2;
    player2Tank.h = TILE - 2;
    player2Tank.draw();
  }

  // Player 1
  if (state.player1) {
    if (!player1Tank) player1Tank = new Tank(0, 0, state.player1.color || '#2ecc71', true);
    updateObject(player1Tank, state.player1, ['x', 'y', 'dir', 'alive', 'hp', 'flash', 'shieldTimer', 'color']);
    player1Tank.w = TILE - 2;
    player1Tank.h = TILE - 2;
    player1Tank.draw();
  }

  // Explosions from state
  G.explosions = (state.explosions || []).map(e => ({ ...e }));
  drawExplosions();
  G.explosions = [];

  // Particles from state (simplified - just draw any explosion markers)
  // We generate local particles for new explosions to keep visual feel
  if (state.explosions && state.explosions.length > lastExplosionCount) {
    for (let i = lastExplosionCount; i < state.explosions.length; i++) {
      const e = state.explosions[i];
      if (e.timer < 5) {
        spawnParticles(e.x, e.y, e.color, 10);
      }
    }
  }
  lastExplosionCount = state.explosions ? state.explosions.length : 0;

  // Update and draw local particles
  for (const p of G.particles) {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life--;
  }
  G.particles = G.particles.filter(p => p.life > 0);
  drawParticles();

  ctx.restore();

  // Game UI overlays
  if (state.game) {
    if (state.game.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('游戏结束', W / 2, H / 2 - 20);
      ctx.fillStyle = '#aaa';
      ctx.font = '20px Arial';
      ctx.fillText('得分: ' + state.game.score, W / 2, H / 2 + 40);
    }

    if (state.game.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2ecc71';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('第 ' + state.game.level + ' 关 通过!', W / 2, H / 2 - 10);
      ctx.fillStyle = '#aaa';
      ctx.font = '18px Arial';
      ctx.fillText('准备下一关...', W / 2, H / 2 + 40);
    }
  }

  // Score display for peer
  if (state.game) {
    G.scoreEl.textContent = state.game.score;
    G.livesEl.textContent = state.game.lives;
  }
  if (state.enemyCount !== undefined) {
    G.enemiesEl.textContent = (state.remainingEnemies !== undefined)
      ? state.remainingEnemies
      : 10 - state.enemyCount;
  }
}
