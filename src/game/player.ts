import * as THREE from "three";
import { terrainHeight } from "./scene";
import { CONFIG } from "./config";

export function buildPlayer(scene: THREE.Scene, pos: THREE.Vector3) {
  const player = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x2c2a4a, roughness: 0.7 }),
  );
  body.position.y = 1.6;
  body.castShadow = true;
  player.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.6 }),
  );
  head.position.y = 3.4;
  head.castShadow = true;
  player.add(head);

  const hood = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0x232140, roughness: 0.8 }),
  );
  hood.position.y = 3.7;
  player.add(hood);

  const staff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }),
  );
  staff.position.set(0.9, 2, 0.2);
  staff.rotation.z = -0.15;
  player.add(staff);

  const staffOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x44ccff, emissiveIntensity: 4, roughness: 0.2 }),
  );
  staffOrb.position.set(0.95, 4.1, 0.2);
  player.add(staffOrb);

  const playerLight = new THREE.PointLight(0x66ddff, 90, 55, 2);
  playerLight.position.set(0.95, 4.1, 0.2);
  playerLight.castShadow = true;
  playerLight.shadow.mapSize.set(512, 512);
  player.add(playerLight);

  player.position.copy(pos);
  player.position.y = terrainHeight(pos.x, pos.z);
  scene.add(player);

  return { player, staffOrb, playerLight };
}

export function updatePlayer(
  dt: number,
  keys: Record<string, boolean>,
  camera: THREE.PerspectiveCamera,
  playerPos: THREE.Vector3,
  playerVel: THREE.Vector3,
  player: THREE.Group,
  moveTarget: THREE.Vector3 | null,
): THREE.Vector3 | null {
  const speed = CONFIG.playerSpeed;

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0;
  right.normalize();

  const dir = new THREE.Vector3();
  if (keys["w"] || keys["arrowup"]) dir.add(forward);
  if (keys["s"] || keys["arrowdown"]) dir.sub(forward);
  if (keys["a"] || keys["arrowleft"]) dir.sub(right);
  if (keys["d"] || keys["arrowright"]) dir.add(right);

  let newMoveTarget = moveTarget;

  if (dir.lengthSq() > 0) {
    newMoveTarget = null;
    dir.normalize();
    playerVel.lerp(dir.clone().multiplyScalar(speed), 0.2);
  } else if (newMoveTarget) {
    const to = new THREE.Vector3().copy(newMoveTarget).sub(playerPos);
    to.y = 0;
    if (to.length() < 1.2) {
      newMoveTarget = null;
      playerVel.multiplyScalar(0.6);
    } else {
      to.normalize().multiplyScalar(speed);
      playerVel.lerp(to, 0.15);
    }
  } else {
    playerVel.multiplyScalar(0.8);
  }

  playerPos.addScaledVector(playerVel, dt);
  const F = CONFIG.field;
  playerPos.x = THREE.MathUtils.clamp(playerPos.x, -F, F);
  playerPos.z = THREE.MathUtils.clamp(playerPos.z, -F, F);
  const gy = terrainHeight(playerPos.x, playerPos.z);
  player.position.set(playerPos.x, gy, playerPos.z);

  if (playerVel.lengthSq() > 1) {
    const a = Math.atan2(playerVel.x, playerVel.z);
    let diff = a - player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.rotation.y += diff * 0.15;
  }

  const camTarget = new THREE.Vector3(playerPos.x, gy + 26, playerPos.z + 30);
  camera.position.lerp(camTarget, 0.06);
  camera.lookAt(playerPos.x, gy + 3, playerPos.z - 4);

  return newMoveTarget;
}

export function flashOrb(staffOrb: THREE.Mesh, playerLight: THREE.PointLight, color: number) {
  (staffOrb.material as THREE.MeshStandardMaterial).emissive.setHex(color);
  playerLight.color.setHex(color);
  setTimeout(() => {
    (staffOrb.material as THREE.MeshStandardMaterial).emissive.setHex(0x44ccff);
    playerLight.color.setHex(0x66ddff);
  }, 250);
}
