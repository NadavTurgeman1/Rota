export type SaveResult = "ok" | "retry" | "stop";

/**
 * One cloud write at a time. A newer snapshot waits.
 * An older request is never sent again after a newer one has been queued,
 * including when the newer snapshot is the copy the server already had.
 */
export function createSaveQueue(send: (json: string, signal: AbortSignal) => Promise<SaveResult>) {
  let acked = "";
  let pending: string | null = null;
  let running = false;
  let dirtyServer = false;
  let abort: AbortController | null = null;

  async function drain(): Promise<void> {
    if (running) return;
    running = true;
    try {
      while (pending !== null && (pending !== acked || dirtyServer)) {
        const json = pending;
        pending = null;
        abort?.abort();
        const controller = new AbortController();
        abort = controller;
        let result: SaveResult;
        try {
          result = await send(json, controller.signal);
        } catch {
          result = controller.signal.aborted ? "stop" : "retry";
        }
        if (controller.signal.aborted) return;
        if (result !== "ok") {
          if (pending === null) pending = json;
          return;
        }
        if (pending === null) {
          acked = json;
          dirtyServer = false;
        } else {
          dirtyServer = true;
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    /** The loaded workspace already matches the server, so it must not be written back. */
    noteSaved(json: string) {
      abort?.abort();
      abort = null;
      acked = json;
      pending = null;
      dirtyServer = false;
    },
    push(json: string) {
      pending = json;
    },
    kick() {
      void drain();
    },
  };
}
