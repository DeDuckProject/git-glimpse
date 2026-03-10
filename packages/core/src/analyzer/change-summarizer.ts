import type Anthropic from '@anthropic-ai/sdk';
import type { ParsedDiff } from './diff-parser.js';
import type { RouteMapping } from './route-detector.js';

export interface ChangeAnalysis {
  changedFiles: string[];
  affectedRoutes: RouteMapping[];
  changeDescription: string;
  suggestedDemoFlow: string;
}

export async function summarizeChanges(
  client: Anthropic,
  diff: ParsedDiff,
  routes: RouteMapping[],
  model: string
): Promise<ChangeAnalysis> {
  const changedFiles = diff.files.map((f) => f.path);

  const truncatedDiff = truncateDiff(diff.rawDiff, 8000);

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: buildSummaryPrompt(truncatedDiff, routes),
      },
    ],
  });

  const text = response.content.find((c) => c.type === 'text')?.text ?? '';
  const parsed = parseSummaryResponse(text);

  return {
    changedFiles,
    affectedRoutes: routes,
    changeDescription: parsed.description,
    suggestedDemoFlow: parsed.demoFlow,
  };
}

function buildSummaryPrompt(diff: string, routes: RouteMapping[]): string {
  const routeList =
    routes.length > 0
      ? routes.map((r) => `  - ${r.file} → ${r.route}`).join('\n')
      : '  (no routes detected automatically)';

  return `Analyze this code diff and provide a brief summary of the UI changes for a demo video.

Affected routes:
${routeList}

Diff:
\`\`\`
${diff}
\`\`\`

Respond with exactly this JSON format:
{
  "description": "One or two sentences describing what UI changed and what it does",
  "demoFlow": "Step-by-step natural language description of how to demo this change (3-5 steps max)"
}`;
}

function parseSummaryResponse(text: string): { description: string; demoFlow: string } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: parsed.description ?? 'UI changes detected.',
        demoFlow: parsed.demoFlow ?? 'Navigate to the affected page and interact with the changes.',
      };
    } catch {
      // fall through to default
    }
  }

  return {
    description: 'UI changes detected.',
    demoFlow: 'Navigate to the affected page and interact with the changes.',
  };
}

function truncateDiff(diff: string, maxChars: number): string {
  if (diff.length <= maxChars) return diff;
  return diff.slice(0, maxChars) + '\n... (diff truncated)';
}
