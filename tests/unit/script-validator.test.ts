import { describe, it, expect } from 'vitest';
import { validateScript } from '../../packages/core/src/generator/validator.js';

describe('validateScript', () => {
  it('accepts a valid demo function', () => {
    const script = `
import type { Page } from '@playwright/test';

export async function demo(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}`;
    const result = validateScript(script);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects script without export', () => {
    const script = `async function demo(page) { await page.goto('/'); }`;
    const result = validateScript(script);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('export'))).toBe(true);
  });

  it('strips markdown fences', () => {
    const script = `\`\`\`typescript
export async function demo(page) {
  await page.goto('/');
}
\`\`\``;
    const result = validateScript(script);
    expect(result.script).not.toContain('```');
    expect(result.script).toContain('export async function demo');
  });
});
