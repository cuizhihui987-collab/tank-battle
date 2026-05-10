import { TILE, COLS, ROWS } from './constants.js';
import { G } from './state.js';
import { Wall } from './wall.js';

export function generateLevel(level) {
  G.walls = [];
  G.enemies = [];
  G.bullets = [];
  G.explosions = [];
  G.particles = [];

  const layouts = [
    () => {
      addBrickRow(5, 5, 10);
      addBrickRow(5, 15, 10);
      addBrickRow(5, 5, 10, false);
      addSteelGrid(0);
    },
    () => {
      addBrickBox(3, 3, 4, 4);
      addBrickBox(13, 3, 4, 4);
      addBrickBox(3, 13, 4, 4);
      addBrickBox(13, 13, 4, 4);
      addSteelGrid(2);
    },
    () => {
      addBrickRow(0, 7, 20);
      addBrickRow(0, 13, 20);
      addBrickRow(7, 0, 6, false);
      addBrickRow(14, 0, 6, false);
      addSteelGrid(4);
    },
    () => {
      addBrickGrid();
      addSteelGrid(6);
    },
    () => {
      addBrickBox(5, 5, 10, 10);
      addSteelGrid(8);
      for (let i = 0; i < 6; i++) {
        addWall(3 + i, 3, 'steel');
        addWall(16 - i, 16, 'steel');
      }
    }
  ];

  let layoutIdx = Math.min(level - 1, layouts.length - 1);
  layouts[layoutIdx]();

  let extraCount = Math.min(level * 2, 15);
  for (let i = 0; i < extraCount; i++) {
    let x = Math.floor(Math.random() * 18) + 1;
    let y = Math.floor(Math.random() * 18) + 1;
    if (x < 3 && y < 3) continue;
    if (x > 16 && y < 3) continue;
    addWall(x, y, Math.random() > 0.2 ? 'brick' : 'steel');
  }

  function addWall(c, r, type = 'brick') {
    for (let w of G.walls) {
      if (w.x === c * TILE && w.y === r * TILE) return;
    }
    G.walls.push(new Wall(c * TILE, r * TILE, type));
  }

  function addBrickRow(c, r, count, horizontal = true) {
    for (let i = 0; i < count; i++) {
      let x = horizontal ? c + i : c;
      let y = horizontal ? r : r + i;
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) addWall(x, y, 'brick');
    }
  }

  function addBrickBox(c, r, w, h) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (c + i >= 0 && c + i < COLS && r + j >= 0 && r + j < ROWS) addWall(c + i, r + j, 'brick');
      }
    }
  }

  function addSteelGrid(count) {
    let positions = [
      [9, 9], [10, 9], [9, 10], [10, 10],
      [4, 4], [15, 4], [4, 15], [15, 15],
    ];
    for (let i = 0; i < Math.min(count, positions.length); i++) {
      let [c, r] = positions[i];
      addWall(c, r, 'steel');
    }
  }

  function addBrickGrid() {
    for (let c = 2; c < COLS - 2; c += 3) {
      for (let r = 2; r < ROWS - 2; r += 3) {
        if (Math.random() > 0.3) addWall(c, r, 'brick');
      }
    }
  }
}
