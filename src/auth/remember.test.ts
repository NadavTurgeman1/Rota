import { describe, expect, it } from "vitest";
import { readAuthItem, rememberOn } from "./remember";

describe("remember me", () => {
  it("stays on unless the visitor turned it off", () => {
    expect(rememberOn(null)).toBe(true);
    expect(rememberOn("1")).toBe(true);
    expect(rememberOn("0")).toBe(false);
  });

  it("reads the session from the store that matches the choice", () => {
    expect(readAuthItem(true, "local-session", null)).toBe("local-session");
    expect(readAuthItem(false, "local-session", "tab-session")).toBe("tab-session");
    expect(readAuthItem(false, "local-session", null)).toBe("local-session");
  });
});
