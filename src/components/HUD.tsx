import type { GameState } from "../game/types";

interface Props {
  state: GameState;
  onCastWard: () => void;
  onCastHeal: () => void;
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="w-full">
      <div className="mb-0.5 flex justify-between text-[10px] uppercase tracking-widest text-amber-200/70">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-amber-900/40">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function HUD({ state, onCastWard, onCastHeal }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-serif">
      {/* Top-left: objective stats */}
      <div className="absolute left-4 top-4 w-60 rounded-lg border border-amber-800/40 bg-gradient-to-b from-stone-950/80 to-stone-900/60 p-3 backdrop-blur-sm">
        <h1 className="mb-1 text-sm font-bold tracking-[0.2em] text-amber-300/90 drop-shadow">
          WARD OF THE FALLEN FIELD
        </h1>
        <div className="mb-2 flex items-center justify-between text-xs text-stone-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            Saved <b className="text-emerald-300">{state.saved}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
            Lost <b className="text-red-300">{state.lost}</b>
          </span>
          <span className="text-stone-400">/ {state.total}</span>
        </div>
        <Bar value={state.morale / 100} color="linear-gradient(90deg,#b45309,#fbbf24)" label="Morale" />
        <div className="mt-2">
          <Bar value={state.playerHealth} color="linear-gradient(90deg,#7f1d1d,#f87171)" label="Vitality" />
        </div>
      </div>

      {/* Top-right: timer */}
      <div className="absolute right-4 top-4 rounded-lg border border-amber-800/40 bg-stone-950/70 px-4 py-2 text-center backdrop-blur-sm">
        <div className="text-[10px] uppercase tracking-widest text-amber-200/60">Dusk falls in</div>
        <div className={`text-2xl font-bold tabular-nums ${state.timeLeft < 30 ? "text-red-400 animate-pulse" : "text-amber-200"}`}>
          {Math.floor(state.timeLeft / 60)}:{String(state.timeLeft % 60).padStart(2, "0")}
        </div>
      </div>

      {/* Center toast message */}
      {state.message && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-md border border-amber-700/40 bg-stone-950/80 px-5 py-2 text-center text-sm italic text-amber-100 shadow-lg backdrop-blur-sm">
          {state.message}
        </div>
      )}

      {/* Bottom: spell buttons */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-4">
        <SpellButton
          ready={state.wardCooldown >= 1}
          progress={state.wardCooldown}
          onClick={onCastWard}
          label="Protective Ward"
          hint="SPACE"
          glow="#3a7bd5"
          icon="🛡"
          ariaLabel="Cast protective ward"
          keyBinding="Space"
        />
        <SpellButton
          ready={state.healCooldown >= 1}
          progress={state.healCooldown}
          onClick={onCastHeal}
          label="Area Heal"
          hint="E"
          glow="#49e09b"
          icon="✦"
          ariaLabel="Cast area heal"
          keyBinding="E"
        />
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-5 left-4 max-w-[180px] text-[11px] leading-relaxed text-stone-400/80">
        <b className="text-amber-200/80">WASD</b> / click to move.<br />
        Cast wards over wounded clusters before the dark takes them.
      </div>
    </div>
  );
}

function SpellButton({
  ready,
  progress,
  onClick,
  label,
  hint,
  glow,
  icon,
  ariaLabel,
  keyBinding,
}: {
  ready: boolean;
  progress: number;
  onClick: () => void;
  label: string;
  hint: string;
  glow: string;
  icon: string;
  ariaLabel?: string;
  keyBinding?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!ready}
      className={`group relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 transition-all ${
        ready
          ? "scale-100 cursor-pointer border-amber-300/70 bg-stone-900/80 hover:scale-110"
          : "scale-95 cursor-not-allowed border-stone-700/50 bg-stone-950/70"
      }`}
      style={ready ? { boxShadow: `0 0 18px ${glow}99` } : undefined}
    >
      <span className="text-2xl" style={{ filter: ready ? `drop-shadow(0 0 5px ${glow})` : "grayscale(1) opacity(0.5)" }}>
        {icon}
      </span>
      {!ready && (
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={glow}
            strokeWidth="3"
            strokeDasharray={`${progress * 100.5} 100.5`}
            strokeLinecap="round"
          />
        </svg>
      )}
      <span className="pointer-events-none absolute -top-7 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] text-amber-100 opacity-0 transition-opacity group-hover:opacity-100">
        {label} <span className="text-stone-400">[{hint}]</span>
      </span>
      {ariaLabel && keyBinding && (
        <span className="sr-only">
          {ariaLabel}. Keyboard shortcut: {keyBinding} key.
        </span>
      )}
    </button>
  );
}
