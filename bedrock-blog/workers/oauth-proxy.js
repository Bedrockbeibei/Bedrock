/**
 * oauth-proxy.js —— Cloudflare Worker
 * 用途：把 GitHub OAuth 的 code 换成 access_token。
 * 为什么需要它：OAuth 的 client_secret 绝不能放在前端，所以交换这一步必须有个"后端"。
 * 一个免费的 Cloudflare Worker 就够了。
 *
 * 部署步骤：
 *   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. 把本文件内容粘进去，Deploy
 *   3. Settings → Variables → 添加两个加密变量（Encrypt）：
 *        GITHUB_CLIENT_ID      = OAuth App 的 Client ID
 *        GITHUB_CLIENT_SECRET  = OAuth App 的 Client Secret
 *   4. 把 Worker 的域名（https://xxx.your-name.workers.dev）填进
 *      assets/js/config.js 的 oauth.workerUrl
 */
export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    if (!body || !body.code) return json({ error: 'Missing code' }, 400);

    // 只允许本站来源调用（把 ALLOWED_ORIGIN 换成你的 Pages 域名更严格）
    const origin = request.headers.get('Origin') || '';
    if (env.ALLOWED_ORIGIN && origin && !origin.startsWith(env.ALLOWED_ORIGIN)) {
      return json({ error: 'Origin not allowed' }, 403);
    }

    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: body.code
      })
    });

    const data = await r.json();
    if (!data.access_token) return json({ error: data.error_description || 'Exchange failed' }, 400);

    // 只把 token 返回给前端，不暴露 client_secret
    return json({ access_token: data.access_token, scope: data.scope || '' }, 200);
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors())
  });
}
