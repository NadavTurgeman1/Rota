import { effectiveSlot } from "./schedule";
import { dynamicReason, slots, staticReason } from "./rules";
import { recordVersion, type VersionStamp } from "./versions";
import type { Reason, RotaState, Schedule, Slot } from "./types";

export type TradeKind = "swap" | "giveaway";

/** One person on one published shift. */
export interface TradeSeat {
  slotKey: string;
  employeeId: string;
}

/**
 * A swap trades `from` for `to`. A giveaway hands `from` to `takerId`.
 * Every move keeps both people inside their constraints and the site rules.
 */
export interface TradeMove {
  kind: TradeKind;
  from: TradeSeat;
  to?: TradeSeat;
  takerId?: string;
}

export type TradeProblem =
  | { code: "unpublished" }
  | { code: "seat" }
  | { code: "started" }
  | { code: "rule"; employeeId: string; reason: Reason };

function held(schedule: Schedule, seat: TradeSeat): boolean {
  return (schedule.assign[seat.slotKey] ?? []).includes(seat.employeeId);
}

function token(slotKey: string, employeeId: string): string {
  return `${slotKey}#${employeeId}`;
}

/** Hand the seat on, with its lock. An approved extra shift stays with the person it was approved for. */
function moveSeat(schedule: Schedule, slotKey: string, fromId: string, toId: string, overTo?: string): void {
  schedule.assign[slotKey] = (schedule.assign[slotKey] ?? []).filter((id) => id !== fromId).concat(toId);
  if (schedule.locked.includes(token(slotKey, fromId))) {
    schedule.locked = schedule.locked.filter((item) => item !== token(slotKey, fromId)).concat(token(slotKey, toId));
  }
  if (schedule.over?.[token(slotKey, fromId)]) {
    const over = { ...schedule.over };
    delete over[token(slotKey, fromId)];
    if (overTo) over[token(overTo, fromId)] = true;
    schedule.over = over;
  }
}

/** The week after the move, or null when a seat is no longer held as described. */
export function movedState(state: RotaState, week: string, move: TradeMove): RotaState | null {
  const schedule = state.sched[week];
  if (!schedule || schedule.status !== "published" || !held(schedule, move.from)) return null;
  const draft = structuredClone(state);
  const next = draft.sched[week];
  if (move.kind === "swap") {
    const to = move.to;
    if (!to || to.employeeId === move.from.employeeId || to.slotKey === move.from.slotKey || !held(schedule, to)) return null;
    if (held(schedule, { slotKey: move.from.slotKey, employeeId: to.employeeId })) return null;
    if (held(schedule, { slotKey: to.slotKey, employeeId: move.from.employeeId })) return null;
    moveSeat(next, move.from.slotKey, move.from.employeeId, to.employeeId, to.slotKey);
    moveSeat(next, to.slotKey, to.employeeId, move.from.employeeId, move.from.slotKey);
  } else {
    const taker = move.takerId;
    if (!taker || taker === move.from.employeeId || held(schedule, { slotKey: move.from.slotKey, employeeId: taker })) return null;
    moveSeat(next, move.from.slotKey, move.from.employeeId, taker);
  }
  return draft;
}

function seatsOf(state: RotaState, week: string, employeeId: string): { slot: Slot; effective: Slot }[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  return slots(state, week)
    .filter((slot) => (schedule.assign[slot.key] ?? []).includes(employeeId))
    .map((slot) => ({ slot, effective: effectiveSlot(schedule, slot, employeeId) }));
}

function reasonsOf(state: RotaState, week: string, employeeId: string): Map<string, Reason> {
  const found = new Map<string, Reason>();
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!employee) return found;
  const mine = seatsOf(state, week, employeeId);
  for (const { slot, effective } of mine) {
    const reason =
      staticReason(state, employee, slot, week) ??
      dynamicReason(
        state,
        employee,
        effective,
        mine.map((item) => item.effective),
      );
    if (reason) found.set(slot.key, reason);
  }
  return found;
}

function involved(move: TradeMove): string[] {
  return move.kind === "swap" ? [move.from.employeeId, move.to?.employeeId ?? ""] : [move.from.employeeId, move.takerId ?? ""];
}

function startOf(state: RotaState, week: string, seat: TradeSeat): number | null {
  const schedule = state.sched[week];
  const slot = slots(state, week).find((item) => item.key === seat.slotKey);
  if (!schedule || !slot) return null;
  return effectiveSlot(schedule, slot, seat.employeeId).start;
}

/** A seat can be offered while the week is published, the person holds it, it is not extended, and it has not started. */
export function seatProblem(state: RotaState, week: string, seat: TradeSeat, nowHours: number | null): TradeProblem | null {
  const schedule = state.sched[week];
  if (!schedule || schedule.status !== "published") return { code: "unpublished" };
  if (!held(schedule, seat) || schedule.ext?.[token(seat.slotKey, seat.employeeId)]) return { code: "seat" };
  const start = startOf(state, week, seat);
  if (start === null) return { code: "seat" };
  if (nowHours !== null && start <= nowHours) return { code: "started" };
  return null;
}

/**
 * Why the move cannot happen, or null when it can.
 * A problem that each person already had on a seat they keep does not block the move.
 * `nowHours` counts hours from the week's Sunday 00:00. A shift that has started cannot move.
 */
export function tradeProblem(state: RotaState, week: string, move: TradeMove, nowHours: number | null): TradeProblem | null {
  const seats = move.kind === "swap" && move.to ? [move.from, move.to] : [move.from];
  for (const seat of seats) {
    const problem = seatProblem(state, week, seat, nowHours);
    if (problem) return problem;
  }
  const after = movedState(state, week, move);
  if (!after) return { code: "seat" };
  for (const employeeId of involved(move)) {
    const employee = after.emps.find((item) => item.id === employeeId);
    if (!employee || !employee.active) return { code: "seat" };
    const before = reasonsOf(state, week, employeeId);
    for (const [slotKey, reason] of reasonsOf(after, week, employeeId)) {
      if (before.get(slotKey)?.code === reason.code) continue;
      return { code: "rule", employeeId, reason };
    }
  }
  return null;
}

/** Seats of other people that `from` can be swapped with. */
export function swapTargets(state: RotaState, week: string, from: TradeSeat, nowHours: number | null): TradeSeat[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const found: TradeSeat[] = [];
  for (const slot of slots(state, week)) {
    for (const employeeId of schedule.assign[slot.key] ?? []) {
      if (employeeId === from.employeeId) continue;
      const to = { slotKey: slot.key, employeeId };
      if (!tradeProblem(state, week, { kind: "swap", from, to }, nowHours)) found.push(to);
    }
  }
  return found;
}

/** The move as a new published version of the week. `state.week` is kept. */
export function applyTrade(state: RotaState, week: string, move: TradeMove, stamp: VersionStamp): RotaState {
  const after = movedState(state, week, move);
  if (!after) return state;
  const versioned = recordVersion({ ...after, week }, "trade", stamp);
  return { ...versioned, week: state.week };
}
