import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { SpatialGrid } from "../spatialGrid";

interface TestItem {
  pos: THREE.Vector3;
  id: number;
}

function makeItem(x: number, z: number, id: number): TestItem {
  return { pos: new THREE.Vector3(x, 0, z), id };
}

describe("SpatialGrid", () => {
  let grid: SpatialGrid<TestItem>;

  beforeEach(() => {
    grid = new SpatialGrid<TestItem>(
      { min: new THREE.Vector3(-100, 0, -100), max: new THREE.Vector3(100, 0, 100) },
      20,
    );
  });

  it("adds and queries items", () => {
    grid.add(makeItem(10, 10, 1));
    grid.add(makeItem(50, 50, 2));
    expect(grid.queryAll().length).toBe(2);
  });

  it("queries nearby items within radius", () => {
    grid.add(makeItem(0, 0, 1));
    grid.add(makeItem(5, 5, 2));
    grid.add(makeItem(50, 50, 3));

    const nearby = grid.queryNearby(new THREE.Vector3(0, 0, 0), 15);
    expect(nearby.length).toBe(2);
    expect(nearby.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it("removes items", () => {
    const item = makeItem(10, 10, 1);
    grid.add(item);
    expect(grid.queryAll().length).toBe(1);
    grid.remove(item);
    expect(grid.queryAll().length).toBe(0);
  });

  it("clears all items", () => {
    grid.add(makeItem(1, 1, 1));
    grid.add(makeItem(2, 2, 2));
    grid.clear();
    expect(grid.queryAll().length).toBe(0);
  });

  it("returns stats", () => {
    grid.add(makeItem(0, 0, 1));
    grid.add(makeItem(5, 5, 2));
    grid.add(makeItem(50, 50, 3));
    const stats = grid.getStats();
    expect(stats.itemCount).toBe(3);
    expect(stats.cellCount).toBeGreaterThan(0);
  });
});
