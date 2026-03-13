import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');

const MIME = { '.html': 'text/html', '.css': 'text/css' };

function serveFile(res, filePath, contentType) {
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    serveFile(res, join(PUBLIC, 'index.html'), MIME['.html']);
  } else if (req.url === '/style.css') {
    serveFile(res, join(PUBLIC, 'style.css'), MIME['.css']);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple app running at http://localhost:${PORT}`);
});
