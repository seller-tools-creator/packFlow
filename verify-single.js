const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const ctxStub = new Proxy(function(){}, {
  get(t, p) {
    if (p === 'measureText') return () => ({ width: 0 });
    if (p === 'canvas') return {};
    return (...a) => ctxStub;
  },
  set() { return true; },
  apply() { return ctxStub; }
});

function setupWindow(window) {
  window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
  window.fetch = (url) => {
    if (String(url).includes('/api/me'))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: { user: null } }) });
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false }) });
  };
  window.__err = 'none';
  window.addEventListener('error', (e) => { window.__err = (e.error && e.error.message) || e.message; });
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  pretendToBeVisual: true,
  beforeParse: setupWindow
});

const { window } = dom;
const $ = (id) => window.document.getElementById(id);

function run() {
  const out = [];
  const PE = window.PackEngine;
  out.push('PackEngine 存在=' + !!PE + '  packSingleBox 存在=' + !!(PE && PE.packSingleBox));

  // ---- 引擎直测：装得下 ----
  let r1 = PE.packSingleBox([20,15,40], [{l:20,w:15,h:8,qty:5,name:'A'}], {});
  out.push('[装得下] itemsInBox=' + r1.itemsInBox + ' allFit=' + r1.allFit + ' boxesNeeded=' + r1.boxesNeeded + ' (期望 5/true/1)');

  // ---- 引擎直测：装不下 ----
  let r2 = PE.packSingleBox([20,15,8], [{l:20,w:15,h:8,qty:5,name:'A'}], {});
  out.push('[装不下] itemsInBox=' + r2.itemsInBox + ' unpacked=' + r2.unpacked + ' boxesNeeded=' + r2.boxesNeeded + ' allFit=' + r2.allFit + ' (期望 1/4/5/false)');

  // ---- 重量上限 ----
  let r3 = PE.packSingleBox([100,100,100], [{l:20,w:20,h:20,qty:100,wt:1,name:'W'}], {maxWeight:10});
  out.push('[重量上限10kg] itemsInBox=' + r3.itemsInBox + ' (期望≤50，约50)');

  // ---- 多 SKU 混装 ----
  let r4 = PE.packSingleBox([60,40,40], [
    {l:20,w:15,h:8,qty:30,name:'A'}, {l:12,w:12,h:12,qty:20,name:'B'}
  ], {});
  out.push('[多SKU] itemsInBox=' + r4.itemsInBox + ' total=' + r4.total + ' boxesNeeded=' + r4.boxesNeeded);

  // ---- UI：切到单箱装载选卡并点击装载分析 ----
  const singleBtn = window.document.querySelector('.tabs button[data-tab="single"]');
  out.push('单箱装载选卡按钮存在=' + !!singleBtn);
  singleBtn.click(); // setTab('single') -> 自动 computeSingle()
  let o = $('out');
  out.push('切到单箱后 #out 非空=' + !!o && !!o.innerHTML && o.innerHTML.length > 0);
  out.push('#out 含 成功装入=' + (o && o.innerHTML.indexOf('成功装入') >= 0));
  out.push('#out 含 空间不足=' + (o && o.innerHTML.indexOf('空间不足') >= 0));
  out.push('#out 含 stage3d canvas=' + !!(o && o.querySelector('#stage3d')));
  out.push('#out 含 perProd=' + !!(o && o.querySelector('.sb-perprod')));

  // 设置小箱子强制装不下，重新点
  $('sbL').value = '20'; $('sbW').value = '15'; $('sbH').value = '8';
  $('btnSingle').click();
  const txt = $('out').textContent || '';
  out.push('小箱装载文案片段: ' + txt.replace(/\s+/g,' ').substr(0, 80));

  console.log(out.join('\n'));

  const pass = PE && PE.packSingleBox && r1.allFit && r1.itemsInBox === 5 && r1.boxesNeeded === 1
    && r2.itemsInBox === 1 && r2.unpacked === 4 && r2.boxesNeeded === 5 && !r2.allFit
    && r3.itemsInBox <= 50 && r3.itemsInBox > 0
    && singleBtn && o && o.innerHTML.indexOf('成功装入') >= 0 && o.querySelector('#stage3d')
    && window.__err === 'none';
  console.log('\nRESULT: ' + (pass ? 'PASS ✅' : 'FAIL ❌') + '  (__err=' + window.__err + ')');
}

setTimeout(run, 600);
