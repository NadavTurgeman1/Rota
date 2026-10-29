import { touchedSlotKeys, weekCoverage } from "./coverage";
import { isRelief, peerLoad } from "./relief";
import { coveredSeats, effectiveSlot } from "./schedule";
import { approvedExtraShifts, dynamicReason, formatReason, slotLabel, slots, staticReason, type Lang } from "./rules";
import type { Analysis, Employee, OverQuota, RotaState, UnfilledShift } from "./types";

/** Explain a stored week. Does not change it. An unfilled seat stays unfilled. */
export function analyze(state: RotaState, week: string, lang: Lang = "he"): Analysis {
  const schedule = state.sched[week];
  if (!schedule) return { violations: [], overQuota: [], unfilled: [], coverage: [], under: [], hours: {}, counts: {} };

  const openSlots = slots(state, week);
  const employees = state.emps.filter((employee) => employee.active);
  const mine: Record<string, ReturnType<typeof slots>> = {};
  for (const employee of employees) mine[employee.id] = [];
  for (const slot of openSlots) {
    for (const employeeId of schedule.assign[slot.key] ?? []) {
      if (!mine[employeeId]) continue;
      mine[employeeId].push(effectiveSlot(schedule, slot, employeeId));
    }
  }

  const hours: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const employee of employees) {
    hours[employee.id] = mine[employee.id].reduce((sum, slot) => sum + slot.end - slot.start, 0);
    counts[employee.id] = mine[employee.id].length;
  }

  const violations: Analysis["violations"] = [];
  const unfilled: UnfilledShift[] = [];
  const touched = touchedSlotKeys(state, week);
  for (const slot of openSlots) {
    const ids = schedule.assign[slot.key] ?? [];
    for (const employeeId of ids) {
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) continue;
      const reason =
        staticReason(state, employee, slot, week) ||
        dynamicReason(state, employee, effectiveSlot(schedule, slot, employeeId), mine[employeeId], lang);
      if (!reason || reason.code === "weekly_shifts") continue;
      violations.push({
        key: `${slot.key}#${employeeId}`,
        message: `${employee.name} — ${slotLabel(state, slot, lang)}: ${formatReason(reason, lang)}`,
        reason,
      });
    }
    if (touched.has(slot.key)) continue;
    if (ids.length > slot.required) {
      const label = slotLabel(state, slot, lang);
      violations.push({
        message: lang === "he" ? `${label}: יותר עובדים מהנדרש` : `${label}: more people than required`,
      });
    }
    const covered = coveredSeats(schedule, slot.key);
    if (ids.length + covered < slot.required) {
      unfilled.push(explainGap(state, week, slot, employees, ids.length + covered, lang));
    }
  }
  const coverage = weekCoverage(state, week);

  const under: Analysis["under"] = [];
  for (const employee of employees) {
    if (isRelief(employee, state.siteId)) continue;
    const assigned = (counts[employee.id] ?? 0) + peerLoad(state, employee.id).shifts;
    if (!employee.perWeek || assigned >= employee.perWeek) continue;
    const possible = openSlots.filter((slot) => !staticReason(state, employee, slot, week)).length;
    const shortfall =
      possible < employee.perWeek
        ? lang === "he"
          ? `ההסכם והזמינות השבוע מאפשרים רק ${possible} משמרות מתאימות.`
          : `The agreement and this week's availability only allow ${possible} fitting shifts.`
        : lang === "he"
          ? "המשמרות המתאימות שנותרו כבר מלאות או יפרו כללי מנוחה."
          : "The remaining fitting shifts are full or would break rest rules.";
    under.push({
      employee,
      message:
        lang === "he"
          ? `ל-${employee.name} שובצו ${assigned} מתוך ${employee.perWeek} משמרות מוסכמות.`
          : `${employee.name} is assigned ${assigned} of ${employee.perWeek} agreed shifts.`,
      why: shortfall,
    });
  }

  const overQuota: OverQuota[] = [];
  for (const employee of employees) {
    if (isRelief(employee, state.siteId)) continue;
    const agreed = employee.perWeek;
    const count = (counts[employee.id] ?? 0) + peerLoad(state, employee.id).shifts;
    if (!agreed || count <= agreed) continue;
    const extra = count - agreed;
    const approved = approvedExtraShifts(state, employee.id) >= extra;
    overQuota.push({
      employee,
      count,
      agreed,
      message:
        lang === "he"
          ? `${employee.name}: ${count} משמרות השבוע, ${extra} מעבר להסכם של ${agreed}${approved ? " (אושר)" : ""}.`
          : `${employee.name}: ${count} shifts this week, ${extra} over the agreed ${agreed}${approved ? " (approved)" : ""}.`,
    });
  }

  return { violations, overQuota, unfilled, coverage, under, hours, counts };
}

function explainGap(
  state: RotaState,
  week: string,
  slot: ReturnType<typeof slots>[number],
  employees: Employee[],
  filled: number,
  lang: Lang,
): UnfilledShift {
  const eligible = employees.filter((employee) => !staticReason(state, employee, slot, week));
  const names = eligible.map((employee) => employee.name).join(", ");
  if (!eligible.length) {
    return {
      slot,
      filled,
      why: lang === "he" ? "אין עובד זכאי." : "No eligible employee.",
      tip:
        lang === "he"
          ? "בקשו זמינות נוספת, גייסו או הסמיכו עובדים, או בקשו מעובד להקל בהעדפה גמישה."
          : "Ask for more availability, hire or qualify people, or relax a flexible preference.",
    };
  }
  if (eligible.length < slot.required) {
    return {
      slot,
      filled,
      why:
        lang === "he"
          ? `רק ${eligible.length} זכאים (${names}) אך נדרשים ${slot.required}.`
          : `Only ${eligible.length} eligible (${names}) but ${slot.required} are required.`,
      tip:
        lang === "he"
          ? "בקשו זמינות מעובדים אחרים או הוסיפו עובדים מוסמכים."
          : "Ask other people for availability, or add qualified employees.",
    };
  }
  return {
    slot,
    filled,
    why:
      lang === "he"
        ? `העובדים הזכאים (${names}) הגיעו למכסת המשמרות/השעות או שיפרו כללי מנוחה/חפיפה.`
        : `Eligible employees (${names}) are at their shift or hour cap, or would break rest or overlap rules.`,
    tip:
      lang === "he"
        ? "אשרו משמרת נוספת לעובד, אפשרו החלפה, או בדקו את כלל המנוחה בהגדרות העסק."
        : "Approve an extra shift, allow a swap, or review the rest rule in the business settings.",
  };
}
