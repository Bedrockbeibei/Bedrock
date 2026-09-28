/* =========================================================
   store.js —— 数据层：文章 / 评论 / 留言 / 站点资料
   读取链路：GitHub CDN → 本地相对路径 → 内置示例数据
   作者保存：写入 localStorage 覆盖层（立即可见）+ commit 到仓库
   ========================================================= */
(function (global) {
  'use strict';

  var CFG = global.BEDROCK_CONFIG;
  var gh = global.Bedrock.gh;
  var K = {
    overlay:  'bedrock_posts_overlay_v1',
    comments: 'bedrock_comments_v1',
    guest:    'bedrock_guestbook_v1',
    site:     'bedrock_site_v1',
    nick:     'bedrock_nick_v1',
    profile:  'bedrock_profile_v1'
  };

  /* ---------------- 本地存储小工具 ---------------- */
  function lsGet(k, def) {
    try { var v = global.localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function lsSet(k, v) {
    try { global.localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function lsDel(k) { try { global.localStorage.removeItem(k); } catch (e) {} }

  /* ---------------- 内置示例文章（仓库数据拿不到时的兜底） ---------------- */
  var DEMO_POSTS = [
    {
      id: 'demo-1', slug: 'why-bedrock-on-github',
      title: '为什么我把博客建在 GitHub 上，而不是买服务器',
      excerpt: '零成本、零运维、文章就是数据文件。这篇讲清楚这套「静态站 + GitHub 当后端」的思路是怎么跑通的。',
      tags: ['折腾', 'GitHub Pages', '前端'],
      color: '#A3E635', status: 'published', pinned: true,
      createdAt: '2026-09-20T10:00:00+08:00', updatedAt: '2026-09-22T21:30:00+08:00',
      body: [
        '# 结论先说',
        '',
        '博客 = 一堆**纯静态文件** + 一个 **JSON 数据文件**。GitHub Pages 负责渲染，GitHub API 负责写入。中间没有任何服务器。',
        '',
        '## 这套方案解决什么',
        '',
        '- **不用重装环境**：手机上打开网页，登录后就能写文章',
        '- **不用改代码**：文章存在 `content/posts.json`，我只改数据，不改 HTML',
        '- **不花钱**：Pages 免费，CDN 免费，API 免费',
        '- **别人评论**：走 Giscus，评论落在仓库的 Discussions 里，永久保存',
        '',
        '## 写入是怎么发生的',
        '',
        '1. 我在网页上用 GitHub 身份登录（Token 或 OAuth）',
        '2. 写完点「保存到 GitHub」',
        '3. 前端调用 Contents API，把新的 posts.json 提交成一个 commit',
        '4. Pages 检测到仓库变化，1–2 分钟后自动重新部署',
        '',
        '```js',
        'PUT /repos/{owner}/{repo}/contents/content/posts.json',
        '{ message: "post: 文章标题", content: base64(json), sha: 上一个版本的sha }',
        '```',
        '',
        '> 关键点：`sha` 不能错。它代表你要覆盖的文件版本，错了会 409 冲突——这是 GitHub 防止多人同时改同一个文件的机制。',
        '',
        '## 代价是什么',
        '',
        '诚实地说：**部署有延迟**。写完不是立刻全网可见，要等 Pages 构建。所以本站做了「本地覆盖层」——保存后你自己的浏览器立刻能看到新文章，其他人等 1–2 分钟。',
        '',
        '下一篇打算写：怎么给这个站接上真实的访问统计。'
      ].join('\n')
    },
    {
      id: 'demo-2', slug: '51-mcu-first-led',
      title: '51 单片机第一课：点亮一个 LED 的完整清单',
      excerpt: '不谈寄存器原理，只给能跑的东西：接线、烧录、预期现象、失败排查。普中 HC6800-ES V2.0 + STC89C52 实测。',
      tags: ['嵌入式', '51 单片机', '硬件'],
      color: '#38BDF8', status: 'published', pinned: false,
      createdAt: '2026-09-15T14:00:00+08:00', updatedAt: '2026-09-18T09:10:00+08:00',
      body: [
        '# 先看结果',
        '',
        '目标：让板子上的 **LED 模块**以大约 0.5 秒的节奏闪烁。做完这一步，你就验证了「这套工具链是通的」。',
        '',
        '## 你需要的三样东西',
        '',
        '| 东西 | 说明 |',
        '| --- | --- |',
        '| Keil uVision | 写代码 + 生成 `.hex` |',
        '| STC-ISP | 把 `.hex` 烧进芯片 |',
        '| 开发板 + USB 线 | 普中 HC6800-ES V2.0 |',
        '',
        '## 接线',
        '',
        '- 用**排线**把 LED 模块（`JP`）接到单片机的 `P2` 口，注意 `VCC` 对 `VCC`、`GND` 对 `GND`',
        '- 如果手里只有杜邦线，就一根一根接：`P2.0 → D1`',
        '',
        '## 最小可跑的代码',
        '',
        '```c',
        '#include <REGX52.H>',
        '#include <INTRINS.H>',
        '',
        'void Delay500ms(void){',
        '    unsigned char i, j, k;',
        '    _nop_();',
        '    i = 4; j = 129; k = 119;',
        '    do { do { while (--k); } while (--j); } while (--i);',
        '}',
        '',
        'void main(void){',
        '    while (1) {',
        '        P2 = 0xFE;   // 1111 1110 → 只点亮 D1',
        '        Delay500ms();',
        '        P2 = 0xFF;   // 全灭',
        '        Delay500ms();',
        '    }',
        '}',
        '```',
        '',
        '## 烧录步骤（照做即可）',
        '',
        '1. Keil 里 `Options for Target → Output → 勾选 Create HEX File`，然后 Rebuild',
        '2. 打开 STC-ISP，芯片型号选 **STC89C52RC**',
        '3. 串口号选带 `USB-SERIAL CH340` 的那个',
        '4. 打开程序文件，选刚生成的 `.hex`',
        '5. **先点下载，再给板子上电**（这一步顺序不能反）',
        '',
        '## 预期现象',
        '',
        '最左边那颗 LED 开始以约 0.5 秒的节奏闪烁。',
        '',
        '## 不亮怎么办',
        '',
        '- 排线方向反了 → 换一头试试',
        '- 跳线帽没接 → LED 模块的使能跳线要短接',
        '- 串口识别不到 → 换 USB 口，或装 CH340 驱动',
        '- 一直提示「正在检测目标单片机」→ 断电后重新点下载再上电',
        '',
        '> 一句话总结：嵌入式入门最大的坑不是代码，是**接线和烧录顺序**。'
      ].join('\n')
    },
    {
      id: 'demo-3', slug: 'freshman-roadmap-ai',
      title: '大一选方向：AI / 数据科学要打的地基清单',
      excerpt: '信息科学技术类大一，想往 AI 走，到底先学什么？一份按优先级排序的地基清单，附带我自己的进度。',
      tags: ['成长', 'AI', '学习方法'],
      color: '#FDE047', status: 'published', pinned: false,
      createdAt: '2026-09-08T20:00:00+08:00', updatedAt: '2026-09-12T17:45:00+08:00',
      body: [
        '# 先把话说狠一点',
        '',
        '大部分人不是倒在「模型看不懂」，是倒在**数学基础 + 代码能力**这两块地基上。',
        '',
        '## 优先级排序',
        '',
        '### 1. Python（先到能写项目的程度）',
        '',
        '不要再看语法教程了。直接拿一个数据集做清洗、画图、跑统计。',
        '',
        '```python',
        'import pandas as pd',
        'df = pd.read_csv("grades.csv")',
        'print(df.describe())',
        'print(df.groupby("class")["score"].mean().sort_values())',
        '```',
        '',
        '### 2. 线性代数 + 概率统计',
        '',
        '- 矩阵乘法、特征值：理解「模型在做什么」的最小集',
        '- 概率分布、期望方差：理解「模型为什么这么评估」',
        '',
        '### 3. 机器学习基础',
        '',
        '从线性回归、逻辑回归开始，**手推一遍公式**，再用 sklearn 复现。',
        '',
        '### 4. 才是深度学习',
        '',
        '### 5. 工程能力',
        '',
        'Git、Linux 基础、能把自己的东西部署出去让人看到（比如这个博客）。',
        '',
        '## 我的当前进度',
        '',
        '- [x] 阿里巴巴达摩院「人工智能训练师（初级）」认证',
        '- [x] Python 基础 → Pandas 数据处理',
        '- [ ] 线性代数系统复习',
        '- [ ] 第一个完整的 ML 项目',
        '',
        '## 一条建议',
        '',
        '> 每学一样东西，就**产出一个能给别人看的东西**。',
        '',
        '这个博客就是我的「产出」。它逼着我把学的东西讲清楚——讲不清楚，就是没学懂。'
      ].join('\n')
    }
  ];

  /* ---------------- 状态 ---------------- */
  var state = {
    posts: [],
    site: null,       // 站点资料（可能来自 content/site.json）
    source: 'demo',   // 'github' | 'local' | 'demo'
    loaded: false,
    deploying: false  // 是否有改动正在等待 Pages 重建
  };

  /* ---------------- 文章加载 ---------------- */
  function loadAll(force) {
    if (state.loaded && !force) return Promise.resolve(state.posts);
    return gh.fetchJson(CFG.postsPath).then(function (data) {
      var list = normalize(data);
      if (!list.length) throw new Error('empty');
      state.posts = list;
      state.source = 'github';
      state.loaded = true;
      return applyOverlay();
    }).catch(function () {
      return fetch(CFG.postsPath + '?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('local miss'); return r.json(); })
        .then(function (data) {
          var list = normalize(data);
          if (!list.length) throw new Error('empty');
          state.posts = list;
          state.source = 'local';
          state.loaded = true;
          return applyOverlay();
        });
    }).catch(function () {
      state.posts = DEMO_POSTS.slice();
      state.source = 'demo';
      state.loaded = true;
      return applyOverlay();
    });
  }

  function normalize(data) {
    var raw = (data && Array.isArray(data.posts)) ? data.posts : (Array.isArray(data) ? data : []);
    return raw.filter(function (p) { return p && p.title; }).map(function (p, i) {
      p.id = p.id || p.slug || ('p-' + i);
      p.slug = p.slug || slugify(p.title);
      p.tags = Array.isArray(p.tags) ? p.tags : [];
      p.status = p.status || 'published';
      p.color = p.color || pickColor(p.slug);
      p.createdAt = p.createdAt || new Date().toISOString();
      p.updatedAt = p.updatedAt || p.createdAt;
      return p;
    });
  }

  function applyOverlay() {
    var ov = lsGet(K.overlay, null);
    if (ov && ov.items && Object.keys(ov.items).length) {
      var map = {};
      state.posts.forEach(function (p) { map[p.slug] = p; });
      Object.keys(ov.items).forEach(function (slug) {
        var item = ov.items[slug];
        if (item.deleted) { delete map[slug]; return; }
        map[slug] = item.post;
      });
      state.posts = Object.keys(map).map(function (k) { return map[k]; });
      state.deploying = true;
    } else {
      state.deploying = false;
    }
    sortPosts();
    return state.posts;
  }

  function sortPosts() {
    state.posts.sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function pickColor(seed) {
    var palette = ['#A3E635', '#C084FC', '#FDE047', '#38BDF8', '#FB7185'];
    var n = 0;
    for (var i = 0; i < String(seed).length; i++) n += seed.charCodeAt(i);
    return palette[n % palette.length];
  }

  function slugify(text) {
    var s = String(text || '').trim().toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\- ]/g, '')
      .replace(/\s+/g, '-');
    return s || ('post-' + Date.now().toString(36));
  }

  /* ---------------- 查询 ---------------- */
  function isAuthor() {
    var u = gh.getUser();
    return !!(u && !u.visitor && gh.isAuthor(u.login));
  }

  function allPosts(opts) {
    opts = opts || {};
    var list = state.posts.filter(function (p) {
      if (!opts.includeDrafts && p.status === 'draft' && !isAuthor()) return false;
      return true;
    });
    if (opts.tag) list = list.filter(function (p) { return (p.tags || []).indexOf(opts.tag) >= 0; });
    if (opts.q) {
      var q = opts.q.toLowerCase();
      list = list.filter(function (p) {
        return (p.title + ' ' + (p.excerpt || '') + ' ' + (p.body || '') + ' ' + (p.tags || []).join(' '))
          .toLowerCase().indexOf(q) >= 0;
      });
    }
    return list;
  }

  function getPost(slug) {
    for (var i = 0; i < state.posts.length; i++) if (state.posts[i].slug === slug) return state.posts[i];
    return null;
  }

  function allTags() {
    var m = {};
    state.posts.forEach(function (p) { (p.tags || []).forEach(function (t) { m[t] = (m[t] || 0) + 1; }); });
    return Object.keys(m).map(function (t) { return { tag: t, count: m[t] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  /* ---------------- 写入（作者） ---------------- */
  function makePost(o) {
    var now = new Date().toISOString();
    return {
      id: o.id || ('p-' + Date.now().toString(36)),
      slug: o.slug || slugify(o.title),
      title: o.title || '未命名',
      excerpt: o.excerpt || '',
      tags: o.tags || [],
      color: o.color || pickColor(o.title || ''),
      status: o.status || 'published',
      pinned: !!o.pinned,
      createdAt: o.createdAt || now,
      updatedAt: now,
      body: o.body || ''
    };
  }

  // 本地覆盖层：作者保存后立刻可见，不等 Pages 重建
  function putOverlay(post) {
    var ov = lsGet(K.overlay, { ts: Date.now(), items: {} });
    ov.ts = Date.now();
    ov.items[post.slug] = { post: post, ts: Date.now() };
    lsSet(K.overlay, ov);
    state.deploying = true;
  }
  function removeOverlay(slug, hardDelete) {
    var ov = lsGet(K.overlay, { ts: Date.now(), items: {} });
    ov.ts = Date.now();
    if (hardDelete) ov.items[slug] = { deleted: true, ts: Date.now() };
    else delete ov.items[slug];
    lsSet(K.overlay, ov);
  }
  function clearOverlay() {
    lsDel(K.overlay);
    state.deploying = false;
  }

  // 组装要提交的完整数据
  function buildPayload() {
    var map = {};
    state.posts.forEach(function (p) { map[p.slug] = p; });
    var ov = lsGet(K.overlay, { items: {} });
    Object.keys(ov.items || {}).forEach(function (slug) {
      var it = ov.items[slug];
      if (!it) return;
      if (it.deleted) delete map[slug];
      else map[slug] = it.post;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    sortList(list);
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      posts: list
    };
  }
  function sortList(list) {
    list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  // 保存到 GitHub：读远端最新 sha → 合并本地改动 → PUT
  function commitPosts(message) {
    var payload = buildPayload();
    return gh.readRepoFile(CFG.postsPath).then(function (remote) {
      // 远端可能有别人（或别的设备）新增的文章，做一次合并
      if (remote.data && Array.isArray(remote.data.posts)) {
        var map = {};
        remote.data.posts.forEach(function (p) { map[p.slug] = p; });
        payload.posts.forEach(function (p) { map[p.slug] = p; });
        payload.posts = Object.keys(map).map(function (k) { return map[k]; });
        sortList(payload.posts);
      }
      return gh.writeRepoFile(CFG.postsPath, payload, remote.sha, message || 'post: ' + new Date().toLocaleString('zh-CN'));
    }).then(function (sha) {
      lsSet('bedrock_last_commit_v1', { sha: sha, ts: Date.now() });
      return sha;
    });
  }

  // 检查 Pages 是否已经重建完成：远端数据是否已包含本地改动
  function checkDeployed() {
    return gh.fetchJson(CFG.postsPath).then(function (data) {
      var list = normalize(data);
      var ov = lsGet(K.overlay, { items: {} });
      var keys = Object.keys(ov.items || {});
      if (!keys.length) { clearOverlay(); return true; }
      var done = keys.every(function (slug) {
        var it = ov.items[slug];
        if (it.deleted) return !list.some(function (p) { return p.slug === slug; });
        var rp = list.filter(function (p) { return p.slug === slug; })[0];
        return rp && rp.updatedAt === it.post.updatedAt;
      });
      if (done) { clearOverlay(); state.deploying = false; }
      return done;
    }).catch(function () { return false; });
  }

  /* ---------------- 评论（本地兜底） ---------------- */
  function getComments(slug) { var m = lsGet(K.comments, {}); return m[slug] || []; }
  function addComment(slug, name, content) {
    var m = lsGet(K.comments, {});
    m[slug] = m[slug] || [];
    var item = { id: 'c' + Date.now().toString(36), name: name || '匿名访客', content: content, ts: Date.now(), avatar: '' };
    m[slug].push(item);
    lsSet(K.comments, m);
    return item;
  }
  function delComment(slug, id) {
    var m = lsGet(K.comments, {});
    if (m[slug]) { m[slug] = m[slug].filter(function (c) { return c.id !== id; }); lsSet(K.comments, m); }
  }

  /* ---------------- 留言板 ---------------- */
  function getGuestbook() { return lsGet(K.guest, []); }
  function addGuestbook(name, content, contact) {
    var list = getGuestbook();
    var item = { id: 'g' + Date.now().toString(36), name: name || '匿名访客', content: content, contact: contact || '', ts: Date.now() };
    list.unshift(item);
    lsSet(K.guest, list);
    return item;
  }
  function delGuestbook(id) {
    lsSet(K.guest, getGuestbook().filter(function (g) { return g.id !== id; }));
  }

  /* ---------------- 站点资料 ---------------- */
  function loadSite() {
    return gh.fetchJson(CFG.sitePath).then(function (d) {
      if (d && typeof d === 'object') { state.site = d; return mergeSite(); }
      throw new Error('no site.json');
    }).catch(function () { state.site = null; return mergeSite(); });
  }
  function mergeSite() {
    var base = JSON.parse(JSON.stringify(CFG.site));
    if (state.site) {
      Object.keys(state.site).forEach(function (k) { if (state.site[k] != null) base[k] = state.site[k]; });
    }
    var override = lsGet(K.site, null);
    if (override) Object.keys(override).forEach(function (k) { if (override[k] != null) base[k] = override[k]; });
    return base;
  }
  function saveSiteLocal(obj) { lsSet(K.site, obj); state.site = obj; return mergeSite(); }
  function commitSite(obj) {
    var payload = Object.assign({ version: 1, updatedAt: new Date().toISOString() }, obj);
    return gh.readRepoFile(CFG.sitePath).then(function (r) {
      return gh.writeRepoFile(CFG.sitePath, payload, r.sha, 'chore(site): update site.json');
    }).catch(function () {
      return gh.writeRepoFile(CFG.sitePath, payload, null, 'chore(site): create site.json');
    });
  }

  /* ---------------- 昵称（访客身份） ---------------- */
  function getNick() { try { return global.localStorage.getItem(K.nick) || ''; } catch (e) { return ''; } }
  function setNick(n) { try { global.localStorage.setItem(K.nick, n); } catch (e) {} }

  global.Bedrock = global.Bedrock || {};
  global.Bedrock.store = {
    K: K, DEMO_POSTS: DEMO_POSTS,
    loadAll: loadAll, allPosts: allPosts, getPost: getPost, allTags: allTags,
    makePost: makePost, putOverlay: putOverlay, removeOverlay: removeOverlay,
    clearOverlay: clearOverlay, commitPosts: commitPosts, checkDeployed: checkDeployed,
    buildPayload: buildPayload, slugify: slugify, pickColor: pickColor, sortList: sortList,
    getComments: getComments, addComment: addComment, delComment: delComment,
    getGuestbook: getGuestbook, addGuestbook: addGuestbook, delGuestbook: delGuestbook,
    loadSite: loadSite, mergeSite: mergeSite, saveSiteLocal: saveSiteLocal, commitSite: commitSite,
    getNick: getNick, setNick: setNick,
    isAuthor: isAuthor,
    state: state,
    lsGet: lsGet, lsSet: lsSet, lsDel: lsDel
  };
})(window);
