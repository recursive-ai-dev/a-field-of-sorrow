import { useRef, useCallback, useEffect, useState } from "react";

interface JoystickProps {
  onMove: (dx: number, dy: number) => void;
  size?: number;
}

/**
 * Touch-based virtual joystick for mobile controls.
 * Emits normalized -1..1 x/y values when active.
 */
export function Joystick({ onMove, size = 120 }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const center = useRef({ x: 0, y: 0 });
  const touchId = useRef<number | null>(null);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      center.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      setDragging(true);
      updateKnob(clientX, clientY);
    },
    [size],
  );

  const updateKnob = useCallback(
    (clientX: number, clientY: number) => {
      const half = size / 2;
      let dx = (clientX - center.current.x) / half;
      let dy = (clientY - center.current.y) / half;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      setKnobPos({ x: dx * half, y: dy * half });
      onMove(dx, dy);
    },
    [size, onMove],
  );

  const handleEnd = useCallback(() => {
    setDragging(false);
    setKnobPos({ x: 0, y: 0 });
    onMove(0, 0);
    touchId.current = null;
  }, [onMove]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: TouchEvent | MouseEvent) => {
      const ev = "touches" in e ? e.touches[0] ?? e.changedTouches[0] : (e as MouseEvent);
      if (ev) updateKnob(ev.clientX, ev.clientY);
    };
    const onUp = () => handleEnd();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, updateKnob, handleEnd]);

  return (
    <div
      ref={baseRef}
      className="relative select-none touch-none"
      style={{ width: size, height: size }}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (touch) {
          touchId.current = touch.identifier;
          handleStart(touch.clientX, touch.clientY);
        }
      }}
      role="slider"
      aria-label="Movement joystick"
      aria-orientation="vertical"
    >
      {/* Base circle */}
      <div className="absolute inset-0 rounded-full border-2 border-stone-600/40 bg-stone-950/60 backdrop-blur-sm" />
      {/* Knob */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/50 shadow-[0_0_12px_rgba(251,191,36,0.4)] transition-opacity"
        style={{
          width: size * 0.4,
          height: size * 0.4,
          transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
          opacity: dragging ? 1 : 0.5,
        }}
      />
    </div>
  );
}
