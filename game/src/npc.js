// Pedestrian and police NPC AI.
import { PEDESTRIAN, POLICE, PALETTE } from './config.js';

const PED_COLORS = ['#887766', '#997766', '#776655', '#886644', '#996655', '#887755', '#775544', '#aa7766'];
const CLOTH_COLORS = ['#335566', '#664433', '#445533', '#554455', '#335544', '#555544'];

export function createPedestrian(x, y) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
    clothColor: CLOTH_COLORS[Math.floor(Math.random() * CLOTH_COLORS.length)],
    health: 30,
    alive: true,
    fleeTimer: 0,
    wanderTimer: 1 + Math.random() * 3,
  };
}

export function spawnPedestrians(world, count) {
  const peds = [];
  const spawns = [...world.pedSpawns];
  for (let i = spawns.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
  }
  for (let i = 0; i < count && i < spawns.length; i++) {
    peds.push(createPedestrian(spawns[i].x, spawns[i].y));
  }
  return peds;
}

export function createPoliceOfficer(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    health: 60,
    alive: true,
    color: '#224488',
    clothColor: '#113366',
    shootCooldown: 0,
    mode: 'chase',
    wanderTimer: 0,
    stunTimer: 0,
  };
}

export function updatePedestrian(ped, dt, world, player, allPeds) {
  if (!ped.alive || ped.stunTimer > 0) {
    if (ped.stunTimer > 0) ped.stunTimer -= dt;
    return;
  }

  // Flee from gunfire or violence
  ped.fleeTimer -= dt;
  if (player.shooting && ped.fleeTimer <= 0) {
    const dx = ped.x - player.x, dy = ped.y - player.y;
    if (dx * dx + dy * dy < 200 * 200) {
      ped.fleeTimer = 2;
    }
  }

  if (ped.fleeTimer > 0) {
    const dx = ped.x - player.x, dy = ped.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(targetAngle) * PEDESTRIAN.speed * 1.5 * dt;
    const ny = ped.y + Math.sin(targetAngle) * PEDESTRIAN.speed * 1.5 * dt;
    if (world.isWalkable(nx, ny)) { ped.x = nx; ped.y = ny; }
    ped.angle = targetAngle;
    return;
  }

  // Wander
  ped.wanderTimer -= dt;
  if (ped.wanderTimer <= 0) {
    ped.wanderTimer = 1 + Math.random() * 3;
    if (Math.random() < 0.4) {
      ped.speed = PEDESTRIAN.speed * (0.3 + Math.random() * 0.7);
      ped.angle += (Math.random() - 0.5) * Math.PI;
    } else {
      ped.speed = 0;
    }
  }

  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  if (world.isWalkable(nx, ny)) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.angle += Math.PI * 0.5; // Turn
    ped.speed = 0;
  }
}

export function updatePoliceOfficer(cop, dt, world, player, cars) {
  if (!cop.alive) return;
  if (cop.stunTimer > 0) { cop.stunTimer -= dt; return; }

  const targetX = player.inCar ? player.car.x : player.x;
  const targetY = player.inCar ? player.car.y : player.y;
  const dx = targetX - cop.x;
  const dy = targetY - cop.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  cop.shootCooldown -= dt;

  if (cop.mode === 'chase') {
    cop.angle = Math.atan2(dy, dx);
    const nx = cop.x + Math.cos(cop.angle) * POLICE.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * POLICE.speed * dt;
    if (world.isWalkable(nx, ny)) { cop.x = nx; cop.y = ny; }

    // Shoot if close enough
    if (dist < 300 && cop.shootCooldown <= 0) {
      cop.shootCooldown = 0.5 + Math.random() * 0.5;
      return 'shoot';
    }
  }

  return null;
}