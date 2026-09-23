/* =========================================================
   editor.js —— 作者创作台：在线写文章 / 管理 / 提交到 GitHub
   ========================================================= */
(function (global) {
  'use strict';

  var CFG = global.BEDROCK_CONFIG;
  var store = global.Bedrock.store;
  var gh = global.Bedrock.gh;
  var ui = global.Bedrock.ui;
  var esc = ui.esc;

  var editing = null;   // 当前编辑的文章（null = 新建）

  /* ================= 创作台视图 ================= */
  function viewAdmin(site) {
    var user = gh.getUser() || {};
    var author = store.isAuthor();
    var lastCommit = store.lsGet('bedrock_last_commit_v1', null);
    var posts = store.state.posts.slice().sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });

    var html = '' +
    '<div class="flex flex-wrap items-end justify-between gap-4 mb-6">' +
      '<div><h1 class="font-display text-4xl sm:text-5xl"><span class="bg-violet border-[3px] border-black px-2 inline-block -rotate-1">创作台</span></h1>' +
      '<p class="font-bold mt-2 text-sm">写文章 → 保存到 GitHub → Pages 自动重建。全程不用碰代码。</p></div>' +
      '<div class="flex flex-wrap gap-2">' +
        '<button class="nb-btn !bg-mint" data-action="new-post"><i class="ri-add-line"></i> 新建文章</button>' +
        '<button class="nb-btn !bg-sun" data-action="check-deploy"><i class="ri-refresh-line"></i> 检查部署</button>' +
        '<button class="nb-btn !bg-white" data-action="import-json"><i class="ri-upload-line"></i> 导入</button>' +
        '<button class="nb-btn !bg-white" data-action="export-json"><i class="ri-download-line"></i> 导出</button>' +
      '</div>' +
    '</div>' +

    /* ---------- 状态面板 ---------- */
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
      statusCard('身份', author ? '作者 · ' + esc(user.login) : (user.login ? '访客 · ' + esc(user.login) : '未登录'),
        author ? '#A3E635' : '#FB7185', author ? 'ri-shield-check-fill' : 'ri-user-line') +
      statusCard('数据源', store.state.source === 'demo' ? '内置示例' : '仓库文件',
        store.state.source === 'demo' ? '#FDE047' : '#38BDF8', 'ri-database-2-line') +
      statusCard('部署状态', store.state.deploying ? '等待 Pages 重建…' : '已同步',
        store.state.deploying ? '#FDE047' : '#A3E635', store.state.deploying ? 'ri-time-line' : 'ri-check-double-line') +
    '</div>' +

    (author ? '' : '<div class="nb-note !bg-coral mb-6"><i class="ri-lock-line"></i><span><b>当前是访客身份，只能浏览。</b>点右上角「登录」，用 GitHub Token 或 OAuth 以作者身份登录，才能在线写文章。（登录名必须与 config.js 里的 owner 一致）</span></div>') +

    (store.state.deploying ? '<div class="nb-note !bg-sun mb-6"><i class="ri-time-line"></i><span>有改动正在等待 GitHub Pages 重建（通常 1–2 分钟）。你自己的浏览器里已经能看到最新内容。重建完成后点上面的「检查部署」清除提示。</span></div>' : '') +

    (lastCommit ? '<div class="text-xs font-bold mb-6 opacity-70">最近一次提交：<code>' + esc(String(lastCommit.sha || '').slice(0, 10)) + '</code> · ' + ui.ago(lastCommit.ts) + '</div>' : '') +

    /* ---------- 文章管理 ---------- */
    '<h2 class="font-display text-2xl mb-4">文章管理 <span class="text-base font-black opacity-60">(' + posts.length + ')</span></h2>' +
    '<div class="space-y-3 mb-10">' +
      (posts.length ? posts.map(function (p) {
        return '<div class="nb-card !bg-white p-4 flex flex-wrap items-center gap-3">' +
          '<span class="w-3 h-10 border-2 border-black shrink-0" style="background:' + esc(p.color || '#A3E635') + '"></span>' +
          '<div class="flex-1 min-w-[200px]">' +
            '<div class="font-display text-lg leading-tight">' + esc(p.title) + '</div>' +
            '<div class="text-xs font-bold opacity-70 mt-1">' + ui.fmtDate(p.createdAt) + ' · ' + ui.readMinutes(p.body) + ' 分钟 · ' + esc((p.tags || []).join(' / ')) + '</div>' +
            '<div class="flex flex-wrap gap-1 mt-2">' +
              (p.status === 'draft' ? ui.sticker('草稿', '#FB7185') : ui.sticker('已发布', '#A3E635')) +
              (p.pinned ? ui.sticker('置顶', '#FDE047') : '') +
            '</div>' +
          '</div>' +
          '<div class="flex flex-wrap gap-2">' +
            '<a href="#/post/' + esc(p.slug) + '" class="nb-btn !text-sm !bg-white"><i class="ri-eye-line"></i> 查看</a>' +
            '<button class="nb-btn !text-sm !bg-violet" data-action="edit-post" data-slug="' + esc(p.slug) + '"><i class="ri-edit-2-line"></i> 编辑</button>' +
            '<button class="nb-btn !text-sm !bg-white" data-action="delete-post" data-slug="' + esc(p.slug) + '"><i class="ri-delete-bin-line"></i></button>' +
          '</div>' +
        '</div>';
      }).join('') : ui.emptyBox('还没有文章，点「新建文章」。')) +
    '</div>' +

    /* ---------- 评论设置（Giscus） ---------- */
    commentCard(site) +

    /* ---------- 站点资料 ---------- */
    '<h2 class="font-display text-2xl mb-4">站点资料</h2>' +
    '<div class="nb-card !bg-white p-5 mb-10">' +
      '<div class="nb-note !bg-sky mb-3"><i class="ri-information-line"></i><span>改昵称、简介、项目、友链都在这里。JSON 格式，改完点保存。</span></div>' +
      '<textarea id="site-json" class="nb-input font-mono text-xs h-56">' + esc(JSON.stringify(site, null, 2)) + '</textarea>' +
      '<div class="flex flex-wrap gap-2 mt-3">' +
        '<button class="nb-btn !text-sm !bg-sun" data-action="save-site-local"><i class="ri-save-3-line"></i> 保存到本地</button>' +
        '<button class="nb-btn !text-sm !bg-mint" data-action="save-site-github"><i class="ri-upload-2-line"></i> 提交到 GitHub</button>' +
        '<button class="nb-btn !text-sm !bg-white" data-action="reset-site"><i class="ri-restart-line"></i> 恢复默认</button>' +
      '</div>' +
    '</div>' +

    /* ---------- 危险区 ---------- */
    '<h2 class="font-display text-2xl mb-4">数据维护</h2>' +
    '<div class="nb-card !bg-white p-5">' +
      '<div class="flex flex-wrap gap-2">' +
        '<button class="nb-btn !text-sm !bg-white" data-action="clear-overlay"><i class="ri-eraser-line"></i> 清除本地未同步改动</button>' +
        '<button class="nb-btn !text-sm !bg-white" data-action="reload-remote"><i class="ri-cloud-download-line"></i> 从 GitHub 重新拉取</button>' +
        '<button class="nb-btn !text-sm !bg-coral" data-action="logout"><i class="ri-logout-box-line"></i> 退出登录</button>' +
      '</div>' +
      '<p class="text-xs font-bold opacity-70 mt-3">提示：所有文章都存在 <code>' + esc(CFG.postsPath) + '</code>，随时可以在 GitHub 网页上直接编辑这个文件，效果一样。</p>' +
    '</div>';

    return html;
  }
  /* ================= 评论设置：Giscus ================= */
  function commentCard() {
    var g = CFG.giscus || {};
    var ok = !!(g.enabled && g.repoId && g.categoryId);
    return '' +
    '<h2 class="font-display text-2xl mb-4">评论设置 <span class="text-base font-black opacity-60">（Giscus · GitHub Discussions）</span></h2>' +
    '<div class="nb-card !bg-white p-5 mb-10">' +
      '<div class="flex flex-wrap items-center gap-3 mb-4">' +
        '<span class="font-black text-sm px-3 py-1 border-[3px] border-black" style="background:' + (ok ? '#A3E635' : '#FDE047') + '">' +
          (ok ? '已启用：评论公开持久化' : '未启用：评论只存在访客自己浏览器') +
        '</span>' +
        (ok ? '<span class="text-xs font-bold font-mono">' + esc(String(g.repoId)).slice(0, 14) + '… / ' + esc(String(g.categoryId)).slice(0, 14) + '…</span>' : '') +
      '</div>' +
      '<p class="text-sm font-semibold leading-relaxed mb-4">' +
        'Giscus 把评论存在你仓库的 Discussions 里：<b>不需要服务器、永久保存、访客用 GitHub 账号就能评论、你在 GitHub 上能直接删评论</b>。' +
        '如果不想用，页面底部的「本地评论」也能用，只是别人看不到。' +
      '</p>' +
      '<button class="nb-btn !text-sm !bg-sky" data-action="detect-giscus"><i class="ri-radar-line"></i> 检测我的仓库并自动填 ID</button>' +
      '<div id="giscus-result" class="mt-4"></div>' +
      '<div id="giscus-form" class="mt-4 ' + (g.repoId ? '' : 'hidden') + '">' +
        '<div class="grid sm:grid-cols-2 gap-3">' +
          '<div><label class="block text-sm font-black mb-1">Repo ID</label>' +
          '<input id="gs-repoid" class="nb-input !text-sm font-mono" value="' + esc(g.repoId || '') + '" placeholder="R_kgDO…"></div>' +
          '<div><label class="block text-sm font-black mb-1">Category ID</label>' +
          '<input id="gs-catid" class="nb-input !text-sm font-mono" value="' + esc(g.categoryId || '') + '" placeholder="DIC_kwDO…"></div>' +
        '</div>' +
        '<div class="grid sm:grid-cols-3 gap-3 mt-3">' +
          '<div><label class="block text-sm font-black mb-1">分类名</label>' +
          '<input id="gs-cat" class="nb-input !text-sm" value="' + esc(g.category || 'Announcements') + '"></div>' +
          '<div><label class="block text-sm font-black mb-1">语言</label>' +
          '<select id="gs-lang" class="nb-input !text-sm">' +
            ['zh-CN', 'en', 'ja', 'ko'].map(function (l) { return '<option' + (l === (g.lang || 'zh-CN') ? ' selected' : '') + '>' + l + '</option>'; }).join('') +
          '</select></div>' +
          '<div><label class="block text-sm font-black mb-1">主题</label>' +
          '<select id="gs-theme" class="nb-input !text-sm">' +
            ['light', 'dark', 'preferred_color_scheme'].map(function (t) { return '<option value="' + t + '"' + (t === (g.theme || 'light') ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<label class="flex items-center gap-2 mt-3 font-bold text-sm">' +
          '<input id="gs-enabled" type="checkbox" class="w-4 h-4 border-2 border-black accent-black"' + (g.enabled ? ' checked' : '') + '> 启用 Giscus 评论' +
        '</label>' +
        '<div class="flex flex-wrap gap-2 mt-3">' +
          '<button class="nb-btn !text-sm !bg-sun" data-action="save-giscus" data-github="0"><i class="ri-save-3-line"></i> 先只在本地生效</button>' +
          '<button class="nb-btn !text-sm !bg-mint" data-action="save-giscus" data-github="1"><i class="ri-upload-2-line"></i> 保存并提交到 GitHub</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* 检测：一步步告诉用户还差什么 */
  var Q_REPO = 'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id name visibility hasDiscussionsEnabled discussionCategories(first:20){nodes{id name slug emoji}}}}';

  function resultBox(type, title, lines) {
    var colors = { ok: '#A3E635', err: '#FB7185', warn: '#FDE047', info: '#38BDF8' };
    var box = document.getElementById('giscus-result');
    if (!box) return;
    box.innerHTML = '<div class="border-[3px] border-black p-4" style="background:' + (colors[type] || '#fff') + '">' +
      '<div class="font-display text-lg mb-2">' + esc(title) + '</div>' +
      '<ol class="text-sm font-semibold leading-relaxed space-y-1">' +
        lines.map(function (l, i) { return '<li><b>' + (i + 1) + '.</b> ' + l + '</li>'; }).join('') +
      '</ol></div>';
  }

  function detectGiscus() {
    var btn = document.querySelector('[data-action="detect-giscus"]');
    if (!gh.getToken()) {
      resultBox('warn', '先登录作者账号', [
        '点页面右上角「登录」。',
        '用你<b>自己的 GitHub 账号</b>登录（Token 或 OAuth 都行），系统要靠它去读你的仓库信息。',
        '没有 Token？GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token，只选这一个仓库，权限给 <b>Contents: Read and write</b> 和 <b>Discussions: Read and write</b>。'
      ]);
      return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i> 检测中…'; }

    gh.graphql(Q_REPO, { owner: CFG.owner, name: CFG.repo }).then(function (d) {
      var repo = d && d.repository;
      if (!repo) throw new Error('找不到仓库 ' + CFG.owner + '/' + CFG.repo + '，检查 config.js 里的 owner / repo 是不是写对了。');

      if (repo.visibility !== 'PUBLIC') {
        resultBox('err', '仓库必须是公开的', [
          'Giscus 要读公开仓库的 Discussions，私有仓库不行。',
          '去 <b>仓库 → Settings → General → Danger Zone → Change repository visibility</b>，改成 Public。'
        ]);
        return null;
      }
      if (!repo.hasDiscussionsEnabled) {
        resultBox('warn', '仓库还没开启 Discussions', [
          '打开 <b>' + esc(CFG.owner) + '/' + esc(CFG.repo) + ' → Settings</b>（仓库自己的 Settings，不是账号的）。',
          '往下拉到 <b>Features</b> 区，勾选 <b>Discussions</b>。',
          '勾选后会自动创建一个叫 <b>Announcements</b> 的分类，用默认的就行。',
          '回来再点一次「检测我的仓库」。'
        ]);
        return null;
      }

      var cats = (repo.discussionCategories && repo.discussionCategories.nodes) || [];
      if (!cats.length) {
        resultBox('warn', 'Discussions 已开启，但还没有分类', [
          '进入仓库的 <b>Discussions</b> 标签页 → 右侧齿轮 ⚙ → <b>New category</b>，名字填 <b>Announcements</b>，格式选 <b>Announcement</b>。',
          '再回来点一次「检测我的仓库」。'
        ]);
        return null;
      }

      // 自动填表：优先 Announcements / General
      var pick = cats.filter(function (c) { return /^announcement/i.test(c.name); })[0] ||
                 cats.filter(function (c) { return /^general/i.test(c.name); })[0] || cats[0];
      var form = document.getElementById('giscus-form');
      form.classList.remove('hidden');
      document.getElementById('gs-repoid').value = repo.id;
      document.getElementById('gs-catid').value = pick.id;
      document.getElementById('gs-cat').value = pick.name;
      document.getElementById('gs-enabled').checked = true;

      // 分类选择下拉
      var sel = document.getElementById('gs-cats');
      if (!sel) {
        sel = document.createElement('select');
        sel.id = 'gs-cats';
        sel.className = 'nb-input !text-sm mt-3';
        form.insertBefore(sel, form.children[2]);
        sel.addEventListener('change', function () {
          var c = cats.filter(function (x) { return x.id === sel.value; })[0];
          document.getElementById('gs-catid').value = sel.value;
          if (c) document.getElementById('gs-cat').value = c.name;
        });
      }
      sel.innerHTML = cats.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === pick.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('');

      ui.toast('检测完成，ID 已自动填好', 'ok');
      resultBox('ok', '检测通过，就差最后一步', [
        'Repo ID 和 Category ID 已经自动填进上面的输入框了。',
        '想换分类就在下拉里选（一般用 <b>Announcements</b>）。',
        '点绿色的「保存并提交到 GitHub」，等 1–2 分钟 Pages 重建后评论就上线了。'
      ]);
      return null;
    }).catch(function (e) {
      var m = String(e.message || e);
      if (/insufficient|permission|not accessible|Resource not accessible/i.test(m)) {
        resultBox('warn', 'Token 权限不够', [
          '打开 <b>GitHub → Settings → Developer settings → Personal access tokens</b>，找到你用的那个 Token。',
          '在 Repository permissions 里加上 <b>Discussions: Read and write</b>（如果只想查一次，Read 也够）。',
          '保存后，回到网站右上角退出登录，再用新 Token 登录一次。'
        ]);
      } else {
        resultBox('err', '检测失败', [esc(m), '也可以完全手动：打开 <b>giscus.app</b>，按提示填仓库，它会直接给你这两个 ID。']);
      }
    }).then(function () {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ri-radar-line"></i> 检测我的仓库并自动填 ID'; }
    });
  }

  function saveGiscus(toGithub) {
    var obj = {
      enabled: document.getElementById('gs-enabled').checked,
      repoId: document.getElementById('gs-repoid').value.trim(),
      categoryId: document.getElementById('gs-catid').value.trim(),
      category: document.getElementById('gs-cat').value.trim() || 'Announcements',
      lang: document.getElementById('gs-lang').value,
      theme: document.getElementById('gs-theme').value,
      mapping: 'pathname'
    };
    if (obj.enabled && (!obj.repoId || !obj.categoryId)) {
      ui.toast('开启了 Giscus 就必须有 Repo ID 和 Category ID，先点上面的检测', 'err'); return;
    }
    var s = store.mergeSite();
    s.giscus = obj;
    store.saveSiteLocal(s);
    if (!toGithub) { ui.toast('已保存到本地立即可见，记得之后提交到 GitHub', 'ok'); global.Bedrock.app.reload(); return; }
    if (!gh.getToken()) { ui.toast('未登录，无法提交', 'err'); return; }
    store.commitSite(s).then(function () {
      ui.toast('评论设置已提交，1–2 分钟后生效', 'ok');
      global.Bedrock.app.reload();
    }).catch(function (e) { ui.toast('提交失败：' + e.message, 'err'); });
  }

  function statusCard(label, value, color, icon) {
    return '<div class="nb-card p-4" style="background:' + color + '">' +
      '<div class="text-xs font-black flex items-center gap-1 mb-1"><i class="' + icon + '"></i> ' + esc(label) + '</div>' +
      '<div class="font-display text-lg leading-tight">' + value + '</div></div>';
  }

  /* ================= 编辑器 ================= */
  var COLORS = ['#A3E635', '#C084FC', '#FDE047', '#38BDF8', '#FB7185', '#FFFFFF'];
  var pickedColor = COLORS[0];

  function initEditorUI() {
    var box = document.getElementById('ed-colors');
    if (!box) return;
    box.innerHTML = COLORS.map(function (c, i) {
      return '<button type="button" class="w-8 h-8 border-[3px] border-black ' + (i === 0 ? 'ring-2 ring-black ring-offset-2' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]');
      if (!b) return;
      pickedColor = b.getAttribute('data-color');
      Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('ring-2', 'ring-black', 'ring-offset-2'); });
      b.classList.add('ring-2', 'ring-black', 'ring-offset-2');
    });

    function renderPreview() {
      var body = document.getElementById('ed-body').value;
      var out = document.getElementById('ed-preview');
      out.innerHTML = ui.md(body) || '<div class="opacity-50 text-sm font-bold">开始写点什么…</div>';
      ui.highlight(out);
    }
    document.getElementById('ed-body').addEventListener('input', renderPreview);
    document.getElementById('ed-title').addEventListener('input', function () {
      var slugEl = document.getElementById('ed-slug');
      if (!slugEl.dataset.touched) slugEl.value = store.slugify(this.value);
    });
    document.getElementById('ed-slug').addEventListener('input', function () { this.dataset.touched = '1'; });
    document.getElementById('ed-preview').dataset.ready = '1';
  }

  function openEditor(post) {
    editing = post || null;
    document.getElementById('editor-head').textContent = post ? '编辑：' + post.title : '新建文章';
    document.getElementById('ed-title').value = post ? post.title : '';
    document.getElementById('ed-slug').value = post ? post.slug : '';
    document.getElementById('ed-slug').dataset.touched = post ? '1' : '';
    document.getElementById('ed-tags').value = post ? (post.tags || []).join(', ') : '';
    document.getElementById('ed-excerpt').value = post ? (post.excerpt || '') : '';
    document.getElementById('ed-body').value = post ? (post.body || '') : '# 新文章\n\n写在这里…\n';
    document.getElementById('ed-status').value = post ? (post.status || 'published') : 'published';
    document.getElementById('ed-pinned').checked = post ? !!post.pinned : false;
    pickedColor = (post && post.color) || COLORS[0];
    var preview = document.getElementById('ed-preview');
    preview.innerHTML = ui.md(document.getElementById('ed-body').value);
    ui.highlight(preview);
    global.Bedrock.app.openModal('modal-editor');
  }

  function collectForm() {
    var title = document.getElementById('ed-title').value.trim();
    if (!title) { ui.toast('标题不能为空', 'err'); return null; }
    var tags = document.getElementById('ed-tags').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var post = store.makePost({
      title: title,
      slug: document.getElementById('ed-slug').value.trim() || store.slugify(title),
      tags: tags,
      excerpt: document.getElementById('ed-excerpt').value.trim(),
      body: document.getElementById('ed-body').value,
      color: pickedColor,
      status: document.getElementById('ed-status').value,
      pinned: document.getElementById('ed-pinned').checked
    });
    if (editing) {
      post.id = editing.id;
      post.createdAt = editing.createdAt;
      if (post.slug !== editing.slug) store.removeOverlay(editing.slug, true); // 改了 slug：旧地址下线
    }
    return post;
  }

  /* 保存到 GitHub（同时写本地覆盖层，立刻可见） */
  function saveToGithub() {
    var post = collectForm();
    if (!post) return;
    store.putOverlay(post);
    if (!gh.getToken()) {
      ui.toast('未登录：已保存到本地，登录后才能推送到 GitHub', 'warn');
      global.Bedrock.app.closeModal('modal-editor');
      global.Bedrock.app.rerender();
      return;
    }
    var btn = document.getElementById('ed-save');
    btn.disabled = true; btn.innerHTML = '<i class="ri-loader-4-line"></i> 提交中…';
    store.commitPosts('post: ' + post.title).then(function () {
      ui.toast('已提交到 GitHub，1–2 分钟后全网生效', 'ok');
      global.Bedrock.app.closeModal('modal-editor');
      global.Bedrock.app.rerender();
    }).catch(function (e) {
      ui.toast('提交失败：' + e.message, 'err');
    }).then(function () {
      btn.disabled = false; btn.innerHTML = '<i class="ri-upload-2-line"></i> 保存到 GitHub';
    });
  }

  function saveLocalDraft() {
    var post = collectForm();
    if (!post) return;
    post.status = 'draft';
    store.putOverlay(post);
    ui.toast('已存为本地草稿（创作台可见）', 'ok');
    global.Bedrock.app.closeModal('modal-editor');
    global.Bedrock.app.rerender();
  }

  function downloadCurrent() {
    var post = collectForm();
    if (!post) return;
    download(JSON.stringify({ version: 1, posts: [post] }, null, 2), post.slug + '.json');
  }

  /* ================= 删除 / 发布 ================= */
  function deletePost(slug) {
    var p = store.getPost(slug);
    if (!p) return;
    if (!confirm('确定删除《' + p.title + '》？\n' + (gh.getToken() ? '删除会同步提交到 GitHub。' : '（未登录，仅从本地视图移除）'))) return;
    store.removeOverlay(slug, true);
    var list = store.state.posts.filter(function (x) { return x.slug !== slug; });
    if (gh.getToken()) {
      // 直接从当前列表重建 payload 再提交
      store.state.posts = list;
      store.commitPosts('delete post: ' + p.title).then(function () {
        ui.toast('已删除并同步到 GitHub', 'ok');
      }).catch(function (e) {
        ui.toast('删除同步失败：' + e.message, 'err');
      }).then(function () { global.Bedrock.app.reload(); });
    } else {
      global.Bedrock.app.rerender();
      ui.toast('已移除（未登录，未同步到仓库）', 'warn');
    }
  }

  /* ================= 导入 / 导出 ================= */
  function exportAll() {
    download(JSON.stringify(store.buildPayload(), null, 2), 'posts.json');
    ui.toast('已导出 posts.json', 'ok');
  }
  function importJson() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = function () {
      var f = input.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var data = JSON.parse(r.result);
          var list = Array.isArray(data) ? data : (data.posts || []);
          if (!list.length) throw new Error('文件里没有文章');
          list.forEach(function (p) {
            var post = store.makePost(p);
            store.putOverlay(post);
          });
          ui.toast('已导入 ' + list.length + ' 篇（本地），记得点「保存到 GitHub」或用导出文件覆盖仓库', 'ok');
          global.Bedrock.app.rerender();
        } catch (e) { ui.toast('导入失败：' + e.message, 'err'); }
      };
      r.readAsText(f);
    };
    input.click();
  }
  function download(text, name) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ================= 站点资料 ================= */
  function saveSite(toGithub) {
    var raw = document.getElementById('site-json').value;
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { ui.toast('JSON 格式有误：' + e.message, 'err'); return; }
    store.saveSiteLocal(obj);
    if (!toGithub) { ui.toast('已保存到本地浏览器', 'ok'); global.Bedrock.app.rerender(); return; }
    if (!gh.getToken()) { ui.toast('未登录，无法提交到 GitHub', 'err'); return; }
    store.commitSite(obj).then(function () {
      ui.toast('站点资料已提交到 GitHub', 'ok');
    }).catch(function (e) {
      ui.toast('提交失败：' + e.message, 'err');
    }).then(function () { global.Bedrock.app.rerender(); });
  }

  global.Bedrock = global.Bedrock || {};
  global.Bedrock.editor = {
    viewAdmin: viewAdmin, openEditor: openEditor, initEditorUI: initEditorUI,
    saveToGithub: saveToGithub, saveLocalDraft: saveLocalDraft, downloadCurrent: downloadCurrent,
    deletePost: deletePost, exportAll: exportAll, importJson: importJson, saveSite: saveSite,
    detectGiscus: detectGiscus, saveGiscus: saveGiscus
  };
})(window);
