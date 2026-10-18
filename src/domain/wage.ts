/** Unset wages sort after every wage that was actually entered. */
export function wageRank(wage: number | undefined): number {
  return wage && wage > 0 ? wage : Number.POSITIVE_INFINITY;
}

/** Marks suggestions that cost more than the cheapest set wage. Nothing is removed. */
export function markDearer<T extends { dearerThan?: number }>(items: T[], wageOf: (item: T) => number): void {
  const positive = items.map(wageOf).filter((wage) => wage > 0 && Number.isFinite(wage));
  if (positive.length === 0) return;
  const cheapest = Math.min(...positive);
  for (const item of items) {
    const wage = wageOf(item);
    if (wage > cheapest) item.dearerThan = cheapest;
  }
}
