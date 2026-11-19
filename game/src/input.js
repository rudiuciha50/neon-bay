// Keyboard and mouse input handling.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_SHOOT = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MELEE = 32;
export const ACTION_NEXT_WEAPON = 64;
export const ACTION_SPRINT = 128;
export const ACTION_INTERACT = 256;

const CONFIRM_KEYS = new Set(['Space', 'Enter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const SHOOT_KEYS = new Set(['MouseLeft']);

export function createInput(canvas) {
  const keys = {};
  let mouseX = 0, mouseY = 0;
  let mouseDown = false;
  let actions = 0;

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!e.repeat) {
      if (CONFIRM_KEYS.has(e.code)) actions |= ACTION_CONFIRM;
      else if (PAUSE_KEYS.has(e.code)) actions |= ACTION_PAUSE;
      else if (e.code === 'KeyE') actions |= ACTION_ENTER_CAR;
      else if (e.code === 'KeyR') actions |= ACTION_RELOAD;
      else if (e.code === 'KeyQ') actions |= ACTION_MELEE;
      else if (e.code === 'Digit1' || e.code === 'Digit2') actions |= ACTION_NEXT_WEAPON;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });

  canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; actions |= ACTION_SHOOT; }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });

  return {
    moveX() {
      return (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    },
    moveY() {
      return (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
    },
    isSprint() { return !!keys['ShiftLeft'] || !!keys['ShiftRight']; },
    isShoot() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}