// 验证单箱装载默认态为方式B静态小图+左侧大信息卡片（同多箱规划布局），点击放大进入方式A可拖拽3D
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/Users/shitongsong/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const errors = [];
const mockCtx = () => ({
  setTransform(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
  fill(){}, closePath(){}, setLineDash(){}, fillText(){}, save(){}, restore(){},
  font:'', fillStyle:'', strokeStyle:'', lineWidth:0, textAlign:''
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
function $(id){ return doc.getElementById(id); }
function fire(el, type){ if(el) el.dispatchEvent(new window.Event(type, { bubbles: true })); }

let pass=0, fail=0;
function assert(name, cond, extra){ if(cond){ pass++; console.log('PASS - '+name); } else { fail++; console.log('FAIL - '+name+(extra?' -> '+extra:'')); } }

setTimeout(() => {
  try {
    assert('默认在单箱装载tab', doc.querySelector('.tabs button.on').getAttribute('data-tab')==='single');
    $('sbL').value='60'; $('sbW').value='40'; $('sbH').value='40';
    fire($('btnSingle'), 'click');
    assert('无运行时错误', errors.length===0, errors.join(' | '));
    assert('默认态存在静态小图 canvas (sbStaticCanvas)', !!$('sbStaticCanvas'));
    assert('默认态不存在旧 stage3d', !$('stage3d'));
    assert('默认态不存在缩放滑块 sbZoom', !$('sbZoom'));
    assert('存在放大按钮 sbMax', !!$('sbMax'));
    assert('存在左侧大信息卡片 sbMainCard', !!$('sbMainCard') && $('sbMainCard').innerHTML.length>50);
    assert('不存在旧的 sbCost', !$('sbCost'));
    assert('不存在旧的 sbMetrics', !$('sbMetrics'));
    assert('采用左右布局 sb-result-top', !!doc.querySelector('.sb-result-top'));
    var vizCap=$('sbVizCap');
    assert('右侧小图说明含利用率', !!vizCap && /利用率/.test(vizCap.textContent));
    fire($('sbMax'), 'click');
    assert('点击放大后遮罩打开', $('sbMaxOverlay').classList.contains('on'));
    assert('放大态存在 stage3dMax', !!$('stage3dMax'));
  } catch (e) {
    console.error(e);
    fail++;
  }
  console.log('\n结果: '+pass+' PASS, '+fail+' FAIL');
  process.exit(fail>0?1:0);
}, 0);
