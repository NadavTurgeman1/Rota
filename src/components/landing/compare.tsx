import { landingConfig as config } from "../../landing/config";
import { RichText, Section, SectionHeading } from "./chrome";

export function Compare() {
  const compare = config.compare;
  return (
    <Section>
      <SectionHeading eyebrow={compare.eyebrow} title={compare.title} text={compare.text} />
      <div className="mt-10 grid gap-3 md:hidden">
        {compare.rows.map((row) => (
          <article key={row.topic} className="rounded-2xl border border-line bg-card p-4">
            <h3 className="text-sm font-semibold text-ink">{row.topic}</h3>
            <p className="mt-3 text-sm font-medium text-ink">
              <span className="mb-1 block text-xs font-semibold text-brand-text">
                <RichText text={compare.after} />
              </span>
              {row.after}
            </p>
            <p className="mt-3 text-sm text-muted">
              <span className="mb-1 block text-xs font-semibold text-muted">{compare.before}</span>
              {row.before}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-10 hidden overflow-x-auto rounded-2xl border border-line bg-card md:block">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <caption className="sr-only">{compare.title}</caption>
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[36%]" />
            <col className="w-[36%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={headMuted}>
                <span className="sr-only">נושא</span>
              </th>
              <th scope="col" className={headBrand}>
                <RichText text={compare.after} />
              </th>
              <th scope="col" className={headInk}>
                {compare.before}
              </th>
            </tr>
          </thead>
          <tbody>
            {compare.rows.map((row) => (
              <tr key={row.topic} className="border-b border-line last:border-0">
                <th scope="row" className={headInk}>
                  {row.topic}
                </th>
                <td className={cellInk}>{row.after}</td>
                <td className={cellMuted}>{row.before}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const head = "px-4 py-3 text-start align-top font-semibold";
const cell = "px-4 py-3 text-start align-top";
const headMuted = `${head} font-medium text-muted`;
const headInk = `${head} text-ink`;
const headBrand = `${head} text-brand-text`;
const cellInk = `${cell} font-medium text-ink`;
const cellMuted = `${cell} text-muted`;
