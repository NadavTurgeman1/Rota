import { describe, expect, it } from "vitest";
import { createSaveQueue, keepaliveFits, type SaveResult } from "./save-queue";

describe("keepaliveFits", () => {
  it("drops keepalive for a body the browser would reject before sending", () => {
    expect(keepaliveFits(JSON.stringify({ a: "x".repeat(1000) }))).toBe(true);
    expect(keepaliveFits(JSON.stringify({ a: "x".repeat(70 * 1024) }))).toBe(false);
    expect(keepaliveFits(JSON.stringify({ a: "ש".repeat(35 * 1024) }))).toBe(false);
  });
});

describe("createSaveQueue", () => {
  it("sends a newer snapshot after the one already in flight, and does not send the old one again", async () => {
    const sent: string[] = [];
    let release = () => {};
    const queue = createSaveQueue(async (json) => {
      sent.push(json);
      if (sent.length === 1) await new Promise<void>((resolve) => { release = resolve; });
      return "ok";
    });
    queue.noteSaved("A");
    queue.push("B");
    queue.kick();
    queue.push("C");
    release();
    await settle();
    expect(sent).toEqual(["B", "C"]);
  });

  it("writes an undo back when it returns to the last acknowledged snapshot", async () => {
    const sent: string[] = [];
    let release = () => {};
    const queue = createSaveQueue(async (json) => {
      sent.push(json);
      if (sent.length === 1) await new Promise<void>((resolve) => { release = resolve; });
      return "ok";
    });
    queue.noteSaved("A");
    queue.push("B");
    queue.kick();
    queue.push("A");
    release();
    await settle();
    expect(sent).toEqual(["B", "A"]);
  });

  it("keeps the failed snapshot for a later kick instead of starting a second request", async () => {
    const sent: string[] = [];
    const queue = createSaveQueue(async (json): Promise<SaveResult> => {
      sent.push(json);
      return "retry";
    });
    queue.noteSaved("A");
    queue.push("B");
    queue.kick();
    await settle();
    expect(sent).toEqual(["B"]);
    queue.kick();
    await settle();
    expect(sent).toEqual(["B", "B"]);
  });
});

async function settle(): Promise<void> {
  for (let step = 0; step < 8; step += 1) await Promise.resolve();
}
