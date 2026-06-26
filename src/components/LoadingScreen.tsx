import { cn } from "../utils/cn";

interface LoadingScreenProps {
  progress?: number;
  message?: string;
}

export function LoadingScreen({
  progress = 0,
  message = "Summoning the wards...",
}: LoadingScreenProps) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-stone-950 font-serif">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_40%,#3a7bd533,transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-6">
        {/* spinning rune */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-700/40">
          <svg
            className="h-14 w-14 animate-spin text-amber-400/80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-lg tracking-[0.3em] text-amber-300/80">
            {message}
          </h2>

          {/* progress bar */}
          <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full rounded-full bg-amber-500/70 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <p
        className={cn(
          "absolute bottom-8 text-[10px] uppercase tracking-[0.4em] transition-opacity duration-500",
          progress >= 1
            ? "animate-pulse text-amber-500/60"
            : "text-stone-600",
        )}
      >
        {progress >= 1 ? "Click to begin" : "preparing the field..."}
      </p>
    </div>
  );
}
