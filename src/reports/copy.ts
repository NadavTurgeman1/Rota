import type { Lang } from "../domain";
import type { PayrollIssue, PayrollStatus } from "./build";

interface ReportCopy {
  hint: string;
  kind: Record<"hours" | "payroll" | "errors" | "standard", string>;
  kindHint: Record<"hours" | "payroll" | "errors" | "standard", string>;
  from: string;
  to: string;
  site: string;
  allSites: string;
  employee: string;
  allEmployees: string;
  role: string;
  allRoles: string;
  download: string;
  empty: string;
  loading: string;
  missing: string;
  scheduleBasis: string;
  employeeScope: string;
  columns: {
    employee: string;
    role: string;
    site: string;
    date: string;
    in: string;
    out: string;
    duration: string;
    shift: string;
    standard: string;
    result: string;
    required: string;
    assigned: string;
    clocked: string;
  };
  status: Record<PayrollStatus, string>;
  issue: Record<PayrollIssue, (minutes: number) => string>;
  absence: Record<"sick" | "vacation", string>;
  standardResult: (gap: number, compared: "clock" | "schedule") => string;
  duration: (minutes: number) => string;
}

export const reportCopy: Record<Lang, ReportCopy> = {
  he: {
    hint: "כל מנהל מוציא כאן דוחות על העובדים באתרים שלו. בוחרים דוח, טווח תאריכים, ואפשר לצמצם לפי אתר, עובד או תפקיד.",
    kind: {
      hours: "דו״ח הפקת שעות",
      payroll: "דו״ח למערכת עיבוד שעות",
      errors: "דו״ח שגויים",
      standard: "דו״ח תקן מול ביצוע",
    },
    kindHint: {
      hours: "כניסות ויציאות של כל עובד בטווח.",
      payroll: "לכל משמרת משובצת: אם הכניסה והיציאה מכסות את המשמרת מופיע התקן. אם לא, מופיעה החריגה.",
      errors: "רק החריגות: אין כניסה, איחור, אין יציאה, או יציאה לפני סוף המשמרת.",
      standard: "לכל עמדה בכל יום: חוסר או עודף מול התקן, לפי התפקיד של המשמרת.",
    },
    from: "מתאריך",
    to: "עד תאריך",
    site: "אתר",
    allSites: "כל האתרים",
    employee: "עובד",
    allEmployees: "כל העובדים",
    role: "תפקיד",
    allRoles: "כל התפקידים",
    download: "הורדת הדוח",
    empty: "אין שורות בטווח הזה.",
    loading: "ההחתמות נטענות.",
    missing: "ההחתמות לא נטענו, ולכן כניסות ויציאות לא מופיעות.",
    scheduleBasis: "במשמרות שעוד לא התחילו, או בלי החתמות, ההשוואה היא מול השיבוץ.",
    employeeScope: "בחירת עובד מציגה רק עמדות שהוא משובץ אליהן. המספרים נשארים של כל העמדה.",
    columns: {
      employee: "עובד",
      role: "תפקיד",
      site: "אתר",
      date: "תאריך",
      in: "כניסה",
      out: "יציאה",
      duration: "משך",
      shift: "משמרת",
      standard: "תקן",
      result: "תוצאה",
      required: "תקן",
      assigned: "שובצו",
      clocked: "נכנסו",
    },
    status: {
      standard: "תקן",
      exception: "חריגה",
      absence: "היעדרות",
      waiting: "טרם הסתיים",
      unknown: "אין החתמות",
    },
    issue: {
      "missing-in": () => "לא נכנס",
      late: (minutes) => `איחר ב־${minutes} דק׳`,
      "missing-out": () => "אין יציאה",
      "early-out": (minutes) => `יצא ${minutes} דק׳ לפני הסוף`,
    },
    absence: { sick: "מחלה", vacation: "חופשה" },
    standardResult: (gap, compared) => {
      const basis = compared === "schedule" ? " בשיבוץ" : "";
      if (gap < 0) return `חוסר ${-gap}${basis}`;
      if (gap > 0) return `עודף ${gap}${basis}`;
      return compared === "schedule" ? "תקין בשיבוץ" : "תקין";
    },
    duration: (minutes) => {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return `${hours} שע׳ ${String(rest).padStart(2, "0")} דק׳`;
    },
  },
  en: {
    hint: "A manager produces reports here for the people on their sites. Choose a report and a date range, and narrow it by site, employee, or role.",
    kind: {
      hours: "Hours report",
      payroll: "Time-processing report",
      errors: "Exceptions report",
      standard: "Standard against actual",
    },
    kindHint: {
      hours: "Clock-ins and clock-outs for each employee in the range.",
      payroll: "For each assigned shift: the standard hours when the clocks cover it, and the exception when they do not.",
      errors: "Only the exceptions: no clock-in, a late arrival, no clock-out, or a clock-out before the shift ends.",
      standard: "Each position on each day: short or over the standard, for that shift's role.",
    },
    from: "From",
    to: "To",
    site: "Site",
    allSites: "All sites",
    employee: "Employee",
    allEmployees: "All employees",
    role: "Role",
    allRoles: "All roles",
    download: "Download report",
    empty: "Nothing in this range.",
    loading: "Clock-ins are loading.",
    missing: "Clock-ins are not loaded, so arrivals and departures are hidden.",
    scheduleBasis: "Shifts that have not started, or shifts without clock-ins, are compared with the assignment.",
    employeeScope: "Choosing an employee shows only positions they are assigned to. The counts stay for the whole position.",
    columns: {
      employee: "Employee",
      role: "Role",
      site: "Site",
      date: "Date",
      in: "In",
      out: "Out",
      duration: "Duration",
      shift: "Shift",
      standard: "Standard",
      result: "Result",
      required: "Standard",
      assigned: "Assigned",
      clocked: "Clocked in",
    },
    status: {
      standard: "Standard",
      exception: "Exception",
      absence: "Absence",
      waiting: "Not finished",
      unknown: "No clock-ins",
    },
    issue: {
      "missing-in": () => "No clock-in",
      late: (minutes) => `${minutes} min late`,
      "missing-out": () => "No clock-out",
      "early-out": (minutes) => `Left ${minutes} min early`,
    },
    absence: { sick: "Sick", vacation: "Vacation" },
    standardResult: (gap, compared) => {
      const basis = compared === "schedule" ? " on the schedule" : "";
      if (gap < 0) return `Short ${-gap}${basis}`;
      if (gap > 0) return `Over ${gap}${basis}`;
      return compared === "schedule" ? "Met on the schedule" : "Met";
    },
    duration: (minutes) => {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return `${hours}h ${String(rest).padStart(2, "0")}m`;
    },
  },
};
