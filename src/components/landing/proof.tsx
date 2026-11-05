import { landingConfig as config } from "../../landing/config";
import { PrimaryLink, Section } from "./chrome";
import { Reveal, revealDelay } from "./reveal";

export function Proof() {
  const proof = config.proof;
  return (
    <Section className="py-10 sm:py-14">
      <Reveal>
        <p className="text-sm font-medium text-muted">{proof.caption}</p>
        <ul className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
          {proof.logos.map((logo) => (
            <li key={logo} className="text-sm font-semibold tracking-tight text-ink-soft">
              {logo}
            </li>
          ))}
        </ul>
        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          {proof.stats.map((stat, index) => (
            <Reveal key={stat.label} delay={revealDelay(index)}>
              <div className="rounded-2xl border border-line bg-card px-4 py-4">
                <dt className="text-sm text-muted">{stat.label}</dt>
                <dd dir="ltr" className="mt-1 text-start text-3xl font-bold tracking-tight text-ink">
                  {stat.value}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
        <div className="mt-8">
          <PrimaryLink href={config.startUrl}>{config.startLabel}</PrimaryLink>
        </div>
      </Reveal>
    </Section>
  );
}
