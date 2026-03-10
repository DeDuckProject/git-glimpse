import { minimatch } from 'minimatch';
import type { ParsedDiff } from './diff-parser.js';

export interface RouteMapping {
  file: string;
  route: string;
  changeType: 'added' | 'modified' | 'deleted';
}

export interface RouteDetectionOptions {
  routeMap?: Record<string, string>;
  baseUrl: string;
}

export function detectRoutes(
  diff: ParsedDiff,
  options: RouteDetectionOptions
): RouteMapping[] {
  const mappings: RouteMapping[] = [];
  const seen = new Set<string>();

  for (const file of diff.files) {
    if (file.changeType === 'deleted') continue;

    const changeType = file.changeType === 'added' ? 'added' : 'modified';
    const route = resolveRoute(file.path, options);

    if (route && !seen.has(route)) {
      seen.add(route);
      mappings.push({ file: file.path, route, changeType });
    }
  }

  return mappings;
}

function resolveRoute(filePath: string, options: RouteDetectionOptions): string | null {
  // 1. Explicit routeMap (supports glob patterns)
  if (options.routeMap) {
    for (const [pattern, route] of Object.entries(options.routeMap)) {
      if (minimatch(filePath, pattern) || filePath === pattern || filePath.startsWith(pattern)) {
        return route;
      }
    }
  }

  // 2. Framework convention detection
  const remixRoute = detectRemixRoute(filePath);
  if (remixRoute) return remixRoute;

  const nextRoute = detectNextjsRoute(filePath);
  if (nextRoute) return nextRoute;

  const sveltekitRoute = detectSvelteKitRoute(filePath);
  if (sveltekitRoute) return sveltekitRoute;

  return null;
}

function detectRemixRoute(filePath: string): string | null {
  // Remix v2: app/routes/_index.tsx → /
  // app/routes/products.$id.tsx → /products/:id
  const match = filePath.match(/^app\/routes\/(.+)\.[tj]sx?$/);
  if (!match) return null;

  let route = match[1];

  // _index → /
  if (route === '_index') return '/';

  // Handle layout routes (underscore prefix, e.g. _layout.products)
  route = route.replace(/^_[^.]+\./, '');

  // Convert Remix segments to URL path
  route = route
    .replace(/\._index$/, '') // trailing _index
    .replace(/\./g, '/') // dots → slashes
    .replace(/\$([^/]+)/g, ':$1') // $param → :param
    .replace(/\(([^)]+)\)/g, '$1'); // optional segments

  return '/' + route;
}

function detectNextjsRoute(filePath: string): string | null {
  // Next.js App Router: app/(group)/products/[id]/page.tsx → /products/:id
  // Next.js Pages Router: pages/products/[id].tsx → /products/:id
  const appMatch = filePath.match(/^(?:src\/)?app\/(.+)\/page\.[tj]sx?$/);
  if (appMatch) {
    let route = appMatch[1]
      .replace(/\([^)]+\)\//g, '') // remove route groups (...)
      .replace(/\[([^\]]+)\]/g, ':$1'); // [param] → :param
    return '/' + route;
  }

  const pagesMatch = filePath.match(/^(?:src\/)?pages\/(.+)\.[tj]sx?$/);
  if (pagesMatch && !pagesMatch[1].startsWith('_') && !pagesMatch[1].startsWith('api/')) {
    let route = pagesMatch[1]
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1');
    return route === 'index' ? '/' : '/' + route;
  }

  return null;
}

function detectSvelteKitRoute(filePath: string): string | null {
  // SvelteKit: src/routes/products/[id]/+page.svelte → /products/:id
  const match = filePath.match(/^src\/routes\/(.+)\/\+page\.svelte$/);
  if (!match) return null;

  if (match[1] === '') return '/';

  const route = match[1]
    .replace(/\([^)]+\)\//g, '') // remove route groups
    .replace(/\[([^\]]+)\]/g, ':$1'); // [param] → :param

  return '/' + route;
}
