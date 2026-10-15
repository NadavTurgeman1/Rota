import {
  addDays,
  dayName,
  shiftById,
  type CoverageOption,
  type Lang,
  type ReplacementCandidate,
  type RotaState,
} from "../domain";
import { clockLabel, type Proposal } from "./edit";

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

/** Default PNG name: site and the week, like ברן-18.10-24.10.png */
export function pngFileName(siteName: string, week: string): string {
  const safe = siteName.replace(/[\\/:*?"<>|]/g, "").trim() || "rota";
  return `${safe}-${dotDate(week)}-${dotDate(addDays(week, 6))}.png`;
}

export function proposalText(proposal: Proposal, lang: Lang): string {
  if (proposal.kind === "extra") {
    const option = proposal.option;
    if (option.n > option.agreed) {
      return lang === "he"
        ? `${option.name}: משמרת ${option.n} מעבר להסכם של ${option.agreed}`
        : `${option.name}: shift ${option.n} beyond the agreed ${option.agreed}`;
    }
    return lang === "he" ? `${option.name}: משמרת נוספת` : `${option.name}: extra shift`;
  }
  const parts = proposal.option.ext
    .map((part) => `${part.name} ${clockLabel(part.start)}–${clockLabel(part.end)}`)
    .join(", ");
  return lang === "he" ? `הארכת משמרות (${parts})` : `Extend shifts (${parts})`;
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
  return `${candidate.name} · ${quota} · ${hours}h${preference}${nights}`;
}

export function splitText(option: CoverageOption, lang: Lang): string {
  const parts = option.ext
    .map((part) => `${part.name} ${clockLabel(part.start)}–${clockLabel(part.end)}`)
    .join(", ");
  return lang === "he" ? `חלוקת המשמרת (${parts})` : `Split the shift (${parts})`;
}
