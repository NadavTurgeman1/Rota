import type { Lang } from "../domain";
import type { LaborNote } from "../domain/types";
import type { InsightSpan, PatternKind } from "./report";

interface ScreenCopy {
  dashboardHint: string;
  allShifts: string;
  onSite: string;
  onSiteEmpty: string;
  floorTitle: string;
  clockIn: string;
  clockOut: string;
  stillHere: string;
  noAssigned: string;
  noRoleShifts: string;
  dayEmpty: string;
  lensHint: string;
  noSchedule: string;
  entered: string;
  early: (minutes: number) => string;
  late: (minutes: number) => string;
  missing: string;
  sick: string;
  vacation: string;
  loadingClocks: string;
  insightsHint: string;
  span: Record<InsightSpan, string>;
  range: (from: string, to: string) => string;
  laborTitle: string;
  laborHint: string;
  laborCode: Record<LaborNote["code"], string>;
  laborEmpty: string;
  shortagesTitle: string;
  shortagesEmpty: string;
  shortageLine: (name: string, date: string, filled: number, required: number) => string;
  occupancyTitle: string;
  occupancyEmpty: string;
  occupancyLine: (name: string, shift: string, date: string, role: string) => string;
  lateTitle: string;
  lateEmpty: string;
  lateLine: (name: string, shift: string, date: string, minutes: number) => string;
  noShowTitle: string;
  noShowEmpty: string;
  noShowLine: (name: string, shift: string, date: string) => string;
  recurringTitle: string;
  recurringEmpty: string;
  recurringLine: (name: string, role: string, times: number, missing: number) => string;
  idleTitle: string;
  idleEmpty: string;
  idleLine: (name: string, days: number) => string;
  idleNever: (name: string, days: number) => string;
  patternsTitle: string;
  patternsEmpty: string;
  patternLine: (name: string, kind: PatternKind, count: number) => string;
  hiringTitle: string;
  hiringEmpty: string;
  hiringLine: (count: number, role: string, shift: string, days: number) => string;
  burnoutTitle: string;
  burnoutEmpty: string;
  burnoutAction: Record<LaborNote["code"], string>;
  clocksMissing: string;
  more: (count: number) => string;
}

export const screenCopy: Record<Lang, ScreenCopy> = {
  he: {
    dashboardHint: "הסידור למעלה לצפייה. אפשר לראות את כל המשמרות או תפקיד אחד. לחיצה על יום או משמרת מציגה למטה מי באתר, ואת הכניסות והיציאות.",
    allShifts: "כל המשמרות",
    onSite: "עובדים באתר",
    onSiteEmpty: "אין כרגע עובדים באתר.",
    floorTitle: "כניסות ויציאות",
    clockIn: "כניסה",
    clockOut: "יציאה",
    stillHere: "באתר",
    noAssigned: "אין משובצים",
    noRoleShifts: "אין משמרות לתפקיד הזה.",
    dayEmpty: "אין משמרות פתוחות ביום הזה.",
    lensHint: "לחצו על מספר כדי לפתוח את הפירוט.",
    noSchedule: "אין שיבוץ לשבוע הזה.",
    entered: "נכנסו",
    early: (minutes) => `הקדים ב־${minutes} דק׳`,
    late: (minutes) => `איחר ב־${minutes} דק׳`,
    missing: "לא נכנס",
    sick: "מחלה",
    vacation: "חופשה",
    loadingClocks: "ההחתמות נטענות.",
    insightsHint: "המספרים מחושבים מהשיבוץ ומההחתמות. חריגה מדיני עבודה ומנוחה נספרת לפי השיבוץ שפורסם.",
    span: { day: "יום", week: "שבוע", month: "חודש", quarter: "3 חודשים" },
    range: (from, to) => (from === to ? from : `${from} – ${to}`),
    laborTitle: "חריגות מדיני עבודה ומנוחה",
    laborHint: "לחיצה על סוג מציגה את החריגות עצמן.",
    laborCode: {
      consecutive_days: "שבעה ימים ברצף",
      weekly_rest: "מנוחה שבועית",
      daily_gap: "מנוחה בין משמרות",
      day_cap: "יום עבודה ארוך",
      overtime: "שעות נוספות",
      night_weeks: "משמרות לילה",
      consecutive_shabbat: "שבתות ברצף",
    },
    laborEmpty: "אין חריגות בתקופה הזו.",
    shortagesTitle: "חוסרים במשמרות",
    shortagesEmpty: "אין חוסר מול התקן בתקופה הזו.",
    shortageLine: (name, date, filled, required) => `${date} · ${name}: ${filled} מתוך ${required}`,
    occupancyTitle: "תפיסת תקן משנית",
    occupancyEmpty: "אף אחד לא שובץ לפי תפקיד משני.",
    occupancyLine: (name, shift, date, role) => `${name} · ${shift} · ${date} · ${role}`,
    lateTitle: "איחורים",
    lateEmpty: "אין איחורים בתקופה הזו.",
    lateLine: (name, shift, date, minutes) => `${name} · ${shift} · ${date} · ${minutes} דק׳`,
    noShowTitle: "הברזות",
    noShowEmpty: "אין הברזות בתקופה הזו.",
    noShowLine: (name, shift, date) => `${name} · ${shift} · ${date}`,
    recurringTitle: "משמרות שחוזרות עם חוסר",
    recurringEmpty: "אין משמרת שחזרה עם חוסר.",
    recurringLine: (name, role, times, missing) => `${name}${role ? ` · ${role}` : ""}: ${times} פעמים, בערך ${missing} חסרים`,
    idleTitle: "לא שובצו יותר מ־15 יום",
    idleEmpty: "אין עובד כזה בתקופה הזו.",
    idleLine: (name, days) => `${name}: ${days} ימים מהשיבוץ האחרון`,
    idleNever: (name, days) => `${name}: השיבוץ האחרון היה לפני ${days} ימים`,
    patternsTitle: "דפוס פעולה שלילי",
    patternsEmpty: "אין דפוס שחוזר על עצמו.",
    patternLine: (name, kind, count) => {
      if (kind === "late") return `${name}: ${count} איחורים`;
      if (kind === "noshow") return `${name}: ${count} הברזות`;
      return `${name}: ${count} חריגות עומס`;
    },
    hiringTitle: "הצעות העסקה",
    hiringEmpty: "אין חוסר שחוזר מספיק כדי להציע העסקה.",
    hiringLine: (count, role, shift, days) => `לגייס ${count} לתפקיד ${role || "כללי"} במשמרת ${shift}. היא חסרה ${days} פעמים.`,
    burnoutTitle: "מניעת שחיקה",
    burnoutEmpty: "אין עומס שמחייב שינוי בשיבוץ.",
    burnoutAction: {
      consecutive_days: "לשחרר ממשמרת אחרי הרצף",
      weekly_rest: "לקבוע מנוחה של 36 שעות",
      daily_gap: "להרחיק בין המשמרות",
      day_cap: "לקצר את יום העבודה",
      overtime: "להוריד שעות נוספות",
      night_weeks: "לפזר משמרות לילה",
      consecutive_shabbat: "לפנות שבת",
    },
    clocksMissing: "ההחתמות לא נטענו, ולכן איחורים והברזות לא מוצגים.",
    more: (count) => `ועוד ${count}`,
  },
  en: {
    dashboardHint: "The week above is view only. See every shift, or one role. Choose a day or a shift to show who is on site, and the clock-ins and clock-outs, below.",
    allShifts: "All shifts",
    onSite: "On site",
    onSiteEmpty: "Nobody is on site right now.",
    floorTitle: "Clock-ins and clock-outs",
    clockIn: "In",
    clockOut: "Out",
    stillHere: "On site",
    noAssigned: "Nobody assigned",
    noRoleShifts: "This role has no shifts.",
    dayEmpty: "No shifts are open that day.",
    lensHint: "Choose a number to open the detail.",
    noSchedule: "This week has no schedule.",
    entered: "Clocked in",
    early: (minutes) => `${minutes} min early`,
    late: (minutes) => `${minutes} min late`,
    missing: "No clock-in",
    sick: "Sick",
    vacation: "Vacation",
    loadingClocks: "Clock-ins are loading.",
    insightsHint: "Figures come from the schedule and from clock-ins. Hours-of-work exceptions follow the published assignments.",
    span: { day: "Day", week: "Week", month: "Month", quarter: "3 months" },
    range: (from, to) => (from === to ? from : `${from} – ${to}`),
    laborTitle: "Hours of work and rest",
    laborHint: "Choose a type to see each exception.",
    laborCode: {
      consecutive_days: "Seven days in a row",
      weekly_rest: "Weekly rest",
      daily_gap: "Rest between shifts",
      day_cap: "Long work day",
      overtime: "Overtime",
      night_weeks: "Night shifts",
      consecutive_shabbat: "Rest days in a row",
    },
    laborEmpty: "No exceptions in this period.",
    shortagesTitle: "Shift shortages",
    shortagesEmpty: "No shift is under its standard in this period.",
    shortageLine: (name, date, filled, required) => `${date} · ${name}: ${filled} of ${required}`,
    occupancyTitle: "Secondary-role fill",
    occupancyEmpty: "Nobody was placed through a secondary role.",
    occupancyLine: (name, shift, date, role) => `${name} · ${shift} · ${date} · ${role}`,
    lateTitle: "Late arrivals",
    lateEmpty: "No late arrivals in this period.",
    lateLine: (name, shift, date, minutes) => `${name} · ${shift} · ${date} · ${minutes} min`,
    noShowTitle: "No-shows",
    noShowEmpty: "No no-shows in this period.",
    noShowLine: (name, shift, date) => `${name} · ${shift} · ${date}`,
    recurringTitle: "Shifts that keep coming up short",
    recurringEmpty: "No shift was short more than once.",
    recurringLine: (name, role, times, missing) => `${name}${role ? ` · ${role}` : ""}: ${times} times, about ${missing} short`,
    idleTitle: "Not scheduled for more than 15 days",
    idleEmpty: "Nobody has been unscheduled that long.",
    idleLine: (name, days) => `${name}: ${days} days since the last assignment`,
    idleNever: (name, days) => `${name}: last assigned ${days} days ago`,
    patternsTitle: "Repeated problems",
    patternsEmpty: "Nothing repeats often enough to call a pattern.",
    patternLine: (name, kind, count) => {
      if (kind === "late") return `${name}: late ${count} times`;
      if (kind === "noshow") return `${name}: ${count} no-shows`;
      return `${name}: ${count} workload exceptions`;
    },
    hiringTitle: "Hiring",
    hiringEmpty: "No shortage repeats often enough to suggest a hire.",
    hiringLine: (count, role, shift, days) => `Hire ${count} for ${role || "any role"} on ${shift}. It was short ${days} times.`,
    burnoutTitle: "Avoiding burnout",
    burnoutEmpty: "No workload that calls for a schedule change.",
    burnoutAction: {
      consecutive_days: "Give a day off after the run",
      weekly_rest: "Schedule 36 hours of rest",
      daily_gap: "Leave more time between shifts",
      day_cap: "Shorten the work day",
      overtime: "Cut overtime",
      night_weeks: "Spread the night shifts",
      consecutive_shabbat: "Give a weekly rest day",
    },
    clocksMissing: "Clock-ins are not loaded, so late arrivals and no-shows are hidden.",
    more: (count) => `${count} more`,
  },
  ru: {
    dashboardHint: "Неделя сверху только для просмотра. Можно видеть все смены или одну роль. Нажмите день или смену, чтобы ниже увидеть, кто на объекте, и приходы с уходами.",
    allShifts: "Все смены",
    onSite: "На объекте",
    onSiteEmpty: "Сейчас на объекте никого нет.",
    floorTitle: "Приходы и уходы",
    clockIn: "Приход",
    clockOut: "Уход",
    stillHere: "На объекте",
    noAssigned: "Никого не назначили",
    noRoleShifts: "У этой роли нет смен.",
    dayEmpty: "В этот день нет открытых смен.",
    lensHint: "Нажмите число, чтобы открыть подробности.",
    noSchedule: "На эту неделю графика нет.",
    entered: "Отметились",
    early: (minutes) => `на ${minutes} мин раньше`,
    late: (minutes) => `опоздание ${minutes} мин`,
    missing: "Нет прихода",
    sick: "Больничный",
    vacation: "Отпуск",
    loadingClocks: "Отметки загружаются.",
    insightsHint: "Цифры берутся из графика и из отметок. Замечания по часам работы идут по опубликованным назначениям.",
    span: { day: "День", week: "Неделя", month: "Месяц", quarter: "3 месяца" },
    range: (from, to) => (from === to ? from : `${from} – ${to}`),
    laborTitle: "Часы работы и отдыха",
    laborHint: "Выберите вид, чтобы увидеть каждое замечание.",
    laborCode: {
      consecutive_days: "Семь дней подряд",
      weekly_rest: "Недельный отдых",
      daily_gap: "Отдых между сменами",
      day_cap: "Длинный рабочий день",
      overtime: "Сверхурочные",
      night_weeks: "Ночные смены",
      consecutive_shabbat: "Дни отдыха подряд",
    },
    laborEmpty: "В этом периоде замечаний нет.",
    shortagesTitle: "Нехватки в сменах",
    shortagesEmpty: "Ни одна смена не ниже нормы в этом периоде.",
    shortageLine: (name, date, filled, required) => `${date} · ${name}: ${filled} из ${required}`,
    occupancyTitle: "Заполнение дополнительной ролью",
    occupancyEmpty: "Никого не поставили через дополнительную роль.",
    occupancyLine: (name, shift, date, role) => `${name} · ${shift} · ${date} · ${role}`,
    lateTitle: "Опоздания",
    lateEmpty: "В этом периоде опозданий нет.",
    lateLine: (name, shift, date, minutes) => `${name} · ${shift} · ${date} · ${minutes} мин`,
    noShowTitle: "Неявки",
    noShowEmpty: "В этом периоде неявок нет.",
    noShowLine: (name, shift, date) => `${name} · ${shift} · ${date}`,
    recurringTitle: "Смены, которым снова не хватает людей",
    recurringEmpty: "Ни одна смена не была короткой больше одного раза.",
    recurringLine: (name, role, times, missing) => `${name}${role ? ` · ${role}` : ""}: ${times} раз, примерно не хватает ${missing}`,
    idleTitle: "Не ставили больше 15 дней",
    idleEmpty: "Никто не оставался без графика так долго.",
    idleLine: (name, days) => `${name}: ${days} дней с последнего назначения`,
    idleNever: (name, days) => `${name}: последнее назначение ${days} дней назад`,
    patternsTitle: "Повторяющиеся проблемы",
    patternsEmpty: "Ничего не повторяется достаточно часто, чтобы назвать это закономерностью.",
    patternLine: (name, kind, count) => {
      if (kind === "late") return `${name}: опозданий ${count}`;
      if (kind === "noshow") return `${name}: неявок ${count}`;
      return `${name}: замечаний по нагрузке ${count}`;
    },
    hiringTitle: "Найм",
    hiringEmpty: "Нехватка не повторяется достаточно часто, чтобы предлагать найм.",
    hiringLine: (count, role, shift, days) => `Нанять ${count} на роль ${role || "любую"}, смена ${shift}. Не хватало ${days} раз.`,
    burnoutTitle: "Как снизить выгорание",
    burnoutEmpty: "Нет нагрузки, из-за которой стоит менять график.",
    burnoutAction: {
      consecutive_days: "Дать выходной после серии",
      weekly_rest: "Поставить 36 часов отдыха",
      daily_gap: "Оставить больше времени между сменами",
      day_cap: "Сократить рабочий день",
      overtime: "Срезать сверхурочные",
      night_weeks: "Разнести ночные смены",
      consecutive_shabbat: "Дать недельный день отдыха",
    },
    clocksMissing: "Отметки не загрузились, поэтому опоздания и неявки скрыты.",
    more: (count) => `и ещё ${count}`,
  },
};
