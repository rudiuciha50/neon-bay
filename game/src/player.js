// Player character: on-foot movement, entering/exiting cars, health, weapons.
import { PLAYER, CAR, COMBAT, PALETTE } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    money: 0,
    ammo: COMBAT.pistolAmmo,
    maxAmmo: COMBAT.maxAmmo,
    hasWeapon: true,
    inCar: null,
    radius: PLAYER.radius,
    speed: PLAYER.speed,
    shootCooldown: 0,
    meleeCooldown: 0,
    reloading: 0,
    shooting: false,
    invulnerable: 0,
    walkCycle: 0,
    weapon: 'pistol', // pistol, melee
  };
}

export function updatePlayerOnFoot(player, input, dt, world, camera) {
  let mx = input.moveX();
  let my = input.moveY();
  const sprint = input.isSprint();
  const speed = sprint ? player.speed * PLAYER.sprintMult : player.speed;

  // Normalize diagonal
  if (mx !== 0 && my !== 0) { const inv = 0.7071; mx *= inv; my *= inv; }

  const nx = player.x + mx * speed * dt;
  const ny = player.y + my * speed * dt;

  if (!world.isSolid(nx, player.y)) player.x = nx;
  if (!world.isSolid(player.x, ny)) player.y = ny;

  // Walk cycle
  if (mx !== 0 || my !== 0) {
    player.walkCycle += dt * 10 * (sprint ? 1.5 : 1);
  }

  // Aim toward mouse
  const mouse = input.mouse();
  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;
  player.angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);

  // Cooldowns
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.meleeCooldown > 0) player.meleeCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      player.ammo = player.maxAmmo;
    }
  }

  player.shooting = false;
}

export function tryEnterCar(player, cars) {
  if (player.inCar) return null;
  for (const car of cars) {
    if (car.destroyed || car.exploding > 0) continue;
    const dx = car.x - player.x, dy = car.y - player.y;
    if (dx * dx + dy * dy < 50 * 50) {
      player.inCar = car;
      car.occupied = true;
      return car;
    }
  }
  return null;
}

export function exitCar(player) {
  if (!player.inCar) return;
  const car = player.inCar;
  car.occupied = false;
  car.speed *= 0.3;
  // Place player beside car
  const sideAngle = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(sideAngle) * 30;
  player.y = car.y + Math.sin(sideAngle) * 30;
  player.inCar = null;
}

export function damagePlayer(player, damage) {
  if (player.invulnerable > 0) return;
  if (player.inCar) {
    // Car absorbs some damage
    player.inCar.health -= damage * 0.5;
    damage *= 0.3;
  }
  player.health -= damage;
  player.invulnerable = 0.5;
  if (player.health <= 0) {
    player.health = 0;
  }
}

export function healPlayer(player, amount) {
  player.health = Math.min(player.maxHealth, player.health + amount);
}

export function isPlayerDead(player) {
  return player.health <= 0;
}

export function reload(player) {
  if (player.ammo < player.maxAmmo && player.reloading <= 0 && player.hasWeapon) {
    player.reloading = COMBAT.reloadTime;
  }
}

export function canShoot(player) {
  return player.hasWeapon && player.ammo > 0 && player.shootCooldown <= 0 && player.reloading <= 0;
}

export function onShoot(player) {
  player.ammo--;
  player.shootCooldown = COMBAT.pistolCooldown;
  player.shooting = true;
}