const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const file = path.join(__dirname, 'index.html');
const html = fs.readFileSync(file, 'utf8');

const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

function vis(el){ return el && el.style.display !== 'none'; }

window.addEventListener('load', () => {
  setTimeout(() => {
    const out = [];
    const btns = [...document.querySelectorAll('.tabs button')];
    out.push('tab 按钮数量: ' + btns.length);
    btns.forEach(b => out.push(`  [${b.getAttribute('data-tab')}] 可见=${vis(b)} (inline display="${b.style.display}")`));

    // 初始：pack 选中，amz 分组应隐藏，catalog 面板应隐藏
    const amzGroup = document.querySelector('.group[data-panel="amz"]');
    const catalogWrap = document.querySelector('.wrap.catalog-wrap');
    const mainWrap = document.getElementById('mainWrap');
    out.push('--- 初始(pack) ---');
    out.push('  amz 分组可见=' + vis(amzGroup));
    out.push('  catalog 面板可见=' + vis(catalogWrap));
    out.push('  mainWrap 可见=' + vis(mainWrap));

    // 点击 产品库
    const catBtn = document.querySelector('.tabs button[data-tab="catalog"]');
    catBtn.click();
    out.push('--- 点击 产品库 ---');
    out.push('  catalog 按钮可见=' + vis(catBtn));
    out.push('  catalog 面板可见=' + vis(catalogWrap));
    out.push('  mainWrap 可见=' + vis(mainWrap));
    out.push('  amz 分组可见=' + vis(amzGroup));
    const catalogVisibleOnCatalog = vis(catBtn) && vis(catalogWrap) && !vis(mainWrap);

    // 点击 亚马逊分仓
    const amzBtn = document.querySelector('.tabs button[data-tab="amz"]');
    amzBtn.click();
    out.push('--- 点击 亚马逊分仓 ---');
    out.push('  amz 按钮可见=' + vis(amzBtn));
    out.push('  amz 分组可见=' + vis(amzGroup));
    out.push('  catalog 面板可见=' + vis(catalogWrap));
    out.push('  mainWrap 可见=' + vis(mainWrap));
    const amzVisibleOnAmz = vis(amzBtn) && vis(amzGroup) && !vis(catalogWrap);

    // 调试残留检查
    const hasDebugCss = html.includes('tabDebug') || html.includes('outline:2px solid red');
    out.push('--- 调试残留 ---');
    out.push('  含 tabDebug/红框=' + hasDebugCss);

    console.log(out.join('\n'));

    // 断言
    const ok =
      btns.length === 3 &&
      btns.every(vis) &&
      catalogVisibleOnCatalog &&
      amzVisibleOnAmz &&
      !hasDebugCss;
    console.log('\n=== 结果: ' + (ok ? 'PASS ✅' : 'FAIL ❌') + ' ===');
    process.exit(ok ? 0 : 1);
  }, 300);
});
