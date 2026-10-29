/** Glue between the pure game core and the Three.js view, input and HUD. */
import * as THREE from 'three';
import { BUILDING_IDS, BUILDINGS, type BuildingId } from './data/buildings';
import { palette } from './data/palette';
import { Game } from './core/game';
import { REASON_TEXT } from './core/placement';
import { Input } from './input/input';
import { CameraRig } from './render/cameraRig';
import { BuildingLayer } from './render/buildingLayer';
import { Ghost } from './render/ghost';
import { Labels } from './render/labels';
import { buildHeightTexture, buildIslandMesh, createShimmerUniforms } from './world/islandMesh';
import type { TideResult } from './core/tide';
import { TIDE } from './data/economy';
import { Props } from './world/props';
import { raycastGround } from './world/raycast';
import { Shoals } from './world/shoals';
import { createWater, type Water } from './world/water';
import { Hud } from './ui/hud';
import { clearRun, saveRun } from './save';

export interface AppOptions {
  /** Disable edge panning and expose hooks (Playwright). */
  test: boolean;
}

export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly input: Input;
  private water: Water;
  private sun: THREE.DirectionalLight;
  private terrainMesh: THREE.Mesh | null = null;
  private heightTex: THREE.Texture | null = null;
  private props: Props | null = null;
  private shoals: Shoals | null = null;
  private buildings = new BuildingLayer();
  private ghost = new Ghost();
  private labels: Labels;
  private hud: Hud;
  private timer = new THREE.Timer();
  private time = 0;
  selected: BuildingId | null = null;
  private hover: { x: number; z: number; water: boolean } | null = null;
  private dirtyPreview = true;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private frameTimes: number[] = [];
  private shimmer = createShimmerUniforms();
  /** Sea level as drawn; lags the game's level while the tide tween runs. */
  private displaySea = 0;
  private tween: { from: number; to: number; t: number; trees: number[] } | null = null;

  constructor(private container: HTMLElement, public game: Game, private opts: AppOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(palette.sky);
    this.scene.fog = new THREE.Fog(palette.fog, 70, 230);
    this.scene.add(new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, 1.6));
    this.sun = new THREE.DirectionalLight(palette.sun, 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    this.input = new Input(this.renderer.domElement);
    this.rig = new CameraRig(container.clientWidth / container.clientHeight, this.input, () => ({ w: container.clientWidth, h: container.clientHeight }));
    this.rig.edgePan = !opts.test;

    this.water = createWater();
    this.scene.add(this.water.mesh, this.buildings.group, this.ghost.group);

    this.labels = new Labels(container);
    this.hud = new Hud(container, {
      select: (t) => this.select(t),
      choose: (i) => this.choose(i),
      sail: () => this.sail(),
      restart: () => this.restart(),
      endIsland: () => {
        this.game.endIsland();
        this.afterAction();
      },
    });

    this.input.onPointerMove(() => this.updateHover());
    this.input.onClick(() => this.tryPlace());
    this.input.onDigit((n) => {
      const t = this.hud.handTypeAt(this.game, n);
      if (t) this.select(t);
    });
    this.input.onPress((a) => {
      if (a === 'rotateBuilding') {
        this.ghost.rot += Math.PI / 4;
        this.dirtyPreview = true;
      }
      if (a === 'cancel') this.select(null);
    });
    window.addEventListener('resize', () => this.resize());

    this.loadIsland();
  }

  /** Build all visuals for the current island from the game state. */
  private loadIsland(): void {
    const g = this.game;
    const d = g.world.data;
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    if (this.props) {
      this.scene.remove(this.props.group);
      this.props.dispose();
    }
    if (this.shoals) {
      this.scene.remove(this.shoals.mesh);
      this.shoals.dispose();
    }
    this.heightTex?.dispose();

    this.terrainMesh = buildIslandMesh(d, this.shimmer);
    this.scene.add(this.terrainMesh);
    const ht = buildHeightTexture(d);
    this.heightTex = ht.tex;
    this.water.setHeights(ht.tex, d.halfSize, ht.min, ht.range);
    this.tween = null;
    this.displaySea = g.world.seaLevel;
    this.water.setLevel(this.displaySea);
    const alive = new Set([...g.world.trees.all()].map((t) => t.id));
    this.props = new Props(d, g.world.terrain, d.trees.filter((t) => !alive.has(t.id)).map((t) => t.id));
    this.scene.add(this.props.group);
    this.shoals = new Shoals(d.shoals);
    this.scene.add(this.shoals.mesh);

    this.buildings.clear();
    for (const b of g.state.buildings) this.buildings.add(b, g.world.terrain.heightAt(b.x, b.z), false);

    // One shadow map that covers the island.
    const s = this.sun.shadow.camera;
    const r = d.halfSize * 0.95;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 220;
    s.updateProjectionMatrix();
    this.sun.position.set(-40, 70, 30);
    this.sun.target.position.set(0, 0, 0);

    this.rig.frame(d.halfSize);
    this.ensureSelection();
    this.dirtyPreview = true;
  }

  private ensureSelection(): void {
    const hand = this.game.state.hand;
    if (this.selected && (hand[this.selected] ?? 0) > 0) return;
    this.select(BUILDING_IDS.find((id) => (hand[id] ?? 0) > 0) ?? null);
  }

  select(type: BuildingId | null): void {
    if (type && !(this.game.state.hand[type] ?? 0)) return;
    this.selected = type;
    this.ghost.setType(type);
    this.dirtyPreview = true;
  }

  private updateHover(): void {
    const p = this.input.pointer;
    if (!p.inside) {
      this.hover = null;
      this.dirtyPreview = true;
      return;
    }
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.ndc.set((p.x / w) * 2 - 1, -(p.y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
    const o = this.raycaster.ray.origin;
    const dir = this.raycaster.ray.direction;
    const hit = raycastGround(this.game.world.terrain, this.game.world.seaLevel, [o.x, o.y, o.z], [dir.x, dir.y, dir.z]);
    this.hover = hit ? { x: hit.x, z: hit.z, water: hit.water } : null;
    this.dirtyPreview = true;
  }

  private refreshPreview(): void {
    this.dirtyPreview = false;
    const g = this.game;
    if (!this.selected || !this.hover || !g.canPlace(this.selected)) {
      this.ghost.hide();
      this.labels.clearPreview();
      this.hud.setHint(this.selected || g.state.status !== 'playing' ? '' : 'Pick a building from your hand');
      return;
    }
    const { x, z } = this.hover;
    const pv = g.preview(this.selected, x, z);
    const t = g.world.terrain;
    this.ghost.show(t, g.world.seaLevel, x, z, pv.validity.ok);
    const anchor = new THREE.Vector3(x, Math.max(t.heightAt(x, z), g.world.seaLevel) + 1.4, z);
    const heightAt = (px: number, pz: number): number => Math.max(t.heightAt(px, pz), g.world.seaLevel);
    this.labels.setPreview(pv.validity.ok ? pv.score.parts : [], pv.score.total, anchor, heightAt, pv.validity.ok);
    const until = g.placementsUntilTide;
    const floods = pv.validity.ok && until !== null && t.heightAt(x, z) <= g.nextSeaLevel;
    const def = BUILDINGS[this.selected];
    this.hud.setHint(
      !pv.validity.ok
        ? REASON_TEXT[pv.validity.reason]
        : floods
          ? `⚠ This spot floods at the next tide (in ${until} placement${until === 1 ? '' : 's'}): -${def.sinkPenalty}`
          : `${def.name}: ${def.blurb}`,
    );
  }

  private tryPlace(): void {
    this.updateHover();
    if (!this.selected || !this.hover) return;
    this.placeAt(this.selected, this.hover.x, this.hover.z);
  }

  /** Place through the full view path (also used by tooling and the bench). */
  placeAt(type: BuildingId, x: number, z: number): boolean {
    const g = this.game;
    const res = g.place(type, x, z, this.ghost.rot);
    if (!res) return false;
    const t = g.world.terrain;
    this.buildings.add(res.building, t.heightAt(res.building.x, res.building.z));
    for (const id of res.treesRemoved) this.props?.removeTree(id);
    this.labels.burst(res.score.total, new THREE.Vector3(res.building.x, t.heightAt(res.building.x, res.building.z) + 1.8, res.building.z));
    if (res.tide) this.startTide(res.tide);
    this.afterAction();
    return true;
  }

  /** Animate a tide rise: water climbs, sunk buildings slide under, penalties pop. */
  private startTide(tide: TideResult): void {
    this.tween = { from: this.displaySea, to: tide.seaLevel, t: 0, trees: tide.treesFlooded };
    const t = this.game.world.terrain;
    for (const b of tide.sunk) {
      this.buildings.sink(b.id, TIDE.tweenSeconds * 1.2);
      this.labels.burst(-BUILDINGS[b.type].sinkPenalty, new THREE.Vector3(b.x, t.heightAt(b.x, b.z) + 1.6, b.z));
    }
    for (const b of tide.guarded) this.labels.burst(0, new THREE.Vector3(b.x, t.heightAt(b.x, b.z) + 1.6, b.z), '🛡 saved');
    this.hud.flashTide(tide);
  }

  private updateTide(dt: number): void {
    const tw = this.tween;
    if (tw) {
      tw.t += dt / TIDE.tweenSeconds;
      const k = Math.min(tw.t, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.displaySea = tw.from + (tw.to - tw.from) * e;
      if (k >= 1) {
        for (const id of tw.trees) this.props?.removeTree(id);
        this.tween = null;
      }
    }
    this.water.setLevel(this.displaySea);
    const until = this.game.placementsUntilTide;
    const target = until === null || this.tween ? 0 : until <= 1 ? 1 : until <= 3 ? 0.65 : 0.35;
    const sh = this.shimmer;
    sh.uShimmer.value += (target - sh.uShimmer.value) * Math.min(dt * 3, 1);
    sh.uSea.value = this.displaySea;
    sh.uNextSea.value = this.game.nextSeaLevel;
    sh.uTime.value = this.time;
  }

  choose(i: number): void {
    if (this.game.choose(i)) this.afterAction();
  }

  private sail(): void {
    if (!this.game.sail()) return;
    this.loadIsland();
    this.afterAction();
  }

  private restart(): void {
    clearRun();
    const seed = Math.random().toString(36).slice(2, 8);
    this.game = Game.newRun(seed);
    this.loadIsland();
    this.afterAction();
  }

  private afterAction(): void {
    saveRun(this.game.state);
    this.ensureSelection();
    this.dirtyPreview = true;
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w / h);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.time += dt;
    const moving = this.rig.isMoving;
    this.rig.update(dt);
    if (moving) this.updateHover();
    if (this.dirtyPreview) this.refreshPreview();
    this.updateTide(dt);
    this.water.update(this.time);
    this.shoals?.update(this.time, this.displaySea);
    this.buildings.update(dt);
    this.hud.render(this.game, this.selected);
    this.renderer.render(this.scene, this.rig.camera);
    this.labels.update(this.rig.camera, this.container.clientWidth, this.container.clientHeight);
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 600) this.frameTimes.shift();
  }

  /** Project a ground point to CSS pixels (for tests and tooling). */
  worldToScreen(x: number, z: number): { x: number; y: number } {
    const y = Math.max(this.game.world.terrain.heightAt(x, z), this.game.world.seaLevel);
    const v = new THREE.Vector3(x, y, z).project(this.rig.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight };
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  get testMode(): boolean {
    return this.opts.test;
  }
}
