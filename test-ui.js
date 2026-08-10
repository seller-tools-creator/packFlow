// 界面冒烟测试：jsdom 加载 index.html，验证多箱/同款箱模式无运行时错误
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/Users/shitongsong/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); } }

const errors = [];
const mockCtx = () => ({
  setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  fill() {}, closePath() {}, setLineDash() {}, fillText() {}, save() {}, restore() {},
  font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: ''
});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => mockCtx();
    window.devicePixelRatio = 1;
    if (!window.performance) window.performance = { now: () => Date.now() };
    window.addEventListener('error', e => errors.push(e.error ? e.error.message : String(e.message)));
  }
});

const { window } = dom;
const doc = window.document;
function $(id) { return doc.getElementById(id); }
function fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); }

// 等脚本执行（IIFE 在 body 末尾同步执行）
setTimeout(() => {
  try {
    ok('无运行时错误', errors.length === 0, errors.join(' | '));
    ok('初始有结果输出', $('out').innerHTML.length > 200);
    ok('初始显示装箱明细', $('out').innerHTML.indexOf('装箱明细') >= 0);
    ok('初始显示箱数测算表', $('out').innerHTML.indexOf('装几个箱子最划算') >= 0);
    ok('初始为自由多箱模式', $('pillMode').textContent.indexOf('多箱') >= 0, $('pillMode').textContent);

    // 扫描表行数 = scanMaxBoxes(8) 或更多（Nmin..NmaxScan）
    var rows = doc.querySelectorAll('#out tbody tr');
    ok('扫描表有行', rows.length >= 5, 'rows=' + rows.length);

    // 切换到 同款箱 模式
    var idBtn = doc.querySelector('#modeSeg button[data-mode="identical"]');
    ok('存在同款箱按钮', !!idBtn);
    fire(idBtn, 'click');
    ok('切到同款箱后无错误', errors.length === 0, errors.join(' | '));
    ok('同款箱显示每箱相同', $('out').innerHTML.indexOf('每箱相同') >= 0, $('out').innerHTML.indexOf('每箱相同') >= 0 ? '' : 'missing');
    ok('同款箱 pill 更新', $('pillMode').textContent.indexOf('同款') >= 0, $('pillMode').textContent);

    // 切换回自由多箱
    fire(doc.querySelector('#modeSeg button[data-mode="free"]'), 'click');
    ok('切回自由无错误', errors.length === 0, errors.join(' | '));

    // 添加产品
    var before = doc.querySelectorAll('#products .prod').length;
    fire($('btnAdd'), 'click');
    var after = doc.querySelectorAll('#products .prod').length;
    ok('添加产品后行数+1', after === before + 1, before + '->' + after);

    // 修改目标箱数（取消自动）
    $('autoBox').checked = false; fire($('autoBox'), 'change');
    $('boxesTarget').value = '3'; fire($('boxesTarget'), 'input');
    ok('固定箱数后无错误', errors.length === 0, errors.join(' | '));

    // 修改单箱最低计费
    $('minBill').value = '8'; fire($('minBill'), 'input');
    ok('改最低计费后无错误', errors.length === 0, errors.join(' | '));

    // 复制方案按钮（stub clipboard）
    var copied = false;
    window.navigator.clipboard = { writeText: () => { copied = true; return Promise.resolve(); } };
    fire($('btnCopy'), 'click');
    ok('复制方案执行无异常', errors.length === 0, errors.join(' | '));

    // 高级参数：超重/长边附加
    $('overRate').value = '2'; fire($('overRate'), 'input');
    $('longRate').value = '2'; fire($('longRate'), 'input');
    ok('改附加费后无错误', errors.length === 0, errors.join(' | '));

    // ===== 亚马逊分仓测算标签 =====
    var amzBtn = doc.querySelector('.tabs button[data-tab="amz"]');
    ok('存在亚马逊标签', !!amzBtn);
    fire(amzBtn, 'click');
    ok('切到亚马逊标签无错误', errors.length === 0, errors.join(' | '));
    ok('亚马逊面板隐藏装箱策略组', $('modeSeg').closest('[data-tab]').style.display === 'none');
    ok('亚马逊结果含决策步骤', $('out').innerHTML.indexOf('决策步骤') >= 0);
    ok('亚马逊结果含方案对比', $('out').innerHTML.indexOf('两种方案对比') >= 0);
    ok('亚马逊结果含分段表', $('out').innerHTML.indexOf('各 SKU 分段') >= 0);
    ok('默认推荐分仓(方案B)', $('out').innerHTML.indexOf('分 5 仓可省') >= 0, $('out').innerHTML.match(/分 \d+ 仓可省[^<]*/));

    // 非 5 整除 → 出现警告
    var p0 = doc.querySelectorAll('#products .prod')[0];
    p0.querySelector('.pqty').value = '123'; fire(p0.querySelector('.pqty'), 'change');
    fire(amzBtn, 'click'); // 强制同步重渲染
    ok('非5整除出现警告', $('out').innerHTML.indexOf('不能被 5 整除') >= 0);

    // 改费率取值为上限并重渲染
    $('amzFeePoint').value = 'hi'; fire($('amzFeePoint'), 'change');
    fire(amzBtn, 'click');
    ok('改费率取值后无错误', errors.length === 0, errors.join(' | '));

    // 复制亚马逊方案
    var copiedAmz = false;
    window.navigator.clipboard = { writeText: () => { copiedAmz = true; return Promise.resolve(); } };
    fire($('btnCopy'), 'click');
    ok('复制亚马逊方案无异常', errors.length === 0, errors.join(' | '));

    // 切回装箱标签
    fire(doc.querySelector('.tabs button[data-tab="pack"]'), 'click');
    ok('切回装箱标签无错误', errors.length === 0, errors.join(' | '));

    console.log('\n=== 界面测试结果 ===');
    console.log('通过 ' + pass + ' / 失败 ' + fail);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('界面测试异常: ' + e.message + '\n' + e.stack);
    process.exit(1);
  }
}, 300);
