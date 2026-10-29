import { useRef, useState } from "react";
import type { Lang } from "../domain";
import type { AbsenceKind } from "../domain/absence";
import type { AbsenceRequest } from "../db/absences";
import { copy } from "../i18n/copy";
import { formatCalendarDate } from "../schedule/display";
import { AbsenceCalendar } from "./absence-calendar";
import { button, card, cardHint, cardTitle, label, labelText, pill, select } from "./ui";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx";

export interface AbsencesApi {
  refresh: () => Promise<void>;
  create: (input: {
    kind: AbsenceKind;
    start: string;
    end: string;
    note: string;
    employeeId?: string;
    files: File[];
  }) => Promise<string | null>;
  decide: (requestId: string, approve: boolean) => Promise<string | null>;
  remove: (requestId: string) => Promise<string | null>;
  openFile: (fileId: string) => Promise<string | null>;
}

function kindLabel(lang: Lang, kind: AbsenceKind): string {
  const t = copy[lang];
  return kind === "sick" ? t.absenceSick : t.absenceVacation;
}

function statusLabel(lang: Lang, status: AbsenceRequest["status"]): string {
  const t = copy[lang];
  if (status === "approved") return t.absencesApproved;
  if (status === "rejected") return t.absencesRejected;
  if (status === "cancelled") return t.absencesCancelled;
  return t.absencesPending;
}

function statusTone(status: AbsenceRequest["status"]): string {
  if (status === "approved") return "bg-ok-soft text-ok-text";
  if (status === "rejected") return "bg-danger-soft text-danger-text";
  if (status === "cancelled") return "bg-well text-muted";
  return "bg-warn-soft text-warn-text";
}

function errorText(lang: Lang, code: string): string {
  const t = copy[lang];
  if (code === "overlap") return t.absencesOverlap;
  if (code === "when") return t.absencesWhen;
  if (code === "size") return t.employeeFormsTooBig;
  if (code === "type") return t.employeeFormsType;
  return t.absencesFailed;
}

function AbsenceForm({
  lang,
  canWrite,
  people,
  api,
}: {
  lang: Lang;
  canWrite: boolean;
  people?: { id: string; name: string }[];
  api: AbsencesApi;
}) {
  const t = copy[lang];
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AbsenceKind>("sick");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [employeeId, setEmployeeId] = useState(people?.[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!start || !end || end < start) {
      setError("when");
      return;
    }
    setBusy(true);
    setError(null);
    const code = await api.create({
      kind,
      start,
      end,
      note,
      employeeId: people ? employeeId : undefined,
      files: kind === "sick" ? files : [],
    });
    setBusy(false);
    if (code) {
      setError(code);
      return;
    }
    setNote("");
    setFiles([]);
    if (input.current) input.current.value = "";
  }

  return (
    <section className={card}>
      <h2 className={cardTitle}>{people ? t.absencesRecord : t.absencesSend}</h2>
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]">
        <AbsenceCalendar
          lang={lang}
          start={start}
          end={end}
          disabled={!canWrite || busy}
          onChange={(range) => {
            setStart(range.start);
            setEnd(range.end);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {people ? (
            <label className={label}>
              <span className={labelText}>{t.absencesPerson}</span>
              <select className={select} data-testid="absence-employee" value={employeeId} disabled={!canWrite || busy} onChange={(event) => setEmployeeId(event.target.value)}>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={label}>
            <span className={labelText}>{t.absencesKind}</span>
            <select
              className={select}
              data-testid="absence-kind"
              value={kind}
              disabled={!canWrite || busy}
              onChange={(event) => {
                const next = event.target.value as AbsenceKind;
                setKind(next);
                if (next !== "sick") {
                  setFiles([]);
                  if (input.current) input.current.value = "";
                }
              }}
            >
              <option value="sick">{t.absenceSick}</option>
              <option value="vacation">{t.absenceVacation}</option>
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            <span className={labelText}>{t.absencesNote}</span>
            <textarea
              data-testid="absence-note"
              className="min-h-20 w-full rounded-lg border border-field-line bg-card px-3 py-2 text-sm text-ink"
              value={note}
              disabled={!canWrite || busy}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {kind === "sick" ? (
            <div className="sm:col-span-2 flex flex-col gap-2">
              <span className={labelText}>{t.absencesFiles}</span>
              <p className="text-xs leading-5 text-muted">{t.absencesFilesHint}</p>
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                multiple
                tabIndex={-1}
                data-testid="absence-files"
                disabled={!canWrite || busy}
                className="sr-only"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 8))}
              />
              <button
                type="button"
                data-testid="absence-upload"
                className={`${button.quiet} self-start`}
                disabled={!canWrite || busy}
                onClick={() => input.current?.click()}
              >
                {t.absencesUpload}
              </button>
              {files.length > 0 ? <p className="text-xs text-muted">{files.map((file) => file.name).join(" · ")}</p> : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="sm:col-span-2 text-sm text-danger-text">
              {errorText(lang, error)}
            </p>
          ) : null}
          <button type="button" data-testid="absence-send" className={`${button.primary} self-start sm:col-span-2`} disabled={!canWrite || busy} onClick={() => void send()}>
            {busy ? t.absencesSending : people ? t.absencesRecord : t.absencesSend}
          </button>
        </div>
      </div>
    </section>
  );
}

function AbsenceList({
  lang,
  requests,
  manager,
  canWrite,
  api,
}: {
  lang: Lang;
  requests: AbsenceRequest[];
  manager: boolean;
  canWrite: boolean;
  api: AbsencesApi;
}) {
  const t = copy[lang];
  return (
    <section className={card}>
      <h2 className={cardTitle}>{t.navAbsences}</h2>
      {requests.length === 0 ? <p className={cardHint}>{t.absencesNone}</p> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {requests.map((row) => (
          <li key={row.id} data-testid={`absence-row-${row.id}`} className="rounded-xl border border-line bg-well/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`${pill} ${statusTone(row.status)}`}>{statusLabel(lang, row.status)}</span>
                  <span className="text-sm font-medium text-ink">{kindLabel(lang, row.kind)}</span>
                  <span className="text-sm text-muted">
                    {row.start === row.end
                      ? formatCalendarDate(row.start)
                      : `${formatCalendarDate(row.start)} – ${formatCalendarDate(row.end)}`}
                  </span>
                </div>
                {manager ? <p className="mt-1 text-sm text-ink">{row.employeeName}</p> : null}
                {row.note ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{row.note}</p> : null}
                {row.files.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={button.small}
                        data-testid={`absence-file-${file.id}`}
                        onClick={() => void api.openFile(file.id)}
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {manager && row.status === "open" ? (
                  <>
                    <button type="button" className={button.primary} data-testid={`absence-approve-${row.id}`} onClick={() => void api.decide(row.id, true)}>
                      {t.absencesApprove}
                    </button>
                    <button type="button" className={button.small} data-testid={`absence-reject-${row.id}`} onClick={() => void api.decide(row.id, false)}>
                      {t.absencesReject}
                    </button>
                  </>
                ) : null}
                {canWrite ? (
                  <button type="button" className={button.small} data-testid={`absence-delete-${row.id}`} onClick={() => void api.remove(row.id)}>
                    {t.absencesDelete}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AbsenceScreen({
  lang,
  canWrite,
  manager,
  requests,
  people,
  api,
}: {
  lang: Lang;
  canWrite: boolean;
  manager: boolean;
  requests: AbsenceRequest[];
  people?: { id: string; name: string }[];
  api: AbsencesApi;
}) {
  const t = copy[lang];
  return (
    <div data-testid="absences-screen" className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm leading-6 text-muted">{manager ? t.absencesHint : t.absencesStaffHint}</p>
      {canWrite ? <AbsenceForm lang={lang} canWrite={canWrite} people={manager ? people : undefined} api={api} /> : null}
      <AbsenceList lang={lang} requests={requests} manager={manager} canWrite={canWrite} api={api} />
    </div>
  );
}
