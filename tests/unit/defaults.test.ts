import { describe, it, expect } from 'vitest';
import { DEFAULT_RECORDING, DEFAULT_LLM, DEFAULT_TRIGGER } from '../../packages/core/src/config/defaults.js';

describe('DEFAULT_RECORDING', () => {
  it('has expected viewport dimensions', () => {
    expect(DEFAULT_RECORDING.viewport).toEqual({ width: 1280, height: 720 });
  });

  it('defaults to gif format', () => {
    expect(DEFAULT_RECORDING.format).toBe('gif');
  });

  it('has 30 second max duration', () => {
    expect(DEFAULT_RECORDING.maxDuration).toBe(30);
  });

  it('has 2x device scale factor for retina', () => {
    expect(DEFAULT_RECORDING.deviceScaleFactor).toBe(2);
  });

  it('enables mouse click overlay by default', () => {
    expect(DEFAULT_RECORDING.showMouseClicks).toBe(true);
  });
});

describe('DEFAULT_LLM', () => {
  it('uses anthropic provider', () => {
    expect(DEFAULT_LLM.provider).toBe('anthropic');
  });

  it('uses claude-sonnet-4-6 model', () => {
    expect(DEFAULT_LLM.model).toBe('claude-sonnet-4-6');
  });
});

describe('DEFAULT_TRIGGER', () => {
  it('uses auto mode', () => {
    expect(DEFAULT_TRIGGER.mode).toBe('auto');
  });

  it('has threshold of 5', () => {
    expect(DEFAULT_TRIGGER.threshold).toBe(5);
  });

  it('uses /glimpse as comment command', () => {
    expect(DEFAULT_TRIGGER.commentCommand).toBe('/glimpse');
  });

  it('enables skip comment by default', () => {
    expect(DEFAULT_TRIGGER.skipComment).toBe(true);
  });
});
