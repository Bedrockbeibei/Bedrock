/* =========================================================
   github.js —— GitHub 作为后端：认证 + Contents API 读写
   纯静态站点没有服务器，所以：
     · 读文章：走 jsDelivr CDN（免速率限制、支持 CORS）
     · 写文章：作者登录后用 GitHub Contents API 直接 commit
   ========================================================= */
(function (global) {
  'use strict';

  var CFG = global.BEDROCK_CONFIG;
  var API = 'https://api.github.com';
  var RAW = 'https://raw.githubusercontent.com';
  var CDN = 'https://cdn.jsdelivr.net/gh';
  var TOKEN_KEY = 'bedrock_gh_token_v1';
  var USER_KEY  = 'bedrock_gh_user_v1';
  var EXP_KEY   = 'bedrock_gh_exp_v1';
  var DAY = 86400000;

  /* ---------------- Token 存取 ---------------- */
  function memoryStore() { // file:// 下 localStorage 可能受限，兜一层内存
    if (!global.__bedrock_mem) global.__bedrock_mem = {};
    return global.__bedrock_mem;
  }
  function safeGet(store, key) { try { return store.getItem(key); } catch (e) { return memoryStore()[key] || null; } }
  function safeSet(store, key, val) { try { store.setItem(key, val); } catch (e) { memoryStore()[key] = val; } }
  function safeDel(store, key) { try { store.removeItem(key); } catch (e) { delete memoryStore()[key]; } }

  function getToken() {
    var t = safeGet(global.localStorage, TOKEN_KEY) || safeGet(global.sessionStorage, TOKEN_KEY);
    if (!t) return '';
    var exp = Number(safeGet(global.localStorage, EXP_KEY) || 0);
    if (exp && Date.now() > exp) { clearToken(); return ''; }
    return t;
  }
  function setToken(token, remember) {
    clearToken();
    if (remember) {
      safeSet(global.localStorage, TOKEN_KEY, token);
      safeSet(global.localStorage, EXP_KEY, String(Date.now() + 30 * DAY));
    } else {
      safeSet(global.sessionStorage, TOKEN_KEY, token);
    }
  }
  function clearToken() {
    safeDel(global.localStorage, TOKEN_KEY);
    safeDel(global.sessionStorage, TOKEN_KEY);
    safeDel(global.localStorage, EXP_KEY);
    safeDel(global.localStorage, USER_KEY);
    safeDel(global.sessionStorage, USER_KEY);
  }
  function getUser() {
    var raw = safeGet(global.localStorage, USER_KEY) || safeGet(global.sessionStorage, USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function setUser(u) {
    var raw = JSON.stringify(u);
    if (safeGet(global.localStorage, TOKEN_KEY)) safeSet(global.localStorage, USER_KEY, raw);
    else safeSet(global.sessionStorage, USER_KEY, raw);
  }

  /* ---------------- 基础请求 ---------------- */
  function ghFetch(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/vnd.github+json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !opts.rawBody) headers['Content-Type'] = 'application/json';
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? (opts.rawBody ? opts.body : JSON.stringify(opts.body)) : undefined
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
        if (!res.ok) {
          var msg = (data && data.message) ? data.message : ('HTTP ' + res.status);
          var err = new Error(msg);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------------- 认证 ---------------- */
  function loginWithToken(token, remember) {
    if (!token || !token.trim()) return Promise.reject(new Error('请先粘贴 Token'));
    setToken(token.trim(), remember !== false);
    return ghFetch('/user').then(function (u) {
      setUser({ login: u.login, name: u.name || u.login, avatar: u.avatar_url, html_url: u.html_url });
      if (!isAuthor(u.login)) {
        // 非作者：保留只读身份，但清掉写权限凭证
        clearToken();
        setUser({ login: u.login, name: u.name || u.login, avatar: u.avatar_url, html_url: u.html_url, visitor: true });
        return { user: getUser(), author: false };
      }
      return { user: getUser(), author: true };
    }).catch(function (e) {
      clearToken();
      throw new Error('Token 验证失败：' + e.message);
    });
  }

  function isAuthor(login) {
    return !!login && login.toLowerCase() === String(CFG.owner || '').toLowerCase();
  }

  function logout() { clearToken(); }

  /* ---------------- OAuth（可选，需要 Worker） ---------------- */
  function startOAuth() {
    if (!CFG.oauth.clientId || !CFG.oauth.workerUrl) throw new Error('尚未配置 OAuth（config.js → oauth）');
    var redirect = global.location.origin + global.location.pathname.replace(/index\.html$/, '') + 'oauth.html';
    var url = 'https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(CFG.oauth.clientId) +
      '&scope=' + encodeURIComponent(CFG.oauth.scope || 'repo') +
      '&redirect_uri=' + encodeURIComponent(redirect);
    safeSet(global.localStorage, 'bedrock_oauth_from', global.location.hash || '#/');
    global.location.href = url;
  }

  function exchangeCode(code) {
    return fetch(CFG.oauth.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.access_token) throw new Error(j.error || '换取 token 失败');
      return loginWithToken(j.access_token, true);
    });
  }

  /* ---------------- GraphQL（用于查 repoId / Discussions 分类） ---------------- */
  function graphql(query, variables) {
    return ghFetch('/graphql', { method: 'POST', body: { query: query, variables: variables || {} } })
      .then(function (j) {
        if (j && j.errors && j.errors.length) {
          var e = new Error(j.errors[0].message);
          e.graphql = j.errors;
          throw e;
        }
        return j.data;
      });
  }

  /* ---------------- 文件读写（Contents API） ---------------- */
  function fileUrl(path) { return '/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + path; }

  function readRepoFile(path) {
    return ghFetch(fileUrl(path) + '?ref=' + encodeURIComponent(CFG.branch)).then(function (j) {
      var text = decodeBase64(j.content || '');
      var data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      return { data: data, text: text, sha: j.sha };
    });
  }

  function writeRepoFile(path, obj, sha, message) {
    var content = encodeBase64(JSON.stringify(obj, null, 2));
    var body = { message: message || 'chore(bedrock): update ' + path, content: content, branch: CFG.branch };
    if (sha) body.sha = sha;
    return ghFetch(fileUrl(path), { method: 'PUT', body: body }).then(function (j) {
      return j && j.commit ? j.commit.sha : '';
    });
  }

  /* ---------------- 公开读取（无需登录） ---------------- */
  // 顺序：同源文件（就是仓库本身，最快）→ jsDelivr CDN → raw.githubusercontent
  function fetchJson(path) {
    var owner = CFG.owner, repo = CFG.repo, branch = CFG.branch;
    var viaCdn = CDN + '/' + owner + '/' + repo + '@' + branch + '/' + path;
    var viaRaw = RAW + '/' + owner + '/' + repo + '/' + branch + '/' + path;
    return fetchWithTimeout(path + '?t=' + Date.now())
      .catch(function () { return fetchWithTimeout(viaCdn + '?t=' + Date.now()); })
      .catch(function () { return fetchWithTimeout(viaRaw + '?t=' + Date.now()); });
  }

  function fetchWithTimeout(url) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, 5000);
      fetch(url, { cache: 'no-store' }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) { reject(new Error('HTTP ' + r.status)); return; }
        return r.json();
      }).then(resolve).catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  /* ---------------- Base64（UTF-8 安全） ---------------- */
  function encodeBase64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function decodeBase64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  global.Bedrock = global.Bedrock || {};
  global.Bedrock.gh = {
    getToken: getToken, setToken: setToken, clearToken: clearToken,
    getUser: getUser, setUser: setUser,
    loginWithToken: loginWithToken, isAuthor: isAuthor, logout: logout,
    startOAuth: startOAuth, exchangeCode: exchangeCode,
    readRepoFile: readRepoFile, writeRepoFile: writeRepoFile,
    fetchJson: fetchJson, encodeBase64: encodeBase64, decodeBase64: decodeBase64,
    ghFetch: ghFetch, graphql: graphql
  };
})(window);
