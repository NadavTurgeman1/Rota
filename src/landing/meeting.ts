export interface MeetingRequest {
  name: string;
  business: string;
  phone: string;
  email: string;
  day: string;
  windowLabel: string;
  note: string;
}

export function meetingReady(input: MeetingRequest): boolean {
  const required = [input.name, input.business, input.phone, input.email, input.day, input.windowLabel];
  return required.every((value) => value.trim().length > 0) && input.email.includes("@");
}

export function meetingBody(input: MeetingRequest): string {
  const lines = [
    "בקשה לקביעת פגישה",
    "",
    `שם: ${input.name.trim()}`,
    `עסק: ${input.business.trim()}`,
    `טלפון: ${input.phone.trim()}`,
    `אימייל: ${input.email.trim()}`,
    `יום מועדף: ${input.day}`,
    `חלון: ${input.windowLabel}`,
  ];
  if (input.note.trim()) {
    lines.push("", "מה חשוב להתאים:", input.note.trim());
  }
  return lines.join("\n");
}

export function meetingMailto(to: string, subject: string, body: string): string {
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const address = to.trim();
  return address ? `mailto:${address}?${query}` : `mailto:?${query}`;
}
