import { W, H, TILE, COLS, ROWS, DIR, TOTAL_ENEMIES_PER_LEVEL } from './constants.js';
import { G } from './state.js';
import { Tank, setTankDeathCallback } from './tank.js';
import { generateLevel } from './level.js';
import { spawnEnemy, checkLevelComplete, updateAI } from './ai.js';
import {
  createExplosion, spawnParticles,
  updateParticles, updateExplosions,
  drawParticles, drawExplosions
} from './particles.js';
import { NetworkManager } from './network.js';
import { renderSnapshot, resetPeerRenderer } from './peerRenderer.js';
import {
  initPlayerRPG, addExp, getEffectiveAttack,
  updateBuffs, updatePickups, checkPickupCollision, useSkill,
  drawRpgHud, updateFloatingTexts, PickupItem
} from './rpg.js';

// --- Game mode ---
// 'single' | 'host' | 'peer'
let gameMode = 'single';
let network = null;
let peerKeys = { up: false, down: false, left: false, right: false, shoot: false };
let GAME_TICK = 0;
let latestPeerState = null;

// --- DOM Setup ---
G.canvas = document.getElementById('gameCanvas');
G.ctx = G.canvas.getContext('2d');
G.scoreEl = document.getElementById('score');
G.enemiesEl = document.getElementById('enemies');
G.livesEl = document.getElementById('lives');

// --- Tank Death Callback ---
setTankDeathCallback((tank) => {
  if (tank.isPlayer) {
    G.game.lives--;
    updateUI();
    if (G.game.lives <= 0) {
      gameOver();
    } else if (tank.isPlayer2) {
      respawnPlayer2();
    } else {
      respawnPlayer();
    }
  } else {
    G.game.score += 100;
    addExp((tank.enemyLevel || 1) * 10);
    const drop = PickupItem.rollDrop(tank.cx, tank.cy, tank.enemyLevel || 1);
    if (drop) G.pickups.push(drop);
    spawnParticles(tank.cx, tank.cy, '#f39c12', 15);
    updateUI();
  }
});

// --- Player Spawning ---
function findSafeSpawn(avoidEnemies = true) {
  const spawns = [
    [TILE, TILE],
    [TILE * 18, TILE],
    [TILE * 9, TILE * 18],
    [TILE * 9, TILE]
  ];
  // Prefer the one furthest from the other player
  for (const s of spawns) {
    let safe = true;
    if (G.player && G.player.alive) {
      if (Math.abs(s[0] - G.player.x) < TILE * 3 && Math.abs(s[1] - G.player.y) < TILE * 3) {
        safe = false;
      }
    }
    if (!safe) continue;
    if (G.player2 && G.player2.alive) {
      if (Math.abs(s[0] - G.player2.x) < TILE * 3 && Math.abs(s[1] - G.player2.y) < TILE * 3) {
        safe = false;
      }
    }
    if (!safe) continue;
    if (avoidEnemies) {
      for (const e of G.enemies) {
        if (!e.alive) continue;
        if (Math.abs(s[0] - e.x) < TILE * 2 && Math.abs(s[1] - e.y) < TILE * 2) {
          safe = false;
          break;
        }
      }
    }
    if (safe) return s;
  }
  return spawns[0];
}

function respawnPlayer() {
  const [sx, sy] = findSafeSpawn();
  G.player = new Tank(sx, sy, '#2ecc71', true);
  G.player.shieldTimer = 120;
  if (G.playerRPG) G.playerRPG.hp = G.playerRPG.maxHp;
}

function respawnPlayer2() {
  // Use the spawn furthest from player 1
  const candidates = [[TILE, TILE], [TILE * 18, TILE], [TILE * 9, TILE * 18], [TILE * 9, TILE]];
  let best = candidates[0], bestDist = 0;
  for (const s of candidates) {
    let safe = true;
    if (G.player && G.player.alive) {
      const d = Math.abs(s[0] - G.player.x) + Math.abs(s[1] - G.player.y);
      if (d > bestDist) { bestDist = d; best = s; }
    }
    for (const e of G.enemies) {
      if (!e.alive) continue;
      if (Math.abs(s[0] - e.x) < TILE * 2 && Math.abs(s[1] - e.y) < TILE * 2) { safe = false; break; }
    }
    if (!safe) continue;
    if (G.player && G.player.alive) {
      const d = Math.abs(s[0] - G.player.x) + Math.abs(s[1] - G.player.y);
      if (d > bestDist) { bestDist = d; best = s; }
    }
    best = s;
    break;
  }
  G.player2 = new Tank(best[0], best[1], '#3498db', true);
  G.player2.isPlayer2 = true;
  G.player2.shieldTimer = 120;
}

// --- Level & Game State ---
function nextLevel() {
  G.game.level++;
  G.game.won = true;
  setTimeout(() => {
    G.game.won = false;
    G.enemyCount = 0;
    G.spawnTimer = 0;
    G.pickups = [];
    // Heal player on new level
    if (G.playerRPG) G.playerRPG.hp = G.playerRPG.maxHp;
    generateLevel(G.game.level);
    respawnPlayer();
    if (gameMode === 'host' && G.player2) {
      respawnPlayer2();
    }
  }, 2000);
}

function gameOver() {
  G.game.over = true;
  if (G.player) createExplosion(G.player.cx, G.player.cy, '#e74c3c');
}

function updateUI() {
  G.scoreEl.textContent = G.game.score;
  G.enemiesEl.textContent = TOTAL_ENEMIES_PER_LEVEL - G.enemyCount + G.enemies.filter(e => e.alive).length;
  G.livesEl.textContent = G.game.lives;
}

// --- Input ---
document.addEventListener('keydown', e => {
  G.keys[e.key.toLowerCase()] = true;
  G.keys[e.key] = true;
  if ((e.key === 'p' || e.key === 'P') && gameMode !== 'peer') G.game.paused = !G.game.paused;
  if (e.key === ' ') e.preventDefault();
  // RPG skills
  if (gameMode !== 'peer' && !G.game.paused && !G.game.over) {
    if (e.key === 'q' || e.key === 'Q') useSkill('shield');
    if (e.key === 'e' || e.key === 'E') useSkill('powerShot');
  }
});

document.addEventListener('keyup', e => {
  G.keys[e.key.toLowerCase()] = false;
  G.keys[e.key] = false;
});

// --- Network Message Handlers ---
function setupNetworkHandlers() {
  if (!network) return;

  network.onGameState = (state) => {
    latestPeerState = state;
    G.game = state.game;
    G.enemyCount = state.enemyCount;
  };

  network.onPlayerInput = (msg) => {
    if (msg.keys) {
      peerKeys = msg.keys;
    }
  };

  network.onPeerDisconnected = () => {
    showNetworkNotice('对方已断开连接');
    // Return to menu after a brief delay
    setTimeout(() => {
      if (gameMode !== 'single') {
        showMenuUI();
        showMenu('main');
      }
    }, 2000);
  };

  network.onError = (msg) => {
    showNetworkNotice('错误: ' + msg);
  };
}

// --- Host: Build and Send Game State ---
function buildGameState() {
  GAME_TICK++;
  return {
    tick: GAME_TICK,
    player1: {
      x: G.player ? G.player.x : 0, y: G.player ? G.player.y : 0,
      dir: G.player ? G.player.dir : 0, alive: G.player ? G.player.alive : false,
      hp: G.player ? G.player.hp : 1, flash: G.player ? G.player.flash : 0,
      shieldTimer: G.player ? G.player.shieldTimer : 0, color: '#2ecc71'
    },
    player2: G.player2 ? {
      x: G.player2.x, y: G.player2.y,
      dir: G.player2.dir, alive: G.player2.alive,
      hp: G.player2.hp, flash: G.player2.flash,
      shieldTimer: G.player2.shieldTimer, color: '#3498db'
    } : null,
    enemies: G.enemies.filter(e => e.alive).map(e => ({
      x: e.x, y: e.y, dir: e.dir, alive: e.alive,
      hp: e.hp, flash: e.flash, shieldTimer: e.shieldTimer,
      color: e.color, speed: e.speed
    })),
    bullets: G.bullets.filter(b => b.alive).map(b => ({
      x: b.x, y: b.y, dir: b.dir, alive: b.alive,
      isPlayer: b.isPlayer, speed: b.speed, bounceCount: b.bounceCount,
      trail: b.trail.slice(-3)
    })),
    walls: G.walls.filter(w => w.alive).map(w => ({
      x: w.x, y: w.y, type: w.type, alive: w.alive, hp: w.hp
    })),
    explosions: G.explosions.map(e => ({
      x: e.x, y: e.y, r: e.r, color: e.color, timer: e.timer, maxTimer: e.maxTimer
    })),
    game: { ...G.game, score: G.game.score, lives: G.game.lives, level: G.game.level },
    enemyCount: G.enemyCount,
    screenShakeTimer: G.screenShakeTimer,
    remainingEnemies: TOTAL_ENEMIES_PER_LEVEL - G.enemyCount + G.enemies.filter(e => e.alive).length
  };
}

// --- Update (single player & host) ---
function update() {
  if (G.game.over || G.game.paused || G.game.won) return;

  // Player 1
  if (G.player && G.player.alive) {
    // Apply weapon fire rate
    if (G.playerRPG && G.playerRPG.weapon) {
      G.player.cooldownMax = Math.max(5, 15 + (G.playerRPG.weapon.fireRate || 0));
    }

    if (G.keys['w'] || G.keys['arrowup']) G.player.move(DIR.UP);
    else if (G.keys['s'] || G.keys['arrowdown']) G.player.move(DIR.DOWN);
    else if (G.keys['a'] || G.keys['arrowleft']) G.player.move(DIR.LEFT);
    else if (G.keys['d'] || G.keys['arrowright']) G.player.move(DIR.RIGHT);

    if (G.keys[' '] || G.keys['Space']) {
      const b = G.player.shoot();
      if (b) {
        b.setDamage(getEffectiveAttack());
        G.bullets.push(b);
      }
    }
    G.player.update();
  }

  // Player 2 (host mode, controlled by peer)
  if (gameMode === 'host' && G.player2 && G.player2.alive) {
    if (peerKeys.up) G.player2.move(DIR.UP);
    else if (peerKeys.down) G.player2.move(DIR.DOWN);
    else if (peerKeys.left) G.player2.move(DIR.LEFT);
    else if (peerKeys.right) G.player2.move(DIR.RIGHT);
    if (peerKeys.shoot) {
      const b = G.player2.shoot();
      if (b) G.bullets.push(b);
    }
    G.player2.update();
  }

  // Enemy AI
  for (const e of G.enemies) {
    if (e.alive) updateAI(e);
  }

  // Bullets
  for (const b of G.bullets) {
    if (b.alive) b.update();
  }
  G.bullets = G.bullets.filter(b => b.alive);

  G.enemies = G.enemies.filter(e => e.alive);

  G.spawnTimer++;
  const spawnRate = Math.max(60, 180 - G.game.level * 15);
  if (G.spawnTimer >= spawnRate) {
    G.spawnTimer = 0;
    spawnEnemy();
  }

  updateParticles();
  updateExplosions();

  // RPG updates
  updateBuffs();
  updatePickups();
  checkPickupCollision();
  updateFloatingTexts();

  if (G.screenShakeTimer > 0) G.screenShakeTimer--;

  if (checkLevelComplete()) nextLevel();

  updateUI();

  // Send state to peer (host mode)
  if (gameMode === 'host' && network && network.connected) {
    network.sendGameState(buildGameState());
  }
}

// --- Draw (single player & host) ---
function draw() {
  const ctx = G.ctx;
  ctx.save();

  if (G.screenShakeTimer > 0) {
    const intensity = G.screenShakeTimer * 0.5;
    ctx.translate(
      (Math.random() - 0.5) * intensity,
      (Math.random() - 0.5) * intensity
    );
  }

  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath(); ctx.moveTo(i * TILE, 0); ctx.lineTo(i * TILE, H); ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * TILE); ctx.lineTo(W, i * TILE); ctx.stroke();
  }

  for (const w of G.walls) w.draw();
  // Pickups
  if (G.pickups) for (const p of G.pickups) p.draw();
  for (const b of G.bullets) b.draw();
  for (const e of G.enemies) e.draw();
  if (G.player) G.player.draw();
  if (gameMode === 'host' && G.player2) G.player2.draw();

  drawParticles();
  drawExplosions();

  // RPG HUD
  drawRpgHud();

  ctx.restore();

  if (G.game.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('暂停', W / 2, H / 2 - 20);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px Arial';
    ctx.fillText('按 P 继续', W / 2, H / 2 + 30);
  }

  if (G.game.over) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', W / 2, H / 2 - 20);
    ctx.fillStyle = '#aaa';
    ctx.font = '20px Arial';
    ctx.fillText('得分: ' + G.game.score, W / 2, H / 2 + 40);
  }

  if (G.game.won) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('第 ' + G.game.level + ' 关 通过!', W / 2, H / 2 - 10);
    ctx.fillStyle = '#aaa';
    ctx.font = '18px Arial';
    ctx.fillText('准备下一关...', W / 2, H / 2 + 40);
  }
}

function drawGameOverlay() {
  if (!G.game || !G.game.over) return;
  const ctx = G.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('游戏结束', W / 2, H / 2 - 20);
  ctx.fillStyle = '#aaa';
  ctx.font = '20px Arial';
  ctx.fillText('得分: ' + G.game.score, W / 2, H / 2 + 40);
}

// --- Game Loop ---
function gameLoop() {
  if (gameMode === 'peer') {
    if (network && network.connected) {
      network.sendPlayerInput({
        up: G.keys['arrowup'] || false,
        down: G.keys['arrowdown'] || false,
        left: G.keys['arrowleft'] || false,
        right: G.keys['arrowright'] || false,
        shoot: G.keys[' '] || G.keys['Space'] || false
      });
    }
    // Clear canvas each frame to avoid smearing
    if (latestPeerState) {
      G.ctx.clearRect(0, 0, W, H);
      renderSnapshot(latestPeerState);
    }
    if (G.game && G.game.over) {
      drawGameOverlay();
    }
  } else {
    update();
    draw();
  }
  requestAnimationFrame(gameLoop);
}

// --- Init ---
function initGame() {
  G.game = { score: 0, lives: 3, level: 1, paused: false, over: false, won: false };
  G.enemyCount = 0;
  G.spawnTimer = 0;
  G.player = null;
  G.player2 = null;
  G.enemies = [];
  G.bullets = [];
  G.explosions = [];
  G.particles = [];
  G.screenShakeTimer = 0;
  G.pickups = [];
  G.floatingTexts = [];
  GAME_TICK = 0;
  peerKeys = { up: false, down: false, left: false, right: false, shoot: false };
  initPlayerRPG();
  generateLevel(1);
  respawnPlayer();
  updateUI();
}

function initHostGame() {
  initGame();
  respawnPlayer2();
  gameMode = 'host';
}

function initPeerGame() {
  gameMode = 'peer';
  latestPeerState = null;
  G.game = { score: 0, lives: 3, level: 1, paused: false, over: false, won: false };
  G.explosions = [];
  G.particles = [];
  resetPeerRenderer();
  updateUI();
}

// --- Menu ---
function showMenu(menu) {
  const panels = ['mainMenu', 'multiMenu', 'hostWait', 'joinPanel'];
  for (const p of panels) {
    document.getElementById(p).style.display = 'none';
  }
  document.getElementById(menu).style.display = 'block';
}

function showNetworkNotice(msg) {
  const el = document.getElementById('networkNotice');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showGameUI() {
  document.getElementById('menuOverlay').style.display = 'none';
  document.getElementById('gameWrapper').style.display = 'block';
  if (gameMode === 'host' || gameMode === 'peer') {
    document.getElementById('netIndicator').style.display = 'flex';
  }
}

function showMenuUI() {
  document.getElementById('menuOverlay').style.display = 'flex';
  document.getElementById('gameWrapper').style.display = 'none';
  document.getElementById('netIndicator').style.display = 'none';
  if (network) {
    network.close();
    network = null;
  }
  gameMode = 'single';
  latestPeerState = null;
  peerKeys = { up: false, down: false, left: false, right: false, shoot: false };
  G.game.paused = false;
  G.playerRPG = null;
  G.pickups = [];
  G.floatingTexts = [];
}

document.getElementById('singleBtn').addEventListener('click', () => {
  showGameUI();
  initGame();
  gameMode = 'single';
});

document.getElementById('multiBtn').addEventListener('click', () => showMenu('multiMenu'));
document.getElementById('backBtn').addEventListener('click', () => showMenu('main'));
document.getElementById('cancelHostBtn').addEventListener('click', () => {
  if (network) network.close();
  showMenu('multiMenu');
});
document.getElementById('cancelJoinBtn').addEventListener('click', () => showMenu('multiMenu'));

document.getElementById('hostBtn').addEventListener('click', async () => {
  showMenu('hostWait');
  const noticeEl = document.getElementById('hostNotice');
  const codeDisplay = document.getElementById('roomCodeDisplay');
  codeDisplay.textContent = '----';
  noticeEl.textContent = '正在连接服务器...';

  network = new NetworkManager();
  setupNetworkHandlers();

  network.onRoomCreated = (code) => {
    codeDisplay.textContent = code;
    noticeEl.textContent = '等待队友加入...';
  };

  network.onPeerConnected = () => {
    showGameUI();
    initHostGame();
  };

  network.onError = (msg) => {
    noticeEl.textContent = '连接失败: ' + msg;
    setTimeout(() => showMenu('multiMenu'), 2000);
  };

  try {
    await network.connect('ws://localhost:8080');
    network.createRoom();
  } catch (e) {
    noticeEl.textContent = '无法连接服务器: ' + e.message;
    setTimeout(() => showMenu('multiMenu'), 2000);
  }
});

document.getElementById('joinBtn').addEventListener('click', () => showMenu('joinPanel'));

document.getElementById('submitJoinBtn').addEventListener('click', async () => {
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code.length < 3) {
    document.getElementById('joinNotice').textContent = '请输入房间码';
    return;
  }

  network = new NetworkManager();
  setupNetworkHandlers();

  document.getElementById('joinNotice').textContent = '正在连接...';

  network.onRoomJoined = () => {
    showGameUI();
    initPeerGame();
  };

  network.onError = (msg) => {
    document.getElementById('joinNotice').textContent = '错误: ' + msg;
  };

  try {
    await network.connect('ws://localhost:8080');
    network.joinRoom(code);
  } catch (e) {
    document.getElementById('joinNotice').textContent = '连接失败: ' + e.message;
  }
});

// Show overlay menu and hide game on load
showMenuUI();
showMenu('main');

// Restart button
document.getElementById('restartBtn').addEventListener('click', () => {
  if (gameMode === 'host') {
    initHostGame();
  } else if (gameMode === 'peer') {
    showNetworkNotice('加入者无法重新开始');
  } else {
    initGame();
  }
});

// Start the render loop
gameLoop();
