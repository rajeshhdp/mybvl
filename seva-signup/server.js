// Tiny server: serves the built site from dist/ and a small JSON API.
// All data lives in one file (data.json). No database. No dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('Set ADMIN_PASSWORD first, e.g.  ADMIN_PASSWORD=yourpassword npm start');
  process.exit(1);
}

/* ------------------------------------------------------------ data */
const uid = () => crypto.randomBytes(6).toString('hex');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function nextSunday() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return iso(d); }

const STARTER = [
  ['Kirtan', 'Lead or accompany the congregational chanting of the holy names.', 2],
  ['Bhagavad Gita Reading', 'Read a short passage from the Bhagavad Gita for everyone.', 1],
  ['Class / Discussion', 'Present the topic or facilitate the group discussion.', 1],
  ['Prasadam Preparation', 'Cook or bring offered-with-love prasadam for the group.', 3],
  ['Prasadam Distribution', 'Serve prasadam to all the guests with a smile.', 3],
  ['Setup & Decorations', 'Arrange the space, seating, altar and flowers before the program.', 3],
  ['Cleanup', 'Help tidy the hall and wash up after prasadam.', 3],
  ['Kids Activities', 'Lead a story, craft or game for the children.', 2],
  ['Welcome Team', 'Greet devotees and guests warmly as they arrive.', 2],
];

let data;
try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {
  data = {
    programDate: nextSunday(),
    services: STARTER.map(([name, description, needed], i) => ({ id: uid(), name, description, needed, sort_order: i + 1, signups: [] })),
  };
  save();
}
function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE); // atomic: never a half-written file
}

/* ------------------------------------------------------------ auth */
// Stateless signed token (survives restarts, expires in 12h).
const SECRET = crypto.createHash('sha256').update('seva:' + ADMIN_PASSWORD).digest();
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const mkToken = () => { const exp = Date.now() + 12 * 3600e3; return `${exp}.${sign(String(exp))}`; };
function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function isAdmin(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  const [exp, sig] = t.split('.');
  return Boolean(exp && sig && Number(exp) > Date.now() && safeEq(sig, sign(exp)));
}
const fails = new Map(); // ip -> { n, until }  (slow down password guessing)

/* ------------------------------------------------------------ http helpers */
const clients = new Set();
const broadcast = () => clients.forEach((res) => res.write('data: changed\n\n'));
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const bad = (res, code, msg) => send(res, code, { error: msg });
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 20000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('bad json')); } });
  });
}
const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
function serviceFields(b) {
  const name = cleanName(b.name).slice(0, 80);
  const description = String(b.description ?? '').trim().slice(0, 200);
  const needed = Math.min(100, Math.max(1, parseInt(b.needed, 10) || 1));
  return name ? { name, description, needed } : null;
}

/* ------------------------------------------------------------ API */
async function api(req, res, url) {
  const { method } = req;
  const p = url.pathname;

  if (method === 'GET' && p === '/api/program') return send(res, 200, data);

  if (method === 'GET' && p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return undefined;
  }

  if (method === 'POST' && p === '/api/signup') {
    const b = await readBody(req);
    const name = cleanName(b.name);
    const svc = data.services.find((s) => s.id === b.serviceId);
    if (!svc) return bad(res, 404, 'NOT_FOUND');
    if (name.length < 2 || name.length > 60) return bad(res, 400, 'INVALID_NAME');
    if (svc.signups.some((x) => x.name.toLowerCase() === name.toLowerCase())) return bad(res, 409, 'DUPLICATE');
    if (svc.signups.length >= svc.needed) return bad(res, 409, 'FULL');
    svc.signups.push({ id: uid(), service_id: svc.id, name });
    save(); broadcast();
    return send(res, 200, { ok: true });
  }

  if (method === 'POST' && p === '/api/admin/login') {
    const ip = req.socket.remoteAddress;
    const f = fails.get(ip);
    if (f && f.until > Date.now()) return bad(res, 429, 'TOO_MANY');
    const b = await readBody(req);
    if (!safeEq(b.password ?? '', ADMIN_PASSWORD)) {
      const n = (f?.n || 0) + 1;
      fails.set(ip, { n, until: n >= 5 ? Date.now() + 60000 : 0 });
      return bad(res, 401, 'BAD_PASSWORD');
    }
    fails.delete(ip);
    return send(res, 200, { token: mkToken() });
  }

  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return bad(res, 401, 'UNAUTHORIZED');
    const parts = p.split('/').slice(3); // after /api/admin/
    const b = ['POST', 'PUT'].includes(method) ? await readBody(req) : {};

    if (method === 'GET' && parts[0] === 'check') return send(res, 200, { ok: true });

    if (method === 'PUT' && parts[0] === 'date') {
      if (!isDate(b.date)) return bad(res, 400, 'Invalid date');
      data.programDate = b.date;
    } else if (method === 'POST' && parts[0] === 'services' && !parts[1]) {
      const f = serviceFields(b); if (!f) return bad(res, 400, 'Name required');
      const order = data.services.reduce((m, s) => Math.max(m, s.sort_order || 0), 0) + 1;
      data.services.push({ id: uid(), ...f, sort_order: order, signups: [] });
    } else if (method === 'PUT' && parts[0] === 'services' && parts[1]) {
      const s = data.services.find((x) => x.id === parts[1]); if (!s) return bad(res, 404, 'Not found');
      const f = serviceFields(b); if (!f) return bad(res, 400, 'Name required');
      Object.assign(s, f); // lowering "needed" below current signups is allowed; the card just shows Full
    } else if (method === 'DELETE' && parts[0] === 'services' && parts[1]) {
      data.services = data.services.filter((x) => x.id !== parts[1]);
    } else if (method === 'DELETE' && parts[0] === 'signups' && parts[1]) {
      data.services.forEach((s) => { s.signups = s.signups.filter((x) => x.id !== parts[1]); });
    } else if (method === 'POST' && parts[0] === 'reset') {
      if (!isDate(b.date)) return bad(res, 400, 'Invalid date');
      data.services.forEach((s) => { s.signups = []; });
      data.programDate = b.date;
    } else return bad(res, 404, 'Not found');

    save(); broadcast();
    return send(res, 200, { ok: true });
  }
  return bad(res, 404, 'Not found');
}

/* ------------------------------------------------------------ static files */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
function serveStatic(req, res, url) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(500); return res.end('Run "npm run build" first.'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) bad(res, 400, e.message || 'Bad request');
  }
}).listen(PORT, () => console.log(`Seva signup running on http://localhost:${PORT}`));
