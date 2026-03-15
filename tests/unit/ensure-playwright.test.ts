import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock node:fs — keep real join/path but control existsSync and readdirSync
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

// Mock node:module — control createRequire
vi.mock('node:module', () => ({
  createRequire: vi.fn(),
}));

// Mock node:os
vi.mock('node:os', () => ({
  homedir: () => '/mock-home',
  tmpdir: () => '/mock-tmp',
}));

import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ensurePlaywright } from '../../packages/core/src/recorder/ensure-playwright.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockExecFileSync = vi.mocked(execFileSync);
const mockCreateRequire = vi.mocked(createRequire);

const fakePw = { chromium: { launch: vi.fn() } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('ensurePlaywright', () => {
  it('returns playwright from consumer node_modules when available', async () => {
    const fakeRequire = vi.fn().mockReturnValue(fakePw);
    mockCreateRequire.mockReturnValue(fakeRequire as any);

    const result = await ensurePlaywright();

    expect(result).toBe(fakePw);
    expect(mockCreateRequire).toHaveBeenCalledTimes(1);
    expect(String(mockCreateRequire.mock.calls[0][0])).toContain('package.json');
    // Should NOT run npm install
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('auto-installs when consumer does not have playwright', async () => {
    const consumerRequire = vi.fn().mockImplementation(() => {
      throw new Error('MODULE_NOT_FOUND');
    });
    const cacheRequire = vi.fn().mockReturnValue(fakePw);

    mockCreateRequire
      .mockReturnValueOnce(consumerRequire as any)
      .mockReturnValueOnce(cacheRequire as any);

    // Playwright package.json not yet in cache; Chromium is already present
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      if (path.includes('@playwright')) return false;
      if (path.includes('ms-playwright')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['chromium-1234'] as any);

    const result = await ensurePlaywright();

    expect(result).toBe(fakePw);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'npm',
      expect.arrayContaining(['install', '@playwright/test']),
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('skips npm install when playwright is already cached', async () => {
    const consumerRequire = vi.fn().mockImplementation(() => {
      throw new Error('MODULE_NOT_FOUND');
    });
    const cacheRequire = vi.fn().mockReturnValue(fakePw);

    mockCreateRequire
      .mockReturnValueOnce(consumerRequire as any)
      .mockReturnValueOnce(cacheRequire as any);

    // Everything already exists
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['chromium-1234'] as any);

    const result = await ensurePlaywright();

    expect(result).toBe(fakePw);
    // No npm install, no playwright install
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('installs chromium when browser cache is missing', async () => {
    const consumerRequire = vi.fn().mockImplementation(() => {
      throw new Error('MODULE_NOT_FOUND');
    });
    const cacheRequire = vi.fn().mockReturnValue(fakePw);

    mockCreateRequire
      .mockReturnValueOnce(consumerRequire as any)
      .mockReturnValueOnce(cacheRequire as any);

    const cacheDir = join('/mock-home', '.cache', 'git-glimpse', 'playwright');

    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      // Package is installed but chromium cache doesn't exist
      if (path.includes('@playwright')) return true;
      if (path.includes('ms-playwright')) return false;
      return false;
    });

    const result = await ensurePlaywright();

    expect(result).toBe(fakePw);
    // Should have called playwright install chromium
    expect(mockExecFileSync).toHaveBeenCalledWith(
      join(cacheDir, 'node_modules', '.bin', 'playwright'),
      ['install', 'chromium', '--with-deps'],
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });
});
