import { landingConfig as config } from "../../landing/config";
import { Section, SectionHeading } from "./chrome";

export function Features() {
  const features = config.features;
  return (
    <Section id="features">
      <SectionHeading eyebrow={features.eyebrow} title={features.title} text={features.text} />
      <div className="mt-10 grid items-start gap-4 lg:grid-cols-2">
        {features.groups.map((group) => (
          <article key={group.title} className="self-start rounded-2xl border border-line bg-card p-5 shadow-card">
            <h3 className="text-lg font-semibold text-ink">{group.title}</h3>
            <ul className="mt-3 flex list-disc flex-col gap-2 ps-5">
              {group.items.map((item) => (
                <li key={item} className="text-sm leading-6 text-muted">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}
