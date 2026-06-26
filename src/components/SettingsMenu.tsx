import { useState } from "react";
import { audio } from "../game/audio";

interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  onLoad?: () => void;
}

export function SettingsMenu({ open, onClose, onSave, onLoad }: SettingsMenuProps) {
  const [volume, setVolume] = useState(audio.volume);
  const [muted, setMuted] = useState(audio.muted);

  if (!open) return null;

  const handleVolume = (v: number) => {
    setVolume(v);
    audio.setVolume(v);
  };

  const handleMute = () => {
    const m = audio.toggleMute();
    setMuted(m);
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm font-serif"
      role="dialog"
      aria-label="Settings menu"
    >
      <div className="w-80 rounded-xl border border-amber-800/40 bg-gradient-to-b from-stone-900 to-stone-950 p-6 shadow-2xl">
        <h2 className="mb-6 text-center text-lg tracking-[0.3em] text-amber-300/90">
          SETTINGS
        </h2>

        {/* Volume */}
        <div className="mb-4">
          <label className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-stone-400">
            <span>Volume</span>
            <span className="text-amber-200/70">{Math.round(volume * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => handleVolume(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
            aria-label="Volume slider"
          />
        </div>

        {/* Mute toggle */}
        <button
          onClick={handleMute}
          className="mb-6 w-full rounded-lg border border-stone-700/60 bg-stone-800/50 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 transition hover:bg-stone-700/50"
        >
          {muted ? "🔇 Unmute" : "🔊 Mute"}
        </button>

        {/* Save / Load */}
        <div className="mb-6 flex gap-3">
          {onSave && (
            <button
              onClick={onSave}
              className="flex-1 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs uppercase tracking-wider text-amber-200 transition hover:bg-amber-800/30"
            >
              Save
            </button>
          )}
          {onLoad && (
            <button
              onClick={onLoad}
              className="flex-1 rounded-lg border border-blue-700/40 bg-blue-900/20 px-3 py-2 text-xs uppercase tracking-wider text-blue-200 transition hover:bg-blue-800/30"
            >
              Load
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-stone-600/50 bg-stone-800/40 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 transition hover:bg-stone-700/50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
