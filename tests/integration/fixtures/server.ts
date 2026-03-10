import { createServer, type Server } from 'node:http';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test App</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f5f5f5; }
    h1 { color: #333; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    button { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    button:hover { background: #4f46e5; }
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
    <h2>Wireless Headphones</h2>
    <p>Premium noise-cancelling headphones with 30-hour battery life.</p>
    <p id="counter">0</p>
    <button id="add-to-cart">Add to Cart</button>
    <button id="try-on-btn" style="margin-left:0.5rem; background:#10b981">Virtual Try-On</button>
  </div>

  <div class="modal" id="modal">
    <div class="modal-content">
      <button class="close-btn" id="close-modal" aria-label="Close">×</button>
      <h2>Virtual Try-On</h2>
      <p>See how these headphones look on you using your camera.</p>
      <button id="start-tryon">Start Try-On</button>
    </div>
  </div>

  <script>
    let count = 0;
    document.getElementById('add-to-cart').addEventListener('click', () => {
      count++;
      document.getElementById('counter').textContent = count;
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

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export function startTestServer(port = 0): Promise<TestServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(HTML);
    });

    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });

    server.on('error', reject);
  });
}
