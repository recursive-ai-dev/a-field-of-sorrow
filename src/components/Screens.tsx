import type { GameState } from "../game/types";

export function MenuScreen({ onStart, onLoad }: { onStart: () => void; onLoad?: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-stone-950 via-stone-900/95 to-amber-950/40 font-serif">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_40%,#b4530933,transparent_60%)]" />
      <div className="relative max-w-xl px-6 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.5em] text-amber-500/70">A battlefield at dusk</p>
        <h1 className="mb-4 bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-5xl font-black tracking-tight text-transparent drop-shadow-[0_2px_12px_rgba(180,83,9,0.5)] sm:text-6xl">
          WARD OF THE<br />FALLEN FIELD
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-stone-300/90">
          The battle is over, but the dying remain. With your enchanted staff and
          shivering spectral fireflies for light, move across the churned earth.
          Cast <span className="text-sky-300">protective wards</span> and{" "}
          <span className="text-emerald-300">healing glyphs</span> to save survivors
          before encroaching darkness and enemy scouts claim them.
        </p>
        <div className="mb-8 grid grid-cols-3 gap-3 text-left text-xs text-stone-400">
          <div className="rounded-lg border border-amber-900/40 bg-black/30 p-3">
            <div className="mb-1 text-amber-300">Move</div>
            WASD or click the ground to walk.
          </div>
          <div className="rounded-lg border border-amber-900/40 bg-black/30 p-3">
            <div className="mb-1 text-sky-300">🛡 Ward [Space]</div>
            Shields nearby wounded & repels scouts.
          </div>
          <div className="rounded-lg border border-amber-900/40 bg-black/30 p-3">
            <div className="mb-1 text-emerald-300">✦ Heal [E]</div>
            Restores life; full heal = rescue.
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onStart}
            className="rounded-full border-2 border-amber-300/80 bg-amber-600/20 px-8 py-3 text-lg font-bold tracking-widest text-amber-100 shadow-[0_0_25px_rgba(251,191,36,0.4)] transition-all hover:scale-105 hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-opacity-50"
            aria-label="Start a new game"
            title="Start a new game (New Game)"
          >
            NEW GAME
          </button>
          <button
            onClick={onLoad}
            className="rounded-full border-2 border-blue-300/80 bg-blue-600/20 px-8 py-3 text-lg font-bold tracking-widest text-blue-100 shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all hover:scale-105 hover:bg-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50"
            aria-label="Load a saved game"
            title="Load a saved game (Load Game)"
          >
            LOAD GAME
          </button>
        </div>
      </div>
    </div>
  );
}

export function EndScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const won = state.status === "won";
  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center font-serif ${
        won
          ? "bg-gradient-to-b from-stone-950 via-emerald-950/40 to-stone-950"
          : "bg-gradient-to-b from-stone-950 via-red-950/50 to-stone-950"
      }`}
    >
      <div className="max-w-lg px-6 text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.4em] text-stone-400">
          {won ? "Dawn breaks over the field" : "The dark has won this night"}
        </p>
        <h1
          className={`mb-4 text-5xl font-black tracking-tight ${
            won ? "text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]" : "text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
          }`}
        >
          {won ? "THE TIDE TURNS" : "A FIELD OF SORROW"}
        </h1>
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-stone-300">
          {won
            ? `Your wards held back the night. ${state.saved} souls live to see another dawn, and their hope rekindles the army's resolve.`
            : `Too many slipped into shadow. ${state.lost} were lost, and morale crumbles with the coming darkness.`}
        </p>
        <div className="mx-auto mb-8 flex max-w-sm justify-center gap-6 text-center">
          <Stat label="Saved" value={state.saved} color="text-emerald-300" />
          <Stat label="Lost" value={state.lost} color="text-red-300" />
          <Stat label="Final Morale" value={`${state.morale}%`} color="text-amber-300" />
        </div>
        <button
          onClick={onRestart}
          className="rounded-full border-2 border-amber-300/70 bg-amber-600/20 px-8 py-3 font-bold tracking-widest text-amber-100 transition-all hover:scale-105 hover:bg-amber-500/30"
        >
          RIDE OUT AGAIN
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-stone-400">{label}</div>
    </div>
  );
}
