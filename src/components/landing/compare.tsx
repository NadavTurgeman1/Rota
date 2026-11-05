import { landingConfig as config } from "../../landing/config";
import { PrimaryLink, RichText, Section, SectionHeading } from "./chrome";

export function Compare() {
  const compare = config.compare;
  return (
    <Section>
      <SectionHeading eyebrow={compare.eyebrow} title={compare.title} text={compare.text} />
      <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">{compare.title}</caption>
          <thead>
            <tr className="border-b border-line text-start">
              <th scope="col" className="px-4 py-3 font-medium text-muted">
                <span className="sr-only">נושא</span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-ink">
                {compare.before}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-brand-text">
                <RichText text={compare.after} />
              </th>
            </tr>
          </thead>
          <tbody>
            {compare.rows.map((row) => (
              <tr key={row.topic} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 text-start font-semibold text-ink">
                  {row.topic}
                </th>
                <td className="px-4 py-3 text-muted">{row.before}</td>
                <td className="px-4 py-3 font-medium text-ink">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8">
        <PrimaryLink href={config.startUrl}>{compare.cta}</PrimaryLink>
      </div>
    </Section>
  );
}
