/** Enough to check a wrong suggestion later: the lines sent, what came back, and what was dropped. No roster, no contacts. */
export interface AiLogEntry {
  at: string;
  task: "constraints" | "explain";
  provider: string;
  model: string;
  ms: number;
  ok: boolean;
  input: string[];
  output: string;
  kept: number;
  dropped: number;
  error?: string;
}

const LIMIT = 100;
const OUTPUT_LIMIT = 2000;
const entries: AiLogEntry[] = [];

export function recordAi(entry: AiLogEntry, sink: (line: string) => void = console.info): void {
  const trimmed = { ...entry, output: entry.output.slice(0, OUTPUT_LIMIT) };
  entries.push(trimmed);
  if (entries.length > LIMIT) entries.shift();
  sink(`[rota-ai] ${JSON.stringify(trimmed)}`);
}

export function recentAi(): readonly AiLogEntry[] {
  return entries;
}
