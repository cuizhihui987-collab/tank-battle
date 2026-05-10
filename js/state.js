export const G = {
  canvas: null,
  ctx: null,
  scoreEl: null,
  enemiesEl: null,
  livesEl: null,

  game: { score: 0, lives: 3, level: 1, paused: false, over: false, won: false },
  player: null,
  enemies: [],
  bullets: [],
  walls: [],
  explosions: [],
  particles: [],
  spawnTimer: 0,
  enemyCount: 0,
  spawnInterval: 180,
  screenShakeTimer: 0,

  keys: {}
};
