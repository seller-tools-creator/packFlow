'use strict';
/* 前端鉴权 + 方案存储 冒烟测试（jsdom + mock fetch） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(process.env.NODE_PATH, 'jsdom'));

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

/* ---- mock 后端 ---- */
const store = { users: [], plans: [], loggedIn: false, me: null };
function json(res) {
  return { ok: res.status < 400, status: res.status, json: () => Promise.resolve(res.body) };
}
function mockFetch(url, opts) {
  opts = opts || {};
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};
  if (url === '/api/me' && method === 'GET') {
    return Promise.resolve(json(store.loggedIn ? { status: 200, body: { user: store.me } } : { status: 401, body: { error: '未登录' } }));
  }
  if (url === '/api/signup' && method === 'POST') {
    if (store.users.find(u => u.email === body.email)) return Promise.resolve(json({ status: 409, body: { error: '该邮箱已注册' } }));
    store.me = { email: body.email }; store.loggedIn = true;
    store.users.push({ email: body.email });
    return Promise.resolve(json({ status: 200, body: { user: store.me } }));
  }
  if (url === '/api/login' && method === 'POST') {
    if (!store.users.find(u => u.email === body.email)) return Promise.resolve(json({ status: 401, body: { error: '邮箱或密码错误' } }));
    store.me = { email: body.email }; store.loggedIn = true;
    return Promise.resolve(json({ status: 200, body: { user: store.me } }));
  }
  if (url === '/api/logout' && method === 'POST') {
    store.loggedIn = false; store.me = null;
    return Promise.resolve(json({ status: 200, body: { ok: true } }));
  }
  if (url === '/api/plans' && method === 'GET') {
    if (!store.loggedIn) return Promise.resolve(json({ status: 401, body: { error: '请先登录' } }));
    return Promise.resolve(json({ status: 200, body: { plans: store.plans } }));
  }
  if (url === '/api/plans' && method === 'POST') {
    if (!store.loggedIn) return Promise.resolve(json({ status: 401, body: { error: '请先登录' } }));
    const p = { id: 'p' + store.plans.length, name: body.name, createdAt: Date.now(), summary: body.summary, config: body.config };
    store.plans.push(p);
    return Promise.resolve(json({ status: 200, body: { plan: { id: p.id, name: p.name } } }));
  }
  if (url.startsWith('/api/plans/') && method === 'DELETE') {
    const id = url.slice('/api/plans/'.length);
    store.plans = store.plans.filter(x => x.id !== id);
    return Promise.resolve(json({ status: 200, body: { ok: true } }));
  }
  return Promise.resolve(json({ status: 404, body: { error: '接口不存在' } }));
}

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = (u, o) => mockFetch(u, o);
    window.prompt = () => '测试保存方案';
    window.devicePixelRatio = 1;
    const ctx = new Proxy({}, { get: () => () => {} });
    window.HTMLCanvasElement.prototype.getContext = () => ctx;
    window.addEventListener('error', e => errors.push(e.error ? e.error.message : e.message));
  }
});
const { window } = dom;
const doc = window.document;
const $ = id => doc.getElementById(id);
function fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); }
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }

setTimeout(() => {
  try {
    console.log('\n=== A. 初始未登录态 ===');
    ok('顶栏显示登录按钮', !!$('btnLogin'), 'authSpot 内容: ' + ($('authSpot') ? $('authSpot').innerHTML.slice(0, 40) : 'null'));
    ok('初始未渲染我的方案入口', !$('btnMyPlans'));

    console.log('\n=== B. 注册并登录 ===');
    click($('btnLogin'));
    ok('点击后弹窗打开', $('authOverlay').classList.contains('on'));
    doc.querySelector('#modal-tabs, #tabSignup'); // noop
    click($('tabSignup'));
    $('auEmail').value = 'tester@demo.com';
    $('auPw').value = 'secret123';
    click($('authSubmit'));

    setTimeout(() => {
      try {
        console.log('\n=== C. 登录后 UI ===');
        ok('登录后显示保存方案按钮', !!$('btnSavePlan'));
        ok('登录后显示我的方案按钮', !!$('btnMyPlans'));
        ok('显示用户邮箱', $('authSpot').innerHTML.indexOf('tester@demo.com') >= 0);

        console.log('\n=== D. 保存方案 ===');
        click($('btnSavePlan'));
        setTimeout(() => {
          try {
            ok('保存后后端收到 1 个方案', store.plans.length === 1, 'plans=' + store.plans.length);
            ok('保存的方案含 config', store.plans[0] && store.plans[0].config && store.plans[0].config.products.length >= 1);
            ok('保存的方案含 summary', store.plans[0] && store.plans[0].summary && store.plans[0].summary.line);

            console.log('\n=== E. 打开抽屉并载入 ===');
            click($('btnMyPlans'));
            ok('抽屉打开', $('planDrawer').classList.contains('on'));
            setTimeout(() => {
              ok('列表渲染出方案名', $('planList').innerHTML.indexOf('测试保存方案') >= 0);
              const loadBtn = $('planList').querySelector('.load');
              ok('存在载入按钮', !!loadBtn);
              if (loadBtn) {
                click(loadBtn);
                ok('载入后抽屉关闭', !$('planDrawer').classList.contains('on'));
              }

              console.log('\n=== F. 删除方案 ===');
              click($('btnMyPlans'));
              setTimeout(() => {
                const delBtn = $('planList').querySelector('.del');
                if (delBtn) {
                  click(delBtn);
                  setTimeout(() => {
                    ok('删除后后端为空', store.plans.length === 0, 'plans=' + store.plans.length);
                    console.log('\n=== G. 异常收集 ===');
                    ok('无未捕获运行时错误', errors.length === 0, errors.join(' | '));
                    console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
                    process.exit(fail ? 1 : 0);
                  }, 80);
                } else {
                  ok('删除按钮存在', false, '列表未渲染');
                  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
                  process.exit(fail ? 1 : 0);
                }
              }, 80);
            }, 120);
          } catch (e) { console.log('E 段异常: ' + e.message); process.exit(1); }
        }, 60);
      } catch (e) { console.log('C/D 段异常: ' + e.message); process.exit(1); }
    }, 80);
  } catch (e) { console.log('B 段异常: ' + e.message); process.exit(1); }
}, 200);
