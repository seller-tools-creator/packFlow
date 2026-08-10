const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const ctxStub = new Proxy(function(){}, {
  get(t, p){ if(p === 'measureText') return () => ({ width: 0 }); return () => ctxStub; },
  set(){ return true; }, apply(){ return ctxStub; }
});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
    window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: false }) });
  }
});

setTimeout(() => {
  const w = dom.window;
  const E = w.PackEngine;
  const out = [];
  let ok = true;

  if (!E || !E.plan) { console.log('FAIL: PackEngine.plan 不存在'); process.exit(1); }

  const opt = {
    products: [{ l:30, w:20, h:10, wt:0.5, qty:240, name:'A' }],
    mode: 'free', autoPlan: true, maxSkuPerBox: 5,
    maxWeight: 22.68, divisor: 5000, minCharge: 12, minBill: 5, price: 8,
    overFrom: 30, overTo: 45, overRate: 1.5, longFrom: 120, longTo: 200, longRate: 1.5,
    step: 5, minSide: 10, maxLen: 91.44, maxWid: 63.5, maxHt: 63.5, maxSum: 0,
    depth: 2, scanMaxBoxes: 10, gap: 0, wall: 0
  };

  function check(label, r) {
    if (r.error) { out.push(label + ' -> ERROR: ' + r.error); ok = false; return; }
    if (!r.ok) { out.push(label + ' -> 不可行'); ok = false; return; }
    const boxes = r.boxes || [];
    out.push(label + ' -> 箱数=' + boxes.length);
    boxes.forEach((b, i) => {
      const [L, W, H] = b.box;
      const dimOk = L <= 91.44 + 1e-6 && W <= 63.5 + 1e-6 && H <= 63.5 + 1e-6;
      const wt = b.realWt || 0;
      const wtOk = wt <= 22.68 + 1e-6;
      out.push('  箱' + (i+1) + ': ' + L + '×' + W + '×' + H + 'cm, 实重=' + wt.toFixed(2) + 'kg  ' +
               (dimOk ? '✓尺寸' : '✗尺寸超限') + ' ' + (wtOk ? '✓重量' : '✗重量超限'));
      if (!dimOk || !wtOk) ok = false;
    });
  }

  // 自由多箱
  check('自由多箱(总重120kg,限22.68kg)', E.plan(opt));
  // 同款箱
  const opt2 = Object.assign({}, opt, { mode: 'identical',
    products: [{ l:30, w:20, h:10, wt:0.5, qty:240, name:'A' }] });
  check('同款箱(每箱应<22.68kg)', E.plan(opt2));

  console.log(out.join('\n'));
  console.log('\nRESULT: ' + (ok ? 'PASS ✅ 所有箱子符合亚马逊限制' : 'FAIL ❌'));
}, 400);
