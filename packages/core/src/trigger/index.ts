import type { DiffFile } from '../analyzer/diff-parser.js';
import type { TriggerConfig } from '../config/schema.js';
import type { GlimpseCommand } from './command-parser.js';
import { filterUIFiles, computeChangeMagnitude } from './file-filter.js';

export type { GlimpseCommand } from './command-parser.js';
export { parseGlimpseCommand } from './command-parser.js';
export { filterUIFiles, computeChangeMagnitude } from './file-filter.js';

export interface TriggerDecision {
  shouldRun: boolean;
  reason: string;
  matchedFiles: string[];
  triggerSource: 'auto' | 'comment' | 'force';
  /** True when triggered by a config/workflow file change — pipeline runs a general app demo. */
  generalDemo?: boolean;
}

/** Files whose changes should always trigger a general demo run. */
const CONFIG_FILE_PATTERNS = [
  /^git-glimpse\.config\.[jt]s$/,
  /^\.github\/workflows\/.*glimpse.*\.ya?ml$/i,
];

export interface EvaluateTriggerOptions {
  files: DiffFile[];
  triggerConfig: TriggerConfig;
  /** 'push' = PR open/sync event; 'comment' = /glimpse comment */
  eventType: 'push' | 'comment';
  command?: GlimpseCommand | null;
}

/**
 * Decides whether the pipeline should run given the event type, trigger config,
 * and the files changed in the diff.
 */
export function evaluateTrigger(opts: EvaluateTriggerOptions): TriggerDecision {
  const { files, triggerConfig, eventType, command } = opts;

  // Force flag always runs, regardless of mode or file filters
  if (command?.force) {
    return {
      shouldRun: true,
      reason: 'Force flag provided.',
      matchedFiles: files.map((f) => f.path),
      triggerSource: 'force',
    };
  }

  // On-demand comment trigger (without --force) always runs
  if (eventType === 'comment') {
    const matched = filterUIFiles(files, triggerConfig);
    return {
      shouldRun: true,
      reason: 'Triggered via comment command.',
      matchedFiles: matched.map((f) => f.path),
      triggerSource: 'comment',
    };
  }

  // Config/workflow file changes always trigger a general demo, regardless of mode.
  // This lets users validate their git-glimpse setup on a branch before merging.
  const configFiles = files.filter((f) => CONFIG_FILE_PATTERNS.some((p) => p.test(f.path)));
  if (configFiles.length > 0) {
    return {
      shouldRun: true,
      reason: `git-glimpse configuration changed (${configFiles.map((f) => f.path).join(', ')}). Running a general app demo to validate the setup.`,
      matchedFiles: configFiles.map((f) => f.path),
      triggerSource: 'auto',
      generalDemo: true,
    };
  }

  // Push event + on-demand mode: skip and wait for explicit trigger
  if (triggerConfig.mode === 'on-demand') {
    return {
      shouldRun: false,
      reason: `On-demand mode is enabled. Comment \`${triggerConfig.commentCommand}\` on this PR to generate a demo.`,
      matchedFiles: [],
      triggerSource: 'auto',
    };
  }

  // Filter to UI-relevant files
  const matched = filterUIFiles(files, triggerConfig);

  if (matched.length === 0) {
    return {
      shouldRun: false,
      reason: `No UI-relevant files detected in this diff. Comment \`${triggerConfig.commentCommand} --force\` to generate a demo anyway.`,
      matchedFiles: [],
      triggerSource: 'auto',
    };
  }

  // Smart mode: check change magnitude threshold
  if (triggerConfig.mode === 'smart') {
    const magnitude = computeChangeMagnitude(matched);
    if (magnitude < triggerConfig.threshold) {
      return {
        shouldRun: false,
        reason: `Changes are below the threshold (${magnitude}/${triggerConfig.threshold} lines changed). Comment \`${triggerConfig.commentCommand} --force\` to generate a demo anyway.`,
        matchedFiles: matched.map((f) => f.path),
        triggerSource: 'auto',
      };
    }
  }

  return {
    shouldRun: true,
    reason: `${matched.length} UI file(s) changed.`,
    matchedFiles: matched.map((f) => f.path),
    triggerSource: 'auto',
  };
}
