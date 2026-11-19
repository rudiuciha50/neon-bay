// Game configuration constants.
export const FIELD = { width: 1920, height: 1080 };

export const WORLD = {
  tileSize: 64,
  mapWidth: 60,
  mapHeight: 60,
  roadWidth: 4,  // in tiles
  blockMin: 2,
  blockMax: 5,
};

export const PLAYER = {
  speed: 220,
  sprintMult: 1.5,
  health: 100,
  maxHealth: 100,
  radius: 14,
};

export const CAR = {
  maxSpeed: 420,
  acceleration: 300,
  braking: 500,
  friction: 100,
  turnSpeed: 2.8,
  width: 36,
  height: 64,
  health: 100,
};

export const TRAFFIC = {
  count: 20,
  maxSpeed: 180,
};

export const PEDESTRIAN = {
  count: 40,
  speed: 80,
  radius: 10,
};

export const POLICE = {
  speed: 280,
  maxSpeed: 350,
  aggression: 1.0,
  spawnDistance: 500,
  chaseDistance: 1200,
  giveUpDistance: 1500,
};

export const COMBAT = {
  pistolDamage: 30,
  pistolRange: 400,
  pistolCooldown: 0.35,
  pistolAmmo: 12,
  maxAmmo: 12,
  reloadTime: 1.5,
  meleeDamage: 20,
  meleeRange: 40,
  meleeCooldown: 0.4,
  bulletSpeed: 800,
  bulletRadius: 4,
};

export const WANTED = {
  stealCarStars: 1,
  hitPedestrianStars: 1,
  killPedestrianStars: 2,
  killPoliceStars: 1,
  shootStars: 1,
  policePerStar: 2,
  cooldownTime: 30,
};

export const MISSIONS = {
  totalMissions: 5,
  markerRadius: 20,
};

export const PALETTE = {
  backdrop: '#0a0a14',
  sky: '#1a1a2e',
  road: '#2a2a38',
  roadLine: '#e0c060',
  sidewalk: '#3a3a4a',
  building: '#1e1e30',
  buildingDark: '#161626',
  buildingLit: '#3a3a52',
  window: '#4a6a9a',
  windowLit: '#ddaa44',
  grass: '#1a3a1a',
  water: '#0a2a4a',
  player: '#44cc88',
  playerClothes: '#336699',
  carPlayer: '#dd5533',
  carTraffic: '#556677',
  carPolice: '#113355',
  npc: '#998866',
  npcClothes: '#775544',
  police: '#224488',
  bullet: '#ffcc00',
  muzzle: '#ffaa00',
  blood: '#cc3333',
  hudHealth: '#44cc44',
  hudHealthLow: '#cc4444',
  hudWanted: '#ffaa00',
  hudText: '#eef1f5',
  hudBg: 'rgba(0,0,0,0.65)',
  minimapBg: 'rgba(10,10,20,0.85)',
  minimapBorder: '#334',
  minimapPlayer: '#4f8',
  minimapPolice: '#48f',
  minimapMission: '#fc0',
  minimapTraffic: '#aaa',
  menuBg: 'rgba(10,10,30,0.92)',
  menuText: '#eef1f5',
  menuHighlight: '#fc0',
  particleSmoke: '#444',
  particleSparks: '#fa0',
  particleBlood: '#c33',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'neon-bay.save';

export const STEP = 1 / 60;