import { describe, expect, it } from "vitest";
import { sentinelState } from "../demo/sentinel";
import { generateWeek } from "./edit";
import { backupJson, parseBackupJson, siteShiftsIcs, weekCsv, weekExcelXml, weekText } from "./export";

describe("weekly export formats", () => {
  it("refuses to export an unpublished draft", () => {
    const draft = generateWeek(sentinelState("2026-10-04"));
    expect(weekCsv(draft, "he")).toBeNull();
    expect(weekExcelXml(draft, "he", "Sentinel")).toBeNull();
    expect(weekText(draft, "he", "Sentinel")).toBeNull();
    expect(siteShiftsIcs(draft, "he", "Sentinel")).toBeNull();
  });

  it("round-trips a site JSON backup and rejects broken files", () => {
    const state = generateWeek(sentinelState("2026-10-04"));
    const json = backupJson(state, { org: "Sentinel", at: "2026-10-20T12:00:00.000Z" });
    expect(parseBackupJson(json)).toEqual(state);
    expect(parseBackupJson("not json")).toBeNull();
    expect(parseBackupJson(JSON.stringify({ format: "wrong", state }))).toBeNull();
    expect(parseBackupJson(JSON.stringify({ format: "rota.backup.v1", state: { week: "bad" } }))).toBeNull();
  });

  it("exports Excel, CSV, ICS and WhatsApp text for managers and staff", () => {
    const draft = generateWeek(sentinelState("2026-10-04"));
    const published = {
      ...draft,
      sched: { ...draft.sched, [draft.week]: { ...draft.sched[draft.week]!, status: "published" as const } },
    };
    const dana = published.emps[0]!;

    const csv = weekCsv(published, "he")!;
    expect(csv.startsWith("\uFEFFאתר,תאריך,יום,משמרת,שעות,עובד,שעות משמרת\r\n")).toBe(true);
    expect(csv).toContain(dana.name);

    const staffCsv = weekCsv(published, "he", dana.id)!;
    const staffLines = staffCsv.trim().split("\r\n").slice(1);
    expect(staffLines.length).toBeGreaterThan(0);
    expect(staffLines.every((line) => line.includes(dana.name))).toBe(true);

    const excel = weekExcelXml(published, "he", "Sentinel")!;
    expect(excel).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect(excel).toContain('ss:Name="סידור שבועי"');
    expect(excel).toContain('ss:Name="שעות ומשמרות"');
    expect(excel).toContain('ss:RightToLeft="1"');
    expect(excel).toContain(dana.name);

    const ics = siteShiftsIcs(published, "he", "Sentinel")!;
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(dana.name);

    const managerText = weekText(published, "he", "Sentinel")!;
    expect(managerText).toContain("*Sentinel · מטה*");
    expect(managerText).toContain(dana.name);

    const employeeText = weekText(published, "he", "Sentinel", dana.id)!;
    expect(employeeText).toContain("*Sentinel*");
    expect(employeeText).toContain("• ");
  });
});
