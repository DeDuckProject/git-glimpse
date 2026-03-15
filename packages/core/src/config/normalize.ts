import type { GitGlimpseConfig, AppConfig, EntryPoint } from './schema.js';

export interface ResolvedEntryPoint {
  name: string;
  startCommand?: string;
  readyWhen?: { url: string; status: number; timeout: number };
  previewUrl?: string;
  env?: Record<string, string>;
  hint?: string;
}

export interface NormalizedRouteEntry {
  entry: string;
  route: string;
}

export interface NormalizedRouteMap {
  [glob: string]: NormalizedRouteEntry;
}

export interface NormalizedConfig {
  entryPoints: ResolvedEntryPoint[];
  routeMap: NormalizedRouteMap;
  setup?: string;
  recording: NonNullable<GitGlimpseConfig['recording']>;
  llm: NonNullable<GitGlimpseConfig['llm']>;
  trigger: NonNullable<GitGlimpseConfig['trigger']>;
}

function isEntryPointArray(app: AppConfig | EntryPoint[]): app is EntryPoint[] {
  return Array.isArray(app);
}

export function normalizeConfig(config: GitGlimpseConfig): NormalizedConfig {
  // Normalize entry points
  let entryPoints: ResolvedEntryPoint[];
  if (isEntryPointArray(config.app)) {
    entryPoints = config.app.map((ep) => ({ ...ep }));
  } else {
    entryPoints = [{ name: 'default', ...config.app }];
  }

  const defaultEntry = entryPoints[0].name;

  // Normalize routeMap
  const routeMap: NormalizedRouteMap = {};
  if (config.routeMap) {
    for (const [pattern, value] of Object.entries(config.routeMap)) {
      if (typeof value === 'string') {
        routeMap[pattern] = { entry: defaultEntry, route: value };
      } else {
        routeMap[pattern] = { entry: value.entry, route: value.route };
      }
    }
  }

  return {
    entryPoints,
    routeMap,
    setup: config.setup,
    recording: config.recording!,
    llm: config.llm!,
    trigger: config.trigger!,
  };
}
