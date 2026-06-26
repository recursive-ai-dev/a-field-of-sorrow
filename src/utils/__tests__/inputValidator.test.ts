import { describe, it, expect } from "vitest";
import { InputValidator } from "../inputValidator";

describe("InputValidator", () => {
  describe("validateBoolean", () => {
    it("accepts true and false", () => {
      expect(InputValidator.validateBoolean(true, "test")).toBe(true);
      expect(InputValidator.validateBoolean(false, "test")).toBe(true);
    });

    it("rejects non-booleans", () => {
      expect(InputValidator.validateBoolean(1, "test")).toBe(false);
      expect(InputValidator.validateBoolean("true", "test")).toBe(false);
      expect(InputValidator.validateBoolean(null, "test")).toBe(false);
    });
  });

  describe("validateNumber", () => {
    it("accepts valid numbers", () => {
      expect(InputValidator.validateNumber(5, "test", 0, 10)).toBe(true);
      expect(InputValidator.validateNumber(0, "test", 0)).toBe(true);
    });

    it("rejects NaN", () => {
      expect(InputValidator.validateNumber(NaN, "test")).toBe(false);
    });

    it("rejects out of range", () => {
      expect(InputValidator.validateNumber(15, "test", 0, 10)).toBe(false);
      expect(InputValidator.validateNumber(-1, "test", 0)).toBe(false);
    });
  });

  describe("validateString", () => {
    it("accepts strings", () => {
      expect(InputValidator.validateString("hello", "test")).toBe(true);
    });

    it("rejects non-strings", () => {
      expect(InputValidator.validateString(123, "test")).toBe(false);
    });

    it("rejects too long strings", () => {
      expect(InputValidator.validateString("a".repeat(1001), "test", 1000)).toBe(false);
    });
  });

  describe("validateGameState", () => {
    it("accepts valid game state", () => {
      const state = {
        status: "playing",
        saved: 0,
        lost: 0,
        total: 14,
        morale: 60,
        wardCooldown: 1,
        healCooldown: 1,
        playerHealth: 1,
        timeLeft: 150,
        survivors: [],
        scouts: [],
        message: null,
      };
      expect(InputValidator.validateGameState(state)).toBe(true);
    });

    it("rejects null", () => {
      expect(InputValidator.validateGameState(null)).toBe(false);
    });

    it("rejects missing properties", () => {
      expect(InputValidator.validateGameState({})).toBe(false);
    });
  });

  describe("sanitizeGameState", () => {
    it("returns safe defaults for invalid input", () => {
      const result = InputValidator.sanitizeGameState(null);
      expect(result).toBeNull();
    });

    it("fills missing fields with defaults", () => {
      const result = InputValidator.sanitizeGameState({
        status: "playing",
        saved: 0,
        lost: 0,
        total: 14,
        morale: 200, // out of range
        wardCooldown: 1,
        healCooldown: 1,
        playerHealth: 1,
        timeLeft: 150,
        survivors: [],
        scouts: [],
      });
      expect(result.morale).toBe(60); // default
      expect(result.saved).toBe(0);
    });
  });
});
