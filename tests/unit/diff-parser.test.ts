import { describe, it, expect } from 'vitest';
import { parseDiff, isUIFile } from '../../packages/core/src/analyzer/diff-parser.js';

const SAMPLE_DIFF = `diff --git a/app/routes/products.$id.tsx b/app/routes/products.$id.tsx
index abc123..def456 100644
--- a/app/routes/products.$id.tsx
+++ b/app/routes/products.$id.tsx
@@ -10,6 +10,15 @@ export default function ProductPage() {
   return (
     <div className="product-page">
       <h1>{product.title}</h1>
+      <button
+        onClick={() => setShowTryOn(true)}
+        className="btn-primary"
+      >
+        Virtual Try-On
+      </button>
+      {showTryOn && (
+        <TryOnModal product={product} onClose={() => setShowTryOn(false)} />
+      )}
     </div>
   );
 }`;

describe('parseDiff', () => {
  it('parses a simple file modification', () => {
    const result = parseDiff(SAMPLE_DIFF);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.path).toBe('app/routes/products.$id.tsx');
    expect(result.files[0]!.changeType).toBe('modified');
    expect(result.files[0]!.additions).toBeGreaterThan(0);
  });

  it('detects new files', () => {
    const newFileDiff = `diff --git a/app/routes/new-page.tsx b/app/routes/new-page.tsx
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/app/routes/new-page.tsx
@@ -0,0 +1,5 @@
+export default function NewPage() {
+  return <div>New Page</div>;
+}`;
    const result = parseDiff(newFileDiff);
    expect(result.files[0]!.changeType).toBe('added');
  });

  it('detects deleted files', () => {
    const deletedDiff = `diff --git a/app/routes/old-page.tsx b/app/routes/old-page.tsx
deleted file mode 100644
index abc123..0000000
--- a/app/routes/old-page.tsx
+++ /dev/null`;
    const result = parseDiff(deletedDiff);
    expect(result.files[0]!.changeType).toBe('deleted');
  });

  it('handles multiple files', () => {
    const multiDiff = `diff --git a/app/routes/a.tsx b/app/routes/a.tsx
index abc..def 100644
--- a/app/routes/a.tsx
+++ b/app/routes/a.tsx
@@ -1,1 +1,2 @@
 export default function A() {}
+// change
diff --git a/app/routes/b.tsx b/app/routes/b.tsx
index 123..456 100644
--- a/app/routes/b.tsx
+++ b/app/routes/b.tsx
@@ -1,1 +1,2 @@
 export default function B() {}
+// change`;
    const result = parseDiff(multiDiff);
    expect(result.files).toHaveLength(2);
  });
});

describe('isUIFile', () => {
  it('identifies UI files', () => {
    expect(isUIFile('app/routes/products.$id.tsx')).toBe(true);
    expect(isUIFile('src/components/Button.tsx')).toBe(true);
    expect(isUIFile('pages/index.tsx')).toBe(true);
    expect(isUIFile('src/styles/main.css')).toBe(true);
  });

  it('excludes test files', () => {
    expect(isUIFile('app/routes/products.test.tsx')).toBe(false);
    expect(isUIFile('src/__tests__/Button.test.ts')).toBe(false);
  });

  it('excludes config files', () => {
    expect(isUIFile('package.json')).toBe(false);
    expect(isUIFile('tsconfig.json')).toBe(false);
    expect(isUIFile('README.md')).toBe(false);
  });
});
