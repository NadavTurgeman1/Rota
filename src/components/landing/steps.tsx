import { landingConfig as config } from "../../landing/config";
import { RichText, Section, SectionHeading } from "./chrome";
import { Reveal, revealDelay } from "./reveal";

export function Steps() {
  const steps = config.steps;
  return (
    <Section id="how" className="bg-paper">
      <SectionHeading eyebrow={steps.eyebrow} title={steps.title} text={steps.text} />
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.items.map((item, index) => (
          <Reveal key={item.title} delay={revealDelay(index)}>
            <li className="h-full rounded-2xl border border-line bg-card p-5">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-text" aria-hidden="true">
                <StepIcon index={index} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                <RichText text={item.text} />
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

function StepIcon({ index }: { index: number }) {
  const common = "h-5 w-5 fill-none stroke-current stroke-[1.75]";
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <circle cx="9" cy="9" r="3" />
        <circle cx="16" cy="10" r="2.5" />
        <path d="M4 19c.6-2.4 2.4-3.5 5-3.5s4.4 1.1 5 3.5M14 15.5c.8-.4 1.7-.6 2.6-.6 1.8 0 3.2.8 3.8 2.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
      <path d="M5 12.5 9.2 17 19 7" />
    </svg>
  );
}
