import { afterEach, describe, expect, it, vi } from "vitest";
import { followFix, type Fix, type LockState } from "./locate";

afterEach(() => {
  vi.useRealTimers();
});

describe("GPS lock", () => {
  it("locks at once on a few meters and keeps listening for a tighter reading", () => {
    const states: LockState[] = [];
    let stopped = false;
    const stop = followFix(
      (onFix) => {
        onFix({ latitude: Number.NaN, longitude: 34, accuracy: 1 });
        onFix({ latitude: 32, longitude: 34, accuracy: 40 });
        onFix({ latitude: 32.1, longitude: 34.8, accuracy: 4.2 });
        onFix({ latitude: 32.2, longitude: 34.9, accuracy: 1 });
        onFix({ latitude: 31, longitude: 35, accuracy: 30 });
        return () => {
          stopped = true;
        };
      },
      (state) => states.push(state),
    );
    expect(states.at(-1)).toEqual({ status: "locked", fix: { latitude: 32.2, longitude: 34.9, accuracy: 1 } });
    expect(stopped).toBe(false);
    stop();
    expect(stopped).toBe(true);
  });

  it("locks a stable coarse reading, and a tighter one before that", async () => {
    vi.useFakeTimers();
    const stable: LockState[] = [];
    followFix(
      (onFix) => {
        onFix({ latitude: 32.0853, longitude: 34.7818, accuracy: 52 });
        return () => {};
      },
      (state) => stable.push(state),
      { waitMs: 5_000, settleMs: 1_000 },
    );
    expect(stable.at(-1)).toEqual({ status: "seeking", accuracy: 52 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(stable.at(-1)).toEqual({ status: "locked", fix: { latitude: 32.0853, longitude: 34.7818, accuracy: 52 } });

    const improved: LockState[] = [];
    let send: (fix: Fix) => void = () => {};
    followFix(
      (onFix) => {
        send = onFix;
        onFix({ latitude: 32, longitude: 34, accuracy: 52 });
        return () => {};
      },
      (state) => improved.push(state),
      { waitMs: 5_000, settleMs: 2_000 },
    );
    await vi.advanceTimersByTimeAsync(1_000);
    send({ latitude: 32.1111, longitude: 34.7818, accuracy: 6 });
    expect(improved.at(-1)).toEqual({ status: "locked", fix: { latitude: 32.1111, longitude: 34.7818, accuracy: 6 } });
  });

  it("refuses a fix wider than the ceiling", async () => {
    vi.useFakeTimers();
    const states: LockState[] = [];
    followFix(
      (onFix) => {
        onFix({ latitude: 32, longitude: 34, accuracy: 200 });
        return () => {};
      },
      (state) => states.push(state),
      { waitMs: 1_000, settleMs: 400 },
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(states.at(-1)).toEqual({ status: "wide" });
  });

  it("reports a denied permission and a missing reading", async () => {
    const denied: LockState[] = [];
    followFix(
      (_onFix, onError) => {
        onError("denied");
        return () => {};
      },
      (state) => denied.push(state),
    );
    expect(denied.at(-1)).toEqual({ status: "denied" });

    vi.useFakeTimers();
    const missing: LockState[] = [];
    followFix(() => () => {}, (state) => missing.push(state), { waitMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    expect(missing.at(-1)).toEqual({ status: "unavailable" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(denied.at(-1)).toEqual({ status: "denied" });
  });
});
