/* 冒烟测试：jsdom 加载 index.html（不加载 CDN），手动注入本地脚本，逐路由检查渲染
   用法：node tools/smoke.js
   依赖：jsdom（npm install jsdom，或 npm install -D jsdom）
   说明：
     1) 本地起静态服务（8321，占用则随机换），测试跑的是仓库里真实的
        content/posts.json，而不是内置演示数据；
     2) GitHub API 全部用 mock，不发真实请求——用来验证"存草稿 /
        检查部署"的状态机（本地草稿 → 已提交 → Pages 发布完成）。 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

const dir = path.join(__dirname, '..');
const PORT = 8321;
const errors = [];
const IGNORE = /Not implemented|tailwind is not defined|Could not parse CSS|Error: Not implemented/i;

/* ---------- 本地静态服务：让 jsdom 里的 fetch 能读到真实文件 ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(dir, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(buf);
  });
});

const vc = new VirtualConsole();
vc.on('jsdomError', e => { const m = String((e && e.message) || e); if (!IGNORE.test(m)) errors.push('jsdomError: ' + m); });
vc.on('error', (...a) => { const m = a.join(' '); if (!IGNORE.test(m)) errors.push('console.error: ' + m); });
vc.on('warn', () => {});
vc.on('log', () => {});

server.on('error', () => server.listen(0));   // 8321 被占用就换随机端口
server.listen(PORT, () => {
  const port = server.address().port;
  if (port !== PORT) console.log('· 8321 被占用，改用端口 ' + port);
  run('http://localhost:' + port + '/').then(() => { server.close(); process.exit(0); });
});

async function run(base) {
  const dom = new JSDOM(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), {
    url: base, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc
  });
  const win = dom.window;
  win.fetch = (u, o) => fetch(new URL(String(u), base), o);
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

  const out = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function html() { const el = win.document.getElementById('view'); return el ? el.innerHTML : ''; }
  function has(s) { return html().indexOf(s) >= 0; }
  const B = () => win.Bedrock;

  // 等数据加载完成再开始测
  let waited = 0;
  while (!(B() && B().store.state.loaded) && waited < 15000) { await wait(200); waited += 200; }
  await wait(300);

  out.push('[boot] 数据源 = ' + B().store.state.source + '，文章数 = ' + B().store.state.posts.length + '（期望 local + 5 篇真实文章）');

  /* ================= 路由渲染 ================= */
  const routes = [
    ['#/', '沉潜'],
    ['#/posts', '全部文章'],
    ['#/post/why-bedrock-on-github', '服务器'],
    ['#/post/51-mcu', '单片机'],
    ['#/projects', '项目'],
    ['#/archive', '归档'],
    ['#/about', '关于我'],
    ['#/guestbook', '留言板'],
    ['#/links', '友链'],
    ['#/admin', '创作台'],
    ['#/nope', '404']
  ];
  for (const [hash, keyword] of routes) {
    win.location.hash = hash;
    await wait(250);
    out.push((has(keyword) ? '✓ ' : '✗ ') + hash + '  (含「' + keyword + '」)');
  }

  /* ================= 交互 ================= */
  // 1) 留言板
  win.location.hash = '#/guestbook'; await wait(250);
  try {
    win.document.getElementById('gb-name').value = '测试同学';
    win.document.getElementById('gb-content').value = '冒烟测试留言';
    win.document.querySelector('[data-action="submit-guest"]').click();
    out.push((has('冒烟测试留言') ? '✓ ' : '✗ ') + '留言板提交与渲染');
  } catch (e) { out.push('✗ 留言板交互: ' + e.message); }

  // 2) 本地评论（Giscus 未启用时）
  win.location.hash = '#/post/why-bedrock-on-github'; await wait(250);
  try {
    win.document.getElementById('cmt-name').value = '测试同学';
    win.document.getElementById('cmt-content').value = '冒烟测试评论';
    win.document.querySelector('[data-action="submit-comment"]').click();
    out.push((has('冒烟测试评论') ? '✓ ' : '✗ ') + '文章评论提交与渲染');
  } catch (e) { out.push('· 评论交互跳过（可能已启用 Giscus）'); }

  // 3) 目录跳转：点击后不能把 hash 改掉（否则会跳 404）
  win.location.hash = '#/post/51-mcu'; await wait(250);
  try {
    const items = win.document.querySelectorAll('.toc-item');
    out.push((items.length > 0 ? '✓ ' : '✗ ') + '文章目录生成（' + items.length + ' 项）');
    (items[1] || items[0]).click();
    await wait(250);
    out.push((win.location.hash.indexOf('#/post/51-mcu') >= 0 ? '✓ ' : '✗ ') + '点目录不会误跳 404');
  } catch (e) { out.push('✗ 目录交互: ' + e.message); }

  // 4) 搜索
  win.location.hash = '#/posts'; await wait(250);
  try {
    win.document.getElementById('search-input').value = '单片机';
    win.document.querySelector('[data-action="do-search"]').click();
    await wait(350);
    out.push((has('单片机') ? '✓ ' : '✗ ') + '搜索筛选');
  } catch (e) { out.push('✗ 搜索: ' + e.message); }

  // 5) 访问统计：没有 content/stats.json 时必须整块沉默
  win.location.hash = '#/'; await wait(250);
  out.push((html().indexOf('站点数据') < 0 ? '✓ ' : '✗ ') + '无统计数据时首页不显示「站点数据」区块');

  // 6) 阅读时长：详情页应显示"约 N 分钟"，且不再是清一色 2 分钟
  win.location.hash = '#/post/why-bedrock-on-github'; await wait(250);
  {
    const meta = win.document.querySelector('article.nb-card .border-y-2');
    const txt = meta ? meta.textContent.replace(/\s+/g, ' ') : '';
    out.push((/约 \d+ 分钟/.test(txt) ? '✓ ' : '✗ ') + '详情页阅读时长显示（' + txt.slice(0, 46) + '…）');
  }

  /* ================= 草稿 / 部署状态机（mock GitHub API） ================= */
  const store = B().store, gh = B().gh, editor = B().editor;
  const overlayKey = store.K.overlay;

  // 7) 未登录点「存为草稿」：只存本地，且明确计入"本地草稿"
  win.localStorage.removeItem(overlayKey);
  win.location.hash = '#/admin'; await wait(250);
  win.document.querySelector('[data-action="new-post"]').click();
  await wait(150);
  win.document.getElementById('ed-title').value = '冒烟测试草稿';
  win.document.getElementById('ed-body').value = '# 测试\n\n这是一段用于冒烟测试的正文。';
  win.document.getElementById('ed-draft').click();
  await wait(250);
  {
    const ov = JSON.parse(win.localStorage.getItem(overlayKey) || '{}');
    const item = ov.items && ov.items['冒烟测试草稿'];
    out.push((item && item.local === true ? '✓ ' : '✗ ') + '未登录存草稿 → 仅本地（local 标记）');
    out.push((store.state.localOnly === 1 && !store.state.deploying ? '✓ ' : '✗ ') + '未登录存草稿 → 不计入"等待发布"（localOnly=' + store.state.localOnly + '）');
    out.push((html().indexOf('还没上传') >= 0 ? '✓ ' : '✗ ') + '创作台提示"有本地草稿未上传"');
  }

  // 8) 模拟作者登录 + mock API，点「保存到 GitHub」
  const remotePosts = JSON.parse(fs.readFileSync(path.join(dir, 'content', 'posts.json'), 'utf8'));
  let writeCalls = [];
  let pagesStatus = 'building';
  gh.setToken('fake-token-for-smoke', true);
  gh.setUser({ login: 'YOUR_GITHUB_USERNAME', name: 'smoke', avatar: '', html_url: '' });
  gh.readRepoFile = (p) => Promise.resolve({ data: remotePosts, text: '', sha: 'sha-remote' });
  // mock 的"仓库"：写进去就真的落库，checkDeployed 才能读到
  gh.writeRepoFile = (p, obj, sha, msg) => {
    writeCalls.push({ path: p, sha: sha, msg: msg });
    if (p === 'content/posts.json') { remotePosts.posts = obj.posts; remotePosts.updatedAt = obj.updatedAt; }
    return Promise.resolve('sha-new-' + writeCalls.length);
  };
  gh.pagesBuild = () => Promise.resolve({ status: pagesStatus });

  win.document.querySelector('[data-action="new-post"]').click();
  await wait(150);
  win.document.getElementById('ed-title').value = '冒烟测试正式文章';
  win.document.getElementById('ed-body').value = '# 冒烟测试\n\n## 小节一\n\n正文。\n\n## 小节二\n\n更多正文。';
  win.document.getElementById('ed-save').click();
  await wait(400);
  {
    const wrote = writeCalls.filter(c => c.path === 'content/posts.json');
    out.push((wrote.length === 1 ? '✓ ' : '✗ ') + '保存到 GitHub → 调用了 Contents API（' + wrote.length + ' 次）');
    out.push((store.state.deploying === true && store.state.localOnly === 0 ? '✓ ' : '✗ ') + '保存成功 → 进入"等待 Pages 发布"（deploying=' + store.state.deploying + '）');
    out.push((writeCalls.some(c => c.path === 'feed.json') ? '✓ ' : '✗ ') + '保存成功 → feed.json 自动同步');
  }

  // 9) Pages 还在构建 → 检查部署应返回 false，等待状态不能被清掉
  {
    pagesStatus = 'building';
    const done = await store.checkDeployed();
    const ov = win.localStorage.getItem(overlayKey);
    out.push((done === false ? '✓ ' : '✗ ') + 'Pages 构建中 → 检查部署返回"还没生效"');
    out.push((ov && ov.indexOf('sha-remote') < 0 && store.state.deploying ? '✓ ' : '✗ ') + 'Pages 构建中 → "等待发布"状态保留');
  }

  // 10) Pages 构建完成 → 检查部署返回 true，覆盖层清除
  {
    pagesStatus = 'built';
    const done = await store.checkDeployed();
    const ov = win.localStorage.getItem(overlayKey);
    out.push((done === true ? '✓ ' : '✗ ') + 'Pages 已发布 → 检查部署返回"已同步"');
    out.push((!ov || ov === 'null' ? '✓ ' : '✗ ') + '发布完成后覆盖层被清除（不含未上传的本地草稿）');
    out.push((store.state.deploying === false ? '✓ ' : '✗ ') + '发布完成后不再显示"等待发布"');
    // 本地草稿应该还在（它没被提交过……不对，第 8 步的 buildPayload 把它一起提交了，这里验证它已随提交翻成已发布）
    const posts = store.state.posts.map(p => p.title);
    out.push((posts.indexOf('冒烟测试草稿') >= 0 && posts.indexOf('冒烟测试正式文章') >= 0 ? '✓ ' : '✗ ') + '作者视野里两篇文章都在（刷新后也不会消失）');
  }

  // 11) 草稿对访客不可见
  {
    const visPosts = store.allPosts({ includeDrafts: false }).map(p => p.title);
    gh.logout();
    const guestPosts = store.allPosts({}).map(p => p.title);
    out.push((guestPosts.indexOf('冒烟测试草稿') < 0 ? '✓ ' : '✗ ') + '草稿对访客不可见');
  }

  out.push('');
  out.push(errors.length ? ('!! 运行时错误 ' + errors.length + ' 条:\n' + errors.slice(0, 15).join('\n')) : '✓ 无 JS 运行时错误');
  console.log(out.join('\n'));
  win.close();
}
