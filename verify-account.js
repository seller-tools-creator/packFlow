const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');

// 万能 2D context 桩，避免 jsdom 无 canvas 抛错
const ctxStub = new Proxy(function(){}, {
  get(t, p){ if (p === 'measureText') return () => ({ width: 0 }); return () => ctxStub; },
  set(){ return true; },
  apply(){ return ctxStub; }
});

function setupWindow(window) {
  window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
  window.__fetchCalls = [];
  const f = (url) => {
    window.__fetchCalls.push(String(url));
    if (String(url).includes('/api/me'))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { email: 'me@test.com' } }) });
    if (String(url).includes('/api/plans'))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ plans: [] }) });
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) });
  };
  window.fetch = f;
  window.__hasFetch = (typeof window.fetch);
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse: setupWindow
});
const { window } = dom;
window.__err = 'none';
window.addEventListener('error', (e) => { window.__err = (e.error && e.error.message) || e.message; });
const out = [];
const $ = (s) => window.document.querySelector(s);

function run() {
 try {
  out.push('== 错误捕获 ==');
  out.push('  window.__err = ' + (window.__err || 'none'));
  out.push('  window.__hasFetch = ' + (window.__hasFetch || 'n/a'));
  out.push('  fetch 调用记录 = ' + JSON.stringify(window.__fetchCalls || []));
  out.push('  authSpot 长度 = ' + ($('#authSpot') ? $('#authSpot').outerHTML.length : 'null'));
  out.push('  btnLogin(未登录态) 存在 = ' + !!$('#btnLogin'));
  out.push('== 顶栏静态按钮 ==');
  out.push('  复制方案 btnCopy = ' + !!$('#btnCopy'));
  out.push('  保存方案 btnSavePlan = ' + !!$('#btnSavePlan'));

  const acct = $('#acctBtn'), menu = $('#acctMenu');
  const myPlans = $('#btnMyPlans'), logout = $('#btnLogout');
  out.push('== 登录后账户区 ==');
  out.push('  acctBtn(邮箱chip) = ' + !!acct + '  文本=' + (acct ? acct.querySelector('.ue').textContent : ''));
  out.push('  acctMenu(下拉) = ' + !!menu);
  out.push('  我的方案 = ' + !!myPlans + '   退出登录 = ' + !!logout);
  out.push('  初始菜单 open = ' + (menu ? menu.classList.contains('open') : 'n/a') + ' (应为 false)');

  if (acct && menu) {
    acct.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    out.push('  点击账户chip → 菜单 open = ' + menu.classList.contains('open') + ' (应为 true)');

    if (myPlans) {
      myPlans.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      const drawer = $('#planDrawer');
      out.push('  点我的方案 → 抽屉 on = ' + (drawer && drawer.classList.contains('on')) + ' (应为 true)');
      out.push('  点我的方案 → 菜单 open = ' + menu.classList.contains('open') + ' (应已关闭)');
    }
    if ($('#acctBtn')) {
      $('#acctBtn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      out.push('  再次点击账户chip → 菜单 open = ' + menu.classList.contains('open') + ' (应已收起)');
    }
  }
 } catch (e) {
  out.push('THROW: ' + e.message);
 }
 console.log(out.join('\n'));
 const realPass = $('#btnCopy') && $('#btnSavePlan') && $('#acctBtn') && $('#acctMenu') && $('#btnMyPlans') && $('#btnLogout') && $('#planDrawer').classList.contains('on');
 console.log('RESULT: ' + (realPass ? 'PASS ✅' : 'FAIL ❌'));
}

window.addEventListener('load', () => setTimeout(run, 400));
setTimeout(() => { if (!$('#acctBtn')) run(); }, 1500);
