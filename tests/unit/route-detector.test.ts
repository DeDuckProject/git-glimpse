import { describe, it, expect } from 'vitest';
import { parseDiff } from '../../packages/core/src/analyzer/diff-parser.js';
import { detectRoutes } from '../../packages/core/src/analyzer/route-detector.js';

const baseUrl = 'http://localhost:3000';

function makeModifiedDiff(filePath: string): string {
  return `diff --git a/${filePath} b/${filePath}
index abc..def 100644
--- a/${filePath}
+++ b/${filePath}
@@ -1,1 +1,2 @@
 export default function X() {}
+// change`;
}

describe('detectRoutes', () => {
  describe('Remix routes', () => {
    it('detects product detail route', () => {
      const diff = parseDiff(makeModifiedDiff('app/routes/products.$id.tsx'));
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes).toHaveLength(1);
      expect(routes[0]!.route).toBe('/products/:id');
    });

    it('detects index route', () => {
      const diff = parseDiff(makeModifiedDiff('app/routes/_index.tsx'));
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes[0]!.route).toBe('/');
    });

    it('detects nested routes with dots', () => {
      const diff = parseDiff(makeModifiedDiff('app/routes/dashboard.settings.tsx'));
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes[0]!.route).toBe('/dashboard/settings');
    });
  });

  describe('Next.js routes', () => {
    it('detects App Router pages', () => {
      const diff = parseDiff(makeModifiedDiff('app/products/[id]/page.tsx'));
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes[0]!.route).toBe('/products/:id');
    });

    it('detects Pages Router', () => {
      const diff = parseDiff(makeModifiedDiff('pages/about.tsx'));
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes[0]!.route).toBe('/about');
    });
  });

  describe('SvelteKit routes', () => {
    it('detects page routes', () => {
      const diff = parseDiff(makeModifiedDiff('src/routes/products/[id]/+page.svelte'));
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes[0]!.route).toBe('/products/:id');
    });
  });

  describe('explicit routeMap', () => {
    it('uses explicit mapping over convention', () => {
      const diff = parseDiff(makeModifiedDiff('extensions/virtual-tryon-block/blocks/tryon.liquid'));
      const routes = detectRoutes(diff, {
        baseUrl,
        routeMap: { 'extensions/virtual-tryon-block/**': '/products/test-product-1' },
      });
      expect(routes[0]!.route).toBe('/products/test-product-1');
    });

    it('matches exact file paths', () => {
      const diff = parseDiff(makeModifiedDiff('src/components/Header.tsx'));
      const routes = detectRoutes(diff, {
        baseUrl,
        routeMap: { 'src/components/Header.tsx': '/' },
      });
      expect(routes[0]!.route).toBe('/');
    });
  });

  describe('skips deleted files', () => {
    it('does not create route mappings for deleted files', () => {
      const deletedDiff = `diff --git a/app/routes/old.tsx b/app/routes/old.tsx
deleted file mode 100644
index abc..000
--- a/app/routes/old.tsx
+++ /dev/null`;
      const diff = parseDiff(deletedDiff);
      const routes = detectRoutes(diff, { baseUrl });
      expect(routes).toHaveLength(0);
    });
  });
});
