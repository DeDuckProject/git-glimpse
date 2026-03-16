#!/usr/bin/env node
import { program } from 'commander';
import { loadConfig, runPipeline, normalizeConfig } from '@git-glimpse/core';
import type { EntryPointUrl } from '@git-glimpse/core';
import { execSync, execFile } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

/**
 * Parse --url values into entry points.
 * Supports:
 *   --url http://localhost:3000              (single URL, backward compat)
 *   --url admin=http://localhost:3000        (named entry point)
 *   --url admin=http://localhost:3000 --url storefront=http://localhost:4000
 */
function parseUrlOptions(urls: string[] | undefined, config: ReturnType<typeof normalizeConfig>): EntryPointUrl[] {
  if (!urls || urls.length === 0) {
    // Fall back to config
    return config.entryPoints.map((ep) => {
      const baseUrl = ep.previewUrl
        ?? ep.readyWhen?.url?.replace(/\/[^/]*$/, '')
        ?? 'http://localhost:3000';
      return { name: ep.name, baseUrl };
    });
  }

  return urls.map((raw, i) => {
    const eqIndex = raw.indexOf('=');
    if (eqIndex > 0 && !raw.startsWith('http')) {
      // name=url format
      return { name: raw.slice(0, eqIndex), baseUrl: raw.slice(eqIndex + 1) };
    }
    // Plain URL — use default or positional name
    const name = config.entryPoints[i]?.name ?? 'default';
    return { name, baseUrl: raw };
  });
}

program
  .name('git-glimpse')
  .description('Auto-generate visual demo clips of UI changes')
  .version(pkg.version);

program
  .command('run')
  .description('Generate a demo clip for the current working tree changes')
  .option('-d, --diff <diff>', 'Git ref or diff (e.g. HEAD~1, main..HEAD)')
  .option('-u, --url <url...>', 'Base URL(s) of the running app (e.g. http://localhost:3000 or admin=http://localhost:3000)')
  .option('-c, --config <path>', 'Path to git-glimpse.config.ts')
  .option('-o, --output <dir>', 'Output directory for recordings', './recordings')
  .option('--open', 'Open the recording after generation')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const normalized = normalizeConfig(config);

      // Get diff
      const diffRef = options.diff ?? 'HEAD~1';
      let diff: string;
      if (existsSync(diffRef)) {
        diff = readFileSync(diffRef, 'utf-8');
      } else {
        // diffRef is a git ref like HEAD~1, safe to pass as argument
        diff = execSync(`git diff ${diffRef}`, { encoding: 'utf-8' });
      }

      if (!diff.trim()) {
        console.error('No diff found. Did you forget to commit? Try: git-glimpse run --diff HEAD~1');
        process.exit(1);
      }

      const entryPoints = parseUrlOptions(options.url, normalized);

      console.log(`Running git-glimpse...`);
      for (const ep of entryPoints) {
        console.log(`  Entry point "${ep.name}": ${ep.baseUrl}`);
      }
      console.log(`  Diff: ${diffRef}`);
      console.log(`  Output: ${options.output}`);

      const result = await runPipeline({
        diff,
        entryPoints,
        outputDir: options.output,
        config,
      });

      if (result.success && result.recording) {
        console.log(`\n✓ Demo recorded: ${result.recording.path}`);
        console.log(`  Duration: ${result.recording.duration.toFixed(1)}s`);
        console.log(`  Size: ${result.recording.sizeMB.toFixed(1)} MB`);
        console.log(`\nWhat changed: ${result.analysis.changeDescription}`);

        if (options.open) {
          openFile(result.recording.path);
        }
      } else {
        console.warn('\n⚠ Recording failed, screenshots taken as fallback.');
        if (result.screenshots?.length) {
          console.log('Screenshots:', result.screenshots.join(', '));
        }
        if (result.errors.length) {
          console.error('Errors:', result.errors.join('\n'));
        }
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a git-glimpse.config.ts in the current directory')
  .action(async () => {
    const configPath = resolve(process.cwd(), 'git-glimpse.config.ts');
    if (existsSync(configPath)) {
      console.error('git-glimpse.config.ts already exists.');
      process.exit(1);
    }

    const template = `import type { GitGlimpseConfig } from '@git-glimpse/core';

export default {
  app: {
    startCommand: 'npm run dev',
    readyWhen: { url: 'http://localhost:3000' },
  },
  recording: {
    format: 'gif',
    maxDuration: 30,
  },
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
  },
} satisfies GitGlimpseConfig;
`;

    writeFileSync(configPath, template, 'utf-8');
    console.log('Created git-glimpse.config.ts');
    console.log('Next: set ANTHROPIC_API_KEY and run: npx git-glimpse run --diff HEAD~1');
  });

program.parse();

function openFile(filePath: string): void {
  const openCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  execFile(openCmd, [filePath], (err) => {
    if (err) console.warn(`Could not open file: ${err.message}`);
  });
}
