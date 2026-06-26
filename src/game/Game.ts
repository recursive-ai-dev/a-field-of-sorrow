import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import {
  wardVertex,
  wardFragment,
  fogVertex,
  fogFragment,
} from "./shaders";
import type { GameState, StateListener, SurvivorUI, ScoutUI } from "./types";
import { SpatialGrid } from "../utils/spatialGrid";
import { PerformanceMonitor } from "../utils/performanceMonitor";

const FIELD = 90; // half-extent of playable field
const SURVIVOR_COUNT = 14;
const SCOUT_COUNT = 4;
const GAME_TIME = 150; // seconds

const NAMES = [
  "Aldric", "Brienne", "Cael", "Dorne", "Elowen", "Fenwick",
  "Greta", "Halvard", "Isolde", "Joran", "Kestrel", "Lyra",
  "Maren", "Nyx", "Orin", "Perrin", "Quenby", "Rolf",
];

interface Survivor {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  life: number;
  rescued: boolean;
  dead: boolean;
  ward: Ward | null;
  name: string;
  cryT: number;
  light: THREE.PointLight;
  bodyMat: THREE.MeshStandardMaterial;
}

interface Scout {
  group: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  waypoint: THREE.Vector3;
  light: THREE.PointLight;
}

interface Ward {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  ttl: number;
  radius: number;
  protect: boolean; // true = ward, false = heal
  active: boolean;
}

interface WardPool {
  protectWards: Ward[];
  healWards: Ward[];
}

// ---- vignette shader pass ----
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uDanger: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uDanger;
    uniform float uTime;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.85, 0.25, d);
      c.rgb *= mix(0.45, 1.0, vig);
      // brassy twilight grade
      c.r *= 1.06; c.g *= 1.0; c.b *= 0.9;
      // danger red pulse at edges
      float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
      float edge = smoothstep(0.35, 0.75, d);
      c.rgb = mix(c.rgb, vec3(0.5, 0.05, 0.04), edge * uDanger * (0.4 + 0.3 * pulse));
      gl_FragColor = c;
    }
  `,
};

export class Game {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private vignette!: ShaderPass;
  private clock = new THREE.Clock();
  private raf = 0;

  private player!: THREE.Group;
  private playerLight!: THREE.PointLight;
  private staffOrb!: THREE.Mesh;
  private playerPos = new THREE.Vector3(0, 0, FIELD * 0.7);
  private playerVel = new THREE.Vector3();
  private playerHealth = 1;
  private moveTarget: THREE.Vector3 | null = null;

  private survivors: Survivor[] = [];
  private scouts: Scout[] = [];
  private wards: Ward[] = [];
  private wardPool: WardPool = { protectWards: [], healWards: [] };
  private fogPatches: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  private fireflies!: THREE.Points;
  private survivorSpatialGrid!: SpatialGrid<Survivor>;
  private scoutSpatialGrid!: SpatialGrid<Scout>;

  private keys: Record<string, boolean> = {};
  private wardCD = 0;
  private healCD = 0;
  private readonly WARD_CD_MAX = 6;
  private readonly HEAL_CD_MAX = 4;

  private status: GameState["status"] = "playing";
  private saved = 0;
  private lostCount = 0;
  private morale = 60;
  private timeLeft = GAME_TIME;
  private dangerLevel = 0;
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
    if (!container) {
      throw new Error("Game container element is required");
    }
    this.container = container;
    
    try {
      this.init();
    } catch (error) {
      console.error("Failed to initialize game:", error);
      this.cleanupThreeResources(); // Clean up any partially created resources
      throw error; // Re-throw to let the caller handle it
    }
  }

  onState(cb: StateListener) {
    this.listener = cb;
  }

  // ---------------- INIT ----------------
  private init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x2a2118, 0.012);
    this.scene.background = new THREE.Color(0x161310);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 600);
    this.camera.position.set(0, 28, FIELD * 0.7 + 26);

    this.buildLighting();
    this.buildTerrain();
    this.buildDetritus();
    this.buildFogPatches();
    this.buildFireflies();
    this.buildPlayer();
    this.buildSurvivors();
    this.buildScouts();
    this.buildSpatialGrids();
    this.buildPost();

    this.addListeners();
    this.clock.start();
    this.loop();
  }

  private buildLighting() {
    const hemi = new THREE.HemisphereLight(0x6b5a3a, 0x1a1510, 0.5);
    this.scene.add(hemi);

    // low dusk sun
    const sun = new THREE.DirectionalLight(0xd99a4e, 0.65);
    sun.position.set(-60, 40, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 250;
    const d = 120;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x3a4a66, 0.25);
    fill.position.set(40, 20, 60);
    this.scene.add(fill);
  }

  private buildTerrain() {
    const geo = new THREE.PlaneGeometry(FIELD * 2.4, FIELD * 2.4, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    // displacement: churned earth craters & ridges
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y =
        Math.sin(x * 0.05) * 1.4 +
        Math.cos(z * 0.045) * 1.3 +
        Math.sin((x + z) * 0.12) * 0.6;
      // craters
      y -= Math.exp(-((x - 20) ** 2 + (z + 10) ** 2) / 220) * 3;
      y -= Math.exp(-((x + 30) ** 2 + (z - 25) ** 2) / 260) * 2.6;
      y += (Math.random() - 0.5) * 0.25;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x40362a,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: false,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // dark blood/scorch decals via simple dark circles
    for (let i = 0; i < 18; i++) {
      const r = 2 + Math.random() * 5;
      const cg = new THREE.CircleGeometry(r, 16);
      cg.rotateX(-Math.PI / 2);
      const cm = new THREE.MeshStandardMaterial({
        color: 0x1a0f0a,
        roughness: 1,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const c = new THREE.Mesh(cg, cm);
      c.position.set((Math.random() - 0.5) * FIELD * 1.6, 0.05, (Math.random() - 0.5) * FIELD * 1.6);
      c.renderOrder = 1;
      this.scene.add(c);
    }
  }

  private terrainHeight(x: number, z: number): number {
    let y =
      Math.sin(x * 0.05) * 1.4 +
      Math.cos(z * 0.045) * 1.3 +
      Math.sin((x + z) * 0.12) * 0.6;
    y -= Math.exp(-((x - 20) ** 2 + (z + 10) ** 2) / 220) * 3;
    y -= Math.exp(-((x + 30) ** 2 + (z - 25) ** 2) / 260) * 2.6;
    return y;
  }

  private buildDetritus() {
    // InstancedMesh of broken spears / debris
    const count = 320;
    const geo = new THREE.BoxGeometry(0.12, 3.2, 0.12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x52443a, roughness: 0.9 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * FIELD * 2;
      const z = (Math.random() - 0.5) * FIELD * 2;
      const y = this.terrainHeight(x, z);
      dummy.position.set(x, y + 1.2, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 1.4,
        Math.random() * Math.PI,
        Math.PI / 2 + (Math.random() - 0.5) * 1.2,
      );
      dummy.scale.setScalar(0.6 + Math.random() * 0.8);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);

    // fallen shields (flat discs)
    const sCount = 90;
    const sgeo = new THREE.CylinderGeometry(0.9, 0.9, 0.12, 10);
    const smat = new THREE.MeshStandardMaterial({ color: 0x6b5535, roughness: 0.7, metalness: 0.4 });
    const sinst = new THREE.InstancedMesh(sgeo, smat, sCount);
    sinst.castShadow = true;
    sinst.receiveShadow = true;
    for (let i = 0; i < sCount; i++) {
      const x = (Math.random() - 0.5) * FIELD * 2;
      const z = (Math.random() - 0.5) * FIELD * 2;
      const y = this.terrainHeight(x, z);
      dummy.position.set(x, y + 0.12, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      dummy.scale.setScalar(0.7 + Math.random() * 0.7);
      dummy.updateMatrix();
      sinst.setMatrixAt(i, dummy.matrix);
    }
    sinst.instanceMatrix.needsUpdate = true;
    this.scene.add(sinst);

    // fallen/dead bodies (low mounds, dark) — InstancedMesh
    const bCount = 60;
    const bgeo = new THREE.CapsuleGeometry(0.5, 1.4, 4, 8);
    bgeo.rotateZ(Math.PI / 2);
    const bmat = new THREE.MeshStandardMaterial({ color: 0x33281e, roughness: 1 });
    const binst = new THREE.InstancedMesh(bgeo, bmat, bCount);
    binst.castShadow = true;
    for (let i = 0; i < bCount; i++) {
      const x = (Math.random() - 0.5) * FIELD * 1.9;
      const z = (Math.random() - 0.5) * FIELD * 1.9;
      const y = this.terrainHeight(x, z);
      dummy.position.set(x, y + 0.4, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(0.8 + Math.random() * 0.4);
      dummy.updateMatrix();
      binst.setMatrixAt(i, dummy.matrix);
    }
    binst.instanceMatrix.needsUpdate = true;
    this.scene.add(binst);
  }

  private buildFogPatches() {
    for (let i = 0; i < 10; i++) {
      const size = 24 + Math.random() * 30;
      const geo = new THREE.PlaneGeometry(size, size);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        vertexShader: fogVertex,
        fragmentShader: fogFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: Math.random() * 100 },
          uColor: { value: new THREE.Color(0x8a98a8) },
          uOpacity: { value: 0.5 + Math.random() * 0.3 },
        },
      });
      const m = new THREE.Mesh(geo, mat);
      const x = (Math.random() - 0.5) * FIELD * 1.8;
      const z = (Math.random() - 0.5) * FIELD * 1.8;
      m.position.set(x, this.terrainHeight(x, z) + 1.2, z);
      m.renderOrder = 3;
      this.scene.add(m);
      this.fogPatches.push({ mesh: m, mat });
    }
  }

  private buildFireflies() {
    const n = 400;
    const positions = new Float32Array(n * 3);
    const phases = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * FIELD * 2;
      const z = (Math.random() - 0.5) * FIELD * 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = this.terrainHeight(x, z) + 1 + Math.random() * 6;
      positions[i * 3 + 2] = z;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        varying float vTw;
        void main(){
          vec3 p = position;
          p.y += sin(uTime * 0.6 + aPhase) * 1.2;
          p.x += cos(uTime * 0.3 + aPhase) * 0.8;
          vTw = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 2.0 + aPhase));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + vTw * 4.0) * (60.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vTw;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vTw;
          vec3 col = mix(vec3(0.6,0.9,0.6), vec3(0.9,0.8,0.4), vTw);
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.scene.add(this.fireflies);
  }

  private buildPlayer() {
    this.player = new THREE.Group();
    // robe body
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 3.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x2c2a4a, roughness: 0.7 }),
    );
    body.position.y = 1.6;
    body.castShadow = true;
    this.player.add(body);
    // head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.6 }),
    );
    head.position.y = 3.4;
    head.castShadow = true;
    this.player.add(head);
    // hood
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1, 10),
      new THREE.MeshStandardMaterial({ color: 0x232140, roughness: 0.8 }),
    );
    hood.position.y = 3.7;
    this.player.add(hood);
    // staff
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 4, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }),
    );
    staff.position.set(0.9, 2, 0.2);
    staff.rotation.z = -0.15;
    this.player.add(staff);
    // glowing orb on staff
    this.staffOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x66ddff,
        emissive: 0x44ccff,
        emissiveIntensity: 4,
        roughness: 0.2,
      }),
    );
    this.staffOrb.position.set(0.95, 4.1, 0.2);
    this.player.add(this.staffOrb);

    this.playerLight = new THREE.PointLight(0x66ddff, 90, 55, 2);
    this.playerLight.position.set(0.95, 4.1, 0.2);
    this.playerLight.castShadow = true;
    this.playerLight.shadow.mapSize.set(512, 512);
    this.player.add(this.playerLight);

    this.player.position.copy(this.playerPos);
    this.player.position.y = this.terrainHeight(this.playerPos.x, this.playerPos.z);
    this.scene.add(this.player);
  }

  private buildSurvivors() {
    for (let i = 0; i < SURVIVOR_COUNT; i++) {
      const group = new THREE.Group();
      // crawling/wounded body — kneeling capsule
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 });
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

      const light = new THREE.PointLight(0xffaa55, 6, 10, 2);
      light.position.y = 1.5;
      group.add(light);

      // cluster placement: a few clusters around the field
      const cluster = Math.floor(i / 3);
      const cx = Math.cos(cluster * 1.7) * (20 + cluster * 12);
      const cz = Math.sin(cluster * 2.1) * (15 + cluster * 10) - 10;
      const x = cx + (Math.random() - 0.5) * 14;
      const z = cz + (Math.random() - 0.5) * 14;
      const y = this.terrainHeight(x, z);
      group.position.set(x, y, z);

      this.scene.add(group);
      this.survivors.push({
        mesh: group,
        pos: new THREE.Vector3(x, y, z),
        life: 0.55 + Math.random() * 0.35,
        rescued: false,
        dead: false,
        ward: null,
        name: NAMES[i % NAMES.length],
        cryT: Math.random() * 3,
        light,
        bodyMat,
      });
    }
  }

  private buildScouts() {
    for (let i = 0; i < SCOUT_COUNT; i++) {
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

      const x = (Math.random() - 0.5) * FIELD * 1.5;
      const z = -FIELD * 0.6 + (Math.random() - 0.5) * 30;
      const y = this.terrainHeight(x, z);
      group.position.set(x, y, z);
      this.scene.add(group);

      const scout: Scout = {
        group,
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(),
        waypoint: this.randomWaypoint(),
        light,
      };
      this.scouts.push(scout);
    }
  }

  private randomWaypoint(): THREE.Vector3 {
    const x = (Math.random() - 0.5) * FIELD * 1.6;
    const z = (Math.random() - 0.5) * FIELD * 1.6;
    return new THREE.Vector3(x, 0, z);
  }

  private buildSpatialGrids() {
    // Initialize spatial grids for efficient collision detection
    const fieldBounds = {
      min: new THREE.Vector3(-FIELD, 0, -FIELD),
      max: new THREE.Vector3(FIELD, 0, FIELD)
    };
    
    this.survivorSpatialGrid = new SpatialGrid<Survivor>(fieldBounds, 25);
    this.scoutSpatialGrid = new SpatialGrid<Scout>(fieldBounds, 30);
    
    // Add existing survivors and scouts to grids
    for (const survivor of this.survivors) {
      this.survivorSpatialGrid.add(survivor);
    }
    
    for (const scout of this.scouts) {
      this.scoutSpatialGrid.add(scout);
    }
  }

  private buildPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.9, // strength
      0.6, // radius
      0.2, // threshold
    );
    this.composer.addPass(this.bloom);

    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
    
    // Initialize ward pools
    this.initializeWardPools();
  }

  private initializeWardPools() {
    const initialPoolSize = 8;
    
    // Create protect wards pool
    for (let i = 0; i < initialPoolSize; i++) {
      const ward = this.createWard(true);
      ward.active = false;
      this.wardPool.protectWards.push(ward);
    }
    
    // Create heal wards pool
    for (let i = 0; i < initialPoolSize; i++) {
      const ward = this.createWard(false);
      ward.active = false;
      this.wardPool.healWards.push(ward);
    }
  }

  private createWard(protect: boolean): Ward {
    const radius = protect ? 12 : 9;
    const geo = new THREE.CircleGeometry(radius, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: wardVertex,
      fragmentShader: wardFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(protect ? 0x3a7bd5 : 0x49e09b) },
        uColor2: { value: new THREE.Color(protect ? 0x9ad7ff : 0xd8ffd0) },
        uIntensity: { value: 1.6 },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    
    return {
      mesh,
      mat,
      age: 0,
      ttl: protect ? 9 : 2.5,
      radius,
      protect,
      active: true // Will be set to false when pooled
    };
  }

  private addListeners() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.onResize);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = true;
    if (e.key === " ") {
      e.preventDefault();
      this.castWard(true);
    }
    if (e.key.toLowerCase() === "e") this.castWard(false);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -FIELD, FIELD);
      hit.z = THREE.MathUtils.clamp(hit.z, -FIELD, FIELD);
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

  // ---------------- ACTIONS ----------------
  public castWard(protect: boolean) {
    // Input validation
    if (typeof protect !== "boolean") {
      console.warn("castWard: protect parameter must be a boolean");
      return;
    }
    
    if (this.status !== "playing") return;
    if (protect && this.wardCD > 0) return;
    if (!protect && this.healCD > 0) return;

    // Get ward from pool or create new one if pool is empty
    const pool = protect ? this.wardPool.protectWards : this.wardPool.healWards;
    let ward: Ward;
    
    if (pool.length > 0) {
      // Reuse from pool
      ward = pool.pop()!;
      ward.active = true;
      ward.age = 0;
      ward.mesh.position.copy(this.playerPos);
      ward.mesh.position.y = this.terrainHeight(this.playerPos.x, this.playerPos.z) + 0.15;
      
      // Reset uniforms
      ward.mat.uniforms.uTime.value = 0;
      ward.mat.uniforms.uProgress.value = 0;
      ward.mat.uniforms.uIntensity.value = 1.6;
    } else {
      // Create new ward (pool expansion)
      ward = this.createWard(protect);
      ward.mesh.position.copy(this.playerPos);
      ward.mesh.position.y = this.terrainHeight(this.playerPos.x, this.playerPos.z) + 0.15;
    }

    // Add to scene if not already there
    if (!ward.mesh.parent) {
      this.scene.add(ward.mesh);
    }

    this.wards.push(ward);

    if (protect) this.wardCD = this.WARD_CD_MAX;
    else this.healCD = this.HEAL_CD_MAX;

    // immediate effect on nearby survivors
    for (const s of this.survivors) {
      if (s.rescued || s.dead) continue;
      const dist = s.pos.distanceTo(this.playerPos);
      if (dist <= ward.radius) {
        if (protect) {
          s.ward = ward;
          if (s.life < 0.35) s.life = 0.35;
        } else {
          s.life = Math.min(1, s.life + 0.45);
          // a healed-to-full survivor in heal pulse becomes rescuable
          if (s.life >= 0.9) this.rescue(s);
        }
      }
    }

    this.flash(protect ? 0x66ddff : 0x66ffaa);
  }

  private flash(color: number) {
    (this.staffOrb.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    this.playerLight.color.setHex(color);
    setTimeout(() => {
      (this.staffOrb.material as THREE.MeshStandardMaterial).emissive.setHex(0x44ccff);
      this.playerLight.color.setHex(0x66ddff);
    }, 250);
  }

  private rescue(s: Survivor) {
    if (s.rescued || s.dead) return;
    s.rescued = true;
    this.saved++;
    this.morale = Math.min(100, this.morale + 6 + Math.round(s.life * 4));
    this.setMessage(`${s.name} rescued! The light shielded them.`);
    // visual: turn body green-tinted and lift light
    s.bodyMat.color.setHex(0x5ab07a);
    s.bodyMat.emissive = new THREE.Color(0x113322);
    s.light.color.setHex(0x66ffaa);
    s.light.intensity = 10;
  }

  private killSurvivor(s: Survivor) {
    if (s.rescued || s.dead) return;
    s.dead = true;
    this.lostCount++;
    this.morale = Math.max(0, this.morale - 9);
    this.setMessage(`${s.name} was lost to the dark...`);
    s.bodyMat.color.setHex(0x2a1810);
    s.light.intensity = 0;
  }

  private setMessage(m: string) {
    this.message = m;
    this.messageT = 3.5;
  }

  // ---------------- LOOP ----------------
  private loop = () => {
    try {
      this.raf = requestAnimationFrame(this.loop);
      
      // Start performance monitoring
      const frameStart = performance.now();

      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;

      if (this.status === "playing") this.update(dt);
      this.updateVisuals(dt, t);

      this.composer.render();
      this.emitState();

      // End performance monitoring
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      this.performanceMonitor.addFrameTime(frameTime);
      
      // Log performance stats periodically
      this.logPerformanceStats(t);
    } catch (error) {
      console.error("Error in game loop:", error);
      this.dispose(); // Clean up resources
      // Re-throw to crash the app (will be caught by ErrorBoundary)
      throw error;
    }
  };

  private logPerformanceStats(t: number) {
    // Log performance stats every 5 seconds
    if (t - this.lastPerformanceLog >= 5) {
      const stats = this.performanceMonitor.getStats();
      console.log(`[PERF] FPS: ${stats.fps}, Avg: ${stats.avgFrameTime}ms, ` +
                  `Min: ${stats.minFrameTime}ms, Max: ${stats.maxFrameTime}ms`);
      this.lastPerformanceLog = t;
    }
  }

  private update(dt: number) {
    PerformanceMonitor.logPerformanceMark("update-start");
    
    // timers
    this.timeLeft -= dt;
    this.wardCD = Math.max(0, this.wardCD - dt);
    this.healCD = Math.max(0, this.healCD - dt);

    this.updatePlayer(dt);
    this.updateSurvivors(dt);
    this.updateScouts(dt);
    this.updateWards(dt);

    if (this.messageT > 0) {
      this.messageT -= dt;
      if (this.messageT <= 0) this.message = null;
    }

    // win/lose
    const resolved = this.survivors.filter((s) => s.rescued || s.dead).length;
    if (resolved >= SURVIVOR_COUNT || this.timeLeft <= 0 || this.playerHealth <= 0) {
      this.endGame();
    }
    
    PerformanceMonitor.logPerformanceMark("update-end");
    PerformanceMonitor.logPerformanceMeasure("update-start", "update-end", "game-update");
  }

  private updatePlayer(dt: number) {
    const speed = 22;
    const dir = new THREE.Vector3();
    // camera-relative WASD
    if (this.keys["w"] || this.keys["arrowup"]) dir.z -= 1;
    if (this.keys["s"] || this.keys["arrowdown"]) dir.z += 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dir.x -= 1;
    if (this.keys["d"] || this.keys["arrowright"]) dir.x += 1;

    if (dir.lengthSq() > 0) {
      this.moveTarget = null;
      dir.normalize();
      this.playerVel.lerp(dir.multiplyScalar(speed), 0.2);
    } else if (this.moveTarget) {
      const to = this.tmpV.copy(this.moveTarget).sub(this.playerPos);
      to.y = 0;
      if (to.length() < 1.2) {
        this.moveTarget = null;
        this.playerVel.multiplyScalar(0.6);
      } else {
        to.normalize().multiplyScalar(speed);
        this.playerVel.lerp(to, 0.15);
      }
    } else {
      this.playerVel.multiplyScalar(0.8);
    }

    this.playerPos.addScaledVector(this.playerVel, dt);
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -FIELD, FIELD);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -FIELD, FIELD);
    const gy = this.terrainHeight(this.playerPos.x, this.playerPos.z);
    this.player.position.set(this.playerPos.x, gy, this.playerPos.z);

    // face movement
    if (this.playerVel.lengthSq() > 1) {
      const a = Math.atan2(this.playerVel.x, this.playerVel.z);
      this.player.rotation.y = THREE.MathUtils.lerp(this.player.rotation.y, a, 0.15);
    }

    // camera follow
    const camTarget = this.tmpV.set(
      this.playerPos.x,
      gy + 26,
      this.playerPos.z + 30,
    );
    this.camera.position.lerp(camTarget, 0.06);
    this.camera.lookAt(this.playerPos.x, gy + 3, this.playerPos.z - 4);
  }

  private updateSurvivors(dt: number) {
    let nearDanger = 0;
    for (const s of this.survivors) {
      if (s.rescued || s.dead) continue;

      // Update spatial grid position
      this.survivorSpatialGrid.updateItem(s);

      // protected by an active ward?
      const protectedByWard = s.ward && this.wards.includes(s.ward) && s.ward.protect;

      // life decays from approaching darkness/scouts
      let drain = 0.012;
      
      // Use spatial grid to find nearby scouts (much more efficient)
      const nearbyScouts = this.scoutSpatialGrid.queryNearby(s.pos, 16);
      for (const sc of nearbyScouts) {
        const d = sc.pos.distanceTo(s.pos);
        if (d < 16) {
          drain += (1 - d / 16) * 0.09;
          nearDanger++;
        }
      }
      if (protectedByWard) drain *= 0.05;
      s.life = Math.max(0, s.life - drain * dt * 4);

      // pulse light by life & cry
      s.cryT -= dt;
      s.light.intensity = 4 + Math.sin(performance.now() * 0.005) * 2 * s.life + (1 - s.life) * 3;

      if (s.life <= 0) this.killSurvivor(s);
    }
    this.dangerLevel = THREE.MathUtils.lerp(this.dangerLevel, Math.min(1, nearDanger * 0.3), 0.08);
  }

  private updateScouts(dt: number) {
    const speed = 9;
    for (const sc of this.scouts) {
      // Update spatial grid position
      this.scoutSpatialGrid.updateItem(sc);
      
      // seek nearest unrescued survivor (hunt), else patrol waypoint
      let target: THREE.Vector3 | null = null;
      let best = Infinity;
      
      // Use spatial grid to find nearby survivors (much more efficient)
      const nearbySurvivors = this.survivorSpatialGrid.queryNearby(sc.pos, 45);
      for (const s of nearbySurvivors) {
        if (s.rescued || s.dead) continue;
        const d = sc.pos.distanceTo(s.pos);
        if (d < 45 && d < best) {
          best = d;
          target = s.pos;
        }
      }
      const goal = target || sc.waypoint;
      const to = this.tmpV.copy(goal).sub(sc.pos);
      to.y = 0;
      if (to.length() < 3 && !target) {
        sc.waypoint = this.randomWaypoint();
      }

      // avoid player wards (steer away from active protect wards)
      for (const w of this.wards) {
        if (!w.protect) continue;
        const dw = sc.pos.distanceTo(w.mesh.position);
        if (dw < w.radius + 6) {
          const away = this.scene.position.clone();
          away.copy(sc.pos).sub(w.mesh.position).setY(0).normalize().multiplyScalar(40);
          to.add(away);
        }
      }

      to.setY(0);
      if (to.lengthSq() > 0) to.normalize().multiplyScalar(speed);
      sc.vel.lerp(to, 0.05);
      sc.pos.addScaledVector(sc.vel, dt);
      sc.pos.x = THREE.MathUtils.clamp(sc.pos.x, -FIELD, FIELD);
      sc.pos.z = THREE.MathUtils.clamp(sc.pos.z, -FIELD, FIELD);
      const gy = this.terrainHeight(sc.pos.x, sc.pos.z);
      sc.group.position.set(sc.pos.x, gy, sc.pos.z);
      if (sc.vel.lengthSq() > 0.2) {
        sc.group.rotation.y = Math.atan2(sc.vel.x, sc.vel.z);
      }

      // damage player if very close
      const dp = sc.pos.distanceTo(this.playerPos);
      if (dp < 6) {
        // player shielded if standing in own ward
        let shielded = false;
        for (const w of this.wards) {
          if (w.protect && this.playerPos.distanceTo(w.mesh.position) < w.radius) shielded = true;
        }
        if (!shielded) this.playerHealth = Math.max(0, this.playerHealth - 0.12 * dt);
      }
    }
    if (this.playerHealth < 1) this.playerHealth = Math.min(1, this.playerHealth + 0.01 * dt);
  }

  private updateWards(dt: number) {
    for (let i = this.wards.length - 1; i >= 0; i--) {
      const w = this.wards[i];
      w.age += dt;
      w.mat.uniforms.uTime.value += dt;
      const p = Math.min(1, w.age / 0.5);
      w.mat.uniforms.uProgress.value = p;
      const fade = w.age > w.ttl - 1 ? Math.max(0, (w.ttl - w.age)) : 1;
      w.mat.uniforms.uIntensity.value = 1.6 * fade;
      if (w.age >= w.ttl) {
        // Return to pool instead of disposing
        w.active = false;
        this.scene.remove(w.mesh);
        this.wards.splice(i, 1);
        
        // Return to appropriate pool
        const pool = w.protect ? this.wardPool.protectWards : this.wardPool.healWards;
        pool.push(w);
        
        for (const s of this.survivors) if (s.ward === w) s.ward = null;
      }
    }
  }

  private updateVisuals(dt: number, t: number) {
    for (const f of this.fogPatches) f.mat.uniforms.uTime.value += dt;
    (this.fireflies.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.staffOrb.rotation.y += dt * 2;
    this.vignette.uniforms.uDanger.value = this.dangerLevel;
    this.vignette.uniforms.uTime.value = t;
    this.bloom.strength = 0.85 + this.dangerLevel * 0.4;
  }

  private endGame() {
    const ratio = this.saved / SURVIVOR_COUNT;
    this.status = ratio >= 0.5 || this.morale >= 60 ? "won" : "lost";
  }

  // project world to normalized screen for HTML markers
  private project(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    this.tmpV.copy(v);
    this.tmpV.y += 2.5;
    this.tmpV.project(this.camera);
    const visible = this.tmpV.z < 1 && this.tmpV.x > -1.3 && this.tmpV.x < 1.3 && this.tmpV.y > -1.3 && this.tmpV.y < 1.3;
    return {
      x: (this.tmpV.x * 0.5 + 0.5),
      y: (-this.tmpV.y * 0.5 + 0.5),
      visible,
    };
  }

  private emitState() {
    if (!this.listener) return;
    const survUI: SurvivorUI[] = this.survivors.map((s, id) => {
      const pr = this.project(s.pos);
      return {
        id,
        x: pr.x,
        y: pr.y,
        dist: s.pos.distanceTo(this.playerPos),
        life: s.life,
        visible: pr.visible && !s.rescued && !s.dead,
        rescued: s.rescued,
        critical: s.life < 0.3,
        name: s.name,
      };
    });
    const scoutUI: ScoutUI[] = this.scouts.map((sc, id) => {
      const pr = this.project(sc.pos);
      return { id, x: pr.x, y: pr.y, dist: sc.pos.distanceTo(this.playerPos), visible: pr.visible };
    });

    this.listener({
      status: this.status,
      saved: this.saved,
      lost: this.lostCount,
      total: SURVIVOR_COUNT,
      morale: Math.round(this.morale),
      wardCooldown: 1 - this.wardCD / this.WARD_CD_MAX,
      healCooldown: 1 - this.healCD / this.HEAL_CD_MAX,
      survivors: survUI,
      scouts: scoutUI,
      playerHealth: this.playerHealth,
      timeLeft: Math.max(0, Math.ceil(this.timeLeft)),
      message: this.message,
    });
  }

  public dispose() {
    cancelAnimationFrame(this.raf);
    
    // Remove event listeners
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    
    // Clean up Three.js resources
    this.cleanupThreeResources();
    
    // Clean up renderer
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private cleanupThreeResources() {
    try {
      // Dispose of active wards
      for (const ward of this.wards) {
        this.scene.remove(ward.mesh);
      }
      this.wards = [];
      
      // Dispose of ward pools
      for (const ward of this.wardPool.protectWards) {
        if (ward.mesh.parent) {
          this.scene.remove(ward.mesh);
        }
        ward.mesh.geometry.dispose();
        ward.mat.dispose();
      }
      for (const ward of this.wardPool.healWards) {
        if (ward.mesh.parent) {
          this.scene.remove(ward.mesh);
        }
        ward.mesh.geometry.dispose();
        ward.mat.dispose();
      }
      this.wardPool = { protectWards: [], healWards: [] };

      // Dispose of fog patches
      for (const fog of this.fogPatches) {
        this.scene.remove(fog.mesh);
        fog.mesh.geometry.dispose();
        fog.mat.dispose();
      }
      this.fogPatches = [];

      // Dispose of fireflies
      if (this.fireflies) {
        this.scene.remove(this.fireflies);
        this.fireflies.geometry.dispose();
        (this.fireflies.material as THREE.ShaderMaterial).dispose();
      }

      // Dispose of survivors
      for (const survivor of this.survivors) {
        this.scene.remove(survivor.mesh);
        survivor.mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        survivor.light.dispose();
      }
      this.survivors = [];

      // Dispose of scouts
      for (const scout of this.scouts) {
        this.scene.remove(scout.group);
        scout.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        scout.light.dispose();
      }
      this.scouts = [];

      // Dispose of player
      if (this.player) {
        this.scene.remove(this.player);
        this.player.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
        this.playerLight.dispose();
      }

      // Dispose of composer passes
      if (this.composer) {
        this.composer.passes.forEach((pass) => {
          if (pass instanceof THREE.ShaderPass) {
            pass.material?.dispose();
          }
        });
      }

      // Clear scene (just in case)
      while (this.scene.children.length > 0) {
        const obj = this.scene.children[0];
        this.scene.remove(obj);
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      }
      
      // Clean up spatial grids
      if (this.survivorSpatialGrid) {
        this.survivorSpatialGrid.clear();
      }
      if (this.scoutSpatialGrid) {
        this.scoutSpatialGrid.clear();
      }

    } catch (error) {
      console.error("Error during Three.js resource cleanup:", error);
      // Continue with disposal even if some parts fail
    }
  }
}
