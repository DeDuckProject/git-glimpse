import { createServer } from 'node:http';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test App</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f5f5f5; }
    h1 { color: #333; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .price { font-size: 1.5rem; font-weight: bold; color: #111; margin: 0.5rem 0; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 999px; margin-bottom: 0.5rem; }
    button { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    button:hover { background: #4f46e5; }
    .btn-wishlist { background: white; color: #6366f1; border: 2px solid #6366f1; margin-left: 0.5rem; }
    .btn-wishlist:hover { background: #eef2ff; }
    .wishlist-msg { display: none; color: #10b981; font-size: 0.9rem; margin-top: 0.5rem; }
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
    .modal.open { display: flex; }
    .modal-content { background: white; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; }
    .close-btn { float: right; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; }
    #counter { font-size: 2rem; font-weight: bold; color: #6366f1; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>Product Page</h1>

  <div class="card">
    <span class="badge">Best Seller</span>
    <h2>Wireless Headphones</h2>
    <p>Premium noise-cancelling headphones with 30-hour battery life.</p>
    <p class="price">$129.99</p>
    <p id="counter">0 in cart</p>
    <button id="add-to-cart">Add to Cart</button>
    <button class="btn-wishlist" id="wishlist-btn">♡ Wishlist</button>
    <button id="try-on-btn" style="margin-left:0.5rem; background:#10b981">Virtual Try-On</button>
    <p class="wishlist-msg" id="wishlist-msg">Added to wishlist!</p>
  </div>

  <div class="modal" id="modal">
    <div class="modal-content">
      <button class="close-btn" id="close-modal" aria-label="Close">&times;</button>
      <h2>Virtual Try-On</h2>
      <p>See how these headphones look on you using your camera.</p>
      <button id="start-tryon">Start Try-On</button>
    </div>
  </div>

  <script>
    let count = 0;
    document.getElementById('add-to-cart').addEventListener('click', () => {
      count++;
      document.getElementById('counter').textContent = count + ' in cart';
    });
    document.getElementById('wishlist-btn').addEventListener('click', () => {
      const msg = document.getElementById('wishlist-msg');
      msg.style.display = 'block';
      document.getElementById('wishlist-btn').textContent = '♥ Wishlisted';
    });
    document.getElementById('try-on-btn').addEventListener('click', () => {
      document.getElementById('modal').classList.add('open');
    });
    document.getElementById('close-modal').addEventListener('click', () => {
      document.getElementById('modal').classList.remove('open');
    });
  </script>
</body>
</html>`;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple app running at http://localhost:${PORT}`);
});
