import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { GitGlimpseConfigSchema, type GitGlimpseConfig } from './schema.js';
import { DEFAULT_RECORDING, DEFAULT_LLM, DEFAULT_TRIGGER } from './defaults.js';

async function importConfigFile(filePath: string): Promise<unknown> {
  if (extname(filePath) !== '.ts') {
    const mod = await import(pathToFileURL(filePath).href);
    return mod.default ?? mod;
  }

  // Transpile .ts config via sucrase (pure JS, fully bundleable, no native deps)
  const { transform } = await import('sucrase');
  const source = readFileSync(filePath, 'utf-8');
  const { code } = transform(source, { transforms: ['typescript'] });

  // Write next to the original so relative imports in the config resolve correctly
  const tmpFile = resolve(dirname(filePath), `.git-glimpse-config-${Date.now()}.mjs`);
  try {
    writeFileSync(tmpFile, code);
    const mod = await import(pathToFileURL(tmpFile).href);
    return mod.default ?? mod;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export async function loadConfig(configPath?: string): Promise<GitGlimpseConfig> {
  const candidates = configPath
    ? [configPath]
    : ['git-glimpse.config.ts', 'git-glimpse.config.js', 'git-glimpse.config.mjs'];

  for (const candidate of candidates) {
    const fullPath = resolve(process.cwd(), candidate);
    if (existsSync(fullPath)) {
      const raw = await importConfigFile(fullPath);
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
    trigger: { ...DEFAULT_TRIGGER, ...config.trigger },
  };
}
