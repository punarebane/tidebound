/** The translucent building that follows the cursor, plus its influence ring. */
import * as THREE from 'three';
import { buildingDef, type BuildingId } from '../data/buildings';
import { palette } from '../data/palette';
import type { Terrain } from '../world/terrain';
import { buildingGeometry } from './buildingShapes';

const RING_POINTS = 72;

export class Ghost {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat = new THREE.MeshStandardMaterial({ color: palette.ghostValid, transparent: true, opacity: 0.6, flatShading: true, depthWrite: false });
  private ring: THREE.LineLoop;
  private footRing: THREE.LineLoop;
  private type: BuildingId | null = null;
  rot = 0;

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = 3;
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_POINTS * 3), 3));
    const ringMat = new THREE.LineBasicMaterial({ color: palette.influenceRing, transparent: true, opacity: 0.75, depthTest: false });
    this.ring = new THREE.LineLoop(ringGeo, ringMat);
    this.ring.renderOrder = 4;
    this.ring.frustumCulled = false;
    const footGeo = new THREE.BufferGeometry();
    footGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_POINTS * 3), 3));
    this.footRing = new THREE.LineLoop(footGeo, new THREE.LineBasicMaterial({ color: palette.ghostValid, transparent: true, opacity: 0.9, depthTest: false }));
    this.footRing.renderOrder = 4;
    this.footRing.frustumCulled = false;
    this.group.add(this.mesh, this.ring, this.footRing);
    this.group.visible = false;
  }

  setType(type: BuildingId | null): void {
    this.type = type;
    if (type) this.mesh.geometry = buildingGeometry(type);
    this.group.visible = false;
  }

  hide(): void {
    this.group.visible = false;
  }

  show(terrain: Terrain, seaLevel: number, x: number, z: number, valid: boolean, rot = this.rot): void {
    if (!this.type) return;
    const def = buildingDef(this.type);
    const y = Math.max(terrain.heightAt(x, z), seaLevel);
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = rot;
    const col = valid ? palette.ghostValid : palette.ghostInvalid;
    this.mat.color.setHex(col);
    (this.footRing.material as THREE.LineBasicMaterial).color.setHex(col);
    this.drapeRing(this.ring, terrain, seaLevel, x, z, def.influence);
    this.drapeRing(this.footRing, terrain, seaLevel, x, z, def.footprint);
    this.group.visible = true;
  }

  private drapeRing(line: THREE.LineLoop, t: Terrain, sea: number, x: number, z: number, r: number): void {
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < RING_POINTS; i++) {
      const a = (i / RING_POINTS) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      attr.setXYZ(i, px, Math.max(t.heightAt(px, pz), sea) + 0.08, pz);
    }
    attr.needsUpdate = true;
  }
}
