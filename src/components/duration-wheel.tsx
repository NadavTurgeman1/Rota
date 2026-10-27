"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ITEM = 36;
const VIEW = 180;

function clamp(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}

/** Resistance past a bound, in pixels. The further past, the less it follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function resist(raw: number, max: number) {
  if (raw < 0) return -rubberband(-raw * ITEM, VIEW) / ITEM;
  if (raw > max) return max + rubberband((raw - max) * ITEM, VIEW) / ITEM;
  return raw;
}

/** Where a flick comes to rest, in pixels. Snappier than a long page scroll. */
function projectPx(velocityPxPerSec: number) {
  const decelerationRate = 0.99;
  return (velocityPxPerSec / 1000) * (decelerationRate / (1 - decelerationRate));
}

function capVelocity(pxPerSec: number) {
  return Math.max(-1800, Math.min(1800, pxPerSec));
}

function Wheel({
  label,
  value,
  max,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const positionRef = useRef(value);
  const [position, setPosition] = useState(value);
  const [dragging, setDragging] = useState(false);
  const mode = useRef<"idle" | "drag" | "flick">("idle");
  const frame = useRef(0);
  const settle = useRef(0);
  const published = useRef(value);
  const onChangeRef = useRef(onChange);
  const maxRef = useRef(max);
  const disabledRef = useRef(disabled);
  const pointer = useRef<{
    id: number;
    startY: number;
    startPosition: number;
    lastY: number;
    lastTime: number;
    velocity: number;
  } | null>(null);

  onChangeRef.current = onChange;
  maxRef.current = max;
  disabledRef.current = disabled;
  const values = useMemo(() => Array.from({ length: max + 1 }, (_, index) => index), [max]);

  function publish(pos: number) {
    positionRef.current = pos;
    setPosition(pos);
    const rounded = clamp(Math.round(pos), maxRef.current);
    if (rounded !== published.current) {
      published.current = rounded;
      onChangeRef.current(rounded);
    }
  }

  function stopMotion() {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    window.clearTimeout(settle.current);
    settle.current = 0;
  }

  function glide(from: number, to: number, velocity: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const toward = to - from;
    const speed0 = toward * velocity < 0 ? 0 : velocity;
    if (reduced || Math.abs(toward) < 0.001) {
      publish(to);
      mode.current = "idle";
      return;
    }
    mode.current = "flick";
    const start = performance.now();
    let pos = from;
    let speed = speed0;
    let last = start;
    const tick = (now: number) => {
      if (mode.current !== "flick") return;
      const dt = Math.min(32, now - last);
      last = now;
      speed *= 0.99 ** dt;
      pos += (speed * dt) / 1000;
      const arrived = (speed > 0 && pos >= to) || (speed < 0 && pos <= to);
      if (arrived) {
        publish(to);
        mode.current = "idle";
        frame.current = 0;
        return;
      }
      if (Math.abs(speed) < 0.35 || now - start > 520) {
        const easeFrom = pos;
        const easeStart = now;
        const ease = (tNow: number) => {
          if (mode.current !== "flick") return;
          const t = Math.min(1, (tNow - easeStart) / 180);
          const eased = 1 - (1 - t) ** 3;
          publish(t === 1 ? to : easeFrom + (to - easeFrom) * eased);
          if (t === 1) {
            mode.current = "idle";
            frame.current = 0;
            return;
          }
          frame.current = requestAnimationFrame(ease);
        };
        frame.current = requestAnimationFrame(ease);
        return;
      }
      publish(pos);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  function release(velocityPx: number) {
    pointer.current = null;
    setDragging(false);
    const limit = maxRef.current;
    const projected = clamp(positionRef.current + projectPx(velocityPx) / ITEM, limit);
    glide(positionRef.current, clamp(Math.round(projected), limit), velocityPx / ITEM);
  }

  useEffect(() => {
    if (mode.current !== "idle" || settle.current) return;
    published.current = value;
    const next = clamp(value, max);
    if (Math.abs(positionRef.current - next) < 0.001) return;
    positionRef.current = next;
    setPosition(next);
  }, [value, max]);

  useEffect(() => {
    if (!disabled) return;
    stopMotion();
    mode.current = "idle";
    pointer.current = null;
    setDragging(false);
    const next = clamp(value, max);
    positionRef.current = next;
    published.current = next;
    setPosition(next);
  }, [disabled, value, max]);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (disabledRef.current) return;
      event.preventDefault();
      stopMotion();
      mode.current = "idle";
      const line = event.deltaMode === 1 ? ITEM : event.deltaMode === 2 ? VIEW : 1;
      const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * line;
      publish(resist(positionRef.current + delta / ITEM, maxRef.current));
      settle.current = window.setTimeout(() => {
        settle.current = 0;
        if (mode.current !== "idle") return;
        publish(clamp(Math.round(clamp(positionRef.current, maxRef.current)), maxRef.current));
      }, 90);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      stopMotion();
    };
  }, []);

  const shown = resist(position, max);
  const active = clamp(Math.round(shown), max);

  return (
    <div className={`flex w-20 flex-col items-center gap-1 ${disabled ? "opacity-40" : ""}`}>
      <div
        ref={root}
        role="spinbutton"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamp(value, max)}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        data-testid={`wheel-${label}`}
        className={`relative h-[180px] w-full touch-none select-none ${disabled ? "" : dragging ? "cursor-grabbing" : "cursor-grab"}`}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          stopMotion();
          mode.current = "drag";
          setDragging(true);
          pointer.current = {
            id: event.pointerId,
            startY: event.clientY,
            startPosition: positionRef.current,
            lastY: event.clientY,
            lastTime: event.timeStamp,
            velocity: 0,
          };
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // The gesture still tracks from the events that reach this wheel.
          }
        }}
        onPointerMove={(event) => {
          const gesture = pointer.current;
          if (!gesture || gesture.id !== event.pointerId || mode.current !== "drag") return;
          const dt = event.timeStamp - gesture.lastTime;
          if (dt >= 8 && dt < 80) {
            const instant = capVelocity(((gesture.lastY - event.clientY) / dt) * 1000);
            gesture.velocity = capVelocity(gesture.velocity * 0.65 + instant * 0.35);
          } else if (dt >= 80) {
            gesture.velocity = 0;
          }
          gesture.lastY = event.clientY;
          gesture.lastTime = event.timeStamp;
          publish(resist(gesture.startPosition + (gesture.startY - event.clientY) / ITEM, maxRef.current));
        }}
        onPointerUp={(event) => {
          const gesture = pointer.current;
          if (!gesture || gesture.id !== event.pointerId) return;
          release(gesture.velocity);
        }}
        onPointerCancel={(event) => {
          const gesture = pointer.current;
          if (!gesture || gesture.id !== event.pointerId) return;
          release(0);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          stopMotion();
          mode.current = "idle";
          pointer.current = null;
          setDragging(false);
          const next = event.key === "ArrowUp" ? clamp(value + 1, max) : clamp(value - 1, max);
          positionRef.current = next;
          published.current = next;
          setPosition(next);
          if (next !== value) onChange(next);
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-lg bg-well" />
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden [mask-image:linear-gradient(transparent,black_28%,black_72%,transparent)]">
          <div style={{ transform: `translateY(${(VIEW - ITEM) / 2 - shown * ITEM}px)` }}>
            {values.map((item) => (
              <div
                key={item}
                className={`grid place-items-center text-[1.375rem] font-medium tabular-nums ${item === active ? "text-ink" : "text-subtle"}`}
                style={{ height: ITEM }}
              >
                {String(item).padStart(2, "0")}
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

/** Hours 0–23 and minutes 0–59. The longest extra window is 23:59. */
export function DurationWheels({
  hours,
  minutes,
  hoursLabel,
  minutesLabel,
  onHours,
  onMinutes,
}: {
  hours: number;
  minutes: number;
  hoursLabel: string;
  minutesLabel: string;
  onHours: (hours: number) => void;
  onMinutes: (minutes: number) => void;
}) {
  return (
    <div dir="ltr" className="mt-3 flex items-start justify-center gap-6">
      <Wheel label={hoursLabel} value={hours} max={23} onChange={onHours} />
      <Wheel label={minutesLabel} value={minutes} max={59} onChange={onMinutes} />
    </div>
  );
}

/** Remaining time as `hh:mm:ss`. Empty until the clock has ticked on the client, and empty once the deadline has passed. */
export function useCountdown(until: string | undefined): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (!until || now === null) return null;
  const left = Date.parse(until) - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  const total = Math.ceil(left / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
