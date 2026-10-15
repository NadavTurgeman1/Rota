import { useState, type ReactNode } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { button, card, field, label, labelText } from "./ui";
import { accessLabel } from "./users-panel";

export function BrandMark() {
  return (
    <img
      src="/rota-logo.png"
      alt=""
      aria-hidden="true"
      className="h-11 w-11 shrink-0 translate-y-1 object-contain"
    />
  );
}

/** The t takes the star's pink, purple, and cyan, a little larger than the other letters. */
export function Wordmark() {
  return (
    <p dir="ltr" className="translate-y-1 text-xl font-bold leading-none tracking-tight text-ink">
      Ro
      <span className="mx-px inline-block bg-[linear-gradient(180deg,#ff4ec8_0%,#e038d8_30%,#7c3aed_58%,#2f8bff_82%,#22d3ee_100%)] bg-clip-text text-[1.05em] font-extrabold leading-none text-transparent">
        t
      </span>
      a
    </p>
  );
}

/** Email and password. In the demo the accounts come from the browser workspace. */
export function LoginScreen({
  lang,
  orgName,
  demoAccounts,
  demoPassword,
  toolbar,
  onSignIn,
  onCreateAccount,
}: {
  lang: Lang;
  orgName: string;
  demoAccounts: { email: string; name: string; access: "owner" | "write" | "read" }[];
  demoPassword: string;
  toolbar: ReactNode;
  /** Returns false when the email or password is wrong. */
  onSignIn: (email: string, password: string) => boolean | Promise<boolean>;
  onCreateAccount?: (email: string, password: string) => Promise<"signed-in" | "confirm" | "failed">;
}) {
  const t = copy[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,var(--brand-soft),transparent)]"
      />
      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <Wordmark />
        </div>
        <div className="flex items-center gap-2">{toolbar}</div>
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-12 pt-8 sm:pt-16">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <form
            data-testid="login-form"
            className={`${card} flex flex-col gap-5 shadow-pop`}
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setPending(false);
                setFailed(!(await onSignIn(email, password)));
              })();
            }}
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t.signInTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                {orgName} · {t.signInHint}
              </p>
            </div>
            <label className={label}>
              <span className={labelText}>{t.email}</span>
              <input
                data-testid="login-email"
                type="email"
                dir="ltr"
                autoComplete="username"
                className={field}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className={label}>
              <span className={labelText}>{t.password}</span>
              <input
                data-testid="login-password"
                type="password"
                autoComplete="current-password"
                className={field}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {failed ? (
              <p
                role="alert"
                data-testid="login-error"
                className="rounded-lg border border-danger-line/50 bg-danger-softer px-3 py-2 text-sm text-danger-text"
              >
                {t.signInFailed}
              </p>
            ) : null}
            <button type="submit" data-testid="login-submit" className={`${button.primary} h-10 w-full`}>
              {t.signIn}
            </button>
            {onCreateAccount ? (
              <button
                type="button"
                data-testid="create-account"
                className={`${button.quiet} h-10 w-full`}
                onClick={() => {
                  void (async () => {
                    const result = await onCreateAccount(email, password);
                    setFailed(result === "failed");
                    setPending(result === "confirm");
                  })();
                }}
              >
                {t.createAccount}
              </button>
            ) : null}
            {pending ? (
              <p role="status" className="text-sm leading-6 text-muted">
                {t.accountPending}
              </p>
            ) : null}
          </form>
          {demoAccounts.length > 0 ? (
          <section className="rounded-2xl border border-dashed border-field-line/60 bg-card/60 p-4 text-sm backdrop-blur">
            <h2 className="font-semibold text-ink-soft">
              {t.demoAccounts} · {t.password}:{" "}
              <code dir="ltr" className="rounded-md bg-well px-1.5 py-0.5 font-mono text-xs text-ink">
                {demoPassword}
              </code>
            </h2>
            <ul className="mt-3 flex flex-col gap-1">
              {demoAccounts.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    aria-pressed={email === account.email}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start ${
                      email === account.email ? "bg-brand-soft text-brand-text" : "hover:bg-well"
                    }`}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(demoPassword);
                      setFailed(false);
                    }}
                  >
                    <span dir="ltr" className="font-medium">
                      {account.email}
                    </span>
                    <span className={`text-xs ${email === account.email ? "" : "text-muted"}`}>
                      {account.name} · {accessLabel(lang, account.access)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** Shown after sign-in when the account does not belong to a business yet. */
export function CreateOrgScreen({
  lang,
  toolbar,
  onCreate,
}: {
  lang: Lang;
  toolbar: ReactNode;
  onCreate: (name: string, type: string) => Promise<boolean>;
}) {
  const t = copy[lang];
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <Wordmark />
        </div>
        <div className="flex items-center gap-2">{toolbar}</div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-8 sm:pt-16">
        <form
          className={`${card} flex w-full max-w-sm flex-col gap-5 shadow-pop`}
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => setFailed(!(await onCreate(name, type))))();
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight">{t.createOrgTitle}</h1>
          <label className={label}>
            <span className={labelText}>{t.orgName}</span>
            <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className={label}>
            <span className={labelText}>{t.bizType}</span>
            <input className={field} value={type} onChange={(event) => setType(event.target.value)} />
          </label>
          {failed ? (
            <p role="alert" className="text-sm text-danger-text">
              {t.signInFailed}
            </p>
          ) : null}
          <button type="submit" className={`${button.primary} h-10 w-full`} disabled={!name.trim()}>
            {t.createOrgAction}
          </button>
        </form>
      </main>
    </div>
  );
}

/** Shown after the business exists and before it has a site. */
export function CreateSiteScreen({
  lang,
  toolbar,
  onCreate,
}: {
  lang: Lang;
  toolbar: ReactNode;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const t = copy[lang];
  const [name, setName] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <Wordmark />
        </div>
        <div className="flex items-center gap-2">{toolbar}</div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-8 sm:pt-16">
        <form
          className={`${card} flex w-full max-w-sm flex-col gap-5 shadow-pop`}
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => setFailed(!(await onCreate(name))))();
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight">{t.createSiteTitle}</h1>
          <label className={label}>
            <span className={labelText}>{t.siteName}</span>
            <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {failed ? (
            <p role="alert" className="text-sm text-danger-text">
              {t.saveFailed}
            </p>
          ) : null}
          <button type="submit" className={`${button.primary} h-10 w-full`} disabled={!name.trim()}>
            {t.createSiteAction}
          </button>
        </form>
      </main>
    </div>
  );
}
