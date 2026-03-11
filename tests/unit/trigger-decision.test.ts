import { describe, it, expect } from 'vitest';
import { evaluateTrigger } from '../../packages/core/src/trigger/index.js';
import type { DiffFile } from '../../packages/core/src/analyzer/diff-parser.js';
import type { TriggerConfig } from '../../packages/core/src/config/schema.js';

function makeFile(path: string, additions = 10, deletions = 2): DiffFile {
  return { path, changeType: 'modified', hunks: [], additions, deletions };
}

const BASE_CONFIG: TriggerConfig = {
  mode: 'auto',
  threshold: 5,
  commentCommand: '/glimpse',
  skipComment: true,
};

const UI_FILES = [makeFile('app/routes/home.tsx'), makeFile('src/components/Button.tsx')];
const NON_UI_FILES = [makeFile('README.md'), makeFile('package.json')];

describe('evaluateTrigger', () => {
  describe('auto mode', () => {
    it('runs when UI files are present', () => {
      const decision = evaluateTrigger({
        files: UI_FILES,
        triggerConfig: BASE_CONFIG,
        eventType: 'push',
      });
      expect(decision.shouldRun).toBe(true);
      expect(decision.triggerSource).toBe('auto');
    });

    it('skips when no UI files are present', () => {
      const decision = evaluateTrigger({
        files: NON_UI_FILES,
        triggerConfig: BASE_CONFIG,
        eventType: 'push',
      });
      expect(decision.shouldRun).toBe(false);
      expect(decision.reason).toContain('No UI-relevant files');
    });

    it('skips when diff is empty', () => {
      const decision = evaluateTrigger({
        files: [],
        triggerConfig: BASE_CONFIG,
        eventType: 'push',
      });
      expect(decision.shouldRun).toBe(false);
    });
  });

  describe('on-demand mode', () => {
    const onDemandConfig: TriggerConfig = { ...BASE_CONFIG, mode: 'on-demand' };

    it('skips on push events', () => {
      const decision = evaluateTrigger({
        files: UI_FILES,
        triggerConfig: onDemandConfig,
        eventType: 'push',
      });
      expect(decision.shouldRun).toBe(false);
      expect(decision.reason).toContain('On-demand mode');
    });

    it('runs on comment events', () => {
      const decision = evaluateTrigger({
        files: UI_FILES,
        triggerConfig: onDemandConfig,
        eventType: 'comment',
        command: { force: false },
      });
      expect(decision.shouldRun).toBe(true);
      expect(decision.triggerSource).toBe('comment');
    });

    it('hint includes command in skip reason', () => {
      const decision = evaluateTrigger({
        files: UI_FILES,
        triggerConfig: { ...onDemandConfig, commentCommand: '/demo' },
        eventType: 'push',
      });
      expect(decision.reason).toContain('/demo');
    });
  });

  describe('smart mode', () => {
    const smartConfig: TriggerConfig = { ...BASE_CONFIG, mode: 'smart', threshold: 20 };

    it('skips when change magnitude is below threshold', () => {
      // makeFile defaults: 10 additions + 2 deletions = 12 per file
      const smallChange = [makeFile('app/routes/home.tsx', 3, 2)]; // magnitude = 5
      const decision = evaluateTrigger({
        files: smallChange,
        triggerConfig: smartConfig,
        eventType: 'push',
      });
      expect(decision.shouldRun).toBe(false);
      expect(decision.reason).toContain('threshold');
    });

    it('runs when change magnitude meets threshold', () => {
      const largeChange = [makeFile('app/routes/home.tsx', 15, 10)]; // magnitude = 25
      const decision = evaluateTrigger({
        files: largeChange,
        triggerConfig: smartConfig,
        eventType: 'push',
      });
      expect(decision.shouldRun).toBe(true);
    });
  });

  describe('force flag', () => {
    it('overrides on-demand mode on push event', () => {
      const decision = evaluateTrigger({
        files: NON_UI_FILES,
        triggerConfig: { ...BASE_CONFIG, mode: 'on-demand' },
        eventType: 'push',
        command: { force: true },
      });
      expect(decision.shouldRun).toBe(true);
      expect(decision.triggerSource).toBe('force');
    });

    it('overrides smart mode threshold', () => {
      const smallChange = [makeFile('app/routes/home.tsx', 1, 1)];
      const decision = evaluateTrigger({
        files: smallChange,
        triggerConfig: { ...BASE_CONFIG, mode: 'smart', threshold: 100 },
        eventType: 'push',
        command: { force: true },
      });
      expect(decision.shouldRun).toBe(true);
      expect(decision.triggerSource).toBe('force');
    });

    it('overrides file filter', () => {
      const decision = evaluateTrigger({
        files: NON_UI_FILES,
        triggerConfig: BASE_CONFIG,
        eventType: 'push',
        command: { force: true },
      });
      expect(decision.shouldRun).toBe(true);
    });
  });

  describe('comment event without force', () => {
    it('always runs on comment event in auto mode', () => {
      const decision = evaluateTrigger({
        files: NON_UI_FILES,
        triggerConfig: BASE_CONFIG,
        eventType: 'comment',
        command: { force: false },
      });
      expect(decision.shouldRun).toBe(true);
      expect(decision.triggerSource).toBe('comment');
    });
  });
});
