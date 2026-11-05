import type { ReactNode } from "react";
import { landingConfig } from "../../landing/config";

export function RichText({ text }: { text: string }) {
  const parts = text.split("{name}");
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? (
            <span dir="ltr">{landingConfig.name}</span>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-brand-text">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance text-ink sm:text-4xl">{title}</h2>
      {text ? (
        <p className="mt-4 text-base leading-7 text-muted">
          <RichText text={text} />
        </p>
      ) : null}
    </div>
  );
}

const primary =
  "inline-flex h-12 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-on-brand hover:bg-brand-hover";
const quiet =
  "inline-flex h-12 items-center justify-center rounded-full border border-line bg-card px-5 text-sm font-semibold text-ink hover:bg-well";

export function PrimaryLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} className={primary}>
      {children}
    </a>
  );
}

export function QuietLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} className={quiet}>
      {children}
    </a>
  );
}
