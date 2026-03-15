import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../../packages/core/src/analyzer/diff-parser.js', () => ({
  parseDiff: vi.fn(),
}));
vi.mock('../../packages/core/src/trigger/file-filter.js', () => ({
  filterUIFiles: vi.fn(),
}));
vi.mock('../../packages/core/src/analyzer/route-detector.js', () => ({
  detectRoutes: vi.fn(),
}));
vi.mock('../../packages/core/src/analyzer/change-summarizer.js', () => ({
  summarizeChanges: vi.fn(),
}));
vi.mock('../../packages/core/src/generator/script-generator.js', () => ({
  generateDemoScript: vi.fn(),
}));
vi.mock('../../packages/core/src/recorder/playwright-runner.js', () => ({
  runScriptAndRecord: vi.fn(),
}));
vi.mock('../../packages/core/src/recorder/post-processor.js', () => ({
  postProcess: vi.fn(),
}));
vi.mock('../../packages/core/src/recorder/fallback.js', () => ({
  takeScreenshots: vi.fn(),
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

import { runPipeline } from '../../packages/core/src/pipeline.js';
import { parseDiff } from '../../packages/core/src/analyzer/diff-parser.js';
import { filterUIFiles } from '../../packages/core/src/trigger/file-filter.js';
import { detectRoutes } from '../../packages/core/src/analyzer/route-detector.js';
import { summarizeChanges } from '../../packages/core/src/analyzer/change-summarizer.js';
import { generateDemoScript } from '../../packages/core/src/generator/script-generator.js';
import { runScriptAndRecord } from '../../packages/core/src/recorder/playwright-runner.js';
import { postProcess } from '../../packages/core/src/recorder/post-processor.js';
import { takeScreenshots } from '../../packages/core/src/recorder/fallback.js';
import type { GitGlimpseConfig } from '../../packages/core/src/config/schema.js';

const CONFIG: GitGlimpseConfig = {
  app: {},
  recording: { viewport: { width: 1280, height: 720 }, format: 'gif', maxDuration: 30, deviceScaleFactor: 2, showMouseClicks: true },
  llm: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  trigger: { mode: 'auto', threshold: 5, commentCommand: '/glimpse', skipComment: true },
};

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
  });

  it('returns early when no UI files in diff (non-generalDemo)', async () => {
    vi.mocked(parseDiff).mockReturnValue({
      files: [{ path: 'README.md', changeType: 'modified', hunks: [], additions: 1, deletions: 0 }],
      rawDiff: 'diff...',
    });
    vi.mocked(filterUIFiles).mockReturnValue([]);

    const result = await runPipeline({
      diff: 'diff...',
      entryPoints: [{ name: 'default', baseUrl: 'http://localhost:3000' }],
      config: CONFIG,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No UI files detected in diff');
    expect(result.attempts).toBe(0);
    expect(generateDemoScript).not.toHaveBeenCalled();
  });

  it('runs full pipeline successfully', async () => {
    vi.mocked(parseDiff).mockReturnValue({
      files: [{ path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 }],
      rawDiff: 'diff...',
    });
    vi.mocked(filterUIFiles).mockReturnValue([
      { path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 },
    ]);
    vi.mocked(detectRoutes).mockReturnValue([
      { file: 'app/routes/home.tsx', route: '/', entry: 'default', changeType: 'modified' },
    ]);
    vi.mocked(summarizeChanges).mockResolvedValue({
      changedFiles: ['app/routes/home.tsx'],
      affectedRoutes: [{ file: 'app/routes/home.tsx', route: '/', entry: 'default', changeType: 'modified' }],
      changeDescription: 'Updated home page',
      suggestedDemoFlow: 'Navigate to home',
    });
    vi.mocked(generateDemoScript).mockResolvedValue({
      script: 'export async function demo(page) {}',
      attempts: 1,
      errors: [],
    });
    vi.mocked(runScriptAndRecord).mockResolvedValue({
      videoPath: '/tmp/video.webm',
      duration: 5,
    });
    vi.mocked(postProcess).mockResolvedValue({
      outputPath: '/tmp/video.gif',
      format: 'gif',
      sizeMB: 1.5,
    });

    const result = await runPipeline({
      diff: 'diff...',
      entryPoints: [{ name: 'default', baseUrl: 'http://localhost:3000' }],
      config: CONFIG,
    });

    expect(result.success).toBe(true);
    expect(result.recording).toEqual({
      path: '/tmp/video.gif',
      format: 'gif',
      duration: 5,
      sizeMB: 1.5,
    });
    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('falls back to screenshots when recording fails', async () => {
    vi.mocked(parseDiff).mockReturnValue({
      files: [{ path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 }],
      rawDiff: 'diff...',
    });
    vi.mocked(filterUIFiles).mockReturnValue([
      { path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 },
    ]);
    vi.mocked(detectRoutes).mockReturnValue([]);
    vi.mocked(summarizeChanges).mockResolvedValue({
      changedFiles: ['app/routes/home.tsx'],
      affectedRoutes: [],
      changeDescription: 'Changes',
      suggestedDemoFlow: 'Demo',
    });
    vi.mocked(generateDemoScript).mockResolvedValue({
      script: 'export async function demo(page) {}',
      attempts: 1,
      errors: [],
    });
    vi.mocked(runScriptAndRecord).mockRejectedValue(new Error('Browser crashed'));
    vi.mocked(takeScreenshots).mockResolvedValue({
      screenshots: ['/tmp/screenshot-home.png'],
    });

    const result = await runPipeline({
      diff: 'diff...',
      entryPoints: [{ name: 'default', baseUrl: 'http://localhost:3000' }],
      config: CONFIG,
    });

    expect(result.success).toBe(false);
    expect(result.screenshots).toEqual(['/tmp/screenshot-home.png']);
    expect(result.errors).toContain('Recording failed: Browser crashed');
  });

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env['ANTHROPIC_API_KEY'];

    vi.mocked(parseDiff).mockReturnValue({
      files: [{ path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 }],
      rawDiff: 'diff...',
    });
    vi.mocked(filterUIFiles).mockReturnValue([
      { path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 },
    ]);
    vi.mocked(detectRoutes).mockReturnValue([]);

    await expect(runPipeline({
      diff: 'diff...',
      entryPoints: [{ name: 'default', baseUrl: 'http://localhost:3000' }],
      config: CONFIG,
    })).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('skips UI file filtering when generalDemo is true', async () => {
    vi.mocked(parseDiff).mockReturnValue({
      files: [{ path: 'config.json', changeType: 'modified', hunks: [], additions: 1, deletions: 0 }],
      rawDiff: 'diff...',
    });
    vi.mocked(detectRoutes).mockReturnValue([]);
    vi.mocked(summarizeChanges).mockResolvedValue({
      changedFiles: ['config.json'],
      affectedRoutes: [],
      changeDescription: 'Config changed',
      suggestedDemoFlow: 'Overview',
    });
    vi.mocked(generateDemoScript).mockResolvedValue({
      script: 'export async function demo(page) {}',
      attempts: 1,
      errors: [],
    });
    vi.mocked(runScriptAndRecord).mockResolvedValue({
      videoPath: '/tmp/video.webm',
      duration: 3,
    });
    vi.mocked(postProcess).mockResolvedValue({
      outputPath: '/tmp/video.gif',
      format: 'gif',
      sizeMB: 0.5,
    });

    const result = await runPipeline({
      diff: 'diff...',
      entryPoints: [{ name: 'default', baseUrl: 'http://localhost:3000' }],
      config: CONFIG,
      generalDemo: true,
    });

    expect(result.success).toBe(true);
    expect(filterUIFiles).not.toHaveBeenCalled();
  });

  it('accumulates errors from script generation', async () => {
    vi.mocked(parseDiff).mockReturnValue({
      files: [{ path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 }],
      rawDiff: 'diff...',
    });
    vi.mocked(filterUIFiles).mockReturnValue([
      { path: 'app/routes/home.tsx', changeType: 'modified', hunks: [], additions: 10, deletions: 2 },
    ]);
    vi.mocked(detectRoutes).mockReturnValue([]);
    vi.mocked(summarizeChanges).mockResolvedValue({
      changedFiles: ['app/routes/home.tsx'],
      affectedRoutes: [],
      changeDescription: 'Changes',
      suggestedDemoFlow: 'Demo',
    });
    vi.mocked(generateDemoScript).mockResolvedValue({
      script: 'export async function demo(page) {}',
      attempts: 2,
      errors: ['Attempt 1: validation failed'],
    });
    vi.mocked(runScriptAndRecord).mockResolvedValue({
      videoPath: '/tmp/video.webm',
      duration: 5,
    });
    vi.mocked(postProcess).mockResolvedValue({
      outputPath: '/tmp/video.gif',
      format: 'gif',
      sizeMB: 1,
    });

    const result = await runPipeline({
      diff: 'diff...',
      entryPoints: [{ name: 'default', baseUrl: 'http://localhost:3000' }],
      config: CONFIG,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toContain('Attempt 1: validation failed');
    expect(result.attempts).toBe(2);
  });
});
