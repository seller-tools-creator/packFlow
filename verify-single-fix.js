// 验证 packSingleBox 重量约束修复
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) { console.error('engine script not found'); process.exit(1); }
const code = m[1];
const PackEngine = eval('(function(){' + code + '\nreturn PackEngine;})()');

function assert(name, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? '  ' + extra : ''));
  if (!cond) process.exitCode = 1;
}

// 用例1：重量上限生效（核心 bug）
// 40 件，每件 1kg，体积 10x10x10，箱子足够大(100x100x100 能装 1000 件)
// 单箱限重 10kg => 最多装 10 件
const items1 = [{ name: 'A', l: 10, w: 10, h: 10, qty: 40, wt: 1 }];
const r1 = PackEngine.packSingleBox([100, 100, 100], items1, { maxWeight: 10 });
assert('重量上限生效 itemsInBox=10', r1.ok && r1.itemsInBox === 10, 'got ' + (r1.itemsInBox));
assert('未装入=30', r1.ok && r1.unpacked === 30, 'got ' + (r1 && r1.unpacked));
assert('预计外箱=4', r1.ok && r1.boxesNeeded === 4, 'got ' + (r1 && r1.boxesNeeded));

// 用例2：无重量限制时按体积装（箱子装 100 件体积）
const r2 = PackEngine.packSingleBox([100, 100, 100], items1, {});
assert('无限重 itemsInBox=40', r2.ok && r2.itemsInBox === 40, 'got ' + (r2.itemsInBox));

// 用例3：多品种重量预算共享
// A: 1kg/件, need 100 ; B: 0.5kg/件, need 100 ; 限重 10kg
const items3 = [
  { name: 'A', l: 10, w: 10, h: 10, qty: 100, wt: 1 },
  { name: 'B', l: 10, w: 10, h: 10, qty: 100, wt: 0.5 }
];
const r3 = PackEngine.packSingleBox([100, 100, 100], items3, { maxWeight: 10 });
// 总装入重量应 <= 10kg
let w3 = 0;
r3.perProd.forEach((p, idx) => { w3 += p.inBox * items3[idx].wt; });
assert('多品种总重<=10kg', r3.ok && w3 <= 10 + 1e-6, 'weight=' + w3.toFixed(3));

// 用例4：箱子装不下任何物品
const r4 = PackEngine.packSingleBox([5, 5, 5], items1, {});
assert('箱子过小返回错误', !r4.ok && !!r4.error, 'err=' + (r4.error || ''));

console.log('\nDone. exitCode=' + (process.exitCode || 0));
