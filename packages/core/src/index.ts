export { runPipeline } from './pipeline.js';
export type { PipelineOptions, DemoResult } from './pipeline.js';

export { loadConfig, parseConfig } from './config/loader.js';
export type { GitGlimpseConfig, AppConfig, RecordingConfig, LLMConfig } from './config/schema.js';

export { parseDiff, isUIFile } from './analyzer/diff-parser.js';
export type { ParsedDiff, DiffFile, DiffHunk } from './analyzer/diff-parser.js';

export { detectRoutes } from './analyzer/route-detector.js';
export type { RouteMapping } from './analyzer/route-detector.js';

export { summarizeChanges } from './analyzer/change-summarizer.js';
export type { ChangeAnalysis } from './analyzer/change-summarizer.js';

export { generateDemoScript } from './generator/script-generator.js';
export { postPRComment } from './publisher/github-comment.js';
