import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Backend tests (tests/server/**) share one real Postgres instance and
    // mutate shared tables (users, roster, sessions) in beforeEach/test
    // bodies — running test files in parallel races those mutations across
    // files. The suite is small (well under a second serial), so disabling
    // file parallelism costs nothing measurable and removes a whole class
    // of nondeterministic failures.
    fileParallelism: false,
  },
})
