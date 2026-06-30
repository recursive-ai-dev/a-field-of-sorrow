import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { updateSurvivors, updateScouts } from "../entities";
import { CONFIG } from "../config";
import type { Survivor, Scout, Ward } from "../types";

// Helper to create a mock Survivor
function createMockSurvivor(overrides: Partial<Survivor> = {}): Survivor {
  return {
    mesh: new THREE.Group(),
    pos: new THREE.Vector3(0, 0, 0),
    life: 1.0,
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

// Helper to create a mock Scout
function createMockScout(overrides: Partial<Scout> = {}): Scout {
  return {
    group: new THREE.Group(),
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),
    waypoint: new THREE.Vector3(0, 0, 0),
    light: new THREE.PointLight(),
    ...overrides,
  };
}

// Helper to create a mock Ward
function createMockWard(protect: boolean, pos: THREE.Vector3, overrides: Partial<Ward> = {}): Ward {
  const mesh = new THREE.Mesh();
  mesh.position.copy(pos);
  return {
    mesh,
    mat: new THREE.ShaderMaterial(),
    age: 0,
    ttl: 10,
    radius: 12,
    protect,
    active: true,
    ...overrides,
  };
}

describe("Entities Logic Chains", () => {
  describe("updateSurvivors", () => {
    it("decays life over time based on CONFIG.survivorDecay", () => {
      const s = createMockSurvivor({ life: 1.0 });
      const dt = 1.0;
      updateSurvivors(
        dt,
        [s],
        { queryNearby: () => [] },
        { updateItem: () => {} },
        [],
        { value: 0 },
        () => {}
      );
      // Life should decay by drain * dt * 4 (from updateSurvivors logic)
      expect(s.life).toBeCloseTo(1.0 - (CONFIG.survivorDecay * dt * 4));
    });

    it("accelerates decay when near scouts", () => {
      const s1 = createMockSurvivor({ life: 1.0, pos: new THREE.Vector3(0, 0, 0) });
      const s2 = createMockSurvivor({ life: 1.0, pos: new THREE.Vector3(100, 0, 100) }); // Far away
      const dt = 1.0;

      const mockScout = createMockScout({ pos: new THREE.Vector3(2, 0, 0) }); // Within scoutDrainRange

      updateSurvivors(
        dt,
        [s1, s2],
        { queryNearby: (pos) => pos.distanceTo(mockScout.pos) < CONFIG.scoutDrainRange ? [mockScout] : [] },
        { updateItem: () => {} },
        [],
        { value: 0 },
        () => {}
      );

      expect(s1.life).toBeLessThan(s2.life); // s1 should lose more health
    });

    it("reduces decay when protected by a ward", () => {
      const s1 = createMockSurvivor({ life: 1.0, pos: new THREE.Vector3(0, 0, 0) });
      const ward = createMockWard(true, new THREE.Vector3(0, 0, 0));
      s1.ward = ward;
      const s2 = createMockSurvivor({ life: 1.0, pos: new THREE.Vector3(100, 0, 100) });
      const dt = 1.0;

      updateSurvivors(
        dt,
        [s1, s2],
        { queryNearby: () => [] },
        { updateItem: () => {} },
        [ward],
        { value: 0 },
        () => {}
      );

      expect(s1.life).toBeGreaterThan(s2.life); // s1 decays slower due to ward protection
    });

    it("calls onKill when life reaches 0", () => {
      const s = createMockSurvivor({ life: 0.01 });
      const dt = 1.0;
      const onKill = vi.fn();

      updateSurvivors(
        dt,
        [s],
        { queryNearby: () => [] },
        { updateItem: () => {} },
        [],
        { value: 0 },
        onKill
      );

      expect(s.life).toBe(0);
      expect(onKill).toHaveBeenCalledWith(s);
    });
  });

  describe("updateScouts", () => {
    it("hunts nearby survivors", () => {
      const sc = createMockScout({ pos: new THREE.Vector3(0, 0, 0), waypoint: new THREE.Vector3(0, 0, -100) });
      const s = createMockSurvivor({ pos: new THREE.Vector3(10, 0, 0) }); // Within scoutHuntRange
      const dt = 0.5;

      updateScouts(
        dt,
        [sc],
        { queryNearby: () => [s] },
        { updateItem: () => {} },
        new THREE.Vector3(1000, 0, 0), // Player far away
        { value: 1.0 },
        [],
        100,
        150
      );

      // Scout should move towards survivor (x > 0)
      expect(sc.pos.x).toBeGreaterThan(0);
      expect(sc.pos.z).toBe(0); // Assuming no other forces
    });

    it("flees from protective wards", () => {
      // The current updateScouts logic sets 'to' as goal - pos.
      // If we are at 0,0,0, and goal is 10,0,0, 'to' is 10,0,0.
      // If there is a ward at 5,0,0, distance is 5.
      // If ward radius is 12, dw (5) < radius + 6 (18).
      // away = pos - wardPos = -5,0,0 normalized = -1,0,0 * 40 = -40,0,0
      // new to = 10,0,0 + -40,0,0 = -30,0,0.
      // The scout should move in -X direction.
      const sc = createMockScout({ pos: new THREE.Vector3(0, 0, 0), waypoint: new THREE.Vector3(10, 0, 0) });
      const ward = createMockWard(true, new THREE.Vector3(5, 0, 0)); // Ward slightly ahead
      const dt = 0.5;

      updateScouts(
        dt,
        [sc],
        { queryNearby: () => [] },
        { updateItem: () => {} },
        new THREE.Vector3(1000, 0, 0),
        { value: 1.0 },
        [ward],
        100,
        150
      );

      // Scout should move away from the ward (x < 0)
      expect(sc.pos.x).toBeLessThan(0);
    });

    it("damages the player when close", () => {
      const sc = createMockScout({ pos: new THREE.Vector3(0, 0, 0) });
      const playerPos = new THREE.Vector3(1, 0, 0); // Within scoutDamageRange
      const playerHealth = { value: 1.0 };
      const dt = 1.0;

      updateScouts(
        dt,
        [sc],
        { queryNearby: () => [] },
        { updateItem: () => {} },
        playerPos,
        playerHealth,
        [],
        100,
        150
      );

      expect(playerHealth.value).toBe(1.0 - CONFIG.scoutDamage * dt);
    });

    it("does not damage player if player is inside a protective ward", () => {
      const sc = createMockScout({ pos: new THREE.Vector3(0, 0, 0) });
      const playerPos = new THREE.Vector3(1, 0, 0);
      const ward = createMockWard(true, new THREE.Vector3(1, 0, 0));
      const playerHealth = { value: 1.0 };
      const dt = 1.0;

      updateScouts(
        dt,
        [sc],
        { queryNearby: () => [] },
        { updateItem: () => {} },
        playerPos,
        playerHealth,
        [ward],
        100,
        150
      );

      expect(playerHealth.value).toBe(1.0);
    });
  });
});
