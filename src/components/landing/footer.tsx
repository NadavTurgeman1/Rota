import { landingConfig as config } from "../../landing/config";

export function Footer() {
  const footer = config.footer;
  return (
    <footer className="border-t border-line px-5 py-12 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 lg:grid-cols-4 lg:gap-8">
        <div className="col-span-3 lg:col-span-1">
          <p className="text-right text-lg font-semibold text-ink" dir="ltr">
            {config.name}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{footer.blurb}</p>
        </div>
        <nav aria-label={footer.product} className="min-w-0">
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
        <nav aria-label={footer.account} className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{footer.account}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <a href={config.loginUrl} className="text-sm text-muted hover:text-ink">
                {footer.login}
              </a>
            </li>
            <li>
              <a href={`mailto:${footer.contactEmail}`} className="text-sm text-muted hover:text-ink">
                {footer.contact}
              </a>
            </li>
            <li>
              <a href={config.meetingUrl} className="text-sm text-muted hover:text-ink">
                {config.meeting.cta}
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label={footer.legal} className="min-w-0">
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
    </footer>
  );
}
