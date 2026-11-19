// HUD: health bar, wanted stars, minimap, money, mission info, weapon/ammo.
import { FIELD, PALETTE, FONT, WANTED } from './config.js';
import { TILE_ROAD, TILE_BUILDING, TILE_GRASS, TILE_WATER, TILE_SIDEWALK } from './world.js';

export function drawHUD(ctx, state, player, world, missionState, canvasW, canvasH) {
  ctx.save();

  // Health bar (bottom-left)
  const barW = 200, barH = 18;
  const barX = 20, barY = canvasH - 40;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);
  const hpRatio = player.health / player.maxHealth;
  ctx.fillStyle = hpRatio > 0.3 ? PALETTE.hudHealth : PALETTE.hudHealthLow;
  ctx.fillRect(barX, barY, barW * hpRatio, barH);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Health text
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`HP ${Math.ceil(player.health)}/${player.maxHealth}`, barX + 6, barY + barH / 2);

  // Money (top-left)
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = '#4c4';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`$${player.money}`, 20, 20);

  // Weapon / Ammo (bottom-left, above health)
  if (player.hasWeapon) {
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.hudText;
    const ammoText = player.reloading > 0 ? 'RELOADING...' : `${player.ammo}/${player.maxAmmo}`;
    ctx.fillText(`PISTOL: ${ammoText}`, 20, canvasH - 65);
  }

  // Wanted stars (top-center)
  drawWantedStars(ctx, state.wantedLevel, canvasW);

  // Minimap (top-right)
  drawMinimap(ctx, player, world, state, missionState, canvasW);

  // Mission info (bottom-center)
  drawMissionInfo(ctx, state, missionState, canvasW, canvasH);

  // Controls hint
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('WASD move • Mouse aim • Click shoot • E enter/exit car • R reload • Q melee • Shift sprint • P pause', 20, canvasH - 4);

  ctx.restore();
}

function drawWantedStars(ctx, level, canvasW) {
  const starSize = 22;
  const spacing = 28;
  const totalW = 4 * spacing;
  const startX = (canvasW - totalW) / 2;
  const y = 24;
  ctx.font = `bold ${starSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    const active = i < level;
    ctx.fillStyle = active ? PALETTE.hudWanted : 'rgba(255,255,255,0.15)';
    drawStar(ctx, startX + i * spacing + starSize / 2, y, starSize / 2);
  }
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, player, world, state, missionState, canvasW) {
  const mapSize = 180;
  const mapX = canvasW - mapSize - 20;
  const mapY = 20;
  const scale = mapSize / world.width;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapSize, mapSize);
  ctx.clip();

  ctx.fillStyle = PALETTE.minimapBg;
  ctx.fillRect(mapX, mapY, mapSize, mapSize);

  // Draw simplified city grid
  const tw = world.tileSize;
  const mw = world.grid[0].length;
  const mh = world.grid.length;

  // Only draw tiles near player for performance
  const viewRadius = 30;
  const ptx = Math.floor(px / tw);
  const pty = Math.floor(py / tw);

  for (let ty = Math.max(0, pty - viewRadius); ty < Math.min(mh, pty + viewRadius); ty++) {
    for (let tx = Math.max(0, ptx - viewRadius); tx < Math.min(mw, ptx + viewRadius); tx++) {
      const tile = world.grid[ty][tx];
      let color = null;
      if (tile === TILE_ROAD) color = '#444';
      else if (tile === TILE_BUILDING) color = '#222';
      else if (tile === TILE_GRASS) color = '#242';
      else if (tile === TILE_WATER) color = '#134';
      else if (tile === TILE_SIDEWALK) color = '#333';
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(
          mapX + tx * tw * scale,
          mapY + ty * tw * scale,
          tw * scale + 1,
          tw * scale + 1
        );
      }
    }
  }

  // Traffic dots
  if (state.cars) {
    for (const car of state.cars) {
      if (car.destroyed || car.occupied) continue;
      ctx.fillStyle = car.isPolice ? PALETTE.minimapPolice : PALETTE.minimapTraffic;
      ctx.fillRect(
        mapX + car.x * scale - 1,
        mapY + car.y * scale - 1,
        3, 3
      );
    }
  }

  // Mission markers
  if (missionState.missionActive && state.currentMission) {
    const obj = state.currentMission.objectives[state.objectiveIndex];
    if (obj && obj.x !== undefined) {
      ctx.fillStyle = PALETTE.minimapMission;
      ctx.beginPath();
      ctx.arc(mapX + obj.x * scale, mapY + obj.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (state.missionStartMarker) {
    ctx.fillStyle = PALETTE.minimapMission;
    ctx.beginPath();
    ctx.arc(mapX + state.missionStartMarker.x * scale, mapY + state.missionStartMarker.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player (center)
  ctx.fillStyle = PALETTE.minimapPlayer;
  ctx.beginPath();
  ctx.arc(mapX + px * scale, mapY + py * scale, 3, 0, Math.PI * 2);
  ctx.fill();

  // Player direction
  const pAngle = player.inCar ? player.car.angle : player.angle;
  ctx.strokeStyle = PALETTE.minimapPlayer;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapX + px * scale, mapY + py * scale);
  ctx.lineTo(mapX + (px + Math.cos(pAngle) * 100) * scale, mapY + (py + Math.sin(pAngle) * 100) * scale);
  ctx.stroke();

  ctx.restore();

  // Border
  ctx.strokeStyle = PALETTE.minimapBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
}

function drawMissionInfo(ctx, state, missionState, canvasW, canvasH) {
  if (!missionState.currentMission) {
    if (missionState.missionStartMarker) {
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = PALETTE.hudText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Press SPACE at the marker to start a mission', canvasW / 2, canvasH - 50);
    }
    return;
  }

  const mission = missionState.currentMission;
  const obj = mission.objectives[missionState.objectiveIndex];
  if (!obj) return;

  ctx.font = `bold 16px ${FONT}`;
  ctx.fillStyle = PALETTE.menuHighlight;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(mission.title, canvasW / 2, canvasH - 60);

  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = PALETTE.hudText;
  let objText = obj.desc;
  if (obj.type === 'survive') {
    objText = `${obj.desc} (${Math.ceil(obj.duration - missionState.missionTimer)}s)`;
  } else if (obj.type === 'escape') {
    objText = `${obj.desc} (lose ${state && state.wantedLevel ? state.wantedLevel : 0} star${(state && state.wantedLevel) !== 1 ? 's' : ''})`;
  }
  ctx.fillText(objText, canvasW / 2, canvasH - 40);
}