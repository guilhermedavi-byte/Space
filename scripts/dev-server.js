// Local adapter for this project's static files and Node Vercel handlers.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = require('../vercel.json');
const port = Number(process.env.PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const rewrites = config.rewrites.map(({ source, destination }) => {
  const names = [];
  const pattern = source.split('/').map(segment => {
    if (segment === '(.*)') return '(.*)';
    if (segment.startsWith(':')) { names.push(segment.slice(1)); return '([^/]+)'; }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { regex: new RegExp(`^${pattern}$`), destination, names };
});
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let route = url.pathname;
    for (const rule of rewrites) {
      const match = route.match(rule.regex);
      if (!match) continue;
      let target = rule.destination.replace(/\$(\d+)/g, (_, n) => match[Number(n)] || '');
      rule.names.forEach((name, i) => { target = target.replace(`:${name}`, match[i + 1]); });
      const rewritten = new URL(target, url);
      rewritten.searchParams.forEach((value, key) => url.searchParams.set(key, value));
      route = rewritten.pathname;
      break;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (route.startsWith('/api/')) {
      const name = route.slice(5).replace(/\.js$/, '');
      if (!/^[a-zA-Z0-9-]+$/.test(name)) { res.writeHead(404).end(); return; }
      const filename = path.join(root, 'api', `${name}.js`);
      if (!fs.existsSync(filename)) { res.writeHead(404).end(); return; }
      req.query = Object.fromEntries(url.searchParams);
      res.status = code => { res.statusCode = code; return res; };
      res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      res.send = data => res.end(data);
      // Leave the request stream intact: handlers use _lib/http.readJsonBody.
      await require(filename)(req, res);
      return;
    }
    const decoded = decodeURIComponent(route);
    const parts = decoded.split('/').filter(Boolean);
    const blocked = new Set(['node_modules', 'scripts', 'tests', 'docs', 'api', '_lib', 'config', 'data', 'backups', 'exports', 'artifacts', 'tmp', 'supabase']);
    if (parts.some(part => part.startsWith('.')) || blocked.has(parts[0])) { res.writeHead(404).end(); return; }
    let filename = path.resolve(root, `.${decoded}`);
    if (!filename.startsWith(root + path.sep) && filename !== root) { res.writeHead(404).end(); return; }
    if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end('Not found'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'local_server_error' }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Space: http://localhost:${port}\nCtrl+C para encerrar. Reinicie após alterar APIs ou .env.local.`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
