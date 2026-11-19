// Entry point and game loop: Neon Bay, an open-world crime game.
// The game cycles through screens: title, story, play, paused, gameover.
import { STEP, PLAYER, CAR, COMBAT, WANTED, PALETTE, FONT, FIELD } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlayer, updatePlayerOnFoot, tryEnterCar, exitCar, damagePlayer, isPlayerDead, reload, canShoot, onShoot } from './player.js';
import { createVehicle, spawnTraffic, spawnPolice, updateVehicle, updatePlayerCar, damageVehicle } from './vehicles.js';
import { createPedestrian, spawnPedestrians, createPoliceOfficer, updatePedestrian, updatePoliceOfficer } from './npc.js';
import { createMissionSystem, startMission, getCurrentObjective, updateMissions, getMissionStartMarker, getAvailableMission } from './missions.js';
import { createBullets, fireBullet, updateBullets, createParticles, spawnMuzzleFlash, spawnBlood, spawnExplosion, spawnSpark, updateParticles } from './combat.js';
import { createRenderer } from './render.js';
import { drawHUD } from './hud.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_SHOOT, ACTION_RELOAD, ACTION_MELEE } from './input.js';
import * as audio from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

const MAX_FRAME = 0.25;

const SCREEN_TITLE = 'title';
const SCREEN_STORY = 'story';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';
const SCREEN_GAMEOVER = 'gameover';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = parseInt(params.get('seed') || '0', 10) || Math.floor(Math.random() * 4294967296);
const rng = createRandom(seedParam);

const world = createWorld(rng);
const renderer = createRenderer(canvas);
const input = createInput(canvas);

let screen = SCREEN_TITLE;
let player = null;
let traffic = [];
let peds = [];
let policeCars = [];
let policeOfficers = [];
let bullets = createBullets();
let particles = createParticles();
let missionState = createMissionSystem();
let gameState = {
  wantedLevel: 0,
  wantedTimer: 0,
  cars: null,
  currentMission: null,
  missionActive: false,
  missionStartMarker: null,
  money: 0,
  shooting: false,
};
let accumulator = 0;
let lastTime = performance.now();
let missionCompleteTimer = 0;
let missionCompleteText = '';
let screenFlash = 0;
let screenFlashColor = '';

function initGame() {
  // Spawn player at a road intersection
  const spawn = world.carSpawns[Math.floor(world.carSpawns.length / 2)];
  player = createPlayer(spawn.x, spawn.y - 40);
  player.angle = 0;

  traffic = spawnTraffic(world, 20);
  peds = spawnPedestrians(world, 40);
  policeCars = [];
  policeOfficers = [];
  bullets = createBullets();
  particles = createParticles();
  missionState = createMissionSystem();
  gameState = {
    wantedLevel: 0,
    wantedTimer: 0,
    cars: traffic,
    currentMission: null,
    missionActive: false,
    missionStartMarker: getMissionStartMarker({ completedMissions: [], missionActive: false }),
    money: player.money,
    shooting: false,
  };

  // Position camera
  renderer.updateCamera(player.x, player.y, 1);
}

function startNewGame() {
  initGame();
  screen = SCREEN_STORY;
  announce('Neon Bay. Press Space to continue.');
}

function continueGame() {
  const save = loadGame();
  if (!save) { startNewGame(); return; }
  initGame();
  player.health = save.health || player.maxHealth;
  player.money = save.money || 0;
  player.ammo = save.ammo || COMBAT.pistolAmmo;
  player.maxHealth = save.maxHealth || player.maxHealth;
  missionState.completedMissions = save.completedMissions || [];
  gameState.missionStartMarker = getMissionStartMarker({ completedMissions: missionState.completedMissions, missionActive: false });
  screen = SCREEN_PLAY;
  announce('Continuing...');
}

function announce(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function step(dt) {
  if (screen !== SCREEN_PLAY) return;

  // Update player
  if (player.inCar) {
    updatePlayerCar(player.inCar, input, dt, world, [...traffic, ...policeCars]);
    updateEngine();
  } else {
    updatePlayerOnFoot(player, input, dt, world, renderer.getCamera());
  }

  // Handle actions
  const actions = input.takeActions();
  if (actions & ACTION_ENTER_CAR) {
    if (player.inCar) {
      exitCar(player);
      audio.stopEngine();
      audio.sCarStart();
    } else {
      const car = tryEnterCar(player, [...traffic, ...policeCars]);
      if (car) {
        audio.startEngine();
        audio.sCarStart();
        // If stealing a traffic car, gain wanted level
        if (!car.isPolice && traffic.includes(car)) {
          increaseWanted(WANTED.stealCarStars);
        }
      }
    }
  }
  if (actions & ACTION_RELOAD) {
    reload(player);
    audio.sReload();
  }
  if (actions & ACTION_MELEE && player.meleeCooldown <= 0) {
    performMelee();
  }

  // Shooting
  if (input.isShoot() && canShoot(player) && !player.inCar) {
    performShoot();
  } else if (!input.isShoot()) {
    gameState.shooting = false;
  }

  // Update traffic
  for (const car of traffic) {
    updateVehicle(car, dt, world, player, [...traffic, ...policeCars]);
    if (car.exploding <= 0 && car.health <= 0 && !car.destroyed) {
      spawnExplosion(particles, car.x, car.y);
      audio.sExplosion();
      renderer.shake(15);
    }
  }

  // Update police cars
  for (let i = policeCars.length - 1; i >= 0; i--) {
    const car = policeCars[i];
    updateVehicle(car, dt, world, player, [...traffic, ...policeCars]);
    if (car.exploding <= 0 && car.health <= 0 && !car.destroyed) {
      spawnExplosion(particles, car.x, car.y);
      audio.sExplosion();
      renderer.shake(15);
    }
    // Spawn officers if close
    const px = player.inCar ? player.car.x : player.x;
    const py = player.inCar ? player.car.y : player.y;
    const d = Math.hypot(car.x - px, car.y - py);
    if (d < 200 && car.speed < 30 && policeOfficers.length < gameState.wantedLevel * 3) {
      const cop = createPoliceOfficer(car.x + (Math.random() - 0.5) * 30, car.y + (Math.random() - 0.5) * 30);
      policeOfficers.push(cop);
    }
    // Remove if destroyed or too far
    if (car.destroyed || d > WANTED.giveUpDistance * 1.5) {
      policeCars.splice(i, 1);
    }
  }

  // Update peds
  for (const ped of peds) {
    updatePedestrian(ped, dt, world, player, peds);
  }

  // Update police officers
  for (let i = policeOfficers.length - 1; i >= 0; i--) {
    const cop = policeOfficers[i];
    const result = updatePoliceOfficer(cop, dt, world, player, [...traffic, ...policeCars]);
    if (result === 'shoot') {
      const px = player.inCar ? player.car.x : player.x;
      const py = player.inCar ? player.car.y : player.y;
      const angle = Math.atan2(py - cop.y, px - cop.x) + (Math.random() - 0.5) * 0.2;
      fireBullet(bullets, cop.x, cop.y, angle, false);
      audio.sGunshot();
    }
    // Remove dead or far cops
    const px = player.inCar ? player.car.x : player.x;
    const py = player.inCar ? player.car.y : player.y;
    const d = Math.hypot(cop.x - px, cop.y - py);
    if (!cop.alive || d > WANTED.giveUpDistance * 1.5) {
      policeOfficers.splice(i, 1);
    }
  }

  // Update bullets
  const allEntities = [...peds, ...policeOfficers, ...traffic, ...policeCars];
  if (player.inCar) allEntities.push(player.inCar);
  const hits = updateBullets(bullets, dt, world, { player, entities: allEntities });
  for (const hit of hits) {
    if (hit.type === 'wall') {
      spawnSpark(particles, hit.x, hit.y);
    } else if (hit.type === 'hit') {
      spawnBlood(particles, hit.x, hit.y);
      audio.sHurt();
      // If killed a ped, increase wanted
      if (hit.entity && hit.entity.alive === false && peds.includes(hit.entity)) {
        increaseWanted(WANTED.killPedestrianStars);
      }
      if (hit.entity && hit.entity.alive === false && policeOfficers.includes(hit.entity)) {
        increaseWanted(WANTED.killPoliceStars);
      }
    } else if (hit.type === 'playerHit') {
      damagePlayer(player, hit.damage);
      audio.sHurt();
      screenFlash = 0.3;
      screenFlashColor = 'rgba(255,0,0,0.3)';
      renderer.shake(5);
    }
  }

  // Update particles
  updateParticles(particles, dt);

  // Car-pedestrian collisions
  if (player.inCar) {
    const car = player.inCar;
    for (const ped of peds) {
      if (!ped.alive) continue;
      const dx = ped.x - car.x, dy = ped.y - car.y;
      if (dx * dx + dy * dy < 30 * 30 && Math.abs(car.speed) > 50) {
        ped.health -= 30;
        ped.alive = false;
        spawnBlood(particles, ped.x, ped.y);
        increaseWanted(WANTED.killPedestrianStars);
        audio.sHurt();
      }
    }
  }

  // Wanted level system
  updateWanted(dt);

  // Missions
  gameState.currentMission = missionState.currentMission;
  gameState.missionActive = missionState.missionActive;
  const missionResult = updateMissions(missionState, dt, { ...gameState, ...{ currentMission: missionState.currentMission } }, player, world);
  if (missionResult) {
    if (missionResult.type === 'missionComplete') {
      audio.sMissionComplete();
      missionCompleteText = `Mission Complete: ${missionResult.mission.title}\n+$${missionResult.mission.reward}`;
      missionCompleteTimer = 4;
      player.money = gameState.money = missionState.money || player.money;
      // Set up next mission marker
      gameState.missionStartMarker = getMissionStartMarker({ completedMissions: missionState.completedMissions, missionActive: false });
      saveGame({
        x: player.x, y: player.y, health: player.health, money: player.money,
        ammo: player.ammo, missionIndex: missionState.completedMissions.length,
        wantedLevel: gameState.wantedLevel, completedMissions: missionState.completedMissions,
        maxHealth: player.maxHealth, hasWeapon: player.hasWeapon,
      });
    } else if (missionResult.type === 'objectiveComplete') {
      audio.sPickup();
    }
  }

  // Check for starting a new mission
  if (!gameState.missionActive && gameState.missionStartMarker) {
    const px = player.inCar ? player.car.x : player.x;
    const py = player.inCar ? player.car.y : player.y;
    const m = gameState.missionStartMarker;
    const d = Math.hypot(m.x - px, m.y - py);
    if (d < m.radius && (actions & ACTION_CONFIRM)) {
      const available = getAvailableMission({ completedMissions: missionState.completedMissions, missionActive: false });
      if (available) {
        startMission(missionState, available.id);
        gameState.missionActive = true;
        gameState.missionStartMarker = null;
        // Create target entity for eliminate missions
        const obj = getCurrentObjective(missionState);
        if (obj && obj.type === 'eliminate') {
          const target = createPoliceOfficer(obj.x, obj.y);
          target.health = 100;
          target.color = '#882244';
          target.clothColor = '#440011';
          missionState.targetEntity = target;
          policeOfficers.push(target);
        }
        audio.sMissionComplete();
        announce(`Mission: ${available.title}`);
      }
    }
  }

  // Update mission state reference
  gameState.currentMission = missionState.currentMission;
  gameState.missionActive = missionState.missionActive;
  gameState.cars = [...traffic, ...policeCars];

  // Player death
  if (isPlayerDead(player) || (player.inCar && player.inCar.destroyed)) {
    screen = SCREEN_GAMEOVER;
    audio.stopEngine();
    audio.stopSiren();
    announce('Game Over. You died.');
  }

  // Mission complete timer
  if (missionCompleteTimer > 0) {
    missionCompleteTimer -= dt;
  }
  if (screenFlash > 0) screenFlash -= dt;

  // Camera update
  const cx = player.inCar ? player.car.x : player.x;
  const cy = player.inCar ? player.car.y : player.y;
  renderer.updateCamera(cx, cy, dt);
}

function performShoot() {
  onShoot(player);
  fireBullet(bullets, player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18, player.angle, true);
  spawnMuzzleFlash(particles, player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18, player.angle);
  audio.sGunshot();
  renderer.shake(3);
  gameState.shooting = true;
  increaseWanted(WANTED.shootStars);
}

function performMelee() {
  player.meleeCooldown = COMBAT.meleeCooldown;
  audio.sMelee();
  // Check for nearby entities
  const hitX = player.x + Math.cos(player.angle) * COMBAT.meleeRange;
  const hitY = player.y + Math.sin(player.angle) * COMBAT.meleeRange;
  const allEntities = [...peds, ...policeOfficers];
  for (const e of allEntities) {
    if (!e.alive) continue;
    const dx = e.x - hitX, dy = e.y - hitY;
    if (dx * dx + dy * dy < 20 * 20) {
      e.health -= COMBAT.meleeDamage;
      if (e.health <= 0) {
        e.alive = false;
        spawnBlood(particles, e.x, e.y);
        if (peds.includes(e)) increaseWanted(WANTED.killPedestrianStars);
        if (policeOfficers.includes(e)) increaseWanted(WANTED.killPoliceStars);
      }
    }
  }
}

function updateEngine() {
  if (player.inCar) {
    const ratio = Math.abs(player.inCar.speed) / CAR.maxSpeed;
    audio.updateEngine(ratio);
  }
}

function increaseWanted(stars) {
  const newLevel = Math.min(5, gameState.wantedLevel + stars);
  if (newLevel > gameState.wantedLevel) {
    gameState.wantedLevel = newLevel;
    audio.sWanted();
    gameState.wantedTimer = 0;
  } else {
    gameState.wantedTimer = 0; // Reset cooldown timer
  }
}

function updateWanted(dt) {
  if (gameState.wantedLevel === 0) {
    audio.stopSiren();
    return;
  }

  // Spawn police if not enough
  const targetPoliceCars = gameState.wantedLevel * WANTED.policePerStar;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;

  if (policeCars.length < targetPoliceCars) {
    const spawnTimer = gameState._policeSpawnTimer || 0;
    gameState._policeSpawnTimer = spawnTimer + dt;
    if (gameState._policeSpawnTimer > 2) {
      gameState._policeSpawnTimer = 0;
      const car = spawnPolice(world, px, py);
      policeCars.push(car);
    }
  }

  audio.startSiren();

  // Cooldown: if no crime committed for a while, decrease wanted
  gameState.wantedTimer += dt;
  if (gameState.wantedTimer > WANTED.cooldownTime) {
    gameState.wantedLevel = Math.max(0, gameState.wantedLevel - 1);
    gameState.wantedTimer = 0;
    if (gameState.wantedLevel === 0) {
      // Clear police
      policeCars = [];
      policeOfficers = [];
      audio.stopSiren();
    }
  }
}

function drawScreen() {
  const { w: cw, h: ch } = renderer.getCanvasSize();

  if (screen === SCREEN_TITLE) {
    drawTitleScreen(cw, ch);
    return;
  }

  if (screen === SCREEN_STORY) {
    drawStoryScreen(cw, ch);
    return;
  }

  if (screen === SCREEN_GAMEOVER) {
    // Draw game world behind
    renderer.drawWorld(world, player, gameState);
    drawAllEntities();
    drawGameOverScreen(cw, ch);
    return;
  }

  if (screen === SCREEN_PAUSED) {
    renderer.drawWorld(world, player, gameState);
    drawAllEntities();
    drawPausedScreen(cw, ch);
    return;
  }

  // SCREEN_PLAY
  renderer.drawWorld(world, player, gameState);
  drawAllEntities();

  // Target reticle
  const mouse = input.mouse();
  renderer.drawTargetReticle(mouse.x, mouse.y, renderer.getCamera());

  // Reset context transform for screen-space HUD
  renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  // HUD
  drawHUD(renderer.ctx, gameState, player, world, missionState, cw, ch);

  // Mission complete text
  if (missionCompleteTimer > 0) {
    const alpha = Math.min(1, missionCompleteTimer);
    renderer.ctx.fillStyle = `rgba(0,0,0,${0.6 * alpha})`;
    renderer.ctx.fillRect(0, ch / 2 - 60, cw, 120);
    renderer.ctx.font = `bold 28px ${FONT}`;
    renderer.ctx.fillStyle = `rgba(255,204,0,${alpha})`;
    renderer.ctx.textAlign = 'center';
    renderer.ctx.textBaseline = 'middle';
    const lines = missionCompleteText.split('\n');
    lines.forEach((line, i) => {
      renderer.ctx.fillText(line, cw / 2, ch / 2 - 20 + i * 36);
    });
  }

  // Screen flash
  if (screenFlash > 0) {
    renderer.ctx.fillStyle = screenFlashColor.replace(/[\d.]+\)$/, `${screenFlash})`);
    renderer.ctx.fillRect(0, 0, cw, ch);
  }
}

function drawAllEntities() {
  const cam = renderer.getCamera();

  // Draw cars
  for (const car of traffic) renderer.drawCar(car, cam);
  for (const car of policeCars) renderer.drawCar(car, cam);

  // Draw peds
  for (const ped of peds) renderer.drawPedestrian(ped, cam);
  for (const cop of policeOfficers) renderer.drawPoliceOfficer(cop, cam);

  // Draw player
  renderer.drawPlayer(player, cam);

  // Draw bullets
  renderer.drawBullets(bullets, cam);

  // Draw particles
  renderer.drawParticles(particles, cam);
}

function drawTitleScreen(cw, ch) {
  const ctx = renderer.ctx;
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, cw, ch);

  // Animated city background
  const t = performance.now() * 0.0005;
  ctx.save();
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 20; i++) {
    const bx = (i * 80 + t * 20) % cw;
    const bh = 100 + Math.sin(i * 2.3) * 60;
    ctx.fillStyle = i % 2 === 0 ? '#1a1a2e' : '#222240';
    ctx.fillRect(bx, ch - bh - 100, 70, bh);
    // Windows
    ctx.fillStyle = 'rgba(221,170,68,0.3)';
    for (let wy = 0; wy < bh - 20; wy += 15) {
      for (let wx = 0; wx < 50; wx += 12) {
        if (Math.sin(i + wy + wx) > 0.3) {
          ctx.fillRect(bx + wx + 5, ch - bh - 100 + wy + 10, 6, 6);
        }
      }
    }
  }
  ctx.restore();

  // Title
  const scale = window.devicePixelRatio || 1;
  ctx.font = `bold ${72 * scale}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Neon glow effect
  ctx.shadowColor = '#ff4488';
  ctx.shadowBlur = 20 * scale;
  ctx.fillStyle = '#ff6699';
  ctx.fillText('NEON BAY', cw / 2, ch / 2 - 60 * scale);
  ctx.shadowBlur = 0;

  ctx.font = `${20 * scale}px ${FONT}`;
  ctx.fillStyle = '#88aacc';
  ctx.fillText('An Open-World Crime Game', cw / 2, ch / 2 - 10 * scale);

  // Menu options
  ctx.font = `${18 * scale}px ${FONT}`;
  const hasSaved = hasSave();
  const options = hasSaved ? ['New Game', 'Continue', ''] : ['New Game', ''];
  const optY = ch / 2 + 50 * scale;
  for (let i = 0; i < options.length; i++) {
    if (!options[i]) continue;
    const y = optY + i * 36 * scale;
    ctx.fillStyle = i === 0 ? PALETTE.menuHighlight : PALETTE.menuText;
    ctx.fillText(options[i], cw / 2, y);
  }

  ctx.font = `${14 * scale}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Press SPACE for New Game' + (hasSaved ? ' • C to Continue' : ''), cw / 2, ch - 50 * scale);
  ctx.fillText('WASD move • Mouse aim • Click shoot • E enter/exit car • R reload', cw / 2, ch - 30 * scale);
}

function drawStoryScreen(cw, ch) {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(10,10,20,0.95)';
  ctx.fillRect(0, 0, cw, ch);

  const scale = window.devicePixelRatio || 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `bold ${36 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuHighlight;
  ctx.fillText('The Story So Far', cw / 2, ch / 2 - 120 * scale);

  // Story text wrapped
  ctx.font = `${16 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuText;
  const story = missionState.storyIntro;
  const words = story.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > cw * 0.7) { lines.push(line); line = w + ' '; }
    else line = test;
  }
  lines.push(line);
  lines.forEach((l, i) => {
    ctx.fillText(l, cw / 2, ch / 2 - 50 * scale + i * 28 * scale);
  });

  ctx.font = `${20 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuHighlight;
  ctx.fillText('Press SPACE to enter Neon Bay', cw / 2, ch - 80 * scale);
}

function drawGameOverScreen(cw, ch) {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(80,0,0,0.7)';
  ctx.fillRect(0, 0, cw, ch);

  const scale = window.devicePixelRatio || 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `bold ${56 * scale}px ${FONT}`;
  ctx.fillStyle = '#ff4444';
  ctx.fillText('WASTED', cw / 2, ch / 2 - 40 * scale);

  ctx.font = `${18 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuText;
  ctx.fillText(`Money: $${player.money}`, cw / 2, ch / 2 + 10 * scale);
  ctx.fillText(`Missions completed: ${missionState.completedMissions.length}`, cw / 2, ch / 2 + 36 * scale);

  ctx.font = `${16 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuHighlight;
  ctx.fillText('Press SPACE to return to title', cw / 2, ch - 60 * scale);
}

function drawPausedScreen(cw, ch) {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, cw, ch);

  const scale = window.devicePixelRatio || 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${48 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuText;
  ctx.fillText('PAUSED', cw / 2, ch / 2 - 20 * scale);

  ctx.font = `${18 * scale}px ${FONT}`;
  ctx.fillStyle = PALETTE.menuHighlight;
  ctx.fillText('Press P or ESC to resume', cw / 2, ch / 2 + 30 * scale);
}

function handleActions() {
  const actions = input.takeActions();

  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) {
      audio.resumeAudio();
      audio.sMenuClick();
      startNewGame();
    }
    // Check for 'C' key for continue
    if (hasSave() && actions & 0) { /* handled below */ }
  } else if (screen === SCREEN_STORY) {
    if (actions & ACTION_CONFIRM) {
      audio.sMenuClick();
      screen = SCREEN_PLAY;
      announce('Playing. Explore Neon Bay.');
    }
  } else if (screen === SCREEN_GAMEOVER) {
    if (actions & ACTION_CONFIRM) {
      screen = SCREEN_TITLE;
    }
  } else if (screen === SCREEN_PLAY) {
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      audio.stopEngine();
      announce('Paused.');
    }
  } else if (screen === SCREEN_PAUSED) {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      if (player.inCar) audio.startEngine();
      announce('Playing.');
    }
  }
}

// Handle 'C' key for continue
window.addEventListener('keydown', (e) => {
  if (screen === SCREEN_TITLE && e.code === 'KeyC' && hasSave()) {
    audio.resumeAudio();
    audio.sMenuClick();
    continueGame();
  }
});

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - lastTime) / 1000, MAX_FRAME);
  lastTime = now;

  handleActions();

  if (screen === SCREEN_PLAY) {
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }

  drawScreen();
}

// Screenshot mode
if (shotParam) {
  runShot(shotParam);
} else {
  initGame();
  screen = SCREEN_TITLE;
  requestAnimationFrame(frame);
}

function runShot(name) {
  initGame();
  screen = SCREEN_PLAY;

  if (name === 'title') {
    screen = SCREEN_TITLE;
  } else if (name === 'driving') {
    // Put player in a car
    const car = traffic[0];
    if (car) {
      player.inCar = car;
      car.occupied = true;
      car.speed = 200;
    }
    // Run a few seconds
    for (let i = 0; i < 60; i++) step(STEP);
  } else if (name === 'police') {
    // Give player wanted level and spawn police
    gameState.wantedLevel = 3;
    for (let i = 0; i < 3; i++) {
      const car = spawnPolice(world, player.x, player.y);
      policeCars.push(car);
    }
    for (let i = 0; i < 60; i++) step(STEP);
  } else if (name === 'mission') {
    // Start first mission
    const available = getAvailableMission({ completedMissions: [], missionActive: false });
    if (available) {
      startMission(missionState, available.id);
      gameState.missionActive = true;
      gameState.missionStartMarker = null;
    }
    for (let i = 0; i < 30; i++) step(STEP);
  }

  // Render twice for screenshot
  let painted = 0;
  function paint() {
    drawScreen();
    painted++;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}