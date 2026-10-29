/** Floating +/- score labels as DOM elements projected from world space. */
import * as THREE from 'three';
import type { Contribution } from '../core/types';

interface Label {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  key: string;
}

const fmt = (v: number): string => (v > 0 ? `+${v}` : `${v}`);
const cls = (v: number): string => (v > 0 ? 'plus' : v < 0 ? 'minus' : 'zero');

export class Labels {
  private root: HTMLDivElement;
  private preview = new Map<string, Label>();
  private total: Label | null = null;
  private bursts: Array<Label & { born: number }> = [];
  private v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    parent.appendChild(this.root);
  }

  private make(text: string, className: string, pos: THREE.Vector3, key: string): Label {
    const el = document.createElement('div');
    el.className = `label ${className}`;
    el.textContent = text;
    this.root.appendChild(el);
    return { el, pos: pos.clone(), key };
  }

  /**
   * Show the hover preview. Contributions anchored at the same spot are
   * merged. Labels that did not change keep their element (no re-pop).
   */
  setPreview(parts: Contribution[], total: number, anchor: THREE.Vector3, heightAt: (x: number, z: number) => number, valid: boolean): void {
    const merged = new Map<string, { value: number; x: number; z: number }>();
    for (const p of parts) {
      const k = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
      const m = merged.get(k);
      if (m) m.value += p.value;
      else merged.set(k, { value: p.value, x: p.x, z: p.z });
    }
    const next = new Map<string, Label>();
    for (const [k, m] of merged) {
      const key = `${k}:${m.value}`;
      const old = this.preview.get(key);
      if (old) {
        next.set(key, old);
        this.preview.delete(key);
      } else {
        next.set(key, this.make(fmt(m.value), `part ${cls(m.value)}`, new THREE.Vector3(m.x, heightAt(m.x, m.z) + 1.0, m.z), key));
      }
    }
    for (const l of this.preview.values()) l.el.remove();
    this.preview = next;

    const totalKey = `${total}:${valid}`;
    const text = valid ? fmt(total) : '✕';
    if (!this.total || this.total.key !== totalKey) {
      this.total?.el.remove();
      this.total = this.make(text, `total ${valid ? cls(total) : 'invalid'}`, anchor, totalKey);
    }
    this.total.pos.copy(anchor);
  }

  clearPreview(): void {
    for (const l of this.preview.values()) l.el.remove();
    this.preview.clear();
    this.total?.el.remove();
    this.total = null;
  }

  /** A label that rises and fades, e.g. the points just scored. */
  burst(value: number, pos: THREE.Vector3, text?: string): void {
    const l = this.make(text ?? fmt(value), `burst ${cls(value)}`, pos, '');
    this.bursts.push({ ...l, born: performance.now() });
  }

  update(camera: THREE.Camera, w: number, h: number): void {
    const place = (l: Label): void => {
      this.v.copy(l.pos).project(camera);
      if (this.v.z > 1 || this.v.z < -1) {
        l.el.style.display = 'none';
        return;
      }
      l.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    for (const l of this.preview.values()) place(l);
    if (this.total) place(this.total);
    const now = performance.now();
    this.bursts = this.bursts.filter((b) => {
      if (now - b.born > 1400) {
        b.el.remove();
        return false;
      }
      place(b);
      return true;
    });
  }
}
