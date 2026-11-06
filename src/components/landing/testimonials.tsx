import { landingConfig as config } from "../../landing/config";
import { Section, SectionHeading } from "./chrome";
import { Reveal, revealDelay } from "./reveal";

export function Testimonials() {
  const testimonials = config.testimonials;
  if (testimonials.items.length === 0) return null;
  return (
    <Section className="bg-paper">
      <SectionHeading eyebrow={testimonials.eyebrow} title={testimonials.title} text={testimonials.text} />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {testimonials.items.map((item, index) => (
          <Reveal key={item.name} delay={revealDelay(index)}>
            <figure className="flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-card">
              <blockquote className="text-base leading-7 text-ink">“{item.quote}”</blockquote>
              <figcaption className="mt-6">
                <p className="font-semibold text-ink">{item.name}</p>
                <p className="text-sm text-muted">
                  {item.role}, {item.company}
                </p>
                <p dir="ltr" className="mt-3 text-start text-sm font-semibold text-brand-text">
                  {item.result}
                </p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
