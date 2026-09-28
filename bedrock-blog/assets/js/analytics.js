/* =================================================================
 * analytics.js —— 真实访问统计
 *
 * 分两件事：
 *   A. 上报：访客每打开一个页面，告诉统计服务"这个路径被看了一次"
 *   B. 展示：从 content/stats.json 读回聚合结果，显示浏览量和趋势
 *
 * 为什么不直接在前端调统计服务的 API？
 *   因为调 API 必须带上你的密钥，而网页里的东西任何人按 F12 都能看见。
 *   所以：上报用公开的 count.js（不需要密钥），
 *        聚合数据交给 GitHub Actions 拉回来写进 content/stats.json（密钥存在仓库 Secret 里），
 *        前端只读这个 JSON —— 和读 posts.json 完全一样的路径。
 *
 * 本站是 hash 路由的单页应用（网址形如 /#/post/xxx），
 * location.pathname 永远是同一个值，所以必须用手动上报模式，
 * 否则所有页面会被算成同一个路径。这是这个文件存在的主要理由。
 * ================================================================= */
(function (global) {
  'use strict';
  var CFG = global.BEDROCK_CONFIG || {};
  var A = CFG.analytics || {};

  var stats = null;      // content/stats.json 的内容
  var lastPath = '';     // 已经上报过的路径，避免重复计数
  var gcReady = false;   // count.js 是否已加载
  var watching = false;  // 是否已经在轮询等待就绪（避免每次 track 都新建一个轮询）
  var listeners = [];

  /* ---------- 配置 ---------- */
  // content/site.json 里也可以放一份 analytics，优先级高于 config.js
  function cfg() {
    var s = (global.Bedrock && global.Bedrock.store && global.Bedrock.store.state.site) || null;
    return Object.assign({}, CFG.analytics || {}, (s && s.analytics) || {});
  }
  function provider() {
    var c = cfg();
    return String(c.provider || 'off').toLowerCase();
  }
  function siteCode() { return String(cfg().siteCode || '').trim(); }

  /* ---------- 当前页面对应的统计路径 ---------- */
  // /#/post/xxx  →  /post/xxx
  // /#/posts?q=a →  /posts   （查询参数丢掉，否则每个搜索词都会变成一条新路径）
  // /#/admin     →  null     （作者自己的后台，不计入读者统计）
  function currentPath() {
    var h = String(global.location.hash || '#/').replace(/^#/, '').split('?')[0];
    if (h.charAt(0) !== '/') h = '/' + h;
    var segs = h.split('/').filter(Boolean);
    if (segs[0] === 'admin') return null;
    return '/' + segs.join('/');
  }

  function isLocalPreview() {
    var h = global.location.hostname;
    return global.location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
  }

  /* ---------- A. 上报 ---------- */
  function inject() {
    var p = provider();
    if (p === 'off' || p === '') return;

    if (p === 'goatcounter') {
      var code = siteCode();
      if (!code) { console.warn('[analytics] 还没填 GoatCounter 站点代号，统计未启动'); return; }
      // no_onload：不要在脚本加载时自动上报，等我们路由切换时手动调 count()
      // 对本单页应用是必须的，否则只会计一次、且路径永远是 /
      global.goatcounter = { no_onload: true, no_events: true, allow_local: true };
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://' + code + '.goatcounter.com/count.js';
      s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
      s.setAttribute('data-goatcounter-settings', JSON.stringify({ no_onload: true, no_events: true, allow_local: true }));
      s.onerror = function () { console.warn('[analytics] count.js 加载失败（网络问题？），本次不计入'); };
      document.head.appendChild(s);
      watchReady();
      return;
    }

    if (p === 'busuanzi') {
      var b = document.createElement('script');
      b.async = true;
      b.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
      document.head.appendChild(b);
      // 不蒜子会按它指定 id 的元素自动填充，见 busuanziTags()
      window.busuanzi_all_site_pv_div = true;
    }
  }

  // count.js 是 async 加载的，可能还没就绪，轮询等它
  function watchReady() {
    if (global.goatcounter && global.goatcounter.count) { gcReady = true; return true; }
    if (watching) return false;
    watching = true;
    var t = global.setInterval(function () {
      if (global.goatcounter && global.goatcounter.count) {
        gcReady = true;
        global.clearInterval(t);
        track(true);          // 就绪后补上报一次
        notify();
      }
    }, 120);
    global.setTimeout(function () { global.clearInterval(t); watching = false; }, 10000);
    return false;
  }

  // 不蒜子要求页面上先有这些元素，它的脚本才会往里填数字
  function busuanziTags() {
    return '<span id="busuanzi_container_site_pv">累计访问 <b id="busuanzi_value_site_pv">—</b> 次</span>' +
      '<span id="busuanzi_container_page_pv" class="ml-4">本页 <b id="busuanzi_value_page_pv">—</b> 次</span>';
  }

  function track(force) {
    var p = provider();
    if (p === 'off' || p === '') return;
    var path = currentPath();
    if (!path) return;                                  // 是后台页面
    if (!force && path === lastPath) return;            // 同一路径不重复上报
    lastPath = path;

    if (isLocalPreview()) {
      // 本地预览不上报，免得把自己的调试刷屏混进真实数据
      console.log('[analytics] 本地预览不计入统计，本次路径：' + path);
      return;
    }
    if (p === 'goatcounter') {
      if (!watchReady()) return;                        // 脚本没就绪就等 watchReady 回调来补
      try { global.goatcounter.count({ path: path }); } catch (e) {}
    }
    // busuanzi 自己会数，不需要我们调
  }

  /* ---------- B. 读取 content/stats.json ---------- */
  function statsPath() { return String(CFG.statsPath || 'content/stats.json'); }

  function loadStats() {
    var gh = global.Bedrock && global.Bedrock.gh;
    if (!gh || !gh.fetchJson) return Promise.resolve(null);
    return gh.fetchJson(statsPath()).then(function (d) {
      if (d && typeof d === 'object') { stats = d; notify(); return stats; }
      throw new Error('bad stats');
    }).catch(function () {
      stats = null;                                     // 没配就没有，页面上不显示这一块
      notify();
      return null;
    });
  }

  function notify() { listeners.forEach(function (f) { try { f(stats); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); }

  function hasData() { return !!(stats && stats.total > 0); }

  // 某个路径的累计浏览量
  function viewsOf(path) {
    if (!stats || !stats.paths) return 0;
    var it = stats.paths[path];
    if (!it) return 0;
    return (typeof it === 'number') ? it : (it.pv || 0);
  }

  global.Bedrock = global.Bedrock || {};
  global.Bedrock.analytics = {
    provider: provider,
    siteCode: siteCode,
    track: track,
    inject: inject,
    loadStats: loadStats,
    onChange: onChange,
    stats: function () { return stats; },
    hasData: hasData,
    viewsOf: viewsOf,
    currentPath: currentPath,
    busuanziTags: busuanziTags
  };

  // 路由切换时上报（hashchange 是本站唯一的换页信号）
  global.addEventListener('hashchange', function () { track(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})(window);
