"use client";

import { useState } from "react";
import { landingConfig as config } from "../../landing/config";
import { schedulingSavings, shekel } from "../../landing/roi";
import { PrimaryLink, Section, SectionHeading } from "./chrome";

export function Roi() {
  const roi = config.roi;
  const [employees, setEmployees] = useState(roi.defaults.employees);
  const [weeklyHours, setWeeklyHours] = useState(roi.defaults.weeklyHours);
  const [hourlyCost, setHourlyCost] = useState(roi.defaults.hourlyCost);
  const result = schedulingSavings({
    employees,
    weeklyHours,
    hourlyCost,
    referenceEmployees: roi.referenceEmployees,
    weeksPerMonth: roi.weeksPerMonth,
    savingsShare: roi.savingsShare,
  });

  return (
    <Section className="bg-paper">
      <SectionHeading eyebrow={roi.eyebrow} title={roi.title} text={roi.text} />
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form className="grid gap-5 rounded-2xl border border-line bg-card p-5" onSubmit={(event) => event.preventDefault()}>
          <Field id="roi-employees" label={roi.employees} min={roi.limits.employees.min} max={roi.limits.employees.max} value={employees} onChange={setEmployees} />
          <Field id="roi-hours" label={roi.weeklyHours} min={roi.limits.weeklyHours.min} max={roi.limits.weeklyHours.max} value={weeklyHours} onChange={setWeeklyHours} />
          <Field id="roi-cost" label={roi.hourlyCost} min={roi.limits.hourlyCost.min} max={roi.limits.hourlyCost.max} value={hourlyCost} onChange={setHourlyCost} />
        </form>
        <div className="flex flex-col justify-between rounded-2xl bg-brand p-6 text-on-brand" aria-live="polite">
          <div>
            <p className="text-sm font-medium">{roi.monthly}</p>
            <p dir="ltr" className="mt-2 text-start text-4xl font-bold tracking-tight">
              {shekel(result.monthly)}
            </p>
          </div>
          <div className="mt-8 border-t border-white/30 pt-6">
            <p className="text-sm font-medium">{roi.yearly}</p>
            <p dir="ltr" className="mt-2 text-start text-3xl font-bold tracking-tight">
              {shekel(result.yearly)}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <PrimaryLink href={config.startUrl}>{roi.cta}</PrimaryLink>
      </div>
    </Section>
  );
}

function Field({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-medium text-ink">
      {label}
      <input
        id={id}
        dir="ltr"
        inputMode="numeric"
        type="number"
        min={min}
        max={max}
        value={value}
        className="h-12 rounded-xl border border-field-line bg-card px-3 text-base text-ink"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </label>
  );
}
