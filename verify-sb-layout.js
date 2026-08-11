// 验证单箱装载结果布局：顶部可拖拽3D大图 + 下方信息卡（方案/数量/重量/体积/保存方案）+ 右侧体积利用率 + 运费大卡片
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
    assert('默认态存在可拖拽3D canvas (stage3d)', !!$('stage3d'));
    assert('存在缩放滑块 sbZoom', !!$('sbZoom'));
    assert('存在重置视角按钮 sbReset', !!$('sbReset'));
    assert('存在放大按钮 sbMax', !!$('sbMax'));
    assert('存在摘要行 sb-summary-row', !!doc.querySelector('.sb-summary-row'));
    assert('3D图位于运费大卡片下方', (function(){
      var mainCard=$('sbMainCard');
      var viz=doc.querySelector('.sb-viz');
      if(!mainCard || !viz) return false;
      var nodes=Array.from(mainCard.parentNode.children);
      return nodes.indexOf(viz) > nodes.indexOf(mainCard);
    })());
    assert('装不下提示与SKU明细位于3D图上方', (function(){
      var msg=$('sbMsg'), per=$('sbPer'), viz=doc.querySelector('.sb-viz');
      if(!msg || !per || !viz) return false;
      var nodes=Array.from(viz.parentNode.children);
      return nodes.indexOf(msg) < nodes.indexOf(viz) && nodes.indexOf(per) < nodes.indexOf(viz);
    })());
    var saveBadge=doc.querySelector('.save-badge');
    assert('运费卡片含节省徽标 save-badge', !!saveBadge && /节省/.test(saveBadge.textContent));
    assert('存在信息卡 sb-info-card', !!doc.querySelector('.sb-info-card'));
    assert('信息卡含方案切换器 sbPlanIdx/sbPlanTotal', !!$('sbPlanIdx') && !!$('sbPlanTotal'));
    assert('信息卡含装载数量/重量/体积指标', !!$('sbQty') && !!$('sbWt') && !!$('sbVol'));
    var saveBtn=$('sbSavePlan');
    assert('存在保存方案按钮 sbSavePlan', !!saveBtn);
    assert('保存按钮文字为“保存方案”', saveBtn && /保存方案/.test(saveBtn.textContent));
    var utilBig=$('sbUtilBig');
    assert('存在右侧体积利用率 sbUtilBig', !!utilBig);
    assert('利用率数值已填充', !!utilBig && /%/.test(utilBig.textContent));
    var utilTag=$('sbUtilTag');
    assert('最优推荐标签存在且首个方案可见', !!utilTag && utilTag.textContent.indexOf('最优推荐')>=0 && utilTag.style.display!=='none');
    assert('利用率框采用绿色样式(recommended)', !!$('sbUtilCol') && $('sbUtilCol').classList.contains('recommended'));
    assert('存在下方运费大卡片 sbMainCard', !!$('sbMainCard') && $('sbMainCard').innerHTML.length>50);
    assert('不存在旧的 sbCost', !$('sbCost'));
    assert('不存在旧的 sbMetrics', !$('sbMetrics'));
    assert('不采用左右布局 sb-result-top', !doc.querySelector('.sb-result-top'));
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
