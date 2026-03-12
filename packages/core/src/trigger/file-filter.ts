import { minimatch } from 'minimatch';
import type { DiffFile } from '../analyzer/diff-parser.js';
import { isUIFile } from '../analyzer/diff-parser.js';
import type { TriggerConfig } from '../config/schema.js';

/**
 * Filters diff files to only those relevant for UI demo generation.
 *
 * When trigger.include is set: file must match at least one include glob.
 * When trigger.exclude is set: file must NOT match any exclude glob.
 * When neither is set: falls back to the built-in isUIFile() heuristic.
 */
export function filterUIFiles(files: DiffFile[], triggerConfig?: TriggerConfig): DiffFile[] {
  const { include, exclude } = triggerConfig ?? {};

  if (!include && !exclude) {
    return files.filter((f) => isUIFile(f.path));
  }

  return files.filter((f) => {
    if (include && include.length > 0) {
      const matched = include.some((pattern) => minimatch(f.path, pattern, { matchBase: true }));
      if (!matched) return false;
    }

    if (exclude && exclude.length > 0) {
      const excluded = exclude.some((pattern) => minimatch(f.path, pattern, { matchBase: true }));
      if (excluded) return false;
    }

    return true;
  });
}

/**
 * Computes total change magnitude (additions + deletions) for a set of files.
 */
export function computeChangeMagnitude(files: DiffFile[]): number {
  return files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
}
