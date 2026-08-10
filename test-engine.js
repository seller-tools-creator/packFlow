// 引擎测试：从 index.html 抽取 <script id="engine"> 运行
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) { console.error('MISSING engine'); process.exit(1); }
const tmp = '/tmp/pack-engine.tmp.js';
fs.writeFileSync(tmp, m[1]);
const E = require(tmp);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function approx(a, b, e) { return Math.abs(a - b) <= (e || 1e-6); }

const base = {
  divisor: 5000, minCharge: 12, minBill: 5, price: 8, maxWeight: 30,
  overFrom: 30, overTo: 45, overRate: 1.5, longFrom: 120, longTo: 200, longRate: 1.5,
  step: 5, minSide: 10, maxSide: 120, maxSum: 0, depth: 2, gap: 0, wall: 0,
  scanMaxBoxes: 8, maxSkuPerBox: 5
};

console.log('=== computeFreight 运费规则 ===');
// 体积重 60000/5000=12, 实重 4 → chargeable = max(12,4,5,12)=12, 无附加
let fr = E.computeFreight(12, 4, 40, base);
ok('体积重12/实重4 → 计费12', approx(fr.chargeable, 12), fr.chargeable);
ok('基础运费 12*8=96', approx(fr.freight, 96), fr.freight);
// 5KG 地板：体积重3, 实重2 → chargeable = max(3,2,5,12)=12 (起收12仍主导)
fr = E.computeFreight(3, 2, 30, base);
ok('体积重3/实重2 → 受起收12限制', approx(fr.chargeable, 12), fr.chargeable);
// 若起收降到5，则5KG地板生效：max(3,2,5,5)=5
fr = E.computeFreight(3, 2, 30, Object.assign({}, base, { minCharge: 5 }));
ok('起收=5时5KG地板生效 → 计费5', approx(fr.chargeable, 5), fr.chargeable);
// 超重附加 30-45：实重 40 → 计费 max(12,40,5,12)=40, 附加 1.5*40=60, 运费 40*8+60=380
fr = E.computeFreight(12, 40, 40, base);
ok('实重40在区间 → 计费40', approx(fr.chargeable, 40), fr.chargeable);
ok('超重附加 1.5*40=60 → 运费380', approx(fr.freight, 40 * 8 + 60), fr.freight);
// 长边附加 120-200：最长边150 → 附加1.5*计费
fr = E.computeFreight(12, 4, 150, base);
ok('长边150 → 计费12 附加1.5*12=18 → 运费114', approx(fr.freight, 12 * 8 + 18), fr.freight);
// 长边超200 不附加
fr = E.computeFreight(12, 4, 210, base);
ok('长边210 无长边附加 → 运费96', approx(fr.freight, 96), fr.freight);

console.log('=== distributeFree 分配 ===');
const prods = [
  { l: 20, w: 15, h: 8, wt: 0, qty: 120, name: 'A', netVol: 2400 },
  { l: 12, w: 12, h: 12, wt: 0, qty: 80, name: 'B', netVol: 1728 },
  { l: 30, w: 20, h: 10, wt: 0, qty: 60, name: 'C', netVol: 6000 }
];
let d = E.distributeFree(prods, 5, 5);
ok('5箱可分配(无错误)', !d.error, d.error);
ok('5箱分配后每箱≤5 SKU', d.error || d.boxes.every(b => Object.keys(b.skuSet).length <= 5));
let assigned = 0; if (d.boxes) d.boxes.forEach(b => { for (let k in b.map) assigned += b.map[k]; });
ok('分配总数=总件数260', d.error || assigned === 260, assigned);
// 箱数不足：3 SKU, maxSku5 → Nmin=1, 但2箱OK；测试 N=1 with 6 SKU should fail
let six = []; for (let i = 0; i < 6; i++) six.push({ l: 10, w: 10, h: 10, wt: 0, qty: 10, name: 'S' + i, netVol: 1000 });
let d6 = E.distributeFree(six, 1, 5);
ok('6种SKU装1箱(≤5)应失败', !!d6.error, d6.error);

console.log('=== evalFree / evalIdentical ===');
let ef = E.evalFree(prods, 5, base, 5);
ok('evalFree(5箱)可行', ef.feasible, ef.err);
ok('evalFree 总运费>0', ef.feasible && ef.total > 0, ef.total);
let ei = E.evalIdentical(prods, 5, base);
// 120/5=24, 80/5=16, 60/5=12 整除 → feasible
ok('evalIdentical(5箱)整除可行', ei.feasible, ei.err);
ok('evalIdentical 整除余量=0', ei.feasible && ei.remTotal === 0, ei.remTotal);
// 不可整除：总数不能被 N 整除
let prods2 = JSON.parse(JSON.stringify(prods)); prods2[0].qty = 121; // 121/5=24 余1
let ei2 = E.evalIdentical(prods2, 5, base);
ok('evalIdentical 不整除仍可行(用下取整)', ei2.feasible, ei2.err);
ok('evalIdentical 余量=1', ei2.feasible && ei2.remTotal === 1, ei2.remTotal);
// SKU 超限
let many = []; for (let i = 0; i < 7; i++) many.push({ l: 10, w: 10, h: 10, wt: 0, qty: 10, name: 'X' + i, netVol: 1000 });
let ei3 = E.evalIdentical(many, 2, base);
ok('7种SKU同款箱应失败', !ei3.feasible, ei3.err);

console.log('=== plan 主规划 ===');
let r = E.plan(Object.assign({}, base, { products: prods, mode: 'free', autoPlan: true }));
ok('plan free 成功', r.ok, r.error);
ok('plan free 返回箱数', r.ok && r.N >= 1, r.N);
ok('plan free 装箱明细数=箱数', r.ok && r.boxes.length === r.N, r.boxes.length);
ok('plan free 总件数守恒', r.ok && approx(r.totalUnits, 260, 1e-6), r.totalUnits);
ok('plan free 推荐箱数存在', r.ok && r.recFreeN != null, r.recFreeN);
// 同款箱
let ri = E.plan(Object.assign({}, base, { products: prods, mode: 'identical', autoPlan: true }));
ok('plan identical 成功', ri.ok, ri.error);
ok('plan identical 全部箱相同', ri.ok && ri.identical === true);
ok('plan identical 总运费=N×单箱', ri.ok && approx(ri.total.freight, ri.boxes[0].freight * ri.N, 1e-6));
// 对比字段
ok('plan 含对比对象', ri.ok && ri.comparison && ri.comparison.otherLabel.indexOf('自由') >= 0);

console.log('=== 性能（自动规划扫描）===');
let t0 = Date.now();
let rp = E.plan(Object.assign({}, base, { products: prods, mode: 'free', autoPlan: true }));
let ms = Date.now() - t0;
ok('自动规划 < 8s', ms < 8000, ms + 'ms');
console.log('  自动规划耗时 ' + ms + ' ms，候选箱规评估 ' + (rp.scan ? '完成' : 'n/a'));

console.log('\n=== 结果 ===');
console.log('通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
