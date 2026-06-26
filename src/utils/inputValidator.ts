export class InputValidator {
  static validateGameContainer(container: HTMLElement | null): void {
    if (!container) {
      throw new Error("Game container is required");
    }
    
    if (!(container instanceof HTMLElement)) {
      throw new Error("Game container must be an HTMLElement");
    }
    
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn("Game container has zero dimensions");
    }
  }

  static validateBoolean(value: any, paramName: string): boolean {
    if (typeof value !== "boolean") {
      console.warn(`${paramName} must be a boolean, received: ${typeof value}`);
      return false;
    }
    return true;
  }

  static validateNumber(value: any, paramName: string, min: number = -Infinity, max: number = Infinity): boolean {
    if (typeof value !== "number" || isNaN(value)) {
      console.warn(`${paramName} must be a number, received: ${typeof value}`);
      return false;
    }
    
    if (value < min || value > max) {
      console.warn(`${paramName} must be between ${min} and ${max}, received: ${value}`);
      return false;
    }
    
    return true;
  }

  static validateString(value: any, paramName: string, maxLength: number = 1000): boolean {
    if (typeof value !== "string") {
      console.warn(`${paramName} must be a string, received: ${typeof value}`);
      return false;
    }
    
    if (value.length > maxLength) {
      console.warn(`${paramName} exceeds maximum length of ${maxLength}`);
      return false;
    }
    
    return true;
  }

  static validateArray(value: any, paramName: string, maxLength: number = 1000): boolean {
    if (!Array.isArray(value)) {
      console.warn(`${paramName} must be an array, received: ${typeof value}`);
      return false;
    }
    
    if (value.length > maxLength) {
      console.warn(`${paramName} exceeds maximum length of ${maxLength}`);
      return false;
    }
    
    return true;
  }

  static validateObject(value: any, paramName: string): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      console.warn(`${paramName} must be an object, received: ${typeof value}`);
      return false;
    }
    
    return true;
  }

  static validateFunction(value: any, paramName: string): boolean {
    if (typeof value !== "function") {
      console.warn(`${paramName} must be a function, received: ${typeof value}`);
      return false;
    }
    
    return true;
  }

  static validateGameState(state: any): boolean {
    try {
      if (!state || typeof state !== "object") {
        console.error("Invalid game state: not an object");
        return false;
      }

      const requiredProps = [
        "status", "saved", "lost", "total", "morale", "wardCooldown", "healCooldown",
        "playerHealth", "timeLeft", "survivors", "scouts"
      ];

      for (const prop of requiredProps) {
        if (!(prop in state)) {
          console.error(`Invalid game state: missing required property ${prop}`);
          return false;
        }
      }

      // Validate types and ranges
      if (!this.validateString(state.status, "status")) return false;
      if (!this.validateNumber(state.saved, "saved", 0)) return false;
      if (!this.validateNumber(state.lost, "lost", 0)) return false;
      if (!this.validateNumber(state.total, "total", 1)) return false;
      if (!this.validateNumber(state.morale, "morale", 0, 100)) return false;
      if (!this.validateNumber(state.wardCooldown, "wardCooldown", 0, 1)) return false;
      if (!this.validateNumber(state.healCooldown, "healCooldown", 0, 1)) return false;
      if (!this.validateNumber(state.playerHealth, "playerHealth", 0, 1)) return false;
      if (!this.validateNumber(state.timeLeft, "timeLeft", 0)) return false;
      if (!this.validateArray(state.survivors, "survivors")) return false;
      if (!this.validateArray(state.scouts, "scouts")) return false;

      return true;
    } catch (error) {
      console.error("Game state validation error:", error);
      return false;
    }
  }

  static sanitizeGameState(state: any): any {
    if (!state || typeof state !== "object") {
      return null;
    }

    return {
      status: this.validateString(state.status, "status") ? state.status : "playing",
      saved: this.validateNumber(state.saved, "saved", 0) ? state.saved : 0,
      lost: this.validateNumber(state.lost, "lost", 0) ? state.lost : 0,
      total: this.validateNumber(state.total, "total", 1) ? state.total : 14,
      morale: this.validateNumber(state.morale, "morale", 0, 100) ? state.morale : 60,
      wardCooldown: this.validateNumber(state.wardCooldown, "wardCooldown", 0, 1) ? state.wardCooldown : 1,
      healCooldown: this.validateNumber(state.healCooldown, "healCooldown", 0, 1) ? state.healCooldown : 1,
      playerHealth: this.validateNumber(state.playerHealth, "playerHealth", 0, 1) ? state.playerHealth : 1,
      timeLeft: this.validateNumber(state.timeLeft, "timeLeft", 0) ? state.timeLeft : 150,
      message: this.validateString(state.message, "message") ? state.message : null,
      survivors: this.validateArray(state.survivors, "survivors") ? state.survivors : [],
      scouts: this.validateArray(state.scouts, "scouts") ? state.scouts : []
    };
  }
}
