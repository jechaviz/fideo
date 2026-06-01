import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.slice(1));
const port = Number(process.env.FIDEOVUE_PORT || process.argv[2] || 4173);

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.vue': 'text/plain; charset=utf-8',
};

const safePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = normalize(decoded === '/' ? '/index.html' : decoded);
  const fullPath = resolve(join(root, requested));
  return fullPath.startsWith(root) ? fullPath : null;
};

const server = createServer(async (request, response) => {
  const filePath = safePath(request.url || '/');
  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'Content-Length': info.size,
      'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`FideoVue serving at http://127.0.0.1:${port}/`);
});

