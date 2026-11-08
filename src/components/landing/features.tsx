import { landingConfig as config } from "../../landing/config";
import { Section, SectionHeading } from "./chrome";

type FeatureGroup = (typeof config.features.groups)[number];

function FeatureCard({ group }: { group: FeatureGroup }) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">{group.title}</h3>
      <ul className="mt-3 flex list-disc flex-col gap-2 ps-5">
        {group.items.map((item) => (
          <li key={item} className="text-sm leading-6 text-muted">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Features() {
  const features = config.features;
  const columns = [0, 1].map((column) => features.groups.filter((_, index) => index % 2 === column));
  return (
    <Section id="features">
      <SectionHeading eyebrow={features.eyebrow} title={features.title} text={features.text} />
      <div className="mt-10 flex flex-col gap-4 lg:hidden">
        {features.groups.map((group) => (
          <FeatureCard key={group.title} group={group} />
        ))}
      </div>
      <div className="mt-10 hidden items-start gap-4 lg:grid lg:grid-cols-2">
        {columns.map((column) => (
          <div key={column[0]?.title} className="grid content-start gap-4">
            {column.map((group) => (
              <FeatureCard key={group.title} group={group} />
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
