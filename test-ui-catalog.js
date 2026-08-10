const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:8780/' });
const win = dom.window;
global.window = win;
global.document = win.document;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};
win.confirm = function() { return true; };
win.HTMLCanvasElement.prototype.getContext = function() {
  return {
    clearRect(){}, save(){}, restore(){}, translate(){}, scale(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, fillRect(){}, fillText(){}, strokeRect(){},
    setTransform(){}, setLineDash(){}, measureText(){return{width:0};}, closePath(){}, arc(){}
  };
};
win.HTMLCanvasElement.prototype.toDataURL = function() { return ''; };
Object.defineProperty(win.HTMLElement.prototype, 'clientWidth', { get: function() { return 1200; } });
Object.defineProperty(win.HTMLElement.prototype, 'clientHeight', { get: function() { return 800; } });

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

let pass = 0, fail = 0;
function ok(desc, cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + desc); }
  else { fail++; console.log('  ✗ ' + desc + (msg ? ' — ' + msg : '')); }
}

(async () => {
  await wait(80);
  const $ = (id) => document.getElementById(id);

  console.log('=== A. 初始标签与徽章 ===');
  ok('产品库 tab 存在', !!document.querySelector('.tabs button[data-tab="catalog"]'));
  document.querySelector('.tabs button[data-tab="catalog"]').click();
  await wait(50);
  ok('切换到产品库面板', !!$('catalogList'));
  ok('空态显示', $('catalogList').innerHTML.indexOf('暂无产品') >= 0);

  console.log('\n=== B. 装箱页添加产品并触发入库 ===');
  document.querySelector('.tabs button[data-tab="pack"]').click();
  await wait(50);
  // 默认已有 3 个产品，模拟输入确保有效
  const first = document.querySelector('#products .prod');
  first.querySelector('.pname').value = '测试猫窝';
  first.querySelector('.pl').value = '25';
  first.querySelector('.pw').value = '20';
  first.querySelector('.ph').value = '15';
  first.querySelector('.pwt').value = '0.5';
  first.querySelector('.pqty').value = '100';
  // 触发 render
  first.querySelector('.pl').dispatchEvent(new win.Event('input', { bubbles: true }));
  await wait(300);

  document.querySelector('.tabs button[data-tab="catalog"]').click();
  await wait(50);
  ok('产品库出现测试猫窝', $('catalogList').innerHTML.indexOf('测试猫窝') >= 0);
  ok('产品库徽章显示 1', document.querySelector('.tabs button[data-tab="catalog"]').innerHTML.indexOf('new-count') >= 0);

  console.log('\n=== C. 从产品库加入清单 ===');
  const addBtn = $('catalogList').querySelector('.catalog-card .add');
  ok('存在加入清单按钮', !!addBtn);
  if (addBtn) {
    addBtn.click();
    await wait(50);
    ok('切回装箱页', document.querySelector('.tabs button[data-tab="pack"]').classList.contains('on'));
    const names = Array.from(document.querySelectorAll('#products .prod .pname')).map(i => i.value);
    ok('清单中新增了测试猫窝', names.some(n => n.indexOf('测试猫窝') >= 0));
  }

  console.log('\n=== D. 清空产品库 ===');
  document.querySelector('.tabs button[data-tab="catalog"]').click();
  await wait(50);
  $('btnClearCatalog').click();
  await wait(50);
  ok('清空后显示空态', $('catalogList').innerHTML.indexOf('暂无产品') >= 0);

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
