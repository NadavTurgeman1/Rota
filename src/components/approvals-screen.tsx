import { useEffect, useState, type ReactNode } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { BrandMark, Wordmark } from "./login-screen";
import { button, card, field, label, labelText } from "./ui";

export interface TenantRow {
  id: string;
  name: string;
  kind: string;
  status: "active" | "suspended";
  adminEmail: string;
  adminName: string;
  adminJoined: boolean;
}

export interface SignupApproval {
  id: string;
  email: string;
  fullName: string;
  consumed: boolean;
}

/** Super admin: approve an email, or open an existing business as its company admin. */
export function ApprovalsScreen({
  lang,
  toolbar,
  load,
  onApprove,
  onStatus,
  onEnter,
  bare = false,
}: {
  lang: Lang;
  toolbar: ReactNode;
  load: () => Promise<{ companies: TenantRow[]; approvals: SignupApproval[] }>;
  onApprove: (email: string) => Promise<boolean>;
  onStatus: (id: string, status: "active" | "suspended") => Promise<boolean>;
  onEnter: (orgId: string) => void;
  bare?: boolean;
}) {
  const t = copy[lang];
  const [tab, setTab] = useState<"approve" | "enter">("approve");
  const [companies, setCompanies] = useState<TenantRow[]>([]);
  const [approvals, setApprovals] = useState<SignupApproval[]>([]);
  const [email, setEmail] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (!active) return;
      setCompanies(next.companies);
      setApprovals(next.approvals);
    });
    return () => {
      active = false;
    };
  }, [load]);
  async function refresh() {
    const next = await load();
    setCompanies(next.companies);
    setApprovals(next.approvals);
  }
  const tabs = (
    <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-track p-1">
      {(
        [
          ["approve", t.adminTabApprove],
          ["enter", t.adminTabEnter],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          data-testid={`admin-tab-${id}`}
          aria-selected={tab === id}
          className={`min-h-9 rounded-lg px-3 text-sm font-medium ${tab === id ? "bg-card font-semibold text-ink shadow-card" : "text-muted"}`}
          onClick={() => setTab(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  const body = (
    <>
      {tabs}
      {tab === "approve" ? (
        <>
          <form
            className={`${card} flex flex-col gap-5 shadow-pop`}
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const ok = await onApprove(email);
                setFailed(!ok);
                if (!ok) return;
                setEmail("");
                await refresh();
              })();
            }}
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t.approvalsTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-muted">{t.approvalsHint}</p>
            </div>
            <label className={label}>
              <span className={labelText}>{t.email}</span>
              <input dir="ltr" type="email" className={field} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {failed ? (
              <p role="alert" className="text-sm text-danger-text">
                {t.saveFailed}
              </p>
            ) : null}
            <button type="submit" className={`${button.primary} h-10 w-full`} disabled={!email.trim()}>
              {t.approveFounder}
            </button>
          </form>
          <ul className={`${card} flex flex-col gap-3 text-sm`}>
            {approvals.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4">
                <span dir="ltr" className="font-medium">
                  {row.email}
                </span>
                <span className="text-muted">{row.consumed ? t.approvalUsed : t.approvalOpen}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className={`${card} flex flex-col gap-3 text-sm`}>
          {companies.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4">
              <span className="font-medium">{row.name}</span>
              <span className="flex items-center gap-2">
                <button type="button" className={button.quiet} data-testid={`enter-${row.id}`} onClick={() => onEnter(row.id)}>
                  {t.enterCompany}
                </button>
                <button
                  type="button"
                  className={button.quiet}
                  onClick={() => {
                    void (async () => {
                      const next = row.status === "active" ? "suspended" : "active";
                      if (await onStatus(row.id, next)) await refresh();
                    })();
                  }}
                >
                  {row.status === "active" ? t.suspendCompany : t.activateCompany}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  if (bare) return <div className="mx-auto flex w-full max-w-lg flex-col gap-4">{body}</div>;
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <Wordmark />
        </div>
        <div className="flex items-center gap-2">{toolbar}</div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pb-12 pt-8">{body}</main>
    </div>
  );
}
