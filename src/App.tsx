import { useEffect, useRef, useState, useCallback } from "react";
import { Game } from "./game/Game";
import type { GameState } from "./game/types";
import HUD from "./components/HUD";
import Markers from "./components/Markers";
import { MenuScreen, EndScreen } from "./components/Screens";
import { GameSerializer } from "./utils/gameSerializer";
import { InputValidator } from "./utils/inputValidator";

const INITIAL: GameState = {
  status: "menu",
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
  message: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [phase, setPhase] = useState<"menu" | "playing" | "ended">("menu");
  const [state, setState] = useState<GameState>(INITIAL);

  const startGame = useCallback(() => {
    if (!mountRef.current) return;
    gameRef.current?.dispose();
    const game = new Game(mountRef.current);
    game.onState((s) => {
      setState(s);
      if (s.status === "won" || s.status === "lost") {
        setPhase("ended");
      }
    });
    gameRef.current = game;
    setPhase("playing");
  }, []);

  const restart = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    setState(INITIAL);
    setPhase("menu");
  }, []);

  const saveGame = useCallback(() => {
    try {
      const saveData = GameSerializer.serialize(state);
      localStorage.setItem("wardOfTheFallenField_save", saveData);
      setState(prev => ({ ...prev, message: "Game saved!" }));
      console.log("Game saved successfully");
    } catch (error) {
      console.error("Failed to save game:", error);
      setState(prev => ({ ...prev, message: "Failed to save game" }));
    }
  }, [state]);

  const loadGame = useCallback(() => {
    try {
      const saveData = localStorage.getItem("wardOfTheFallenField_save");
      if (!saveData) {
        console.log("No save data found");
        setState(prev => ({ ...prev, message: "No saved game found" }));
        return false;
      }

      const loadedState = GameSerializer.deserialize(saveData);
      
      // Validate using InputValidator for additional safety
      if (!InputValidator.validateGameState(loadedState)) {
        console.error("Loaded game state failed validation");
        setState(prev => ({ ...prev, message: "Corrupted save data" }));
        return false;
      }

      // Sanitize the state to ensure all values are within valid ranges
      const sanitizedState = InputValidator.sanitizeGameState(loadedState);
      
      if (sanitizedState) {
        setState(sanitizedState);
        setPhase("playing");
        console.log("Game loaded successfully");
        setState(prev => ({ ...prev, message: "Game loaded!" }));
        return true;
      } else {
        console.error("Failed to sanitize game state");
        setState(prev => ({ ...prev, message: "Failed to load game" }));
        return false;
      }
    } catch (error) {
      console.error("Failed to load game:", error);
      setState(prev => ({ ...prev, message: "Failed to load game" }));
      return false;
    }
  }, []);

  const autoSave = useCallback(() => {
    if (phase === "playing" && state.status === "playing") {
      saveGame();
    }
  }, [phase, state.status, saveGame]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(autoSave, 30000);
    return () => {
      clearInterval(autoSaveInterval);
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [autoSave]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-stone-950">
      {/* Three.js canvas mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {phase === "playing" && (
        <>
          <Markers state={state} />
          <HUD
            state={state}
            onCastWard={() => gameRef.current?.castWard(true)}
            onCastHeal={() => gameRef.current?.castWard(false)}
          />
        </>
      )}

      {phase === "menu" && <MenuScreen onStart={startGame} onLoad={loadGame} />}
      {phase === "ended" && <EndScreen state={state} onRestart={restart} />}
    </div>
  );
}
