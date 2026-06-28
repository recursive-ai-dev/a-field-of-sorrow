import type { GameState } from "../game/types";

export default function Markers({ state }: { state: GameState }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {state.survivors.map((s) =>
        s.visible ? (
          <div
            key={`s${s.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-100 ease-linear"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
          >
            <div className="flex flex-col items-center">
              <div
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-sm ${
                  s.critical
                    ? "animate-pulse border border-red-400/70 bg-red-950/70 text-red-200"
                    : "border border-amber-400/50 bg-stone-950/60 text-amber-200"
                }`}
              >
                {s.critical ? "✦ HELP! ✦" : s.name}
              </div>
              {/* mini life bar */}
              <div className="mt-1 h-1 w-12 overflow-hidden rounded-full bg-black/60">
                <div
                  className="h-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.max(0, Math.min(1, s.life)) * 100}%`,
                    background: s.life < 0.3 ? "#ef4444" : s.life < 0.6 ? "#f59e0b" : "#34d399",
                  }}
                  role="progressbar"
                  aria-valuenow={Math.round(s.life * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${s.name} health`}
                />
              </div>
              <div
                className={`mt-0.5 text-lg leading-none ${s.critical ? "animate-bounce" : ""}`}
                style={{ filter: "drop-shadow(0 0 4px #fbbf24)" }}
                aria-hidden="true"
              >
                ▾
              </div>
            </div>
          </div>
        ) : null,
      )}

      {state.scouts.map((sc) =>
        sc.visible && sc.dist < 70 ? (
          <div
            key={`c${sc.id}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-100 ease-linear"
            style={{ left: `${sc.x * 100}%`, top: `${sc.y * 100}%` }}
          >
            <div className="rounded border border-red-500/60 bg-red-950/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-300 backdrop-blur-sm shadow-[0_0_8px_rgba(239,68,68,0.3)]">
              ☠ Scout
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
