import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startTestServer, type TestServer } from './fixtures/server.js';
import { demo as demoFn } from './fixtures/demo-script.js';
import { runScriptAndRecord } from '../../packages/core/src/recorder/playwright-runner.js';
import { postProcess } from '../../packages/core/src/recorder/post-processor.js';

// The script as a string — as it would come from the LLM
const DEMO_SCRIPT = `
import type { Page } from '@playwright/test';

export async function demo(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  await page.click('#add-to-cart');
  await page.waitForTimeout(400);
  await page.click('#add-to-cart');
  await page.waitForTimeout(600);

  await page.click('#try-on-btn');
  await page.waitForSelector('#modal.open', { state: 'visible' });
  await page.waitForTimeout(800);

  await page.click('#close-modal');
  await page.waitForTimeout(400);
}
`;

const RECORDING_CONFIG = {
  viewport: { width: 1280, height: 720 },
  format: 'gif' as const,
  maxDuration: 30,
  deviceScaleFactor: 1,
};

let server: TestServer;
let outputDir: string;

beforeAll(async () => {
  server = await startTestServer();
  outputDir = join(tmpdir(), `git-glimpse-test-${Date.now()}`);
}, 15000);

afterAll(async () => {
  await server.close();
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

describe('Playwright recorder', () => {
  it('records a webm video from the demo script', async () => {
    const result = await runScriptAndRecord({
      script: DEMO_SCRIPT,
      baseUrl: server.url,
      recording: RECORDING_CONFIG,
      outputDir,
    });

    expect(result.videoPath).toMatch(/\.webm$/);
    expect(existsSync(result.videoPath)).toBe(true);
    expect(statSync(result.videoPath).size).toBeGreaterThan(1000);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan(30);
  }, 30000);
});

describe('Post-processor', () => {
  it('converts webm to gif', async () => {
    // First record
    const recording = await runScriptAndRecord({
      script: DEMO_SCRIPT,
      baseUrl: server.url,
      recording: RECORDING_CONFIG,
      outputDir,
    });

    // Then convert
    const processed = await postProcess({
      inputPath: recording.videoPath,
      outputDir,
      format: 'gif',
      viewport: RECORDING_CONFIG.viewport,
    });

    expect(processed.outputPath).toMatch(/\.gif$/);
    expect(existsSync(processed.outputPath)).toBe(true);
    expect(processed.sizeMB).toBeGreaterThan(0);
    expect(processed.sizeMB).toBeLessThan(20); // sanity cap
  }, 60000);

  it('converts webm to mp4', async () => {
    const recording = await runScriptAndRecord({
      script: DEMO_SCRIPT,
      baseUrl: server.url,
      recording: RECORDING_CONFIG,
      outputDir,
    });

    const processed = await postProcess({
      inputPath: recording.videoPath,
      outputDir,
      format: 'mp4',
      viewport: RECORDING_CONFIG.viewport,
    });

    expect(processed.outputPath).toMatch(/\.mp4$/);
    expect(existsSync(processed.outputPath)).toBe(true);
    expect(processed.sizeMB).toBeGreaterThan(0);
  }, 60000);
});

describe('Full recording pipeline (no LLM)', () => {
  it('produces a gif under 5MB from start to finish', async () => {
    const pipelineOutputDir = join(tmpdir(), `git-glimpse-pipeline-${Date.now()}`);

    try {
      const recording = await runScriptAndRecord({
        script: DEMO_SCRIPT,
        baseUrl: server.url,
        recording: RECORDING_CONFIG,
        outputDir: pipelineOutputDir,
      });

      const processed = await postProcess({
        inputPath: recording.videoPath,
        outputDir: pipelineOutputDir,
        format: 'gif',
        viewport: RECORDING_CONFIG.viewport,
      });

      expect(existsSync(processed.outputPath)).toBe(true);
      expect(processed.sizeMB).toBeLessThan(5);
    } finally {
      if (existsSync(pipelineOutputDir)) {
        rmSync(pipelineOutputDir, { recursive: true, force: true });
      }
    }
  }, 60000);
});
