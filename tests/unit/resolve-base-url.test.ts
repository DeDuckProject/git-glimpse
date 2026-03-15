import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveBaseUrl, resolveEntryPointUrls } from '../../packages/action/src/resolve-base-url.js';
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

  it('handles array app config by using the first entry', () => {
    const config = makeConfig([
      { name: 'admin', startCommand: 'npm run dev', readyWhen: { url: 'http://localhost:3000/health' } },
      { name: 'storefront', previewUrl: 'https://store.example.com' },
    ] as any);
    const result = resolveBaseUrl(config);
    expect(result.url).toBe('http://localhost:3000');
  });
});

describe('resolveEntryPointUrls', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves multiple entry points', () => {
    const result = resolveEntryPointUrls([
      { name: 'admin', readyWhen: { url: 'http://localhost:3000/health', status: 200, timeout: 30000 } },
      { name: 'storefront', previewUrl: 'https://store.example.com' },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.entryPoints).toHaveLength(2);
    expect(result.entryPoints![0]).toEqual({ name: 'admin', baseUrl: 'http://localhost:3000' });
    expect(result.entryPoints![1]).toEqual({ name: 'storefront', baseUrl: 'https://store.example.com' });
  });

  it('applies previewUrlOverride to the first entry point only', () => {
    const result = resolveEntryPointUrls(
      [
        { name: 'admin', readyWhen: { url: 'http://localhost:3000', status: 200, timeout: 30000 } },
        { name: 'storefront', readyWhen: { url: 'http://localhost:4000', status: 200, timeout: 30000 } },
      ],
      'https://override.example.com'
    );
    expect(result.entryPoints![0]!.baseUrl).toBe('https://override.example.com');
    expect(result.entryPoints![1]!.baseUrl).toBe('http://localhost:4000');
  });

  it('returns error if an entry point fails resolution', () => {
    process.env['BAD_VAR'] = 'not-a-url';
    const result = resolveEntryPointUrls([
      { name: 'admin', previewUrl: 'BAD_VAR' },
    ]);
    expect(result.error).toMatch(/admin/);
    expect(result.error).toMatch(/not a valid URL/);
  });
});
