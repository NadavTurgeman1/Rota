import { dayName, type Lang } from "../domain";
import type { Anomaly, Risk, Tip } from "./sample";

interface InsightsCopy {
  title: string;
  hint: string;
  sample: string;
  sampleNote: string;
  coverage: string;
  hours: string;
  doubles: string;
  atRisk: string;
  balance: string;
  balanceEven: string;
  workloadTitle: string;
  workloadHint: string;
  employee: string;
  shifts: string;
  load: string;
  nights: string;
  risk: string;
  riskLevel: Record<Risk, string>;
  staffingTitle: string;
  staffingHint: string;
  needed: string;
  available: string;
  anomaliesTitle: string;
  tipsTitle: string;
  tipsHint: string;
  noPeople: string;
}

export const insightsCopy: Record<Lang, InsightsCopy> = {
  he: {
    title: "דשבורד",
    hint: "ניתוח עומסים, שחיקה, משמרות כפולות וחריגות בצוות, עם המלצות לשבוע הבא.",
    sample: "נתוני דוגמה",
    sampleNote: "המספרים במסך הזה מדומים להמחשה ואינם מחושבים מהסידור.",
    coverage: "כיסוי משמרות",
    hours: "שעות עבודה בשבוע",
    doubles: "משמרות כפולות",
    atRisk: "בסיכון שחיקה גבוה",
    balance: "מאזן כוח אדם",
    balanceEven: "מאוזן",
    workloadTitle: "עומס עבודה לפי עובד",
    workloadHint: "משמרות ביחס למכסה החוזית. מעל 100% פירושו עבודה מעבר להסכם.",
    employee: "עובד",
    shifts: "משמרות",
    load: "עומס",
    nights: "לילות",
    risk: "סיכון שחיקה",
    riskLevel: { low: "נמוך", medium: "בינוני", high: "גבוה" },
    staffingTitle: "עודף וחוסר בעובדים לפי יום",
    staffingHint: "עובדים זמינים מול הדרישה בכל יום.",
    needed: "דרושים",
    available: "זמינים",
    anomaliesTitle: "חריגות שזוהו",
    tipsTitle: "המלצות AI",
    tipsHint: "הצעות לשבוע הבא על סמך הדפוסים שזוהו.",
    noPeople: "אין עדיין עובדים באתר הזה.",
  },
  en: {
    title: "Dashboard",
    hint: "Workload, burnout, double shifts and anomalies across the team, with suggestions for next week.",
    sample: "Sample data",
    sampleNote: "Figures on this screen are made up for illustration and are not computed from the schedule.",
    coverage: "Shift coverage",
    hours: "Hours worked this week",
    doubles: "Double shifts",
    atRisk: "High burnout risk",
    balance: "Staffing balance",
    balanceEven: "Balanced",
    workloadTitle: "Workload by employee",
    workloadHint: "Shifts against the agreed quota. Above 100% means working past the agreement.",
    employee: "Employee",
    shifts: "Shifts",
    load: "Load",
    nights: "Nights",
    risk: "Burnout risk",
    riskLevel: { low: "Low", medium: "Medium", high: "High" },
    staffingTitle: "Staff surplus and shortage by day",
    staffingHint: "Available people against the requirement each day.",
    needed: "Needed",
    available: "Available",
    anomaliesTitle: "Anomalies found",
    tipsTitle: "AI suggestions",
    tipsHint: "Ideas for next week based on the patterns found.",
    noPeople: "No employees on this site yet.",
  },
};

export function balanceText(lang: Lang, balance: number): string {
  if (balance === 0) return insightsCopy[lang].balanceEven;
  const count = Math.abs(balance);
  if (lang === "he") return balance > 0 ? `עודף של ${count}` : `חוסר של ${count}`;
  return balance > 0 ? `${count} surplus` : `${count} short`;
}

export function anomalyText(lang: Lang, anomaly: Anomaly): string {
  const { name, value } = anomaly;
  const day = dayName(anomaly.day, lang);
  if (lang === "he") {
    switch (anomaly.kind) {
      case "nightStreak":
        return `${name} עובד/ת ${value} לילות ברצף, החל מיום ${day}.`;
      case "overQuota":
        return `${name} חורג/ת מהמכסה החוזית ב־${value} משמרות השבוע.`;
      case "shortRest":
        return `${name} קיבל/ה רק ${value} שעות מנוחה בין משמרות ביום ${day}.`;
      case "lateSwaps":
        return `${name} ביקש/ה ${value} החלפות ברגע האחרון בחודש האחרון.`;
      case "underUsed":
        return `${name} משובץ/ת ב־${value} משמרות פחות מהמכסה, ויכול/ה לקחת עוד.`;
    }
  }
  switch (anomaly.kind) {
    case "nightStreak":
      return `${name} works ${value} nights in a row, starting ${day}.`;
    case "overQuota":
      return `${name} is ${value} shifts over the agreed quota this week.`;
    case "shortRest":
      return `${name} gets only ${value} hours of rest between shifts on ${day}.`;
    case "lateSwaps":
      return `${name} asked for ${value} last-minute swaps this month.`;
    case "underUsed":
      return `${name} has ${value} shifts fewer than the quota and could take more.`;
  }
}

export function tipText(lang: Lang, tip: Tip): string {
  const day = dayName(tip.day, lang);
  if (lang === "he") {
    switch (tip.kind) {
      case "spreadNights":
        return `להעביר חלק ממשמרות הלילה של ${tip.name} אל ${tip.other} כדי להוריד את סיכון השחיקה.`;
      case "hireForDay":
        return `ביום ${day} חסרים ${tip.value} עובדים באופן קבוע. כדאי לגייס עובד/ת נוסף/ת או לפתוח את היום לעובדי אתר אחר.`;
      case "rebalance":
        return `לאזן ${tip.value} משמרות מ־${tip.name} אל ${tip.other}, שעובד/ת מתחת למכסה.`;
      case "reduceDoubles":
        return `השבוע יש ${tip.value} משמרות כפולות. פיצול שלהן בין שני עובדים ישפר את המנוחה בין משמרות.`;
    }
  }
  switch (tip.kind) {
    case "spreadNights":
      return `Move some of ${tip.name}'s night shifts to ${tip.other} to lower the burnout risk.`;
    case "hireForDay":
      return `${day} is ${tip.value} people short week after week. Consider hiring or opening the day to staff from another site.`;
    case "rebalance":
      return `Shift ${tip.value} shifts from ${tip.name} to ${tip.other}, who is under quota.`;
    case "reduceDoubles":
      return `There are ${tip.value} double shifts this week. Splitting them between two people improves rest between shifts.`;
  }
}
