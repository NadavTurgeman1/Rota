import type { Employee, EmployeeProfile } from "./types";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const GENDERS = new Set(["", "female", "male"]);
const MARITAL = new Set(["", "single", "married", "divorced", "widowed"]);

export function blankProfile(): EmployeeProfile {
  return {
    nationalId: "",
    birthDate: "",
    gender: "",
    mobile: "",
    city: "",
    street: "",
    houseNumber: "",
    zip: "",
    startedOn: "",
    endedOn: "",
    department: "",
    maritalStatus: "",
    bankName: "",
    bankBranch: "",
    bankAccount: "",
  };
}

/** The card with every field present, using blanks for anything not stored yet. */
export function employeeProfile(employee: Employee): EmployeeProfile {
  return { ...blankProfile(), ...employee.profile };
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function date(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = DATE.exec(value);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return "";
  return value;
}

/** Keep only the card fields. An empty card is omitted so a roster row stays unchanged. */
export function cleanProfile(input: unknown): EmployeeProfile | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Record<string, unknown>;
  const gender = text(raw.gender, 20);
  const maritalStatus = text(raw.maritalStatus, 20);
  const profile: EmployeeProfile = {
    nationalId: text(raw.nationalId, 20),
    birthDate: date(raw.birthDate),
    gender: GENDERS.has(gender) ? gender : "",
    mobile: text(raw.mobile, 30),
    city: text(raw.city, 80),
    street: text(raw.street, 80),
    houseNumber: text(raw.houseNumber, 20),
    zip: text(raw.zip, 10),
    startedOn: date(raw.startedOn),
    endedOn: date(raw.endedOn),
    department: text(raw.department, 80),
    maritalStatus: MARITAL.has(maritalStatus) ? maritalStatus : "",
    bankName: text(raw.bankName, 80),
    bankBranch: text(raw.bankBranch, 20),
    bankAccount: text(raw.bankAccount, 30),
  };
  return Object.values(profile).some((value) => value !== "") ? profile : undefined;
}
