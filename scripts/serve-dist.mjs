import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
export function serveDist(port) {
  return createServer(async (req, res) => {
    try {
      const p = join('dist', decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  }).listen(port);
}
