export interface SavingsInput {
  employees: number;
  weeklyHours: number;
  hourlyCost: number;
  /** Weekly hours are calibrated to this team size. A larger team scales the time. */
  referenceEmployees: number;
  weeksPerMonth: number;
  /** Share of the scheduling time the product is assumed to remove. */
  savingsShare: number;
}

export function schedulingSavings(input: SavingsInput): { monthly: number; yearly: number } {
  const employees = Math.max(0, input.employees);
  const reference = input.referenceEmployees > 0 ? input.referenceEmployees : 1;
  const monthly = (employees / reference) * Math.max(0, input.weeklyHours) * Math.max(0, input.hourlyCost) * input.weeksPerMonth * input.savingsShare;
  return { monthly, yearly: monthly * 12 };
}

export function shekel(value: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
