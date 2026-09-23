/* =========================================================
   ui.js —— 组件工厂 + 各板块视图渲染
   全部输出 HTML 字符串，由 app.js 挂载；交互通过 data-action 事件委托
   ========================================================= */
(function (global) {
  'use strict';

  var CFG = global.BEDROCK_CONFIG;
  var store = global.Bedrock.store;
  var gh = global.Bedrock.gh;

  /* ================= 基础工具 ================= */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso, style) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    if (style === 'short') return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function ago(ts) {
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 2592000) return Math.floor(s / 86400) + ' 天前';
    return fmtTime(ts).slice(0, 10);
  }
  function readMinutes(body) {
    var n = String(body || '').replace(/```[\s\S]*?```/g, '').length;
    return Math.max(1, Math.round(n / 350));
  }
  function rnd(min, max) { return Math.random() * (max - min) + min; }

  function md(text) {
    var raw = String(text || '');
    var html = '';
    try {
      if (global.marked) {
        global.marked.setOptions({ gfm: true, breaks: false });
        html = global.marked.parse(raw);
      } else { html = esc(raw).replace(/\n/g, '<br>'); }
    } catch (e) { html = esc(raw); }
    if (global.DOMPurify) html = global.DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
    // 外链新窗口打开
    return html.replace(/<a /g, '<a target="_blank" rel="noopener" ');
  }
  function highlight(root) {
    if (!global.hljs) return;
    var nodes = (root || document).querySelectorAll('pre code');
    Array.prototype.forEach.call(nodes, function (el) {
      try { global.hljs.highlightElement(el); } catch (e) {}
    });
  }

  /* ================= 组件 ================= */
  function sticker(text, color, rotate) {
    var r = (rotate == null) ? rnd(-2, 2.5).toFixed(2) : rotate;
    return '<span class="sticker" style="--r:' + r + 'deg;background:' + (color || '#fff') + '">' + esc(text) + '</span>';
  }
  function badgeRow(tags) {
    if (!tags || !tags.length) return '';
    var palette = ['#A3E635', '#C084FC', '#FDE047', '#38BDF8', '#FB7185', '#FFFFFF'];
    return tags.map(function (t, i) { return sticker(t, palette[i % palette.length]); }).join(' ');
  }
  function toast(msg, type) {
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    var colors = { ok: '#A3E635', err: '#FB7185', info: '#38BDF8', warn: '#FDE047' };
    var icons = { ok: 'ri-checkbox-circle-fill', err: 'ri-error-warning-fill', info: 'ri-information-fill', warn: 'ri-alert-fill' };
    var el = document.createElement('div');
    el.className = 'nb-toast';
    el.style.background = colors[type] || '#fff';
    el.innerHTML = '<i class="' + (icons[type] || 'ri-information-fill') + '"></i><span>' + esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(function () { el.remove(); }, 260);
    }, type === 'err' ? 4200 : 2600);
  }

  function sectionTitle(text, color) {
    return '<div class="flex items-center gap-3 mb-5">' +
      '<h2 class="font-display text-2xl sm:text-3xl bg-' + (color || 'mint') + ' border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_0_#000]">' + esc(text) + '</h2>' +
      '<div class="flex-1 h-[3px] bg-black"></div></div>';
  }

  /* ================= 文章卡片 ================= */
  function postCard(p, big) {
    var mins = readMinutes(p.body);
    var isDraft = p.status === 'draft';
    return '' +
      '<article class="nb-card post-card p-0 overflow-hidden ' + (big ? 'sm:col-span-2' : '') + '" data-action="open-post" data-slug="' + esc(p.slug) + '">' +
        '<div class="h-2 border-b-[3px] border-black" style="background:' + esc(p.color || '#A3E635') + '"></div>' +
        '<div class="p-4 sm:p-5">' +
          '<div class="flex flex-wrap items-center gap-1 mb-3">' +
            (p.pinned ? sticker('置顶', '#FDE047') : '') +
            (isDraft ? sticker('草稿', '#FB7185') : '') +
            badgeRow(p.tags) +
          '</div>' +
          '<h3 class="post-title font-display ' + (big ? 'text-2xl sm:text-3xl' : 'text-xl') + ' mb-2 leading-tight">' + esc(p.title) + '</h3>' +
          '<p class="text-sm font-medium leading-relaxed mb-4 line-clamp-3">' + esc(p.excerpt || stripMd(p.body).slice(0, 90)) + '</p>' +
          '<div class="flex items-center justify-between text-xs font-bold border-t-2 border-black pt-3">' +
            '<span><i class="ri-calendar-line"></i> ' + fmtDate(p.createdAt) + '</span>' +
            '<span><i class="ri-timer-line"></i> ' + mins + ' 分钟</span>' +
            '<span class="underline">阅读全文 <i class="ri-arrow-right-line"></i></span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }
  function stripMd(s) {
    return String(s || '').replace(/```[\s\S]*?```/g, '').replace(/[#>*`\-_\[\]()!]/g, '').replace(/\s+/g, ' ').trim();
  }

  /* ================= 视图：首页 ================= */
  function viewHome(site) {
    var posts = store.allPosts({});
    var pub = posts.filter(function (p) { return p.status !== 'draft'; });
    var latest = pub.slice(0, 3);
    var tags = store.allTags().slice(0, 12);
    var projects = (site.projects || []).slice(0, 3);

    var html = '' +
    /* ---------- Hero ---------- */
    '<section class="nb-card !bg-white mb-10 overflow-hidden">' +
      '<div class="grid md:grid-cols-[1fr_auto] gap-0">' +
        '<div class="p-5 sm:p-8">' +
          '<div class="flex flex-wrap gap-1 mb-4">' + (site.badges || []).map(function (b, i) {
            var c = ['#A3E635', '#C084FC', '#FDE047', '#38BDF8', '#FB7185', '#FFFFFF'][i % 6];
            return sticker(b, c);
          }).join('') + '</div>' +
          '<h1 class="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-3">' +
            '<span class="bg-sun border-[3px] border-black px-2 inline-block -rotate-1">沉潜</span>' +
            '<span class="mx-2">·</span>' +
            '<span class="bg-mint border-[3px] border-black px-2 inline-block rotate-1">BEDROCK</span>' +
          '</h1>' +
          '<p class="text-base sm:text-lg font-semibold leading-relaxed mb-5 whitespace-pre-line">' + esc(site.bio || '') + '</p>' +
          '<div class="flex flex-wrap gap-2">' +
            '<a href="#/posts" class="nb-btn !bg-mint"><i class="ri-article-line"></i> 开始阅读</a>' +
            '<a href="#/about" class="nb-btn !bg-violet"><i class="ri-user-line"></i> 关于我</a>' +
            '<a href="#/guestbook" class="nb-btn !bg-sky"><i class="ri-message-3-line"></i> 留言板</a>' +
          '</div>' +
        '</div>' +
        '<div class="border-t-[3px] md:border-t-0 md:border-l-[3px] border-black p-5 sm:p-8 bg-mint flex flex-col items-center justify-center gap-4">' +
          '<div class="w-28 h-28 sm:w-36 sm:h-36 border-[3px] border-black bg-white shadow-[6px_6px_0_0_#000] -rotate-2 overflow-hidden">' +
            '<img src="' + esc(site.avatar) + '" alt="avatar" class="w-full h-full object-cover" onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div class="font-display text-lg">' + esc(site.author || '') + '</div>' +
          '<div class="grid grid-cols-3 gap-2 w-full text-center">' +
            stat(pub.length, '文章') + stat(tags.length, '标签') + stat(projects.length, '项目') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* ---------- 最新文章 ---------- */
    sectionTitle('最新文章', 'mint') +
    '<div class="grid sm:grid-cols-2 gap-5 mb-10">' +
      (latest.length ? latest.map(function (p, i) { return postCard(p, i === 0); }).join('') : emptyBox('还没有文章，登录后去创作台写第一篇 →')) +
    '</div>' +
    '<div class="mb-10"><a href="#/posts" class="nb-btn !bg-sun">查看全部文章 <i class="ri-arrow-right-line"></i></a></div>' +

    /* ---------- 标签云 ---------- */
    (tags.length ? sectionTitle('标签云', 'violet') +
      '<div class="nb-card p-5 mb-10 flex flex-wrap gap-2">' +
        tags.map(function (t) {
          return '<a href="#/posts?tag=' + encodeURIComponent(t.tag) + '" class="sticker !text-sm" style="--r:' + rnd(-2, 2.5).toFixed(2) + 'deg;background:' + store.pickColor(t.tag) + '">' + esc(t.tag) + ' <b>' + t.count + '</b></a>';
        }).join('') +
      '</div>' : '') +

    /* ---------- 项目 ---------- */
    (projects.length ? sectionTitle('在做的事', 'sky') +
      '<div class="grid sm:grid-cols-3 gap-5 mb-10">' +
        projects.map(function (p) {
          return '<article class="nb-card p-5" style="background:' + esc(p.color || '#fff') + '">' +
            '<div class="flex items-start justify-between mb-2">' +
              '<h3 class="font-display text-lg leading-tight">' + esc(p.name) + '</h3>' +
              '<span class="sticker" style="--r:2deg">' + esc(p.year || '') + '</span>' +
            '</div>' +
            '<p class="text-sm font-semibold leading-relaxed mb-3">' + esc(p.desc) + '</p>' +
            '<div class="flex flex-wrap gap-1 mb-3">' + badgeRow(p.tags) + '</div>' +
            (p.url && p.url !== '#' ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener" class="nb-btn !text-sm !bg-white"><i class="ri-external-link-line"></i> 去看看</a>' : '') +
          '</article>';
        }).join('') +
      '</div>' : '');

    return html;
  }
  function stat(n, label) {
    return '<div class="border-2 border-black bg-white py-2"><div class="font-display text-xl">' + n + '</div><div class="text-[11px] font-bold">' + label + '</div></div>';
  }
  function emptyBox(text) {
    return '<div class="nb-card p-8 text-center font-bold sm:col-span-2">' + esc(text) + '</div>';
  }

  /* ================= 视图：文章列表 ================= */
  function viewPosts(params) {
    var q = params.q || '';
    var tag = params.tag || '';
    var page = Math.max(1, parseInt(params.page || '1', 10) || 1);
    var sort = params.sort || 'new';

    var list = store.allPosts({ q: q, tag: tag });
    if (sort === 'old') list = list.slice().sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    if (sort === 'title') list = list.slice().sort(function (a, b) { return a.title.localeCompare(b.title, 'zh'); });
    else if (sort === 'new') list = list.slice().sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var total = list.length;
    var size = CFG.pageSize || 8;
    var pages = Math.max(1, Math.ceil(total / size));
    if (page > pages) page = pages;
    var slice = list.slice((page - 1) * size, page * size);
    var tags = store.allTags();

    var html = '' +
    '<div class="flex flex-wrap items-end justify-between gap-4 mb-6">' +
      '<div><h1 class="font-display text-4xl sm:text-5xl"><span class="bg-mint border-[3px] border-black px-2 inline-block -rotate-1">全部文章</span></h1>' +
      '<p class="font-bold mt-2 text-sm">共 ' + total + ' 篇' + (tag ? ' · 标签：' + esc(tag) : '') + (q ? ' · 搜索：' + esc(q) : '') + '</p></div>' +
      '<div class="flex gap-1">' +
        ['new', 'old', 'title'].map(function (s) {
          var label = { new: '最新', old: '最早', title: '标题' }[s];
          return '<a href="#/posts?sort=' + s + (tag ? '&tag=' + encodeURIComponent(tag) : '') + (q ? '&q=' + encodeURIComponent(q) : '') +
            '" class="nb-btn !text-sm ' + (sort === s ? '!bg-mint' : '') + '">' + label + '</a>';
        }).join('') +
      '</div>' +
    '</div>' +

    /* 搜索框 */
    '<div class="nb-card !bg-white p-3 mb-5 flex flex-wrap gap-2 items-center">' +
      '<i class="ri-search-line text-xl ml-1"></i>' +
      '<input id="search-input" class="nb-input !flex-1 !min-w-[180px] !shadow-none !border-2" placeholder="搜索标题、正文、标签…" value="' + esc(q) + '">' +
      '<button class="nb-btn !text-sm !bg-sun" data-action="do-search"><i class="ri-search-line"></i> 搜索</button>' +
      (q || tag ? '<a href="#/posts" class="nb-btn !text-sm !bg-white">清除筛选</a>' : '') +
    '</div>' +

    /* 标签筛选 */
    (tags.length ? '<div class="flex flex-wrap gap-1 mb-6">' +
      '<a href="#/posts' + (q ? '?q=' + encodeURIComponent(q) : '') + '" class="sticker !text-sm" style="--r:-1.5deg;background:' + (tag ? '#fff' : '#A3E635') + '">全部</a>' +
      tags.map(function (t) {
        return '<a href="#/posts?tag=' + encodeURIComponent(t.tag) + (q ? '&q=' + encodeURIComponent(q) : '') +
          '" class="sticker !text-sm" style="--r:' + rnd(-2, 2.5).toFixed(2) + 'deg;background:' + (t.tag === tag ? '#FDE047' : '#fff') + '">' + esc(t.tag) + ' ' + t.count + '</a>';
      }).join('') + '</div>' : '') +

    '<div class="grid sm:grid-cols-2 gap-5">' +
      (slice.length ? slice.map(function (p) { return postCard(p, false); }).join('') : emptyBox('没有匹配的文章，换个词试试。')) +
    '</div>' +

    (pages > 1 ? '<div class="flex flex-wrap justify-center items-center gap-2 mt-8">' +
      (page > 1 ? '<a class="nb-btn !text-sm" href="#/posts?page=' + (page - 1) + qs({ tag: tag, q: q, sort: sort }) + '"><i class="ri-arrow-left-line"></i> 上一页</a>' : '') +
      '<span class="font-display px-3 py-1 border-[3px] border-black bg-white">' + page + ' / ' + pages + '</span>' +
      (page < pages ? '<a class="nb-btn !text-sm" href="#/posts?page=' + (page + 1) + qs({ tag: tag, q: q, sort: sort }) + '">下一页 <i class="ri-arrow-right-line"></i></a>' : '') +
    '</div>' : '');

    return html;
  }
  function qs(o) {
    var s = '';
    Object.keys(o).forEach(function (k) { if (o[k]) s += '&' + k + '=' + encodeURIComponent(o[k]); });
    return s;
  }

  /* ================= 视图：文章详情 ================= */
  function viewPost(slug) {
    var p = store.getPost(slug);
    if (!p) return notFound();
    var list = store.allPosts({});
    var idx = list.indexOf(p);
    var prev = list[idx - 1] || null;
    var next = list[idx + 1] || null;

    var html = '' +
    '<div class="mb-5 flex flex-wrap gap-2 items-center">' +
      '<a href="#/posts" class="nb-btn !text-sm !bg-white"><i class="ri-arrow-left-line"></i> 返回列表</a>' +
      (store.isAuthor() ? '<button class="nb-btn !text-sm !bg-violet" data-action="edit-post" data-slug="' + esc(p.slug) + '"><i class="ri-edit-2-line"></i> 编辑</button>' +
        '<button class="nb-btn !text-sm !bg-white" data-action="delete-post" data-slug="' + esc(p.slug) + '"><i class="ri-delete-bin-line"></i> 删除</button>' : '') +
    '</div>' +

    '<article class="nb-card !bg-white mb-6 overflow-hidden">' +
      '<div class="h-3 border-b-[3px] border-black" style="background:' + esc(p.color) + '"></div>' +
      '<div class="p-5 sm:p-8">' +
        '<div class="flex flex-wrap gap-1 mb-4">' + (p.pinned ? sticker('置顶', '#FDE047') : '') + (p.status === 'draft' ? sticker('草稿 · 仅自己可见', '#FB7185') : '') + badgeRow(p.tags) + '</div>' +
        '<h1 class="font-display text-3xl sm:text-4xl lg:text-5xl leading-tight mb-4">' + esc(p.title) + '</h1>' +
        '<div class="flex flex-wrap items-center gap-3 text-sm font-bold border-y-2 border-black py-3 mb-6">' +
          '<span><i class="ri-calendar-line"></i> ' + fmtDate(p.createdAt) + '</span>' +
          '<span><i class="ri-timer-line"></i> 约 ' + readMinutes(p.body) + ' 分钟</span>' +
          (p.updatedAt && p.updatedAt !== p.createdAt ? '<span><i class="ri-refresh-line"></i> 更新于 ' + fmtDate(p.updatedAt) + '</span>' : '') +
          '<span class="ml-auto bg-sun border-2 border-black px-2 py-0.5 rotate-[-1deg]">' + esc(p.slug) + '</span>' +
        '</div>' +
        '<div class="prose-nb" id="post-body">' + md(p.body) + '</div>' +
      '</div>' +
    '</article>' +

    /* 上下篇 */
    '<div class="grid sm:grid-cols-2 gap-4 mb-8">' +
      (prev ? navCard(prev, '上一篇', true) : '<div></div>') +
      (next ? navCard(next, '下一篇', false) : '<div></div>') +
    '</div>' +

    /* 评论 */
    '<div class="nb-card !bg-white p-5 sm:p-6 mb-6">' +
      '<h2 class="font-display text-2xl mb-4 inline-block bg-sky border-[3px] border-black px-2 py-1 rotate-[-1deg]">评论区</h2>' +
      commentsBlock(p.slug) +
    '</div>';

    return html;
  }
  function navCard(p, label, isPrev) {
    return '<a class="nb-card p-4 flex flex-col gap-1" href="#/post/' + esc(p.slug) + '">' +
      '<span class="text-xs font-black opacity-60"><i class="ri-arrow-' + (isPrev ? 'left' : 'right') + '-line"></i> ' + label + '</span>' +
      '<span class="font-display text-lg leading-tight">' + esc(p.title) + '</span></a>';
  }

  function commentsBlock(slug) {
    var g = CFG.giscus || {};
    var giscusOn = !!(g.enabled && g.repoId && g.categoryId);

    // 公开评论已启用：只显示 Giscus，不再显示本地评论框
    if (giscusOn) return '<div class="giscus"></div>';

    var out = '<div class="text-xs font-bold opacity-50 mb-4">评论保存在本地浏览器</div>';

    if (CFG.localComment !== false) {
      var list = store.getComments(slug);
      out += '<div class="border-[3px] border-black bg-paper p-3 mb-4">' +
        '<div class="flex flex-wrap gap-2 items-center">' +
          '<input id="cmt-name" class="nb-input !flex-1 !min-w-[140px] !py-1 !text-sm" placeholder="你的昵称" value="' + esc(store.getNick() || (gh.getUser() ? gh.getUser().login : '')) + '">' +
        '</div>' +
        '<textarea id="cmt-content" class="nb-input mt-2 h-20 !text-sm" placeholder="说点什么…（支持纯文本，作者审核不通过可删除）"></textarea>' +
        '<button class="nb-btn !text-sm !bg-mint mt-2" data-action="submit-comment" data-slug="' + esc(slug) + '"><i class="ri-send-plane-line"></i> 发表评论</button>' +
      '</div>';

      out += '<div class="space-y-3">' + (list.length ? list.slice().reverse().map(function (c) {
        return '<div class="border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]">' +
          '<div class="flex items-center gap-2 text-xs font-black mb-1">' +
            '<span class="w-7 h-7 grid place-items-center border-2 border-black bg-' + ['mint', 'violet', 'sky', 'sun'][(c.name || 'a').length % 4] + '">' + esc((c.name || '?')[0]) + '</span>' +
            '<span>' + esc(c.name) + '</span><span class="opacity-60 font-bold">' + ago(c.ts) + '</span>' +
            (store.isAuthor() ? '<button class="ml-auto text-xs underline" data-action="del-comment" data-slug="' + esc(slug) + '" data-id="' + esc(c.id) + '">删除</button>' : '') +
          '</div>' +
          '<div class="text-sm font-medium whitespace-pre-wrap">' + esc(c.content) + '</div>' +
        '</div>';
      }).join('') : '<div class="text-sm font-bold opacity-60">还没有评论，占个沙发？</div>') + '</div>';
    }
    return out;
  }

  /* ================= 视图：项目 ================= */
  function viewProjects(site) {
    var list = site.projects || [];
    return '<h1 class="font-display text-4xl sm:text-5xl mb-2"><span class="bg-sky border-[3px] border-black px-2 inline-block rotate-1">项目</span></h1>' +
      '<p class="font-bold mb-6 text-sm">做过、在做、想做的东西。</p>' +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">' +
      (list.length ? list.map(function (p) {
        return '<article class="nb-card p-5 flex flex-col">' +
          '<div class="h-2 -mx-5 -mt-5 mb-4 border-b-[3px] border-black" style="background:' + esc(p.color || '#A3E635') + '"></div>' +
          '<div class="flex items-start justify-between gap-2 mb-2"><h3 class="font-display text-xl leading-tight">' + esc(p.name) + '</h3>' +
          (p.year ? '<span class="sticker" style="--r:2deg">' + esc(p.year) + '</span>' : '') + '</div>' +
          '<p class="text-sm font-semibold leading-relaxed mb-3 flex-1">' + esc(p.desc) + '</p>' +
          '<div class="flex flex-wrap gap-1 mb-4">' + badgeRow(p.tags) + '</div>' +
          (p.url && p.url !== '#' ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener" class="nb-btn !text-sm !bg-mint"><i class="ri-external-link-line"></i> 去看看</a>' : '') +
        '</article>';
      }).join('') : emptyBox('还没有项目。')) + '</div>';
  }

  /* ================= 视图：归档 ================= */
  function viewArchive() {
    var list = store.allPosts({});
    var groups = {};
    list.forEach(function (p) {
      var d = new Date(p.createdAt);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      (groups[key] = groups[key] || []).push(p);
    });
    var keys = Object.keys(groups).sort().reverse();
    var total = list.length;

    return '<h1 class="font-display text-4xl sm:text-5xl mb-2"><span class="bg-violet border-[3px] border-black px-2 inline-block -rotate-1">归档</span></h1>' +
      '<p class="font-bold mb-8 text-sm">共 ' + total + ' 篇，按时间倒序。</p>' +
      (keys.length ? keys.map(function (k) {
        return '<div class="mb-8">' +
          '<div class="inline-flex items-center gap-2 mb-4"><span class="font-display text-2xl bg-sun border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_0_#000] rotate-[-1deg]">' + esc(k) + '</span>' +
          '<span class="font-bold text-sm">' + groups[k].length + ' 篇</span></div>' +
          '<div class="border-l-[5px] border-black pl-4 sm:pl-6 space-y-4">' +
          groups[k].map(function (p) {
            return '<a href="#/post/' + esc(p.slug) + '" class="block group">' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<span class="font-black text-xs bg-white border-2 border-black px-1">' + fmtDate(p.createdAt, 'short') + '</span>' +
                '<span class="font-display text-lg group-hover:bg-sun transition-colors">' + esc(p.title) + '</span>' +
                (p.status === 'draft' ? sticker('草稿', '#FB7185') : '') +
              '</div>' +
              '<div class="flex flex-wrap gap-1 mt-1">' + badgeRow(p.tags) + '</div>' +
            '</a>';
          }).join('') +
          '</div></div>';
      }).join('') : emptyBox('还没有内容。'));
  }

  /* ================= 视图：关于 ================= */
  function viewAbout(site) {
    var posts = store.allPosts({});
    var socials = site.socials || [];
    var skills = site.badges || [];
    return '<div class="grid lg:grid-cols-[1fr_320px] gap-6">' +
      '<div>' +
        '<h1 class="font-display text-4xl sm:text-5xl mb-4"><span class="bg-mint border-[3px] border-black px-2 inline-block rotate-1">关于我</span></h1>' +
        '<div class="nb-card !bg-white p-5 sm:p-6 mb-6">' +
          '<div class="prose-nb">' + md(site.bio || '') + '</div>' +
        '</div>' +
        '<div class="nb-card !bg-white p-5 sm:p-6">' +
          '<h2 class="font-display text-xl mb-3">时间线</h2>' +
          '<div class="border-l-[5px] border-black pl-4 space-y-4">' +
            timelineItem('2026', '入学 · 北京理工大学', '睿信书院，信息科学技术类。开始系统性地打地基。') +
            timelineItem('2026', '拿到第一个 AI 认证', '阿里巴巴达摩院「人工智能训练师（初级）」。') +
            timelineItem('2026', '建成这个博客', '纯静态 + GitHub 作后端，第一次把自己的东西放到公网上。') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<aside class="space-y-5">' +
        '<div class="nb-card !bg-white p-5 text-center">' +
          '<div class="w-24 h-24 mx-auto border-[3px] border-black bg-mint shadow-[5px_5px_0_0_#000] -rotate-2 overflow-hidden mb-3">' +
            '<img src="' + esc(site.avatar) + '" alt="avatar" class="w-full h-full object-cover" onerror="this.style.display=\'none\'"></div>' +
          '<div class="font-display text-xl">' + esc(site.author) + '</div>' +
          '<div class="text-sm font-bold opacity-70 mb-3">' + esc(site.location || '') + '</div>' +
          '<div class="flex flex-wrap justify-center gap-1 mb-4">' + skills.map(function (s, i) {
            return sticker(s, ['#A3E635', '#C084FC', '#FDE047', '#38BDF8', '#FB7185', '#fff'][i % 6]);
          }).join('') + '</div>' +
          '<div class="flex flex-wrap justify-center gap-2">' +
            socials.map(function (s) {
              return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" class="nb-btn !text-xs !bg-white"><i class="' + esc(s.icon) + '"></i> ' + esc(s.name) + '</a>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="nb-card !bg-sun p-5">' +
          '<div class="font-display text-lg mb-2">站点数据</div>' +
          '<ul class="text-sm font-bold space-y-1">' +
            '<li>文章：' + posts.length + ' 篇</li>' +
            '<li>标签：' + store.allTags().length + ' 个</li>' +
          '</ul>' +
        '</div>' +
      '</aside>' +
    '</div>';
  }
  function timelineItem(year, title, desc) {
    return '<div><div class="flex items-center gap-2"><span class="font-black text-xs bg-white border-2 border-black px-1">' + esc(year) + '</span>' +
      '<span class="font-display text-lg">' + esc(title) + '</span></div>' +
      '<p class="text-sm font-medium mt-1">' + esc(desc) + '</p></div>';
  }

  /* ================= 视图：留言板 ================= */
  function viewGuestbook() {
    var list = store.getGuestbook();
    return '<h1 class="font-display text-4xl sm:text-5xl mb-2"><span class="bg-coral border-[3px] border-black px-2 inline-block -rotate-1">留言板</span></h1>' +
      '<p class="font-bold mb-6 text-sm">随便说点什么。不登录也能留，只需要一个昵称。</p>' +
      '<div class="grid lg:grid-cols-[380px_1fr] gap-6">' +
        '<div class="nb-card !bg-white p-5 h-fit">' +
          '<div class="font-display text-lg mb-3">写一条</div>' +
          '<input id="gb-name" class="nb-input mb-2 !text-sm" placeholder="昵称" value="' + esc(store.getNick() || (gh.getUser() ? gh.getUser().login : '')) + '">' +
          '<input id="gb-contact" class="nb-input mb-2 !text-sm" placeholder="联系方式（可选，如邮箱/主页）">' +
          '<textarea id="gb-content" class="nb-input h-28 !text-sm mb-3" placeholder="留言内容…"></textarea>' +
          '<button class="nb-btn !bg-mint w-full !justify-center" data-action="submit-guest"><i class="ri-send-plane-fill"></i> 贴上去</button>' +
        '</div>' +
        '<div class="space-y-4">' +
          (list.length ? list.map(function (g) {
            return '<div class="nb-card p-4" style="background:' + store.pickColor(g.name) + '">' +
              '<div class="flex items-center gap-2 text-sm font-black mb-2">' +
                '<span class="w-8 h-8 grid place-items-center border-2 border-black bg-white">' + esc((g.name || '?')[0]) + '</span>' +
                '<span>' + esc(g.name) + '</span>' +
                (g.contact ? '<span class="text-xs font-bold underline">' + esc(g.contact) + '</span>' : '') +
                '<span class="ml-auto text-xs font-bold opacity-70">' + ago(g.ts) + '</span>' +
                (store.isAuthor() ? '<button class="text-xs underline" data-action="del-guest" data-id="' + esc(g.id) + '">删除</button>' : '') +
              '</div>' +
              '<div class="text-sm font-semibold whitespace-pre-wrap bg-white border-2 border-black p-2">' + esc(g.content) + '</div>' +
            '</div>';
          }).join('') : '<div class="nb-card p-8 text-center font-bold">还没有留言，来当第一个。</div>') +
        '</div>' +
      '</div>';
  }

  /* ================= 视图：友链 ================= */
  function viewLinks(site) {
    var list = site.links || [];
    return '<h1 class="font-display text-4xl sm:text-5xl mb-2"><span class="bg-violet border-[3px] border-black px-2 inline-block rotate-1">友链</span></h1>' +
      '<p class="font-bold mb-6 text-sm">有趣的人和地方。</p>' +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">' +
      (list.length ? list.map(function (l, i) {
        var c = ['#A3E635', '#C084FC', '#FDE047', '#38BDF8', '#FB7185'][i % 5];
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" class="nb-card p-5 block" style="background:' + c + '">' +
          '<div class="font-display text-xl mb-1">' + esc(l.name) + '</div>' +
          '<div class="text-sm font-semibold">' + esc(l.desc || '') + '</div>' +
          '<div class="mt-3 text-xs font-black underline">访问 <i class="ri-external-link-line"></i></div>' +
        '</a>';
      }).join('') : emptyBox('还没有友链。')) +
      '<a href="#/guestbook" class="nb-card p-5 flex flex-col justify-center items-center text-center !bg-white">' +
        '<div class="font-display text-xl mb-1">+ 申请互换</div>' +
        '<div class="text-sm font-semibold">去留言板留个言，我看到就会加。</div>' +
      '</a>' +
      '</div>';
  }

  function notFound() {
    return '<div class="nb-card p-10 text-center">' +
      '<div class="font-display text-6xl mb-4">404</div>' +
      '<p class="font-bold mb-5">这个页面不存在，或者文章还没部署上来。</p>' +
      '<a href="#/" class="nb-btn !bg-mint"><i class="ri-home-line"></i> 回首页</a></div>';
  }

  global.Bedrock = global.Bedrock || {};
  global.Bedrock.ui = {
    esc: esc, md: md, fmtDate: fmtDate, fmtTime: fmtTime, ago: ago, toast: toast,
    sticker: sticker, badgeRow: badgeRow, postCard: postCard, readMinutes: readMinutes,
    highlight: highlight, sectionTitle: sectionTitle, emptyBox: emptyBox,
    viewHome: viewHome, viewPosts: viewPosts, viewPost: viewPost,
    viewProjects: viewProjects, viewArchive: viewArchive, viewAbout: viewAbout,
    viewGuestbook: viewGuestbook, viewLinks: viewLinks, notFound: notFound,
    commentsBlock: commentsBlock
  };
})(window);
