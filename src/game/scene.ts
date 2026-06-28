import * as THREE from "three";
import { fogVertex, fogFragment } from "./shaders";
import { CONFIG } from "./config";

export function buildLighting(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0x6b5a3a, 0x1a1510, 0.5);
  scene.add(hemi);

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
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x3a4a66, 0.25);
  fill.position.set(40, 20, 60);
  scene.add(fill);
}

export function terrainHeight(x: number, z: number): number {
  let y =
    Math.sin(x * 0.05) * 1.4 +
    Math.cos(z * 0.045) * 1.3 +
    Math.sin((x + z) * 0.12) * 0.6;
  y -= Math.exp(-((x - 20) ** 2 + (z + 10) ** 2) / 220) * 3;
  y -= Math.exp(-((x + 30) ** 2 + (z - 25) ** 2) / 260) * 2.6;
  return y;
}

export function buildTerrain(scene: THREE.Scene): THREE.Mesh {
  const F = CONFIG.field;
  const geo = new THREE.PlaneGeometry(F * 2.4, F * 2.4, 140, 140);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z) + (Math.random() - 0.5) * 0.25;
    pos.setY(i, y);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x40362a, roughness: 0.95, metalness: 0.05,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);

  for (let i = 0; i < 18; i++) {
    const r = 2 + Math.random() * 5;
    const cg = new THREE.CircleGeometry(r, 16);
    cg.rotateX(-Math.PI / 2);
    const cm = new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    const c = new THREE.Mesh(cg, cm);
    c.position.set((Math.random() - 0.5) * F * 1.6, 0.05, (Math.random() - 0.5) * F * 1.6);
    c.renderOrder = 1;
    scene.add(c);
  }

  return ground;
}

export function buildDetritus(scene: THREE.Scene) {
  const F = CONFIG.field;
  const dummy = new THREE.Object3D();

  const count = 320;
  const geo = new THREE.BoxGeometry(0.12, 3.2, 0.12);
  const mat = new THREE.MeshStandardMaterial({ color: 0x52443a, roughness: 0.9 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.castShadow = true;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * F * 2;
    const z = (Math.random() - 0.5) * F * 2;
    const y = terrainHeight(x, z);
    dummy.position.set(x, y + 1.2, z);
    dummy.rotation.set((Math.random() - 0.5) * 1.4, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 1.2);
    dummy.scale.setScalar(0.6 + Math.random() * 0.8);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  const sCount = 90;
  const sgeo = new THREE.CylinderGeometry(0.9, 0.9, 0.12, 10);
  const smat = new THREE.MeshStandardMaterial({ color: 0x6b5535, roughness: 0.7, metalness: 0.4 });
  const sinst = new THREE.InstancedMesh(sgeo, smat, sCount);
  sinst.castShadow = true;
  sinst.receiveShadow = true;
  for (let i = 0; i < sCount; i++) {
    const x = (Math.random() - 0.5) * F * 2;
    const z = (Math.random() - 0.5) * F * 2;
    const y = terrainHeight(x, z);
    dummy.position.set(x, y + 0.12, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    dummy.scale.setScalar(0.7 + Math.random() * 0.7);
    dummy.updateMatrix();
    sinst.setMatrixAt(i, dummy.matrix);
  }
  sinst.instanceMatrix.needsUpdate = true;
  scene.add(sinst);

  const bCount = 60;
  const bgeo = new THREE.CapsuleGeometry(0.5, 1.4, 4, 8);
  bgeo.rotateZ(Math.PI / 2);
  const bmat = new THREE.MeshStandardMaterial({ color: 0x33281e, roughness: 1 });
  const binst = new THREE.InstancedMesh(bgeo, bmat, bCount);
  binst.castShadow = true;
  for (let i = 0; i < bCount; i++) {
    const x = (Math.random() - 0.5) * F * 1.9;
    const z = (Math.random() - 0.5) * F * 1.9;
    const y = terrainHeight(x, z);
    dummy.position.set(x, y + 0.4, z);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.setScalar(0.8 + Math.random() * 0.4);
    dummy.updateMatrix();
    binst.setMatrixAt(i, dummy.matrix);
  }
  binst.instanceMatrix.needsUpdate = true;
  scene.add(binst);
}

export interface FogPatch {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

export function buildFogPatches(scene: THREE.Scene): FogPatch[] {
  const patches: FogPatch[] = [];
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
    const F = CONFIG.field;
    const x = (Math.random() - 0.5) * F * 1.8;
    const z = (Math.random() - 0.5) * F * 1.8;
    m.position.set(x, terrainHeight(x, z) + 1.2, z);
    m.renderOrder = 3;
    scene.add(m);
    patches.push({ mesh: m, mat });
  }
  return patches;
}

export function buildFireflies(scene: THREE.Scene): THREE.Points {
  const F = CONFIG.field;
  const n = 400;
  const positions = new Float32Array(n * 3);
  const phases = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * F * 2;
    const z = (Math.random() - 0.5) * F * 2;
    positions[i * 3] = x;
    positions[i * 3 + 1] = terrainHeight(x, z) + 1 + Math.random() * 6;
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
    vertexShader: `
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
    fragmentShader: `
      varying float vTw;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vTw;
        vec3 col = mix(vec3(0.6,0.9,0.6), vec3(0.9,0.8,0.4), vTw);
        gl_FragColor = vec4(col, a);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
}
