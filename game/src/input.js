// Keyboard + mouse input. Tracks held keys, edge-triggered presses (consumed once
// per frame by the game loop), and the mouse position in arena coordinates.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
    this._onKeyDown = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(key)) this.pressed.add(key);
      this.keys.add(key);
    };
    this._onKeyUp = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(key);
    };
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouse.down = true;
      if (!this.pressed.has('mouse')) this.pressed.add('mouse');
    };
    this._onMouseUp = () => { this.mouse.down = false; };
    this._onBlur = () => { this.keys.clear(); this.mouse.down = false; };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }

  held(key) {
    return this.keys.has(key);
  }

  wasPressed(key) {
    return this.pressed.has(key);
  }

  // Movement vector from WASD or arrow keys, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
  }

  // For scripted shots/tests: pretend keys are held without a real keyboard.
  setKey(key, down) {
    if (down) { if (!this.keys.has(key)) this.pressed.add(key); this.keys.add(key); }
    else this.keys.delete(key);
  }

  setMouse(x, y, down) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.down = down;
  }
}
