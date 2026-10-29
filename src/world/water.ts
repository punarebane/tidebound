/** Animated water plane: gentle waves, depth tint and shore foam from the heightmap. */
import * as THREE from 'three';
import { palette } from '../data/palette';

const vert = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    float wave = sin(wp.x * 0.35 + uTime * 0.9) * 0.05 + sin(wp.z * 0.28 - uTime * 0.7) * 0.05
               + sin((wp.x + wp.z) * 0.6 + uTime * 1.6) * 0.02;
    wp.y += wave;
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uSeaLevel;
  uniform sampler2D uHeights;
  uniform float uHalf;
  uniform float uHMin;
  uniform float uHRange;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main() {
    vec2 uv = (vWorld.xz + uHalf) / (2.0 * uHalf);
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float h = mix(uHMin, texture2D(uHeights, clamp(uv, 0.0, 1.0)).r * uHRange + uHMin, inside);
    float depth = uSeaLevel - h;
    vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 3.0, depth));
    // Soft sparkle bands.
    float ripple = sin(vWorld.x * 1.3 + uTime * 1.2) * sin(vWorld.z * 1.1 - uTime);
    col += 0.035 * smoothstep(0.6, 1.0, ripple);
    // Shore foam: a breathing band where the water is shallow.
    float edge = 0.28 + 0.1 * sin(uTime * 1.4 + vWorld.x * 0.5 + vWorld.z * 0.4);
    float foam = 1.0 - smoothstep(edge * 0.4, edge, depth);
    float foamLine = (1.0 - smoothstep(0.0, 0.08, abs(depth - edge * 1.7))) * 0.5;
    col = mix(col, uFoam, clamp(foam + foamLine, 0.0, 1.0) * 0.85);
    float alpha = mix(0.7, 1.0, smoothstep(0.0, 2.6, depth));
    alpha = max(alpha, foam * 0.95);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export interface Water {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  setHeights(tex: THREE.Texture, half: number, min: number, range: number): void;
  setLevel(y: number): void;
  update(time: number): void;
}

export function createWater(): Water {
  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSeaLevel: { value: 0 },
        uHeights: { value: null },
        uHalf: { value: 1 },
        uHMin: { value: -5 },
        uHRange: { value: 16 },
        uDeep: { value: new THREE.Color(palette.waterDeep) },
        uShallow: { value: new THREE.Color(palette.waterShallow) },
        uFoam: { value: new THREE.Color(palette.foam) },
      },
    ]),
  });
  const geo = new THREE.PlaneGeometry(600, 600, 120, 120);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'water';
  mesh.renderOrder = 1;
  return {
    mesh,
    material,
    setHeights(tex, half, min, range) {
      material.uniforms.uHeights.value = tex;
      material.uniforms.uHalf.value = half;
      material.uniforms.uHMin.value = min;
      material.uniforms.uHRange.value = range;
    },
    setLevel(y) {
      mesh.position.y = y;
      material.uniforms.uSeaLevel.value = y;
    },
    update(time) {
      material.uniforms.uTime.value = time;
    },
  };
}
