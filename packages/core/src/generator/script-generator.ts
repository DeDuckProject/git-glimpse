import Anthropic from '@anthropic-ai/sdk';
import type { ChangeAnalysis } from '../analyzer/change-summarizer.js';
import type { GitGlimpseConfig } from '../config/schema.js';
import { buildScriptGenerationPrompt, buildGeneralDemoPrompt, buildRetryPrompt, type ScriptPromptOptions } from './prompts.js';
import { validateScript } from './validator.js';

const MAX_RETRIES = 2;

export interface ScriptGenerationResult {
  script: string;
  attempts: number;
  errors: string[];
}

export async function generateDemoScript(
  client: Anthropic,
  analysis: ChangeAnalysis,
  rawDiff: string,
  baseUrl: string,
  config: GitGlimpseConfig,
  generalDemo = false
): Promise<ScriptGenerationResult> {
  const recording = config.recording ?? { viewport: { width: 1280, height: 720 }, maxDuration: 30, format: 'gif' as const, deviceScaleFactor: 2 };
  const llm = config.llm ?? { provider: 'anthropic' as const, model: 'claude-sonnet-4-6' };

  const promptOptions: ScriptPromptOptions = {
    baseUrl,
    diff: rawDiff,
    routes: analysis.affectedRoutes,
    demoFlow: analysis.suggestedDemoFlow,
    maxDuration: recording.maxDuration,
    viewport: recording.viewport,
    hint: config.app.hint,
  };

  const errors: string[] = [];
  let lastScript = '';

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const prompt =
      attempt === 1
        ? (generalDemo
            ? buildGeneralDemoPrompt({ baseUrl, maxDuration: recording.maxDuration, viewport: recording.viewport, hint: config.app.hint })
            : buildScriptGenerationPrompt(promptOptions))
        : buildRetryPrompt(lastScript, errors[errors.length - 1] ?? '', '', promptOptions);

    const response = await client.messages.create({
      model: llm.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find((c) => c.type === 'text')?.text ?? '';
    const validation = validateScript(text);

    if (validation.valid) {
      return { script: validation.script, attempts: attempt, errors };
    }

    lastScript = validation.script || text;
    errors.push(`Attempt ${attempt}: ${validation.errors.join('; ')}`);
  }

  // Return best-effort script even if validation failed
  return { script: lastScript, attempts: MAX_RETRIES + 1, errors };
}
