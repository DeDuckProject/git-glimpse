import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startTestServer, type TestServer } from './fixtures/server.js';
import { runPipeline } from '../../packages/core/src/pipeline.js';
import { VIRTUAL_TRYON_DIFF } from './fixtures/virtual-tryon-diff.js';
import type { GitGlimpseConfig } from '../../packages/core/src/config/schema.js';

const HAS_API_KEY = !!process.env['ANTHROPIC_API_KEY'];

let server: TestServer;
let outputDir: string;

beforeAll(async () => {
  server = await startTestServer();
  outputDir = join(tmpdir(), `git-glimpse-llm-test-${Date.now()}`);
}, 15000);

afterAll(async () => {
  if (server) await server.close();
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

const config: GitGlimpseConfig = {
  app: {},
  // Map the diff's file path to / so the LLM navigates to the test server root
  routeMap: {
    'src/app/products/page.tsx': '/',
  },
  recording: {
    viewport: { width: 1280, height: 720 },
    format: 'gif',
    maxDuration: 30,
    deviceScaleFactor: 1,
  },
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  },
};

describe.skipIf(!HAS_API_KEY)('LLM pipeline (real Anthropic + Playwright + FFmpeg)', () => {
  it('generates a working demo GIF from a fixture diff', async () => {
    const result = await runPipeline({
      diff: VIRTUAL_TRYON_DIFF,
      baseUrl: server.url,
      outputDir,
      config,
    });

    // LLM produced a meaningful analysis
    expect(result.analysis.changeDescription).toBeTruthy();
    expect(result.analysis.suggestedDemoFlow).toBeTruthy();
    expect(result.analysis.changedFiles).toContain('src/app/products/page.tsx');

    // LLM produced a structurally valid script
    expect(result.script).toContain('export async function demo');
    expect(result.script).toContain('page');

    // Attempt count is within retry budget
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.attempts).toBeLessThanOrEqual(3);

    if (!result.success) {
      // Surface LLM/Playwright errors to make failures easy to diagnose
      console.error('Pipeline errors:', result.errors);
      console.error('Generated script:\n', result.script);
    }

    // Full pipeline succeeded — GIF was recorded
    expect(result.success).toBe(true);
    expect(result.recording).toBeDefined();
    expect(result.recording!.path).toMatch(/\.gif$/);
    expect(existsSync(result.recording!.path)).toBe(true);
    expect(result.recording!.sizeMB).toBeGreaterThan(0);
    expect(result.recording!.sizeMB).toBeLessThan(10);
    expect(result.recording!.duration).toBeGreaterThan(0);
    expect(result.recording!.duration).toBeLessThan(30);
  }, 120000);
});
