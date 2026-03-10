import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GitGlimpseConfigSchema, type GitGlimpseConfig } from './schema.js';
import { DEFAULT_RECORDING, DEFAULT_LLM } from './defaults.js';

export async function loadConfig(configPath?: string): Promise<GitGlimpseConfig> {
  const candidates = configPath
    ? [configPath]
    : ['git-glimpse.config.ts', 'git-glimpse.config.js', 'git-glimpse.config.mjs'];

  for (const candidate of candidates) {
    const fullPath = resolve(process.cwd(), candidate);
    if (existsSync(fullPath)) {
      const mod = await import(pathToFileURL(fullPath).href);
      const raw = mod.default ?? mod;
      return parseConfig(raw);
    }
  }

  throw new Error(
    `No git-glimpse config found. Create a git-glimpse.config.ts at your repo root.\n` +
      `Checked: ${candidates.join(', ')}`
  );
}

export function parseConfig(raw: unknown): GitGlimpseConfig {
  const result = GitGlimpseConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid git-glimpse config:\n${errors}`);
  }

  const config = result.data;
  return {
    ...config,
    recording: { ...DEFAULT_RECORDING, ...config.recording },
    llm: { ...DEFAULT_LLM, ...config.llm },
  };
}
