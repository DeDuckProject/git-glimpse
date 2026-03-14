import { describe, it, expect } from 'vitest';
import {
  buildScriptGenerationPrompt,
  buildGeneralDemoPrompt,
} from '../../packages/core/src/generator/prompts.js';
import type { ScriptPromptOptions } from '../../packages/core/src/generator/prompts.js';

const BASE_OPTIONS: ScriptPromptOptions = {
  baseUrl: 'http://localhost:3000',
  diff: 'diff --git a/src/Button.tsx b/src/Button.tsx\n+export function Button() {}',
  routes: [{ route: '/', file: 'src/Button.tsx' }],
  demoFlow: 'Navigate to home and click the button',
  maxDuration: 30,
  viewport: { width: 1280, height: 720 },
};

describe('buildScriptGenerationPrompt', () => {
  it('includes hint under App-specific notes when provided', () => {
    const prompt = buildScriptGenerationPrompt({
      ...BASE_OPTIONS,
      hint: 'Log in with demo@example.com / password',
    });
    expect(prompt).toContain('## App-specific notes');
    expect(prompt).toContain('Log in with demo@example.com / password');
  });

  it('omits App-specific notes section when hint is not provided', () => {
    const prompt = buildScriptGenerationPrompt(BASE_OPTIONS);
    expect(prompt).not.toContain('## App-specific notes');
  });

  it('omits App-specific notes section when hint is empty string', () => {
    const prompt = buildScriptGenerationPrompt({ ...BASE_OPTIONS, hint: '' });
    expect(prompt).not.toContain('## App-specific notes');
  });

  it('places hint before the Diff section', () => {
    const prompt = buildScriptGenerationPrompt({
      ...BASE_OPTIONS,
      hint: 'my hint',
    });
    const hintPos = prompt.indexOf('## App-specific notes');
    const diffPos = prompt.indexOf('## Diff');
    expect(hintPos).toBeGreaterThan(-1);
    expect(hintPos).toBeLessThan(diffPos);
  });
});

describe('buildGeneralDemoPrompt', () => {
  const BASE_GENERAL = {
    baseUrl: 'http://localhost:3000',
    maxDuration: 30,
    viewport: { width: 1280, height: 720 },
  };

  it('includes hint under App-specific notes when provided', () => {
    const prompt = buildGeneralDemoPrompt({
      ...BASE_GENERAL,
      hint: 'Use test account admin / secret',
    });
    expect(prompt).toContain('## App-specific notes');
    expect(prompt).toContain('Use test account admin / secret');
  });

  it('omits App-specific notes section when hint is not provided', () => {
    const prompt = buildGeneralDemoPrompt(BASE_GENERAL);
    expect(prompt).not.toContain('## App-specific notes');
  });

  it('omits App-specific notes section when hint is empty string', () => {
    const prompt = buildGeneralDemoPrompt({ ...BASE_GENERAL, hint: '' });
    expect(prompt).not.toContain('## App-specific notes');
  });
});
