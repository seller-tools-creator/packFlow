/* 验证 PACKFLOW 页面实际渲染后是否包含 3 个 tab 按钮 */
const http = require('http');
const { JSDOM } = require('jsdom');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  const html = await fetchHtml('http://localhost:8781/');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8781/',
    runScripts: 'dangerously',
    resources: 'usable'
  });
  // 等待内联脚本执行完一轮 microtask
  await new Promise(r => setTimeout(r, 500));
  const doc = dom.window.document;
  const tabs = Array.from(doc.querySelectorAll('.tabs button'));
  console.log('tabs count:', tabs.length);
  console.log('tabs:', tabs.map(b => ({ 'data-tab': b.getAttribute('data-tab'), text: b.textContent.trim() })));
  if (tabs.length !== 3) {
    console.error('FAIL: 期望 3 个 tab，实际', tabs.length);
    process.exit(1);
  }
  const expected = ['pack', 'amz', 'catalog'];
  const actual = tabs.map(b => b.getAttribute('data-tab'));
  if (!expected.every((k, i) => actual[i] === k)) {
    console.error('FAIL: tab 顺序不对', actual);
    process.exit(1);
  }
  console.log('PASS: 页面确实渲染出 3 个选卡，包含 catalog。');
  dom.window.close();
})();
