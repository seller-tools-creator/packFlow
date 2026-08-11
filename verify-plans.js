// 验证单箱装载多方案生成（去重、数量、计数一致、上限 8）
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const PackEngine = eval('(function(){' + m[1] + '\nreturn PackEngine;})()');

function assert(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? '  ' + extra : ''));
  if (!cond) process.exitCode = 1;
}

const items = [
  { name: '大件A', l: 30, w: 20, h: 15, qty: 6, wt: 1.2 },
  { name: '中件B', l: 18, w: 12, h: 10, qty: 20, wt: 0.6 },
  { name: '小件C', l: 8, w: 8, h: 6, qty: 60, wt: 0.2 }
];

const r = PackEngine.packSingleBox([60, 50, 45], items, { plans: true });
assert('返回 plans 对象', r.ok && Array.isArray(r.plans), 'plans=' + (r.plans && r.plans.length));
assert('方案数 1..8', r.plans.length >= 1 && r.plans.length <= 8, 'count=' + r.plans.length);

const sigs = r.plans.map(p => p.blocks.map(b => b.prodIndex + ':' + Math.round(b.x) + ',' + Math.round(b.y) + ',' + Math.round(b.z) + ':' + b.ori).join('|'));
assert('方案布局互不相同(已去重)', new Set(sigs).size === sigs.length, 'unique=' + new Set(sigs).size);

let okAll = true;
r.plans.forEach(p => {
  const sum = p.perProd.reduce((s, x) => s + x.inBox, 0);
  const blockSum = p.blocks.reduce((s, b) => s + (b.cnt || (b.nx * b.ny * b.nz)), 0);
  if (sum !== p.itemsInBox || blockSum !== p.itemsInBox) okAll = false;
});
assert('每方案 perProd/blocks 计数一致', okAll);

const best = r.plans[r.best];
assert('best 为装入最多', best.itemsInBox === Math.max.apply(null, r.plans.map(p => p.itemsInBox)), 'best=' + best.itemsInBox);

// 单方案调用仍兼容
const s = PackEngine.packSingleBox([60, 50, 45], items, {});
assert('单方案兼容', s.ok && typeof s.itemsInBox === 'number', 'itemsInBox=' + s.itemsInBox);

console.log('\nDone. exitCode=' + (process.exitCode || 0));
