import { useEffect, useState } from "react";

/** False until the server says a provider is configured. A failed check keeps the model off. */
export function useAiEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/ai/status")
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .then((body: { enabled?: unknown }) => {
        if (live) setEnabled(body.enabled === true);
      })
      .catch(() => {
        if (live) setEnabled(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
