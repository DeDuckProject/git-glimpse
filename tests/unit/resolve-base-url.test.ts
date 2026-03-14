import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveBaseUrl } from '../../packages/action/src/index.js';
import type { GitGlimpseConfig } from '../../packages/core/src/config/schema.js';

function makeConfig(app: GitGlimpseConfig['app']): GitGlimpseConfig {
  return {
    app,
    llm: { provider: 'anthropic' },
    recording: { format: 'gif', maxDuration: 30, viewport: { width: 1280, height: 720 } },
  } as unknown as GitGlimpseConfig;
}

describe('resolveBaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns URL directly when previewUrl is a literal http URL', () => {
    const result = resolveBaseUrl(makeConfig({ previewUrl: 'https://my-preview.vercel.app' }));
    expect(result.url).toBe('https://my-preview.vercel.app');
    expect(result.error).toBeUndefined();
  });

  it('resolves previewUrl as env var name when the env var is set', () => {
    process.env['VERCEL_PREVIEW_URL'] = 'https://my-preview.vercel.app';
    const result = resolveBaseUrl(makeConfig({ previewUrl: 'VERCEL_PREVIEW_URL' }));
    expect(result.url).toBe('https://my-preview.vercel.app');
    expect(result.error).toBeUndefined();
  });

  it('returns a descriptive error when env var name is set but env var is missing', () => {
    delete process.env['VERCEL_PREVIEW_URL'];
    const result = resolveBaseUrl(makeConfig({ previewUrl: 'VERCEL_PREVIEW_URL' }));
    expect(result.url).toBeUndefined();
    expect(result.error).toMatch(/VERCEL_PREVIEW_URL/);
    expect(result.error).toMatch(/env var/);
  });

  it('returns a descriptive error when env var is set but value is not a URL', () => {
    process.env['PREVIEW_URL'] = 'not-a-url';
    const result = resolveBaseUrl(makeConfig({ previewUrl: 'PREVIEW_URL' }));
    expect(result.url).toBeUndefined();
    expect(result.error).toMatch(/PREVIEW_URL/);
    expect(result.error).toMatch(/not a valid URL/);
  });

  it('falls back to localhost when no previewUrl and no readyWhen', () => {
    const result = resolveBaseUrl(makeConfig({ startCommand: 'npm run dev' }));
    expect(result.url).toBe('http://localhost:3000');
  });

  it('uses readyWhen.url origin as base when set', () => {
    const result = resolveBaseUrl(
      makeConfig({ startCommand: 'npm run dev', readyWhen: { url: 'http://localhost:4000/health' } })
    );
    expect(result.url).toBe('http://localhost:4000');
  });

  it('previewUrlOverride takes precedence over config', () => {
    process.env['OVERRIDE_URL'] = 'https://override.example.com';
    const result = resolveBaseUrl(
      makeConfig({ previewUrl: 'SOME_OTHER_VAR' }),
      'OVERRIDE_URL'
    );
    expect(result.url).toBe('https://override.example.com');
  });
});
