/* =========================================================
   config.js —— 全站唯一需要你手动修改的地方
   部署只需改下面 3 行：owner / repo / branch
   ========================================================= */
window.BEDROCK_CONFIG = {
  /* ---------- 1. GitHub 仓库（必填） ---------- */
  owner:  'YOUR_GITHUB_USERNAME',   // 你的 GitHub 用户名，例如 'chenqian'
  repo:   'bedrock-blog',           // 仓库名
  branch: 'main',                   // 分支：main 或 master

  /* ---------- 2. 数据文件位置（一般不用改） ---------- */
  postsPath: 'content/posts.json',  // 文章数据库（作者模式会直接 commit 这个文件）
  sitePath:  'content/site.json',   // 站点资料（可选；不存在则用下面的 site 配置）

  /* ---------- 3. 站点信息 ---------- */
  site: {
    title: '沉潜·Bedrock',
    slogan: 'BEDROCK // 沉潜个人博客',
    author: '沉潜',
    avatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=bedrock&backgroundColor=A3E635',
    // 头像也可以换成自己的图：'assets/avatar.png'
    bio: '北京理工大学睿信书院 · 信息科学技术类 2026 级。\n地基打得越深，楼才能盖得越高。这里记录我从零开始啃 AI / 数据科学 / 嵌入式的全过程。',
    location: '北京',
    email: 'you@example.com',
    socials: [
      { name: 'GitHub',  icon: 'ri-github-fill',   url: 'https://github.com/YOUR_GITHUB_USERNAME' },
      { name: 'Bilibili',icon: 'ri-bilibili-fill', url: 'https://space.bilibili.com/' },
      { name: '邮箱',     icon: 'ri-mail-line',    url: 'mailto:you@example.com' }
    ],
    // 首页贴纸徽章
    badges: ['AI / 数据科学', '51 单片机', 'Python', '前端', '大一在读', '硬核'],
    // 项目展示（可在创作台里覆盖到 content/site.json）
    projects: [
      {
        name: 'Bedrock Blog',
        desc: '你现在看到的这个站。纯静态 + GitHub 作为后端，作者登录即可在线写文章，零服务器成本。',
        tags: ['前端', 'Neo-Brutalism', 'GitHub Pages'],
        url: '#',
        color: '#A3E635',
        year: '2026'
      },
      {
        name: '51 单片机实验记录',
        desc: 'STC89C52 + Keil，从点灯到红外遥控、电机驱动，每一步都留一份能烧录的 hex 与现象记录。',
        tags: ['嵌入式', 'C', '硬件'],
        url: '#',
        color: '#38BDF8',
        year: '2026'
      },
      {
        name: '数据科学练习册',
        desc: 'Pandas / NumPy / 可视化练手合集，配真实数据集与可复现 notebook。',
        tags: ['Python', '数据分析'],
        url: '#',
        color: '#FDE047',
        year: '2026'
      }
    ],
    // 友链
    links: [
      { name: '示例友链 A', desc: '一个很有意思的技术博客', url: 'https://example.com' },
      { name: '示例友链 B', desc: '记录折腾的日常', url: 'https://example.com' }
    ]
  },

  /* ---------- 4. 评论系统（访客评论） ---------- */
  // 【推荐】不用手填这里！部署上线后：右上角登录 → 创作台 → 「评论设置」→ 点「检测我的仓库并自动填 ID」，
  // 系统会自动查到 repoId / categoryId 并写进 content/site.json（在线数据文件，不用改代码）。
  // 想手动配置也可以：https://giscus.app 会生成下面这两个 ID。
  // 前置条件：仓库必须 Public，并且 Settings → Features 里勾选了 Discussions。
  giscus: {
    enabled: false,
    repoId: '',           // R_kgDOxxxxxx
    categoryId: '',       // DIC_kwDOxxxxxx
    category: 'Announcements',
    mapping: 'pathname',
    lang: 'zh-CN',
    theme: 'light'
  },
  // 未启用 Giscus 时的兜底：评论存本地浏览器（会在 UI 上明确标注「仅本设备可见」）
  localComment: true,

  /* ---------- 5. 作者 OAuth 登录（可选，日常更方便） ---------- */
  // 想用「点击授权」而不是手抄 Token：
  // 1) https://github.com/settings/developers → New OAuth App
  //    Homepage: https://<owner>.github.io/<repo>/
  //    Callback: https://<owner>.github.io/<repo>/oauth.html
  // 2) 把 workers/oauth-proxy.js 部署到 Cloudflare Worker，设置密钥 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
  // 3) 把 Client ID 和 Worker 地址填到下面
  oauth: {
    clientId: '',
    workerUrl: '',        // 例如 'https://bedrock-oauth.xxx.workers.dev'
    scope: 'repo'
  },

  /* ---------- 6. 其它 ---------- */
  pageSize: 8             // 文章列表每页条数
};
