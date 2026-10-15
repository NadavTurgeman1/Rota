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

/** Super admin: open a company and name its first company admin. */
export function ApprovalsScreen({
  lang,
  toolbar,
  load,
  onProvision,
  onStatus,
  bare = false,
}: {
  lang: Lang;
  toolbar: ReactNode;
  load: () => Promise<TenantRow[]>;
  onProvision: (input: { name: string; type: string; fullName: string; email: string }) => Promise<boolean>;
  onStatus: (id: string, status: "active" | "suspended") => Promise<boolean>;
  bare?: boolean;
}) {
  const t = copy[lang];
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (active) setRows(next);
    });
    return () => {
      active = false;
    };
  }, [load]);
  const body = (
    <>
      <form
        className={`${card} flex flex-col gap-5 shadow-pop`}
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            const ok = await onProvision({ name, type, fullName, email });
            setFailed(!ok);
            if (!ok) return;
            setName("");
            setType("");
            setFullName("");
            setEmail("");
            setRows(await load());
          })();
        }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.approvalsTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t.approvalsHint}</p>
        </div>
        <label className={label}>
          <span className={labelText}>{t.orgName}</span>
          <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className={label}>
          <span className={labelText}>{t.bizType}</span>
          <input className={field} value={type} onChange={(event) => setType(event.target.value)} />
        </label>
        <label className={label}>
          <span className={labelText}>{t.fullName}</span>
          <input className={field} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label className={label}>
          <span className={labelText}>{t.email}</span>
          <input dir="ltr" type="email" className={field} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {failed ? (
          <p role="alert" className="text-sm text-danger-text">
            {t.saveFailed}
          </p>
        ) : null}
        <button
          type="submit"
          className={`${button.primary} h-10 w-full`}
          disabled={!name.trim() || !fullName.trim() || !email.trim()}
        >
          {t.approveFounder}
        </button>
      </form>
      <ul className={`${card} flex flex-col gap-3 text-sm`}>
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium">{row.name}</span>
              <span className="ms-2 text-muted">{row.adminName}</span>
              <span dir="ltr" className="ms-2 text-muted">
                {row.adminEmail}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted">{row.adminJoined ? t.approvalUsed : t.approvalOpen}</span>
              <button
                type="button"
                className={button.quiet}
                onClick={() => {
                  void (async () => {
                    const next = row.status === "active" ? "suspended" : "active";
                    if (await onStatus(row.id, next)) setRows(await load());
                  })();
                }}
              >
                {row.status === "active" ? t.suspendCompany : t.activateCompany}
              </button>
            </span>
          </li>
        ))}
      </ul>
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
