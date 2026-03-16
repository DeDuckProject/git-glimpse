import Anthropic from '@anthropic-ai/sdk';
import { parseDiff } from './analyzer/diff-parser.js';
import { filterUIFiles } from './trigger/file-filter.js';
import { detectRoutes } from './analyzer/route-detector.js';
import { summarizeChanges } from './analyzer/change-summarizer.js';
import { generateDemoScript } from './generator/script-generator.js';
import { runScriptAndRecord } from './recorder/playwright-runner.js';
import { postProcess } from './recorder/post-processor.js';
import { takeScreenshots } from './recorder/fallback.js';
import { normalizeConfig } from './config/normalize.js';
import type { GitGlimpseConfig } from './config/schema.js';
import type { ChangeAnalysis } from './analyzer/change-summarizer.js';

export interface EntryPointUrl {
  name: string;
  baseUrl: string;
}

export interface PipelineOptions {
  diff: string;
  entryPoints: EntryPointUrl[];
  outputDir?: string;
  config: GitGlimpseConfig;
  /** When true, skip UI-file filtering and run a general app overview demo. */
  generalDemo?: boolean;
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
  const { diff, entryPoints, config, generalDemo = false } = options;
  const outputDir = options.outputDir ?? './recordings';
  const errors: string[] = [];

  const normalized = normalizeConfig(config);
  const recording = normalized.recording;
  const llm = normalized.llm;

  // 1. Parse diff
  const parsedDiff = parseDiff(diff);

  if (!generalDemo) {
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
  }

  // 2. Detect routes
  const routes = detectRoutes(parsedDiff, {
    routeMap: normalized.routeMap,
    defaultEntry: entryPoints[0].name,
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
    entryPoints,
    config,
    generalDemo
  );
  errors.push(...genErrors);

  // 6. Record
  try {
    const recordingResult = await runScriptAndRecord({
      script,
      entryPoints,
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
    const fallback = await takeScreenshots(entryPoints, routes, recording, outputDir);

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
