import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "../domain";
import { confirmDeleteForm, copy } from "../i18n/copy";
import type { EmployeeFormRecord } from "../people/forms";
import { FORM_BYTE_LIMIT, FORM_COUNT_LIMIT, formContentType, formFileName } from "../people/forms";
import { button, card, cardHint, cardTitle } from "./ui";

export interface EmployeeFormsApi {
  list: (employeeId: string) => Promise<EmployeeFormRecord[] | string>;
  upload: (employeeId: string, file: File) => Promise<EmployeeFormRecord | string>;
  open: (id: string) => Promise<{ blob: Blob; name: string; type: string } | string>;
  remove: (id: string) => Promise<true | string>;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx";

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function noteText(lang: Lang, code: string): string {
  const t = copy[lang];
  if (code === "size") return t.employeeFormsTooBig;
  if (code === "type") return t.employeeFormsType;
  if (code === "full") return t.employeeFormsFull;
  return t.employeeFormsFailed;
}

export function EmployeeForms({
  employeeId,
  lang,
  canWrite,
  api,
}: {
  employeeId: string;
  lang: Lang;
  canWrite: boolean;
  api: EmployeeFormsApi;
}) {
  const t = copy[lang];
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [forms, setForms] = useState<EmployeeFormRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setForms(null);
    setNote(null);
    void api.list(employeeId).then((result) => {
      if (controller.signal.aborted) return;
      if (typeof result === "string") {
        setForms([]);
        setNote(result);
        return;
      }
      setForms(result);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setForms([]);
      setNote("failed");
    });
    return () => controller.abort();
  }, [api, employeeId]);

  useEffect(() => {
    if (!preview) return;
    dialog.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closePreview();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  function closePreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function upload(list: FileList | null) {
    const files = [...(list ?? [])];
    if (input.current) input.current.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setNote(null);
    let next = forms ?? [];
    try {
      for (const file of files) {
        const result = await api.upload(employeeId, file);
        if (typeof result === "string") {
          setNote(result);
          break;
        }
        next = [result, ...next.filter((item) => item.id !== result.id)];
        setForms(next);
      }
    } catch {
      setNote("failed");
    }
    setBusy(false);
  }

  async function view(form: EmployeeFormRecord) {
    setNote(null);
    try {
      const result = await api.open(form.id);
      if (typeof result === "string") {
        setNote(result);
        return;
      }
      closePreview();
      setPreview({ url: URL.createObjectURL(result.blob), name: result.name, type: result.type });
    } catch {
      setNote("failed");
    }
  }

  async function remove(form: EmployeeFormRecord) {
    if (!window.confirm(confirmDeleteForm(lang, form.name))) return;
    setNote(null);
    try {
      const result = await api.remove(form.id);
      if (result !== true) {
        setNote(typeof result === "string" ? result : "failed");
        return;
      }
      setForms((current) => (current ?? []).filter((item) => item.id !== form.id));
    } catch {
      setNote("failed");
    }
  }

  const shown = forms ?? [];
  return (
    <section data-testid="employee-forms" className={card} aria-busy={forms === null || busy}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cardTitle}>{t.employeeForms}</h2>
          <p className={cardHint}>{t.employeeFormsHint}</p>
        </div>
        {canWrite ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              data-testid="employee-forms-input"
              onChange={(event) => void upload(event.target.files)}
            />
            <button
              type="button"
              data-testid="employee-forms-upload"
              className={button.primary}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? t.employeeFormsUploading : t.employeeFormsUpload}
            </button>
          </>
        ) : null}
      </div>
      {note ? (
        <p role="alert" className="mt-3 text-sm leading-6 text-danger-text">
          {noteText(lang, note)}
        </p>
      ) : null}
      {forms === null ? <p className="mt-4 text-sm text-muted">{t.employeeFormsLoading}</p> : null}
      {forms && shown.length === 0 ? <p className="mt-4 text-sm text-muted">{t.employeeFormsEmpty}</p> : null}
      {shown.length > 0 ? (
        <ul className="mt-4">
          {shown.map((form) => (
            <li key={form.id} className="flex items-center justify-between gap-3 border-t border-line py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  <bdi>{form.name}</bdi>
                </p>
                <p className="text-xs leading-5 text-muted">
                  <bdi dir="ltr">
                    {sizeLabel(form.bytes)} · {new Date(form.addedAt).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB")}
                  </bdi>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" data-testid={`employee-forms-view-${form.id}`} className={button.small} onClick={() => void view(form)}>
                  {t.employeeFormsView}
                </button>
                {canWrite ? (
                  <button type="button" data-testid={`employee-forms-delete-${form.id}`} className={`${button.small} text-danger-text`} onClick={() => void remove(form)}>
                    {t.employeeFormsDelete}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {preview
        ? createPortal(
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
              onClick={closePreview}
            >
              <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="employee-forms-preview-title"
                tabIndex={-1}
                data-testid="employee-forms-preview"
                className={`${card} pop-in pop-in-center flex min-h-0 max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-y-auto outline-none`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 id="employee-forms-preview-title" className={`${cardTitle} min-w-0 break-words`}>
                    <bdi>{preview.name}</bdi>
                  </h2>
                  <div className="flex shrink-0 gap-2">
                    <a href={preview.url} download={preview.name} className={button.quiet}>
                      {t.employeeFormsDownload}
                    </a>
                    <button type="button" className={button.primary} onClick={closePreview}>
                      {t.employeeFormsClose}
                    </button>
                  </div>
                </div>
                {preview.type.startsWith("image/") ? (
                  <img src={preview.url} alt={preview.name} className="mt-4 max-h-[70vh] w-full object-contain" />
                ) : preview.type === "application/pdf" ? (
                  <iframe title={preview.name} src={preview.url} className="mt-4 h-[70vh] w-full rounded-lg border border-line bg-card" />
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted">{t.employeeFormsOpenHint}</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

type HeldForm = { record: EmployeeFormRecord; blob: Blob };

export function memoryEmployeeForms(store: { current: Map<string, HeldForm[]> }): EmployeeFormsApi {
  return {
    async list(employeeId) {
      return (store.current.get(employeeId) ?? []).map((item) => item.record);
    },
    async upload(employeeId, file) {
      const name = formFileName(file.name);
      const type = formContentType(name, file.type);
      if (!name || !type) return "type";
      if (file.size < 1 || file.size > FORM_BYTE_LIMIT) return "size";
      const current = store.current.get(employeeId) ?? [];
      if (current.length >= FORM_COUNT_LIMIT) return "full";
      const record: EmployeeFormRecord = {
        id: crypto.randomUUID(),
        name,
        type,
        bytes: file.size,
        addedAt: new Date().toISOString(),
      };
      store.current.set(employeeId, [{ record, blob: file }, ...current]);
      return record;
    },
    async open(id) {
      for (const files of store.current.values()) {
        const found = files.find((item) => item.record.id === id);
        if (found) return { blob: found.blob, name: found.record.name, type: found.record.type };
      }
      return "failed";
    },
    async remove(id) {
      for (const [employeeId, files] of store.current) {
        if (!files.some((item) => item.record.id === id)) continue;
        store.current.set(
          employeeId,
          files.filter((item) => item.record.id !== id),
        );
        return true;
      }
      return "failed";
    },
  };
}

export function remoteEmployeeForms(headers: () => HeadersInit): EmployeeFormsApi {
  return {
    async list(employeeId) {
      const response = await fetch(`/api/employee-forms?employeeId=${encodeURIComponent(employeeId)}`, { headers: headers() });
      const body = (await response.json().catch(() => null)) as { forms?: EmployeeFormRecord[] } | null;
      if (!response.ok || !body?.forms) return "failed";
      return body.forms;
    },
    async upload(employeeId, file) {
      const name = formFileName(file.name);
      const type = formContentType(name, file.type);
      if (!name || !type) return "type";
      if (file.size < 1 || file.size > FORM_BYTE_LIMIT) return "size";
      const data = new FormData();
      data.set("employeeId", employeeId);
      data.set("file", file);
      const response = await fetch("/api/employee-forms", { method: "POST", headers: headers(), body: data });
      const body = (await response.json().catch(() => null)) as { form?: EmployeeFormRecord; error?: string } | null;
      if (!response.ok || !body?.form) return body?.error === "size" || body?.error === "type" || body?.error === "full" ? body.error : "failed";
      return body.form;
    },
    async open(id) {
      const response = await fetch(`/api/employee-forms?formId=${encodeURIComponent(id)}`, { headers: headers() });
      if (!response.ok) return "failed";
      const blob = await response.blob();
      const type = response.headers.get("content-type") || blob.type;
      const encoded = /filename\*=UTF-8''([^;]+)/i.exec(response.headers.get("content-disposition") ?? "")?.[1];
      const name = encoded ? decodeURIComponent(encoded) : "form";
      return { blob, name, type };
    },
    async remove(id) {
      const response = await fetch(`/api/employee-forms?formId=${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
      return response.ok ? true : "failed";
    },
  };
}
