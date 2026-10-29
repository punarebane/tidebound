/** Turn IslandData into one flat-shaded, vertex-coloured terrain mesh. */
import * as THREE from 'three';
import { WORLD } from '../data/world';
import { palette } from '../data/palette';
import type { IslandData } from './islandGen';

export function bandColour(h: number, normalY: number): number {
  const b = WORLD.bands;
  if (h < 0) return palette.seabed;
  if (h < b.sandTop) return palette.sand;
  if (normalY < b.cliffNormalY) return palette.cliff;
  if (h < b.grassTop) return palette.grass;
  if (h < b.meadowTop) return palette.meadow;
  if (h < b.rockTop) return palette.rock;
  return palette.snow;
}

export function buildIslandMesh(d: IslandData): THREE.Mesh {
  const n = d.res;
  const w = n + 1;
  const tris = n * n * 2;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const c = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const e = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ae = new THREE.Vector3();
  let p = 0;
  const vx = (i: number): number => -d.halfSize + i * d.cell;
  const H = (i: number, j: number): number => d.heights[j * w + i];

  const pushTri = (i0: number, j0: number, i1: number, j1: number, i2: number, j2: number): void => {
    a.set(vx(i0), H(i0, j0), vx(j0));
    b.set(vx(i1), H(i1, j1), vx(j1));
    e.set(vx(i2), H(i2, j2), vx(j2));
    ab.subVectors(b, a);
    ae.subVectors(e, a);
    const nrm = ab.cross(ae).normalize();
    const ny = Math.abs(nrm.y);
    // Colour by the highest corner so terrace lips read crisply.
    const h = Math.max(a.y, b.y, e.y) * 0.5 + (a.y + b.y + e.y) / 6;
    c.setHex(bandColour(h, ny));
    // Tiny deterministic shade jitter breaks up big flat areas.
    const jit = 1 + (((i0 * 73856093) ^ (j0 * 19349663)) % 7) * 0.006 - 0.018;
    for (const v of [a, b, e]) {
      pos[p] = v.x; pos[p + 1] = v.y; pos[p + 2] = v.z;
      col[p] = c.r * jit; col[p + 1] = c.g * jit; col[p + 2] = c.b * jit;
      p += 3;
    }
  };

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Matches Terrain.heightAt: diagonal from (i,j) to (i+1,j+1).
      pushTri(i, j, i + 1, j + 1, i + 1, j);
      pushTri(i, j, i, j + 1, i + 1, j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Heights packed into an 8-bit texture for the water shader's depth/foam. */
export function buildHeightTexture(d: IslandData): { tex: THREE.DataTexture; min: number; range: number } {
  const w = d.res + 1;
  const min = -5;
  const range = 16;
  const data = new Uint8Array(w * w);
  for (let k = 0; k < data.length; k++) data[k] = Math.round(Math.min(Math.max((d.heights[k] - min) / range, 0), 1) * 255);
  const tex = new THREE.DataTexture(data, w, w, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, min, range };
}
