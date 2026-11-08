"use client";

import { useState, type FormEvent } from "react";
import { landingConfig as config } from "../../landing/config";
import { meetingBody, meetingMailto, meetingReady, type MeetingRequest } from "../../landing/meeting";
import { Section, SectionHeading } from "./chrome";

const fieldClass = "h-12 w-full min-w-0 max-w-full rounded-xl border border-field-line bg-card px-3 text-base text-ink";

export function Meeting() {
  const meeting = config.meeting;
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [day, setDay] = useState("");
  const [windowId, setWindowId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const windowLabel = meeting.windows.find((item) => item.id === windowId)?.label ?? "";
    const request: MeetingRequest = { name, business, phone, email, day, windowLabel, note };
    if (!meetingReady(request)) {
      setError(true);
      setSent(false);
      return;
    }
    const subject = meeting.subject.replaceAll("{name}", config.name);
    window.location.href = meetingMailto(meeting.to, subject, meetingBody(request));
    setError(false);
    setSent(true);
  }

  return (
    <Section id="meeting" className="bg-paper">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionHeading eyebrow={meeting.eyebrow} title={meeting.title} text={meeting.text} />
        <form className="min-w-0 max-w-full rounded-3xl border border-line bg-card p-5 shadow-card sm:p-6" onSubmit={submit} noValidate>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field id="meeting-name" label={meeting.name} autoComplete="name" value={name} onChange={setName} />
            <Field id="meeting-business" label={meeting.business} autoComplete="organization" value={business} onChange={setBusiness} />
            <Field id="meeting-phone" label={meeting.phone} autoComplete="tel" dir="ltr" value={phone} onChange={setPhone} />
            <Field id="meeting-email" label={meeting.email} autoComplete="email" type="email" dir="ltr" value={email} onChange={setEmail} />
            <Field id="meeting-day" label={meeting.day} type="date" dir="ltr" value={day} onChange={setDay} min={todayIso()} />
            <fieldset className="min-w-0 max-w-full sm:col-span-2">
              <legend className="text-sm font-medium text-ink">{meeting.window}</legend>
              <div className="mt-2 flex w-full min-w-0 flex-wrap gap-2">
                {meeting.windows.map((item) => {
                  const selected = windowId === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`inline-flex h-12 max-w-full shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold ${selected ? "border-brand bg-brand-soft text-brand-text" : "border-line text-ink"}`}
                    >
                      <input
                        type="radio"
                        name="meeting-window"
                        value={item.id}
                        checked={selected}
                        className="h-5 w-5"
                        onChange={() => {
                          setWindowId(item.id);
                          setError(false);
                        }}
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label htmlFor="meeting-note" className="flex min-w-0 max-w-full flex-col gap-2 text-sm font-medium text-ink sm:col-span-2">
              {meeting.note}
              <textarea
                id="meeting-note"
                value={note}
                placeholder={meeting.notePlaceholder}
                rows={3}
                className="w-full min-w-0 max-w-full rounded-xl border border-field-line bg-card px-3 py-3 text-base text-ink"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger-text">
              {meeting.missing}
            </p>
          ) : null}
          {sent ? (
            <p role="status" className="mt-4 text-sm leading-6 text-ink">
              {meeting.to.trim() ? meeting.sent : meeting.sentNoInbox}
            </p>
          ) : null}
          <button type="submit" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-on-brand hover:bg-brand-hover sm:w-auto">
            {meeting.cta}
          </button>
        </form>
      </div>
    </Section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  dir,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  dir?: "ltr";
  min?: string;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 max-w-full flex-col gap-2 text-sm font-medium text-ink">
      {label}
      <input
        id={id}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        min={min}
        value={value}
        className={type === "date" ? `${fieldClass} landing-date` : dir === "ltr" ? `${fieldClass} text-end` : fieldClass}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
