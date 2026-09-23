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

// 手动注入本地脚本（CDN 不加载，marked/DOMPurify 走 fallback）
['config', 'github', 'store', 'ui', 'editor', 'app'].forEach(name => {
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

  function startRoutes() { next(); }
  let i = 0;
  const next = () => {
    if (i >= routes.length) {
      // 交互测试：留言板提交
      win.location.hash = '#/guestbook';
      setTimeout(() => {
        try {
          const d = win.document;
          d.getElementById('gb-name').value = '测试同学';
          d.getElementById('gb-content').value = '冒烟测试留言';
          d.querySelector('[data-action="submit-guest"]').click();
          out.push((html().indexOf('冒烟测试留言') >= 0 ? '✓ ' : '✗ ') + '留言板提交与渲染');
        } catch (e) { out.push('✗ 留言板交互: ' + e.message); }

        // 交互测试：文章评论
        win.location.hash = '#/post/why-bedrock-on-github';
        setTimeout(() => {
          try {
            const d = win.document;
            d.getElementById('cmt-name').value = '测试同学';
            d.getElementById('cmt-content').value = '冒烟测试评论';
            d.querySelector('[data-action="submit-comment"]').click();
            out.push((html().indexOf('冒烟测试评论') >= 0 ? '✓ ' : '✗ ') + '文章评论提交与渲染');
          } catch (e) { out.push('✗ 评论交互: ' + e.message); }

          // 交互测试：搜索
          win.location.hash = '#/posts';
          setTimeout(() => {
            try {
              win.document.getElementById('search-input').value = '单片机';
              win.document.querySelector('[data-action="do-search"]').click();
              setTimeout(() => {
                out.push((html().indexOf('单片机') >= 0 ? '✓ ' : '✗ ') + '搜索筛选');
                out.push('');
                out.push(errors.length ? ('!! 运行时错误 ' + errors.length + ' 条:\n' + errors.slice(0, 15).join('\n')) : '✓ 无 JS 运行时错误');
                fs.writeFileSync(path.join(dir, '_smoke_result.txt'), out.join('\n'), 'utf8');
                win.close();
                process.exit(0);
              }, 400);
            } catch (e) { out.push('✗ 搜索: ' + e.message); fs.writeFileSync(path.join(dir, '_smoke_result.txt'), out.join('\n'), 'utf8'); process.exit(0); }
          }, 300);
        }, 300);
      }, 300);
      return;
    }
    const [hash, keyword] = routes[i++];
    win.location.hash = hash;
    setTimeout(() => {
      const ok = has(keyword);
      out.push((ok ? '✓ ' : '✗ ') + hash + '  (含「' + keyword + '」, 长度 ' + html().length + ')');
      next();
    }, 200);
  };

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
