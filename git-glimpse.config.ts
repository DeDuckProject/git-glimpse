import type { GitGlimpseConfig } from '@git-glimpse/core';

// Self-referential config: git-glimpse uses git-glimpse to demo itself.
export default {
  app: {
    startCommand: 'pnpm dev',
    readyWhen: { url: 'http://localhost:3000' },
  },
  recording: {
    format: 'gif',
    maxDuration: 30,
    viewport: { width: 1280, height: 720 },
  },
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  },
} satisfies GitGlimpseConfig;
