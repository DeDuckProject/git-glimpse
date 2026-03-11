import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import os from 'node:os';

export interface PostProcessOptions {
  inputPath: string;
  outputDir: string;
  format: 'gif' | 'mp4' | 'webm';
  viewport: { width: number; height: number };
  maxSizeMB?: number;
}

export interface PostProcessResult {
  outputPath: string;
  format: string;
  sizeMB: number;
}

export async function postProcess(options: PostProcessOptions): Promise<PostProcessResult> {
  const { inputPath, outputDir, format } = options;

  const ffmpegPath = resolveFfmpegPath();

  const outputName = basename(inputPath, '.webm') + '.' + format;
  const outputPath = join(outputDir, outputName);

  if (format === 'gif') {
    await convertToGif(ffmpegPath, inputPath, outputPath, options.viewport);
  } else if (format === 'mp4') {
    await convertToMp4(ffmpegPath, inputPath, outputPath);
  } else {
    // webm — just copy/trim
    await trimWebm(ffmpegPath, inputPath, outputPath);
  }

  const sizeMB = await getFileSizeMB(outputPath);
  return { outputPath, format, sizeMB };
}

async function convertToGif(ffmpegPath: string, input: string, output: string, viewport: { width: number; height: number }): Promise<void> {
  const targetWidth = Math.min(viewport.width / 2, 960); // max 960px, half for retina

  // Two-pass GIF: generate palette then use it for quality
  const palettePath = output.replace('.gif', '-palette.png');

  execFileSync(ffmpegPath, [
    '-i', input,
    '-vf', `fps=12,scale=${targetWidth}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    '-update', '1',
    '-y', palettePath,
  ]);

  execFileSync(ffmpegPath, [
    '-i', input,
    '-i', palettePath,
    '-filter_complex', `fps=12,scale=${targetWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
    '-loop', '0',
    '-y', output,
  ]);

  // Clean up palette
  const { unlinkSync } = await import('node:fs');
  if (existsSync(palettePath)) unlinkSync(palettePath);
}

async function convertToMp4(ffmpegPath: string, input: string, output: string): Promise<void> {
  execFileSync(ffmpegPath, [
    '-i', input,
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', output,
  ]);
}

async function trimWebm(ffmpegPath: string, input: string, output: string): Promise<void> {
  execFileSync(ffmpegPath, [
    '-i', input,
    '-c', 'copy',
    '-y', output,
  ]);
}

async function getFileSizeMB(filePath: string): Promise<number> {
  const { statSync } = await import('node:fs');
  const { size } = statSync(filePath);
  return size / (1024 * 1024);
}

function resolveFfmpegPath(): string {
  // 1. Try system PATH
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    // not on PATH, try Playwright's bundled copy
  }

  // 2. Scan Playwright's cache directory for its bundled ffmpeg
  const cacheDir = findPlaywrightCacheDir();
  if (cacheDir) {
    const ffmpegPath = scanForFfmpeg(cacheDir);
    if (ffmpegPath) return ffmpegPath;
  }

  throw new Error(
    'ffmpeg is required but not found. Install it with:\n' +
      '  Ubuntu/Debian: apt-get install ffmpeg\n' +
      '  macOS: brew install ffmpeg\n' +
      '  Or run: playwright install chromium (bundles ffmpeg)'
  );
}

function findPlaywrightCacheDir(): string | null {
  // Respect Playwright's env var override
  const envPath = process.env['PLAYWRIGHT_BROWSERS_PATH'];
  if (envPath && envPath !== '0') return envPath;

  const home = os.homedir();
  if (process.platform === 'linux') {
    const xdgCache = process.env['XDG_CACHE_HOME'];
    return xdgCache ? join(xdgCache, 'ms-playwright') : join(home, '.cache', 'ms-playwright');
  }
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Caches', 'ms-playwright');
  }
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local');
    return join(localAppData, 'ms-playwright');
  }
  return null;
}

function scanForFfmpeg(cacheDir: string): string | null {
  if (!existsSync(cacheDir)) return null;
  const entries = readdirSync(cacheDir);
  const ffmpegDir = entries.find((e) => e.startsWith('ffmpeg'));
  if (!ffmpegDir) return null;

  const dir = join(cacheDir, ffmpegDir);
  for (const name of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe', 'ffmpeg']) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
