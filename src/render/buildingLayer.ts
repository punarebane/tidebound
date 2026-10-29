/** All placed buildings: one InstancedMesh per type, plus a pop-in animation. */
import * as THREE from 'three';
import { BUILDING_IDS, type BuildingId } from '../data/buildings';
import type { PlacedBuilding } from '../core/types';
import { buildingGeometry } from './buildingShapes';

interface Slot {
  type: BuildingId;
  index: number;
  pos: THREE.Vector3;
  rot: number;
  age: number;
}

const POP_SECONDS = 0.45;

/** Ease-out-back for a soft overshoot. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class BuildingLayer {
  readonly group = new THREE.Group();
  private meshes = new Map<BuildingId, THREE.InstancedMesh>();
  private slots = new Map<number, Slot>();
  private byIndex = new Map<BuildingId, number[]>();
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(capacity = 256) {
    for (const id of BUILDING_IDS) this.makeMesh(id, capacity);
  }

  private makeMesh(id: BuildingId, cap: number): THREE.InstancedMesh {
    const old = this.meshes.get(id);
    const m = new THREE.InstancedMesh(buildingGeometry(id), this.material, cap);
    m.name = `buildings-${id}`;
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    if (old) {
      for (let i = 0; i < old.count; i++) {
        old.getMatrixAt(i, this.m4);
        m.setMatrixAt(i, this.m4);
      }
      m.count = old.count;
      this.group.remove(old);
      old.dispose();
    }
    this.meshes.set(id, m);
    this.group.add(m);
    if (!this.byIndex.has(id)) this.byIndex.set(id, []);
    return m;
  }

  add(b: PlacedBuilding, y: number, animate = true): void {
    let mesh = this.meshes.get(b.type)!;
    if (mesh.count >= mesh.instanceMatrix.count) mesh = this.makeMesh(b.type, mesh.instanceMatrix.count * 2);
    const index = mesh.count++;
    const slot: Slot = { type: b.type, index, pos: new THREE.Vector3(b.x, y, b.z), rot: b.rot, age: animate ? 0 : POP_SECONDS };
    this.slots.set(b.id, slot);
    this.byIndex.get(b.type)![index] = b.id;
    this.write(slot);
  }

  remove(id: number): void {
    const slot = this.slots.get(id);
    if (!slot) return;
    const mesh = this.meshes.get(slot.type)!;
    const list = this.byIndex.get(slot.type)!;
    const last = mesh.count - 1;
    if (slot.index !== last) {
      // Move the last instance into the freed slot.
      mesh.getMatrixAt(last, this.m4);
      mesh.setMatrixAt(slot.index, this.m4);
      const movedId = list[last];
      list[slot.index] = movedId;
      this.slots.get(movedId)!.index = slot.index;
    }
    list.length = last;
    mesh.count = last;
    mesh.instanceMatrix.needsUpdate = true;
    this.slots.delete(id);
  }

  clear(): void {
    for (const m of this.meshes.values()) m.count = 0;
    for (const l of this.byIndex.values()) l.length = 0;
    this.slots.clear();
  }

  get count(): number {
    return this.slots.size;
  }

  private write(slot: Slot): void {
    const t = Math.min(slot.age / POP_SECONDS, 1);
    const sc = Math.max(easeOutBack(t), 0.001);
    this.q.setFromAxisAngle(this.up, slot.rot);
    this.s.set(sc, sc, sc);
    this.m4.compose(slot.pos, this.q, this.s);
    const mesh = this.meshes.get(slot.type)!;
    mesh.setMatrixAt(slot.index, this.m4);
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    for (const slot of this.slots.values()) {
      if (slot.age >= POP_SECONDS) continue;
      slot.age += dt;
      this.write(slot);
    }
  }
}
