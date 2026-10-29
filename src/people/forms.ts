/** Employee forms. Scheduling never reads these. */

export const FORM_BYTE_LIMIT = 8 * 1024 * 1024;
export const FORM_COUNT_LIMIT = 30;

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export interface EmployeeFormRecord {
  id: string;
  name: string;
  type: string;
  bytes: number;
  addedAt: string;
}

export function formFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 180);
}

/** The stored type, or null when the extension is not a form we keep. */
export function formContentType(fileName: string, claimed: string): string | null {
  const extension = formFileName(fileName).split(".").pop()?.toLowerCase() ?? "";
  const fromName = TYPES[extension];
  if (!fromName) return null;
  const given = claimed.trim().toLowerCase();
  if (!given || given === "application/octet-stream") return fromName;
  return given === fromName ? fromName : null;
}
