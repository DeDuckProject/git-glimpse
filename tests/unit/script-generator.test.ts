import { describe, it, expect, vi } from 'vitest';
import { generateDemoScript } from '../../packages/core/src/generator/script-generator.js';
import type { ChangeAnalysis } from '../../packages/core/src/analyzer/change-summarizer.js';
import type { GitGlimpseConfig } from '../../packages/core/src/config/schema.js';

const VALID_SCRIPT = `import type { Page } from '@playwright/test';
export async function demo(page: Page) {
  await page.goto('/');
}`;

const INVALID_SCRIPT = `// no export
function notDemo() {}`;

function makeMockClient(responses: string[]) {
  const create = vi.fn();
  responses.forEach((text, i) => {
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text }],
    });
  });
  return { messages: { create } } as any;
}

const ANALYSIS: ChangeAnalysis = {
  changedFiles: ['app/routes/home.tsx'],
  affectedRoutes: [{ file: 'app/routes/home.tsx', route: '/', changeType: 'modified' }],
  changeDescription: 'Updated home page',
  suggestedDemoFlow: '1. Navigate to home\n2. Verify changes',
};

const CONFIG: GitGlimpseConfig = {
  app: { },
  recording: { viewport: { width: 1280, height: 720 }, format: 'gif', maxDuration: 30, deviceScaleFactor: 2, showMouseClicks: true },
  llm: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  trigger: { mode: 'auto', threshold: 5, commentCommand: '/glimpse', skipComment: true },
};

describe('generateDemoScript', () => {
  it('returns valid script on first attempt', async () => {
    const client = makeMockClient([VALID_SCRIPT]);

    const result = await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG);

    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.script).toContain('export async function demo');
  });

  it('retries on invalid script and succeeds on second attempt', async () => {
    const client = makeMockClient([INVALID_SCRIPT, VALID_SCRIPT]);

    const result = await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG);

    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Attempt 1');
    expect(result.script).toContain('export async function demo');
  });

  it('returns best-effort script after exhausting all retries', async () => {
    const client = makeMockClient([INVALID_SCRIPT, INVALID_SCRIPT, INVALID_SCRIPT]);

    const result = await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG);

    expect(result.attempts).toBe(3);
    expect(result.errors).toHaveLength(3);
  });

  it('makes at most 3 LLM calls (1 initial + 2 retries)', async () => {
    const client = makeMockClient([INVALID_SCRIPT, INVALID_SCRIPT, INVALID_SCRIPT]);

    await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG);

    expect(client.messages.create).toHaveBeenCalledTimes(3);
  });

  it('uses general demo prompt when generalDemo is true', async () => {
    const client = makeMockClient([VALID_SCRIPT]);

    await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG, true);

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    // General demo prompt focuses on app overview, not specific diff
    expect(prompt).toContain('http://localhost:3000');
  });

  it('uses diff-specific prompt when generalDemo is false', async () => {
    const client = makeMockClient([VALID_SCRIPT]);

    await generateDemoScript(client, ANALYSIS, 'raw diff here', 'http://localhost:3000', CONFIG, false);

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('raw diff here');
  });

  it('uses retry prompt on subsequent attempts', async () => {
    const client = makeMockClient([INVALID_SCRIPT, VALID_SCRIPT]);

    await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG);

    // Second call should use retry prompt which includes the previous script
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    const retryPrompt = client.messages.create.mock.calls[1][0].messages[0].content;
    expect(retryPrompt).toContain('Original script');
  });

  it('uses default recording and llm config when not provided', async () => {
    const client = makeMockClient([VALID_SCRIPT]);
    const minimalConfig: GitGlimpseConfig = { app: {} } as any;

    const result = await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', minimalConfig);

    expect(result.script).toContain('export async function demo');
  });

  it('strips markdown fences from valid script', async () => {
    const wrappedScript = '```typescript\n' + VALID_SCRIPT + '\n```';
    const client = makeMockClient([wrappedScript]);

    const result = await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', CONFIG);

    expect(result.script).not.toContain('```');
    expect(result.script).toContain('export async function demo');
  });

  it('includes hint in prompt when config has hint', async () => {
    const client = makeMockClient([VALID_SCRIPT]);
    const configWithHint: GitGlimpseConfig = {
      ...CONFIG,
      app: { hint: 'Login with test@example.com / password123' },
    };

    await generateDemoScript(client, ANALYSIS, 'raw diff', 'http://localhost:3000', configWithHint);

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('test@example.com');
  });
});
