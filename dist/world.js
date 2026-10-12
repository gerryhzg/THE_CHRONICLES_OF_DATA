/* Hand-drawn, code-native pixel scenery. All coordinates are logical tiles. */
const TILE = 24;
const W = 32;
const H = 22;
const key = (x, y) => `${x},${y}`;
const villageBlocked = new Set();
const forestBlocked = new Set();
const villagePaths = new Set();
const forestPaths = new Set();
const villageWater = new Set();
const forestWater = new Set();
const fill = (set, x, y, w, h) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set.add(key(xx, yy));
};
const edges = set => {
  fill(set, 0, 0, W, 1); fill(set, 0, H - 1, W, 1);
  fill(set, 0, 0, 1, H); fill(set, W - 1, 0, 1, H);
};
edges(villageBlocked);
edges(forestBlocked);
fill(villagePaths, 2, 14, 29, 3);
fill(villagePaths, 15, 5, 3, 15);
fill(villagePaths, 10, 8, 18, 3);
fill(villagePaths, 11, 7, 3, 3);
fill(villagePaths, 26, 12, 3, 4);
fill(villagePaths, 5, 12, 3, 4);
fill(villageBlocked, 3, 10, 6, 4);
fill(villageBlocked, 18, 3, 6, 6);
fill(villageBlocked, 25, 10, 5, 4);
fill(villageBlocked, 11, 3, 3, 5);
fill(villageBlocked, 4, 3, 4, 5);
for (let y = 2; y <= 7; y++) {
  for (let x = 25; x <= 30; x++) {
    if ((y === 2 || y === 7) && (x === 25 || x === 30)) continue;
    villageWater.add(key(x, y)); villageBlocked.add(key(x, y));
  }
}
fill(forestPaths, 1, 10, 29, 3);
fill(forestPaths, 14, 3, 3, 17);
fill(forestPaths, 5, 7, 3, 5);
fill(forestPaths, 17, 4, 4, 2);
fill(forestPaths, 18, 6, 4, 5);
fill(forestPaths, 8, 12, 3, 6);
fill(forestPaths, 26, 11, 3, 8);
fill(forestPaths, 15, 14, 4, 3);
fill(forestBlocked, 3, 3, 6, 5);
for (let y = 0; y < H; y++) {
  const x0 = y < 6 || y > 13 ? 24 : 23;
  for (let x = x0; x < x0 + 3; x++) {
    forestWater.add(key(x, y));
    if (y < 10 || y > 12) forestBlocked.add(key(x, y));
  }
}

const villageTrees = [
  [1, 1], [10, 1], [15, 1], [23, 1], [30, 1], [1, 7], [30, 9],
  [1, 12], [1, 19], [11, 20], [19, 20], [22, 18], [29, 20], [30, 18],
];
const forestTrees = [
  [1, 1], [4, 1], [7, 1], [10, 1], [13, 1], [16, 1], [19, 1], [22, 1], [28, 1], [30, 2],
  [1, 4], [10, 4], [12, 4], [21, 3], [29, 5], [1, 7], [10, 7], [12, 8], [17, 7], [28, 8], [30, 9],
  [2, 14], [4, 14], [6, 16], [12, 15], [20, 14], [22, 16], [30, 15],
  [1, 18], [3, 20], [6, 20], [12, 20], [17, 20], [20, 20], [22, 19], [28, 20], [30, 19],
];
for (const [x, y] of villageTrees) villageBlocked.add(key(x, y));
for (const [x, y] of forestTrees) forestBlocked.add(key(x, y));

export const MAPS = {
  village: {
    name: 'Harvest Village', width: W, height: H, spawn: { x: 16, y: 15 },
    interactables: [
      { id: 'lab', name: "Lyra's Lab", x: 20, y: 9, type: 'starter', hitbox: { x: 18, y: 2, width: 6, height: 7 } },
      { id: 'kai', name: 'Kai', x: 17, y: 13, type: 'battle' },
      { id: 'sanctuary', name: 'Sanctuary', x: 27, y: 14, type: 'heal', hitbox: { x: 25, y: 9, width: 5, height: 5 } },
      { id: 'tower', name: 'Weather Tower', x: 12, y: 8, type: 'story', hitbox: { x: 10, y: 2, width: 5, height: 7 } },
      { id: 'gate', name: 'Twin Scholars’ Forest', x: 29, y: 15, type: 'travel', hitbox: { x: 28, y: 14, width: 3, height: 4 } },
      { id: 'home', name: 'Your Home', x: 6, y: 14, type: 'save', hitbox: { x: 3, y: 9, width: 6, height: 5 } },
      { id: 'sign', name: 'Village Noticeboard', x: 13, y: 16, type: 'help' },
    ],
    blocked: [...villageBlocked].map(v => { const [x, y] = v.split(',').map(Number); return { x, y }; }),
  },
  forest: {
    name: 'Twin Scholars’ Forest', width: W, height: H, spawn: { x: 3, y: 11 },
    interactables: [
      { id: 'inferra', name: 'Professor Inferra', x: 6, y: 8, type: 'investigation', hitbox: { x: 3, y: 2, width: 6, height: 6 } },
      { id: 'meadow', name: 'Sunlit Meadow', habitat: 'habitat_meadow', x: 9, y: 16, type: 'habitat', hitbox: { x: 8, y: 16, width: 3, height: 3 } },
      { id: 'riverbank', name: 'Riverbank', habitat: 'habitat_riverbank', x: 21, y: 7, type: 'habitat', hitbox: { x: 20, y: 5, width: 3, height: 3 } },
      { id: 'canopy', name: 'High Canopy', habitat: 'habitat_canopy', x: 18, y: 4, type: 'habitat', hitbox: { x: 17, y: 2, width: 3, height: 3 } },
      { id: 'camp', name: 'Observer Camp', x: 16, y: 15, type: 'time', hitbox: { x: 15, y: 14, width: 4, height: 4 } },
      { id: 'voltkit', name: 'Voltkit Glade', x: 28, y: 17, type: 'recruit', hitbox: { x: 27, y: 16, width: 4, height: 4 } },
      { id: 'exit', name: 'Harvest Village', x: 2, y: 11, type: 'travel' },
    ],
    blocked: [...forestBlocked].map(v => { const [x, y] = v.split(',').map(Number); return { x, y }; }),
  },
};

export function isWalkable(mapId, x, y) {
  const blocked = mapId === 'forest' ? forestBlocked : villageBlocked;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < W && y < H && !blocked.has(key(x, y));
}

const hash = (x, y, n = 0) => {
  let v = Math.imul(x + 397, 374761393) ^ Math.imul(y + 913, 668265263) ^ Math.imul(n + 7, 1274126177);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
};
const rect = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
const poly = (ctx, color, points) => {
  ctx.fillStyle = color; ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
};
const ellipse = (ctx, color, x, y, rx, ry) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };

function grass(ctx, forest) {
  rect(ctx, forest ? '#69894e' : '#809b55', 0, 0, W * TILE, H * TILE);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tone = hash(x, y);
    rect(ctx, forest ? (tone > .6 ? '#6c8e50' : '#64864b') : (tone > .6 ? '#86a05a' : '#7c9851'), x * TILE, y * TILE, TILE, TILE);
    for (let i = 0; i < 4; i++) {
      const gx = x * TILE + 3 + Math.floor(hash(x, y, i * 3) * 17);
      const gy = y * TILE + 3 + Math.floor(hash(x, y, i * 3 + 1) * 17);
      rect(ctx, forest ? '#91aa63' : '#a4b869', gx, gy, 2, 2);
      if (i === 1) rect(ctx, forest ? '#577444' : '#6e8849', gx + 2, gy - 2, 2, 3);
    }
  }
}

function paths(ctx, set, forest) {
  for (const tile of set) {
    const [x, y] = tile.split(',').map(Number);
    const px = x * TILE, py = y * TILE;
    rect(ctx, forest ? '#afa275' : '#c4b17a', px, py, TILE, TILE);
    if (!set.has(key(x, y - 1))) rect(ctx, forest ? '#889064' : '#a3a064', px, py, TILE, 3);
    if (!set.has(key(x - 1, y))) rect(ctx, forest ? '#8d9565' : '#a2a16a', px, py, 3, TILE);
    if (!set.has(key(x, y + 1))) rect(ctx, '#8d8a58', px, py + 21, TILE, 3);
    for (let i = 0; i < 3; i++) {
      const xx = px + 3 + Math.floor(hash(x, y, i + 28) * 18);
      const yy = py + 4 + Math.floor(hash(x, y, i + 39) * 16);
      rect(ctx, i === 0 ? '#d4c490' : '#b2a370', xx, yy, 2 + (i % 2) * 2, 2);
    }
  }
}

function water(ctx, set, t, night) {
  for (const tile of set) {
    const [x, y] = tile.split(',').map(Number);
    const px = x * TILE, py = y * TILE;
    rect(ctx, night ? '#45778c' : '#619f9a', px, py, TILE, TILE);
    if (!set.has(key(x - 1, y))) rect(ctx, '#476f63', px, py, 4, TILE);
    if (!set.has(key(x + 1, y))) rect(ctx, '#3e7068', px + 20, py, 4, TILE);
    if (!set.has(key(x, y - 1))) rect(ctx, '#94b395', px, py, TILE, 3);
    if (!set.has(key(x, y + 1))) rect(ctx, '#387872', px, py + 21, TILE, 3);
    const wave = Math.floor(t / 800 + hash(x, y) * 4) % 3;
    rect(ctx, '#a2c4b4', px + 4 + wave * 2, py + 8, 8, 2);
    rect(ctx, '#74aaa1', px + 12 - wave, py + 16, 7, 2);
  }
}

function flowers(ctx, x, y, color = '#f0db9b') {
  rect(ctx, '#4d7244', x, y + 2, 2, 6);
  rect(ctx, color, x - 2, y, 6, 2); rect(ctx, color, x, y - 2, 2, 6);
  rect(ctx, '#dfaf62', x, y, 2, 2);
}

function wheat(ctx, x, y, w, h) {
  rect(ctx, '#a69448', x, y, w, h);
  rect(ctx, '#b9a05a', x + 2, y + 2, w - 4, h - 4);
  for (let yy = y + 8; yy < y + h - 3; yy += 11) for (let xx = x + 7; xx < x + w - 3; xx += 9) {
    const shift = hash(xx, yy) > .5 ? 1 : -1;
    rect(ctx, '#806c3f', xx, yy, 1, 8); rect(ctx, '#e7c367', xx + shift, yy - 4, 2, 10);
    rect(ctx, '#f2d580', xx - 2, yy - 2, 6, 2); rect(ctx, '#d5ad50', xx - 3, yy + 2, 7, 2);
  }
  for (let xx = x; xx < x + w; xx += 24) { rect(ctx, '#71573b', xx, y + h - 3, 3, 9); rect(ctx, '#bc9363', xx, y + h - 4, 3, 3); }
  rect(ctx, '#ab8255', x, y + h + 1, w, 2);
}

function tree(ctx, tx, ty, variant = 0, forest = false) {
  const x = tx * TILE + 12, y = ty * TILE + 17;
  ellipse(ctx, 'rgba(37,56,40,.25)', x + 3, y + 5, 25, 9);
  rect(ctx, '#5c5139', x - 5, y - 16, 10, 19); rect(ctx, '#8c7750', x - 3, y - 14, 4, 17);
  const dark = forest ? '#365944' : '#49633e';
  const mid = forest ? '#426e4b' : '#5d8045';
  const light = forest ? '#5c8a52' : '#769a4e';
  poly(ctx, dark, [[x - 24, y - 17], [x - 27, y - 34], [x - 16, y - 49], [x - 7, y - 53], [x + 9, y - 54], [x + 22, y - 44], [x + 28, y - 29], [x + 22, y - 12], [x + 5, y - 9], [x - 12, y - 11]]);
  poly(ctx, mid, [[x - 22, y - 31], [x - 18, y - 44], [x - 7, y - 51], [x + 10, y - 50], [x + 20, y - 42], [x + 24, y - 28], [x + 12, y - 20], [x - 7, y - 22]]);
  poly(ctx, light, [[x - 17, y - 40], [x - 7, y - 49], [x + 7, y - 47], [x + 15, y - 41], [x + 8, y - 34], [x - 9, y - 34]]);
  rect(ctx, forest ? '#789a59' : '#93ab63', x - 8, y - 45, 8, 3);
  rect(ctx, mid, x - 17, y - 20, 8, 5); rect(ctx, dark, x + 10, y - 27, 10, 4);
  if (variant % 3 === 0 && !forest) {
    rect(ctx, '#c8754b', x - 15, y - 29, 4, 4); rect(ctx, '#cc8553', x + 9, y - 36, 4, 4);
  }
}

function building(ctx, tx, ty, tw, th, roof = '#ad604a', kind = 'home') {
  const x = tx * TILE, y = ty * TILE, w = tw * TILE, h = th * TILE;
  rect(ctx, 'rgba(46,56,35,.23)', x + 7, y + 13, w + 5, h);
  rect(ctx, '#6e6350', x, y + 26, w, h - 21);
  rect(ctx, kind === 'lab' ? '#b9bea0' : '#cfc1a0', x + 4, y + 28, w - 8, h - 27);
  rect(ctx, '#e1d5b1', x + 6, y + 28, w - 12, 6);
  for (let yy = y + 47; yy < y + h; yy += 16) rect(ctx, '#b8aa8c', x + 5, yy, w - 10, 1);
  rect(ctx, '#765c45', x + 7, y + 33, 4, h - 32); rect(ctx, '#765c45', x + w - 11, y + 33, 4, h - 32);
  poly(ctx, '#614c3d', [[x - 8, y + 35], [x + 12, y - 8], [x + w - 12, y - 8], [x + w + 8, y + 35]]);
  poly(ctx, roof, [[x - 5, y + 28], [x + 14, y - 5], [x + w - 14, y - 5], [x + w + 5, y + 28]]);
  for (let yy = y + 1; yy <= y + 22; yy += 7) {
    const inset = 11 - (yy - y) / 2;
    rect(ctx, 'rgba(242,190,139,.23)', x + Math.max(inset, 0), yy, w - Math.max(inset, 0) * 2, 2);
  }
  for (let xx = x + 20; xx < x + w - 12; xx += 19) rect(ctx, 'rgba(86,54,44,.20)', xx, y + 1, 2, 26);
  rect(ctx, '#e2c998', x + 7, y + 30, w - 14, 3);
  const doorX = kind === 'lab' ? x + 2 * TILE : x + Math.floor(tw / 2) * TILE;
  rect(ctx, '#7e6449', doorX - 1, y + h - 30, 26, 30);
  rect(ctx, '#425655', doorX + 3, y + h - 27, 18, 27);
  rect(ctx, '#8ba6a0', doorX + 5, y + h - 24, 14, 11);
  rect(ctx, '#d7b774', doorX + 17, y + h - 10, 2, 3);
  rect(ctx, '#b2ad8e', doorX - 5, y + h, 34, 5);
  const window = xx => {
    rect(ctx, '#75634b', xx, y + h - 49, 27, 26);
    rect(ctx, '#709698', xx + 3, y + h - 46, 21, 18);
    rect(ctx, '#b8d1b9', xx + 4, y + h - 45, 7, 7);
    rect(ctx, '#d5c292', xx + 12, y + h - 46, 3, 19);
    rect(ctx, '#d5c292', xx + 3, y + h - 38, 21, 3);
    rect(ctx, '#78634a', xx - 3, y + h - 24, 33, 4);
    if (kind !== 'lab') for (let i = 0; i < 5; i++) flowers(ctx, xx + 2 + i * 5, y + h - 25, ['#df9881', '#edcea0'][i % 2]);
  };
  window(x + 17); if (w > 120) window(x + w - 45);
  rect(ctx, '#785d49', x + w - 34, y - 15, 17, 23); rect(ctx, '#bd9c7c', x + w - 31, y - 12, 11, 20);
  rect(ctx, '#d4c29a', x + w - 36, y - 16, 21, 4);
  if (kind === 'lab') {
    rect(ctx, '#5d7570', x + 52, y + 39, 40, 21); rect(ctx, '#a9c7b7', x + 55, y + 42, 34, 14);
    rect(ctx, '#536b63', x + 65, y + 44, 3, 9); rect(ctx, '#536b63', x + 77, y + 44, 3, 9);
    poly(ctx, '#f0d593', [[x + 66, y + 48], [x + 72, y + 45], [x + 79, y + 51], [x + 73, y + 53]]);
  }
  if (kind === 'sanctuary') {
    rect(ctx, '#eee2b9', x + 49, y + 35, 23, 22); rect(ctx, '#638c7a', x + 58, y + 38, 5, 16); rect(ctx, '#638c7a', x + 53, y + 43, 15, 5);
  }
}

function windmill(ctx, t) {
  const x = 6 * TILE, y = 6 * TILE;
  ellipse(ctx, 'rgba(38,50,28,.24)', x, y + 40, 49, 14);
  poly(ctx, '#776b53', [[x - 26, y + 42], [x - 18, y - 38], [x + 18, y - 38], [x + 27, y + 42]]);
  poly(ctx, '#d6c8a7', [[x - 21, y + 40], [x - 14, y - 33], [x + 13, y - 33], [x + 21, y + 40]]);
  poly(ctx, '#91583e', [[x - 26, y - 36], [x, y - 59], [x + 26, y - 36]]);
  rect(ctx, '#765845', x - 8, y + 20, 16, 21); rect(ctx, '#778a7d', x - 6, y - 14, 12, 17);
  ctx.save(); ctx.translate(x, y - 26); ctx.rotate(Math.sin(t / 24000) * .16 + .65);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    rect(ctx, '#705d45', -3, -59, 6, 59); rect(ctx, '#e5d9b4', 2, -55, 15, 39);
    for (let j = 0; j < 5; j++) rect(ctx, '#ae9b71', 3, -51 + j * 7, 13, 2);
  }
  ctx.restore(); rect(ctx, '#63513e', x - 5, y - 31, 10, 10); rect(ctx, '#d7bb80', x - 2, y - 28, 4, 4);
}

function tower(ctx) {
  const x = 12 * TILE + 12, y = 7 * TILE;
  ellipse(ctx, 'rgba(44,48,33,.24)', x + 4, y + 20, 29, 10);
  rect(ctx, '#7e8979', x - 22, y - 54, 44, 75); rect(ctx, '#bcc1a4', x - 16, y - 54, 30, 75);
  for (let yy = y - 45; yy < y + 18; yy += 15) rect(ctx, '#959d8a', x - 18, yy, 38, 2);
  rect(ctx, '#687369', x - 27, y - 58, 54, 7); rect(ctx, '#d6ceae', x - 24, y - 58, 48, 3);
  rect(ctx, '#596d68', x - 10, y - 39, 20, 27); rect(ctx, '#a7c9bc', x - 7, y - 36, 14, 21);
  rect(ctx, '#6a857c', x - 5, y - 33, 10, 2); rect(ctx, '#6a857c', x - 5, y - 28, 6, 2);
  rect(ctx, '#81735a', x - 5, y - 95, 4, 37); rect(ctx, '#bfbd96', x - 18, y - 91, 31, 3);
  poly(ctx, '#d1ba68', [[x + 11, y - 99], [x + 24, y - 90], [x + 11, y - 84]]);
  rect(ctx, '#6c8d88', x + 9, y - 74, 10, 15); rect(ctx, '#b0d1c4', x + 11, y - 72, 6, 8);
}

function person(ctx, tx, ty, kind = 'player', facing = 'down', t = 0) {
  const x = tx * TILE + 12, y = ty * TILE + 18;
  const isPlayer = kind === 'player';
  const shirt = isPlayer ? '#456d75' : kind === 'kai' ? '#9b5650' : kind === 'inferra' ? '#dbcfb0' : '#bbbeaa';
  const pants = isPlayer ? '#384c55' : '#536154';
  ellipse(ctx, 'rgba(35,46,36,.28)', x, y + 1, 9, 4);
  rect(ctx, '#313d39', x - 6, y - 2, 4, 4); rect(ctx, '#313d39', x + 2, y - 2, 4, 4);
  rect(ctx, pants, x - 5, y - 9, 4, 8); rect(ctx, pants, x + 1, y - 9, 4, 8);
  rect(ctx, shirt, x - 7, y - 21, 14, 13);
  rect(ctx, isPlayer ? '#719897' : '#eee0b9', x - 5, y - 20, 3, 9);
  rect(ctx, '#ddaf83', x - 9, y - 17, 3, 7); rect(ctx, '#e9c094', x + 6, y - 17, 3, 7);
  rect(ctx, '#6a513e', x - 7, y - 34, 14, 13); rect(ctx, '#e5ba8d', x - 6, y - 31, 12, 11);
  if (facing === 'up') { rect(ctx, '#5b4938', x - 6, y - 31, 12, 10); }
  else {
    rect(ctx, '#34474a', x + (facing === 'left' ? -5 : -3), y - 27, 2, 2);
    if (facing !== 'left') rect(ctx, '#34474a', x + (facing === 'right' ? 5 : 3), y - 27, 2, 2);
    rect(ctx, '#ba855f', x - 1, y - 23, 3, 1);
  }
  if (isPlayer) {
    rect(ctx, '#c1905b', x - 8, y - 36, 16, 6); rect(ctx, '#e2bd77', x - 6, y - 40, 12, 6); rect(ctx, '#806746', x - 10, y - 32, 20, 3);
    rect(ctx, '#d8b571', x - 4, y - 15, 8, 3); rect(ctx, '#ae8058', x + (facing === 'up' ? -5 : -8), y - 20, 4, 11);
    if (facing !== 'up') { rect(ctx, '#dceac6', x + 7, y - 14, 4, 7); rect(ctx, '#779fa1', x + 8, y - 13, 2, 4); }
  } else if (kind === 'kai') {
    rect(ctx, '#463b3d', x - 7, y - 36, 14, 6); rect(ctx, '#463b3d', x - 9, y - 33, 6, 5); rect(ctx, '#e5b667', x - 2, y - 36, 7, 3);
    rect(ctx, '#d8bb74', x - 5, y - 21, 10, 3);
  } else {
    rect(ctx, kind === 'inferra' ? '#584d42' : '#acae92', x - 7, y - 36, 14, 7); rect(ctx, '#d2d8ca', x - 8, y - 30, 16, 2);
    rect(ctx, '#5c7070', x - 5, y - 29, 4, 4); rect(ctx, '#5c7070', x + 1, y - 29, 4, 4); rect(ctx, '#486567', x - 1, y - 28, 2, 1);
    rect(ctx, '#769795', x - 1, y - 20, 2, 10); rect(ctx, '#7c866e', x + 7, y - 16, 5, 7);
  }
}

function board(ctx, tx, ty, variant = 'sign') {
  const x = tx * TILE + 12, y = ty * TILE + 14;
  rect(ctx, '#68543a', x - 10, y - 5, 3, 14); rect(ctx, '#68543a', x + 7, y - 5, 3, 14);
  rect(ctx, '#725838', x - 15, y - 21, 30, 20); rect(ctx, '#c9b788', x - 12, y - 18, 24, 14);
  if (variant === 'exit') {
    poly(ctx, '#64694b', [[x - 7, y - 11], [x, y - 16], [x, y - 12], [x + 7, y - 12], [x + 7, y - 9], [x, y - 9], [x, y - 6]]);
  } else {
    rect(ctx, '#7b7a57', x - 8, y - 15, 13, 2); rect(ctx, '#7b7a57', x - 8, y - 10, 18, 2);
  }
}

function camp(ctx, t) {
  const x = 16 * TILE + 12, y = 15 * TILE + 16;
  poly(ctx, '#555f46', [[x + 32, y - 37], [x + 60, y - 4], [x + 3, y - 4]]);
  poly(ctx, '#bfac77', [[x + 32, y - 34], [x + 56, y - 7], [x + 7, y - 7]]);
  poly(ctx, '#706f51', [[x + 31, y - 25], [x + 42, y - 7], [x + 22, y - 7]]);
  rect(ctx, '#806847', x - 14, y - 6, 27, 5); rect(ctx, '#b69560', x - 10, y - 5, 20, 2);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    rect(ctx, '#727d69', x + Math.cos(a) * 14 - 3, y + Math.sin(a) * 6 - 4, 6, 5);
  }
  const f = Math.floor(t / 170) % 3;
  poly(ctx, '#d98142', [[x - 9, y - 4], [x - 6, y - 14], [x - 2, y - 10], [x + 2, y - 21 - f], [x + 6, y - 10], [x + 9, y - 3]]);
  poly(ctx, '#f5cc73', [[x - 4, y - 3], [x - 1, y - 12 - f], [x + 2, y - 7], [x + 5, y - 4]]);
}

function researchStation(ctx) {
  const x = 3 * TILE, y = 3 * TILE;
  building(ctx, 3, 3, 6, 5, '#64867c', 'lab');
  rect(ctx, '#64715d', x + 142, y + 75, 28, 6); rect(ctx, '#c7c29e', x + 143, y + 71, 27, 5);
  rect(ctx, '#b4ccb4', x + 153, y + 52, 8, 20); rect(ctx, '#677f76', x + 155, y + 47, 4, 6);
  rect(ctx, '#6d907e', x + 149, y + 61, 15, 2);
  rect(ctx, '#7d684c', x + 147, y + 81, 4, 20); rect(ctx, '#7d684c', x + 163, y + 81, 4, 20);
}

function bridge(ctx) {
  const x = 22 * TILE, y = 10 * TILE;
  rect(ctx, '#64533c', x, y + 3, 5 * TILE, 67);
  rect(ctx, '#ae9262', x, y + 6, 5 * TILE, 59);
  for (let xx = x + 2; xx < x + 5 * TILE; xx += 10) { rect(ctx, '#765f42', xx, y + 6, 2, 59); rect(ctx, '#c1a779', xx + 2, y + 8, 2, 54); }
  rect(ctx, '#574d3a', x - 3, y, 5 * TILE + 6, 5); rect(ctx, '#574d3a', x - 3, y + 65, 5 * TILE + 6, 5);
  rect(ctx, '#b19b71', x - 3, y, 5 * TILE + 6, 2); rect(ctx, '#b19b71', x - 3, y + 65, 5 * TILE + 6, 2);
  for (let xx = x - 3; xx <= x + 5 * TILE; xx += 24) {
    rect(ctx, '#6d5940', xx, y - 5, 5, 12); rect(ctx, '#bfa577', xx, y - 7, 5, 3);
    rect(ctx, '#6d5940', xx, y + 59, 5, 13); rect(ctx, '#bfa577', xx, y + 57, 5, 3);
  }
}

function label(ctx, value, x, y, { selected = false, small = false } = {}) {
  ctx.save(); ctx.font = `${selected ? '700' : '600'} ${small ? 9 : 10}px ui-monospace, Consolas, monospace`;
  const w = Math.ceil(ctx.measureText(value).width) + 14;
  const left = Math.max(5, Math.min(W * TILE - w - 5, x - w / 2));
  rect(ctx, selected ? '#dbc58e' : 'rgba(28,46,40,.78)', left, y, w, 19);
  rect(ctx, selected ? '#8c7958' : 'rgba(199,210,167,.32)', left, y, w, 1);
  ctx.fillStyle = selected ? '#2a3b36' : '#ecedd3'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, left + w / 2, y + 9.5); ctx.restore();
}

function beacon(ctx, x, y, t, selected) {
  const bob = selected ? Math.round(Math.sin(t / 350) * 2) : 0;
  poly(ctx, '#514d36', [[x, y - 9 + bob], [x + 6, y - 15 + bob], [x, y - 21 + bob], [x - 6, y - 15 + bob]]);
  poly(ctx, selected ? '#ffe4a0' : '#dfc386', [[x, y - 11 + bob], [x + 4, y - 15 + bob], [x, y - 19 + bob], [x - 4, y - 15 + bob]]);
  if (selected) {
    rect(ctx, '#8d6946', x - 1, y - 18 + bob, 2, 4); rect(ctx, '#8d6946', x - 1, y - 13 + bob, 2, 1);
  }
}

function halo(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(246,203,105,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function renderWorld(canvas, state, { selectedTarget, reduceMotion = false } = {}) {
  if (!canvas) return;
  if (canvas.width !== W * TILE) canvas.width = W * TILE;
  if (canvas.height !== H * TILE) canvas.height = H * TILE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const mapId = state.map === 'forest' ? 'forest' : 'village';
  const forest = mapId === 'forest', night = state.time === 'night';
  const t = reduceMotion ? 1200 : state.timestamp ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const selected = typeof selectedTarget === 'object' ? selectedTarget?.id : selectedTarget;
  const target = MAPS[mapId].interactables.find(v => v.id === selected);
  grass(ctx, forest); paths(ctx, forest ? forestPaths : villagePaths, forest);
  water(ctx, forest ? forestWater : villageWater, t, night);
  const things = [];
  const add = (y, draw) => things.push({ y, draw });

  if (!forest) {
    wheat(ctx, 24, 49, 64, 157); wheat(ctx, 24, 433, 205, 65);
    for (let i = 0; i < 23; i++) flowers(ctx, 440 + Math.floor(hash(i, 12) * 240), 432 + Math.floor(hash(i, 17) * 56), ['#ead3a0', '#cfa0a0', '#b5c48b'][i % 3]);
    for (let i = 0; i < 8; i++) {
      const x = 610 + i * 15;
      rect(ctx, '#497b59', x, 188, 2, 13); rect(ctx, '#648b5d', x + 2, 184, 2, 15);
    }
    add(8 * TILE, () => windmill(ctx, t));
    add(8 * TILE + 2, () => tower(ctx));
    add(9 * TILE, () => building(ctx, 18, 3, 6, 6, '#557b78', 'lab'));
    add(14 * TILE, () => building(ctx, 3, 10, 6, 4, '#b16d4d', 'home'));
    add(14 * TILE, () => building(ctx, 25, 10, 5, 4, '#aa7252', 'sanctuary'));
    add(9 * TILE + 18, () => person(ctx, 20, 9, 'lyra'));
    add(13 * TILE + 18, () => person(ctx, 17, 13, 'kai'));
    add(16 * TILE + 10, () => board(ctx, 13, 16));
    add(15 * TILE, () => {
      const x = 30 * TILE, y = 15 * TILE;
      rect(ctx, '#66513a', x - 7, y - 25, 7, 53); rect(ctx, '#b69b65', x - 8, y - 27, 9, 5);
      rect(ctx, '#66513a', x - 7, y + 50, 7, 21); rect(ctx, '#b69b65', x - 8, y + 48, 9, 5);
      poly(ctx, '#d2c090', [[x - 28, y - 21], [x + 10, y - 21], [x + 19, y - 13], [x + 10, y - 5], [x - 28, y - 5]]);
      rect(ctx, '#728269', x - 22, y - 15, 27, 3);
    });
    add(19 * TILE, () => { drawCreature(ctx, 'terradeer', { x: 500, y: 427, size: 37 }); });
  } else {
    ellipse(ctx, '#90a361', 225, 393, 88, 53);
    ellipse(ctx, '#9caf6b', 217, 385, 72, 43);
    for (let i = 0; i < 27; i++) flowers(ctx, 161 + Math.floor(hash(i, 8) * 137), 354 + Math.floor(hash(i, 9) * 70), ['#efd7a7', '#c9b0c4', '#dae2b0'][i % 3]);
    for (let i = 0; i < 13; i++) {
      const x = 502 + Math.floor(hash(i, 54) * 26), y = 100 + i * 8;
      rect(ctx, '#45724b', x, y, 2, 14); rect(ctx, '#a3ad67', x - 1, y - 3, 4, 7);
    }
    // A small ruined instrument hints at the wider chapter without blocking the route.
    rect(ctx, '#687765', 444, 194, 24, 13); rect(ctx, '#9aaa8f', 446, 189, 20, 11);
    rect(ctx, '#526b63', 451, 192, 9, 6); rect(ctx, '#c3c7a0', 455, 194, 3, 2);
    bridge(ctx);
    add(8 * TILE, () => researchStation(ctx));
    add(8 * TILE + 18, () => person(ctx, 6, 8, 'inferra'));
    add(15 * TILE + 15, () => camp(ctx, t));
    add(11 * TILE, () => board(ctx, 2, 11, 'exit'));
    add(16 * TILE, () => board(ctx, 9, 16));
    add(7 * TILE, () => board(ctx, 21, 7));
    add(4 * TILE, () => board(ctx, 18, 4));
    add(18 * TILE, () => drawCreature(ctx, 'voltkit', { x: 28 * TILE - 4, y: 17 * TILE - 18, size: 41, time: t }));
    add(17 * TILE, () => drawCreature(ctx, 'samplet', { x: 183, y: 390, size: 27 }));
    add(6 * TILE, () => drawCreature(ctx, 'bayowl', { x: 435, y: 103, size: 31 }));
  }
  (forest ? forestTrees : villageTrees).forEach(([x, y], i) => add(y * TILE + 22, () => tree(ctx, x, y, i, forest)));
  const player = state.player ?? MAPS[mapId].spawn;
  const px = player.renderX ?? player.x, py = player.renderY ?? player.y;
  add(py * TILE + 18, () => person(ctx, px, py, 'player', player.facing || 'down', t));
  things.sort((a, b) => a.y - b.y).forEach(v => v.draw());

  if (night) {
    rect(ctx, 'rgba(25,37,69,.42)', 0, 0, W * TILE, H * TILE);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    if (forest) {
      halo(ctx, 396, 372, 90, 'rgba(231,146,66,.20)'); halo(ctx, 178, 168, 60, 'rgba(232,194,111,.13)');
      halo(ctx, 683, 406, 53, 'rgba(211,208,111,.10)');
    } else {
      halo(ctx, 137, 302, 65, 'rgba(244,195,109,.16)'); halo(ctx, 658, 302, 58, 'rgba(244,195,109,.15)');
      halo(ctx, 482, 174, 70, 'rgba(137,205,193,.15)');
    }
    ctx.restore();
  } else {
    const g = ctx.createLinearGradient(0, 0, 768, 528);
    g.addColorStop(0, 'rgba(255,232,165,.09)'); g.addColorStop(1, 'rgba(41,66,48,.03)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 768, 528);
  }

  for (let i = 0; i < (forest ? 19 : 9); i++) {
    const x = (hash(i, 73) * 768 + Math.sin(t / 2200 + i) * 9);
    const y = (hash(i, 91) * 490 + Math.cos(t / 1900 + i * 2) * 5);
    const alpha = night ? .25 + Math.sin(t / 600 + i) * .18 : .18;
    rect(ctx, night ? `rgba(218,226,139,${alpha})` : 'rgba(252,237,193,.22)', x, y, 2, 2);
  }

  if (!forest) {
    label(ctx, "LYRA'S LAB", 505, 61, { selected: selected === 'lab' });
    label(ctx, 'HOME', 142, 239, { selected: selected === 'home', small: true });
    label(ctx, 'SANCTUARY', 659, 239, { selected: selected === 'sanctuary', small: true });
    label(ctx, 'WEATHER TOWER', 300, 189, { selected: selected === 'tower', small: true });
    label(ctx, 'FOREST →', 704, 415, { selected: selected === 'gate', small: true });
    beacon(ctx, 20 * TILE + 12, 9 * TILE - 16, t, selected === 'lab');
    beacon(ctx, 17 * TILE + 12, 13 * TILE - 16, t, selected === 'kai');
  } else {
    label(ctx, 'FIELD STATION', 146, 58, { selected: selected === 'inferra' });
    label(ctx, 'MEADOW', 228, 429, { selected: selected === 'meadow', small: true });
    label(ctx, 'RIVERBANK', 516, 120, { selected: selected === 'riverbank', small: true });
    label(ctx, 'CANOPY', 444, 61, { selected: selected === 'canopy', small: true });
    label(ctx, 'OBSERVER CAMP', 402, 414, { selected: selected === 'camp', small: true });
    label(ctx, 'VOLTKIT GLADE', 696, 455, { selected: selected === 'voltkit', small: true });
    label(ctx, '← VILLAGE', 63, 302, { selected: selected === 'exit', small: true });
    beacon(ctx, 6 * TILE + 12, 8 * TILE - 16, t, selected === 'inferra');
  }
  if (target) {
    const x = target.x * TILE + 12, y = target.y * TILE + 12;
    ctx.save(); ctx.strokeStyle = '#f6de9f'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.strokeRect(target.x * TILE + 2, target.y * TILE + 2, 20, 20); ctx.restore();
    if (!['lab', 'kai', 'inferra'].includes(target.id)) beacon(ctx, x, y - 12, t, true);
    if (target.id === 'kai') label(ctx, 'KAI', x, y - 70, { selected: true, small: true });
  }
  // Soft vignette makes the map read like a little illustrated diorama.
  const vignette = ctx.createRadialGradient(384, 264, 195, 384, 264, 470);
  vignette.addColorStop(0, 'rgba(25,42,32,0)'); vignette.addColorStop(1, 'rgba(25,42,32,.18)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, 768, 528);
}

/** Draw a creature in a top-left bounding box; accepts a canvas or a 2D context. */
export function drawCreature(canvasOrContext, speciesId, opts = {}) {
  const standalone = !!canvasOrContext?.getContext;
  let ctx = canvasOrContext;
  if (standalone) {
    const canvas = canvasOrContext;
    if (canvas.width === 300 && canvas.height === 150 && !opts.size) canvas.width = canvas.height = 96;
    if (opts.size && (!canvas.width || canvas.width === 300)) canvas.width = canvas.height = opts.size;
    ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (!ctx) return;
  const size = opts.size ?? (standalone ? Math.min(canvasOrContext.width, canvasOrContext.height) : 96);
  const x = opts.x ?? 0, y = opts.y ?? 0;
  const species = String(speciesId ?? 'statifox').toLowerCase().replace(/^creature[_-]?/, '').replace(/[^a-z]/g, '');
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(x, y); ctx.scale(size / 32, size / 32);
  if (opts.flip) { ctx.translate(32, 0); ctx.scale(-1, 1); }
  ellipse(ctx, 'rgba(35,49,47,.15)', 16, 29, 11, 2);
  const r = (c, xx, yy, w, h) => rect(ctx, c, xx, yy, w, h);
  const p = (c, points) => poly(ctx, c, points);
  if (species === 'algobear') {
    p('#214f55', [[6, 15], [4, 20], [5, 27], [9, 29], [24, 29], [28, 25], [27, 17], [23, 13]]);
    p('#477f7e', [[8, 14], [6, 21], [8, 27], [24, 27], [25, 19], [22, 14]]);
    r('#254f57', 5, 5, 6, 7); r('#254f57', 22, 5, 6, 7); r('#6daaa0', 6, 5, 4, 4); r('#6daaa0', 23, 5, 4, 4);
    p('#315e65', [[8, 8], [24, 8], [27, 11], [26, 18], [22, 21], [10, 21], [6, 17], [6, 11]]);
    p('#69a296', [[9, 7], [23, 7], [25, 10], [24, 16], [21, 18], [10, 18], [8, 14], [8, 10]]);
    r('#a8c7b2', 10, 8, 12, 3); r('#8fb6aa', 15, 10, 3, 4);
    r('#e3d2a0', 9, 14, 5, 4); r('#e3d2a0', 19, 14, 5, 4); r('#203942', 11, 14, 2, 3); r('#203942', 19, 14, 2, 3);
    r('#afc4aa', 12, 17, 9, 4); r('#26464d', 15, 17, 4, 2); r('#45676b', 16, 20, 2, 1);
    p('#91b7a6', [[12, 21], [20, 21], [23, 23], [21, 27], [11, 27], [9, 23]]);
    r('#548b82', 15, 22, 3, 4); r('#739c92', 12, 24, 8, 2);
    r('#214c55', 3, 20, 5, 7); r('#578c83', 4, 20, 4, 4); r('#214c55', 25, 20, 5, 7); r('#578c83', 25, 20, 4, 4);
    r('#e1c998', 5, 25, 2, 2); r('#e1c998', 26, 25, 2, 2); r('#244d51', 8, 27, 5, 3); r('#244d51', 20, 27, 5, 3);
  } else if (species === 'terradeer') {
    p('#506246', [[8, 10], [6, 7], [3, 6], [2, 2], [4, 2], [5, 5], [7, 5], [7, 1], [9, 1], [9, 8], [11, 10]]);
    p('#506246', [[20, 10], [22, 7], [25, 6], [26, 2], [24, 2], [23, 5], [21, 5], [21, 1], [19, 1], [19, 8], [17, 10]]);
    p('#6c9460', [[8, 20], [7, 25], [9, 27], [24, 27], [27, 23], [25, 19], [16, 17]]);
    p('#88ae6d', [[10, 19], [8, 23], [11, 25], [22, 25], [25, 22], [22, 19]]);
    r('#4c674a', 9, 25, 3, 5); r('#4c674a', 19, 25, 3, 5); r('#d0c893', 10, 25, 2, 3); r('#d0c893', 20, 25, 2, 3);
    p('#476d4f', [[7, 10], [3, 8], [4, 13], [8, 15], [10, 11]]); p('#5f8958', [[21, 10], [27, 8], [25, 13], [21, 15]]);
    p('#547e53', [[9, 9], [19, 9], [22, 13], [21, 21], [17, 24], [12, 22], [8, 18], [7, 13]]);
    p('#92b573', [[10, 10], [18, 10], [20, 14], [18, 20], [13, 21], [10, 18]]);
    p('#c5cea0', [[10, 18], [14, 17], [19, 18], [18, 21], [13, 22], [10, 20]]);
    r('#314e3f', 9, 15, 3, 3); r('#314e3f', 17, 15, 3, 3); r('#ecedd0', 10, 15, 1, 1); r('#ecedd0', 18, 15, 1, 1);
    r('#52734b', 14, 19, 3, 2); r('#c0cf8f', 13, 10, 3, 4);
    p('#a6bb79', [[14, 6], [18, 5], [17, 9], [14, 11], [12, 9]]); r('#e6d2a0', 13, 7, 3, 3);
    p('#6f995b', [[25, 20], [30, 17], [29, 22], [25, 24]]);
  } else if (species === 'samplet') {
    p('#675a84', [[7, 14], [5, 10], [5, 4], [8, 2], [11, 4], [11, 12], [18, 11], [19, 3], [22, 2], [25, 5], [24, 13], [26, 19], [24, 27], [20, 29], [10, 29], [5, 24], [4, 19]]);
    p('#a798c2', [[8, 14], [7, 7], [8, 4], [9, 7], [10, 16], [20, 14], [21, 5], [23, 5], [22, 15], [24, 20], [22, 26], [18, 28], [11, 27], [7, 24], [6, 19]]);
    r('#dbb8ca', 7, 5, 2, 7); r('#dbb8ca', 21, 6, 2, 7);
    p('#c5bbd5', [[9, 16], [14, 13], [20, 16], [22, 20], [21, 25], [14, 27], [9, 24], [7, 20]]);
    r('#403e64', 9, 18, 3, 3); r('#403e64', 19, 18, 3, 3); r('#eff0d9', 10, 18, 1, 1); r('#eff0d9', 20, 18, 1, 1);
    r('#bf92b5', 8, 22, 3, 2); r('#bf92b5', 20, 22, 3, 2); r('#755d7e', 14, 22, 3, 2);
    r('#9a8eb6', 6, 26, 5, 3); r('#9a8eb6', 20, 26, 5, 3);
    r('#e4d9b0', 1, 17, 3, 3); r('#e4d9b0', 27, 11, 3, 3); r('#88b5ab', 28, 22, 2, 2);
  } else if (species === 'bayowl') {
    p('#2e425f', [[6, 9], [5, 3], [13, 8], [19, 8], [26, 3], [25, 11], [28, 18], [26, 25], [20, 29], [11, 29], [5, 25], [3, 18]]);
    p('#496581', [[7, 11], [7, 6], [13, 10], [20, 10], [24, 6], [23, 12], [25, 18], [23, 26], [19, 28], [12, 27], [7, 23], [5, 17]]);
    p('#bdd1c2', [[8, 13], [12, 10], [16, 13], [20, 10], [24, 13], [22, 19], [18, 20], [16, 17], [13, 20], [8, 18]]);
    r('#e5cd8a', 8, 13, 6, 5); r('#e5cd8a', 18, 13, 6, 5); r('#2e425f', 11, 13, 2, 4); r('#2e425f', 19, 13, 2, 4);
    p('#d7a75b', [[14, 18], [18, 18], [16, 22]]);
    p('#859ba6', [[10, 21], [15, 23], [20, 21], [23, 23], [20, 27], [11, 27], [8, 24]]);
    r('#e6d199', 11, 23, 2, 2); r('#e6d199', 17, 25, 2, 2); r('#e6d199', 20, 22, 2, 2);
    p('#304d68', [[5, 16], [3, 22], [8, 26], [10, 23], [8, 17]]); p('#304d68', [[25, 16], [28, 22], [23, 26], [21, 23], [23, 17]]);
    r('#d3ae70', 10, 28, 5, 2); r('#d3ae70', 18, 28, 5, 2);
  } else {
    const volt = species === 'voltkit';
    const outline = volt ? '#8e683b' : '#91593e';
    const main = volt ? '#e1b755' : '#d78b4d';
    const bright = volt ? '#f2d177' : '#e8a564';
    const cream = volt ? '#f5e7ad' : '#efcf9c';
    if (volt) {
      p(outline, [[21, 23], [25, 17], [24, 13], [29, 9], [31, 14], [28, 18], [31, 22], [27, 27], [22, 27]]);
      p(bright, [[23, 23], [27, 18], [26, 14], [29, 12], [29, 15], [26, 18], [29, 22], [26, 25], [23, 25]]);
      r('#eff1bb', 28, 12, 2, 3);
    } else {
      p(outline, [[20, 24], [23, 18], [22, 11], [26, 8], [29, 13], [31, 18], [29, 24], [25, 28], [20, 27]]);
      p(main, [[22, 23], [25, 18], [24, 12], [27, 11], [29, 16], [29, 22], [25, 26], [22, 26]]);
      p(cream, [[24, 12], [26, 9], [29, 14], [30, 18], [27, 19], [26, 16]]);
      r(bright, 26, 21, 2, 4);
    }
    p(outline, [[8, 18], [19, 18], [23, 23], [23, 27], [18, 29], [8, 28], [5, 24]]);
    p(main, [[9, 19], [18, 19], [21, 24], [20, 27], [10, 27], [7, 24]]);
    r(outline, 7, 26, 5, 4); r(outline, 17, 26, 5, 4); r(cream, 8, 27, 4, 2); r(cream, 18, 27, 3, 2);
    p(outline, [[6, 12], [3, 2], [7, 3], [12, 9], [16, 9], [21, 2], [24, 2], [23, 13], [24, 19], [20, 23], [10, 23], [5, 19]]);
    p(main, [[7, 12], [5, 5], [8, 6], [12, 11], [17, 11], [21, 5], [22, 5], [21, 13], [22, 18], [19, 21], [10, 21], [7, 18]]);
    p(volt ? '#654e3d' : '#a75d49', [[5, 4], [7, 5], [10, 10], [7, 11]]);
    p(volt ? '#654e3d' : '#a75d49', [[22, 4], [21, 5], [18, 10], [21, 11]]);
    p(bright, [[10, 11], [18, 11], [20, 14], [18, 17], [11, 17], [8, 14]]);
    p(cream, [[7, 17], [12, 16], [15, 18], [19, 16], [22, 17], [19, 21], [10, 21]]);
    r('#354640', 9, 14, 3, 3); r('#354640', 18, 14, 3, 3); r('#fbefce', 10, 14, 1, 1); r('#fbefce', 19, 14, 1, 1);
    r('#5b5140', 13, 18, 4, 2); r('#92674b', 14, 20, 2, 1);
    p(cream, [[11, 22], [16, 22], [18, 24], [14, 27], [10, 24]]);
    if (volt) { r('#a27b42', 7, 19, 3, 2); r('#a27b42', 19, 19, 3, 2); p('#e5d386', [[2, 13], [4, 10], [3, 16], [5, 14], [3, 20], [4, 16], [1, 17]]); }
    else { r('#d37648', 13, 11, 3, 2); r('#d37648', 6, 20, 3, 2); }
  }
  ctx.restore();
}
