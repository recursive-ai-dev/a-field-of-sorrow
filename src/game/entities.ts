import * as THREE from "three";
import { terrainHeight } from "./scene";
import { CONFIG, NAMES } from "./config";
import type { Survivor, Scout, Ward } from "./types";

export function buildSurvivors(scene: THREE.Scene): Survivor[] {
  const survivors: Survivor[] = [];
  for (let i = 0; i < CONFIG.survivorCount; i++) {
    const group = new THREE.Group();
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

    const cluster = Math.floor(i / 3);
    const cx = Math.cos(cluster * 1.7) * (20 + cluster * 12);
    const cz = Math.sin(cluster * 2.1) * (15 + cluster * 10) - 10;
    const x = cx + (Math.random() - 0.5) * 14;
    const z = cz + (Math.random() - 0.5) * 14;
    const y = terrainHeight(x, z);
    group.position.set(x, y, z);
    scene.add(group);

    survivors.push({
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
  return survivors;
}

export function buildScouts(scene: THREE.Scene): Scout[] {
  const scouts: Scout[] = [];
  for (let i = 0; i < CONFIG.scoutCount; i++) {
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
    const x = (Math.random() - 0.5) * F * 1.5;
    const z = -F * 0.6 + (Math.random() - 0.5) * 30;
    const y = terrainHeight(x, z);
    group.position.set(x, y, z);
    scene.add(group);

    scouts.push({
      group,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      waypoint: randomWaypoint(),
      light,
    });
  }
  return scouts;
}

function randomWaypoint(): THREE.Vector3 {
  const F = CONFIG.field;
  return new THREE.Vector3((Math.random() - 0.5) * F * 1.6, 0, (Math.random() - 0.5) * F * 1.6);
}

export function updateSurvivors(
  dt: number,
  survivors: Survivor[],
  scoutSpatialGrid: { queryNearby: (pos: THREE.Vector3, radius: number) => Scout[] },
  survivorSpatialGrid: { updateItem: (s: Survivor) => void },
  wards: Ward[],
  dangerLevel: { value: number },
  onKill: (s: Survivor) => void,
) {
  let nearDanger = 0;
  for (const s of survivors) {
    if (s.rescued || s.dead) continue;
    survivorSpatialGrid.updateItem(s);

    const protectedByWard = s.ward && wards.includes(s.ward) && s.ward.protect;
    let drain = CONFIG.survivorDecay;

    const nearbyScouts = scoutSpatialGrid.queryNearby(s.pos, CONFIG.scoutDrainRange);
    for (const sc of nearbyScouts) {
      const d = sc.pos.distanceTo(s.pos);
      if (d < CONFIG.scoutDrainRange) {
        drain += (1 - d / CONFIG.scoutDrainRange) * CONFIG.scoutDrain;
        nearDanger++;
      }
    }
    if (protectedByWard) drain *= CONFIG.wardProtectionFactor;
    s.life = Math.max(0, s.life - drain * dt * 4);

    s.cryT -= dt;
    s.light.intensity = 4 + Math.sin(performance.now() * 0.005) * 2 * s.life + (1 - s.life) * 3;

    if (s.life <= 0) onKill(s);
  }
  dangerLevel.value = THREE.MathUtils.lerp(dangerLevel.value, Math.min(1, nearDanger * 0.3), 0.08);
}

export function updateScouts(
  dt: number,
  scouts: Scout[],
  survivorSpatialGrid: { queryNearby: (pos: THREE.Vector3, radius: number) => Survivor[] },
  scoutSpatialGrid: { updateItem: (s: Scout) => void },
  playerPos: THREE.Vector3,
  playerHealth: { value: number },
  wards: Ward[],
  timeLeft: number,
  gameTime: number
) {
  const difficultyMultiplier = 1 + 0.5 * (1 - Math.max(0, timeLeft) / gameTime);
  const speed = CONFIG.scoutSpeed * difficultyMultiplier;
  for (const sc of scouts) {
    scoutSpatialGrid.updateItem(sc);

    let target: THREE.Vector3 | null = null;
    let best = Infinity;
    const nearbySurvivors = survivorSpatialGrid.queryNearby(sc.pos, CONFIG.scoutHuntRange);
    for (const s of nearbySurvivors) {
      if (s.rescued || s.dead) continue;
      const d = sc.pos.distanceTo(s.pos);
      if (d < CONFIG.scoutHuntRange && d < best) {
        best = d;
        target = s.pos;
      }
    }
    const goal = target || sc.waypoint;
    const to = new THREE.Vector3().copy(goal).sub(sc.pos);
    to.y = 0;
    if (to.length() < 3 && !target) {
      sc.waypoint = randomWaypoint();
    }

    for (const w of wards) {
      if (!w.protect) continue;
      const dw = sc.pos.distanceTo(w.mesh.position);
      if (dw < w.radius + 6) {
        const away = new THREE.Vector3().copy(sc.pos).sub(w.mesh.position).setY(0).normalize().multiplyScalar(40);
        to.add(away);
      }
    }

    to.setY(0);
    if (to.lengthSq() > 0) to.normalize().multiplyScalar(speed);
    sc.vel.lerp(to, 0.05);
    sc.pos.addScaledVector(sc.vel, dt);
    const F = CONFIG.field;
    sc.pos.x = THREE.MathUtils.clamp(sc.pos.x, -F, F);
    sc.pos.z = THREE.MathUtils.clamp(sc.pos.z, -F, F);
    const gy = terrainHeight(sc.pos.x, sc.pos.z);
    sc.group.position.set(sc.pos.x, gy, sc.pos.z);
    if (sc.vel.lengthSq() > 0.2) {
      sc.group.rotation.y = Math.atan2(sc.vel.x, sc.vel.z);
    }

    const dp = sc.pos.distanceTo(playerPos);
    if (dp < CONFIG.scoutDamageRange) {
      let shielded = false;
      for (const w of wards) {
        if (w.protect && playerPos.distanceTo(w.mesh.position) < w.radius) shielded = true;
      }
      if (!shielded) playerHealth.value = Math.max(0, playerHealth.value - CONFIG.scoutDamage * dt);
    }
  }
}
