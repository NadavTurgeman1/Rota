import { landingConfig as config } from "../../landing/config";
import { RichText, Section, SectionHeading } from "./chrome";

export function Proof() {
  const proof = config.proof;
  const hasStory = proof.problems.length > 0;
  return (
    <Section>
      {proof.title ? <SectionHeading eyebrow={proof.eyebrow} title={proof.title} text={proof.note} /> : null}
      <div className={`${proof.title ? "mt-10" : ""} grid gap-4 ${hasStory ? "lg:grid-cols-2" : ""}`}>
        {hasStory ? (
          <article className="rounded-3xl border border-line bg-card p-6">
            <h3 className="text-lg font-semibold text-ink">{proof.problemTitle}</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {proof.problems.map((item) => (
                <li key={item} className="text-sm leading-6 text-muted">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
        <article className="rounded-3xl border border-brand bg-card p-6">
          <h3 className="text-lg font-semibold text-brand-text">
            <RichText text={proof.fixTitle} />
          </h3>
          <ul className="mt-4 flex flex-col gap-3">
            {proof.fixes.map((item) => (
              <li key={item} className="text-sm leading-6 text-ink">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Section>
  );
}
