import {
  addDays,
  dayName,
  shiftById,
  type CoverageOption,
  type CoveragePart,
  type Lang,
  type ReplacementCandidate,
  type RotaState,
} from "../domain";
import { hourFixText } from "../i18n/copy";
import { clockLabel, type HourFix, type Proposal } from "./edit";

const SHIFT_LABELS: Record<string, Record<Lang, string>> = {
  Morning: { he: "בוקר", en: "Morning" },
  Afternoon: { he: "צהריים", en: "Afternoon" },
  Night: { he: "לילה", en: "Night" },
  Day: { he: "יום", en: "Day" },
};

const SITE_LABELS: Record<string, string> = {
  Headquarters: "מטה",
  Harbor: "נמל",
};

/** True when this weekday column is the viewer's local calendar day. */
export function columnIsToday(week: string, day: number, now = new Date()): boolean {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return addDays(week, day) === `${now.getFullYear()}-${month}-${date}`;
}

export function shiftLabel(name: string, lang: Lang): string {
  return SHIFT_LABELS[name]?.[lang] ?? name;
}

export function localizeShiftNames(text: string, lang: Lang): string {
  if (lang === "en") return text;
  return text.replaceAll("Morning", "בוקר").replaceAll("Afternoon", "צהריים").replaceAll("Night", "לילה").replaceAll(/\bDay\b/g, "יום");
}

export function siteLabel(name: string, lang: Lang): string {
  return lang === "he" ? (SITE_LABELS[name] ?? name) : name;
}

export function orgTypeLabel(type: string, lang: Lang): string {
  return type === "Security company" && lang === "he" ? "חברת אבטחה" : type;
}

export function slotTitle(state: RotaState, slot: { day: number; shiftId: string }, lang: Lang): string {
  return `${dayName(slot.day, lang)} · ${shiftLabel(shiftById(state, slot.shiftId).name, lang)}`;
}

function formatIso(iso: string, lang: Lang, withYear: boolean): string {
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

export function formatDayDate(week: string, day: number, lang: Lang): string {
  return formatIso(addDays(week, day), lang, false);
}

export function formatWeekRange(week: string, lang: Lang): string {
  const start = formatIso(week, lang, false);
  const end = formatIso(addDays(week, 6), lang, true);
  return `${start} – ${end}`;
}

function dotDate(iso: string): string {
  const [, month, date] = iso.split("-");
  return `${Number(date)}.${Number(month)}`;
}

/** File name for a weekly export: site and the week, like ברן-18.10-24.10.png */
export function exportFileName(siteName: string, week: string, ext: string): string {
  const safe = siteName.replace(/[\\/:*?"<>|]/g, "").trim() || "rota";
  return `${safe}-${dotDate(week)}-${dotDate(addDays(week, 6))}.${ext}`;
}

export function pngFileName(siteName: string, week: string): string {
  return exportFileName(siteName, week, "png");
}

function wageNote(wage: number | undefined, dearerThan: number | undefined, lang: Lang): string {
  if (!wage || wage <= 0) return lang === "he" ? " · שכר לא הוגדר" : " · wage not set";
  const amount = Number.isInteger(wage) ? String(wage) : wage.toFixed(2);
  const base = lang === "he" ? ` · ${amount} ₪ לשעה` : ` · ${amount} ₪/hour`;
  if (!dearerThan || wage <= dearerThan) return base;
  const cheaper = Number.isInteger(dearerThan) ? String(dearerThan) : dearerThan.toFixed(2);
  return base + (lang === "he" ? ` · יקר יותר מ־${cheaper} ₪` : ` · dearer than ${cheaper} ₪`);
}

function seatName(state: RotaState | undefined, key: string, lang: Lang): string {
  const shiftId = key.split("|")[1] ?? key;
  if (!state) return shiftId;
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  return shift ? shiftLabel(shift.name, lang) : shiftId;
}

/** Every person who moves or extends, by name. People who stay put are left out. */
export function coverageChanges(option: CoverageOption, lang: Lang, state?: RotaState): string {
  const changed = option.parts.filter((part) => part.from !== part.slotKey || part.extended);
  const ordered = [...changed].sort((left, right) => {
    const moved = (part: CoveragePart) => (part.from !== part.slotKey ? 0 : 1);
    return moved(left) - moved(right) || left.start - right.start || left.name.localeCompare(right.name, lang);
  });
  const lines = ordered.map((part) => changeLine(part, lang, state));
  const dearer = option.dearerThan ? wageNote(option.wage, option.dearerThan, lang) : "";
  return `${lines.join(". ")}${dearer}`;
}

function changeLine(part: CoveragePart, lang: Lang, state?: RotaState): string {
  const moved = part.from !== part.slotKey;
  const from = seatName(state, part.from, lang);
  const to = seatName(state, part.slotKey, lang);
  const hours = `${clockLabel(part.start)}–${clockLabel(part.end)}`;
  const wage = part.extended ? wageNote(part.wage, undefined, lang) : "";
  if (lang === "he") {
    if (moved && part.extended) return `${part.name} — מעבר מ${from} ל${to}, והארכה לכפולה (${hours})${wage}`;
    if (moved) return `${part.name} — מעבר מ${from} ל${to}`;
    return `${part.name} — הארכה לכפולה ב${to} (${hours})${wage}`;
  }
  if (moved && part.extended) return `${part.name} — moves from ${from} to ${to} and extends into a double (${hours})${wage}`;
  if (moved) return `${part.name} — moves from ${from} to ${to}`;
  return `${part.name} — extends ${to} into a double (${hours})${wage}`;
}

export function hourFixLine(fix: HourFix, lang: Lang, state: RotaState): string {
  const shiftId = fix.slotKey.split("|")[1] ?? "";
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  const clock = clockLabel(fix.edge === "start" ? fix.start : fix.end);
  return hourFixText(lang, fix.name, shiftLabel(shift?.name ?? "", lang), fix.edge, clock);
}

export function proposalText(proposal: Proposal, lang: Lang, state?: RotaState): string {
  if (proposal.kind === "relief") {
    return lang === "he" ? `${proposal.name}: שיבוץ מתגבור` : `${proposal.name}: reinforcement assignment`;
  }
  if (proposal.kind === "extra") {
    const option = proposal.option;
    const wage = wageNote(option.wage, option.dearerThan, lang);
    if (option.n > option.agreed) {
      return lang === "he"
        ? `${option.name}: משמרת ${option.n} מעבר להסכם של ${option.agreed}${wage}`
        : `${option.name}: shift ${option.n} beyond the agreed ${option.agreed}${wage}`;
    }
    return lang === "he" ? `${option.name}: משמרת נוספת${wage}` : `${option.name}: extra shift${wage}`;
  }
  return coverageChanges(proposal.option, lang, state);
}

export function replacementText(candidate: ReplacementCandidate, lang: Lang): string {
  const quota = candidate.agreed > 0 ? `${candidate.shifts}/${candidate.agreed}` : String(candidate.shifts);
  const hours = Number.isInteger(candidate.hours) ? String(candidate.hours) : candidate.hours.toFixed(1);
  const nights =
    candidate.consecutiveNights > 1
      ? lang === "he"
        ? ` · ${candidate.consecutiveNights} לילות צמודים`
        : ` · ${candidate.consecutiveNights} nights in a row`
      : "";
  const preference = candidate.prefers ? (lang === "he" ? " · מעדיף" : " · preferred") : "";
  return `${candidate.name} · ${quota} · ${hours}h${preference}${nights}${wageNote(candidate.wage, candidate.dearerThan, lang)}`;
}

export function splitText(option: CoverageOption, lang: Lang, state?: RotaState): string {
  return coverageChanges(option, lang, state);
}
