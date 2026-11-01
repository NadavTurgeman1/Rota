import { HDate, HebrewCalendar, flags, gematriya, type Event } from "@hebcal/core";
import { addDays, type Lang } from "../domain";

export interface Holiday {
  name: string;
  /** A day of rest: Rosh Hashana, Yom Kippur, the first and last days of the festivals, Shavuot. */
  rest: boolean;
}

const SHOWN = flags.CHAG | flags.EREV | flags.CHOL_HAMOED | flags.MAJOR_FAST | flags.MINOR_FAST;
const NAMED = /^(Chanukah|Tu BiShvat|Tu B.Av|Purim$|Shushan Purim$|Lag BaOmer|Sigd|Yom HaAliyah$|Yom HaShoah|Yom HaZikaron$|Yom HaAtzma|Yom Yerushalayim)/;
const SKIPPED = /^Erev Purim/;

function localDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Vowel points and cantillation make tiny labels hard to read. The maqaf stays as a hyphen. */
function plain(text: string): string {
  return text.replace(/\u05BE/g, "-").replace(/[\u0591-\u05C7]/g, "");
}

function candles(count: string): string {
  const number = Number(count);
  if (number === 1) return "свеча";
  if (number >= 2 && number <= 4) return "свечи";
  return "свечей";
}

/** Hebcal has no Russian locale. Known names are translated; anything new stays in English. */
function russianHoliday(name: string): string {
  name = name.replace(/[’‘ʼ]/g, "'");
  const candle = name.match(/^Chanukah: (\d+) Candles$/);
  if (candle) return `Ханука: ${candle[1]} ${candles(candle[1])}`;
  if (name === "Chanukah: 8th Day") return "Ханука: 8-й день";
  const exact: Record<string, string> = {
    "Erev Rosh Hashana": "Канун Рош ха-Шана",
    "Rosh Hashana": "Рош ха-Шана",
    "Rosh Hashana II": "Рош ха-Шана II",
    "Tzom Gedaliah": "Пост Гедальи",
    "Erev Yom Kippur": "Канун Йом Кипура",
    "Yom Kippur": "Йом Кипур",
    "Erev Sukkot": "Канун Суккота",
    "Sukkot I": "Суккот I",
    "Sukkot II (CH’’M)": "Суккот II (хол ха-моэд)",
    "Sukkot III (CH’’M)": "Суккот III (хол ха-моэд)",
    "Sukkot IV (CH’’M)": "Суккот IV (хол ха-моэд)",
    "Sukkot V (CH’’M)": "Суккот V (хол ха-моэд)",
    "Sukkot VI (CH’’M)": "Суккот VI (хол ха-моэд)",
    "Sukkot VII (Hoshana Raba)": "Суккот VII (Ошана раба)",
    "Shmini Atzeret": "Шмини Ацерет",
    "Chanukah": "Ханука",
    "Asara B’Tevet": "Десятое тевета",
    "Tu BiShvat": "Ту би-Шват",
    "Tu B'Av": "Ту бе-Ав",
    Sigd: "Сигд",
    "Yom HaAliyah": "Йом ха-Алия",
    "Ta'anit Bechorot": "Пост первенцев",
    Purim: "Пурим",
    "Shushan Purim": "Шушан Пурим",
    "Erev Pesach": "Канун Песаха",
    "Pesach I": "Песах I",
    "Pesach II (CH’’M)": "Песах II (хол ха-моэд)",
    "Pesach III (CH’’M)": "Песах III (хол ха-моэд)",
    "Pesach IV (CH’’M)": "Песах IV (хол ха-моэд)",
    "Pesach V (CH’’M)": "Песах V (хол ха-моэд)",
    "Pesach VI (CH’’M)": "Песах VI (хол ха-моэд)",
    "Pesach VII": "Песах VII",
    "Pesach Sheni": "Песах шени",
    "Lag BaOmer": "Лаг ба-Омер",
    "Erev Shavuot": "Канун Шавуота",
    Shavuot: "Шавуот",
    "Tzom Tammuz": "Пост таммуза",
    "Erev Tish’a B’Av": "Канун Девятого ава",
    "Tish’a B’Av": "Девятое ава",
    "Yom HaShoah": "Йом ха-Шоа",
    "Yom HaZikaron": "Йом ха-Зикарон",
    "Yom HaAtzma’ut": "Йом ха-Ацмаут",
    "Yom Yerushalayim": "Йом Йерушалаим",
  };
  return exact[name] ?? name.replaceAll("CH’’M", "хол ха-моэд").replace(/^Erev /, "Канун ");
}

function shown(event: Event): boolean {
  const desc = event.getDesc();
  if (SKIPPED.test(desc)) return false;
  return (event.getFlags() & SHOWN) !== 0 || NAMED.test(desc);
}

const RU_MONTH: Record<string, string> = {
  Nisan: "Нисан",
  Iyyar: "Ияр",
  Sivan: "Сиван",
  Tamuz: "Тамуз",
  Av: "Ав",
  Elul: "Элул",
  Tishrei: "Тишрей",
  Cheshvan: "Хешван",
  Kislev: "Кислев",
  Tevet: "Тевет",
  "Sh'vat": "Шват",
  Adar: "Адар",
  "Adar I": "Адар I",
  "Adar II": "Адар II",
};

function monthName(date: HDate, lang: Lang): string {
  if (lang === "en") return date.getMonthName();
  if (lang === "ru") return RU_MONTH[date.getMonthName()] ?? date.getMonthName();
  return plain(date.render("he", false).split(" ").slice(1).join(" "));
}

/** Day and month in the Hebrew calendar, like ט׳ חשון or 9 Cheshvan. */
export function hebrewDay(iso: string, lang: Lang): string {
  const date = new HDate(localDate(iso));
  return `${dayNumber(date, lang)} ${monthName(date, lang)}`;
}

function dayNumber(date: HDate, lang: Lang): string {
  return lang === "he" ? gematriya(date.getDate()) : String(date.getDate());
}

function yearNumber(date: HDate, lang: Lang): string {
  return lang === "he" ? gematriya(date.getFullYear()) : String(date.getFullYear());
}

/** Sunday to Saturday in the Hebrew calendar, like ט״ז–כ״ב תשרי תשפ״ז or ל׳ תשרי – ו׳ חשון תשפ״ז. */
export function hebrewWeekRange(week: string, lang: Lang): string {
  const first = new HDate(localDate(week));
  const last = new HDate(localDate(addDays(week, 6)));
  const year = yearNumber(last, lang);
  if (first.getFullYear() !== last.getFullYear()) {
    return `${dayNumber(first, lang)} ${monthName(first, lang)} ${yearNumber(first, lang)} – ${dayNumber(last, lang)} ${monthName(last, lang)} ${year}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${dayNumber(first, lang)} ${monthName(first, lang)} – ${dayNumber(last, lang)} ${monthName(last, lang)} ${year}`;
  }
  return `${dayNumber(first, lang)}–${dayNumber(last, lang)} ${monthName(last, lang)} ${year}`;
}

export interface HebrewWeekDay {
  hebrew: string;
  holidays: Holiday[];
}

const weekCache = new Map<string, HebrewWeekDay[]>();

/** The Hebrew date and holidays of each day, Sunday first. Boards redraw often, so weeks are cached. */
export function hebrewWeek(week: string, lang: Lang): HebrewWeekDay[] {
  const key = `${week}|${lang}`;
  const cached = weekCache.get(key);
  if (cached) return cached;
  const holidays = holidaysBetween(week, addDays(week, 6), lang);
  const days = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const iso = addDays(week, day);
    return { hebrew: hebrewDay(iso, lang), holidays: holidays.get(iso) ?? [] };
  });
  if (weekCache.size > 200) weekCache.clear();
  weekCache.set(key, days);
  return days;
}

/** The Hebrew months and year that a Gregorian month spans, like תשרי–חשון תשפ״ז. */
export function hebrewMonthSpan(year: number, month: number, lang: Lang): string {
  const first = new HDate(new Date(year, month - 1, 1));
  const last = new HDate(new Date(year, month, 0));
  const name = (date: HDate) => monthName(date, lang);
  const yearOf = (date: HDate) => (lang === "he" ? gematriya(date.getFullYear()) : String(date.getFullYear()));
  const months = name(first) === name(last) ? name(first) : `${name(first)}–${name(last)}`;
  const years = first.getFullYear() === last.getFullYear() ? yearOf(last) : `${yearOf(first)}–${yearOf(last)}`;
  return `${months} ${years}`;
}

/** Holidays in Israel between two dates, inclusive, keyed by YYYY-MM-DD. */
export function holidaysBetween(startIso: string, endIso: string, lang: Lang): Map<string, Holiday[]> {
  const events = HebrewCalendar.calendar({
    start: localDate(startIso),
    end: localDate(endIso),
    il: true,
    noRoshChodesh: true,
    noSpecialShabbat: true,
  });
  const days = new Map<string, Holiday[]>();
  for (const event of events) {
    if (!shown(event)) continue;
    const iso = isoOf(event.getDate().greg());
    const english = event.render("en").replace(/\s\d{4}$/, "");
    const name = lang === "he" ? plain(event.render("he")).replace(/\s\d{4}$/, "") : lang === "ru" ? russianHoliday(english) : english;
    const list = days.get(iso) ?? [];
    list.push({ name, rest: (event.getFlags() & flags.CHAG) !== 0 });
    days.set(iso, list);
  }
  return days;
}
