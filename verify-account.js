// 验证账户模块：登录/注册入口、弹窗、我的方案抽屉、保存方案按钮（前端 DOM 层）
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
    // 测试环境无后端：fetch 直接 reject，初始化走 catch 分支渲染登录按钮
    window.fetch = () => Promise.reject(new Error('no network in test'));
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
    assert('账户模块加载无运行时错误', errors.length===0, errors.join(' | '));
    // 导航区
    assert('导航含保存方案按钮 btnSavePlan', !!$('btnSavePlan'));
    assert('导航含登录入口容器 authSpot', !!$('authSpot'));
    // 未登录态应渲染“登录/注册”按钮
    const loginBtn = $('btnLogin');
    assert('未登录态渲染登录/注册按钮 btnLogin', !!loginBtn);
    // 点击登录按钮打开弹窗
    fire(loginBtn, 'click');
    assert('点击登录按钮后弹窗打开 (authOverlay.on)', $('authOverlay') && $('authOverlay').classList.contains('on'));
    // 弹窗内部元素
    assert('弹窗含登录/注册 tab', !!$('tabLogin') && !!$('tabSignup'));
    assert('弹窗含邮箱/密码输入与提交按钮', !!$('auEmail') && !!$('auPw') && !!$('authSubmit'));
    // 切到注册 tab
    fire($('tabSignup'), 'click');
    assert('切到注册 tab 后提交按钮文案变化', $('authSubmit') && /注册/.test($('authSubmit').textContent));
    // 我的方案抽屉
    assert('存在我的方案抽屉 planDrawer', !!$('planDrawer'));
    assert('存在抽屉遮罩 drawerMask', !!$('drawerMask'));
    assert('抽屉含方案列表容器 planList', !!$('planList'));
    // 单箱结果页的保存方案按钮也绑定（在装载后出现）
    $('sbL').value='60'; $('sbW').value='40'; $('sbH').value='40';
    fire($('btnSingle'), 'click');
    assert('单箱结果页存在保存方案按钮 sbSavePlan', !!$('sbSavePlan'));
    if($('authClose')) fire($('authClose'), 'click');
    fire($('sbSavePlan'), 'click');
    assert('点击单箱保存方案(未登录)弹出登录框', $('authOverlay') && $('authOverlay').classList.contains('on'));
  } catch(e){
    fail++; console.log('FAIL - 测试异常: '+e.message);
  }
  console.log('\n结果: '+pass+' PASS, '+fail+' FAIL');
  process.exit(fail?1:0);
}, 200);
