import { useState } from "react";
import type { Lang } from "../domain";
import type { ManagerMessage } from "../db/messages";
import { copy } from "../i18n/copy";
import { button, card, cardHint, cardTitle } from "./ui";

function dueLabel(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.2" y="5" width="13.6" height="10" rx="1.4" />
      <path d="M4 6.2 10 11l6-4.8" />
    </svg>
  );
}

export function StaffEnvelopeButton({
  lang,
  unread,
  open,
  onToggle,
}: {
  lang: Lang;
  unread: number;
  open: boolean;
  onToggle: () => void;
}) {
  const t = copy[lang];
  return (
    <button
      type="button"
      data-testid="staff-messages"
      aria-label={t.messagesInbox}
      aria-expanded={open}
      className={`${button.icon} relative`}
      onClick={onToggle}
    >
      <EnvelopeIcon />
      {unread > 0 ? (
        <span data-testid="staff-messages-badge" className="absolute -top-1 -end-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-on-brand">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}

export function StaffMessageInbox({
  lang,
  messages,
  onClose,
}: {
  lang: Lang;
  messages: ManagerMessage[];
  onClose: () => void;
}) {
  const t = copy[lang];
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-4 sm:place-items-center" data-testid="staff-message-inbox">
      <div className={`${card} flex max-h-[80dvh] w-full max-w-md flex-col`} role="dialog" aria-modal="true" aria-labelledby="staff-inbox-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="staff-inbox-title" className={cardTitle}>
              {t.messagesInbox}
            </h2>
            <p className={cardHint}>{messages.length === 0 ? t.messagesInboxEmpty : t.messagesUnread(messages.filter((row) => !row.readAt).length)}</p>
          </div>
          <button type="button" className={button.small} data-testid="staff-inbox-close" onClick={onClose}>
            {t.messagesCloseInbox}
          </button>
        </div>
        <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {messages.map((message) => (
            <li key={message.id} data-testid={`staff-message-${message.id}`} className={`rounded-xl border border-line p-3 ${message.readAt ? "bg-card" : "bg-brand-soft"}`}>
              <p className="text-xs text-muted">
                {t.messagesFrom(message.authorName)} · {dueLabel(message.dueAt, lang)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{message.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function StaffMessagePopup({
  lang,
  message,
  onClose,
}: {
  lang: Lang;
  message: ManagerMessage;
  onClose: () => Promise<boolean>;
}) {
  const t = copy[lang];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-message-title"
        data-testid="staff-message-popup"
        className={`${card} w-full max-w-md`}
      >
        <h2 id="manager-message-title" className={cardTitle}>
          {t.messagesPopupTitle}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {t.messagesFrom(message.authorName)} · {dueLabel(message.dueAt, lang)}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{message.body}</p>
        {failed ? (
          <p role="alert" className="mt-2 text-sm text-danger-text">
            {t.saveFailed}
          </p>
        ) : null}
        <button
          type="button"
          data-testid="staff-message-popup-ok"
          className={`${button.primary} mt-4`}
          disabled={busy}
          autoFocus
          onClick={() => {
            setBusy(true);
            setFailed(false);
            void onClose().then((ok) => {
              if (!ok) {
                setFailed(true);
                setBusy(false);
              }
            });
          }}
        >
          {t.messagesPopupOk}
        </button>
      </div>
    </div>
  );
}
