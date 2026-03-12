import type { GitGlimpseConfig } from '@git-glimpse/core';

const config: GitGlimpseConfig = {
  app: {
    previewUrl: 'http://localhost:3000',
  },
  record: {
    format: 'gif',
    maxDuration: 20,
    viewport: { width: 960, height: 600 },
  },
  trigger: {
    mode: 'on-demand',
  },
};

export default config;
