// localStorage save/load system.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      x: state.x, y: state.y,
      health: state.health,
      money: state.money,
      ammo: state.ammo,
      missionIndex: state.missionIndex,
      wantedLevel: state.wantedLevel,
      completedMissions: state.completedMissions,
      maxHealth: state.maxHealth,
      hasWeapon: state.hasWeapon,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function deleteSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch {}
}