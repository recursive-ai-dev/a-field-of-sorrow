import { useEffect, useRef, useState, useCallback } from "react";
import { Game } from "./game/Game";
import type { GameState } from "./game/types";
import HUD from "./components/HUD";
import Markers from "./components/Markers";
import { MenuScreen, EndScreen } from "./components/Screens";
import { SettingsMenu } from "./components/SettingsMenu";
import { Joystick } from "./components/Joystick";
import { LoadingScreen } from "./components/LoadingScreen";
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
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  const stateRef = useRef(state);
  const phaseRef = useRef(phase);
  stateRef.current = state;
  phaseRef.current = phase;

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
    window.addEventListener("touchstart", checkTouch, { once: true });
    return () => window.removeEventListener("touchstart", checkTouch);
  }, []);

  const startGame = useCallback((initialState?: GameState) => {
    if (!mountRef.current) return;

    setLoading(true);
    // Use requestAnimationFrame to ensure the LoadingScreen renders before heavy Three.js init
    requestAnimationFrame(() => {
      if (!mountRef.current) {
        setLoading(false);
        return;
      }

      gameRef.current?.dispose();
      try {
        const game = new Game(mountRef.current, initialState);
        game.onState((s) => {
          setState(s);
          if (s.status === "won" || s.status === "lost") {
            setPhase("ended");
          }
        });
        gameRef.current = game;
        setPhase("playing");
      } catch (error) {
        console.error("Game init error:", error);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const restart = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    setState(INITIAL);
    setPhase("menu");
    setShowSettings(false);
  }, []);

  const loadGame = useCallback(() => {
    try {
      const saveData = localStorage.getItem("wardOfTheFallenField_save");
      if (!saveData) {
        setState(prev => ({ ...prev, message: "No saved game found" }));
        return false;
      }

      const loadedState = GameSerializer.deserialize(saveData);
      if (!InputValidator.validateGameState(loadedState)) {
        setState(prev => ({ ...prev, message: "Corrupted save data" }));
        return false;
      }

      const sanitizedState = InputValidator.sanitizeGameState(loadedState);
      if (sanitizedState) {
        startGame(sanitizedState);
        setShowSettings(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to load game:", error);
      return false;
    }
  }, [startGame]);

  const saveGame = useCallback(() => {
    if (phaseRef.current === "playing") {
      try {
        const saveData = GameSerializer.serialize(stateRef.current);
        localStorage.setItem("wardOfTheFallenField_save", saveData);
        setState(prev => ({ ...prev, message: "Game saved!" }));
      } catch (error) {
        console.error("Failed to save game:", error);
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (phaseRef.current === "playing") {
          setShowSettings(prev => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    gameRef.current?.setPaused(showSettings);
  }, [showSettings]);

  // Auto-save
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current === "playing" && stateRef.current.status === "playing") {
        saveGame();
      }
    }, 60000);
    return () => clearInterval(id);
  }, [saveGame]);

  useEffect(() => {
    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-stone-950 text-white">
      <div ref={mountRef} className="absolute inset-0" />

      {phase === "playing" && !loading && (
        <>
          <Markers state={state} />
          <HUD
            state={state}
            onCastWard={() => gameRef.current?.castWard(true)}
            onCastHeal={() => gameRef.current?.castWard(false)}
          />
          {isTouch && (
            <div className="absolute bottom-10 left-10 z-30">
              <Joystick onMove={(v) => gameRef.current?.setJoystick(v)} />
            </div>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute right-4 bottom-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-amber-800/40 bg-stone-900/60 text-amber-200/80 backdrop-blur-sm transition-all hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            aria-label="Open settings"
          >
            ⚙️
          </button>
        </>
      )}

      {loading && <LoadingScreen progress={0.5} />}

      {phase === "menu" && !loading && <MenuScreen onStart={() => startGame()} onLoad={loadGame} />}
      {phase === "ended" && <EndScreen state={state} onRestart={restart} />}

      <SettingsMenu
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveGame}
        onLoad={loadGame}
      />
    </div>
  );
}
