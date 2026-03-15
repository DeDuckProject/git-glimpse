import type { RouteMapping } from '../analyzer/route-detector.js';
import type { EntryPointUrl } from '../pipeline.js';

export interface ScriptPromptOptions {
  entryPoints: EntryPointUrl[];
  diff: string;
  routes: RouteMapping[];
  demoFlow: string;
  maxDuration: number;
  viewport: { width: number; height: number };
  hint?: string;
}

function formatEntryPoints(entryPoints: EntryPointUrl[]): string {
  if (entryPoints.length === 1) {
    return `- Base URL: ${entryPoints[0].baseUrl}`;
  }
  return `- Entry points:\n` +
    entryPoints.map((ep) => `  - ${ep.name}: ${ep.baseUrl}`).join('\n');
}

function formatRouteList(routes: RouteMapping[], entryPoints: EntryPointUrl[]): string {
  if (routes.length === 0) return '  - / (home page)';
  const multiEntry = entryPoints.length > 1;
  return routes
    .map((r) => {
      const prefix = multiEntry ? `[${r.entry}] ` : '';
      return `  - ${prefix}${r.route} (from ${r.file})`;
    })
    .join('\n');
}

function formatEntryPointNavInstructions(entryPoints: EntryPointUrl[]): string {
  if (entryPoints.length === 1) return '';
  return `\n## Multiple entry points
- This app has multiple entry points at different URLs.
- Use the correct entry point URL when navigating to each route. For example: \`await page.goto('${entryPoints[0].baseUrl}/some-route')\`
- Each route in the "Affected routes" list is tagged with its entry point name in square brackets.\n`;
}

export function buildScriptGenerationPrompt(options: ScriptPromptOptions): string {
  const routeList = formatRouteList(options.routes, options.entryPoints);

  const truncatedDiff = options.diff.length > 10000
    ? options.diff.slice(0, 10000) + '\n... (diff truncated)'
    : options.diff;

  return `You are a Playwright script generator. Given a code diff, generate a TypeScript Playwright script that visually demonstrates the UI changes.

## Rules
- Navigate to the affected pages
- Interact with new/changed UI elements (click buttons, fill forms, hover states)
- Use resilient selectors in priority order: text content > ARIA roles > test IDs > CSS classes
- The script must be self-contained and immediately runnable
- Total demo should be under ${options.maxDuration} seconds
- Do NOT test correctness — demonstrate the feature. Show it working, not edge cases.
- Act as a real user: only interact through the UI using standard Playwright actions (navigate, click, type, hover). Never re-implement or simulate application features in the script.
- Do NOT inject code into the page via \`page.evaluate\`, \`page.addInitScript\`, or inline \`<script>\` / \`<style>\` tags. The recording infrastructure handles visual overlays — the script should not.
- Always call \`await page.waitForLoadState('networkidle')\` after navigation

## Timing
- Keep pauses short: use \`await page.waitForTimeout(300)\` between most actions
- Only use a longer pause (\`await page.waitForTimeout(800)\`) directly after an interaction whose visual result (animation, state change, panel opening) is the point of the demo
- Avoid stacking multiple pauses in a row — one pause per meaningful moment is enough

## Mouse movement
- Move the mouse naturally between interactions: before clicking or hovering a target, briefly move to a nearby point first so the cursor doesn't teleport
- Use \`await page.mouse.move(x, y)\` for a single intermediate waypoint — keep it simple, one waypoint is enough
- Coordinates should be plausible screen positions relative to the viewport (${options.viewport.width}x${options.viewport.height})
${formatEntryPointNavInstructions(options.entryPoints)}
## Context
${formatEntryPoints(options.entryPoints)}
- Viewport: ${options.viewport.width}x${options.viewport.height}
- Affected routes:
${routeList}
- Suggested demo flow: ${options.demoFlow}
${options.hint ? `\n## App-specific notes\n${options.hint}\n` : ''}
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

export function buildGeneralDemoPrompt(options: Pick<ScriptPromptOptions, 'entryPoints' | 'maxDuration' | 'viewport' | 'hint'>): string {
  return `You are a Playwright script generator. Generate a TypeScript Playwright script that records a general overview demo of a web app — as if showing it to someone for the first time.

## Goal
Produce a short, visually engaging tour that demonstrates the app is running and shows its main UI. This is a setup-validation demo, not a feature showcase.

## Rules
- Navigate to the home page and 1-2 other meaningful routes if they exist
- Scroll gently to reveal content, hover over key UI elements
- Do NOT test anything — just demonstrate that the app loads and looks reasonable
- Use resilient selectors: text content > ARIA roles > CSS classes
- Act as a real user: only interact through the UI. Never re-implement app features in the script.
- Do NOT inject code via \`page.evaluate\`, \`page.addInitScript\`, or inline scripts/styles
- Always call \`await page.waitForLoadState('networkidle')\` after navigation

## Timing
- Total demo under ${options.maxDuration} seconds
- Use \`await page.waitForTimeout(400)\` between actions — keep it brisk

## Mouse movement
- Move naturally before clicks: one intermediate \`page.mouse.move(x, y)\` waypoint is enough
- Use plausible coordinates within the ${options.viewport.width}x${options.viewport.height} viewport

## Context
${formatEntryPoints(options.entryPoints)}
- Viewport: ${options.viewport.width}x${options.viewport.height}
${options.hint ? `\n## App-specific notes\n${options.hint}\n` : ''}
## Output format
Respond with ONLY the TypeScript script, no markdown fences, no explanation:

import type { Page } from '@playwright/test';

export async function demo(page: Page): Promise<void> {
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
${formatEntryPoints(options.entryPoints)}
- Affected routes:
${options.routes.map((r) => `  - ${r.route}`).join('\n')}

Fix the script and respond with ONLY the corrected TypeScript code (same format as before — export async function demo(page: Page)).`;
}
