import { describe, it, expect } from 'vitest';
import { normalizeConfig } from '../../packages/core/src/config/normalize.js';
import { parseConfig } from '../../packages/core/src/config/loader.js';

describe('normalizeConfig', () => {
  it('normalizes single-app config to one entry point named default', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev', readyWhen: { url: 'http://localhost:3000' } },
    });
    const normalized = normalizeConfig(config);
    expect(normalized.entryPoints).toHaveLength(1);
    expect(normalized.entryPoints[0]!.name).toBe('default');
    expect(normalized.entryPoints[0]!.startCommand).toBe('npm run dev');
  });

  it('normalizes multi-entry-point config', () => {
    const config = parseConfig({
      app: [
        { name: 'admin', startCommand: 'npm run dev:admin', readyWhen: { url: 'http://localhost:3000' } },
        { name: 'storefront', previewUrl: 'https://store.example.com' },
      ],
    });
    const normalized = normalizeConfig(config);
    expect(normalized.entryPoints).toHaveLength(2);
    expect(normalized.entryPoints[0]!.name).toBe('admin');
    expect(normalized.entryPoints[1]!.name).toBe('storefront');
    expect(normalized.entryPoints[1]!.previewUrl).toBe('https://store.example.com');
  });

  it('normalizes string routeMap values to default entry', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
      routeMap: { 'src/**': '/' },
    });
    const normalized = normalizeConfig(config);
    expect(normalized.routeMap['src/**']).toEqual({ entry: 'default', route: '/' });
  });

  it('normalizes object routeMap values as-is', () => {
    const config = parseConfig({
      app: [
        { name: 'admin', startCommand: 'npm run dev' },
        { name: 'storefront', previewUrl: 'https://store.example.com' },
      ],
      routeMap: {
        'app/routes/**': { entry: 'admin', route: '/' },
        'extensions/**': { entry: 'storefront', route: '/products/ring' },
      },
    });
    const normalized = normalizeConfig(config);
    expect(normalized.routeMap['app/routes/**']).toEqual({ entry: 'admin', route: '/' });
    expect(normalized.routeMap['extensions/**']).toEqual({ entry: 'storefront', route: '/products/ring' });
  });

  it('uses first entry point name as default for string routeMap values in multi-entry config', () => {
    const config = parseConfig({
      app: [
        { name: 'admin', startCommand: 'npm run dev' },
        { name: 'storefront', previewUrl: 'https://store.example.com' },
      ],
      routeMap: { 'src/components/**': '/' },
    });
    const normalized = normalizeConfig(config);
    expect(normalized.routeMap['src/components/**']).toEqual({ entry: 'admin', route: '/' });
  });

  it('preserves recording, llm, and trigger config', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
      recording: { maxDuration: 60 },
    });
    const normalized = normalizeConfig(config);
    expect(normalized.recording.maxDuration).toBe(60);
    expect(normalized.llm.provider).toBe('anthropic');
    expect(normalized.trigger.mode).toBe('auto');
  });
});
