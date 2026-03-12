import { describe, it, expect } from 'vitest';
import { filterUIFiles, computeChangeMagnitude } from '../../packages/core/src/trigger/file-filter.js';
import type { DiffFile } from '../../packages/core/src/analyzer/diff-parser.js';

function makeFile(path: string, additions = 10, deletions = 2): DiffFile {
  return { path, changeType: 'modified', hunks: [], additions, deletions };
}

describe('filterUIFiles', () => {
  describe('without trigger config (falls back to isUIFile)', () => {
    it('includes tsx files in app/', () => {
      const files = [makeFile('app/routes/home.tsx')];
      expect(filterUIFiles(files)).toHaveLength(1);
    });

    it('excludes test files', () => {
      const files = [makeFile('app/routes/home.test.tsx')];
      expect(filterUIFiles(files)).toHaveLength(0);
    });

    it('excludes markdown files', () => {
      const files = [makeFile('docs/README.md')];
      expect(filterUIFiles(files)).toHaveLength(0);
    });
  });

  describe('with include globs', () => {
    it('includes files matching include pattern', () => {
      const files = [
        makeFile('src/components/Button.tsx'),
        makeFile('src/utils/math.ts'),
      ];
      const result = filterUIFiles(files, {
        mode: 'auto',
        include: ['src/components/**'],
        threshold: 5,
        commentCommand: '/glimpse',
        skipComment: true,
      });
      expect(result.map((f) => f.path)).toEqual(['src/components/Button.tsx']);
    });

    it('excludes files not matching include pattern', () => {
      const files = [makeFile('lib/helpers.ts')];
      const result = filterUIFiles(files, {
        mode: 'auto',
        include: ['src/**'],
        threshold: 5,
        commentCommand: '/glimpse',
        skipComment: true,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('with exclude globs', () => {
    it('excludes files matching exclude pattern', () => {
      const files = [
        makeFile('src/components/Button.tsx'),
        makeFile('src/components/Button.test.tsx'),
      ];
      const result = filterUIFiles(files, {
        mode: 'auto',
        exclude: ['**/*.test.*'],
        threshold: 5,
        commentCommand: '/glimpse',
        skipComment: true,
      });
      expect(result.map((f) => f.path)).toEqual(['src/components/Button.tsx']);
    });
  });

  describe('with both include and exclude', () => {
    it('applies include then exclude', () => {
      const files = [
        makeFile('src/components/Button.tsx'),
        makeFile('src/components/Button.stories.tsx'),
        makeFile('src/utils/math.ts'),
      ];
      const result = filterUIFiles(files, {
        mode: 'auto',
        include: ['src/components/**'],
        exclude: ['**/*.stories.*'],
        threshold: 5,
        commentCommand: '/glimpse',
        skipComment: true,
      });
      expect(result.map((f) => f.path)).toEqual(['src/components/Button.tsx']);
    });
  });

  describe('server files with include globs', () => {
    it('can include server-side files via explicit globs', () => {
      const files = [makeFile('server/api/products.ts')];
      const result = filterUIFiles(files, {
        mode: 'auto',
        include: ['server/api/**'],
        threshold: 5,
        commentCommand: '/glimpse',
        skipComment: true,
      });
      expect(result).toHaveLength(1);
    });
  });
});

describe('computeChangeMagnitude', () => {
  it('sums additions and deletions across all files', () => {
    const files = [makeFile('a.tsx', 10, 5), makeFile('b.tsx', 3, 2)];
    expect(computeChangeMagnitude(files)).toBe(20);
  });

  it('returns 0 for empty file list', () => {
    expect(computeChangeMagnitude([])).toBe(0);
  });
});
