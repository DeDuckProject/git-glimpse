import { defineConfig } from 'vitest/config';
import { readFileSync, existsSync } from 'node:fs';

function loadDotenv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync('.env')) return env;
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const match = line.match(/^([^#\s][^=]*)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

export default defineConfig({
  test: {
    include: ['tests/integration/llm-*.test.ts'],
    globals: true,
    testTimeout: 120000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: loadDotenv(),
  },
});
