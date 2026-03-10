import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../packages/core/src/config/loader.js';

describe('parseConfig', () => {
  it('accepts a minimal valid config', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
    });
    expect(config.app.startCommand).toBe('npm run dev');
    expect(config.recording?.format).toBe('gif');
    expect(config.llm?.provider).toBe('anthropic');
  });

  it('accepts preview URL mode', () => {
    const config = parseConfig({
      app: { previewUrl: 'VERCEL_PREVIEW_URL' },
    });
    expect(config.app.previewUrl).toBe('VERCEL_PREVIEW_URL');
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

  it('applies explicit routeMap', () => {
    const config = parseConfig({
      app: { startCommand: 'npm run dev' },
      routeMap: { 'src/components/Header.tsx': '/' },
    });
    expect(config.routeMap?.['src/components/Header.tsx']).toBe('/');
  });
});
