import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

/**
 * Resolves @playwright/test, installing it automatically if the consumer project
 * does not have it as a dependency. This allows git-glimpse to work in projects
 * that have no existing Playwright setup.
 *
 * Resolution order:
 *   1. Consumer's own node_modules (process.cwd()) — respects their pinned version
 *   2. ~/.cache/git-glimpse/playwright — auto-installed fallback
 */
export async function ensurePlaywright(): Promise<typeof import('@playwright/test')> {
  // 1. Try resolving from the consumer's project first
  try {
    const req = createRequire(join(process.cwd(), 'package.json'));
    return req('@playwright/test') as typeof import('@playwright/test');
  } catch {
    // Consumer doesn't have @playwright/test — fall through to auto-install
  }

  // 2. Determine a stable install directory
  const installDir = resolveInstallDir();
  const playwrightPkgPath = join(installDir, 'node_modules', '@playwright', 'test', 'package.json');

  if (!existsSync(playwrightPkgPath)) {
    console.info('[git-glimpse] @playwright/test not found in consumer project. Installing...');
    console.info(`[git-glimpse] Install directory: ${installDir}`);

    execFileSync('npm', ['install', '--prefix', installDir, '--no-save', '@playwright/test'], {
      stdio: 'inherit',
    });

    console.info('[git-glimpse] @playwright/test installed successfully.');
  }

  // 3. Resolve the module from our install dir
  const req = createRequire(join(installDir, 'package.json'));
  const pw = req('@playwright/test') as typeof import('@playwright/test');

  // 4. Ensure Chromium browser binaries are installed
  await ensureChromium(installDir);

  return pw;
}

function resolveInstallDir(): string {
  try {
    const dir = join(homedir(), '.cache', 'git-glimpse', 'playwright');
    // Quick writable check by resolving the path (actual write happens in npm install)
    return dir;
  } catch {
    return join(tmpdir(), 'git-glimpse-playwright');
  }
}

async function ensureChromium(installDir: string): Promise<void> {
  // Check if Chromium is already installed by looking for the ms-playwright cache
  const msPlaywrightCache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(msPlaywrightCache)) {
    const entries = await import('node:fs').then((fs) =>
      fs.readdirSync(msPlaywrightCache).filter((e) => e.startsWith('chromium'))
    );
    if (entries.length > 0) {
      return; // Chromium already cached
    }
  }

  console.info('[git-glimpse] Installing Playwright Chromium browser...');

  // Use the playwright CLI from our install dir to install chromium
  const playwrightCli = join(installDir, 'node_modules', '.bin', 'playwright');
  execFileSync(playwrightCli, ['install', 'chromium', '--with-deps'], {
    stdio: 'inherit',
  });

  console.info('[git-glimpse] Chromium installed.');
}
