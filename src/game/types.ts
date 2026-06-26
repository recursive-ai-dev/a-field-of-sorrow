export type GameStatus = "menu" | "playing" | "won" | "lost";

export interface SurvivorUI {
  id: number;
  // screen-space position in normalized 0..1 (relative to canvas)
  x: number;
  y: number;
  // distance from player in world units
  dist: number;
  // remaining life 0..1
  life: number;
  // visible (in front of camera & on field)
  visible: boolean;
  // already rescued
  rescued: boolean;
  // critical = life low
  critical: boolean;
  name: string;
}

export interface ScoutUI {
  id: number;
  x: number;
  y: number;
  dist: number;
  visible: boolean;
}

export interface GameState {
  status: GameStatus;
  saved: number;
  lost: number;
  total: number;
  morale: number; // 0..100
  wardCooldown: number; // 0..1 (1 = ready)
  healCooldown: number; // 0..1
  survivors: SurvivorUI[];
  scouts: ScoutUI[];
  playerHealth: number; // 0..1
  timeLeft: number;
  message: string | null;
}

export type StateListener = (s: GameState) => void;
