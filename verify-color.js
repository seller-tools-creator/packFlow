const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const PackEngine = eval('(function(){' + m[1] + '\nreturn PackEngine;})()');

function assert(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? '  ' + extra : ''));
  if (!cond) process.exitCode = 1;
}

// 单箱装载：颜色应随 block 流出
const items = [
  { name: '红件', l: 10, w: 10, h: 10, qty: 8, wt: 0.3, color: '#E5604D' },
  { name: '蓝件', l: 10, w: 10, h: 10, qty: 8, wt: 0.3, color: '#4F86E8' }
];
const r = PackEngine.packSingleBox([30, 30, 30], items, { plans: true });
assert('单箱装载 有方案', r.ok && r.plans.length > 0, 'plans=' + (r.plans && r.plans.length));

let allColored = true, colors = {};
r.plans.forEach(p => p.blocks.forEach(b => {
  if (!b.color) allColored = false;
  colors[b.color] = (colors[b.color] || 0) + 1;
}));
assert('所有 block 都带 color', allColored);
assert('出现 红/蓝 两种颜色', Object.keys(colors).length >= 2, Object.keys(colors).join(','));
assert('红件 block 颜色正确', r.plans[0].blocks.filter(b => b.prodIndex === 0).every(b => b.color === '#E5604D'));
assert('蓝件 block 颜色正确', r.plans[0].blocks.filter(b => b.prodIndex === 1).every(b => b.color === '#4F86E8'));

// 主规划：颜色经 plan()->distributeFree->bestBoxFor->block 流出
const pres = PackEngine.plan({
  products: [
    { name: '红件', l: 20, w: 15, h: 10, qty: 10, wt: 0.5, color: '#E5604D' },
    { name: '蓝件', l: 18, w: 12, h: 8, qty: 10, wt: 0.4, color: '#4F86E8' }
  ],
  mode: 'free', boxesTarget: 1, maxSkuPerBox: 5, divisor: 5000, price: 8,
  minCharge: 12, minBill: 5, overFrom: 30, overRate: 1.5, longFrom: 120, longRate: 1.5, depth: 2
});
if (pres.error) { console.log('FAIL - 主规划返回错误: ' + pres.error); process.exitCode = 1; }
else {
  let pc = {};
  pres.boxes.forEach(b => b.blocks.forEach(blk => { pc[blk.color] = (pc[blk.color] || 0) + 1; }));
  assert('主规划 block 带颜色', Object.keys(pc).length >= 1, JSON.stringify(pc));
}

console.log('\n颜色验证完成。');
