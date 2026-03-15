import type { GitGlimpseConfig, AppConfig, ResolvedEntryPoint, EntryPointUrl } from '@git-glimpse/core';

function resolveAppUrl(
  app: AppConfig,
  previewUrlOverride?: string
): { url: string; error?: never } | { url?: never; error: string } {
  const previewUrl = previewUrlOverride ?? app.previewUrl;
  if (previewUrl) {
    const resolved = process.env[previewUrl];
    if (resolved === undefined) {
      // previewUrl is a literal URL string, not an env var name
      if (previewUrl.startsWith('http')) return { url: previewUrl };
      return {
        error:
          `previewUrl is set to "${previewUrl}" but it doesn't look like a URL and no env var with that name was found. ` +
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
  if (app.readyWhen?.url) {
    const u = new URL(app.readyWhen.url);
    return { url: u.origin };
  }
  return { url: 'http://localhost:3000' };
}

/** Resolve base URL for a single-app config (backward compat). */
export function resolveBaseUrl(
  config: GitGlimpseConfig,
  previewUrlOverride?: string
): { url: string; error?: never } | { url?: never; error: string } {
  const app = Array.isArray(config.app) ? config.app[0] : config.app;
  return resolveAppUrl(app, previewUrlOverride);
}

/** Resolve base URLs for all entry points. */
export function resolveEntryPointUrls(
  entryPoints: ResolvedEntryPoint[],
  previewUrlOverride?: string,
): { entryPoints: EntryPointUrl[]; error?: never } | { entryPoints?: never; error: string } {
  const result: EntryPointUrl[] = [];

  for (const ep of entryPoints) {
    // Only apply the override to the first/default entry point
    const override = result.length === 0 ? previewUrlOverride : undefined;
    const resolved = resolveAppUrl(ep, override);
    if (resolved.error) {
      return { error: `Entry point "${ep.name}": ${resolved.error}` };
    }
    result.push({ name: ep.name, baseUrl: resolved.url });
  }

  return { entryPoints: result };
}
