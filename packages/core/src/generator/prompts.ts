import type { RouteMapping } from '../analyzer/route-detector.js';

export interface ScriptPromptOptions {
  baseUrl: string;
  diff: string;
  routes: RouteMapping[];
  demoFlow: string;
  maxDuration: number;
  viewport: { width: number; height: number };
}

export function buildScriptGenerationPrompt(options: ScriptPromptOptions): string {
  const routeList =
    options.routes.length > 0
      ? options.routes.map((r) => `  - ${r.route} (from ${r.file})`).join('\n')
      : '  - / (home page)';

  const truncatedDiff = options.diff.length > 10000
    ? options.diff.slice(0, 10000) + '\n... (diff truncated)'
    : options.diff;

  return `You are a Playwright script generator. Given a code diff, generate a TypeScript Playwright script that visually demonstrates the UI changes.

## Rules
- Navigate to the affected pages
- Interact with new/changed UI elements (click buttons, fill forms, hover states)
- Add \`await page.waitForTimeout(1500)\` pauses on key visual states so the recording captures them clearly
- Use resilient selectors in priority order: text content > ARIA roles > test IDs > CSS classes
- The script must be self-contained and immediately runnable
- Total demo should be under ${options.maxDuration} seconds
- Do NOT test correctness — demonstrate the feature. Show it working, not edge cases.
- Act as a real user: only interact through the UI using standard Playwright actions (navigate, click, type, hover). Never re-implement or simulate application features in the script.
- Do NOT inject code into the page via \`page.evaluate\`, \`page.addInitScript\`, or inline \`<script>\` / \`<style>\` tags. The recording infrastructure handles visual overlays — the script should not.
- Always call \`await page.waitForLoadState('networkidle')\` after navigation

## Context
- Base URL: ${options.baseUrl}
- Viewport: ${options.viewport.width}x${options.viewport.height}
- Affected routes:
${routeList}
- Suggested demo flow: ${options.demoFlow}

## Diff
\`\`\`
${truncatedDiff}
\`\`\`

## Output format
Respond with ONLY the TypeScript script, no markdown fences, no explanation. The script must export an async function named \`demo\` that accepts a Playwright \`Page\` object:

import type { Page } from '@playwright/test';

export async function demo(page: Page): Promise<void> {
  // your implementation
}`;
}

export function buildRetryPrompt(
  originalScript: string,
  errorMessage: string,
  screenshotDescription: string,
  options: ScriptPromptOptions
): string {
  return `The following Playwright demo script failed with an error. Please fix it.

## Error
\`\`\`
${errorMessage}
\`\`\`

## State at failure
${screenshotDescription}

## Original script
\`\`\`typescript
${originalScript}
\`\`\`

## Original context
- Base URL: ${options.baseUrl}
- Affected routes:
${options.routes.map((r) => `  - ${r.route}`).join('\n')}

Fix the script and respond with ONLY the corrected TypeScript code (same format as before — export async function demo(page: Page)).`;
}
