import { useEffect, useState, type ReactNode } from "react";
import type { Lang } from "../domain";
import { REMEMBER_EMAIL_KEY, REMEMBER_KEY, rememberOn } from "../auth/remember";
import { copy } from "../i18n/copy";
import { CookieNotice } from "./cookie-notice";
import { LegalLinks } from "./legal-links";
import { isNativeApp } from "../native/chrome";
import { accessLabel } from "./users-panel";

/** The wordmark. Letters switch to light in the dark theme; the mark itself stays. */
export function Logo({ className = "h-9" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <span className="sr-only">Rota</span>
      <img src="/rota-logo.png" alt="" className="rota-logo-light h-full w-auto" />
      <img src="/rota-logo-dark.png" alt="" className="rota-logo-dark h-full w-auto" />
    </span>
  );
}

/** Original shift board for the sign-in screen. Decorative; the column is hidden from assistive tech. */
function LoginArt() {
  return (
    <svg viewBox="0 0 640 800" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="640" height="800" fill="#f4f0e6" />
      <rect x="96" y="72" width="448" height="656" rx="36" fill="#fffdf8" />
      <rect x="128" y="112" width="168" height="28" rx="14" fill="#2b5bff" />
      <rect x="312" y="112" width="92" height="28" rx="14" fill="#e7edff" />
      <rect x="416" y="112" width="92" height="28" rx="14" fill="#f2eeff" />
      {[0, 1, 2, 3, 4].map((row) => (
        <g key={row}>
          <rect x="128" y={176 + row * 104} width="120" height="72" rx="18" fill={row % 2 === 0 ? "#ebf3ff" : "#fff7e8"} />
          <rect x="260" y={176 + row * 104} width="120" height="72" rx="18" fill={row % 2 === 0 ? "#f2eeff" : "#ebf3ff"} />
          <rect x="392" y={176 + row * 104} width="120" height="72" rx="18" fill={row % 2 === 0 ? "#fff7e8" : "#f2eeff"} />
        </g>
      ))}
    </svg>
  );
}

const authField =
  "h-12 w-full rounded-full border border-line bg-card px-4 text-sm text-ink outline-none placeholder:text-subtle";
const authLabel = "flex flex-col gap-2 text-sm font-semibold text-ink";
const authButton =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-4 text-base font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";

function PasswordField({
  testId,
  id,
  name,
  autoComplete,
  defaultValue,
  onInput,
  showLabel,
  hideLabel,
}: {
  testId: string;
  id?: string;
  name: string;
  autoComplete: string;
  defaultValue?: string;
  onInput?: (value: string) => void;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        data-testid={testId}
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        className={`${authField} pe-12`}
        defaultValue={defaultValue}
        onInput={onInput ? (event) => onInput(event.currentTarget.value) : undefined}
      />
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute end-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-well hover:text-ink"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.75]">
            <path d="M3 3l18 18" />
            <path d="M10.5 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.3-1" />
            <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9.5 4.2 11 7-1 1.8-2.6 3.6-4.6 5" />
            <path d="M6.1 6.4C4.2 7.6 2.7 9.3 1 12c1.5 2.8 5.5 7 11 7 1.2 0 2.3-.2 3.3-.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.75]">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}

/** Form on the start side, calendar on the other. Settings sit on the opposite edge from the wordmark. */
function AuthSplit({
  lang,
  toolbar,
  home = false,
  lowerLogo = false,
  neutral = false,
  children,
}: {
  lang: Lang;
  toolbar: ReactNode;
  home?: boolean;
  lowerLogo?: boolean;
  neutral?: boolean;
  children: ReactNode;
}) {
  const t = copy[lang];
  return (
    <div className={`relative flex min-h-dvh bg-card ${neutral ? "auth-neutral" : ""}`}>
      <div className="absolute end-4 top-4 z-30 sm:end-6 sm:top-6">{toolbar}</div>
      <section className="flex min-h-dvh w-full flex-col px-6 py-6 sm:px-12 lg:w-1/2 lg:px-16 lg:py-8">
        <div className="pe-14">
          <div className={lowerLogo ? "pt-14" : undefined}>
            <Logo className="h-8" />
          </div>
          {home ? (
            <a href="/" className="mt-4 inline-flex h-11 items-center text-sm font-semibold text-ink underline decoration-1 underline-offset-4">
              {t.backToLanding}
            </a>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-[400px]">
            {children}
            <LegalLinks lang={lang} className="mt-8" />
            <CookieNotice lang={lang} />
          </div>
        </div>
      </section>
      <aside aria-hidden="true" className="relative hidden min-h-dvh flex-1 lg:block">
        <LoginArt />
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
  onSignIn: (email: string, password: string, remember: boolean) => boolean | Promise<boolean>;
  onShowSignup?: () => void;
  /** Sets a new password for this email. Returns false when the account cannot be updated. */
  onRequestReset?: (email: string, password: string) => Promise<boolean>;
}) {
  const t = copy[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [remember, setRemember] = useState(true);
  const [resetState, setResetState] = useState<"idle" | "sent" | "failed" | "short">("idle");
  const hint = orgName && orgName !== "Rota" ? `${orgName} · ${t.signInHint}` : t.signInHint;

  useEffect(() => {
    const on = rememberOn(window.localStorage.getItem(REMEMBER_KEY));
    setRemember(on);
    if (!on) return;
    const saved = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (saved) setEmail(saved);
  }, []);

  const native = isNativeApp();
  return (
    <AuthSplit lang={lang} toolbar={toolbar} home={!native} lowerLogo={native} neutral>
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
              if (secret.length < 6) {
                setResetState("short");
                return;
              }
              setResetState((await onRequestReset(address, secret)) ? "sent" : "failed");
              return;
            }
            setFailed(!(await onSignIn(address, secret, remember)));
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
            value={email}
            onInput={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
        <label className={`${authLabel} mt-5`}>
          <span>{forgot ? t.newPasswordTitle : t.password}</span>
          <PasswordField
            testId="login-password"
            id="current-password"
            name="password"
            autoComplete={forgot ? "new-password" : "current-password"}
            defaultValue={password}
            onInput={setPassword}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </label>
        {!forgot ? (
          <label className="mt-5 flex items-start gap-3">
            <input
              id="remember-me"
              data-testid="remember-me"
              type="checkbox"
              checked={remember}
              className="mt-0.5 h-6 w-6 shrink-0"
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span className="text-sm leading-6 text-ink">
              <span className="font-semibold">{t.rememberMe}</span>
              <span className="mt-0.5 block font-normal text-muted">{t.rememberMeHint}</span>
            </span>
          </label>
        ) : null}
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
        {forgot && resetState === "short" ? (
          <p role="alert" data-testid="reset-short" className="mt-4 text-sm text-danger-text">
            {t.passwordTooShort}
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

/** Email and password. The name is already stored: on the employee card, or on the owner's approval. */
export function SignupScreen({
  lang,
  toolbar,
  onCreateAccount,
  onShowLogin,
}: {
  lang: Lang;
  toolbar: ReactNode;
  onCreateAccount: (
    email: string,
    password: string,
    accepted: boolean,
  ) => Promise<"signed-in" | "confirm" | "failed" | "denied" | "short" | "rate" | "consent">;
  onShowLogin: () => void;
}) {
  const t = copy[lang];
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [pending, setPending] = useState(false);
  const [short, setShort] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  return (
    <AuthSplit lang={lang} toolbar={toolbar} home neutral>
      <form
        data-testid="signup-form"
        method="post"
        autoComplete="on"
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const email = String(data.get("email") ?? "");
          const password = String(data.get("password") ?? "");
          const accepted = terms && adult;
          setConsentMissing(!accepted);
          if (!accepted) return;
          void (async () => {
            const result = await onCreateAccount(email, password, true);
            setFailed(result === "failed" || result === "consent");
            setDenied(result === "denied");
            setShort(result === "short");
            setRateLimited(result === "rate");
            setPending(result === "confirm");
            setConsentMissing(result === "consent");
          })();
        }}
      >
        <h1 className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-ink">{t.signupTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t.signupHint}</p>
        <label className={`${authLabel} mt-8`}>
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
          <PasswordField
            testId="signup-password"
            name="password"
            autoComplete="new-password"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </label>
        <div className="mt-5 flex items-start gap-3">
          <input
            id="signup-terms"
            data-testid="signup-terms"
            type="checkbox"
            checked={terms}
            className="mt-0.5 h-6 w-6 shrink-0"
            onChange={(event) => {
              setTerms(event.target.checked);
              setConsentMissing(false);
            }}
          />
          <label htmlFor="signup-terms" className="text-sm leading-6 text-ink">
            {t.signupTermsBefore}
            <a href={`/legal/terms?lang=${lang}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-1 underline-offset-4">
              {t.termsOfService}
            </a>
            {t.signupTermsBetween}
            <a href={`/legal/privacy?lang=${lang}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-1 underline-offset-4">
              {t.privacyPolicy}
            </a>
            {t.signupTermsAfter}
          </label>
        </div>
        <div className="mt-4 flex items-start gap-3">
          <input
            id="signup-adult"
            data-testid="signup-adult"
            type="checkbox"
            checked={adult}
            className="mt-0.5 h-6 w-6 shrink-0"
            onChange={(event) => {
              setAdult(event.target.checked);
              setConsentMissing(false);
            }}
          />
          <label htmlFor="signup-adult" className="text-sm leading-6 text-ink">
            {t.signupAdult}
          </label>
        </div>
        {consentMissing ? (
          <p role="alert" data-testid="signup-consent" className="mt-4 text-sm leading-6 text-danger-text">
            {t.signupConsentNeeded}
          </p>
        ) : null}
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
    <AuthSplit lang={lang} toolbar={toolbar}>
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
    <AuthSplit lang={lang} toolbar={toolbar}>
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
    <AuthSplit lang={lang} toolbar={toolbar}>
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
          <PasswordField
            testId="new-password"
            name="password"
            autoComplete="new-password"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
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
