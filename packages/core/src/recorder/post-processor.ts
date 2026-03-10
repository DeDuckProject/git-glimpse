import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

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

  ensureFfmpeg();

  const outputName = basename(inputPath, '.webm') + '.' + format;
  const outputPath = join(outputDir, outputName);

  if (format === 'gif') {
    await convertToGif(inputPath, outputPath, options.viewport);
  } else if (format === 'mp4') {
    await convertToMp4(inputPath, outputPath);
  } else {
    // webm — just copy/trim
    await trimWebm(inputPath, outputPath);
  }

  const sizeMB = await getFileSizeMB(outputPath);
  return { outputPath, format, sizeMB };
}

async function convertToGif(input: string, output: string, viewport: { width: number; height: number }): Promise<void> {
  const targetWidth = Math.min(viewport.width / 2, 960); // max 960px, half for retina

  // Two-pass GIF: generate palette then use it for quality
  const palettePath = output.replace('.gif', '-palette.png');

  execFileSync('ffmpeg', [
    '-i', input,
    '-vf', `fps=12,scale=${targetWidth}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    '-y', palettePath,
  ]);

  execFileSync('ffmpeg', [
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

async function convertToMp4(input: string, output: string): Promise<void> {
  execFileSync('ffmpeg', [
    '-i', input,
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', output,
  ]);
}

async function trimWebm(input: string, output: string): Promise<void> {
  execFileSync('ffmpeg', [
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

function ensureFfmpeg(): void {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      'ffmpeg is required but not found. Install it with:\n' +
        '  Ubuntu/Debian: apt-get install ffmpeg\n' +
        '  macOS: brew install ffmpeg'
    );
  }
}
