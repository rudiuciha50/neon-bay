// Mission system and story for Neon Bay.
import { PALETTE } from './config.js';

const MISSION_DATA = [
  {
    id: 0,
    title: "First Blood",
    briefing: "Welcome to Neon Bay. Head to the marker to meet your contact, Dex.",
    objectives: [
      { type: 'goto', x: 1500, y: 1500, radius: 60, desc: 'Meet Dex at the docks' },
    ],
    reward: 500,
    nextId: 1,
  },
  {
    id: 1,
    title: "Hot Wheels",
    briefing: "Dex needs a car. Steal one from the parking lot and bring it to the garage.",
    objectives: [
      { type: 'stealCar', desc: 'Steal a car' },
      { type: 'goto', x: 2400, y: 800, radius: 80, desc: 'Drive to the garage' },
    ],
    reward: 1000,
    nextId: 2,
  },
  {
    id: 2,
    title: "Package Run",
    briefing: "Pick up a package from the warehouse and deliver it to the club. Watch for rivals.",
    objectives: [
      { type: 'goto', x: 3200, y: 2400, radius: 60, desc: 'Pick up the package' },
      { type: 'goto', x: 800, y: 2800, radius: 60, desc: 'Deliver to the club' },
    ],
    reward: 1500,
    nextId: 3,
  },
  {
    id: 3,
    title: "Settling Scores",
    briefing: "A rival crew is moving in. Take out their leader before he reaches safe ground.",
    objectives: [
      { type: 'goto', x: 3600, y: 1200, radius: 80, desc: 'Find the rival leader' },
      { type: 'eliminate', x: 3600, y: 1200, radius: 300, desc: 'Eliminate the target', target: null },
      { type: 'escape', radius: 400, desc: 'Lose the cops' },
    ],
    reward: 2500,
    nextId: 4,
  },
  {
    id: 4,
    title: "The Big Score",
    briefing: "Time to hit the casino vault. Get in, grab the cash, and escape the city limits.",
    objectives: [
      { type: 'goto', x: 2800, y: 3400, radius: 80, desc: 'Reach the casino' },
      { type: 'survive', duration: 30, desc: 'Hold off the cops for 30 seconds' },
      { type: 'escape', radius: 500, desc: 'Escape to the hideout' },
    ],
    reward: 5000,
    nextId: -1,
  },
];

export function createMissionSystem() {
  return {
    currentMission: null,
    objectiveIndex: 0,
    completedMissions: [],
    missionActive: false,
    missionTimer: 0,
    targetEntity: null,
    storyIntro: "You are MAX RIVERS, fresh out of prison and back in Neon Bay. The city has changed. Old friends are gone, new powers have risen, and everyone wants a piece of you. It's time to take it back, one job at a time.",
  };
}

export function startMission(state, missionId) {
  const data = MISSION_DATA.find(m => m.id === missionId);
  if (!data) return null;
  state.currentMission = JSON.parse(JSON.stringify(data));
  state.objectiveIndex = 0;
  state.missionActive = true;
  state.missionTimer = 0;
  return data;
}

export function getCurrentObjective(state) {
  if (!state.currentMission || !state.missionActive) return null;
  return state.currentMission.objectives[state.objectiveIndex];
}

export function updateMissions(state, dt, player, world) {
  if (!state.missionActive || !state.currentMission) return null;
  const obj = getCurrentObjective(state);
  if (!obj) return null;

  state.missionTimer += dt;
  let result = null;

  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;

  switch (obj.type) {
    case 'goto': {
      const dx = obj.x - px, dy = obj.y - py;
      if (dx * dx + dy * dy < obj.radius * obj.radius) {
        result = 'objectiveComplete';
      }
      break;
    }
    case 'stealCar': {
      if (player.inCar) result = 'objectiveComplete';
      break;
    }
    case 'eliminate': {
      if (!state.targetEntity || !state.targetEntity.alive) {
        result = 'objectiveComplete';
      }
      break;
    }
    case 'survive': {
      if (state.missionTimer >= obj.duration) {
        result = 'objectiveComplete';
      }
      break;
    }
    case 'escape': {
      if (state.wantedLevel === 0) {
        result = 'objectiveComplete';
      }
      break;
    }
  }

  if (result === 'objectiveComplete') {
    state.objectiveIndex++;
    state.missionTimer = 0;
    if (state.objectiveIndex >= state.currentMission.objectives.length) {
      // Mission complete
      state.completedMissions.push(state.currentMission.id);
      state.money += state.currentMission.reward;
      const completed = state.currentMission;
      state.currentMission = null;
      state.missionActive = false;
      return { type: 'missionComplete', mission: completed };
    }
    return { type: 'objectiveComplete', mission: state.currentMission };
  }

  return null;
}

export function getAvailableMission(state) {
  if (state.missionActive) return null;
  if (state.completedMissions.length === 0) return MISSION_DATA[0];
  const lastId = state.completedMissions[state.completedMissions.length - 1];
  const lastMission = MISSION_DATA.find(m => m.id === lastId);
  if (lastMission && lastMission.nextId >= 0) {
    return MISSION_DATA.find(m => m.id === lastMission.nextId);
  }
  return null;
}

export function getMissionStartMarker(state) {
  const mission = getAvailableMission(state);
  if (!mission) return null;
  const firstObj = mission.objectives[0];
  if (firstObj.type === 'goto') return { x: firstObj.x, y: firstObj.y, radius: firstObj.radius };
  // Default start marker
  return { x: 1500, y: 1500, radius: 60 };
}

export function getMissionCount() {
  return MISSION_DATA.length;
}

export function getMissionById(id) {
  return MISSION_DATA.find(m => m.id === id);
}