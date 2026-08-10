const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
['engine', 'ui'].forEach(id => {
  const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'));
  if (!m) { console.log('MISSING ' + id); process.exit(1); }
  try { new Function(m[1]); console.log('SYNTAX OK  ' + id + '  (' + m[1].split('\n').length + ' 行)'); }
  catch (e) { console.log('SYNTAX ERR ' + id + ': ' + e.message); process.exit(1); }
});
console.log('总行数: ' + html.split('\n').length);
