import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordingConfig } from '../config/schema.js';

export interface RecordingResult {
  videoPath: string;
  duration: number;
}

export interface RunScriptOptions {
  script: string;
  baseUrl: string;
  recording: RecordingConfig;
  outputDir: string;
}

export async function runScriptAndRecord(options: RunScriptOptions): Promise<RecordingResult> {
  const { script, baseUrl, recording, outputDir } = options;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const startTime = Date.now();

  try {
    const context = await createContext(browser, recording, outputDir);
    const page = await context.newPage();

    // Set a base URL for relative navigation
    await page.goto(baseUrl);

    await executeScript(script, page, baseUrl);

    // Enforce max duration
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > recording.maxDuration) {
      console.warn(`Demo exceeded max duration (${elapsed.toFixed(1)}s > ${recording.maxDuration}s)`);
    }

    await context.close();

    const videoPath = await resolveVideoPath(outputDir);
    const duration = (Date.now() - startTime) / 1000;

    return { videoPath, duration };
  } finally {
    await browser.close();
  }
}

async function createContext(
  browser: Browser,
  recording: RecordingConfig,
  outputDir: string
): Promise<BrowserContext> {
  return browser.newContext({
    recordVideo: {
      dir: outputDir,
      size: recording.viewport,
    },
    viewport: recording.viewport,
    deviceScaleFactor: recording.deviceScaleFactor,
  });
}

async function executeScript(script: string, page: Page, _baseUrl: string): Promise<void> {
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const { transformSync } = await import('esbuild');

  // Transpile TypeScript → ESM JavaScript via esbuild
  const { code } = transformSync(script, {
    loader: 'ts',
    format: 'esm',
    target: 'node20',
  });

  const tmpPath = join(tmpdir(), `git-glimpse-script-${Date.now()}.mjs`);
  writeFileSync(tmpPath, code, 'utf-8');

  try {
    const mod = await import(pathToFileURL(tmpPath).href);
    if (typeof mod.demo !== 'function') {
      throw new Error('Generated script must export a function named "demo"');
    }
    await mod.demo(page);
  } finally {
    unlinkSync(tmpPath);
  }
}

async function resolveVideoPath(outputDir: string): Promise<string> {
  const { readdirSync, statSync } = await import('node:fs');
  const files = readdirSync(outputDir)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ name: f, mtime: statSync(join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  const latest = files[0];
  if (!latest) throw new Error(`No video file found in ${outputDir}`);

  return join(outputDir, latest.name);
}
