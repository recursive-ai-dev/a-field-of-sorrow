import * as THREE from "three";
import { wardVertex, wardFragment } from "./shaders";
import { CONFIG } from "./config";
import type { Ward, Survivor } from "./types";

let wardPool: Ward[] = [];

export function createWard(protect: boolean): Ward {
  const radius = protect ? CONFIG.wardRadius : CONFIG.healRadius;
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
    ttl: protect ? CONFIG.wardDuration : CONFIG.healDuration,
    radius,
    protect,
    active: true,
  };
}

export function initializeWardPool(_scene: THREE.Scene, initialSize = 8) {
  wardPool = [];
  for (let i = 0; i < initialSize; i++) {
    const w = createWard(true);
    w.active = false;
    wardPool.push(w);
  }
  for (let i = 0; i < initialSize; i++) {
    const w = createWard(false);
    w.active = false;
    wardPool.push(w);
  }
}

export function castWard(
  scene: THREE.Scene,
  protect: boolean,
  playerPos: THREE.Vector3,
  terrainHeightFn: (x: number, z: number) => number,
  survivors: Survivor[],
  onRescue: (s: Survivor) => void,
  onFlash: (color: number) => void,
): { ward: Ward | null; cooldownDuration: number } {
  const pool = wardPool.filter(w => w.protect === protect && !w.active);
  let ward: Ward;

  if (pool.length > 0) {
    ward = pool[0];
    ward.active = true;
    ward.age = 0;
    ward.mesh.position.copy(playerPos);
    ward.mesh.position.y = terrainHeightFn(playerPos.x, playerPos.z) + 0.15;
    ward.mat.uniforms.uTime.value = 0;
    ward.mat.uniforms.uProgress.value = 0;
    ward.mat.uniforms.uIntensity.value = 1.6;
  } else {
    ward = createWard(protect);
    ward.mesh.position.copy(playerPos);
    ward.mesh.position.y = terrainHeightFn(playerPos.x, playerPos.z) + 0.15;
  }

  if (!ward.mesh.parent) {
    scene.add(ward.mesh);
  }

  // Handle immediate effects on cast
  for (const s of survivors) {
    if (s.rescued || s.dead) continue;
    const dist = s.pos.distanceTo(playerPos);
    if (dist <= ward.radius) {
      if (protect) {
        s.ward = ward;
        // Immediate small health boost for protection ward
        if (s.life < 0.35) s.life = 0.35;
      } else {
        // Immediate small boost for heal ward too
        s.life = Math.min(1, s.life + CONFIG.healAmount * 0.2);
        if (s.life >= CONFIG.rescueThreshold) onRescue(s);
      }
    }
  }

  onFlash(protect ? 0x66ddff : 0x66ffaa);
  return { ward, cooldownDuration: protect ? CONFIG.wardCooldown : CONFIG.healCooldown };
}

export function updateWards(
  dt: number,
  scene: THREE.Scene,
  wards: Ward[],
  survivors: Survivor[],
  onRescue: (s: Survivor) => void,
) {
  for (let i = wards.length - 1; i >= 0; i--) {
    const w = wards[i];
    w.age += dt;
    w.mat.uniforms.uTime.value += dt;
    const p = Math.min(1, w.age / 0.5);
    w.mat.uniforms.uProgress.value = p;
    const fade = w.age > w.ttl - 1 ? Math.max(0, w.ttl - w.age) : 1;
    w.mat.uniforms.uIntensity.value = 1.6 * fade;

    // Healing logic over time
    if (!w.protect) {
      for (const s of survivors) {
        if (s.rescued || s.dead) continue;
        const dist = s.pos.distanceTo(w.mesh.position);
        if (dist <= w.radius) {
          const healAmount = (CONFIG.healAmount / w.ttl) * dt;
          s.life = Math.min(1, s.life + healAmount);
          if (s.life >= CONFIG.rescueThreshold) onRescue(s);
        }
      }
    }

    if (w.age >= w.ttl) {
      w.active = false;
      scene.remove(w.mesh);
      wards.splice(i, 1);
      wardPool.push(w);
      for (const s of survivors) if (s.ward === w) s.ward = null;
    }
  }
}

export function getWardPool() {
  return wardPool;
}
