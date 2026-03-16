import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../packages/core/src/config/loader.js';

describe('parseConfig', () => {
  it('accepts a minimal valid config', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
    });
    expect(config.app).toEqual(expect.objectContaining({ startCommand: 'npm run dev' }));
    expect(config.recording?.format).toBe('gif');
    expect(config.llm?.provider).toBe('anthropic');
  });

  it('accepts preview URL mode', () => {
    const config = parseConfig({
      app: { previewUrl: 'VERCEL_PREVIEW_URL' },
    });
    const app = Array.isArray(config.app) ? config.app[0] : config.app;
    expect(app.previewUrl).toBe('VERCEL_PREVIEW_URL');
  });

  it('merges recording defaults', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
      recording: { maxDuration: 60 },
    });
    expect(config.recording?.maxDuration).toBe(60);
    expect(config.recording?.viewport).toEqual({ width: 1280, height: 720 });
  });

  it('throws on invalid config', () => {
    expect(() => parseConfig({})).toThrow(/Invalid git-glimpse config/);
  });

  it('applies explicit routeMap with string values', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
      routeMap: { 'src/components/Header.tsx': '/' },
    });
    expect(config.routeMap?.['src/components/Header.tsx']).toBe('/');
  });

  it('accepts multi-entry-point app config', () => {
    const config = parseConfig({
      app: [
        { name: 'admin', startCommand: 'npm run dev:admin', readyWhen: { url: 'http://localhost:3000' } },
        { name: 'storefront', readyWhen: { url: 'http://localhost:4000' } },
      ],
    });
    expect(Array.isArray(config.app)).toBe(true);
    const apps = config.app as Array<{ name: string }>;
    expect(apps).toHaveLength(2);
    expect(apps[0]!.name).toBe('admin');
    expect(apps[1]!.name).toBe('storefront');
  });

  it('accepts routeMap with object values', () => {
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
    expect(config.routeMap?.['app/routes/**']).toEqual({ entry: 'admin', route: '/' });
    expect(config.routeMap?.['extensions/**']).toEqual({ entry: 'storefront', route: '/products/ring' });
  });

  it('accepts mixed routeMap values (strings and objects)', () => {
    const config = parseConfig({
      app: [
        { name: 'admin', startCommand: 'npm run dev' },
      ],
      routeMap: {
        'src/components/**': '/',
        'extensions/**': { entry: 'admin', route: '/dashboard' },
      },
    });
    expect(config.routeMap?.['src/components/**']).toBe('/');
    expect(config.routeMap?.['extensions/**']).toEqual({ entry: 'admin', route: '/dashboard' });
  });
});
