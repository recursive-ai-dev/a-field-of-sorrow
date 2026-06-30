import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { VignetteShader } from "./shaders";
import type { GameState, StateListener, SurvivorUI, ScoutUI, Survivor, Scout, Ward } from "./types";
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
  private terrainMesh!: THREE.Mesh;
  private survivorSpatialGrid!: SpatialGrid<Survivor>;
  private scoutSpatialGrid!: SpatialGrid<Scout>;

  private keys: Record<string, boolean> = {};
  private joystick: { x: number; y: number } | null = null;
  private wardCD = 0;
  private healCD = 0;

  private status: GameState["status"] = "playing";
  private saved = 0;
  private lostCount = 0;
  private morale = 60;
  private timeLeft: number = CONFIG.gameTime;
  private dangerLevel = { value: 0 };
  private message: string | null = null;
  private messageT = 0;
  private speedBoostTimer = 0;
  private darkPulseTimer = 0;
  private paused = false;

  private listener: StateListener | null = null;
  private raycaster = new THREE.Raycaster();
  private tmpV = new THREE.Vector3();
  private ndc = new THREE.Vector2();
  private performanceMonitor = new PerformanceMonitor();
  private lastPerformanceLog = 0;

  constructor(container: HTMLElement, initialState?: GameState) {
    if (!container) throw new Error("Game container element is required");
    this.container = container;
    try {
      this.init(initialState);
    } catch (error) {
      console.error("Failed to initialize game:", error);
      this.cleanup();
      throw error;
    }
  }

  onState(cb: StateListener) { this.listener = cb; }

  private init(initialState?: GameState) {
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
    this.terrainMesh = buildTerrain(this.scene);
    buildDetritus(this.scene);
    this.fogPatches = buildFogPatches(this.scene);
    this.fireflies = buildFireflies(this.scene);

    if (initialState) {
      this.restoreState(initialState);
    }

    const built = buildPlayer(this.scene, this.playerPos);
    this.player = built.player;
    this.staffOrb = built.staffOrb;
    this.playerLight = built.playerLight;

    if (this.survivors.length === 0) {
      this.survivors = buildSurvivors(this.scene);
    }

    if (this.scouts.length === 0) {
      this.scouts = buildScouts(this.scene);
    }

    this.buildSpatialGrids();
    this.buildPost();
    initializeWardPool(this.scene);

    audio.init().then(() => audio.play("ward"));

    this.addListeners();
    this.loop();
  }

  private restoreState(state: GameState) {
    this.status = state.status;
    this.saved = state.saved;
    this.lostCount = state.lost;
    this.morale = state.morale;
    this.timeLeft = state.timeLeft;
    this.playerHealth = state.playerHealth;
    this.wardCD = (1 - state.wardCooldown) * CONFIG.wardCooldown;
    this.healCD = (1 - state.healCooldown) * CONFIG.healCooldown;

    // Restore survivors if available in serialized state
    if (state.survivors && state.survivors.length > 0) {
      this.survivors = state.survivors.map((sUI) => {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: sUI.rescued ? 0x5ab07a : (sUI.life <= 0 ? 0x2a1810 : 0x8a5a3a), roughness: 0.8 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1, 4, 8), bodyMat);
        body.rotation.z = Math.PI / 2.6;
        body.position.y = 0.7;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.6 }),
        );
        head.position.set(0.7, 1.05, 0);
        group.add(head);

        const light = new THREE.PointLight(sUI.rescued ? 0x66ffaa : 0xffaa55, sUI.rescued ? 10 : (sUI.life <= 0 ? 0 : 6), 10, 2);
        light.position.y = 1.5;
        group.add(light);

        const cluster = Math.floor(sUI.id / 3);
        const cx = Math.cos(cluster * 1.7) * (20 + cluster * 12);
        const cz = Math.sin(cluster * 2.1) * (15 + cluster * 10) - 10;
        const x = cx + (Math.sin(sUI.id) * 7);
        const z = cz + (Math.cos(sUI.id) * 7);
        const y = terrainHeight(x, z);
        group.position.set(x, y, z);
        this.scene.add(group);

        return {
          mesh: group,
          pos: new THREE.Vector3(x, y, z),
          life: sUI.life,
          rescued: sUI.rescued,
          dead: sUI.life <= 0 && !sUI.rescued,
          ward: null,
          name: sUI.name,
          cryT: Math.random() * 3,
          light,
          bodyMat,
        };
      });
    }

    if (state.scouts && state.scouts.length > 0) {
      this.scouts = state.scouts.map((scUI) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.ConeGeometry(0.9, 3, 6),
          new THREE.MeshStandardMaterial({ color: 0x401818, roughness: 0.6, emissive: 0x200000, emissiveIntensity: 0.5 }),
        );
        body.position.y = 1.5;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.45, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x661111, emissive: 0x880000, emissiveIntensity: 1.5 }),
        );
        head.position.y = 3.2;
        group.add(head);
        const light = new THREE.PointLight(0xff2200, 12, 18, 2);
        light.position.y = 3;
        group.add(light);

        const F = CONFIG.field;
        const x = (Math.sin(scUI.id) * F * 0.7);
        const z = (Math.cos(scUI.id) * F * 0.7);
        const y = terrainHeight(x, z);
        group.position.set(x, y, z);
        this.scene.add(group);

        return {
          group,
          pos: new THREE.Vector3(x, y, z),
          vel: new THREE.Vector3(),
          waypoint: new THREE.Vector3(),
          light,
        };
      });
    }
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
    const intersects = this.raycaster.intersectObject(this.terrainMesh);
    if (intersects.length > 0) {
      const hit = intersects[0].point;
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
    if (this.status !== "playing" || this.paused) return;
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

  public setJoystick(v: { x: number; y: number } | null) {
    this.joystick = v;
  }

  public setPaused(p: boolean) {
    this.paused = p;
  }

  private rescue(s: Survivor) {
    if (s.rescued || s.dead) return;
    s.rescued = true;
    this.speedBoostTimer = 3.0;
    this.wardCD = Math.max(0, this.wardCD - 2.0);
    this.healCD = Math.max(0, this.healCD - 2.0);
    for (const sc of this.scouts) {
      if (sc.pos.distanceTo(s.pos) < 20) {
        sc.vel.copy(sc.pos).sub(s.pos).setY(0).normalize().multiplyScalar(40);
      }
    }
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
    this.darkPulseTimer = 2.0;
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
      if (this.status === "playing" && !this.paused) this.update(dt);
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
    this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
    this.darkPulseTimer = Math.max(0, this.darkPulseTimer - dt);

    this.moveTarget = updatePlayer(
      dt, this.keys, this.joystick, this.camera, this.playerPos, this.playerVel, this.player, this.moveTarget, this.speedBoostTimer
    );

    updateSurvivors(
      dt, this.survivors, this.scoutSpatialGrid, this.survivorSpatialGrid,
      this.wards, this.dangerLevel, this.killSurvivor,
    );
    updateScouts(
      dt, this.scouts, this.survivorSpatialGrid, this.scoutSpatialGrid,
      this.playerPos, { value: this.playerHealth }, this.wards, this.timeLeft, CONFIG.gameTime
    );
    updateWards(dt, this.scene, this.wards, this.survivors, (s) => this.rescue(s));

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
    if (!this.paused) {
      for (const f of this.fogPatches) f.mat.uniforms.uTime.value += dt;
      (this.fireflies.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      this.staffOrb.rotation.y += dt * 2;
    }
    this.vignette.uniforms.uDanger.value = this.dangerLevel.value;
    this.vignette.uniforms.uTime.value = t;
    this.vignette.uniforms.uDarkPulse.value = this.darkPulseTimer > 0 ? this.darkPulseTimer / 2.0 : 0;
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
      for (const ward of this.wards) {
        this.scene.remove(ward.mesh);
        ward.mesh.geometry.dispose();
        ward.mat.dispose();
      }
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
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
              else o.material.dispose();
            }
          }
        });
        s.light.dispose();
      }
      this.survivors = [];
      for (const s of this.scouts) {
        this.scene.remove(s.group);
        s.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
              else o.material.dispose();
            }
          }
        });
        s.light.dispose();
      }
      this.scouts = [];
      if (this.player) {
        this.scene.remove(this.player);
        this.player.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
              else o.material.dispose();
            }
          }
        });
        this.playerLight.dispose();
      }
      if (this.composer) {
        this.composer.passes.forEach((p) => {
          if (p instanceof ShaderPass && p.material) p.material.dispose();
        });
      }
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
