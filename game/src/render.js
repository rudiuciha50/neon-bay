// Camera, rendering, particles, screen shake.
import { FIELD, PALETTE, FONT, WORLD } from './config.js';
import { TILE_ROAD, TILE_BUILDING, TILE_GRASS, TILE_WATER, TILE_SIDEWALK } from './world.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0, shakeX: 0, shakeY: 0, shakeIntensity: 0 };
  let canvasW = 0, canvasH = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvasW = canvas.width;
    canvasH = canvas.height;
  }
  resize();
  window.addEventListener('resize', resize);

  function updateCamera(targetX, targetY, dt) {
    // Smooth follow
    const targetCamX = targetX - canvasW / 2;
    const targetCamY = targetY - canvasH / 2;
    camera.x += (targetCamX - camera.x) * Math.min(1, dt * 8);
    camera.y += (targetCamY - camera.y) * Math.min(1, dt * 8);

    // Screen shake
    if (camera.shakeIntensity > 0) {
      camera.shakeX = (Math.random() - 0.5) * camera.shakeIntensity;
      camera.shakeY = (Math.random() - 0.5) * camera.shakeIntensity;
      camera.shakeIntensity = Math.max(0, camera.shakeIntensity - dt * 60);
    } else {
      camera.shakeX = 0; camera.shakeY = 0;
    }
  }

  function shake(intensity) {
    camera.shakeIntensity = Math.max(camera.shakeIntensity, intensity);
  }

  function getCamera() { return { x: camera.x + camera.shakeX, y: camera.y + camera.shakeY }; }

  function drawWorld(world, player, state) {
    const cam = getCamera();
    const tw = world.tileSize;
    const scale = window.devicePixelRatio || 1;

    // Background
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Visible tile range
    const startTx = Math.max(0, Math.floor(cam.x / tw));
    const endTx = Math.min(world.grid[0].length - 1, Math.ceil((cam.x + canvasW) / tw));
    const startTy = Math.max(0, Math.floor(cam.y / tw));
    const endTy = Math.min(world.grid.length - 1, Math.ceil((cam.y + canvasH) / tw));

    // Draw tiles
    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const tile = world.grid[ty][tx];
        const sx = tx * tw - cam.x;
        const sy = ty * tw - cam.y;
        switch (tile) {
          case TILE_ROAD:
            ctx.fillStyle = PALETTE.road;
            ctx.fillRect(sx, sy, tw, tw);
            break;
          case TILE_SIDEWALK:
            ctx.fillStyle = PALETTE.sidewalk;
            ctx.fillRect(sx, sy, tw, tw);
            break;
          case TILE_BUILDING:
            ctx.fillStyle = PALETTE.buildingDark;
            ctx.fillRect(sx, sy, tw, tw);
            break;
          case TILE_GRASS:
            ctx.fillStyle = PALETTE.grass;
            ctx.fillRect(sx, sy, tw, tw);
            break;
          case TILE_WATER:
            ctx.fillStyle = PALETTE.water;
            ctx.fillRect(sx, sy, tw, tw);
            // Water shimmer
            const shimmer = Math.sin((tx + ty) * 0.5 + performance.now() * 0.001) * 0.1;
            ctx.fillStyle = `rgba(80,120,180,${0.05 + shimmer})`;
            ctx.fillRect(sx, sy, tw, tw);
            break;
        }
      }
    }

    // Road lines (dashed center)
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([10 * scale, 14 * scale]);
    for (const rp of world.roadNetwork) {
      if (rp.type === 'h') {
        if (rp.y < cam.y - tw || rp.y > cam.y + canvasH + tw) continue;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, -cam.x), rp.y - cam.y);
        ctx.lineTo(world.width - cam.x, rp.y - cam.y);
        ctx.stroke();
      } else {
        if (rp.x < cam.x - tw || rp.x > cam.x + canvasW + tw) continue;
        ctx.beginPath();
        ctx.moveTo(rp.x - cam.x, Math.max(0, -cam.y));
        ctx.lineTo(rp.x - cam.x, world.height - cam.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Draw buildings with pseudo-3D effect
    drawBuildings(world, cam);

    // Draw mission markers
    drawMissionMarkers(state, cam, scale);
  }

  function drawBuildings(world, cam) {
    for (const b of world.buildings) {
      if (b.x + b.w < cam.x || b.x > cam.x + canvasW || b.y + b.h < cam.y || b.y > cam.y + canvasH) continue;
      const sx = b.x - cam.x;
      const sy = b.y - cam.y;

      // Building base
      ctx.fillStyle = b.color;
      ctx.fillRect(sx, sy, b.w, b.h);

      // Top edge highlight (pseudo-3D)
      const shade = b.height / 80;
      ctx.fillStyle = `rgba(${Math.floor(40 + shade * 30)},${Math.floor(40 + shade * 30)},${Math.floor(60 + shade * 40)},0.6)`;
      ctx.fillRect(sx, sy, b.w, Math.min(4, b.h));

      // Right edge shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx + b.w - 3, sy, 3, b.h);
      ctx.fillRect(sx, sy + b.h - 3, b.w, 3);

      // Windows
      if (b.hasWindows) {
        const wSize = 6;
        const wGap = 10;
        let seed = b.windowSeed;
        for (let wy = wGap; wy < b.h - wGap; wy += wGap + wSize) {
          for (let wx = wGap; wx < b.w - wGap; wx += wGap + wSize) {
            seed = (seed * 9301 + 49297) % 233280;
            const lit = (seed / 233280) > 0.5;
            ctx.fillStyle = lit ? PALETTE.windowLit : PALETTE.window;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(sx + wx, sy + wy, wSize, wSize);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }

  function drawMissionMarkers(state, cam, scale) {
    if (state.missionStartMarker && !state.missionActive) {
      drawMarker(state.missionStartMarker.x, state.missionStartMarker.y, cam, '#fc0', 'Mission');
    }
    if (state.currentMission && state.missionActive) {
      const obj = state.currentMission.objectives[state.objectiveIndex];
      if (obj && obj.x !== undefined) {
        drawMarker(obj.x, obj.y, cam, '#4f4', obj.desc || '');
      }
    }
  }

  function drawMarker(wx, wy, cam, color, label) {
    const sx = wx - cam.x;
    const sy = wy - cam.y;
    const t = performance.now() * 0.003;
    const pulse = 1 + Math.sin(t) * 0.2;

    // Glow
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(sx, sy, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(sx, sy, 20 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cylinder marker
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Arrow pointing down
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 24);
    ctx.lineTo(sx - 6, sy - 34);
    ctx.lineTo(sx + 6, sy - 34);
    ctx.closePath();
    ctx.fill();
  }

  function drawCar(car, cam) {
    if (car.destroyed) return;
    const sx = car.x - cam.x;
    const sy = car.y - cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(car.angle + Math.PI / 2);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-car.width / 2 + 2, -car.height / 2 + 2, car.width, car.height);

    // Body
    let bodyColor = car.color;
    if (car.exploding > 0) {
      bodyColor = `rgb(${200 + Math.random() * 55}, ${50 + Math.random() * 100}, 0)`;
    }
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

    // Roof/windshield
    ctx.fillStyle = 'rgba(20,30,40,0.8)';
    ctx.fillRect(-car.width / 2 + 4, -car.height / 2 + 12, car.width - 8, car.height - 24);

    // Headlights
    ctx.fillStyle = '#ff8';
    ctx.fillRect(-car.width / 2 + 2, -car.height / 2, 6, 3);
    ctx.fillRect(car.width / 2 - 8, -car.height / 2, 6, 3);

    // Police lights
    if (car.isPolice) {
      const blink = Math.floor(performance.now() / 200) % 2;
      ctx.fillStyle = blink ? '#f44' : '#44f';
      ctx.fillRect(-car.width / 2 + 4, -4, 10, 6);
      ctx.fillStyle = blink ? '#44f' : '#f44';
      ctx.fillRect(car.width / 2 - 14, -4, 10, 6);
    }

    // Health bar if damaged
    if (car.health < car.maxHealth) {
      const bw = car.width;
      ctx.fillStyle = '#333';
      ctx.fillRect(-bw / 2, -car.height / 2 - 8, bw, 3);
      ctx.fillStyle = car.health > car.maxHealth * 0.3 ? '#4c4' : '#c44';
      ctx.fillRect(-bw / 2, -car.height / 2 - 8, bw * (car.health / car.maxHealth), 3);
    }

    ctx.restore();
  }

  function drawPlayer(player, cam) {
    const px = player.inCar ? player.car.x : player.x;
    const py = player.inCar ? player.car.y : player.y;
    if (player.inCar) return; // Car draws the player

    const sx = px - cam.x;
    const sy = py - cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(player.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 2, player.radius + 2, player.radius, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = PALETTE.playerClothes;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator (gun arm)
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(player.radius + 4, 0);
    ctx.stroke();

    // Invulnerability flash
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPedestrian(ped, cam) {
    if (!ped.alive) {
      // Dead body
      const sx = ped.x - cam.x, sy = ped.y - cam.y;
      ctx.fillStyle = ped.clothColor;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ped.angle);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    const sx = ped.x - cam.x, sy = ped.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ped.angle);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 1, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ped.clothColor;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPoliceOfficer(cop, cam) {
    if (!cop.alive) {
      const sx = cop.x - cam.x, sy = cop.y - cam.y;
      ctx.fillStyle = cop.clothColor;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(cop.angle);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    const sx = cop.x - cam.x, sy = cop.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(cop.angle);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 1, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cop.clothColor;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cop.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    // Gun
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawBullets(bullets, cam) {
    for (const b of bullets) {
      const sx = b.x - cam.x, sy = b.y - cam.y;
      ctx.fillStyle = PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      // Trail
      ctx.strokeStyle = 'rgba(255,200,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - b.vx * 0.02, sy - b.vy * 0.02);
      ctx.stroke();
    }
  }

  function drawParticles(particles, cam) {
    for (const p of particles) {
      const sx = p.x - cam.x, sy = p.y - cam.y;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.type === 'smoke') {
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (2 - alpha), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTargetReticle(mouseX, mouseY, cam) {
    const scale = window.devicePixelRatio || 1;
    const wx = mouseX * scale - cam.x + cam.x; // mouse is in screen coords
    // Actually mouse coords are screen pixels; we just draw at mouseX, mouseY
    ctx.strokeStyle = 'rgba(255,200,0,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX * scale, mouseY * scale, 8 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX * scale - 14 * scale, mouseY * scale);
    ctx.lineTo(mouseX * scale - 4 * scale, mouseY * scale);
    ctx.moveTo(mouseX * scale + 4 * scale, mouseY * scale);
    ctx.lineTo(mouseX * scale + 14 * scale, mouseY * scale);
    ctx.moveTo(mouseX * scale, mouseY * scale - 14 * scale);
    ctx.lineTo(mouseX * scale, mouseY * scale - 4 * scale);
    ctx.moveTo(mouseX * scale, mouseY * scale + 4 * scale);
    ctx.lineTo(mouseX * scale, mouseY * scale + 14 * scale);
    ctx.stroke();
  }

  return {
    ctx, canvas, camera: getCamera, updateCamera, shake,
    resize, drawWorld, drawCar, drawPlayer, drawPedestrian, drawPoliceOfficer,
    drawBullets, drawParticles, drawTargetReticle,
    getCanvasSize: () => ({ w: canvasW, h: canvasH }),
  };
}