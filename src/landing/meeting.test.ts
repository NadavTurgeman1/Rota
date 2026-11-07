import { describe, expect, it } from "vitest";
import { meetingBody, meetingMailto, meetingReady } from "./meeting";

const ready = {
  name: "מאיה",
  business: "מלון כרמל",
  phone: "0500000000",
  email: "maya@example.com",
  day: "2026-11-12",
  windowLabel: "בוקר",
  note: "",
};

describe("meeting request", () => {
  it("needs a name, a business, a way to reply, a day, and a window", () => {
    expect(meetingReady(ready)).toBe(true);
    expect(meetingReady({ ...ready, email: "not-an-email" })).toBe(false);
    expect(meetingReady({ ...ready, windowLabel: " " })).toBe(false);
  });

  it("puts the request in a mail link", () => {
    const body = meetingBody({ ...ready, note: "שני אתרים" });
    expect(body).toContain("עסק: מלון כרמל");
    expect(body).toContain("מה חשוב להתאים:");
    expect(body).toContain("שני אתרים");
    expect(meetingMailto("hello@example.com", "פגישה", body)).toContain("mailto:hello@example.com?subject=");
    expect(meetingMailto("", "פגישה", body).startsWith("mailto:?subject=")).toBe(true);
  });
});
