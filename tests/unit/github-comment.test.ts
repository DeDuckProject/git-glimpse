import { describe, it, expect } from 'vitest';
import { buildCommentBody } from '../../packages/core/src/publisher/github-comment.js';
import type { ChangeAnalysis } from '../../packages/core/src/analyzer/change-summarizer.js';

describe('buildCommentBody', () => {
  const ANALYSIS: ChangeAnalysis = {
    changedFiles: ['app/routes/home.tsx', 'src/components/Button.tsx'],
    affectedRoutes: [{ file: 'app/routes/home.tsx', route: '/', changeType: 'modified' }],
    changeDescription: 'Added a virtual try-on button',
    suggestedDemoFlow: '1. Navigate to home page\n2. Click try-on button',
  };

  it('includes comment marker for idempotent updates', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('<!-- git-glimpse-demo -->');
  });

  it('includes recording URL as image when provided', () => {
    const body = buildCommentBody({
      analysis: ANALYSIS,
      recordingUrl: 'https://example.com/demo.gif',
      script: 'demo()',
      owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(body).toContain('![Demo](https://example.com/demo.gif)');
    expect(body).toContain('Open it directly');
  });

  it('includes screenshots when no recording URL', () => {
    const body = buildCommentBody({
      analysis: ANALYSIS,
      screenshots: ['https://example.com/s1.png', 'https://example.com/s2.png'],
      script: 'demo()',
      owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(body).toContain('Screenshot 1');
    expect(body).toContain('Screenshot 2');
    expect(body).not.toContain('No recording available');
  });

  it('shows fallback when neither recording nor screenshots are present', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('No recording available');
  });

  it('truncates file list to 5 and shows count of remaining', () => {
    const manyFilesAnalysis: ChangeAnalysis = {
      ...ANALYSIS,
      changedFiles: ['a.tsx', 'b.tsx', 'c.tsx', 'd.tsx', 'e.tsx', 'f.tsx', 'g.tsx'],
    };
    const body = buildCommentBody({ analysis: manyFilesAnalysis, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('`a.tsx`');
    expect(body).toContain('`e.tsx`');
    expect(body).not.toContain('`f.tsx`');
    expect(body).toContain('+2 more');
  });

  it('shows all files when 5 or fewer', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('`app/routes/home.tsx`');
    expect(body).toContain('`src/components/Button.tsx`');
    expect(body).not.toContain('more');
  });

  it('includes the change description', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('Added a virtual try-on button');
  });

  it('wraps script in collapsible details with typescript code block', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'export async function demo(page) {}', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('<details>');
    expect(body).toContain('Demo script (auto-generated)');
    expect(body).toContain('```typescript');
    expect(body).toContain('export async function demo(page) {}');
  });

  it('includes rerun link when provided', () => {
    const body = buildCommentBody({
      analysis: ANALYSIS,
      script: 'demo()',
      rerunUrl: 'https://github.com/owner/repo/actions/runs/123',
      owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(body).toContain('Re-run demo');
    expect(body).toContain('https://github.com/owner/repo/actions/runs/123');
  });

  it('omits rerun link when not provided', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).not.toContain('Re-run demo');
  });

  it('includes git-glimpse branding', () => {
    const body = buildCommentBody({ analysis: ANALYSIS, script: 'demo()', owner: 'o', repo: 'r', pullNumber: 1 });
    expect(body).toContain('git-glimpse');
    expect(body).toContain('logo_square_small.png');
  });

  it('prefers recording URL over screenshots', () => {
    const body = buildCommentBody({
      analysis: ANALYSIS,
      recordingUrl: 'https://example.com/demo.gif',
      screenshots: ['https://example.com/s1.png'],
      script: 'demo()',
      owner: 'o', repo: 'r', pullNumber: 1,
    });
    expect(body).toContain('![Demo]');
    expect(body).not.toContain('Screenshot 1');
  });
});
