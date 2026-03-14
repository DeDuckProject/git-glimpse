import { describe, it, expect, vi } from 'vitest';
import { summarizeChanges } from '../../packages/core/src/analyzer/change-summarizer.js';
import type { ParsedDiff } from '../../packages/core/src/analyzer/diff-parser.js';
import type { RouteMapping } from '../../packages/core/src/analyzer/route-detector.js';

function makeMockClient(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  } as any;
}

const SAMPLE_DIFF: ParsedDiff = {
  files: [
    { path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 5, deletions: 2 },
    { path: 'src/components/Button.tsx', changeType: 'added', hunks: [], additions: 20, deletions: 0 },
  ],
  rawDiff: 'diff --git a/app/routes/home.tsx ...',
};

const SAMPLE_ROUTES: RouteMapping[] = [
  { file: 'app/routes/home.tsx', route: '/', changeType: 'modified' },
];

describe('summarizeChanges', () => {
  it('returns parsed description and demo flow from valid JSON response', async () => {
    const client = makeMockClient(JSON.stringify({
      description: 'Added a new button component',
      demoFlow: '1. Go to home\n2. Click the button',
    }));

    const result = await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    expect(result.changedFiles).toEqual(['app/routes/home.tsx', 'src/components/Button.tsx']);
    expect(result.affectedRoutes).toEqual(SAMPLE_ROUTES);
    expect(result.changeDescription).toBe('Added a new button component');
    expect(result.suggestedDemoFlow).toBe('1. Go to home\n2. Click the button');
  });

  it('returns defaults when LLM response is not valid JSON', async () => {
    const client = makeMockClient('This is not JSON at all');

    const result = await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    expect(result.changeDescription).toBe('UI changes detected.');
    expect(result.suggestedDemoFlow).toBe('Navigate to the affected page and interact with the changes.');
  });

  it('returns defaults when JSON is missing fields', async () => {
    const client = makeMockClient(JSON.stringify({ unrelated: true }));

    const result = await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    expect(result.changeDescription).toBe('UI changes detected.');
    expect(result.suggestedDemoFlow).toBe('Navigate to the affected page and interact with the changes.');
  });

  it('extracts JSON embedded in surrounding text', async () => {
    const client = makeMockClient(
      'Here is the analysis:\n```json\n{"description": "Modal added", "demoFlow": "Open modal"}\n```'
    );

    const result = await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    expect(result.changeDescription).toBe('Modal added');
    expect(result.suggestedDemoFlow).toBe('Open modal');
  });

  it('truncates large diffs before sending to LLM', async () => {
    const client = makeMockClient(JSON.stringify({
      description: 'Changes',
      demoFlow: 'Demo',
    }));
    const largeDiff: ParsedDiff = {
      files: SAMPLE_DIFF.files,
      rawDiff: 'x'.repeat(10000),
    };

    await summarizeChanges(client, largeDiff, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('(diff truncated)');
    // The prompt should contain a truncated diff, not the full 10k chars
    expect(prompt.length).toBeLessThan(10000);
  });

  it('does not truncate short diffs', async () => {
    const client = makeMockClient(JSON.stringify({
      description: 'Changes',
      demoFlow: 'Demo',
    }));

    await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('(diff truncated)');
  });

  it('includes route list in prompt when routes are provided', async () => {
    const client = makeMockClient(JSON.stringify({ description: 'd', demoFlow: 'f' }));

    await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('app/routes/home.tsx');
    expect(prompt).toContain('/');
  });

  it('shows fallback when no routes are detected', async () => {
    const client = makeMockClient(JSON.stringify({ description: 'd', demoFlow: 'f' }));

    await summarizeChanges(client, SAMPLE_DIFF, [], 'claude-sonnet-4-6');

    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('no routes detected automatically');
  });

  it('passes the specified model to the client', async () => {
    const client = makeMockClient(JSON.stringify({ description: 'd', demoFlow: 'f' }));

    await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-opus-4-6');

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-6' })
    );
  });

  it('handles empty content response from LLM', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [] }),
      },
    } as any;

    const result = await summarizeChanges(client, SAMPLE_DIFF, SAMPLE_ROUTES, 'claude-sonnet-4-6');

    expect(result.changeDescription).toBe('UI changes detected.');
    expect(result.suggestedDemoFlow).toBe('Navigate to the affected page and interact with the changes.');
  });
});
