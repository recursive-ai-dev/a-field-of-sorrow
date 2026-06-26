import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { VignetteShader } from "./shaders";
import type { GameState, StateListener, SurvivorUI, ScoutUI } from "./types";
import type { Survivor, Scout, Ward } from "./entities";
import { CONFIG } from "./config";
import { buildLighting, buildTerrain, buildDetritus, buildFogPatches, buildFireflies, terrainHeight, type FogPatch } from "./scene";
import { buildPlayer, updatePlayer, flashOrb } from "./player";
import { buildSurvivors, buildScouts, updateSurvivors, updateScouts } from "./entities";
import { initializeWardPool, castWard, updateWards, getWardPool } from "./wards";
import { SpatialGrid } from "../utils/spatialGrid";
import { PerformanceMonitor } from "../utils/performanceMonitor";
import { audio } from "./audio";

export class Game {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private vignette!: ShaderPass;
  private timer = new THREE.Timer();
  private raf = 0;

  private player!: THREE.Group;
  private playerLight!: THREE.PointLight;
  private staffOrb!: THREE.Mesh;
  private playerPos = new THREE.Vector3(0, 0, CONFIG.field * 0.7);
  private playerVel = new THREE.Vector3();
  private playerHealth = 1;
  private moveTarget: THREE.Vector3 | null = null;

  private survivors: Survivor[] = [];
  private scouts: Scout[] = [];
  private wards: Ward[] = [];
  private fogPatches: FogPatch[] = [];
  private fireflies!: THREE.Points;
  private survivorSpatialGrid!: SpatialGrid<Survivor>;
  private scoutSpatialGrid!: SpatialGrid<Scout>;

  private keys: Record<string, boolean> = {};
  private wardCD = 0;
  private healCD = 0;

  private status: GameState["status"] = "playing";
  private saved = 0;
  private lostCount = 0;
  private morale = 60;
  private timeLeft = CONFIG.gameTime;
  private dangerLevel = { value: 0 };
  private message: string | null = null;
  private messageT = 0;

  private listener: StateListener | null = null;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmpV = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  private performanceMonitor = new PerformanceMonitor();
  private lastPerformanceLog = 0;

  constructor(container: HTMLElement) {
    if (!container) throw new Error("Game container element is required");
    this.container = container;
    try {
      this.init();
    } catch (error) {
      console.error("Failed to initialize game:", error);
      this.cleanup();
      throw error;
    }
  }

  onState(cb: StateListener) { this.listener = cb; }

  private init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x2a2118, 0.012);
    this.scene.background = new THREE.Color(0x161310);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 600);
    this.camera.position.set(0, 28, CONFIG.field * 0.7 + 26);

    buildLighting(this.scene);
    buildTerrain(this.scene);
    buildDetritus(this.scene);
    this.fogPatches = buildFogPatches(this.scene);
    this.fireflies = buildFireflies(this.scene);

    const built = buildPlayer(this.scene, this.playerPos);
    this.player = built.player;
    this.staffOrb = built.staffOrb;
    this.playerLight = built.playerLight;

    this.survivors = buildSurvivors(this.scene);
    this.scouts = buildScouts(this.scene);

    this.buildSpatialGrids();
    this.buildPost();
    initializeWardPool(this.scene);

    audio.init().then(() => audio.play("ward"));

    this.addListeners();
    this.loop();
  }

  private buildSpatialGrids() {
    const F = CONFIG.field;
    const bounds = { min: new THREE.Vector3(-F, 0, -F), max: new THREE.Vector3(F, 0, F) };
    this.survivorSpatialGrid = new SpatialGrid<Survivor>(bounds, 25);
    this.scoutSpatialGrid = new SpatialGrid<Scout>(bounds, 30);
    for (const s of this.survivors) this.survivorSpatialGrid.add(s);
    for (const s of this.scouts) this.scoutSpatialGrid.add(s);
  }

  private buildPost() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.6, 0.2);
    this.composer.addPass(this.bloom);
    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
  }

  private addListeners() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.onResize);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = true;
    if (e.key === " ") { e.preventDefault(); this.castWard(true); }
    if (e.key.toLowerCase() === "e") this.castWard(false);
  };

  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.key.toLowerCase()] = false; };

  private onPointerDown = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      const F = CONFIG.field;
      hit.x = THREE.MathUtils.clamp(hit.x, -F, F);
      hit.z = THREE.MathUtils.clamp(hit.z, -F, F);
      this.moveTarget = hit.clone();
    }
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  public castWard(protect: boolean) {
    if (typeof protect !== "boolean") return;
    if (this.status !== "playing") return;
    if (protect && this.wardCD > 0) return;
    if (!protect && this.healCD > 0) return;

    const { ward, cooldownDuration } = castWard(
      this.scene, protect, this.playerPos, terrainHeight, this.survivors,
      (s) => this.rescue(s),
      (color) => flashOrb(this.staffOrb, this.playerLight, color),
    );

    if (ward) {
      this.wards.push(ward);
      if (protect) this.wardCD = cooldownDuration;
      else this.healCD = cooldownDuration;
      audio.play(protect ? "ward" : "heal");
    }
  }

  private rescue(s: Survivor) {
    if (s.rescued || s.dead) return;
    s.rescued = true;
    this.saved++;
    this.morale = Math.min(100, this.morale + 6 + Math.round(s.life * 4));
    this.setMessage(`${s.name} rescued! The light shielded them.`);
    s.bodyMat.color.setHex(0x5ab07a);
    s.bodyMat.emissive = new THREE.Color(0x113322);
    s.light.color.setHex(0x66ffaa);
    s.light.intensity = 10;
    audio.play("rescue");
  }

  private killSurvivor = (s: Survivor) => {
    if (s.rescued || s.dead) return;
    s.dead = true;
    this.lostCount++;
    this.morale = Math.max(0, this.morale - 9);
    this.setMessage(`${s.name} was lost to the dark...`);
    s.bodyMat.color.setHex(0x2a1810);
    s.light.intensity = 0;
    audio.play("death");
  };

  private setMessage(m: string) { this.message = m; this.messageT = 3.5; }

  private loop = (timestamp?: number) => {
    try {
      this.raf = requestAnimationFrame(this.loop);
      this.timer.update(timestamp);
      const dt = Math.min(this.timer.getDelta(), 0.05);
      const t = this.timer.getElapsed();
      if (this.status === "playing") this.update(dt);
      this.updateVisuals(dt, t);
      this.composer.render();
      this.emitState();
      this.performanceMonitor.addFrameTime(performance.now());
      if (t - this.lastPerformanceLog >= 5) {
        const stats = this.performanceMonitor.getStats();
        console.log(`[PERF] FPS: ${stats.fps}, Avg: ${stats.avgFrameTime}ms`);
        this.lastPerformanceLog = t;
      }
    } catch (error) {
      console.error("Error in game loop:", error);
      this.dispose();
      throw error;
    }
  };

  private update(dt: number) {
    this.timeLeft -= dt;
    this.wardCD = Math.max(0, this.wardCD - dt);
    this.healCD = Math.max(0, this.healCD - dt);

    this.moveTarget = updatePlayer(
      dt, this.keys, this.camera, this.playerPos, this.playerVel, this.player, this.moveTarget,
    );

    updateSurvivors(
      dt, this.survivors, this.scoutSpatialGrid, this.survivorSpatialGrid,
      this.wards, this.dangerLevel, this.killSurvivor,
    );
    updateScouts(
      dt, this.scouts, this.survivorSpatialGrid, this.scoutSpatialGrid,
      this.playerPos, { value: this.playerHealth }, this.wards,
    );
    updateWards(dt, this.scene, this.wards, this.survivors);

    if (this.playerHealth < 1) {
      this.playerHealth = Math.min(1, this.playerHealth + CONFIG.playerRegen * dt);
    }

    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) this.message = null;
    }

    const resolved = this.survivors.filter(s => s.rescued || s.dead).length;
    if (resolved >= CONFIG.survivorCount || this.timeLeft <= 0 || this.playerHealth <= 0) {
      this.endGame();
    }
  }

  private updateVisuals(dt: number, t: number) {
    for (const f of this.fogPatches) f.mat.uniforms.uTime.value += dt;
    (this.fireflies.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.staffOrb.rotation.y += dt * 2;
    this.vignette.uniforms.uDanger.value = this.dangerLevel.value;
    this.vignette.uniforms.uTime.value = t;
    this.bloom.strength = 0.85 + this.dangerLevel.value * 0.4;
  }

  private endGame() {
    const ratio = this.saved / CONFIG.survivorCount;
    this.status = ratio >= CONFIG.winRatio || this.morale >= CONFIG.winMorale ? "won" : "lost";
    audio.play(this.status === "won" ? "victory" : "defeat");
  }

  private project(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    this.tmpV.copy(v);
    this.tmpV.y += 2.5;
    this.tmpV.project(this.camera);
    const visible = this.tmpV.z < 1 && this.tmpV.x > -1.3 && this.tmpV.x < 1.3 && this.tmpV.y > -1.3 && this.tmpV.y < 1.3;
    return { x: (this.tmpV.x * 0.5 + 0.5), y: (-this.tmpV.y * 0.5 + 0.5), visible };
  }

  private emitState() {
    if (!this.listener) return;
    const survUI: SurvivorUI[] = this.survivors.map((s, id) => {
      const pr = this.project(s.pos);
      return {
        id, x: pr.x, y: pr.y, dist: s.pos.distanceTo(this.playerPos),
        life: s.life, visible: pr.visible && !s.rescued && !s.dead,
        rescued: s.rescued, critical: s.life < 0.3, name: s.name,
      };
    });
    const scoutUI: ScoutUI[] = this.scouts.map((sc, id) => {
      const pr = this.project(sc.pos);
      return { id, x: pr.x, y: pr.y, dist: sc.pos.distanceTo(this.playerPos), visible: pr.visible };
    });
    this.listener({
      status: this.status, saved: this.saved, lost: this.lostCount,
      total: CONFIG.survivorCount, morale: Math.round(this.morale),
      wardCooldown: 1 - this.wardCD / CONFIG.wardCooldown,
      healCooldown: 1 - this.healCD / CONFIG.healCooldown,
      survivors: survUI, scouts: scoutUI,
      playerHealth: this.playerHealth, timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      message: this.message,
    });
  }

  public dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.cleanup();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private cleanup() {
    try {
      for (const ward of this.wards) this.scene.remove(ward.mesh);
      this.wards = [];
      for (const w of getWardPool()) {
        if (w.mesh.parent) this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mat.dispose();
      }
      for (const f of this.fogPatches) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mat.dispose();
      }
      this.fogPatches = [];
      if (this.fireflies) {
        this.scene.remove(this.fireflies);
        this.fireflies.geometry.dispose();
        (this.fireflies.material as THREE.ShaderMaterial).dispose();
      }
      for (const s of this.survivors) {
        this.scene.remove(s.mesh);
        s.mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material) (o.material as THREE.Material).dispose(); }
        });
        s.light.dispose();
      }
      this.survivors = [];
      for (const s of this.scouts) {
        this.scene.remove(s.group);
        s.group.traverse((o) => {
          if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material) (o.material as THREE.Material).dispose(); }
        });
        s.light.dispose();
      }
      this.scouts = [];
      if (this.player) {
        this.scene.remove(this.player);
        this.player.traverse((o) => {
          if (o instanceof THREE.Mesh) { o.geometry.dispose(); if (o.material) (o.material as THREE.Material).dispose(); }
        });
        this.playerLight.dispose();
      }
      if (this.composer) this.composer.passes.forEach((p) => { if ("material" in p && p.material) (p.material as THREE.Material).dispose(); });
      while (this.scene.children.length > 0) {
        const o = this.scene.children[0];
        this.scene.remove(o);
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach(m => m?.dispose());
          else o.material?.dispose();
        }
      }
      this.survivorSpatialGrid?.clear();
      this.scoutSpatialGrid?.clear();
    } catch (e) { console.error("Cleanup error:", e); }
  }
}
