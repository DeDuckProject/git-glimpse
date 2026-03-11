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
}

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
