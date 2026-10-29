/** Orbit camera with clamped pitch, zoom, WASD / edge pan and Q/E rotate; all damped. */
import * as THREE from 'three';
import { CAMERA } from '../data/camera';
import type { Input } from '../input/input';

const DEG = Math.PI / 180;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private goalTarget = new THREE.Vector3();
  private yaw = CAMERA.startYawDeg * DEG;
  private goalYaw = this.yaw;
  private pitch = CAMERA.startPitchDeg * DEG;
  private goalPitch = this.pitch;
  private dist = 50;
  private goalDist = 50;
  private bounds = 30;
  edgePan = CAMERA.edgePan;
  enabled = true;

  constructor(aspect: number, private input: Input, private viewport: () => { w: number; h: number }) {
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.5, 600);
    input.onDrag(({ dx, dy }) => {
      if (!this.enabled) return;
      this.goalYaw -= dx * CAMERA.dragRotateSpeed;
      this.goalPitch = clampPitch(this.goalPitch + dy * CAMERA.dragRotateSpeed);
    });
    input.onWheel((dir) => {
      if (!this.enabled) return;
      this.goalDist = THREE.MathUtils.clamp(this.goalDist * Math.pow(CAMERA.zoomStep, dir), CAMERA.minDistance, CAMERA.maxDistance);
    });
  }

  /** Frame an island of the given half size. */
  frame(halfSize: number, instant = true): void {
    this.bounds = halfSize * 0.85;
    this.goalTarget.set(0, 1, 0);
    this.goalDist = THREE.MathUtils.clamp(halfSize * CAMERA.startDistanceFactor, CAMERA.minDistance, CAMERA.maxDistance);
    this.goalPitch = CAMERA.startPitchDeg * DEG;
    if (instant) {
      this.target.copy(this.goalTarget);
      this.dist = this.goalDist;
      this.pitch = this.goalPitch;
      this.yaw = this.goalYaw;
    }
    this.apply();
  }

  /** Snap all damped values to their goals (used by tests for stable projections). */
  settle(): void {
    this.target.copy(this.goalTarget);
    this.dist = this.goalDist;
    this.pitch = this.goalPitch;
    this.yaw = this.goalYaw;
    this.apply();
  }

  get isMoving(): boolean {
    return (
      this.target.distanceToSquared(this.goalTarget) > 1e-4 ||
      Math.abs(this.yaw - this.goalYaw) > 1e-4 ||
      Math.abs(this.pitch - this.goalPitch) > 1e-4 ||
      Math.abs(this.dist - this.goalDist) > 1e-3
    );
  }

  update(dt: number): void {
    if (this.enabled) {
      const i = this.input;
      let px = 0;
      let pz = 0;
      if (i.isHeld('panUp')) pz -= 1;
      if (i.isHeld('panDown')) pz += 1;
      if (i.isHeld('panLeft')) px -= 1;
      if (i.isHeld('panRight')) px += 1;
      if (this.edgePan && i.pointer.inside) {
        const { w, h } = this.viewport();
        const e = CAMERA.edgePanPx;
        if (i.pointer.x < e) px -= 1;
        if (i.pointer.x > w - e) px += 1;
        if (i.pointer.y < e) pz -= 1;
        if (i.pointer.y > h - e) pz += 1;
      }
      if (px || pz) {
        const speed = CAMERA.panSpeed * this.goalDist * dt;
        const sin = Math.sin(this.goalYaw);
        const cos = Math.cos(this.goalYaw);
        // Forward (screen up) is towards the target from the camera, on the ground.
        this.goalTarget.x += (px * cos + pz * sin) * speed * 0.6;
        this.goalTarget.z += (-px * sin + pz * cos) * speed * 0.6;
        const len = Math.hypot(this.goalTarget.x, this.goalTarget.z);
        if (len > this.bounds) this.goalTarget.multiplyScalar(this.bounds / len).setY(1);
      }
      if (i.isHeld('rotateLeft')) this.goalYaw += CAMERA.rotateSpeedKeys * dt;
      if (i.isHeld('rotateRight')) this.goalYaw -= CAMERA.rotateSpeedKeys * dt;
    }
    const k = 1 - Math.exp(-CAMERA.damping * dt);
    this.target.lerp(this.goalTarget, k);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    this.dist += (this.goalDist - this.dist) * k;
    this.apply();
  }

  private apply(): void {
    const c = this.camera;
    const horiz = Math.cos(this.pitch) * this.dist;
    c.position.set(
      this.target.x + Math.sin(this.yaw) * horiz,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * horiz,
    );
    c.lookAt(this.target);
    c.updateMatrixWorld();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}

function clampPitch(p: number): number {
  return THREE.MathUtils.clamp(p, CAMERA.minPitchDeg * DEG, CAMERA.maxPitchDeg * DEG);
}
