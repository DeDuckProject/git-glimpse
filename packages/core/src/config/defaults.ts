import type { RecordingConfig, LLMConfig, TriggerConfig } from './schema.js';

export const DEFAULT_RECORDING: RecordingConfig = {
  viewport: { width: 1280, height: 720 },
  format: 'gif',
  maxDuration: 30,
  deviceScaleFactor: 2,
  showMouseClicks: true,
};

export const DEFAULT_LLM: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
};

export const DEFAULT_TRIGGER: TriggerConfig = {
  mode: 'auto',
  threshold: 5,
  commentCommand: '/glimpse',
  skipComment: true,
};
