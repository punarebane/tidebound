/** Fish shoals: soft rings bobbing on the water surface. */
import * as THREE from 'three';
import { palette } from '../data/palette';
import type { Point } from './islandGen';

export class Shoals {
  readonly mesh: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();

  constructor(private points: Point[]) {
    const geo = new THREE.RingGeometry(0.45, 0.75, 20).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: palette.shoal, transparent: true, opacity: 0.7, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(points.length, 1));
    this.mesh.count = points.length;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'shoals';
  }

  update(time: number, seaLevel: number): void {
    this.points.forEach((pt, i) => {
      const ph = pt.id * 1.37;
      const sc = 1 + 0.25 * Math.sin(time * 1.6 + ph);
      this.p.set(pt.x, seaLevel + 0.08, pt.z);
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, time * 0.3 + ph);
      this.s.set(sc, 1, sc);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
