import type { GameState } from "../game/types";
import { InputValidator } from "./inputValidator";

export class GameSerializer {
  static serialize(state: GameState): string {
    try {
      // Create a serializable version of the state
      const serializableState = {
        status: state.status,
        saved: state.saved,
        lost: state.lost,
        total: state.total,
        morale: state.morale,
        wardCooldown: state.wardCooldown,
        healCooldown: state.healCooldown,
        playerHealth: state.playerHealth,
        timeLeft: state.timeLeft,
        message: state.message,
        survivors: state.survivors.map(s => ({
          id: s.id,
          x: s.x,
          y: s.y,
          dist: s.dist,
          life: s.life,
          visible: s.visible,
          rescued: s.rescued,
          critical: s.critical,
          name: s.name
        })),
        scouts: state.scouts.map(sc => ({
          id: sc.id,
          x: sc.x,
          y: sc.y,
          dist: sc.dist,
          visible: sc.visible
        })),
        timestamp: Date.now()
      };

      return JSON.stringify(serializableState);
    } catch (error) {
      console.error("Failed to serialize game state:", error);
      throw error;
    }
  }

  static deserialize(serialized: string): GameState {
    try {
      const parsed = JSON.parse(serialized);
      
      // Validate the basic structure
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid serialized data structure");
      }

      // Create a new GameState with default values
      const defaultState: GameState = {
        status: "playing",
        saved: 0,
        lost: 0,
        total: 14,
        morale: 60,
        wardCooldown: 1,
        healCooldown: 1,
        survivors: [],
        scouts: [],
        playerHealth: 1,
        timeLeft: 150,
        message: null
      };

      // Merge with saved data
      const state: GameState = {
        ...defaultState,
        ...parsed,
        // Ensure arrays are properly typed
        survivors: parsed.survivors || [],
        scouts: parsed.scouts || []
      };

      // Validate and sanitize values
      state.morale = Math.max(0, Math.min(100, state.morale));
      state.playerHealth = Math.max(0, Math.min(1, state.playerHealth));
      state.timeLeft = Math.max(0, state.timeLeft);
      state.wardCooldown = Math.max(0, Math.min(1, state.wardCooldown));
      state.healCooldown = Math.max(0, Math.min(1, state.healCooldown));

      return state;
    } catch (error) {
      console.error("Failed to deserialize game state:", error);
      throw error;
    }
  }

  static validate(state: GameState): boolean {
    return InputValidator.validateGameState(state);
  }

  static createSavePoint(state: GameState, name: string = "autosave"): { name: string; data: string; timestamp: number } {
    return {
      name,
      data: this.serialize(state),
      timestamp: Date.now()
    };
  }

  static loadSavePoint(savePoint: { name: string; data: string; timestamp: number }): GameState {
    console.log(`Loading save point: ${savePoint.name} (${new Date(savePoint.timestamp).toLocaleString()})`);
    return this.deserialize(savePoint.data);
  }
}
