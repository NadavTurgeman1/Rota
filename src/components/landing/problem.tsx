import { landingConfig as config } from "../../landing/config";
import { Section, SectionHeading } from "./chrome";
import { Reveal, revealDelay } from "./reveal";

export function Problem() {
  const problem = config.problem;
  return (
    <Section>
      <SectionHeading eyebrow={problem.eyebrow} title={problem.title} text={problem.text} />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {problem.items.map((item, index) => (
          <Reveal key={item.title} delay={revealDelay(index)}>
            <article className="h-full rounded-2xl border border-line bg-card p-5 shadow-card">
              <p className="text-sm font-semibold text-brand-text">0{index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
