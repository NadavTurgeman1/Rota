import { landingConfig as config } from "../../landing/config";

export function Footer() {
  const footer = config.footer;
  return (
    <footer className="border-t border-line px-5 py-12 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-semibold text-ink" dir="ltr">
            {config.name}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{footer.blurb}</p>
        </div>
        <nav aria-label={footer.product}>
          <h2 className="text-sm font-semibold text-ink">{footer.product}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {config.nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-sm text-muted hover:text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={footer.account}>
          <h2 className="text-sm font-semibold text-ink">{footer.account}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <a href={config.loginUrl} className="text-sm text-muted hover:text-ink">
                {footer.login}
              </a>
            </li>
            <li>
              <a href={config.startUrl} className="text-sm text-muted hover:text-ink">
                {config.startLabel}
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label={footer.legal}>
          <h2 className="text-sm font-semibold text-ink">{footer.legal}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {footer.links.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-sm text-muted hover:text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          <span dir="ltr">{config.name}</span>
        </p>
        <ul className="flex flex-wrap gap-4" aria-label={footer.socialLabel}>
          {footer.social.map((item) => (
            <li key={item.label}>
              <a href={item.href} className="text-sm font-medium text-ink underline decoration-1 underline-offset-4" rel="noreferrer">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
