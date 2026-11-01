import { addDays, type Lang } from "../domain";
import { tx } from "../domain/text";
import type { Holiday } from "./hebrew-calendar";

interface Named {
  he: string;
  en: string;
  ru: string;
  rest: boolean;
}

function label(item: Named, lang: Lang): Holiday {
  return { name: tx(lang, item.he, item.en, item.ru), rest: item.rest };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftIso(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Western Easter, Anonymous Gregorian computus. */
export function westernEaster(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Orthodox Easter on the Gregorian calendar. The Julian date is shifted by the century gap. */
export function orthodoxEaster(year: number): string {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const gap = year >= 2100 ? 14 : 13;
  return shiftIso(iso(year, month, day), gap);
}

function christianYear(year: number): Map<string, Named[]> {
  const days = new Map<string, Named[]>();
  const add = (date: string, item: Named) => {
    const list = days.get(date) ?? [];
    if (list.some((current) => current.en === item.en)) return;
    list.push(item);
    days.set(date, list);
  };
  const western = westernEaster(year);
  const eastern = orthodoxEaster(year);
  const julian = (month: number, day: number) => shiftIso(iso(year, month, day), year >= 2100 ? 14 : 13);
  add(iso(year, 1, 1), { he: "שנה חדשה", en: "New Year", ru: "Новый год", rest: true });
  add(iso(year, 1, 6), { he: "חג ההתגלות", en: "Epiphany", ru: "Богоявление", rest: false });
  add(iso(year, 1, 6), { he: "חג המולד הארמני", en: "Armenian Christmas", ru: "Армянское Рождество", rest: true });
  add(iso(year, 1, 6), { he: "ערב חג המולד האורתודוקסי", en: "Orthodox Christmas Eve", ru: "Канун православного Рождества", rest: false });
  add(iso(year, 1, 7), { he: "חג המולד האורתודוקסי", en: "Orthodox Christmas", ru: "Православное Рождество", rest: true });
  add(iso(year, 1, 19), { he: "חג ההתגלות האורתודוקסי", en: "Orthodox Theophany", ru: "Православное Богоявление", rest: false });
  add(shiftIso(western, -46), { he: "יום רביעי של האפר", en: "Ash Wednesday", ru: "Пепельная среда", rest: false });
  add(iso(year, 3, 25), { he: "חג הבשורה", en: "Annunciation", ru: "Благовещение", rest: false });
  add(julian(3, 25), { he: "חג הבשורה האורתודוקסי", en: "Orthodox Annunciation", ru: "Православное Благовещение", rest: false });
  add(shiftIso(western, -7), { he: "יום ראשון של הדקלים", en: "Palm Sunday", ru: "Вербное воскресенье", rest: false });
  add(shiftIso(western, -2), { he: "יום שישי הטוב", en: "Good Friday", ru: "Страстная пятница", rest: false });
  add(western, { he: "חג הפסחא", en: "Easter", ru: "Пасха", rest: true });
  add(shiftIso(western, 1), { he: "שני של פסחא", en: "Easter Monday", ru: "Светлый понедельник", rest: false });
  add(shiftIso(western, 39), { he: "חג העלייה", en: "Ascension", ru: "Вознесение", rest: false });
  add(shiftIso(western, 49), { he: "פנטקוסט", en: "Pentecost", ru: "Пятидесятница", rest: false });
  add(shiftIso(eastern, -48), { he: "יום שני הנקי", en: "Clean Monday", ru: "Чистый понедельник", rest: false });
  add(shiftIso(eastern, -7), { he: "יום ראשון של הדקלים האורתודוקסי", en: "Orthodox Palm Sunday", ru: "Православное Вербное воскресенье", rest: false });
  add(shiftIso(eastern, -2), { he: "יום שישי הטוב האורתודוקסי", en: "Orthodox Good Friday", ru: "Православная Страстная пятница", rest: false });
  add(eastern, { he: "חג הפסחא האורתודוקסי", en: "Orthodox Easter", ru: "Православная Пасха", rest: true });
  add(shiftIso(eastern, 1), { he: "שני של פסחא האורתודוקסי", en: "Orthodox Easter Monday", ru: "Православный Светлый понедельник", rest: false });
  add(shiftIso(eastern, 39), { he: "חג העלייה האורתודוקסי", en: "Orthodox Ascension", ru: "Православное Вознесение", rest: false });
  add(shiftIso(eastern, 49), { he: "פנטקוסט אורתודוקסי", en: "Orthodox Pentecost", ru: "Православная Пятидесятница", rest: false });
  add(iso(year, 8, 15), { he: "חג העלייה לשמים", en: "Assumption", ru: "Успение", rest: false });
  add(julian(8, 15), { he: "חג ההירדמות", en: "Dormition", ru: "Успение Богородицы", rest: false });
  add(iso(year, 10, 31), { he: "אלווין", en: "Halloween", ru: "Хэллоуин", rest: false });
  add(iso(year, 11, 1), { he: "כל הקדושים", en: "All Saints", ru: "День всех святых", rest: false });
  add(iso(year, 12, 24), { he: "ערב חג המולד", en: "Christmas Eve", ru: "Канун Рождества", rest: false });
  add(iso(year, 12, 25), { he: "חג המולד", en: "Christmas", ru: "Рождество", rest: true });
  add(iso(year, 12, 31), { he: "סילבסטר", en: "New Year's Eve", ru: "Канун Нового года", rest: false });
  return days;
}

const MUSLIM: Record<string, Named> = {
  "1-1": { he: "ראש השנה המוסלמי", en: "Islamic New Year", ru: "Исламский Новый год", rest: true },
  "1-10": { he: "עאשורה", en: "Ashura", ru: "Ашура", rest: false },
  "3-12": { he: "מולד הנביא", en: "Mawlid", ru: "Маулид", rest: false },
  "8-15": { he: "לילת אל-בראאה", en: "Laylat al-Bara'ah", ru: "Ляйлят аль-Бараа", rest: false },
  "7-27": { he: "אל-אסראא ואל-מעראג'", en: "Isra and Mi'raj", ru: "Исра и Мирадж", rest: false },
  "9-1": { he: "תחילת הרמדאן", en: "Ramadan begins", ru: "Начало Рамадана", rest: false },
  "9-27": { he: "לילת אל-קדר", en: "Laylat al-Qadr", ru: "Ляйлят аль-Кадр", rest: false },
  "10-1": { he: "עיד אל-פיטר", en: "Eid al-Fitr", ru: "Ураза-байрам", rest: true },
  "10-2": { he: "עיד אל-פיטר", en: "Eid al-Fitr", ru: "Ураза-байрам", rest: true },
  "10-3": { he: "עיד אל-פיטר", en: "Eid al-Fitr", ru: "Ураза-байрам", rest: true },
  "12-9": { he: "יום ערפה", en: "Day of Arafah", ru: "День Арафа", rest: false },
  "12-10": { he: "עיד אל-אדחא", en: "Eid al-Adha", ru: "Курбан-байрам", rest: true },
  "12-11": { he: "עיד אל-אדחא", en: "Eid al-Adha", ru: "Курбан-байрам", rest: true },
  "12-12": { he: "עיד אל-אדחא", en: "Eid al-Adha", ru: "Курбан-байрам", rest: true },
  "12-13": { he: "עיד אל-אדחא", en: "Eid al-Adha", ru: "Курбан-байрам", rest: true },
  "12-18": { he: "עיד אל-ע'דיר", en: "Eid al-Ghadir", ru: "Ид аль-Гадир", rest: false },
};

const hijriFormat = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  timeZone: "UTC",
  day: "numeric",
  month: "numeric",
});

function hijri(date: string): { month: number; day: number } | null {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parts = hijriFormat.formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
  const hijriDay = Number(parts.find((part) => part.type === "day")?.value);
  const hijriMonth = Number(parts.find((part) => part.type === "month")?.value);
  if (!hijriDay || !hijriMonth) return null;
  return { month: hijriMonth, day: hijriDay };
}

function christianOn(date: string, lang: Lang, years: Map<number, Map<string, Named[]>>): Holiday[] {
  const year = Number(date.slice(0, 4));
  const table = years.get(year) ?? christianYear(year);
  if (!years.has(year)) years.set(year, table);
  return (table.get(date) ?? []).map((item) => label(item, lang));
}

/** Christian and Muslim holidays between two dates, inclusive. Muslim dates follow Umm al-Qura. */
export function faithHolidays(
  startIso: string,
  endIso: string,
  lang: Lang,
  which: { christian: boolean; muslim: boolean },
): Map<string, Holiday[]> {
  const days = new Map<string, Holiday[]>();
  const years = new Map<number, Map<string, Named[]>>();
  let cursor = startIso;
  for (let guard = 0; cursor <= endIso && guard < 400; guard += 1) {
    const holidays: Holiday[] = [];
    if (which.christian) holidays.push(...christianOn(cursor, lang, years));
    if (which.muslim) {
      const date = hijri(cursor);
      const item = date ? MUSLIM[`${date.month}-${date.day}`] : undefined;
      if (item) holidays.push(label(item, lang));
    }
    if (holidays.length > 0) days.set(cursor, holidays);
    cursor = addDays(cursor, 1);
  }
  return days;
}
