/**
 * Buildings as composed primitives, merged into one vertex-coloured geometry
 * per type so each type is a single instanced draw call.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../data/palette';
import type { BuildingId } from '../data/buildings';

type Col = keyof typeof palette.building;

interface Part {
  shape: 'box' | 'pyramid' | 'cyl' | 'cone' | 'gable';
  /** box/gable: [w, h, d]; cyl/cone/pyramid: [radius, height, radiusTop?] */
  size: [number, number, number?];
  at: [number, number, number];
  color: Col;
  rot?: [number, number, number];
  segments?: number;
}

const P = (shape: Part['shape'], size: Part['size'], at: Part['at'], color: Col, rot?: Part['rot'], segments?: number): Part => ({ shape, size, at, color, rot, segments });

/** Triangular prism roof: ridge along x. */
function gable(w: number, h: number, d: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

const SHAPES: Record<BuildingId, Part[]> = {
  house: [
    P('box', [0.9, 0.6, 0.75], [0, 0.3, 0], 'wall'),
    P('gable', [1.05, 0.45, 0.95], [0, 0.6, 0], 'roofRed'),
    P('box', [0.14, 0.3, 0.14], [0.25, 0.85, 0.15], 'stone'),
    P('box', [0.18, 0.3, 0.02], [0, 0.15, 0.38], 'woodDark'),
  ],
  fisher: [
    P('box', [0.8, 0.5, 0.7], [0, 0.25, 0], 'wallWarm'),
    P('gable', [0.95, 0.38, 0.85], [0, 0.5, 0], 'roofBlue'),
    P('cyl', [0.05, 1.3], [0.55, 0.65, 0.35], 'wood'),
    P('box', [0.5, 0.12, 0.22], [-0.2, 0.06, 0.55], 'wood'),
    P('box', [0.3, 0.04, 0.3], [0.55, 1.15, 0.35], 'accent'),
  ],
  lumber: [
    P('box', [0.7, 0.45, 0.6], [-0.15, 0.225, -0.1], 'wood'),
    P('pyramid', [0.62, 0.4], [-0.15, 0.65, -0.1], 'roofGreen', [0, Math.PI / 4, 0], 4),
    P('cyl', [0.09, 0.8], [0.35, 0.09, 0.3], 'woodDark', [0, 0, Math.PI / 2]),
    P('cyl', [0.09, 0.8], [0.35, 0.09, 0.48], 'woodDark', [0, 0, Math.PI / 2]),
    P('cyl', [0.09, 0.8], [0.35, 0.24, 0.39], 'wood', [0, 0, Math.PI / 2]),
  ],
  sawmill: [
    P('box', [1.3, 0.75, 0.9], [0, 0.375, 0], 'wallWarm'),
    P('gable', [1.45, 0.5, 1.1], [0, 0.75, 0], 'roofPlum'),
    P('cyl', [0.42, 0.12], [0, 0.45, 0.52], 'wood', [Math.PI / 2, 0, 0], 10),
    P('box', [0.5, 0.18, 0.3], [0.45, 0.09, -0.62], 'woodDark'),
  ],
};

function partGeometry(p: Part): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  switch (p.shape) {
    case 'box':
      g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2] ?? p.size[0]);
      break;
    case 'gable':
      g = gable(p.size[0], p.size[1], p.size[2] ?? p.size[0]);
      break;
    case 'pyramid':
      g = new THREE.ConeGeometry(p.size[0], p.size[1], p.segments ?? 4);
      break;
    case 'cone':
      g = new THREE.ConeGeometry(p.size[0], p.size[1], p.segments ?? 8);
      break;
    case 'cyl':
      g = new THREE.CylinderGeometry(p.size[2] ?? p.size[0], p.size[0], p.size[1], p.segments ?? 8);
      break;
  }
  g = g.index ? g.toNonIndexed() : g;
  if (p.rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...p.rot)));
  g.translate(...p.at);
  // Strip to position + normal + colour so mergeGeometries agrees.
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  const c = new THREE.Color(palette.building[p.color]);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}

const cache = new Map<BuildingId, THREE.BufferGeometry>();

export function buildingGeometry(type: BuildingId): THREE.BufferGeometry {
  let g = cache.get(type);
  if (!g) {
    const merged = mergeGeometries(SHAPES[type].map(partGeometry));
    if (!merged) throw new Error(`Could not build geometry for ${type}`);
    g = merged;
    g.computeBoundingSphere();
    cache.set(type, g);
  }
  return g;
}
