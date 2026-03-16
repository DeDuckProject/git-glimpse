export { runPipeline } from './pipeline.js';
export type { PipelineOptions, DemoResult, EntryPointUrl } from './pipeline.js';

export { loadConfig, parseConfig } from './config/loader.js';
export { DEFAULT_TRIGGER, DEFAULT_RECORDING, DEFAULT_LLM } from './config/defaults.js';
export { normalizeConfig } from './config/normalize.js';
export type { NormalizedConfig, ResolvedEntryPoint, NormalizedRouteMap } from './config/normalize.js';
export type {
  GitGlimpseConfig,
  AppConfig,
  EntryPoint,
  RouteMapValue,
  RecordingConfig,
  LLMConfig,
  TriggerConfig,
} from './config/schema.js';

export { parseDiff, isUIFile } from './analyzer/diff-parser.js';
export type { ParsedDiff, DiffFile, DiffHunk } from './analyzer/diff-parser.js';

export { detectRoutes } from './analyzer/route-detector.js';
export type { RouteMapping } from './analyzer/route-detector.js';

export { summarizeChanges } from './analyzer/change-summarizer.js';
export type { ChangeAnalysis } from './analyzer/change-summarizer.js';

export { generateDemoScript } from './generator/script-generator.js';
export { postPRComment, postSkipComment } from './publisher/github-comment.js';
export { uploadArtifact, uploadToGitHubAssets } from './publisher/storage.js';
export type { UploadResult } from './publisher/storage.js';

export {
  evaluateTrigger,
  parseGlimpseCommand,
  filterUIFiles,
  computeChangeMagnitude,
} from './trigger/index.js';
export type { TriggerDecision, GlimpseCommand } from './trigger/index.js';
