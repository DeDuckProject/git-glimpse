import { pathToFileURL } from 'node:url';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { GitGlimpseConfigSchema, type GitGlimpseConfig } from './schema.js';
import { DEFAULT_RECORDING, DEFAULT_LLM } from './defaults.js';

async function importConfigFile(filePath: string): Promise<unknown> {
  if (extname(filePath) !== '.ts') {
    const mod = await import(pathToFileURL(filePath).href);
    return mod.default ?? mod;
  }

  // Transpile .ts config via esbuild before importing
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [filePath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });

  const tmpFile = resolve(tmpdir(), `git-glimpse-config-${Date.now()}.mjs`);
  try {
    writeFileSync(tmpFile, result.outputFiles[0].text);
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
  };
}
