import { describe, it, expect } from "vitest";
import { GameSerializer } from "../gameSerializer";
import type { GameState } from "../../game/types";

function makeSampleState(overrides: Partial<GameState> = {}): GameState {
  return {
    status: "playing",
    saved: 3,
    lost: 1,
    total: 14,
    morale: 65,
    wardCooldown: 0.5,
    healCooldown: 1,
    playerHealth: 0.8,
    timeLeft: 120,
    message: "A survivor was rescued!",
    survivors: [
      {
        id: 0, x: 0.5, y: 0.3, dist: 10, life: 0.6,
        visible: true, rescued: false, critical: false, name: "Aldric",
      },
    ],
    scouts: [
      { id: 0, x: 0.2, y: 0.7, dist: 40, visible: true },
    ],
    ...overrides,
  };
}

describe("GameSerializer", () => {
  it("serializes and deserializes a valid game state", () => {
    const state = makeSampleState();
    const serialized = GameSerializer.serialize(state);
    expect(typeof serialized).toBe("string");

    const deserialized = GameSerializer.deserialize(serialized);
    expect(deserialized.status).toBe("playing");
    expect(deserialized.saved).toBe(3);
    expect(deserialized.lost).toBe(1);
    expect(deserialized.morale).toBe(65);
    expect(deserialized.playerHealth).toBe(0.8);
    expect(deserialized.survivors).toHaveLength(1);
    expect(deserialized.scouts).toHaveLength(1);
  });

  it("clamps out-of-range values on deserialize", () => {
    const raw = JSON.stringify({
      status: "playing", saved: 0, lost: 0, total: 14,
      morale: 999, wardCooldown: 5, healCooldown: -1,
      playerHealth: 2, timeLeft: -5,
      survivors: [], scouts: [],
    });
    const state = GameSerializer.deserialize(raw);
    expect(state.morale).toBe(100);
    expect(state.wardCooldown).toBe(1);
    expect(state.healCooldown).toBe(0);
    expect(state.playerHealth).toBe(1);
    expect(state.timeLeft).toBe(0);
  });

  it("creates and loads a save point", () => {
    const state = makeSampleState();
    const savePoint = GameSerializer.createSavePoint(state, "test-save");
    expect(savePoint.name).toBe("test-save");
    expect(savePoint.timestamp).toBeGreaterThan(0);
    expect(typeof savePoint.data).toBe("string");

    const loaded = GameSerializer.loadSavePoint(savePoint);
    expect(loaded.saved).toBe(3);
  });

  it("validates state through the serializer", () => {
    const valid = makeSampleState();
    expect(GameSerializer.validate(valid)).toBe(true);
    expect(GameSerializer.validate(null as unknown as GameState)).toBe(false);
  });

  it("throws on invalid JSON in deserialize", () => {
    expect(() => GameSerializer.deserialize("not-json")).toThrow();
  });
});
