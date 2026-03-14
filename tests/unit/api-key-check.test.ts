import { describe, it, expect } from 'vitest';
import { checkApiKey } from '../../packages/action/src/api-key-check.js';

describe('checkApiKey', () => {
  it('returns ok when key is present', () => {
    expect(checkApiKey('sk-ant-123', true)).toEqual({ action: 'ok' });
    expect(checkApiKey('sk-ant-123', false)).toEqual({ action: 'ok' });
  });

  it('returns fail when key is missing and pipeline will run', () => {
    const result = checkApiKey(undefined, true);
    expect(result.action).toBe('fail');
    expect((result as { action: 'fail'; message: string }).message).toMatch(/ANTHROPIC_API_KEY/);
    expect((result as { action: 'fail'; message: string }).message).toMatch(/secrets\.ANTHROPIC_API_KEY/);
  });

  it('returns warn when key is missing but pipeline will not run', () => {
    const result = checkApiKey(undefined, false);
    expect(result.action).toBe('warn');
    expect((result as { action: 'warn'; message: string }).message).toMatch(/ANTHROPIC_API_KEY/);
  });
});
