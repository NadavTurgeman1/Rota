import { useState, type ReactNode } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { accessLabel } from "./users-panel";

/** The wordmark. Letters switch to light in the dark theme; the mark itself stays. */
export function Logo({ className = "h-9" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <img src="/rota-logo.png" alt="Rota" className="rota-logo-light h-full w-auto" />
      <img src="/rota-logo-dark.png" alt="Rota" className="rota-logo-dark h-full w-auto" />
    </span>
  );
}

const authField =
  "h-12 w-full rounded-full border border-line bg-card px-4 text-sm text-ink outline-none placeholder:text-subtle";
const authLabel = "flex flex-col gap-2 text-sm font-semibold text-ink";
const authButton =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-4 text-base font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";

/** Form on the start side, calendar on the other. Settings sit on the opposite edge from the wordmark. */
function AuthSplit({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh bg-card">
      <div className="absolute end-4 top-4 z-30 sm:end-6 sm:top-6">{toolbar}</div>
      <section className="flex min-h-dvh w-full flex-col px-6 py-6 sm:px-12 lg:w-1/2 lg:px-16 lg:py-8">
        <div className="pe-14">
          <Logo className="h-8" />
        </div>
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </section>
      <aside aria-hidden="true" className="relative hidden min-h-dvh flex-1 lg:block">
        <img src="/login-calendar.jpg?v=2" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      </aside>
    </div>
  );
}

function TextLink({ testId, onClick, children }: { testId?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="font-semibold underline decoration-1 underline-offset-4"
      onClick={onClick}
    >
      {children}
    </button>
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
  onShowSignup,
  onRequestReset,
}: {
  lang: Lang;
  orgName: string;
  demoAccounts: { email: string; name: string; access: "owner" | "write" | "read" }[];
  demoPassword: string;
  toolbar: ReactNode;
  /** Returns false when the email or password is wrong. */
  onSignIn: (email: string, password: string) => boolean | Promise<boolean>;
  onShowSignup?: () => void;
  /** Emails a password-reset link. Returns false when the request fails. */
  onRequestReset?: (email: string) => Promise<boolean>;
}) {
  const t = copy[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "sent" | "failed">("idle");
  const hint = orgName && orgName !== "Rota" ? `${orgName} · ${t.signInHint}` : t.signInHint;

  return (
    <AuthSplit toolbar={toolbar}>
      <form
        data-testid="login-form"
        method="post"
        autoComplete="on"
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const address = String(data.get("email") ?? "");
          const secret = String(data.get("password") ?? "");
          setEmail(address);
          setPassword(secret);
          void (async () => {
            if (forgot) {
              if (!onRequestReset) return;
              setResetState((await onRequestReset(address)) ? "sent" : "failed");
              return;
            }
            setFailed(!(await onSignIn(address, secret)));
          })();
        }}
      >
        <h1 className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-ink">
          {forgot ? t.forgotPassword : t.signInTitle}
        </h1>
        <p className={`mt-3 leading-7 text-ink ${forgot ? "text-sm font-normal text-muted" : "text-lg font-semibold"}`}>
          {forgot ? t.forgotHint : hint}
        </p>
        <label className={`${authLabel} mt-8`}>
          <span>{t.email}</span>
          <input
            data-testid="login-email"
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            placeholder="name@email.com"
            className={authField}
            defaultValue={email}
            onInput={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
        {forgot ? null : (
          <label className={`${authLabel} mt-5`}>
            <span>{t.password}</span>
            <input
              data-testid="login-password"
              id="current-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className={authField}
              defaultValue={password}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
        )}
        {failed && !forgot ? (
          <p role="alert" data-testid="login-error" className="mt-4 text-sm text-danger-text">
            {t.signInFailed}
          </p>
        ) : null}
        {forgot && resetState === "sent" ? (
          <p role="status" data-testid="reset-sent" className="mt-4 text-sm leading-6 text-ink">
            {t.forgotSent}
          </p>
        ) : null}
        {forgot && resetState === "failed" ? (
          <p role="alert" data-testid="reset-error" className="mt-4 text-sm text-danger-text">
            {t.forgotFailed}
          </p>
        ) : null}
        <button type="submit" data-testid="login-submit" className={`${authButton} mt-6`}>
          {forgot ? t.forgotSend : t.signIn}
        </button>
        {onRequestReset ? (
          <p className="mt-6 text-sm">
            <TextLink
              testId={forgot ? "back-to-login" : "forgot-password"}
              onClick={() => {
                setForgot((current) => !current);
                setFailed(false);
                setResetState("idle");
              }}
            >
              {forgot ? t.backToSignIn : t.forgotPassword}
            </TextLink>
          </p>
        ) : null}
        {onShowSignup && !forgot ? (
          <p className="mt-8 text-sm text-ink">
            {t.goToSignup} <TextLink testId="show-signup" onClick={onShowSignup}>{t.createAccount}</TextLink>
          </p>
        ) : null}
        {demoAccounts.length > 0 ? (
          <section className="mt-8 text-sm">
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
                    className={`flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-start ${
                      email === account.email ? "bg-brand-soft text-brand-text" : "hover:bg-well"
                    }`}
                    onClick={(event) => {
                      const form = event.currentTarget.closest("form");
                      const emailInput = form?.querySelector<HTMLInputElement>("input[name=email]");
                      const passwordInput = form?.querySelector<HTMLInputElement>("input[name=password]");
                      if (emailInput) emailInput.value = account.email;
                      if (passwordInput) passwordInput.value = demoPassword;
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
      </form>
    </AuthSplit>
  );
}

/** Name, email and password. Only an approved email can create an account. */
export function SignupScreen({
  lang,
  toolbar,
  onCreateAccount,
  onShowLogin,
}: {
  lang: Lang;
  toolbar: ReactNode;
  onCreateAccount: (fullName: string, email: string, password: string) => Promise<"signed-in" | "confirm" | "failed" | "denied" | "short" | "rate">;
  onShowLogin: () => void;
}) {
  const t = copy[lang];
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [pending, setPending] = useState(false);
  const [short, setShort] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  return (
    <AuthSplit toolbar={toolbar}>
      <form
        data-testid="signup-form"
        method="post"
        autoComplete="on"
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const fullName = String(data.get("name") ?? "");
          const email = String(data.get("email") ?? "");
          const password = String(data.get("password") ?? "");
          void (async () => {
            const result = await onCreateAccount(fullName, email, password);
            setFailed(result === "failed");
            setDenied(result === "denied");
            setShort(result === "short");
            setRateLimited(result === "rate");
            setPending(result === "confirm");
          })();
        }}
      >
        <h1 className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-ink">{t.signupTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t.signupHint}</p>
        <label className={`${authLabel} mt-8`}>
          <span>{t.fullName}</span>
          <input
            data-testid="create-full-name"
            name="name"
            autoComplete="name"
            className={authField}
          />
        </label>
        <label className={`${authLabel} mt-5`}>
          <span>{t.email}</span>
          <input
            data-testid="signup-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="name@email.com"
            className={authField}
          />
        </label>
        <label className={`${authLabel} mt-5`}>
          <span>{t.password}</span>
          <input
            data-testid="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={authField}
          />
        </label>
        {short ? <p role="alert" className="mt-4 text-sm text-danger-text">{t.passwordTooShort}</p> : null}
        {rateLimited ? <p role="alert" className="mt-4 text-sm leading-6 text-danger-text">{t.signupRateLimit}</p> : null}
        {failed ? <p role="alert" className="mt-4 text-sm text-danger-text">{t.signupFailed}</p> : null}
        {denied ? <p role="alert" className="mt-4 text-sm leading-6 text-danger-text">{t.accountNotApproved}</p> : null}
        {pending ? <p role="status" className="mt-4 text-sm leading-6 text-muted">{t.accountPending}</p> : null}
        <button
          type="submit"
          data-testid="create-account"
          className={`${authButton} mt-6`}
        >
          {t.createAccount}
        </button>
        <p className="mt-8 text-sm text-ink">
          {t.goToLogin} <TextLink onClick={onShowLogin}>{t.signIn}</TextLink>
        </p>
      </form>
    </AuthSplit>
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
    <AuthSplit toolbar={toolbar}>
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => setFailed(!(await onCreate(name, type))))();
        }}
      >
        <h1 className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-ink">{t.createOrgTitle}</h1>
        <label className={`${authLabel} mt-8`}>
          <span>{t.orgName}</span>
          <input className={authField} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className={`${authLabel} mt-5`}>
          <span>{t.bizType}</span>
          <input className={authField} value={type} onChange={(event) => setType(event.target.value)} />
        </label>
        {failed ? <p role="alert" className="mt-4 text-sm text-danger-text">{t.signInFailed}</p> : null}
        <button type="submit" className={`${authButton} mt-6`} disabled={!name.trim()}>
          {t.createOrgAction}
        </button>
      </form>
    </AuthSplit>
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
    <AuthSplit toolbar={toolbar}>
      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => setFailed(!(await onCreate(name))))();
        }}
      >
        <h1 className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-ink">{t.createSiteTitle}</h1>
        <label className={`${authLabel} mt-8`}>
          <span>{t.siteName}</span>
          <input className={authField} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {failed ? <p role="alert" className="mt-4 text-sm text-danger-text">{t.saveFailed}</p> : null}
        <button type="submit" className={`${authButton} mt-6`} disabled={!name.trim()}>
          {t.createSiteAction}
        </button>
      </form>
    </AuthSplit>
  );
}

/** Shown when an email reset link opens the app, before the new password is saved. */
export function NewPasswordScreen({
  lang,
  toolbar,
  onSave,
}: {
  lang: Lang;
  toolbar: ReactNode;
  onSave: (password: string) => Promise<boolean>;
}) {
  const t = copy[lang];
  const [short, setShort] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <AuthSplit toolbar={toolbar}>
      <form
        data-testid="new-password-form"
        method="post"
        autoComplete="on"
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          const password = String(new FormData(event.currentTarget).get("password") ?? "");
          if (password.length < 6) {
            setShort(true);
            setFailed(false);
            return;
          }
          void (async () => {
            setShort(false);
            setFailed(!(await onSave(password)));
          })();
        }}
      >
        <h1 className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-ink">{t.newPasswordTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t.newPasswordHint}</p>
        <label className={`${authLabel} mt-8`}>
          <span>{t.password}</span>
          <input
            data-testid="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={authField}
          />
        </label>
        {short ? <p role="alert" className="mt-4 text-sm text-danger-text">{t.passwordTooShort}</p> : null}
        {failed ? <p role="alert" className="mt-4 text-sm text-danger-text">{t.newPasswordFailed}</p> : null}
        <button type="submit" data-testid="save-password" className={`${authButton} mt-6`}>
          {t.savePassword}
        </button>
      </form>
    </AuthSplit>
  );
}
