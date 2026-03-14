import { describe, it, expect } from 'vitest';
import {
  TriggerConfigSchema,
  AppConfigSchema,
  RecordingConfigSchema,
  LLMConfigSchema,
  GitGlimpseConfigSchema,
} from '../../packages/core/src/config/schema.js';

describe('TriggerConfigSchema', () => {
  it('applies defaults for missing fields', () => {
    const result = TriggerConfigSchema.parse({});
    expect(result.mode).toBe('auto');
    expect(result.threshold).toBe(5);
    expect(result.commentCommand).toBe('/glimpse');
    expect(result.skipComment).toBe(true);
  });

  it('accepts valid mode values', () => {
    expect(TriggerConfigSchema.parse({ mode: 'auto' }).mode).toBe('auto');
    expect(TriggerConfigSchema.parse({ mode: 'on-demand' }).mode).toBe('on-demand');
    expect(TriggerConfigSchema.parse({ mode: 'smart' }).mode).toBe('smart');
  });

  it('rejects invalid mode', () => {
    expect(() => TriggerConfigSchema.parse({ mode: 'invalid' })).toThrow();
  });

  it('accepts include/exclude arrays', () => {
    const result = TriggerConfigSchema.parse({
      include: ['src/**/*.tsx'],
      exclude: ['**/*.test.ts'],
    });
    expect(result.include).toEqual(['src/**/*.tsx']);
    expect(result.exclude).toEqual(['**/*.test.ts']);
  });
});

describe('AppConfigSchema', () => {
  it('accepts empty object', () => {
    const result = AppConfigSchema.parse({});
    expect(result.startCommand).toBeUndefined();
    expect(result.previewUrl).toBeUndefined();
    expect(result.env).toBeUndefined();
    expect(result.hint).toBeUndefined();
  });

  it('accepts full config', () => {
    const result = AppConfigSchema.parse({
      startCommand: 'npm run dev',
      previewUrl: 'https://preview.example.com',
      env: { NODE_ENV: 'test' },
      hint: 'Use test credentials',
    });
    expect(result.startCommand).toBe('npm run dev');
    expect(result.env).toEqual({ NODE_ENV: 'test' });
  });

  it('validates readyWhen.url as a valid URL', () => {
    expect(() => AppConfigSchema.parse({
      readyWhen: { url: 'not-a-url' },
    })).toThrow();
  });

  it('applies defaults for readyWhen sub-fields', () => {
    const result = AppConfigSchema.parse({
      readyWhen: { url: 'http://localhost:3000' },
    });
    expect(result.readyWhen!.status).toBe(200);
    expect(result.readyWhen!.timeout).toBe(30000);
  });
});

describe('RecordingConfigSchema', () => {
  it('applies all defaults', () => {
    const result = RecordingConfigSchema.parse({});
    expect(result.viewport).toEqual({ width: 1280, height: 720 });
    expect(result.format).toBe('gif');
    expect(result.maxDuration).toBe(30);
    expect(result.deviceScaleFactor).toBe(2);
    expect(result.showMouseClicks).toBe(true);
  });

  it('accepts custom viewport', () => {
    const result = RecordingConfigSchema.parse({
      viewport: { width: 1920, height: 1080 },
    });
    expect(result.viewport).toEqual({ width: 1920, height: 1080 });
  });

  it('accepts all format types', () => {
    expect(RecordingConfigSchema.parse({ format: 'gif' }).format).toBe('gif');
    expect(RecordingConfigSchema.parse({ format: 'mp4' }).format).toBe('mp4');
    expect(RecordingConfigSchema.parse({ format: 'webm' }).format).toBe('webm');
  });

  it('rejects invalid format', () => {
    expect(() => RecordingConfigSchema.parse({ format: 'avi' })).toThrow();
  });
});

describe('LLMConfigSchema', () => {
  it('applies defaults', () => {
    const result = LLMConfigSchema.parse({});
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('accepts openai provider', () => {
    const result = LLMConfigSchema.parse({ provider: 'openai', model: 'gpt-4' });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4');
  });

  it('rejects invalid provider', () => {
    expect(() => LLMConfigSchema.parse({ provider: 'gemini' })).toThrow();
  });
});

describe('GitGlimpseConfigSchema', () => {
  it('requires app field', () => {
    expect(() => GitGlimpseConfigSchema.parse({})).toThrow();
  });

  it('accepts minimal config with just app', () => {
    const result = GitGlimpseConfigSchema.parse({ app: {} });
    expect(result.app).toBeDefined();
    expect(result.recording).toBeUndefined();
    expect(result.llm).toBeUndefined();
    expect(result.trigger).toBeUndefined();
  });

  it('accepts full config', () => {
    const result = GitGlimpseConfigSchema.parse({
      app: { startCommand: 'npm start' },
      routeMap: { 'src/pages/Home.tsx': '/' },
      setup: 'npm install',
      recording: { format: 'mp4' },
      llm: { model: 'claude-opus-4-6' },
      trigger: { mode: 'smart', threshold: 10 },
    });
    expect(result.routeMap).toEqual({ 'src/pages/Home.tsx': '/' });
    expect(result.setup).toBe('npm install');
  });
});
