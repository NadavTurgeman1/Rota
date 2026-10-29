import { agreementAllows, parseClock, shiftKind, type Business, type Employee, type RotaState, type ShiftDefinition } from "../domain";

export type BlockSplit = "general" | "weekday" | "shift";

export interface BlockBucket {
  id: string;
  kind: "general" | "weekday" | "weekend" | "shift" | "unmatched";
  /** Home shift, or the grid shift when nothing on the primary site matches. */
  shiftId?: string;
  used: number;
  max: number;
}

/** Sunday–Thursday are weekdays. Friday and Saturday are the weekend. */
const WEEKEND = new Set([5, 6]);

export function blockSplitOf(biz: Business): BlockSplit {
  return biz.blockSplit === "weekday" || biz.blockSplit === "shift" ? biz.blockSplit : "general";
}

function whole(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) < 0) return 0;
  return Math.floor(value ?? 0);
}

/** A non-negative integer, or null when the field cannot be stored. */
export function blockCount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return null;
  return value;
}

export function normalizeCustom(value: Employee["customBlocks"]): Employee["customBlocks"] | null {
  if (!value) return null;
  const max = blockCount(value.max);
  const weekday = blockCount(value.weekday);
  const weekend = blockCount(value.weekend);
  if (max === null || weekday === null || weekend === null) return null;
  const shifts: Record<string, number> = {};
  for (const [id, raw] of Object.entries(value.shifts ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    const count = blockCount(raw);
    if (count === null) return null;
    shifts[id] = count;
  }
  return { max, weekday, weekend, shifts };
}

/** Numbers a new personal override starts from: the primary site's current caps. */
export function customFromSite(biz: Business): NonNullable<Employee["customBlocks"]> {
  const shifts: Record<string, number> = {};
  for (const shift of biz.shifts) shifts[shift.id] = whole(biz.shiftBlocks?.[shift.id]);
  return {
    max: whole(biz.maxBlocks),
    weekday: whole(biz.weekdayBlocks),
    weekend: whole(biz.weekendBlocks),
    shifts,
  };
}

interface BlockCaps {
  split: BlockSplit;
  max: number;
  weekday: number;
  weekend: number;
  shifts: Record<string, number>;
}

function capsFor(home: Business, employee: Employee | undefined): BlockCaps | null {
  if (home.blockLimit !== true) return null;
  const custom = employee?.customBlocks;
  const shifts: Record<string, number> = {};
  for (const shift of home.shifts) {
    shifts[shift.id] = whole(custom ? custom.shifts?.[shift.id] : home.shiftBlocks?.[shift.id]);
  }
  return {
    split: blockSplitOf(home),
    max: whole(custom ? custom.max : home.maxBlocks),
    weekday: whole(custom ? custom.weekday : home.weekdayBlocks),
    weekend: whole(custom ? custom.weekend : home.weekendBlocks),
    shifts,
  };
}

/** Open agreement cells missing from the submitted grid. A missing week is not a submission. */
export function blockedCells(state: RotaState, employeeId: string, grid: string[][] | undefined): { day: number; shiftId: string }[] {
  if (!grid) return [];
  const employee = state.emps.find((item) => item.id === employeeId);
  if (!employee) return [];
  const cells: { day: number; shiftId: string }[] = [];
  for (let day = 0; day < 7; day += 1) {
    const marked = new Set(grid[day] ?? []);
    for (const shift of state.biz.shifts) {
      if (!agreementAllows(employee, day, shift.id) || Number(shift.req[day] || 0) <= 0) continue;
      if (!marked.has(shift.id)) cells.push({ day, shiftId: shift.id });
    }
  }
  return cells;
}

function matchedHomeShift(shift: ShiftDefinition, homeShifts: ShiftDefinition[]): ShiftDefinition | null {
  const exact = homeShifts.find((item) => item.id === shift.id);
  if (exact) return exact;
  const kind = shiftKind(shift.start, shift.end);
  const same = homeShifts.filter((item) => shiftKind(item.start, item.end) === kind);
  if (same.length === 0) return null;
  const start = parseClock(shift.start);
  return same.slice().sort((left, right) => {
    const distance = Math.abs(parseClock(left.start) - start) - Math.abs(parseClock(right.start) - start);
    if (distance !== 0) return distance;
    return homeShifts.indexOf(left) - homeShifts.indexOf(right);
  })[0];
}

/**
 * How the grid's blocks spend the primary site's cap.
 * Shift mode counts a secondary site's shift against the primary shift of the same kind,
 * choosing the closest start when several share that kind. A shift with no match is its own bucket of 0.
 */
export function blockBuckets(state: RotaState, employeeId: string, grid: string[][] | undefined, home: Business = state.biz): BlockBucket[] {
  const employee = state.emps.find((item) => item.id === employeeId);
  const caps = capsFor(home, employee);
  if (!caps) return [];
  const blocks = blockedCells(state, employeeId, grid);
  if (caps.split === "general") {
    return [{ id: "all", kind: "general", used: blocks.length, max: caps.max }];
  }
  if (caps.split === "weekday") {
    const weekend = blocks.filter((cell) => WEEKEND.has(cell.day)).length;
    return [
      { id: "weekday", kind: "weekday", used: blocks.length - weekend, max: caps.weekday },
      { id: "weekend", kind: "weekend", used: weekend, max: caps.weekend },
    ];
  }
  const used = new Map<string, number>();
  const unmatched = new Map<string, number>();
  for (const cell of blocks) {
    const shift = state.biz.shifts.find((item) => item.id === cell.shiftId);
    const homeShift = shift ? matchedHomeShift(shift, home.shifts) : null;
    if (!shift || !homeShift) {
      unmatched.set(cell.shiftId, (unmatched.get(cell.shiftId) ?? 0) + 1);
      continue;
    }
    used.set(homeShift.id, (used.get(homeShift.id) ?? 0) + 1);
  }
  const buckets: BlockBucket[] = home.shifts.map((shift) => ({
    id: shift.id,
    kind: "shift",
    shiftId: shift.id,
    used: used.get(shift.id) ?? 0,
    max: caps.shifts[shift.id] ?? 0,
  }));
  for (const [shiftId, count] of unmatched) {
    buckets.push({ id: `unmatched:${shiftId}`, kind: "unmatched", shiftId, used: count, max: 0 });
  }
  return buckets;
}

export function overBucketIds(state: RotaState, employeeId: string, grid: string[][] | undefined, home: Business = state.biz): string[] {
  return blockBuckets(state, employeeId, grid, home)
    .filter((bucket) => bucket.used > bucket.max)
    .map((bucket) => bucket.id);
}
