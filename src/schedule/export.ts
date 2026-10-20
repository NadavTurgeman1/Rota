import { addDays, coveredSeats, dayName, durationHours, shiftKind, slots, type Lang, type RotaState } from "../domain";
import { calendarTitle, shiftsIcs, type CalendarShift } from "./calendar";
import { clockLabel } from "./edit";
import { formatDayDate, formatWeekRange, shiftLabel, siteLabel } from "./display";

export interface ExportPerson {
  name: string;
  /** Actual hours, only when the shift was extended. */
  hours?: string;
  over?: boolean;
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
  days: { name: string; date: string }[];
  rows: ExportRow[];
  open: number;
  extended: number;
}

export interface AssignmentEntry {
  site: string;
  date: string;
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

/** The published week as a table for the PNG. A draft is never exported. */
export function weekExport(state: RotaState, lang: Lang, org: string): WeekExport | null {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return null;
  const names = nameMap(state);
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
        if (extension) extended += 1;
        return {
          name: names.get(id) ?? id,
          ...(extension ? { hours: `${clockLabel(extension.start)}–${clockLabel(extension.end)}` } : {}),
          ...(schedule.over?.[`${slot.key}#${id}`] ? { over: true } : {}),
        };
      });
      const covered = coveredSeats(schedule, slot.key);
      const missing = Math.max(0, slot.required - people.length - covered);
      open += missing;
      return { closed: false, required: slot.required, people, covered, open: missing };
    }),
  }));
  return {
    dir: lang === "he" ? "rtl" : "ltr",
    title: `${org} · ${siteLabel(state.biz.name, lang)}`,
    subtitle: formatWeekRange(state.week, lang),
    days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ name: dayName(day, lang), date: formatDayDate(state.week, day, lang) })),
    rows,
    open,
    extended,
  };
}

/** Flat list of published shift assignments, optionally filtered to one employee. */
export function publishedAssignments(state: RotaState, lang: Lang, onlyEmployeeId?: string): AssignmentEntry[] {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return [];
  const names = nameMap(state);
  const site = siteLabel(state.biz.name, lang);
  const entries: AssignmentEntry[] = [];
  for (let day = 0; day < 7; day += 1) {
    const date = addDays(state.week, day);
    const dayLabel = dayName(day, lang);
    for (const shift of state.biz.shifts) {
      const slotKey = `${day}|${shift.id}`;
      const assigned = schedule.assign[slotKey] ?? [];
      for (const id of assigned) {
        if (onlyEmployeeId && id !== onlyEmployeeId) continue;
        const ext = schedule.ext?.[`${slotKey}#${id}`];
        const start = ext ? clockLabel(ext.start) : shift.start;
        const end = ext ? clockLabel(ext.end) : shift.end;
        const duration = ext ? ext.end - ext.start : durationHours(shift.start, shift.end);
        entries.push({
          site,
          date,
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
export function weekCsv(sites: RotaState | RotaState[], lang: Lang, onlyEmployeeId?: string): string | null {
  const list = Array.isArray(sites) ? sites : [sites];
  const published = list.filter((site) => site.sched[site.week]?.status === "published");
  if (published.length === 0) return null;
  const rows = published.flatMap((site) => publishedAssignments(site, lang, onlyEmployeeId));
  const headers =
    lang === "he"
      ? ["אתר", "תאריך", "יום", "משמרת", "שעות", "עובד", "שעות משמרת"]
      : ["Site", "Date", "Day", "Shift", "Hours", "Employee", "Shift hours"];
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => [row.site, row.date, row.day, row.shift, row.hours, row.employee, row.duration].map(csvCell).join(",")),
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

function worksheetBoardXml(data: WeekExport, sheetName: string, labels: { shift: string; closed: string; open: string; covered: string }): string {
  const rtl = data.dir === "rtl" ? ' ss:RightToLeft="1"' : "";
  const headerCells = [
    `<Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(labels.shift)}</Data></Cell>`,
    ...data.days.map((day) => `<Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(`${day.name} (${day.date})`)}</Data></Cell>`),
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
    `<Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31))}"${rtl}>`,
    "<Table>",
    '<Column ss:Width="130"/>',
    ...data.days.map(() => '<Column ss:Width="135"/>'),
    `<Row ss:Height="26"><Cell ss:MergeAcross="${data.days.length}" ss:StyleID="title"><Data ss:Type="String">${xmlEscape(`${data.title} · ${data.subtitle}`)}</Data></Cell></Row>`,
    `<Row ss:Height="24">${headerCells}</Row>`,
    bodyRows,
    "</Table>",
    "</Worksheet>",
  ].join("");
}

/** Excel SpreadsheetML (.xls) with the weekly board and an hours & shifts breakdown sheet. */
export function weekExcelXml(sites: RotaState | RotaState[], lang: Lang, org: string, onlyEmployeeId?: string): string | null {
  const list = Array.isArray(sites) ? sites : [sites];
  const published = list.filter((site) => site.sched[site.week]?.status === "published");
  if (published.length === 0) return null;

  const rtl = lang === "he" ? ' ss:RightToLeft="1"' : "";
  const labels =
    lang === "he"
      ? {
          board: "סידור שבועי",
          hours: "שעות ומשמרות",
          shift: "משמרת",
          closed: "סגור",
          open: "חסר",
          covered: "מכוסה בהארכה",
          employee: "עובד",
          shiftsCount: "משמרות",
          totalHours: "סה״כ שעות",
          site: "אתר",
          date: "תאריך",
          day: "יום",
          hoursRange: "שעות",
          duration: "אורך (שעות)",
        }
      : {
          board: "Weekly schedule",
          hours: "Hours & shifts",
          shift: "Shift",
          closed: "Closed",
          open: "Open",
          covered: "Covered",
          employee: "Employee",
          shiftsCount: "Shifts",
          totalHours: "Total hours",
          site: "Site",
          date: "Date",
          day: "Day",
          hoursRange: "Hours",
          duration: "Duration (h)",
        };

  const boardSheets = published
    .map((site) => {
      const exported = weekExport(site, lang, org);
      if (!exported) return "";
      const name = published.length > 1 ? siteLabel(site.biz.name, lang) : labels.board;
      return worksheetBoardXml(exported, name, labels);
    })
    .filter(Boolean);

  const entries = published.flatMap((site) => publishedAssignments(site, lang, onlyEmployeeId));
  const totals = new Map<string, { name: string; shifts: number; hours: number }>();
  for (const entry of entries) {
    const prev = totals.get(entry.employeeId) ?? { name: entry.employee, shifts: 0, hours: 0 };
    prev.shifts += 1;
    prev.hours += entry.duration;
    totals.set(entry.employeeId, prev);
  }
  const summaryRows = [...totals.values()]
    .sort((left, right) => left.name.localeCompare(right.name, lang))
    .map(
      (item) =>
        `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(item.name)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">${item.shifts}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">${Number(item.hours.toFixed(2))}</Data></Cell></Row>`,
    )
    .join("");

  const detailHeaders = [labels.site, labels.date, labels.day, labels.shift, labels.hoursRange, labels.employee, labels.duration]
    .map((text) => `<Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(text)}</Data></Cell>`)
    .join("");
  const detailRows = entries
    .map(
      (row) =>
        `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(row.site)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(row.date)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(row.day)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(row.shift)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(row.hours)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(row.employee)}</Data></Cell><Cell ss:StyleID="cell"><Data ss:Type="Number">${Number(row.duration.toFixed(2))}</Data></Cell></Row>`,
    )
    .join("");

  const hoursSheet = [
    `<Worksheet ss:Name="${xmlEscape(labels.hours)}"${rtl}>`,
    "<Table>",
    '<Column ss:Width="110"/><Column ss:Width="95"/><Column ss:Width="90"/><Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="130"/><Column ss:Width="95"/>',
    `<Row ss:Height="22"><Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(labels.employee)}</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(labels.shiftsCount)}</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">${xmlEscape(labels.totalHours)}</Data></Cell></Row>`,
    summaryRows,
    "<Row/>",
    `<Row ss:Height="22">${detailHeaders}</Row>`,
    detailRows,
    "</Table>",
    "</Worksheet>",
  ].join("");

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
    ...boardSheets,
    hoursSheet,
    "</Workbook>",
  ].join("\n");
}

/** Formatted plain text ready for WhatsApp / messages. */
export function weekText(sites: RotaState | RotaState[], lang: Lang, org: string, onlyEmployeeId?: string): string | null {
  const list = Array.isArray(sites) ? sites : [sites];
  const published = list.filter((site) => site.sched[site.week]?.status === "published");
  if (published.length === 0) return null;

  if (onlyEmployeeId) {
    const entries = published.flatMap((site) => publishedAssignments(site, lang, onlyEmployeeId));
    const week = published[0].week;
    const header = `*${org}* · ${formatWeekRange(week, lang)}`;
    if (entries.length === 0) return header;
    const lines = entries.map((entry) => {
      const dateLabel = formatDayDate(week, entry.dayIndex, lang);
      const prefix = published.length > 1 ? `${entry.site} · ` : "";
      return `• ${prefix}${entry.day} (${dateLabel}) — ${entry.shift} ${entry.hours}`;
    });
    return [header, ...lines].join("\n");
  }

  return published
    .map((site) => {
      const data = weekExport(site, lang, org);
      if (!data) return "";
      const blocks = [`*${data.title}*`, data.subtitle];
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
          blocks.push(`\n*${day.name} (${day.date}):*\n${lines.join("\n")}`);
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
