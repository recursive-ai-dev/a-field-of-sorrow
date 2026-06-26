import { describe, it, expect } from "vitest";
import { CONFIG, NAMES } from "../config";

describe("CONFIG", () => {
  it("has required game parameters", () => {
    expect(CONFIG.field).toBeGreaterThan(0);
    expect(CONFIG.survivorCount).toBe(14);
    expect(CONFIG.scoutCount).toBe(4);
    expect(CONFIG.gameTime).toBe(150);
    expect(CONFIG.playerSpeed).toBeGreaterThan(0);
    expect(CONFIG.scoutSpeed).toBeGreaterThan(0);
  });

  it("has cooldowns and durations", () => {
    expect(CONFIG.wardCooldown).toBe(6);
    expect(CONFIG.healCooldown).toBe(4);
    expect(CONFIG.wardDuration).toBeGreaterThan(0);
    expect(CONFIG.healDuration).toBeGreaterThan(0);
  });

  it("has valid win conditions", () => {
    expect(CONFIG.winRatio).toBeGreaterThan(0);
    expect(CONFIG.winRatio).toBeLessThanOrEqual(1);
    expect(CONFIG.winMorale).toBeGreaterThan(0);
  });
});

describe("NAMES", () => {
  it("has enough names for all survivors", () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(CONFIG.survivorCount);
  });

  it("all names are non-empty strings", () => {
    for (const name of NAMES) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
