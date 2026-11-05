"use client";

import { useState } from "react";
import { landingConfig as config } from "../../landing/config";
import { PrimaryLink, RichText, Section, SectionHeading } from "./chrome";

export function Faq() {
  const faq = config.faq;
  const [open, setOpen] = useState(0);
  return (
    <Section id="faq" className="bg-paper">
      <SectionHeading eyebrow={faq.eyebrow} title={faq.title} text={faq.text} />
      <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-card">
        {faq.items.map((item, index) => {
          const shown = open === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;
          return (
            <div key={item.q}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-base font-semibold text-ink"
                  aria-expanded={shown}
                  aria-controls={panelId}
                  onClick={() => setOpen(shown ? -1 : index)}
                >
                  {item.q}
                  <span aria-hidden="true" className="text-muted">
                    {shown ? "−" : "+"}
                  </span>
                </button>
              </h3>
              {shown ? (
                <div id={panelId} role="region" aria-labelledby={buttonId} className="px-5 pb-4 text-sm leading-6 text-muted">
                  <RichText text={item.a} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-8">
        <PrimaryLink href={config.startUrl}>{faq.cta}</PrimaryLink>
      </div>
    </Section>
  );
}
