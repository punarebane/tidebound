/** Glue between the pure game core and the Three.js view, input and HUD. */
import * as THREE from 'three';
import { BUILDING_IDS, BUILDINGS, type BuildingId } from './data/buildings';
import { palette } from './data/palette';
import { Game, newRunState } from './core/game';
import { REASON_TEXT, seaFacingYaw, validatePlacement } from './core/placement';
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
import { clearRun, loadRun, saveRun } from './save';
import { Sound } from './audio/audio';
import { Puffs } from './render/puffs';
import { Menu } from './ui/menu';

export interface BenchResult {
  buildings: number;
  frames: number;
  avgMs: number;
  p95Ms: number;
  cpuAvgMs: number;
  cpuP95Ms: number;
  fps: number;
  drawCalls: number;
  triangles: number;
}

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
  private lastFrame = 0;
  /** Main-thread time spent in each frame (update + render submission). */
  private cpuTimes: number[] = [];
  private shimmer = createShimmerUniforms();
  /** Sea level as drawn; lags the game's level while the tide tween runs. */
  private displaySea = 0;
  private tween: { from: number; to: number; t: number; trees: number[] } | null = null;
  readonly sound = new Sound();
  private puffs = new Puffs();
  private menu: Menu;
  private photoHint: HTMLDivElement;
  photo = false;

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
    this.scene.add(this.water.mesh, this.buildings.group, this.ghost.group, this.puffs.mesh);

    this.labels = new Labels(container);
    this.hud = new Hud(container, {
      select: (t) => this.select(t),
      choose: (i) => this.choose(i),
      sail: () => this.sail(),
      restart: () => this.openMenu(),
      endIsland: () => {
        this.game.endIsland();
        this.afterAction();
      },
      menu: () => this.openMenu(),
      photo: () => this.setPhoto(true),
      toggleMute: () => this.toggleMute(),
    });
    this.hud.setMuted(this.sound.muted);
    this.menu = new Menu(container, {
      continueRun: () => {
        this.sound.unlock();
        this.menu.hide();
      },
      start: (seed) => {
        this.sound.unlock();
        this.newRun(seed);
        this.menu.hide();
      },
      toggleMute: () => this.toggleMute(),
    }, this.sound.muted);
    this.photoHint = document.createElement('div');
    this.photoHint.className = 'photo-hint hidden';
    this.photoHint.textContent = 'Photo mode · drag, WASD, Q/E and wheel to frame · H hides this · P or Esc to return';
    container.appendChild(this.photoHint);
    // Any interaction can start audio (browsers need a gesture).
    window.addEventListener('pointerdown', () => this.sound.unlock());
    window.addEventListener('keydown', () => this.sound.unlock());

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
      if (a === 'cancel') {
        if (this.photo) this.setPhoto(false);
        else this.select(null);
      }
      if (a === 'photo' && !this.menu.visible) this.setPhoto(!this.photo);
      if (a === 'mute') this.toggleMute();
      if (a === 'hideHint' && this.photo) this.photoHint.classList.toggle('hidden');
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
    this.shoals = new Shoals([...g.world.shoals.all()]);
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
    if (this.photo || !this.selected || !this.hover || !g.canPlace(this.selected)) {
      this.ghost.hide();
      this.labels.clearPreview();
      this.hud.setHint(this.selected || g.state.status !== 'playing' ? '' : 'Pick a building from your hand');
      return;
    }
    const { x, z } = this.hover;
    const pv = g.preview(this.selected, x, z);
    const t = g.world.terrain;
    this.ghost.show(t, g.world.seaLevel, x, z, pv.validity.ok, this.rotFor(this.selected, x, z));
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
    if (this.photo || this.menu.visible) return;
    this.updateHover();
    if (!this.selected || !this.hover) return;
    this.placeAt(this.selected, this.hover.x, this.hover.z);
  }

  /** Shore buildings (Fisher, Seawall) turn to face the sea; others use R. */
  private rotFor(type: BuildingId, x: number, z: number): number {
    if (type !== 'fisher' && type !== 'seawall') return this.ghost.rot;
    return seaFacingYaw(this.game.world, x, z) ?? this.ghost.rot;
  }

  /** Place through the full view path (also used by tooling and the bench). */
  placeAt(type: BuildingId, x: number, z: number): boolean {
    const g = this.game;
    const res = g.place(type, x, z, this.rotFor(type, x, z));
    if (!res) return false;
    const t = g.world.terrain;
    this.buildings.add(res.building, t.heightAt(res.building.x, res.building.z));
    for (const id of res.treesRemoved) this.props?.removeTree(id);
    const ground = new THREE.Vector3(res.building.x, t.heightAt(res.building.x, res.building.z), res.building.z);
    this.labels.burst(res.score.total, ground.clone().setY(ground.y + 1.8));
    this.puffs.burst(ground, palette.dust, 12);
    this.sound.plink(res.score.total);
    if (res.thresholdsCrossed) this.sound.chime();
    if (res.tide) this.startTide(res.tide);
    this.afterAction();
    return true;
  }

  /** Animate a tide rise: water climbs, sunk buildings slide under, penalties pop. */
  private startTide(tide: TideResult): void {
    this.tween = { from: this.displaySea, to: tide.seaLevel, t: 0, trees: tide.treesFlooded };
    const t = this.game.world.terrain;
    tide.sunk.forEach((b, i) => {
      this.buildings.sink(b.id, TIDE.tweenSeconds * 1.2);
      this.labels.burst(-BUILDINGS[b.type].sinkPenalty, new THREE.Vector3(b.x, t.heightAt(b.x, b.z) + 1.6, b.z));
      this.puffs.burst(new THREE.Vector3(b.x, tide.seaLevel, b.z), palette.splash, 10, 1.2, 1.8);
      this.sound.sink(0.5 + i * 0.18);
    });
    this.sound.tide();
    this.rig.cinematic(TIDE.tweenSeconds + 1);
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
        // The fish have moved to the new shallows.
        this.shoals?.setPoints([...this.game.world.shoals.all()]);
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
    if (this.game.choose(i)) {
      this.sound.tick();
      this.afterAction();
    }
  }

  private sail(): void {
    if (!this.game.sail()) return;
    this.loadIsland();
    this.afterAction();
  }

  /** Start a fresh run on a seed (menu, seed entry, daily island). */
  newRun(seed: string): void {
    clearRun();
    this.setPhoto(false);
    this.game = Game.newRun(seed);
    this.loadIsland();
    this.afterAction();
  }

  openMenu(): void {
    this.setPhoto(false);
    const saved = loadRun();
    const canContinue = this.game.state.status !== 'gameover' && !!saved;
    this.menu.show(canContinue, this.game.state.seed);
  }

  /** Photo mode: hide all UI, loosen the camera. */
  setPhoto(on: boolean): void {
    if (this.photo === on) return;
    this.photo = on;
    this.container.classList.toggle('app-photo', on);
    this.photoHint.classList.toggle('hidden', !on);
    this.rig.setFree(on);
    this.dirtyPreview = true;
  }

  private toggleMute(): boolean {
    const m = this.sound.toggleMute();
    this.hud.setMuted(m);
    this.menu.setMuted(m);
    return m;
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
    const cpuStart = performance.now();
    this.frameInner();
    this.cpuTimes.push(performance.now() - cpuStart);
    if (this.cpuTimes.length > 4000) this.cpuTimes.shift();
  }

  private frameInner(): void {
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
    this.puffs.update(dt);
    this.hud.render(this.game, this.selected);
    this.renderer.render(this.scene, this.rig.camera);
    this.labels.update(this.rig.camera, this.container.clientWidth, this.container.clientHeight);
    const now = performance.now();
    if (this.lastFrame) this.frameTimes.push(now - this.lastFrame);
    this.lastFrame = now;
    if (this.frameTimes.length > 4000) this.frameTimes.shift();
  }

  /**
   * ?bench: fill a large island with `count` buildings (straight into the
   * world, no scoring or tide), orbit the camera, and measure frame times.
   */
  async bench(count = 150, warmupMs = 1500, measureMs = 6000): Promise<BenchResult> {
    const state = newRunState('bench');
    state.island = 4;
    state.hand = {};
    this.game = new Game(state);
    this.loadIsland();
    const g = this.game;
    const d = g.world.data;
    let placed = 0;
    let k = 0;
    const step = 2;
    for (let z = -d.halfSize + 2; z < d.halfSize - 2 && placed < count; z += step) {
      for (let x = -d.halfSize + 2; x < d.halfSize - 2 && placed < count; x += step) {
        // Rotate through every type; site-limited ones (Fisher, Lighthouse) take what fits.
        const fits = (t: BuildingId): boolean => validatePlacement(g.world, t, x, z).ok;
        const order = BUILDING_IDS.map((_, i) => BUILDING_IDS[(k + i) % BUILDING_IDS.length]);
        // Clear trees in the way so the bench reaches its count on any seed.
        if (!order.some(fits) && !g.world.buildings.query(x, z, 1.3).length) {
          for (const t of g.world.trees.query(x, z, 1.3)) {
            g.world.trees.remove(t.id);
            this.props?.removeTree(t.id);
          }
        }
        const type = order.find(fits);
        if (!type) continue;
        k++;
        const b = { id: state.nextId++, type, x, z, r: BUILDINGS[type].footprint, rot: (k * 0.7) % (Math.PI * 2), score: 0, order: placed };
        state.buildings.push(b);
        g.world.addBuilding(b);
        this.buildings.add(b, g.world.terrain.heightAt(x, z), false);
        placed++;
      }
    }
    this.select(null);
    this.rig.autoYaw = 0.25;
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    await wait(warmupMs);
    this.frameTimes = [];
    this.cpuTimes = [];
    const calls: number[] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < measureMs) {
      await wait(250);
      calls.push(this.renderer.info.render.calls);
    }
    this.rig.autoYaw = 0;
    const ft = [...this.frameTimes].sort((a, b) => a - b);
    const avg = ft.reduce((a, b) => a + b, 0) / Math.max(ft.length, 1);
    const p95 = ft[Math.min(ft.length - 1, Math.floor(ft.length * 0.95))] ?? 0;
    const cpu = [...this.cpuTimes].sort((a, b) => a - b);
    const result: BenchResult = {
      buildings: placed,
      frames: ft.length,
      avgMs: +avg.toFixed(2),
      p95Ms: +p95.toFixed(2),
      cpuAvgMs: +(cpu.reduce((a, b) => a + b, 0) / Math.max(cpu.length, 1)).toFixed(2),
      cpuP95Ms: +(cpu[Math.min(cpu.length - 1, Math.floor(cpu.length * 0.95))] ?? 0).toFixed(2),
      fps: +(1000 / Math.max(avg, 1e-6)).toFixed(1),
      drawCalls: Math.max(...calls),
      triangles: this.renderer.info.render.triangles,
    };
    console.log(`[bench] ${JSON.stringify(result)}`);
    return result;
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
