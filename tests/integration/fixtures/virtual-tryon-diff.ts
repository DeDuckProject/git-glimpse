/**
 * Fixture diff describing the addition of a "Virtual Try-On" button and modal
 * to a product page. The element IDs and text match the test server HTML exactly,
 * so LLM-generated Playwright scripts will find them.
 */
export const VIRTUAL_TRYON_DIFF = `diff --git a/src/app/products/page.tsx b/src/app/products/page.tsx
index a1b2c3d..e4f5a6b 100644
--- a/src/app/products/page.tsx
+++ b/src/app/products/page.tsx
@@ -8,10 +8,32 @@ export default function ProductPage() {
   return (
     <div>
       <h1>Wireless Headphones</h1>
       <p>Premium noise-cancelling headphones with 30-hour battery life.</p>
       <p id="counter">0</p>
       <button id="add-to-cart" onClick={handleAddToCart}>
         Add to Cart
       </button>
+      <button
+        id="try-on-btn"
+        onClick={() => setShowTryOn(true)}
+        style={{ marginLeft: '0.5rem', background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }}
+      >
+        Virtual Try-On
+      </button>
+
+      {showTryOn && (
+        <div className="modal open" id="modal">
+          <div className="modal-content">
+            <button
+              className="close-btn"
+              id="close-modal"
+              aria-label="Close"
+              onClick={() => setShowTryOn(false)}
+            >
+              &times;
+            </button>
+            <h2>Virtual Try-On</h2>
+            <p>See how these headphones look on you using your camera.</p>
+            <button id="start-tryon">Start Try-On</button>
+          </div>
+        </div>
+      )}
     </div>
   );
 }
`;
