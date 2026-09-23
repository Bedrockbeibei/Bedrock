/* =========================================================
   app.js —— 路由 / 事件委托 / 登录 / 初始化
   ========================================================= */
(function (global) {
  'use strict';

  var CFG = global.BEDROCK_CONFIG;
  var store = global.Bedrock.store;
  var gh = global.Bedrock.gh;
  var ui = global.Bedrock.ui;
  var editor = global.Bedrock.editor;

  var view, site = null;

  /* ================= 路由 ================= */
  function parseHash() {
    var h = global.location.hash.replace(/^#/, '') || '/';
    var parts = h.split('?');
    var path = parts[0] || '/';
    var query = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      query[k] = v;
    });
    var segs = path.split('/').filter(Boolean).map(function (s) {
      try { return decodeURIComponent(s); } catch (e) { return s; }
    });
    return { segs: segs, query: query };
  }

  function render() {
    if (!view) view = document.getElementById('view');
    var r = parseHash();
    var head = r.segs[0] || '';
    var html = '';

    if (head === '') html = ui.viewHome(site);
    else if (head === 'posts') html = ui.viewPosts(r.query);
    else if (head === 'post') html = ui.viewPost(r.segs[1] || '');
    else if (head === 'projects') html = ui.viewProjects(site);
    else if (head === 'archive') html = ui.viewArchive();
    else if (head === 'about') html = ui.viewAbout(site);
    else if (head === 'guestbook') html = ui.viewGuestbook();
    else if (head === 'links') html = ui.viewLinks(site);
    else if (head === 'admin') html = editor.viewAdmin(site);
    else html = ui.notFound();

    view.innerHTML = html;
    setNavActive(head);
    afterRender(head, r);
  }

  function afterRender(head, r) {
    global.scrollTo({ top: 0, behavior: 'auto' });
    ui.highlight(view);
    injectGiscus();
    injectToc();
    if (head === 'posts') {
      var input = document.getElementById('search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
      }
    }
  }

  /* 目录：把正文里的 h2/h3 抽成侧边小卡 */
  function injectToc() {
    var body = document.getElementById('post-body');
    if (!body) return;
    var hs = body.querySelectorAll('h2, h3');
    if (hs.length < 3) return;
    var items = '';
    Array.prototype.forEach.call(hs, function (h, i) {
      if (!h.id) h.id = 'sec-' + i;
      items += '<a href="#' + h.id + '" class="block text-sm font-bold py-1 hover:bg-sun hover:pl-1 transition-all ' +
        (h.tagName === 'H3' ? 'pl-3 text-xs opacity-80' : '') + '">' + ui.esc(h.textContent) + '</a>';
    });
    var box = document.createElement('aside');
    box.className = 'nb-card !bg-white p-4 mb-6';
    box.innerHTML = '<div class="font-display text-lg mb-2 inline-block bg-violet border-2 border-black px-2 rotate-[-1deg]">目录</div><nav class="max-h-64 overflow-y-auto">' + items + '</nav>';
    body.parentNode.insertBefore(box, body);
  }

  /* Giscus 评论（需动态注入脚本） */
  function injectGiscus() {
    var g = CFG.giscus || {};
    var host = document.querySelector('.giscus');
    if (!host || !g.enabled || !g.repoId || !g.categoryId) return;
    var old = document.getElementById('giscus-script');
    if (old) old.remove();
    host.innerHTML = '';
    var s = document.createElement('script');
    s.id = 'giscus-script';
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    var attrs = {
      'data-repo': CFG.owner + '/' + CFG.repo,
      'data-repo-id': g.repoId,
      'data-category': g.category || 'Announcements',
      'data-category-id': g.categoryId,
      'data-mapping': g.mapping || 'pathname',
      'data-strict': '0',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
      'data-theme': g.theme || 'light',
      'data-lang': g.lang || 'zh-CN'
    };
    Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.body.appendChild(s);
  }

  function setNavActive(head) {
    var map = { '': 'home', posts: 'posts', post: 'posts', projects: 'projects', archive: 'archive', about: 'about', guestbook: 'guestbook', links: 'links', admin: 'admin' };
    var cur = map[head] || '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (el) {
      el.classList.toggle('on', el.getAttribute('data-nav') === cur);
    });
  }

  /* ================= 搜索 ================= */
  function doSearch() {
    var el = document.getElementById('search-input');
    var q = el ? el.value.trim() : '';
    global.location.hash = q ? '#/posts?q=' + encodeURIComponent(q) : '#/posts';
  }

  /* ================= 弹窗 ================= */
  function openModal(id) { var m = document.getElementById(id); if (m) m.classList.remove('hidden'); }
  function closeModal(id) { var m = document.getElementById(id); if (m) m.classList.add('hidden'); }

  /* ================= 登录相关 ================= */
  function syncAuthUI() {
    var user = gh.getUser();
    var author = store.isAuthor();
    var btn = document.getElementById('btn-login');
    var adminBtn = document.getElementById('btn-admin');
    if (user) {
      btn.innerHTML = '<i class="' + (author ? 'ri-shield-check-fill' : 'ri-github-fill') + '"></i><span class="hidden sm:inline text-sm">' + ui.esc(user.login) + '</span>';
      btn.classList.toggle('!bg-mint', author);
      btn.classList.toggle('!bg-sun', !author);
    } else {
      btn.innerHTML = '<i class="ri-github-fill"></i><span class="hidden sm:inline text-sm">登录</span>';
      btn.classList.remove('!bg-mint');
      btn.classList.add('!bg-sun');
    }
    if (adminBtn) adminBtn.classList.toggle('hidden', !author);
    renderLoginStatus();
  }

  function renderLoginStatus() {
    var box = document.getElementById('login-status');
    if (!box) return;
    var user = gh.getUser();
    if (!user) { box.innerHTML = ''; return; }
    var author = store.isAuthor();
    box.innerHTML = '<div class="mb-4 border-[3px] border-black p-3 flex items-center gap-3" style="background:' + (author ? '#A3E635' : '#FDE047') + '">' +
      '<img src="' + ui.esc(user.avatar || '') + '" class="w-10 h-10 border-2 border-black bg-white object-cover" onerror="this.style.visibility=\'hidden\'" alt="">' +
      '<div class="flex-1"><div class="font-display text-base">' + ui.esc(user.login) + '</div>' +
      '<div class="text-xs font-bold">' + (author ? '作者身份 · 可以在线写文章' : '访客身份 · 只能浏览与评论') + '</div></div>' +
      '<button class="nb-btn !text-sm !bg-white" id="do-logout">退出</button></div>';
    box.querySelector('#do-logout').addEventListener('click', function () {
      gh.logout(); syncAuthUI(); ui.toast('已退出登录', 'ok'); render();
    });
  }

  function initLoginModal() {
    var modal = document.getElementById('modal-login');
    var pane = modal.querySelector('.p-5');
    var status = document.createElement('div');
    status.id = 'login-status';
    pane.insertBefore(status, pane.firstChild);

    modal.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal('modal-login'); });
    });
    modal.querySelector('.nb-modal-mask').addEventListener('click', function () { closeModal('modal-login'); });

    modal.querySelectorAll('.login-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        modal.querySelectorAll('.login-tab').forEach(function (x) { x.classList.remove('!bg-sun'); });
        t.classList.add('!bg-sun');
        var name = t.getAttribute('data-tab');
        modal.querySelectorAll('.login-pane').forEach(function (p) {
          p.classList.toggle('hidden', p.getAttribute('data-pane') !== name);
        });
      });
    });

    document.getElementById('do-login-pat').addEventListener('click', function () {
      var token = document.getElementById('login-pat').value.trim();
      var remember = document.getElementById('login-remember').checked;
      var self = this;
      self.disabled = true; self.innerHTML = '<i class="ri-loader-4-line"></i> 验证中…';
      gh.loginWithToken(token, remember).then(function (res) {
        ui.toast(res.author ? '作者登录成功，可以在线写文章了' : '已识别为访客（' + res.user.login + '），可浏览与评论', res.author ? 'ok' : 'info');
        closeModal('modal-login');
        syncAuthUI(); render();
      }).catch(function (e) {
        ui.toast(e.message, 'err');
      }).then(function () {
        self.disabled = false; self.innerHTML = '<i class="ri-key-2-line"></i> 验证并登录';
      });
    });

    document.getElementById('do-login-oauth').addEventListener('click', function () {
      try { gh.startOAuth(); }
      catch (e) { ui.toast(e.message + '（也可以用 Token 登录）', 'warn'); }
    });

    document.getElementById('do-login-guest').addEventListener('click', function () {
      var nick = document.getElementById('login-nick').value.trim();
      if (!nick) { ui.toast('先填个昵称', 'err'); return; }
      store.setNick(nick);
      gh.setUser({ login: nick, name: nick, visitor: true, avatar: '' });
      ui.toast('已以访客「' + nick + '」身份进入，可以留言了', 'ok');
      closeModal('modal-login'); syncAuthUI(); render();
    });

    // 如果 URL 带 code（OAuth 回调回到了首页），自动完成交换
    var m = global.location.search.match(/[?&]code=([^&]+)/);
    if (m) {
      gh.exchangeCode(decodeURIComponent(m[1])).then(function (res) {
        ui.toast(res.author ? 'GitHub 登录成功' : '登录成功（访客）', 'ok');
        history.replaceState(null, '', global.location.pathname + global.location.hash);
        syncAuthUI(); render();
      }).catch(function (e) { ui.toast('OAuth 登录失败：' + e.message, 'err'); });
    }
  }

  function initEditorModal() {
    var modal = document.getElementById('modal-editor');
    modal.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal('modal-editor'); });
    });
    modal.querySelector('.nb-modal-mask').addEventListener('click', function () { closeModal('modal-editor'); });
    document.getElementById('ed-save').addEventListener('click', editor.saveToGithub);
    document.getElementById('ed-draft-local').addEventListener('click', editor.saveLocalDraft);
    document.getElementById('ed-download').addEventListener('click', editor.downloadCurrent);
    editor.initEditorUI();
  }

  /* ================= 事件委托 ================= */
  function initEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var act = el.getAttribute('data-action');
      var slug = el.getAttribute('data-slug');

      switch (act) {
        case 'open-post':
          global.location.hash = '#/post/' + slug; break;
        case 'do-search':
          doSearch(); break;
        case 'new-post':
          editor.openEditor(null); break;
        case 'edit-post':
          editor.openEditor(store.getPost(slug)); break;
        case 'delete-post':
          editor.deletePost(slug); break;
        case 'submit-comment': {
          var name = (document.getElementById('cmt-name') || {}).value || '';
          var content = (document.getElementById('cmt-content') || {}).value || '';
          if (!content.trim()) { ui.toast('评论内容不能为空', 'err'); return; }
          if (name.trim()) store.setNick(name.trim());
          store.addComment(slug, name.trim() || '匿名访客', content.trim());
          ui.toast('评论已发表', 'ok'); render(); break;
        }
        case 'del-comment':
          store.delComment(slug, el.getAttribute('data-id')); ui.toast('已删除', 'ok'); render(); break;
        case 'submit-guest': {
          var n = (document.getElementById('gb-name') || {}).value || '';
          var c = (document.getElementById('gb-contact') || {}).value || '';
          var t = (document.getElementById('gb-content') || {}).value || '';
          if (!t.trim()) { ui.toast('留言内容不能为空', 'err'); return; }
          if (n.trim()) store.setNick(n.trim());
          store.addGuestbook(n.trim() || '匿名访客', t.trim(), c.trim());
          ui.toast('留言已贴上', 'ok'); render(); break;
        }
        case 'del-guest':
          store.delGuestbook(el.getAttribute('data-id')); ui.toast('已删除', 'ok'); render(); break;
        case 'check-deploy':
          ui.toast('正在检查 GitHub Pages…', 'info');
          store.checkDeployed().then(function (done) {
            ui.toast(done ? '已同步线上，本地临时改动已清除' : '还没生效，Pages 一般 1–2 分钟，再等等', done ? 'ok' : 'warn');
            render();
          }); break;
        case 'import-json': editor.importJson(); break;
        case 'export-json': editor.exportAll(); break;
        case 'save-site-local': editor.saveSite(false); break;
        case 'save-site-github': editor.saveSite(true); break;
        case 'reset-site':
          store.lsDel(store.K.site); ui.toast('已恢复默认站点资料', 'ok'); reload(); break;
        case 'clear-overlay':
          store.clearOverlay(); ui.toast('本地未同步改动已清除', 'ok'); reload(); break;
        case 'reload-remote': reload(); break;
        case 'logout':
          gh.logout(); syncAuthUI(); ui.toast('已退出登录', 'ok'); render(); break;
      }
    });

    // 顶部按钮
    document.getElementById('btn-login').addEventListener('click', function () { openModal('modal-login'); });
    document.getElementById('btn-search').addEventListener('click', function () {
      global.location.hash = '#/posts';
      setTimeout(function () { var i = document.getElementById('search-input'); if (i) i.focus(); }, 60);
    });
    document.getElementById('btn-menu').addEventListener('click', function () {
      document.getElementById('mobile-nav').classList.toggle('hidden');
    });
    document.getElementById('mobile-nav').addEventListener('click', function (e) {
      if (e.target.closest('a')) document.getElementById('mobile-nav').classList.add('hidden');
    });

    // ESC 关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal('modal-login'); closeModal('modal-editor'); }
    });

    // 阅读进度条
    var bar = document.getElementById('read-progress');
    global.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - global.innerHeight;
      var p = h > 0 ? (global.scrollY / h) * 100 : 0;
      bar.style.width = Math.min(100, Math.max(0, p)) + '%';
    }, { passive: true });

    global.addEventListener('hashchange', render);
  }

  /* ================= 页脚 ================= */
  function initFooter() {
    document.getElementById('year').textContent = new Date().getFullYear();
    document.getElementById('footer-desc').textContent = (site.bio || '').split('\n')[0] || '';
    var box = document.getElementById('footer-socials');
    box.innerHTML = (site.socials || []).map(function (s) {
      return '<a href="' + ui.esc(s.url) + '" target="_blank" rel="noopener" class="nb-btn !px-2 !py-1 !bg-white !text-sm" title="' + ui.esc(s.name) + '"><i class="' + ui.esc(s.icon) + '"></i></a>';
    }).join('');
    var gl = document.getElementById('footer-github');
    if (gl && CFG.owner && CFG.owner !== 'YOUR_GITHUB_USERNAME') {
      gl.href = 'https://github.com/' + CFG.owner + '/' + CFG.repo;
    }
    document.title = (site.title || 'Bedrock') + ' · 个人博客';
  }

  /* ================= 启动 ================= */
  function reload() {
    return store.loadSite().then(function () {
      site = store.mergeSite();
      return store.loadAll(true);
    }).then(function () { render(); initFooter(); });
  }

  function boot() {
    view = document.getElementById('view');
    // 404.html 跳转过来的，恢复原始路径为 hash 路由
    try {
      var back = sessionStorage.getItem('bedrock_404');
      if (back && !global.location.hash) {
        sessionStorage.removeItem('bedrock_404');
        global.location.hash = '#' + (back.replace(/^\//, '') || '/');
      }
    } catch (e) {}
    site = store.mergeSite();
    initLoginModal();
    initEditorModal();
    initEvents();
    syncAuthUI();
    initFooter();

    // 先渲染一版（用内置/缓存数据），再从远端刷新
    render();
    reload().then(function () {
      syncAuthUI();
      if (store.state.source === 'demo' && (CFG.owner === 'YOUR_GITHUB_USERNAME' || !CFG.owner)) {
        ui.toast('当前是内置示例数据，改 config.js 里的 owner/repo 即可接入你的仓库', 'info');
      }
    });
  }

  global.Bedrock = global.Bedrock || {};
  global.Bedrock.app = {
    render: render, rerender: render, reload: reload, boot: boot,
    openModal: openModal, closeModal: closeModal, syncAuthUI: syncAuthUI,
    toast: ui.toast
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
