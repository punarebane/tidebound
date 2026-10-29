/** Instanced trees and rocks. */
import * as THREE from 'three';
import { palette } from '../data/palette';
import type { IslandData, Prop } from './islandGen';
import type { Terrain } from './terrain';

export class Props {
  readonly group = new THREE.Group();
  private trunks: THREE.InstancedMesh;
  private leaves: THREE.InstancedMesh;
  private rocks: THREE.InstancedMesh;
  private treeIndex = new Map<number, number>();
  private treeList: Prop[];

  constructor(d: IslandData, terrain: Terrain, removed: Iterable<number> = []) {
    this.treeList = d.trees;
    const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5).translate(0, 0.3, 0);
    const leafGeo = new THREE.ConeGeometry(0.5, 1.3, 6).translate(0, 1.1, 0);
    const rockGeo = new THREE.DodecahedronGeometry(0.55, 0).translate(0, 0.15, 0);
    const flat = (color: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
    this.trunks = new THREE.InstancedMesh(trunkGeo, flat(palette.treeTrunk), Math.max(d.trees.length, 1));
    this.leaves = new THREE.InstancedMesh(leafGeo, flat(0xffffff), Math.max(d.trees.length, 1));
    this.rocks = new THREE.InstancedMesh(rockGeo, flat(0xffffff), Math.max(d.rocks.length, 1));
    for (const m of [this.trunks, this.leaves, this.rocks]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.trunks.name = 'tree-trunks';
    this.leaves.name = 'tree-leaves';
    this.rocks.name = 'rocks';

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    d.trees.forEach((t, i) => {
      this.treeIndex.set(t.id, i);
      p.set(t.x, terrain.heightAt(t.x, t.z) - 0.05, t.z);
      q.setFromAxisAngle(up, t.rot);
      s.setScalar(t.scale);
      m4.compose(p, q, s);
      this.trunks.setMatrixAt(i, m4);
      this.leaves.setMatrixAt(i, m4);
      c.setHex(t.variant ? palette.treeLeafAlt : palette.treeLeaf);
      this.leaves.setColorAt(i, c);
    });
    this.trunks.count = d.trees.length;
    this.leaves.count = d.trees.length;
    d.rocks.forEach((r, i) => {
      p.set(r.x, terrain.heightAt(r.x, r.z) - 0.1, r.z);
      q.setFromEuler(new THREE.Euler(r.variant * 0.4, r.rot, r.variant * 0.2));
      s.set(r.scale, r.scale * 0.7, r.scale);
      m4.compose(p, q, s);
      this.rocks.setMatrixAt(i, m4);
      c.setHex(palette.rockProp).multiplyScalar(0.92 + r.variant * 0.05);
      this.rocks.setColorAt(i, c);
    });
    this.rocks.count = d.rocks.length;
    for (const id of removed) this.removeTree(id);
  }

  removeTree(id: number): void {
    const i = this.treeIndex.get(id);
    if (i === undefined) return;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.trunks.setMatrixAt(i, zero);
    this.leaves.setMatrixAt(i, zero);
    this.trunks.instanceMatrix.needsUpdate = true;
    this.leaves.instanceMatrix.needsUpdate = true;
  }

  treeById(id: number): Prop | undefined {
    const i = this.treeIndex.get(id);
    return i === undefined ? undefined : this.treeList[i];
  }

  dispose(): void {
    for (const m of [this.trunks, this.leaves, this.rocks]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
  }
}
