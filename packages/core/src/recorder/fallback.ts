import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordingConfig } from '../config/schema.js';
import type { RouteMapping } from '../analyzer/route-detector.js';

export interface FallbackResult {
  screenshots: string[];
}

export async function takeScreenshots(
  baseUrl: string,
  routes: RouteMapping[],
  recording: RecordingConfig,
  outputDir: string
): Promise<FallbackResult> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const screenshots: string[] = [];

  try {
    const context = await browser.newContext({
      viewport: recording.viewport,
      deviceScaleFactor: recording.deviceScaleFactor,
    });

    const page = await context.newPage();
    const targetRoutes = routes.length > 0 ? routes : [{ file: '', route: '/', changeType: 'modified' as const }];

    for (const route of targetRoutes) {
      const url = baseUrl + route.route;
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const screenshotPath = join(outputDir, `screenshot-${sanitizeRoute(route.route)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshots.push(screenshotPath);
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return { screenshots };
}

function sanitizeRoute(route: string): string {
  return route.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'home';
}
