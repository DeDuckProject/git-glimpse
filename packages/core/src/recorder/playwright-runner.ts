import type { Browser, BrowserContext, Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordingConfig } from '../config/schema.js';
import { ensurePlaywright } from './ensure-playwright.js';
import type { EntryPointUrl } from '../pipeline.js';

export interface RecordingResult {
  videoPath: string;
  duration: number;
}

export interface RunScriptOptions {
  script: string;
  entryPoints: EntryPointUrl[];
  recording: RecordingConfig;
  outputDir: string;
}

export async function runScriptAndRecord(options: RunScriptOptions): Promise<RecordingResult> {
  const { script, entryPoints, recording, outputDir } = options;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Resolve @playwright/test from the consumer's project, or auto-install it if missing.
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless: true });
  const startTime = Date.now();

  try {
    const context = await createContext(browser, recording, outputDir);
    const page = await context.newPage();

    // Inject the cursor overlay after every page load (fires after app JS/hydration
    // has run, so the cursor won't be removed by framework re-renders).
    if (recording.showMouseClicks !== false) {
      page.on('load', () => {
        page.evaluate(buildMouseClickOverlayEvalScript()).catch(() => {});
      });
    }

    // Navigate to the first entry point as a starting position
    await page.goto(entryPoints[0].baseUrl);

    await executeScript(script, page);

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
  const context = await browser.newContext({
    recordVideo: {
      dir: outputDir,
      size: recording.viewport,
    },
    viewport: recording.viewport,
    deviceScaleFactor: recording.deviceScaleFactor,
  });

  return context;
}

function buildMouseClickOverlayEvalScript(): string {
  return `(() => {
  if (document.querySelector('.gg-cursor')) return;

  const style = document.createElement('style');
  style.textContent = \`
    .gg-cursor {
      width: 16px; height: 16px; border-radius: 50%;
      background: rgba(255, 80, 0, 0.85);
      border: 2px solid white;
      position: fixed; pointer-events: none; z-index: 999999;
      transform: translate(-50%, -50%);
      transition: left 30ms linear, top 30ms linear;
      box-shadow: 0 0 4px rgba(0,0,0,0.4);
    }
    @keyframes gg-ripple {
      from { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
      to   { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
    }
    .gg-ripple {
      width: 24px; height: 24px; border-radius: 50%;
      border: 3px solid rgba(255, 80, 0, 0.9);
      position: fixed; pointer-events: none; z-index: 999998;
      animation: gg-ripple 500ms ease-out forwards;
    }
  \`;
  document.head.appendChild(style);

  const cursor = document.createElement('div');
  cursor.className = 'gg-cursor';
  document.body.appendChild(cursor);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(cursor)) {
      document.body.appendChild(cursor);
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  document.addEventListener('click', (e) => {
    const ripple = document.createElement('div');
    ripple.className = 'gg-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });
})();`;
}

async function executeScript(script: string, page: Page): Promise<void> {
  const { writeFileSync, unlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const { transform } = await import('sucrase');

  // Transpile TypeScript → ESM JavaScript via sucrase (pure JS, no native deps)
  const { code } = transform(script, { transforms: ['typescript'] });

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
