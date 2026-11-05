import { landingConfig as config } from "../../landing/config";
import { PrimaryLink, Section, SectionHeading } from "./chrome";
import { Reveal, revealDelay } from "./reveal";

export function Benefits() {
  const benefits = config.benefits;
  return (
    <Section id="benefits">
      <SectionHeading eyebrow={benefits.eyebrow} title={benefits.title} text={benefits.text} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.items.map((item, index) => (
          <Reveal key={item.title} delay={revealDelay(index)}>
            <article className="h-full rounded-2xl border border-line bg-card p-5 shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-well text-brand-text" aria-hidden="true">
                <BenefitIcon index={index} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="mt-8">
        <PrimaryLink href={config.demoUrl}>{benefits.cta}</PrimaryLink>
      </div>
    </Section>
  );
}

function BenefitIcon({ index }: { index: number }) {
  const common = "h-5 w-5 fill-none stroke-current stroke-[1.75]";
  const paths = [
    "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M8 8h8M8 12h8M8 16h5",
    "M7 13c1.5-4 8.5-4 10 0M8 17h8",
    "M5 19V5h14v14H5Zm4-8h6M9 15h3",
    "M6 4h9l3 3v13H6V4Zm8 0v4h4",
    "M8 4h8v6H8V4Zm-2 8h12v8H6v-8Z",
  ];
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
      <path d={paths[index] ?? paths[0]} />
    </svg>
  );
}
