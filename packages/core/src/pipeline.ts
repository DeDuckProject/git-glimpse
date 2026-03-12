import Anthropic from '@anthropic-ai/sdk';
import { parseDiff } from './analyzer/diff-parser.js';
import { filterUIFiles } from './trigger/file-filter.js';
import { detectRoutes } from './analyzer/route-detector.js';
import { summarizeChanges } from './analyzer/change-summarizer.js';
import { generateDemoScript } from './generator/script-generator.js';
import { runScriptAndRecord } from './recorder/playwright-runner.js';
import { postProcess } from './recorder/post-processor.js';
import { takeScreenshots } from './recorder/fallback.js';
import type { GitGlimpseConfig } from './config/schema.js';
import type { ChangeAnalysis } from './analyzer/change-summarizer.js';

export interface PipelineOptions {
  diff: string;
  baseUrl: string;
  outputDir?: string;
  config: GitGlimpseConfig;
}

export interface DemoResult {
  success: boolean;
  recording?: {
    path: string;
    format: string;
    duration: number;
    sizeMB: number;
  };
  screenshots?: string[];
  script: string;
  analysis: ChangeAnalysis;
  attempts: number;
  errors: string[];
}

export async function runPipeline(options: PipelineOptions): Promise<DemoResult> {
  const { diff, baseUrl, config } = options;
  const outputDir = options.outputDir ?? './recordings';
  const errors: string[] = [];

  const recording = config.recording ?? {
    viewport: { width: 1280, height: 720 },
    maxDuration: 30,
    format: 'gif' as const,
    deviceScaleFactor: 2,
    showMouseClicks: true,
  };
  const llm = config.llm ?? { provider: 'anthropic' as const, model: 'claude-sonnet-4-6' };

  // 1. Parse diff
  const parsedDiff = parseDiff(diff);
  const uiFiles = filterUIFiles(parsedDiff.files, config.trigger);
  if (uiFiles.length === 0) {
    return {
      success: false,
      script: '',
      analysis: {
        changedFiles: parsedDiff.files.map((f) => f.path),
        affectedRoutes: [],
        changeDescription: 'No UI files changed.',
        suggestedDemoFlow: '',
      },
      attempts: 0,
      errors: ['No UI files detected in diff'],
    };
  }

  // 2. Detect routes
  const routes = detectRoutes(parsedDiff, {
    routeMap: config.routeMap,
    baseUrl,
  });

  // 3. Initialize LLM client
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');
  const client = new Anthropic({ apiKey });

  // 4. Summarize changes
  const analysis = await summarizeChanges(client, parsedDiff, routes, llm.model);

  // 5. Generate script
  const { script, attempts, errors: genErrors } = await generateDemoScript(
    client,
    analysis,
    diff,
    baseUrl,
    config
  );
  errors.push(...genErrors);

  // 6. Record
  try {
    const recordingResult = await runScriptAndRecord({
      script,
      baseUrl,
      recording,
      outputDir,
    });

    const processed = await postProcess({
      inputPath: recordingResult.videoPath,
      outputDir,
      format: recording.format,
      viewport: recording.viewport,
    });

    return {
      success: true,
      recording: {
        path: processed.outputPath,
        format: processed.format,
        duration: recordingResult.duration,
        sizeMB: processed.sizeMB,
      },
      script,
      analysis,
      attempts,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Recording failed: ${message}`);

    // Fallback: screenshots
    const fallback = await takeScreenshots(baseUrl, routes, recording, outputDir);

    return {
      success: false,
      screenshots: fallback.screenshots,
      script,
      analysis,
      attempts,
      errors,
    };
  }
}
