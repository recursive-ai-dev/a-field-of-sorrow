import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { updateWards } from "../wards";
import { CONFIG } from "../config";
import type { Ward, Survivor } from "../types";

// Helper to create a mock Survivor
function createMockSurvivor(overrides: Partial<Survivor> = {}): Survivor {
  return {
    mesh: new THREE.Group(),
    pos: new THREE.Vector3(0, 0, 0),
    life: 0.5,
    rescued: false,
    dead: false,
    ward: null,
    name: "Test",
    cryT: 0,
    light: new THREE.PointLight(),
    bodyMat: new THREE.MeshStandardMaterial(),
    ...overrides,
  };
}

// Helper to create a mock Ward
function createMockWard(protect: boolean, pos: THREE.Vector3, overrides: Partial<Ward> = {}): Ward {
  const mesh = new THREE.Mesh();
  mesh.position.copy(pos);
  return {
    mesh,
    mat: new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uIntensity: { value: 1.6 },
      }
    }),
    age: 0,
    ttl: 10,
    radius: 12,
    protect,
    active: true,
    ...overrides,
  };
}

describe("Wards Logic Chains", () => {
  describe("updateWards", () => {
    it("heals survivors over time for healing wards", () => {
      const s1 = createMockSurvivor({ life: 0.5, pos: new THREE.Vector3(0, 0, 0) });
      const s2 = createMockSurvivor({ life: 0.5, pos: new THREE.Vector3(100, 0, 100) }); // Far away
      const ward = createMockWard(false, new THREE.Vector3(0, 0, 0)); // Healing ward
      const dt = 1.0;
      const onRescue = vi.fn();
      const scene = new THREE.Scene();

      updateWards(dt, scene, [ward], [s1, s2], onRescue);

      // s1 should be healed
      const expectedHealAmount = (CONFIG.healAmount / ward.ttl) * dt;
      expect(s1.life).toBeCloseTo(0.5 + expectedHealAmount);
      // s2 should not be healed
      expect(s2.life).toBe(0.5);
    });

    it("triggers onRescue if healing pushes life above threshold", () => {
      const s = createMockSurvivor({ life: CONFIG.rescueThreshold - 0.01, pos: new THREE.Vector3(0, 0, 0) });
      const ward = createMockWard(false, new THREE.Vector3(0, 0, 0)); // Healing ward
      const dt = 1.0;
      const onRescue = vi.fn();
      const scene = new THREE.Scene();

      updateWards(dt, scene, [ward], [s], onRescue);

      expect(s.life).toBeGreaterThanOrEqual(CONFIG.rescueThreshold);
      expect(onRescue).toHaveBeenCalledWith(s);
    });

    it("does not heal survivors for protection wards", () => {
      const s = createMockSurvivor({ life: 0.5, pos: new THREE.Vector3(0, 0, 0) });
      const ward = createMockWard(true, new THREE.Vector3(0, 0, 0)); // Protection ward
      const dt = 1.0;
      const onRescue = vi.fn();
      const scene = new THREE.Scene();

      updateWards(dt, scene, [ward], [s], onRescue);

      expect(s.life).toBe(0.5); // No change
    });

    it("removes wards after their time-to-live is exceeded", () => {
      const ward = createMockWard(true, new THREE.Vector3(0, 0, 0));
      ward.age = 9.5; // Almost at TTL (10)
      const dt = 1.0;
      const scene = new THREE.Scene();
      scene.add(ward.mesh);
      const wards = [ward];

      updateWards(dt, scene, wards, [], vi.fn());

      expect(wards.length).toBe(0); // Ward should be removed from the list
      expect(ward.active).toBe(false); // Ward marked inactive
      expect(scene.children.includes(ward.mesh)).toBe(false); // Mesh removed from scene
    });
  });
});
