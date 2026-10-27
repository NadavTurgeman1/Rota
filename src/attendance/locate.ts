import { GPS_SETTLE_MS, GPS_WAIT_MS, MAX_ACCURACY_METERS, TARGET_ACCURACY_METERS } from "./clock";

export type Fix = { latitude: number; longitude: number; accuracy: number };

export type FixWatch = (
  onFix: (fix: Fix) => void,
  onError: (kind: "denied" | "unavailable") => void,
) => () => void;

export type LockState =
  | { status: "seeking"; accuracy: number | null }
  | { status: "locked"; fix: Fix }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "wide" };

function usable(fix: Fix): boolean {
  return (
    Number.isFinite(fix.latitude) &&
    Number.isFinite(fix.longitude) &&
    Number.isFinite(fix.accuracy) &&
    fix.accuracy >= 0 &&
    fix.latitude >= -90 &&
    fix.latitude <= 90 &&
    fix.longitude >= -180 &&
    fix.longitude <= 180
  );
}

/**
 * Ask for a GPS fix and keep listening. A few meters locks at once. A stable
 * reading within the ceiling locks too, and a later tighter reading replaces it.
 * The watch stays open until the caller stops it, so the lock is ready before a punch.
 */
export function followFix(
  watch: FixWatch,
  onUpdate: (state: LockState) => void,
  options?: { waitMs?: number; settleMs?: number },
): () => void {
  const waitMs = options?.waitMs ?? GPS_WAIT_MS;
  const settleMs = options?.settleMs ?? GPS_SETTLE_MS;
  let best: Fix | null = null;
  let locked = false;
  let finished = false;
  let live = true;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;

  const emit = (state: LockState) => {
    if (live) onUpdate(state);
  };

  const publishLocked = (fix: Fix) => {
    locked = true;
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    emit({ status: "locked", fix });
  };

  const armSettle = () => {
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (live && !finished && !locked && best && best.accuracy <= MAX_ACCURACY_METERS) publishLocked(best);
    }, settleMs);
  };

  emit({ status: "seeking", accuracy: null });

  const unsubscribe = watch(
    (fix) => {
      if (!live || finished || !usable(fix)) return;
      if (best && fix.accuracy > best.accuracy) return;
      const improved = !best || fix.accuracy < best.accuracy;
      best = fix;
      if (!locked) {
        emit({ status: "seeking", accuracy: best.accuracy });
        if (best.accuracy <= TARGET_ACCURACY_METERS) publishLocked(best);
        else if (improved && best.accuracy <= MAX_ACCURACY_METERS) armSettle();
        return;
      }
      emit({ status: "locked", fix: best });
    },
    (kind) => {
      if (!live || finished || locked) return;
      if (kind !== "denied" && best) return;
      finished = true;
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      if (waitTimer !== undefined) clearTimeout(waitTimer);
      emit(kind === "denied" ? { status: "denied" } : { status: "unavailable" });
    },
  );

  if (!finished) {
    waitTimer = setTimeout(() => {
      if (!live || finished || locked) return;
      if (best && best.accuracy <= MAX_ACCURACY_METERS) publishLocked(best);
      else emit(best ? { status: "wide" } : { status: "unavailable" });
    }, waitMs);
  }

  return () => {
    live = false;
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    if (waitTimer !== undefined) clearTimeout(waitTimer);
    unsubscribe();
  };
}
