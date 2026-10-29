/**
 * Input abstraction: raw keyboard/mouse events become named actions and a
 * pointer state, so a touch layer could feed the same interface later.
 */

export type Action = 'panUp' | 'panDown' | 'panLeft' | 'panRight' | 'rotateLeft' | 'rotateRight' | 'rotateBuilding' | 'cancel' | 'photo' | 'mute' | 'hideHint';

const BINDINGS: Record<string, Action> = {
  KeyW: 'panUp',
  ArrowUp: 'panUp',
  KeyS: 'panDown',
  ArrowDown: 'panDown',
  KeyA: 'panLeft',
  ArrowLeft: 'panLeft',
  KeyD: 'panRight',
  ArrowRight: 'panRight',
  KeyQ: 'rotateLeft',
  KeyE: 'rotateRight',
  KeyR: 'rotateBuilding',
  Escape: 'cancel',
  KeyP: 'photo',
  KeyM: 'mute',
  KeyH: 'hideHint',
};

export interface PointerState {
  x: number;
  y: number;
  inside: boolean;
}

type Handler<T> = (arg: T) => void;

export class Input {
  readonly pointer: PointerState = { x: 0, y: 0, inside: false };
  private held = new Set<Action>();
  private pressHandlers: Array<Handler<Action>> = [];
  private digitHandlers: Array<Handler<number>> = [];
  private clickHandlers: Array<Handler<PointerState>> = [];
  private moveHandlers: Array<Handler<PointerState>> = [];
  private dragHandlers: Array<Handler<{ dx: number; dy: number }>> = [];
  private wheelHandlers: Array<Handler<number>> = [];
  private dragging = false;
  private downAt: { x: number; y: number; button: number } | null = null;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.held.clear());
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', () => { this.pointer.inside = false; });
    el.addEventListener('wheel', this.handleWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isHeld(a: Action): boolean {
    return this.held.has(a);
  }

  onPress(h: Handler<Action>): void { this.pressHandlers.push(h); }
  onDigit(h: Handler<number>): void { this.digitHandlers.push(h); }
  onClick(h: Handler<PointerState>): void { this.clickHandlers.push(h); }
  onPointerMove(h: Handler<PointerState>): void { this.moveHandlers.push(h); }
  onDrag(h: Handler<{ dx: number; dy: number }>): void { this.dragHandlers.push(h); }
  onWheel(h: Handler<number>): void { this.wheelHandlers.push(h); }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    const a = BINDINGS[e.code];
    if (a) {
      if (!this.held.has(a)) this.pressHandlers.forEach((h) => h(a));
      this.held.add(a);
    }
    const m = /^Digit([0-9])$/.exec(e.code);
    if (m) this.digitHandlers.forEach((h) => h(Number(m[1]) || 10));
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const a = BINDINGS[e.code];
    if (a) this.held.delete(a);
  };

  private setPointer(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    this.pointer.x = e.clientX - r.left;
    this.pointer.y = e.clientY - r.top;
    this.pointer.inside = true;
  }

  private onMove = (e: PointerEvent): void => {
    const lastX = this.pointer.x;
    const lastY = this.pointer.y;
    this.setPointer(e);
    if (this.downAt && (this.downAt.button === 2 || this.downAt.button === 1)) {
      this.dragging = true;
      const d = { dx: this.pointer.x - lastX, dy: this.pointer.y - lastY };
      this.dragHandlers.forEach((h) => h(d));
    }
    this.moveHandlers.forEach((h) => h(this.pointer));
  };

  private onDown = (e: PointerEvent): void => {
    this.setPointer(e);
    this.downAt = { x: this.pointer.x, y: this.pointer.y, button: e.button };
    this.dragging = false;
  };

  private onUp = (e: PointerEvent): void => {
    const d = this.downAt;
    this.downAt = null;
    if (!d || this.dragging || e.button !== 0 || d.button !== 0) return;
    if (e.target !== this.el) return;
    this.setPointer(e);
    if (Math.hypot(this.pointer.x - d.x, this.pointer.y - d.y) > 6) return;
    this.clickHandlers.forEach((h) => h(this.pointer));
  };

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const dir = Math.sign(e.deltaY);
    this.wheelHandlers.forEach((h) => h(dir));
  };
}
