// Vehicle physics and traffic AI.
import { CAR, TRAFFIC, PALETTE } from './config.js';

const TRAFFIC_COLORS = ['#445566', '#664433', '#335533', '#553355', '#335555', '#555544', '#443344', '#666655', '#334466', '#554433'];

export function createVehicle(x, y, angle, color, isPolice = false) {
  return {
    x, y, angle, color,
    speed: 0,
    health: isPolice ? 150 : 100,
    maxHealth: isPolice ? 150 : 100,
    isPolice,
    width: CAR.width,
    height: CAR.height,
    occupied: false,
    driver: null,
    trafficDir: null,
    nextTurnTimer: 2 + Math.random() * 4,
    exploding: 0,
    destroyed: false,
  };
}

export function spawnTraffic(world, count) {
  const cars = [];
  const spawns = [...world.carSpawns];
  for (let i = spawns.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
  }
  for (let i = 0; i < count && i < spawns.length; i++) {
    const sp = spawns[i];
    const angle = Math.random() < 0.5 ? 0 : Math.PI / 2;
    const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
    const car = createVehicle(sp.x, sp.y, angle, color);
    car.speed = TRAFFIC.maxSpeed * 0.5;
    car.trafficDir = angle;
    cars.push(car);
  }
  return cars;
}

export function spawnPolice(world, x, y) {
  // Spawn at a road spawn near the target
  let bestSpawn = world.carSpawns[0];
  let bestD = Infinity;
  for (const sp of world.carSpawns) {
    const d = (sp.x - x) ** 2 + (sp.y - y) ** 2;
    if (d < bestD && d > 200 * 200) { bestD = d; bestSpawn = sp; }
  }
  const angle = Math.random() < 0.5 ? 0 : Math.PI / 2;
  const car = createVehicle(bestSpawn.x, bestSpawn.y, angle, PALETTE.carPolice, true);
  car.speed = 0;
  return car;
}

export function updateVehicle(car, dt, world, player, allCars) {
  if (car.destroyed) return;
  if (car.exploding > 0) {
    car.exploding -= dt;
    if (car.exploding <= 0) car.destroyed = true;
    return;
  }

  if (car.occupied) {
    // Player driving — handled in player.js
    return;
  }

  if (car.isPolice && player) {
    policeAI(car, dt, world, player, allCars);
  } else {
    trafficAI(car, dt, world, allCars);
  }
}

function trafficAI(car, dt, world, allCars) {
  // Follow road network
  car.nextTurnTimer -= dt;
  
  // Check ahead for obstacles
  const lookAhead = 60;
  const fx = car.x + Math.cos(car.angle) * lookAhead;
  const fy = car.y + Math.sin(car.angle) * lookAhead;
  
  let blocked = false;
  for (const other of allCars) {
    if (other === car || other.destroyed) continue;
    const dx = other.x - fx, dy = other.y - fy;
    if (dx * dx + dy * dy < 50 * 50) { blocked = true; break; }
  }

  if (!world.isRoad(fx, fy)) blocked = true;

  if (blocked) {
    car.speed = Math.max(0, car.speed - CAR.braking * dt);
    // Try to turn
    if (car.speed < 20) {
      car.nextTurnTimer = 0;
    }
  } else {
    car.speed = Math.min(TRAFFIC.maxSpeed, car.speed + CAR.acceleration * 0.5 * dt);
  }

  // Turn at intersections or when timer fires
  if (car.nextTurnTimer <= 0) {
    car.nextTurnTimer = 3 + Math.random() * 5;
    // Find nearby road
    const tx = Math.floor(car.x / world.tileSize);
    const ty = Math.floor(car.y / world.tileSize);
    const candidates = [];
    if (world.isRoad(car.x + world.tileSize, car.y)) candidates.push(0);
    if (world.isRoad(car.x - world.tileSize, car.y)) candidates.push(Math.PI);
    if (world.isRoad(car.x, car.y + world.tileSize)) candidates.push(Math.PI / 2);
    if (world.isRoad(car.x, car.y - world.tileSize)) candidates.push(-Math.PI / 2);
    if (candidates.length > 0) {
      car.angle = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  // Move
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Keep on road — snap to road center
  snapToRoad(car, world);
}

function snapToRoad(car, world) {
  const tw = world.tileSize;
  // Check which road direction we're on
  const onH = world.isRoad(car.x - tw, car.y) && world.isRoad(car.x + tw, car.y);
  const onV = world.isRoad(car.x, car.y - tw) && world.isRoad(car.x, car.y + tw);
  
  if (onH && !onV) {
    // Horizontal road — snap y to road center
    const roadY = Math.floor(car.y / tw) * tw + tw / 2;
    car.y += (roadY - car.y) * 0.1;
  } else if (onV && !onH) {
    const roadX = Math.floor(car.x / tw) * tw + tw / 2;
    car.x += (roadX - car.x) * 0.1;
  }
}

function policeAI(car, dt, world, player, allCars) {
  const targetX = player.inCar ? player.car.x : player.x;
  const targetY = player.inCar ? player.car.y : player.y;
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Steer toward target
  const targetAngle = Math.atan2(dy, dx);
  let angleDiff = targetAngle - car.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  car.angle += angleDiff * CAR.turnSpeed * dt;

  // Accelerate
  if (dist > 80) {
    car.speed = Math.min(350, car.speed + CAR.acceleration * dt);
  } else {
    car.speed = Math.max(0, car.speed - CAR.braking * dt);
  }

  // Move
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;

  // Only move if not into building
  if (!world.isSolid(nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Try sliding
    if (!world.isSolid(nx, car.y)) car.x = nx;
    else if (!world.isSolid(car.x, ny)) car.y = ny;
    else car.speed *= 0.5;
  }
}

export function damageVehicle(car, damage) {
  car.health -= damage;
  if (car.health <= 0 && car.exploding <= 0) {
    car.exploding = 0.5;
    car.health = 0;
  }
}

export function updatePlayerCar(car, input, dt, world, allCars) {
  const accel = (input.moveY() < 0 ? 1 : 0) - (input.moveY() > 0 ? 1 : 0);
  const turn = input.moveX();

  if (accel > 0) {
    car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.acceleration * dt);
  } else if (accel < 0) {
    if (car.speed > 0) car.speed = Math.max(0, car.speed - CAR.braking * dt);
    else car.speed = Math.max(-CAR.maxSpeed * 0.4, car.speed - CAR.acceleration * 0.7 * dt);
  } else {
    // Friction
    if (car.speed > 0) car.speed = Math.max(0, car.speed - CAR.friction * dt);
    else if (car.speed < 0) car.speed = Math.min(0, car.speed + CAR.friction * dt);
  }

  // Turn only when moving
  const turnFactor = Math.min(1, Math.abs(car.speed) / 80);
  car.angle += turn * CAR.turnSpeed * turnFactor * dt * (car.speed >= 0 ? 1 : -1);

  // Move with collision
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;

  if (!world.isSolid(nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    // Collision damage
    if (Math.abs(car.speed) > 100) {
      damageVehicle(car, Math.abs(car.speed) * 0.02);
    }
    car.speed *= -0.3;
  }

  // Collision with other cars
  for (const other of allCars) {
    if (other === car || other.destroyed) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 40) {
      const push = (40 - d) / 40;
      car.x -= dx / d * push * 2;
      car.y -= dy / d * push * 2;
      if (Math.abs(car.speed) > 150) {
        damageVehicle(other, 15);
        damageVehicle(car, 5);
      }
      car.speed *= 0.8;
    }
  }
}