"use client";

import { useState } from "react";
import { landingConfig as config } from "../../landing/config";
import { shekel } from "../../landing/roi";
import { Section, SectionHeading } from "./chrome";

export function Pricing() {
  const pricing = config.pricing;
  const [yearly, setYearly] = useState(false);
  return (
    <Section id="pricing">
      <SectionHeading eyebrow={pricing.eyebrow} title={pricing.title} text={pricing.text} />
      <div className="mt-8 inline-flex rounded-full border border-line bg-card p-1" role="group" aria-label={pricing.eyebrow}>
        <button type="button" aria-pressed={!yearly} className={periodClass(!yearly)} onClick={() => setYearly(false)}>
          {pricing.month}
        </button>
        <button type="button" aria-pressed={yearly} className={periodClass(yearly)} onClick={() => setYearly(true)}>
          {pricing.year}
          <span className="ms-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-text">{pricing.badge}</span>
        </button>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {pricing.plans.map((plan) => {
          const price = yearly ? plan.year : plan.month;
          return (
            <article key={plan.id} className={`flex flex-col rounded-2xl border bg-card p-5 ${plan.featured ? "border-brand shadow-pop lg:-translate-y-2" : "border-line"}`}>
              {plan.featured ? <p className="text-xs font-semibold text-brand-text">{pricing.highlight}</p> : <p className="text-xs text-transparent" aria-hidden="true">.</p>}
              <h3 className="mt-2 text-xl font-semibold text-ink">{plan.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-muted">{plan.text}</p>
              <p className="mt-4 flex items-end gap-2">
                <span dir="ltr" className="text-4xl font-bold tracking-tight text-ink">
                  {shekel(price)}
                </span>
                <span className="pb-1 text-sm text-muted">{yearly ? pricing.yearlyNote : pricing.perMonth}</span>
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-ink">
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <a
                href={config.startUrl}
                className={`mt-6 inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold ${plan.featured ? "bg-brand text-on-brand hover:bg-brand-hover" : "border border-line bg-card text-ink hover:bg-well"}`}
              >
                {pricing.cta}
              </a>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">{pricing.trust}</p>
    </Section>
  );
}

function periodClass(on: boolean): string {
  return `inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ${on ? "bg-brand text-on-brand" : "text-muted"}`;
}
