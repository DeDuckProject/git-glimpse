import type { GitGlimpseConfig } from '../../core/src/config/schema.js';

export function resolveBaseUrl(
  config: GitGlimpseConfig,
  previewUrlOverride?: string
): { url: string; error?: never } | { url?: never; error: string } {
  const previewUrl = previewUrlOverride ?? config.app.previewUrl;
  if (previewUrl) {
    const resolved = process.env[previewUrl];
    if (resolved === undefined) {
      // previewUrl is a literal URL string, not an env var name
      if (previewUrl.startsWith('http')) return { url: previewUrl };
      return {
        error:
          `app.previewUrl is set to "${previewUrl}" but it doesn't look like a URL and no env var with that name was found. ` +
          `Set it to a full URL (e.g. "https://my-preview.vercel.app") or an env var name that is available in this workflow job.`,
      };
    }
    if (!resolved.startsWith('http')) {
      return {
        error: `Env var "${previewUrl}" was found but its value "${resolved}" is not a valid URL. Expected a value starting with "http".`,
      };
    }
    return { url: resolved };
  }
  if (config.app.readyWhen?.url) {
    const u = new URL(config.app.readyWhen.url);
    return { url: u.origin };
  }
  return { url: 'http://localhost:3000' };
}
