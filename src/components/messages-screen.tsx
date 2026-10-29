import { useMemo, useState } from "react";
import { dayName, type Lang, type RotaState } from "../domain";
import type { ManagerMessage, MessageAudience, MessageDeliver } from "../db/messages";
import { copy } from "../i18n/copy";
import { filterNames } from "../people/names";
import { shiftLabel } from "../schedule/display";
import { button, card, cardHint, cardTitle, field, label, labelText, pill } from "./ui";

export interface MessagesApi {
  refresh: () => Promise<void>;
  send: (draft: {
    body: string;
    audience: MessageAudience;
    deliver: MessageDeliver;
    employeeIds: string[];
    at?: string;
    week?: string;
    shiftId?: string;
    weekday?: number;
  }) => Promise<string | null>;
  remove: (messageId: string) => Promise<string | null>;
}

function dueLabel(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function isDue(iso: string, now: number): boolean {
  return Date.parse(iso) <= now;
}

export function MessagesScreen({
  state,
  lang,
  canWrite,
  messages,
  api,
}: {
  state: RotaState;
  lang: Lang;
  canWrite: boolean;
  messages: ManagerMessage[];
  api: MessagesApi;
}) {
  const t = copy[lang];
  const people = state.emps.filter((employee) => employee.active !== false);
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<MessageAudience>("all");
  const [deliver, setDeliver] = useState<MessageDeliver>("now");
  const [picked, setPicked] = useState<string[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [weekday, setWeekday] = useState(0);
  const [shiftId, setShiftId] = useState(state.biz.shifts[0]?.id ?? "");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const slotKey = `${weekday}|${shiftId}`;
  const onShift = state.sched[state.week]?.assign[slotKey] ?? [];
  const shiftNames = useMemo(
    () => Object.fromEntries(state.biz.shifts.map((shift) => [shift.id, shiftLabel(shift.name, lang)])),
    [state.biz.shifts, lang],
  );
  const shownPeople = useMemo(() => filterNames(people, nameQuery), [people, nameQuery]);
  const needSlot = audience === "shift" || deliver === "shift_start";

  async function send() {
    const text = body.trim();
    if (!text) {
      setError("body");
      return;
    }
    if (audience === "people" && picked.length === 0) {
      setError("empty");
      return;
    }
    if (needSlot && !shiftId) {
      setError("empty");
      return;
    }
    if (deliver === "at" && !at) {
      setError("when");
      return;
    }
    setBusy(true);
    setError(null);
    const code = await api.send({
      body: text,
      audience,
      deliver,
      employeeIds: picked,
      at: deliver === "at" ? at : undefined,
      week: needSlot ? state.week : undefined,
      shiftId: needSlot ? shiftId : undefined,
      weekday: needSlot ? weekday : undefined,
    });
    setBusy(false);
    if (code) {
      setError(code);
      return;
    }
    setBody("");
    setPicked([]);
  }

  return (
    <div data-testid="messages-screen" className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm leading-6 text-muted">{t.messagesHint}</p>

      <section className={card}>
        <h2 className={cardTitle}>{t.messagesCompose}</h2>
        {canWrite ? <p className={cardHint}>{t.messagesEmpty}</p> : <p className={cardHint}>{t.messagesReadOnly}</p>}
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
          <label className={label}>
            <span className={labelText}>{t.messagesBody}</span>
            <textarea
              data-testid="message-body"
              className="min-h-24 w-full rounded-lg border border-field-line bg-card px-3 py-2 text-sm text-ink placeholder:text-subtle hover:border-muted"
              value={body}
              disabled={!canWrite || busy}
              maxLength={4000}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          <div className="flex flex-col gap-4">
            <ChoiceRow
              legend={t.messagesAudience}
              name="message-audience"
              value={audience}
              disabled={!canWrite || busy}
              options={[
                ["all", t.messagesAudienceAll],
                ["people", t.messagesAudiencePeople],
                ["shift", t.messagesAudienceShift],
              ]}
              onChange={setAudience}
            />
            <ChoiceRow
              legend={t.messagesDeliver}
              name="message-deliver"
              value={deliver}
              disabled={!canWrite || busy}
              options={[
                ["now", t.messagesDeliverNow],
                ["at", t.messagesDeliverAt],
                ["shift_start", t.messagesDeliverShift],
              ]}
              onChange={setDeliver}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5">

          {audience === "people" ? (
            <div className="flex flex-col gap-2">
              <input
                aria-label={t.nameSearch}
                data-testid="message-people-search"
                placeholder={t.nameSearch}
                value={nameQuery}
                disabled={!canWrite || busy}
                onChange={(event) => setNameQuery(event.target.value)}
                className={field}
              />
              {people.length === 0 ? <p className="text-sm text-muted">{t.noEmployees}</p> : null}
              {people.length > 0 && shownPeople.length === 0 ? (
                <p className="text-sm text-muted">{t.noNameMatches}</p>
              ) : null}
              <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {shownPeople.map((employee) => (
                  <label key={employee.id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      data-testid={`message-person-${employee.id}`}
                      checked={picked.includes(employee.id)}
                      disabled={!canWrite || busy}
                      onChange={() =>
                        setPicked((current) =>
                          current.includes(employee.id) ? current.filter((id) => id !== employee.id) : [...current, employee.id],
                        )
                      }
                    />
                    {employee.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {needSlot ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                <span className={labelText}>{t.messagesPickShift}</span>
                <select
                  data-testid="message-day"
                  className={field}
                  value={weekday}
                  disabled={!canWrite || busy}
                  onChange={(event) => setWeekday(Number(event.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <option key={day} value={day}>
                      {dayName(day, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                <span className={labelText}>{t.shiftsTitle}</span>
                <select
                  data-testid="message-shift"
                  className={field}
                  value={shiftId}
                  disabled={!canWrite || busy}
                  onChange={(event) => setShiftId(event.target.value)}
                >
                  {state.biz.shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {`${shiftLabel(shift.name, lang)} · ${shift.start}–${shift.end}`}
                    </option>
                  ))}
                </select>
              </label>
              {audience === "shift" ? (
                <p className="sm:col-span-2 text-sm text-muted">
                  {onShift.length
                    ? onShift.map((id) => people.find((employee) => employee.id === id)?.name ?? id).join(" · ")
                    : t.messagesNoRecipients}
                </p>
              ) : null}
            </div>
          ) : null}

          {deliver === "at" ? (
            <label className={label}>
              <span className={labelText}>{t.messagesWhen}</span>
              <input
                type="datetime-local"
                data-testid="message-at"
                className={field}
                value={at}
                disabled={!canWrite || busy}
                onChange={(event) => setAt(event.target.value)}
              />
            </label>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger-text">
              {error === "body" || error === "bodyNeeded"
                ? t.messagesBodyNeeded
                : error === "empty"
                  ? t.messagesNoRecipients
                  : t.messagesFailed}
            </p>
          ) : null}

          <button type="button" data-testid="message-send" className={`${button.primary} self-start`} disabled={!canWrite || busy} onClick={() => void send()}>
            {busy ? t.messagesSending : t.messagesSend}
          </button>
        </div>
      </section>

      <section className={card}>
        <h2 className={cardTitle}>{t.navMessages}</h2>
        {messages.length === 0 ? <p className={cardHint}>{t.messagesNone}</p> : <p className={cardHint}>{t.messagesReadCount(messages.reduce((sum, row) => sum + row.readCount, 0), messages.reduce((sum, row) => sum + row.recipientCount, 0))}</p>}
        <ul className="mt-4 flex flex-col gap-3">
          {messages.map((message) => {
            const due = isDue(message.dueAt, now);
            return (
              <li key={message.id} data-testid={`message-row-${message.id}`} className="rounded-xl border border-line bg-well/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`${pill} ${due ? "bg-ok-soft text-ok-text" : "bg-warn-soft text-warn-text"}`}>
                        {due ? t.messagesSent : t.messagesScheduled}
                      </span>
                      <span className="text-xs text-muted">{dueLabel(message.dueAt, lang)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{message.body}</p>
                    <p className="mt-2 text-xs text-muted">
                      {t.messagesFrom(message.authorName)}
                      {message.weekday != null && message.shiftId
                        ? ` · ${dayName(message.weekday, lang)} ${shiftNames[message.shiftId] ?? ""}`
                        : ""}
                      {` · ${t.messagesReadCount(message.readCount, message.recipientCount)}`}
                    </p>
                    {message.recipients.length > 0 ? (
                      <p className="mt-1 text-xs text-muted">{message.recipients.map((row) => row.name).join(" · ")}</p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <button
                      type="button"
                      className={button.small}
                      data-testid={`message-delete-${message.id}`}
                      onClick={() => void api.remove(message.id)}
                    >
                      {t.messagesDelete}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ChoiceRow<T extends string>({
  legend,
  name,
  value,
  disabled,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  disabled: boolean;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={labelText}>{legend}</span>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-1.5">
        {options.map(([id, text]) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              name={name}
              aria-checked={selected}
              data-testid={`${name}-${id}`}
              disabled={disabled}
              className={`h-8 rounded-lg border px-3 text-xs font-medium disabled:opacity-50 ${
                selected ? "border-brand bg-brand-soft text-ink" : "border-line bg-card text-ink-soft hover:bg-well"
              }`}
              onClick={() => onChange(id)}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
