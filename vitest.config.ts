import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Each database test boots PGlite and replays every migration, which is slow when files run in parallel.
    testTimeout: 30_000,
  },
});
