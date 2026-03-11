import { z } from 'zod';

export const AppConfigSchema = z.object({
  startCommand: z.string().optional(),
  readyWhen: z
    .object({
      url: z.string().url(),
      status: z.number().default(200),
      timeout: z.number().default(30000),
    })
    .optional(),
  previewUrl: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export const RecordingConfigSchema = z.object({
  viewport: z
    .object({
      width: z.number().default(1280),
      height: z.number().default(720),
    })
    .default({ width: 1280, height: 720 }),
  format: z.enum(['gif', 'mp4', 'webm']).default('gif'),
  maxDuration: z.number().default(30),
  deviceScaleFactor: z.number().default(2),
  showMouseClicks: z.boolean().default(true),
});

export const LLMConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  model: z.string().default('claude-sonnet-4-6'),
});

export const GitGlimpseConfigSchema = z.object({
  app: AppConfigSchema,
  routeMap: z.record(z.string()).optional(),
  setup: z.string().optional(),
  recording: RecordingConfigSchema.optional(),
  llm: LLMConfigSchema.optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type RecordingConfig = z.infer<typeof RecordingConfigSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type GitGlimpseConfig = z.infer<typeof GitGlimpseConfigSchema>;
