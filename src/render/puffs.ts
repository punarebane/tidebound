/** Little particle bursts: dust when a building lands, spray when one sinks. */
import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  color: THREE.Color;
}

const CAPACITY = 256;
const GRAVITY = -3.5;

export class Puffs {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private seed = 1;

  constructor() {
    const geo = new THREE.IcosahedronGeometry(0.16, 0);
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'puffs';
  }

  /** Deterministic-enough jitter without touching game RNG. */
  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  burst(at: THREE.Vector3, color: number, count = 12, speed = 1.6, up = 1.2): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count && this.parts.length < CAPACITY; i++) {
      const a = (i / count) * Math.PI * 2 + this.rnd() * 0.5;
      const sp = speed * (0.6 + this.rnd() * 0.6);
      this.parts.push({
        pos: at.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3)),
        vel: new THREE.Vector3(Math.cos(a) * sp, up * (0.5 + this.rnd()), Math.sin(a) * sp),
        age: 0,
        life: 0.55 + this.rnd() * 0.35,
        size: 0.7 + this.rnd() * 0.8,
        color: c,
      });
    }
  }

  update(dt: number): void {
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    let i = 0;
    for (const p of this.parts) {
      p.vel.y += GRAVITY * dt;
      p.vel.multiplyScalar(Math.exp(-2.5 * dt));
      p.pos.addScaledVector(p.vel, dt);
      const k = p.age / p.life;
      const sc = p.size * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8);
      this.s.setScalar(Math.max(sc, 0.001));
      this.m4.compose(p.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
      this.mesh.setColorAt(i, p.color);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  get active(): number {
    return this.parts.length;
  }
}
