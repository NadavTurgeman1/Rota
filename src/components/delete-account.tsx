"use client";

import { useState } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { button, cardTitle, field, label, labelText } from "./ui";
import { useDialog } from "./use-dialog";

export function DeleteAccount({
  lang,
  owner,
  orgId,
  orgName,
  support,
  onClose,
  onDeleted,
  headers,
}: {
  lang: Lang;
  owner: boolean;
  orgId: string;
  orgName: string;
  support: boolean;
  onClose: () => void;
  onDeleted: () => void;
  headers: () => HeadersInit;
}) {
  const t = copy[lang];
  const dialog = useDialog(onClose);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<"sole_owner" | "name" | "failed" | null>(null);
  const nameMatches = typed.trim() === orgName.trim() && orgName.trim() !== "";

  async function run(scope: "login" | "business") {
    setBusy(true);
    setReason(null);
    const response = await fetch("/api/account", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ scope, orgId, orgName: typed }),
    }).catch(() => null);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setReason(body?.error === "sole_owner" || body?.error === "name" ? body.error : "failed");
      setBusy(false);
      return;
    }
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        tabIndex={-1}
        data-testid="delete-account"
        className="w-full max-w-md rounded-xl border border-line bg-card p-5 outline-none"
      >
        <h2 id="delete-account-title" className={cardTitle}>
          {t.deleteData}
        </h2>
        {support ? <p className="mt-3 text-sm leading-6 text-ink">{t.deleteUnavailable}</p> : null}
        {!support ? (
          <>
            <p className="mt-3 text-sm leading-6 text-muted">{t.deleteLoginHint}</p>
            {reason === "sole_owner" ? (
              <p role="alert" className="mt-3 text-sm leading-6 text-danger-text">
                {t.deleteSoleOwner}
              </p>
            ) : null}
            {reason === "failed" || reason === "name" ? (
              <p role="alert" className="mt-3 text-sm leading-6 text-danger-text">
                {t.deleteFailed}
              </p>
            ) : null}
            <button type="button" className={`${button.danger} mt-4`} disabled={busy} data-testid="delete-login" onClick={() => void run("login")}>
              {busy ? t.deleteWorking : t.deleteLogin}
            </button>
            {owner && orgId ? (
              <form
                className="mt-6 border-t border-line pt-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (nameMatches) void run("business");
                }}
              >
                <p className="text-sm leading-6 text-muted">{t.deleteBusinessHint}</p>
                <label className={`${label} mt-4`}>
                  <span className={labelText}>{t.deleteTypeName}</span>
                  <span className="text-sm font-semibold text-ink">{orgName}</span>
                  <input className={field} value={typed} data-testid="delete-org-name" onChange={(event) => setTyped(event.target.value)} />
                </label>
                <button type="submit" className={`${button.danger} mt-4`} disabled={busy || !nameMatches} data-testid="delete-business">
                  {busy ? t.deleteWorking : t.deleteBusiness}
                </button>
              </form>
            ) : null}
          </>
        ) : null}
        <button type="button" className={`${button.quiet} mt-4`} onClick={onClose}>
          {t.deleteClose}
        </button>
      </div>
    </div>
  );
}
