// City generation: a grid-based road network with buildings, parks, water, and spawn points.
import { WORLD, PALETTE } from './config.js';

const T_ROAD = 0;
const T_SIDEWALK = 1;
const T_BUILDING = 2;
const T_GRASS = 3;
const T_WATER = 4;

export function createWorld(random) {
  const tw = WORLD.tileSize;
  const mw = WORLD.mapWidth;
  const mh = WORLD.mapHeight;
  const wp = mw * tw;
  const hp = mh * tw;

  // Tile grid
  const grid = [];
  for (let y = 0; y < mh; y++) { grid.push(new Array(mw).fill(T_BUILDING)); }

  // Road network: generate horizontal and vertical roads on a block grid
  const blockGrid = 8; // blocks per super-block
  const roadPositions = []; // {type:'h'|'v', pos} in tile coords

  // Horizontal roads every blockGrid tiles
  for (let y = blockGrid; y < mh; y += blockGrid) {
    for (let x = 0; x < mw; x++) grid[y][x] = T_ROAD;
    roadPositions.push({ type: 'h', pos: y });
  }
  // Vertical roads
  for (let x = blockGrid; x < mw; x += blockGrid) {
    for (let y = 0; y < mh; y++) grid[y][x] = T_ROAD;
    roadPositions.push({ type: 'v', pos: x });
  }

  // Add sidewalks next to roads
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (grid[y][x] !== T_BUILDING) continue;
      const near = (grid[y - 1]?.[x] === T_ROAD) || (grid[y + 1]?.[x] === T_ROAD) ||
                   (grid[y]?.[x - 1] === T_ROAD) || (grid[y]?.[x + 1] === T_ROAD) ||
                   (grid[y - 1]?.[x - 1] === T_ROAD) || (grid[y - 1]?.[x + 1] === T_ROAD) ||
                   (grid[y + 1]?.[x - 1] === T_ROAD) || (grid[y + 1]?.[x + 1] === T_ROAD);
      if (near) grid[y][x] = T_SIDEWALK;
    }
  }

  // Water area in a corner
  for (let y = 0; y < blockGrid; y++) {
    for (let x = mw - blockGrid; x < mw; x++) {
      grid[y][x] = T_WATER;
    }
  }
  // Keep a coastal road
  for (let x = mw - blockGrid; x < mw; x++) grid[blockGrid][x] = T_ROAD;
  for (let y = 0; y < blockGrid; y++) grid[y][mw - blockGrid - 1] = T_SIDEWALK;

  // Parks: convert some building blocks to grass
  for (let i = 0; i < 3; i++) {
    const bx = Math.floor(random() * (mw - blockGrid * 2)) + blockGrid;
    const by = Math.floor(random() * (mh - blockGrid * 2)) + blockGrid;
    for (let y = by; y < Math.min(by + 3, mh); y++) {
      for (let x = bx; x < Math.min(bx + 3, mw); x++) {
        if (grid[y][x] === T_BUILDING) grid[y][x] = T_GRASS;
      }
    }
  }

  // Buildings: assign properties to building tiles
  const buildings = [];
  const buildingColors = [
    '#1e1e30', '#252540', '#1a1a2e', '#222238', '#2a2a4a',
    '#26263e', '#20203a', '#28284a', '#1c1c34', '#242442'
  ];

  // Generate building rectangles within blocks
  for (let by = 0; by < mh; by += blockGrid) {
    for (let bx = 0; bx < mw; bx += blockGrid) {
      // For each block, find the building area (between roads)
      const startX = bx + 1;
      const startY = by + 1;
      const endX = Math.min(bx + blockGrid - 1, mw);
      const endY = Math.min(by + blockGrid - 1, mh);

      if (endX - startX < 1 || endY - startY < 1) continue;
      if (grid[startY]?.[startX] === T_WATER || grid[startY]?.[startX] === T_GRASS) continue;

      // Split block into 1-4 buildings
      const splits = 1 + Math.floor(random() * 3);
      for (let s = 0; s < splits; s++) {
        const bw = 1 + Math.floor(random() * (endX - startX));
        const bh = 1 + Math.floor(random() * (endY - startY));
        const ox = startX + Math.floor(random() * (endX - startX - bw + 1));
        const oy = startY + Math.floor(random() * (endY - startY - bh + 1));

        const px = ox * tw;
        const py = oy * tw;
        const pw = bw * tw;
        const ph = bh * tw;

        // Check it's on building tiles
        let ok = true;
        for (let y = oy; y < oy + bh && ok; y++) {
          for (let x = ox; x < ox + bw && ok; x++) {
            if (grid[y]?.[x] !== T_BUILDING && grid[y]?.[x] !== T_SIDEWALK) ok = false;
          }
        }
        if (!ok) continue;

        const colorIdx = Math.floor(random() * buildingColors.length);
        const height = 20 + Math.floor(random() * 60); // visual height for shading
        const hasWindows = random() > 0.3;
        buildings.push({
          x: px, y: py, w: pw, h: ph,
          color: buildingColors[colorIdx],
          height, hasWindows,
          windowSeed: Math.floor(random() * 10000),
        });
      }
    }
  }

  // Road network for AI: list of road segments (center lines)
  const roadNetwork = [];
  for (const rp of roadPositions) {
    if (rp.type === 'h') {
      roadNetwork.push({
        type: 'h', y: rp.pos * tw + tw / 2,
        x1: 0, x2: wp,
        dir: 1,
      });
    } else {
      roadNetwork.push({
        type: 'v', x: rp.pos * tw + tw / 2,
        y1: 0, y2: hp,
        dir: 1,
      });
    }
  }

  // Spawn points: intersections for cars, sidewalks for peds
  const carSpawns = [];
  const pedSpawns = [];
  for (let i = 0; i < roadPositions.length; i++) {
    const r1 = roadPositions[i];
    for (let j = 0; j < roadPositions.length; j++) {
      const r2 = roadPositions[j];
      if (r1.type === r2.type) continue;
      if (r1.type === 'h') {
        const x = r2.pos * tw + tw / 2;
        const y = r1.pos * tw + tw / 2;
        carSpawns.push({ x, y });
      }
    }
  }

  // Ped spawns on sidewalks
  for (let y = 1; y < mh - 1; y++) {
    for (let x = 1; x < mw - 1; x++) {
      if (grid[y][x] === T_SIDEWALK && random() < 0.05) {
        pedSpawns.push({ x: x * tw + tw / 2, y: y * tw + tw / 2 });
      }
    }
  }

  function isRoad(px, py) {
    const tx = Math.floor(px / tw);
    const ty = Math.floor(py / tw);
    if (tx < 0 || ty < 0 || tx >= mw || ty >= mh) return false;
    return grid[ty][tx] === T_ROAD;
  }

  function isWalkable(px, py) {
    const tx = Math.floor(px / tw);
    const ty = Math.floor(py / tw);
    if (tx < 0 || ty < 0 || tx >= mw || ty >= mh) return false;
    const t = grid[ty][tx];
    return t === T_ROAD || t === T_SIDEWALK || t === T_GRASS;
  }

  function isSolid(px, py) {
    const tx = Math.floor(px / tw);
    const ty = Math.floor(py / tw);
    if (tx < 0 || ty < 0 || tx >= mw || ty >= mh) return true;
    const t = grid[ty][tx];
    return t === T_BUILDING || t === T_WATER;
  }

  function getTile(px, py) {
    const tx = Math.floor(px / tw);
    const ty = Math.floor(py / tw);
    if (tx < 0 || ty < 0 || tx >= mw || ty >= mh) return T_BUILDING;
    return grid[ty][tx];
  }

  // Find nearest road point
  function nearestRoad(px, py) {
    let best = null, bestD = Infinity;
    for (const rp of roadNetwork) {
      if (rp.type === 'h') {
        const d = Math.abs(py - rp.y);
        if (d < bestD) { bestD = d; best = { x: px, y: rp.y }; }
      } else {
        const d = Math.abs(px - rp.x);
        if (d < bestD) { bestD = d; best = { x: rp.x, y: py }; }
      }
    }
    return best;
  }

  return {
    grid, buildings, roadNetwork, carSpawns, pedSpawns,
    width: wp, height: hp, tileSize: tw,
    isRoad, isWalkable, isSolid, getTile, nearestRoad,
  };
}

export const TILE_ROAD = T_ROAD;
export const TILE_SIDEWALK = T_SIDEWALK;
export const TILE_BUILDING = T_BUILDING;
export const TILE_GRASS = T_GRASS;
export const TILE_WATER = T_WATER;