import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globals: true,
    testTimeout: 60000,
    hookTimeout: 30000,
    // Run integration tests sequentially — they share browser/ffmpeg resources
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
