/* 冒烟测试：jsdom 加载 index.html（不加载 CDN），手动注入本地脚本，逐路由检查渲染 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/lenovo/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const dir = path.join(__dirname, '..');
const BASE = 'http://localhost:8321/';
const errors = [];
const IGNORE = /Not implemented|tailwind is not defined|Could not parse CSS|Error: Not implemented/i;

const vc = new VirtualConsole();
vc.on('jsdomError', e => { const m = String((e && e.message) || e); if (!IGNORE.test(m)) errors.push('jsdomError: ' + m); });
vc.on('error', (...a) => { const m = a.join(' '); if (!IGNORE.test(m)) errors.push('console.error: ' + m); });
vc.on('warn', () => {});
vc.on('log', () => {});

const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
  url: BASE, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc
});
const win = dom.window;
win.fetch = (u, o) => fetch(new URL(String(u), BASE), o);
win.addEventListener('error', e => { if (!IGNORE.test(String(e.message))) errors.push('window.onerror: ' + e.message); });

// 极简 marked 替身：CDN 不加载时，ui.md() 只能输出纯文本，正文里就没有 h2/h3，
// 目录测试会变成假阳性。这里补一个只认 # / ## / ### 的最小实现。
win.marked = {
  setOptions() {},
  parse(t) {
    return String(t || '').split(/\n{2,}/).map(block => {
      const m = /^(#{1,6})\s+(.*)$/.exec(block.trim());
      if (m) { const lv = m[1].length; return '<h' + lv + '>' + m[2] + '</h' + lv + '>'; }
      return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
  }
};

// 手动注入本地脚本（CDN 不加载，DOMPurify 走 fallback）
['config', 'github', 'store', 'analytics', 'ui', 'editor', 'app'].forEach(name => {
  const code = fs.readFileSync(path.join(dir, 'assets', 'js', name + '.js'), 'utf8');
  try { win.eval(code); } catch (e) { errors.push('eval ' + name + '.js: ' + e.message); }
});

function html() { const el = win.document.getElementById('view'); return el ? el.innerHTML : ''; }
function has(s) { return html().indexOf(s) >= 0; }

const routes = [
  ['#/', '沉潜'],
  ['#/posts', '全部文章'],
  ['#/post/why-bedrock-on-github', '服务器'],
  ['#/projects', '项目'],
  ['#/archive', '归档'],
  ['#/about', '关于我'],
  ['#/guestbook', '留言板'],
  ['#/links', '友链'],
  ['#/admin', '创作台'],
  ['#/nope', '404']
];

// 等数据加载完成再开始测路由
let waited = 0;
const waitLoaded = cb => {
  if ((win.Bedrock && win.Bedrock.store.state.loaded) || waited > 15000) return cb();
  waited += 200;
  setTimeout(() => waitLoaded(cb), 200);
};

waitLoaded(() => {
  setTimeout(() => {
  const out = [];
  const B = win.Bedrock;
  out.push('[boot] 等待耗时 ≈ ' + waited + 'ms');
  out.push('[boot] 首屏 HTML 长度 = ' + html().length);
  out.push('[boot] 数据源 = ' + (B ? B.store.state.source : 'Bedrock 未定义!'));
  out.push('[boot] 文章数 = ' + (B ? B.store.state.posts.length : '-'));
  out.push('[boot] 是否作者 = ' + (B ? B.store.isAuthor() : '-'));

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function startRoutes() { next(); }
  let i = 0;
  const next = () => {
    if (i >= routes.length) { runInteractions(); return; }
    const [hash, keyword] = routes[i++];
    win.location.hash = hash;
    setTimeout(() => {
      const ok = has(keyword);
      out.push((ok ? '✓ ' : '✗ ') + hash + '  (含「' + keyword + '」, 长度 ' + html().length + ')');
      next();
    }, 200);
  };

  async function runInteractions() {
    const d = win.document;

    // 1) 留言板
    win.location.hash = '#/guestbook'; await wait(300);
    try {
      d.getElementById('gb-name').value = '测试同学';
      d.getElementById('gb-content').value = '冒烟测试留言';
      d.querySelector('[data-action="submit-guest"]').click();
      out.push((html().indexOf('冒烟测试留言') >= 0 ? '✓ ' : '✗ ') + '留言板提交与渲染');
    } catch (e) { out.push('✗ 留言板交互: ' + e.message); }

    // 2) 本地评论（Giscus 未启用时）
    win.location.hash = '#/post/why-bedrock-on-github'; await wait(320);
    try {
      d.getElementById('cmt-name').value = '测试同学';
      d.getElementById('cmt-content').value = '冒烟测试评论';
      d.querySelector('[data-action="submit-comment"]').click();
      out.push((html().indexOf('冒烟测试评论') >= 0 ? '✓ ' : '✗ ') + '文章评论提交与渲染');
    } catch (e) { out.push('· 评论交互跳过（可能已启用 Giscus）'); }

    // 3) 目录跳转：点击后不能把 hash 改掉（否则会跳 404）
    win.location.hash = '#/post/51-mcu-first-led'; await wait(320);
    try {
      const items = d.querySelectorAll('.toc-item');
      out.push((items.length > 0 ? '✓ ' : '✗ ') + '文章目录生成（' + items.length + ' 项）');
      (items[1] || items[0]).click();
      await wait(300);
      out.push((win.location.hash.indexOf('#/post/51-mcu-first-led') >= 0 ? '✓ ' : '✗ ') + '点目录不会误跳 404');
    } catch (e) { out.push('✗ 目录交互: ' + e.message); }

    // 4) 搜索
    win.location.hash = '#/posts'; await wait(320);
    try {
      d.getElementById('search-input').value = '单片机';
      d.querySelector('[data-action="do-search"]').click();
      await wait(400);
      out.push((html().indexOf('单片机') >= 0 ? '✓ ' : '✗ ') + '搜索筛选');
    } catch (e) { out.push('✗ 搜索: ' + e.message); }

    // 5) 访问统计：没有 content/stats.json 时必须整块沉默，不能露出残缺 UI
    win.location.hash = '#/'; await wait(320);
    out.push((html().indexOf('站点数据') < 0 ? '✓ ' : '✗ ') + '无统计数据时首页不显示「站点数据」区块');

    // 6) 创作台里的统计设置卡片
    win.location.hash = '#/admin'; await wait(360);
    try {
      const code = d.getElementById('st-code');
      const btn = d.querySelector('[data-action="check-analytics"]');
      out.push((code && btn ? '✓ ' : '✗ ') + '访问统计设置卡片渲染');
      btn.click();
      await wait(2500);
      const txt = ((d.getElementById('stats-result') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      out.push((txt.length > 0 ? '✓ ' : '✗ ') + '「检查数据是否回流」有反馈（' + txt.slice(0, 24) + '…）');
    } catch (e) { out.push('✗ 统计卡片: ' + e.message); }

    out.push('');
    out.push(errors.length ? ('!! 运行时错误 ' + errors.length + ' 条:\n' + errors.slice(0, 15).join('\n')) : '✓ 无 JS 运行时错误');
    fs.writeFileSync(path.join(dir, '_smoke_result.txt'), out.join('\n'), 'utf8');
    win.close();
    process.exit(0);
  }

  // Giscus 评论设置卡片（未登录时应给出明确的下一步指引）
  win.location.hash = '#/admin';
  setTimeout(() => {
    try {
      const d = win.document;
      const btn = d.querySelector('[data-action="detect-giscus"]');
      out.push((btn && d.getElementById('giscus-form') ? '✓ ' : '✗ ') + 'Giscus 设置卡片渲染');
      btn.click();
      setTimeout(() => {
        const txt = (d.getElementById('giscus-result') || {}).textContent || '';
        out.push((txt.indexOf('先登录') >= 0 ? '✓ ' : '✗ ') + '未登录时给出 Giscus 指引');
        startRoutes();
      }, 250);
    } catch (e) { out.push('✗ Giscus 卡片: ' + e.message); startRoutes(); }
  }, 250);
  }, 50);
});
