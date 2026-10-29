import { slots } from "./rules";
import { coveredSeats } from "./schedule";
import type { CoverageGap, RotaState, Schedule, Slot } from "./types";

const EPS = 0.02;

interface WorkSpan {
  employeeId: string;
  slotKey: string;
  start: number;
  end: number;
  /** The manager set a clock other than the shift's own. */
  custom: boolean;
}

function covers(span: { start: number; end: number }, at: number): boolean {
  return span.start <= at + EPS && span.end >= at - EPS;
}

function overlaps(start: number, end: number, slot: Slot): boolean {
  return end > slot.start + EPS && start < slot.end - EPS;
}

function workSpans(state: RotaState, week: string): WorkSpan[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const spans: WorkSpan[] = [];
  for (const slot of slots(state, week)) {
    for (const employeeId of schedule.assign[slot.key] ?? []) {
      const token = `${slot.key}#${employeeId}`;
      const custom = schedule.hours?.[token];
      const extension = schedule.ext?.[token];
      const span = extension ?? custom;
      spans.push({
        employeeId,
        slotKey: slot.key,
        start: span?.start ?? slot.start,
        end: span?.end ?? slot.end,
        custom: Boolean(custom),
      });
    }
  }
  return spans;
}

/** The clock a person actually works, including a manual change. */
export function assignmentSpan(schedule: Schedule, slot: Slot, employeeId: string): { start: number; end: number } {
  const token = `${slot.key}#${employeeId}`;
  const span = schedule.ext?.[token] ?? schedule.hours?.[token];
  return { start: span?.start ?? slot.start, end: span?.end ?? slot.end };
}

/**
 * A slot is touched when someone's manual clock overlaps it.
 * Headcount on a touched slot follows who is actually there, including neighbors.
 */
export function touchedSlotKeys(state: RotaState, week = state.week): Set<string> {
  const open = slots(state, week);
  const custom = workSpans(state, week).filter((span) => span.custom);
  const keys = new Set<string>();
  for (const slot of open) {
    if (custom.some((span) => span.slotKey === slot.key || overlaps(span.start, span.end, slot))) keys.add(slot.key);
  }
  return keys;
}

interface Segment {
  start: number;
  end: number;
  supply: number;
  demand: number;
}

function segmentsOf(state: RotaState, week: string): { open: Slot[]; spans: WorkSpan[]; segments: Segment[] } {
  const open = slots(state, week);
  const spans = workSpans(state, week);
  const points = new Set<number>();
  for (const slot of open) {
    points.add(slot.start);
    points.add(slot.end);
  }
  for (const span of spans) {
    points.add(span.start);
    points.add(span.end);
  }
  const sorted = [...points].sort((left, right) => left - right);
  const segments: Segment[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (end - start < EPS) continue;
    const mid = (start + end) / 2;
    const demand = open.filter((slot) => slot.start <= mid && mid < slot.end).reduce((sum, slot) => sum + slot.required, 0);
    const supply = spans.filter((span) => covers(span, mid)).length;
    segments.push({ start, end, supply, demand });
  }
  return { open, spans, segments };
}

function ownerOf(open: Slot[], spans: WorkSpan[], segment: Segment): Slot | undefined {
  const mid = (segment.start + segment.end) / 2;
  const inside = open.find((slot) => slot.start <= mid && mid < slot.end);
  if (inside) return inside;
  const sticking = spans.find((span) => span.custom && covers(span, mid));
  return sticking ? open.find((slot) => slot.key === sticking.slotKey) : undefined;
}

/** Hour shortages and surpluses, counted across neighboring shifts. */
export function weekCoverage(state: RotaState, week = state.week): CoverageGap[] {
  const touched = touchedSlotKeys(state, week);
  if (touched.size === 0) return [];
  const { open, spans, segments } = segmentsOf(state, week);
  const gaps: CoverageGap[] = [];
  for (const segment of segments) {
    if (segment.supply === segment.demand) continue;
    const slot = ownerOf(open, spans, segment);
    if (!slot || !touched.has(slot.key)) continue;
    gaps.push({ slot, start: segment.start, end: segment.end, delta: segment.supply - segment.demand });
  }
  return mergeGaps(gaps);
}

function mergeGaps(gaps: CoverageGap[]): CoverageGap[] {
  const merged: CoverageGap[] = [];
  for (const gap of gaps) {
    const last = merged.at(-1);
    if (last && last.slot.key === gap.slot.key && last.delta === gap.delta && Math.abs(last.end - gap.start) < EPS) last.end = gap.end;
    else merged.push({ ...gap });
  }
  return merged;
}

/** Gaps whose time belongs to this shift. */
export function coverageGaps(state: RotaState, slot: Slot, week = state.week): CoverageGap[] {
  return weekCoverage(state, week).filter((gap) => gap.slot.key === slot.key);
}

/**
 * The shift is short a whole seat, and neighboring clocks cover that seat
 * for every hour of the shift. A one-hour hole does not count.
 */
export function fullShiftCoveredByHours(state: RotaState, slot: Slot, week = state.week): boolean {
  const schedule = state.sched[week];
  if (!schedule || slot.required <= 0) return false;
  const assigned = schedule.assign[slot.key]?.length ?? 0;
  if (assigned + coveredSeats(schedule, slot.key) >= slot.required) return false;
  const presence = slotPresence(state, slot, week);
  if (presence === null || presence < slot.required) return false;
  return !coverageGaps(state, slot, week).some((gap) => gap.delta < 0);
}

/**
 * Fewest people present at once during the shift, once a manual clock overlaps it.
 * `null` means the shift still uses its assigned headcount.
 */
export function slotPresence(state: RotaState, slot: Slot, week = state.week): number | null {
  if (!touchedSlotKeys(state, week).has(slot.key)) return null;
  const { segments } = segmentsOf(state, week);
  const inside = segments.filter((segment) => overlaps(segment.start, segment.end, slot));
  if (inside.length === 0) return 0;
  return Math.min(...inside.map((segment) => segment.supply));
}
