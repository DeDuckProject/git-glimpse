import type { RecordingConfig, LLMConfig } from './schema.js';

export const DEFAULT_RECORDING: RecordingConfig = {
  viewport: { width: 1280, height: 720 },
  format: 'gif',
  maxDuration: 30,
  deviceScaleFactor: 2,
};

export const DEFAULT_LLM: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
};
