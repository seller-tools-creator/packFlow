'use strict';
/*
 * PACKFLOW 后端：注册/登录 + 方案存储
 * 零外部依赖（仅 Node 内置模块）。
 * 启动：node server.js  (默认端口 8780，可用 PORT 环境变量覆盖)
 */
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8780;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');
const SECRET = process.env.PACKFLOW_SECRET || 'packflow-dev-secret-change-me';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 天

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- 存储 ---------- */
function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; }
}
function saveAtomic(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
let users = load(USERS_FILE, []);
let plans = load(PLANS_FILE, []);
const sessions = new Map(); // sid -> { userId, exp }

/* ---------- 密码哈希 (scrypt) ---------- */
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(pw, salt, hash) {
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  const a = Buffer.from(h, 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- 会话 cookie ---------- */
function newSession(userId) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, { userId, exp: Date.now() + SESSION_TTL });
  return sid;
}
function getSession(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.exp < Date.now()) { sessions.delete(m[1]); return null; }
  return s;
}
function cookieHeader(sid) {
  return 'sid=' + sid + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (SESSION_TTL / 1000);
}

/* ---------- HTTP 工具 ---------- */
function send(res, code, obj, extraHeaders) {
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extraHeaders || {});
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('请求体不是合法 JSON')); }
    });
    req.on('error', reject);
  });
}
function uid() { return crypto.randomBytes(12).toString('hex'); }
function validEmail(e) { return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ---------- API 路由 ---------- */
async function handleApi(req, res, parsed) {
  const p = parsed.pathname;
  const method = req.method;

  // 当前用户
  if (p === '/api/me' && method === 'GET') {
    const s = getSession(req);
    if (!s) return send(res, 401, { error: '未登录' });
    const u = users.find(x => x.id === s.userId);
    if (!u) return send(res, 401, { error: '用户不存在' });
    return send(res, 200, { user: { email: u.email, createdAt: u.createdAt } });
  }

  // 注册
  if (p === '/api/signup' && method === 'POST') {
    const b = await readBody(req);
    const email = (b.email || '').trim().toLowerCase();
    const pw = b.password || '';
    if (!validEmail(email)) return send(res, 400, { error: '邮箱格式不正确' });
    if (typeof pw !== 'string' || pw.length < 6) return send(res, 400, { error: '密码至少 6 位' });
    if (users.find(x => x.email === email)) return send(res, 409, { error: '该邮箱已注册' });
    const { salt, hash } = hashPassword(pw);
    const u = { id: uid(), email, salt, hash, createdAt: Date.now() };
    users.push(u); saveAtomic(USERS_FILE, users);
    const sid = newSession(u.id);
    return send(res, 200, { user: { email: u.email } }, { 'Set-Cookie': cookieHeader(sid) });
  }

  // 登录
  if (p === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const email = (b.email || '').trim().toLowerCase();
    const pw = b.password || '';
    const u = users.find(x => x.email === email);
    if (!u || !verifyPassword(pw, u.salt, u.hash)) return send(res, 401, { error: '邮箱或密码错误' });
    const sid = newSession(u.id);
    return send(res, 200, { user: { email: u.email } }, { 'Set-Cookie': cookieHeader(sid) });
  }

  // 退出
  if (p === '/api/logout' && method === 'POST') {
    const s = getSession(req);
    if (s) for (const [k, v] of sessions) if (v.userId === s.userId) sessions.delete(k);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
  }

  const s = getSession(req);
  if (!s) return send(res, 401, { error: '请先登录' });

  // 方案列表
  if (p === '/api/plans' && method === 'GET') {
    const list = plans.filter(x => x.userId === s.userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(x => ({ id: x.id, name: x.name, createdAt: x.createdAt, summary: x.summary, config: x.config }));
    return send(res, 200, { plans: list });
  }

  // 新建方案
  if (p === '/api/plans' && method === 'POST') {
    const b = await readBody(req);
    const name = (b.name || '').trim() || ('方案 ' + new Date().toLocaleString('zh-CN'));
    if (!b.config || typeof b.config !== 'object') return send(res, 400, { error: '方案内容为空' });
    const plan = {
      id: uid(), userId: s.userId, name: name.slice(0, 80),
      config: b.config, summary: b.summary || null, createdAt: Date.now()
    };
    plans.push(plan); saveAtomic(PLANS_FILE, plans);
    return send(res, 200, { plan: { id: plan.id, name: plan.name, createdAt: plan.createdAt } });
  }

  // 删除方案
  if (p.startsWith('/api/plans/') && method === 'DELETE') {
    const id = p.slice('/api/plans/'.length);
    const idx = plans.findIndex(x => x.id === id && x.userId === s.userId);
    if (idx < 0) return send(res, 404, { error: '方案不存在' });
    plans.splice(idx, 1); saveAtomic(PLANS_FILE, plans);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: '接口不存在' });
}

/* ---------- 静态文件 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
function serveStatic(req, res, parsed) {
  let rel = decodeURIComponent(parsed.pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // 避免浏览器/预览面板缓存旧版 HTML，确保改完后立即可见
    if (ext === '.html' || ext === '.json') {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    res.end(buf);
  });
}

/* ---------- 服务器 ---------- */
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  if (parsed.pathname.startsWith('/api/')) {
    handleApi(req, res, parsed).catch(e => send(res, 400, { error: e.message }));
  } else {
    serveStatic(req, res, parsed);
  }
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('PACKFLOW 已启动: http://localhost:' + PORT);
  console.log('数据目录: ' + DATA_DIR);
});
