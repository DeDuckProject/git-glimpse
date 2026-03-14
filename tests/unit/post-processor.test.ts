import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'node:os';

// We test the internal helper functions by mocking child_process and fs
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn(),
}));

import { postProcess } from '../../packages/core/src/recorder/post-processor.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';

describe('postProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: ffmpeg found on PATH
    vi.mocked(execFileSync).mockImplementation((cmd: string, args?: readonly string[]) => {
      if (cmd === 'ffmpeg' && args?.[0] === '-version') return Buffer.from('ffmpeg version 5.0');
      return Buffer.from('');
    });

    // Default: output file exists with known size
    vi.mocked(statSync).mockReturnValue({ size: 1048576 } as any); // 1MB
    vi.mocked(existsSync).mockReturnValue(true);
  });

  it('converts to gif using two-pass palette method', async () => {
    const result = await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'gif',
      viewport: { width: 1280, height: 720 },
    });

    expect(result.format).toBe('gif');
    expect(result.outputPath).toBe('/tmp/video.gif');
    expect(result.sizeMB).toBeCloseTo(1.0, 1);

    // Two ffmpeg calls for gif (palette generation + gif creation) + 1 for version check
    const ffmpegCalls = vi.mocked(execFileSync).mock.calls.filter(
      (call) => call[0] === 'ffmpeg' && call[1]?.[0] !== '-version'
    );
    expect(ffmpegCalls).toHaveLength(2);

    // First call should generate palette
    const paletteCall = ffmpegCalls[0]!;
    expect((paletteCall[1] as string[]).join(' ')).toContain('palettegen=stats_mode=diff');

    // Second call should use palette
    const gifCall = ffmpegCalls[1]!;
    expect((gifCall[1] as string[]).join(' ')).toContain('paletteuse');
  });

  it('converts to mp4 with libx264', async () => {
    const result = await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'mp4',
      viewport: { width: 1280, height: 720 },
    });

    expect(result.format).toBe('mp4');
    expect(result.outputPath).toBe('/tmp/video.mp4');

    const ffmpegCalls = vi.mocked(execFileSync).mock.calls.filter(
      (call) => call[0] === 'ffmpeg' && call[1]?.[0] !== '-version'
    );
    expect(ffmpegCalls).toHaveLength(1);
    expect(ffmpegCalls[0]![1]).toContain('libx264');
  });

  it('copies webm without re-encoding', async () => {
    const result = await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'webm',
      viewport: { width: 1280, height: 720 },
    });

    expect(result.format).toBe('webm');

    const ffmpegCalls = vi.mocked(execFileSync).mock.calls.filter(
      (call) => call[0] === 'ffmpeg' && call[1]?.[0] !== '-version'
    );
    expect(ffmpegCalls).toHaveLength(1);
    expect(ffmpegCalls[0]![1]).toContain('copy');
  });

  it('calculates target GIF width as min(viewport/2, 960)', async () => {
    await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'gif',
      viewport: { width: 2560, height: 1440 },
    });

    const ffmpegCalls = vi.mocked(execFileSync).mock.calls.filter(
      (call) => call[0] === 'ffmpeg' && call[1]?.[0] !== '-version'
    );
    // With viewport 2560, target = min(2560/2, 960) = 960
    expect(ffmpegCalls[0]![1]!.join(' ')).toContain('scale=960');
  });

  it('uses half viewport width when smaller than 960', async () => {
    await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'gif',
      viewport: { width: 800, height: 600 },
    });

    const ffmpegCalls = vi.mocked(execFileSync).mock.calls.filter(
      (call) => call[0] === 'ffmpeg' && call[1]?.[0] !== '-version'
    );
    // With viewport 800, target = min(800/2, 960) = 400
    expect(ffmpegCalls[0]![1]!.join(' ')).toContain('scale=400');
  });

  it('cleans up palette file after gif conversion', async () => {
    await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'gif',
      viewport: { width: 1280, height: 720 },
    });

    expect(unlinkSync).toHaveBeenCalledWith('/tmp/video-palette.png');
  });

  it('throws when ffmpeg is not found anywhere', async () => {
    // ffmpeg not on PATH
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not found');
    });
    // No Playwright cache dir
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'gif',
      viewport: { width: 1280, height: 720 },
    })).rejects.toThrow('ffmpeg is required');
  });

  it('falls back to Playwright cache when ffmpeg not on PATH', async () => {
    let callCount = 0;
    vi.mocked(execFileSync).mockImplementation((cmd: string, args?: readonly string[]) => {
      if (cmd === 'ffmpeg' && args?.[0] === '-version') {
        throw new Error('not found');
      }
      return Buffer.from('');
    });

    vi.mocked(existsSync).mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('ms-playwright')) return true;
      if (typeof path === 'string' && path.includes('ffmpeg')) return true;
      return true;
    });
    vi.mocked(readdirSync).mockReturnValue(['ffmpeg-1234'] as any);

    const result = await postProcess({
      inputPath: '/tmp/video.webm',
      outputDir: '/tmp',
      format: 'mp4',
      viewport: { width: 1280, height: 720 },
    });

    expect(result.format).toBe('mp4');
  });
});
