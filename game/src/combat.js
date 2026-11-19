// Combat: shooting, melee, bullets, health system.
import { COMBAT, PALETTE } from './config.js';

export function createBullets() {
  return [];
}

export function fireBullet(bullets, x, y, angle, isPlayer = true) {
  bullets.push({
    x, y,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: 1.0,
    isPlayer,
    damage: COMBAT.pistolDamage,
  });
}

export function updateBullets(bullets, dt, world, entities) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    // Check wall collision
    if (world.isSolid(b.x, b.y) || b.life <= 0) {
      hits.push({ x: b.x, y: b.y, type: 'wall' });
      bullets.splice(i, 1);
      continue;
    }

    // Check entity collisions
    if (b.isPlayer) {
      // Player bullets hit NPCs, peds, cars
      for (const e of entities) {
        if (!e.alive && e.health !== undefined) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const r = e.radius || 14;
        if (dx * dx + dy * dy < r * r) {
          e.health -= b.damage;
          if (e.health <= 0 && e.alive !== undefined) e.alive = false;
          hits.push({ x: b.x, y: b.y, type: 'hit', entity: e });
          bullets.splice(i, 1);
          break;
        }
      }
    } else {
      // Enemy bullets hit player
      if (entities.player) {
        const p = entities.player;
        const px = p.inCar ? p.car.x : p.x;
        const py = p.inCar ? p.car.y : p.y;
        const dx = px - b.x, dy = py - b.y;
        const r = p.inCar ? 30 : 16;
        if (dx * dx + dy * dy < r * r) {
          hits.push({ x: b.x, y: b.y, type: 'playerHit', damage: b.damage });
          bullets.splice(i, 1);
        }
      }
    }
  }
  return hits;
}

export function createParticles() {
  return [];
}

export function spawnMuzzleFlash(particles, x, y, angle) {
  for (let i = 0; i < 5; i++) {
    const a = angle + (Math.random() - 0.5) * 0.5;
    const sp = 50 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.15, maxLife: 0.15,
      color: PALETTE.muzzle,
      size: 3 + Math.random() * 3,
      type: 'spark',
    });
  }
}

export function spawnBlood(particles, x, y) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
      color: PALETTE.blood,
      size: 2 + Math.random() * 4,
      type: 'blood',
    });
  }
}

export function spawnExplosion(particles, x, y) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 200;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
      color: Math.random() < 0.5 ? PALETTE.particleSparks : '#f60',
      size: 3 + Math.random() * 6,
      type: 'explosion',
    });
  }
  for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 20 + Math.random() * 60;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
      life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
      color: PALETTE.particleSmoke,
      size: 8 + Math.random() * 12,
      type: 'smoke',
    });
  }
}

export function spawnSpark(particles, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 80;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.2, maxLife: 0.2,
      color: PALETTE.particleSparks,
      size: 2 + Math.random() * 2,
      type: 'spark',
    });
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.type === 'smoke') p.vy -= 15 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}