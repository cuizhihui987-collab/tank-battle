import { DIR, TILE, COLS, MAX_ENEMIES, TOTAL_ENEMIES_PER_LEVEL } from './constants.js';
import { G } from './state.js';
import { Tank } from './tank.js';

export function updateAI(enemy) {
  if (!enemy.alive) return;

  enemy.aiChangeTimer--;
  enemy.shootTimer--;

  if (enemy.aiChangeTimer <= 0) {
    if (G.player && G.player.alive) {
      let dx = G.player.cx - enemy.cx;
      let dy = G.player.cy - enemy.cy;
      if (Math.random() < 0.6) {
        if (Math.abs(dx) > Math.abs(dy)) {
          enemy.aiDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
        } else {
          enemy.aiDir = dy > 0 ? DIR.DOWN : DIR.UP;
        }
      } else {
        enemy.aiDir = Math.floor(Math.random() * 4);
      }
    } else {
      enemy.aiDir = Math.floor(Math.random() * 4);
    }
    enemy.aiChangeTimer = 30 + Math.floor(Math.random() * 60);
  }

  if (!enemy.move(enemy.aiDir)) {
    enemy.aiDir = Math.floor(Math.random() * 4);
    enemy.aiChangeTimer = 20;
  }

  if (enemy.shootTimer <= 0) {
    let canShoot = false;
    if (G.player && G.player.alive) {
      let dx = G.player.cx - enemy.cx;
      let dy = G.player.cy - enemy.cy;
      if (enemy.dir === DIR.UP && dy < 0 && Math.abs(dx) < 30) canShoot = true;
      if (enemy.dir === DIR.DOWN && dy > 0 && Math.abs(dx) < 30) canShoot = true;
      if (enemy.dir === DIR.LEFT && dx < 0 && Math.abs(dy) < 30) canShoot = true;
      if (enemy.dir === DIR.RIGHT && dx > 0 && Math.abs(dy) < 30) canShoot = true;
    }
    if (canShoot || Math.random() < 0.02) {
      let b = enemy.shoot();
      if (b) G.bullets.push(b);
      enemy.shootTimer = enemy.shootDelay;
    }
  }

  enemy.update();
}

export function spawnEnemy() {
  if (G.enemyCount >= TOTAL_ENEMIES_PER_LEVEL) return;
  if (G.enemies.filter(e => e.alive).length >= MAX_ENEMIES) return;

  const spawnPoints = [
    [TILE, TILE],
    [TILE * (COLS - 2), TILE],
    [TILE * Math.floor(COLS / 2 - 1), TILE]
  ];

  let sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

  for (let e of G.enemies) {
    if (!e.alive) continue;
    if (Math.abs(e.x - sp[0]) < TILE * 2 && Math.abs(e.y - sp[1]) < TILE * 2) return;
  }
  if (G.player && G.player.alive && Math.abs(G.player.x - sp[0]) < TILE * 2 && Math.abs(G.player.y - sp[1]) < TILE * 2) return;

  let hp = 1;
  let speed = 1.2;
  let color = '#e74c3c';
  let enemyLevel = 1;

  let r = Math.random();
  if (G.game.level >= 3 && r < 0.2) { hp = 3; color = '#8e44ad'; enemyLevel = 3; }
  else if (G.game.level >= 2 && r < 0.4) { hp = 2; color = '#e67e22'; enemyLevel = 2; }

  let enemy = new Tank(sp[0], sp[1], color, false);
  enemy.hp = hp;
  enemy.speed = speed;
  enemy.enemyLevel = enemyLevel;
  enemy.shieldTimer = 60;
  G.enemies.push(enemy);
  G.enemyCount++;
}

export function checkLevelComplete() {
  return G.enemyCount >= TOTAL_ENEMIES_PER_LEVEL && G.enemies.filter(e => e.alive).length === 0;
}
