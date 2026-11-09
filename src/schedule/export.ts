import { addDays, coveredSeats, dayName, durationHours, fullShiftCoveredByHours, shiftKind, slots, type Lang, type RotaState } from "../domain";
import { staffedCount } from "../domain/rest";
import { calendarTitle, shiftsIcs, type CalendarShift } from "./calendar";
import { clockLabel } from "./edit";
import { formatDayDate, formatWeekRange, shiftLabel, siteLabel } from "./display";
import { resolveCalendars, weekHebrewRange, weekMarks, type CalendarPrefs } from "./shown-calendars";

export interface ExportPerson {
  name: string;
  /** Actual hours, only when the shift was extended. */
  hours?: string;
}

export interface ExportCell {
  closed: boolean;
  required: number;
  people: ExportPerson[];
  /** Seats filled by an approved extension of a neighbouring shift. */
  covered: number;
  open: number;
}

export interface ExportRow {
  shift: string;
  hours: string;
  kind: "m" | "a" | "n";
  cells: ExportCell[];
}

export interface WeekExport {
  dir: "rtl" | "ltr";
  title: string;
  subtitle: string;
  hebrewSubtitle: string;
  days: { name: string; date: string; hebrew: string; holidays: string[] }[];
  rows: ExportRow[];
  open: number;
  extended: number;
}

export interface AssignmentEntry {
  site: string;
  date: string;
  hebrewDate: string;
  holiday: string;
  dayIndex: number;
  day: string;
  shiftId: string;
  shift: string;
  start: string;
  end: string;
  hours: string;
  duration: number;
  employeeId: string;
  employee: string;
}

function nameMap(state: RotaState): Map<string, string> {
  return new Map([...Object.entries(state.former ?? {}), ...state.emps.map((employee) => [employee.id, employee.name] as const)]);
}

/** The published week as a table for the PNG. A draft is never exported. `hebrew` off leaves Gregorian dates only. */
export function weekExport(state: RotaState, lang: Lang, org: string, hebrew: boolean | CalendarPrefs = true): WeekExport | null {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return null;
  const names = nameMap(state);
  const prefs = resolveCalendars(hebrew);
  const marks = weekMarks(state.week, lang, prefs);
  const weekSlots = slots(state, state.week);
  let open = 0;
  let extended = 0;
  const rows = state.biz.shifts.map((shift) => ({
    shift: shiftLabel(shift.name, lang),
    hours: `${shift.start}–${shift.end}`,
    kind: shiftKind(shift.start, shift.end),
    cells: [0, 1, 2, 3, 4, 5, 6].map((day): ExportCell => {
      const slot = weekSlots.find((item) => item.day === day && item.shiftId === shift.id);
      if (!slot) return { closed: true, required: 0, people: [], covered: 0, open: 0 };
      const people = (schedule.assign[slot.key] ?? []).map((id): ExportPerson => {
        const extension = schedule.ext?.[`${slot.key}#${id}`];
        const span = extension ?? schedule.hours?.[`${slot.key}#${id}`];
        if (extension) extended += 1;
        return {
          name: names.get(id) ?? id,
          ...(span ? { hours: `${clockLabel(span.start)}–${clockLabel(span.end)}` } : {}),
        };
      });
      const emergency = coveredSeats(schedule, slot.key);
      const hourCovered = fullShiftCoveredByHours(state, slot)
        ? Math.max(0, slot.required - people.length - emergency)
        : 0;
      const covered = emergency + hourCovered;
      const missing = Math.max(0, slot.required - people.length - covered);
      open += missing;
      return { closed: false, required: slot.required, people, covered, open: missing };
    }),
  }));
  return {
    dir: lang === "he" ? "rtl" : "ltr",
    title: `${org} · ${siteLabel(state.biz.name, lang)}`,
    subtitle: formatWeekRange(state.week, lang),
    hebrewSubtitle: weekHebrewRange(state.week, lang, prefs),
    days: [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const info = marks[day];
      return {
        name: dayName(day, lang),
        date: formatDayDate(state.week, day, lang),
        hebrew: info?.hebrew ?? "",
        holidays: info?.holidays.map((holiday) => holiday.name) ?? [],
      };
    }),
    rows,
    open,
    extended,
  };
}

/** Flat list of published shift assignments, optionally filtered to one employee. */
export function publishedAssignments(state: RotaState, lang: Lang, onlyEmployeeId?: string, hebrew: boolean | CalendarPrefs = true): AssignmentEntry[] {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return [];
  const names = nameMap(state);
  const site = siteLabel(state.biz.name, lang);
  const entries: AssignmentEntry[] = [];
  const calendar = weekMarks(state.week, lang, resolveCalendars(hebrew));
  for (let day = 0; day < 7; day += 1) {
    const date = addDays(state.week, day);
    const dayLabel = dayName(day, lang);
    const hebrewDate = calendar?.[day].hebrew ?? "";
    const holiday = calendar?.[day].holidays.map((item) => item.name).join(" · ") ?? "";
    for (const shift of state.biz.shifts) {
      const slotKey = `${day}|${shift.id}`;
      const assigned = schedule.assign[slotKey] ?? [];
      for (const id of assigned) {
        if (onlyEmployeeId && id !== onlyEmployeeId) continue;
        const ext = schedule.ext?.[`${slotKey}#${id}`] ?? schedule.hours?.[`${slotKey}#${id}`];
        const start = ext ? clockLabel(ext.start) : shift.start;
        const end = ext ? clockLabel(ext.end) : shift.end;
        const duration = ext ? ext.end - ext.start : durationHours(shift.start, shift.end);
        entries.push({
          site,
          date,
          hebrewDate,
          holiday,
          dayIndex: day,
          day: dayLabel,
          shiftId: shift.id,
          shift: shiftLabel(shift.name, lang),
          start,
          end,
          hours: `${start}–${end}`,
          duration,
          employeeId: id,
          employee: names.get(id) ?? id,
        });
      }
    }
  }
  return entries;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** UTF-8 CSV (with BOM for Excel) of published assignments across one or more sites. */
export function weekCsv(sites: RotaState | RotaState[], lang: Lang, onlyEmployeeId?: string, hebrew: boolean | CalendarPrefs = true): string | null {
  const list = Array.isArray(sites) ? sites : [sites];
  const published = list.filter((site) => site.sched[site.week]?.status === "published");
  if (published.length === 0) return null;
  const rows = published.flatMap((site) => publishedAssignments(site, lang, onlyEmployeeId, hebrew));
  const prefs = resolveCalendars(hebrew);
  const showHoliday = prefs.hebrew || prefs.christian || prefs.muslim;
  const dateHeaders =
    lang === "he" ? ["תאריך עברי", "חג"] : lang === "ru" ? ["Еврейская дата", "Праздник"] : ["Hebrew date", "Holiday"];
  const headers = [
    ...(lang === "he" ? ["אתר", "תאריך"] : lang === "ru" ? ["Объект", "Дата"] : ["Site", "Date"]),
    ...(prefs.hebrew ? [dateHeaders[0]] : []),
    ...(showHoliday ? [dateHeaders[1]] : []),
    ...(lang === "he" ? ["יום", "משמרת", "שעות", "עובד", "שעות משמרת"] : lang === "ru" ? ["День", "Смена", "Часы", "Сотрудник", "Часы смены"] : ["Day", "Shift", "Hours", "Employee", "Shift hours"]),
  ];
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      [row.site, row.date, ...(prefs.hebrew ? [row.hebrewDate] : []), ...(showHoliday ? [row.holiday] : []), row.day, row.shift, row.hours, row.employee, row.duration].map(csvCell).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export type ExcelLayout = "shifts" | "written";

function boardRows(data: WeekExport, labels: { shift: string; closed: string; open: string; covered: string }): string {
  const headerCells = [
    `<Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(labels.shift)}</Data></Cell>`,
    ...data.days.map(
      (day) =>
        `<Cell ss:StyleID="head"><Data ss:Type="String">${[`${day.name} (${day.date})`, day.hebrew, ...day.holidays].filter(Boolean).map(xmlEscape).join("&#10;")}</Data></Cell>`,
    ),
  ].join("");
  const bodyRows = data.rows
    .map((row) => {
      const style = row.kind === "m" ? "morning" : row.kind === "a" ? "afternoon" : "night";
      const cells = row.cells
        .map((cell) => {
          if (cell.closed) {
            return `<Cell ss:StyleID="closed"><Data ss:Type="String">${xmlEscape(labels.closed)}</Data></Cell>`;
          }
          const lines = [
            ...cell.people.map((person) => (person.hours ? `${person.name} (${person.hours})` : person.name)),
            ...(cell.covered ? [labels.covered] : []),
            ...(cell.open ? [`${labels.open} ${cell.open}`] : []),
          ];
          return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${ lines.map(xmlEscape).join("&#10;") }</Data></Cell>`;
        })
        .join("");
      return `<Row ss:AutoFitHeight="1"><Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(row.shift)}&#10;${xmlEscape(row.hours)}</Data></Cell>${cells}</Row>`;
    })
    .join("");
  return [
    `<Row ss:Height="26"><Cell ss:MergeAcross="${data.days.length}" ss:StyleID="title"><Data ss:Type="String">${xmlEscape([data.title, data.subtitle, data.hebrewSubtitle].filter(Boolean).join(" · "))}</Data></Cell></Row>`,
    `<Row ss:Height="${!data.hebrewSubtitle ? 24 : data.days.some((day) => day.holidays.length > 0) ? 52 : 38}">${headerCells}</Row>`,
    bodyRows,
  ].join("");
}

function textCell(value: string, style = "cell"): string {
  return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function numberCell(value: number, style = "cell"): string {
  const shown = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${shown}</Data></Cell>`;
}

function lines(parts: string[]): string {
  return parts.filter(Boolean).map(xmlEscape).join("&#10;");
}

function sheetXml(name: string, rtl: string, columns: string, rows: string): string {
  return [`<Worksheet ss:Name="${xmlEscape(name.slice(0, 31))}"${rtl}>`, "<Table>", columns, rows, "</Table>", "</Worksheet>"].join("");
}

function listedPeople(state: RotaState, onlyEmployeeId?: string): { id: string; name: string }[] {
  const names = nameMap(state);
  const ids = new Set<string>();
  if (onlyEmployeeId) ids.add(onlyEmployeeId);
  else {
    for (const employee of state.emps) if (employee.active !== false) ids.add(employee.id);
    for (const assigned of Object.values(state.sched[state.week]?.assign ?? {})) {
      for (const id of assigned ?? []) ids.add(id);
    }
  }
  return [...ids].map((id) => ({ id, name: names.get(id) ?? id })).sort((left, right) => left.name.localeCompare(right.name, "he"));
}

/** Excel SpreadsheetML (.xls): regular board, by employee, hours, and standard against the schedule. */
export function weekExcelXml(
  sites: RotaState | RotaState[],
  lang: Lang,
  org: string,
  onlyEmployeeId?: string,
  hebrew: boolean | CalendarPrefs = true,
  layout: ExcelLayout = "written",
): string | null {
  const list = Array.isArray(sites) ? sites : [sites];
  const published = list.filter((site) => site.sched[site.week]?.status === "published");
  if (published.length === 0) return null;

  const rtl = lang === "he" ? ' ss:RightToLeft="1"' : "";
  const labels =
    lang === "ru"
      ? {
          board: "Обычный график",
          byEmployee: "По сотрудникам",
          hours: "Часы по сотрудникам",
          standard: "Норма и график по объектам",
          shift: "Смена",
          closed: "Закрыто",
          open: "Открыто",
          covered: "Покрыто продлением",
          employee: "Сотрудник",
          shiftsCount: "Смены",
          totalHours: "Всего часов",
          required: "Норма",
          assigned: "Назначено",
          result: "Результат",
          role: "Роль",
          met: "Норма",
          short: (count: number) => `Нехватка ${count}`,
          over: (count: number) => `Избыток ${count}`,
          site: "Объект",
          date: "Дата",
          hebrewDate: "Еврейская дата",
          holiday: "Праздник",
          day: "День",
          hoursRange: "Часы",
          duration: "Длительность (ч)",
        }
      : lang === "he"
      ? {
          board: "סידור רגיל",
          byEmployee: "סידור לפי עובד",
          hours: "שעות עבודה לכל עובד",
          standard: "תקן מול סידור לפי אתר",
          shift: "משמרת",
          closed: "סגור",
          open: "חסר",
          covered: "מכוסה בהארכה",
          employee: "עובד",
          shiftsCount: "משמרות",
          totalHours: "סה״כ שעות",
          required: "תקן",
          assigned: "שובצו",
          result: "תוצאה",
          role: "תפקיד",
          met: "תקין",
          short: (count: number) => `חוסר ${count}`,
          over: (count: number) => `עודף ${count}`,
          site: "אתר",
          date: "תאריך",
          hebrewDate: "תאריך עברי",
          holiday: "חג",
          day: "יום",
          hoursRange: "שעות",
          duration: "אורך (שעות)",
        }
      : {
          board: "Regular schedule",
          byEmployee: "By employee",
          hours: "Hours per employee",
          standard: "Standard vs schedule",
          shift: "Shift",
          closed: "Closed",
          open: "Open",
          covered: "Covered",
          employee: "Employee",
          shiftsCount: "Shifts",
          totalHours: "Total hours",
          required: "Standard",
          assigned: "Assigned",
          result: "Result",
          role: "Role",
          met: "Met",
          short: (count: number) => `Short ${count}`,
          over: (count: number) => `Over ${count}`,
          site: "Site",
          date: "Date",
          hebrewDate: "Hebrew date",
          holiday: "Holiday",
          day: "Day",
          hoursRange: "Hours",
          duration: "Duration (h)",
        };

  const boards = published
    .map((site) => weekExport(site, lang, org, hebrew))
    .filter((board): board is WeekExport => board !== null);
  const regularSheet = sheetXml(
    labels.board,
    rtl,
    ['<Column ss:Width="130"/>', ...Array.from({ length: 7 }, () => '<Column ss:Width="135"/>')].join(""),
    boards.map((board) => boardRows(board, labels)).join("<Row/>"),
  );

  const showSite = published.length > 1;
  const employeeRows = published.flatMap((site) => {
    const assignments = publishedAssignments(site, lang, onlyEmployeeId, hebrew);
    const people = listedPeople(site, onlyEmployeeId);
    if (layout === "shifts") {
      const header = `<Row ss:Height="22">${[labels.employee, ...(showSite ? [labels.site] : []), ...site.biz.shifts.map((shift) => shiftLabel(shift.name, lang))].map((label) => textCell(label, "head")).join("")}</Row>`;
      const body = people
        .map((person) => {
          const cells = [
            textCell(person.name),
            ...(showSite ? [textCell(siteLabel(site.biz.name, lang))] : []),
            ...site.biz.shifts.map((shift) => {
              const days = assignments
                .filter((entry) => entry.employeeId === person.id && entry.shiftId === shift.id)
                .map((entry) => (entry.hours === `${shift.start}–${shift.end}` ? entry.day : `${entry.day} (${entry.hours})`));
              return `<Cell ss:StyleID="cell"><Data ss:Type="String">${lines(days)}</Data></Cell>`;
            }),
          ];
          return `<Row>${cells.join("")}</Row>`;
        })
        .join("");
      return `${published.length > 1 ? `<Row>${textCell(siteLabel(site.biz.name, lang), "title")}</Row>` : ""}${header}${body}`;
    }
    const header = `<Row ss:Height="22">${[labels.employee, ...(showSite ? [labels.site] : []), ...[0, 1, 2, 3, 4, 5, 6].map((day) => dayName(day, lang))].map((label) => textCell(label, "head")).join("")}</Row>`;
    const body = people
      .map((person) => {
        const cells = [
          textCell(person.name),
          ...(showSite ? [textCell(siteLabel(site.biz.name, lang))] : []),
          ...[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const shifts = assignments
              .filter((entry) => entry.employeeId === person.id && entry.dayIndex === day)
              .map((entry) => `${entry.shift} ${entry.hours}`);
            return `<Cell ss:StyleID="cell"><Data ss:Type="String">${lines(shifts)}</Data></Cell>`;
          }),
        ];
        return `<Row>${cells.join("")}</Row>`;
      })
      .join("");
    return `${header}${body}`;
  });
  const byEmployeeSheet = sheetXml(labels.byEmployee, rtl, '<Column ss:Width="140"/>'.repeat(16), employeeRows.join("<Row/>"));

  const entries = published.flatMap((site) => publishedAssignments(site, lang, onlyEmployeeId, hebrew));
  const totals = new Map<string, { name: string; site: string; shifts: number; hours: number }>();
  for (const entry of entries) {
    const key = `${entry.employeeId}|${entry.site}`;
    const prev = totals.get(key) ?? { name: entry.employee, site: entry.site, shifts: 0, hours: 0 };
    prev.shifts += 1;
    prev.hours += entry.duration;
    totals.set(key, prev);
  }
  const summaryRows = [...totals.values()]
    .sort((left, right) => left.name.localeCompare(right.name, lang) || left.site.localeCompare(right.site, lang))
    .map((item) => `<Row>${textCell(item.name)}${textCell(item.site)}${numberCell(item.shifts)}${numberCell(item.hours)}</Row>`)
    .join("");
  const detailRows = entries
    .map(
      (row) =>
        `<Row>${textCell(row.employee)}${textCell(row.site)}${textCell(row.date)}${textCell(row.day)}${textCell(row.shift)}${textCell(row.hours)}${numberCell(row.duration)}</Row>`,
    )
    .join("");
  const hoursSheet = sheetXml(
    labels.hours,
    rtl,
    '<Column ss:Width="130"/><Column ss:Width="110"/><Column ss:Width="95"/><Column ss:Width="90"/><Column ss:Width="110"/><Column ss:Width="110"/><Column ss:Width="90"/>',
    [
      `<Row ss:Height="22">${[labels.employee, labels.site, labels.shiftsCount, labels.totalHours].map((label) => textCell(label, "head")).join("")}</Row>`,
      summaryRows,
      "<Row/>",
      `<Row ss:Height="22">${[labels.employee, labels.site, labels.date, labels.day, labels.shift, labels.hoursRange, labels.duration].map((label) => textCell(label, "head")).join("")}</Row>`,
      detailRows,
    ].join(""),
  );

  const standardRows = published.flatMap((site) => {
    const schedule = site.sched[site.week];
    if (!schedule) return [];
    const rows: string[] = [];
    for (const shift of site.biz.shifts) {
      for (let day = 0; day < 7; day += 1) {
        const key = `${day}|${shift.id}`;
        const override = schedule.staffing?.[key];
        const required = override !== undefined && Number.isFinite(override) ? Math.trunc(override) : staffedCount(shift, day, site.week);
        const assigned = new Set(schedule.assign[key] ?? []).size;
        if (required <= 0 && assigned === 0) continue;
        const gap = assigned - required;
        const result = gap === 0 ? labels.met : gap < 0 ? labels.short(-gap) : labels.over(gap);
        rows.push(
          `<Row>${textCell(siteLabel(site.biz.name, lang))}${textCell(dayName(day, lang))}${textCell(addDays(site.week, day))}${textCell(shiftLabel(shift.name, lang))}${textCell(shift.role || "—")}${numberCell(required)}${numberCell(assigned)}${textCell(result)}</Row>`,
        );
      }
    }
    return rows;
  });
  const standardSheet = sheetXml(
    labels.standard,
    rtl,
    '<Column ss:Width="110"/><Column ss:Width="90"/><Column ss:Width="95"/><Column ss:Width="120"/><Column ss:Width="100"/><Column ss:Width="70"/><Column ss:Width="70"/><Column ss:Width="90"/>',
    [
      `<Row ss:Height="22">${[labels.site, labels.day, labels.date, labels.shift, labels.role, labels.required, labels.assigned, labels.result].map((label) => textCell(label, "head")).join("")}</Row>`,
      ...standardRows,
    ].join(""),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    "<Styles>",
    '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/><Alignment ss:Vertical="Center"/></Style>',
    '<Style ss:ID="head"><Font ss:Bold="1"/><Interior ss:Color="#EFECE6" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>',
    '<Style ss:ID="morning"><Interior ss:Color="#FFEBCD" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>',
    '<Style ss:ID="afternoon"><Interior ss:Color="#D9E8FF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>',
    '<Style ss:ID="night"><Interior ss:Color="#E8DEFF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>',
    '<Style ss:ID="closed"><Font ss:Color="#78716C"/><Interior ss:Color="#F7F4EE" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>',
    '<Style ss:ID="cell"><Alignment ss:Vertical="Center"/></Style>',
    "</Styles>",
    regularSheet,
    byEmployeeSheet,
    hoursSheet,
    standardSheet,
    "</Workbook>",
  ].join("\n");
}

/** Formatted plain text ready for WhatsApp / messages. */
export function weekText(sites: RotaState | RotaState[], lang: Lang, org: string, onlyEmployeeId?: string, hebrew: boolean | CalendarPrefs = true): string | null {
  const list = Array.isArray(sites) ? sites : [sites];
  const published = list.filter((site) => site.sched[site.week]?.status === "published");
  if (published.length === 0) return null;

  if (onlyEmployeeId) {
    const entries = published.flatMap((site) => publishedAssignments(site, lang, onlyEmployeeId, hebrew));
    const week = published[0].week;
    const header = [`*${org}* · ${formatWeekRange(week, lang)}`, weekHebrewRange(week, lang, resolveCalendars(hebrew))].filter(Boolean).join("\n");
    if (entries.length === 0) return header;
    const lines = entries.map((entry) => {
      const dateLabel = [formatDayDate(week, entry.dayIndex, lang), entry.hebrewDate].filter(Boolean).join(" · ");
      const prefix = published.length > 1 ? `${entry.site} · ` : "";
      const holiday = entry.holiday ? ` · ${entry.holiday}` : "";
      return `• ${prefix}${entry.day} (${dateLabel})${holiday} — ${entry.shift} ${entry.hours}`;
    });
    return [header, ...lines].join("\n");
  }

  return published
    .map((site) => {
      const data = weekExport(site, lang, org, hebrew);
      if (!data) return "";
      const blocks = [`*${data.title}*`, data.subtitle, data.hebrewSubtitle].filter(Boolean);
      data.days.forEach((day, dayIndex) => {
        const lines = data.rows
          .map((row) => {
            const cell = row.cells[dayIndex];
            if (cell.closed || cell.people.length === 0) return "";
            const names = cell.people.map((person) => (person.hours ? `${person.name} (${person.hours})` : person.name)).join(", ");
            return `• ${row.shift} (${row.hours}): ${names}`;
          })
          .filter(Boolean);
        if (lines.length > 0) {
          const holidays = day.holidays.length ? ` · ${day.holidays.join(" · ")}` : "";
          const date = [day.date, day.hebrew].filter(Boolean).join(" · ");
          blocks.push(`\n*${day.name} (${date})${holidays}:*\n${lines.join("\n")}`);
        }
      });
      return blocks.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Calendar (.ics) file containing every published shift on the site with the assigned staff names. */
export function siteShiftsIcs(state: RotaState, lang: Lang, org: string): string | null {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return null;
  const names = nameMap(state);
  const site = siteLabel(state.biz.name, lang);
  const baseTitle = calendarTitle(site, org);
  const shifts: CalendarShift[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (const shift of state.biz.shifts) {
      const assigned = (schedule.assign[`${day}|${shift.id}`] ?? []).map((id) => names.get(id) ?? id);
      if (assigned.length === 0) continue;
      shifts.push({
        dayIndex: day,
        start: shift.start,
        end: shift.end,
        id: shift.id,
        title: `${shiftLabel(shift.name, lang)}: ${assigned.join(", ")} · ${site}`,
      });
    }
  }
  return shiftsIcs({ title: baseTitle, week: state.week, employeeId: "site", shifts });
}

export const BACKUP_FORMAT = "rota.backup.v1";

/** Everything the site holds, for a manual backup. */
export function backupJson(state: RotaState, meta: { org: string; at: string }): string {
  return JSON.stringify({ format: BACKUP_FORMAT, org: meta.org, exportedAt: meta.at, state }, null, 2);
}

/** Validates and extracts a site RotaState from a JSON backup file. */
export function parseBackupJson(raw: string): RotaState | null {
  try {
    const parsed = JSON.parse(raw) as { format?: unknown; state?: RotaState };
    const state = parsed?.format === BACKUP_FORMAT ? parsed.state : undefined;
    if (!state || !/^\d{4}-\d{2}-\d{2}$/.test(state.week ?? "")) return null;
    if (!state.biz || typeof state.biz.name !== "string" || !Array.isArray(state.biz.shifts) || state.biz.shifts.length === 0) {
      return null;
    }
    if (!Array.isArray(state.emps) || !state.sched || typeof state.sched !== "object" || !state.avail || typeof state.avail !== "object") {
      return null;
    }
    return structuredClone({
      ...state,
      closed: state.closed && typeof state.closed === "object" ? state.closed : {},
    });
  } catch {
    return null;
  }
}
