import { landingConfig as config } from "../../landing/config";
import { PrimaryLink } from "./chrome";

export function FinalCta() {
  const block = config.finalCta;
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-24">
      <div className="landing-close mx-auto flex max-w-6xl flex-col items-start rounded-3xl px-6 py-12 sm:px-12">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">{block.title}</h2>
        <p className="landing-close-muted mt-4 max-w-xl text-base leading-7">{block.text}</p>
        <div className="mt-8">
          <PrimaryLink href={config.startUrl}>{block.cta}</PrimaryLink>
        </div>
        <p className="landing-close-muted mt-4 text-sm">{block.trust}</p>
      </div>
    </section>
  );
}
