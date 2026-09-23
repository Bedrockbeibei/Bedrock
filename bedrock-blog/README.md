# 沉潜·Bedrock 个人博客

Neo-Brutalism（新丑风 / 粗野波普）风格的**纯静态个人博客**，托管在 GitHub Pages。
**作者登录 GitHub 后可以直接在网页上写文章、改站点资料，不用重新写代码，也不用本地环境。**

---

## 一、三步上线

### 1. 建仓库
在 GitHub 新建一个**公开**仓库，名字随便（比如 `bedrock-blog`），把本文件夹里所有内容传上去。

### 2. 改一行配置
打开 `assets/js/config.js`，改最上面这三行：

```js
owner:  '你的GitHub用户名',   // 例如 'chenqian2026'
repo:   'bedrock-blog',       // 你的仓库名
branch: 'main',               // main 或 master
```

### 3. 开启 GitHub Pages
仓库 → **Settings → Pages** → Source 选 `Deploy from a branch` → Branch 选 `main` / `/(root)` → Save。

等 1–2 分钟，访问 `https://<用户名>.github.io/<仓库名>/` 就能看到站点。

> 仓库必须**公开**，否则未登录访客读不到 `content/posts.json`。

---

## 二、怎么在线写文章（核心功能）

### 方式 A：Token 登录（推荐，零后端，5 分钟搞定）

1. GitHub → 头像 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. 设置：
   - Token name：随便，比如 `bedrock-blog`
   - Repository access：**Only select repositories** → 选你这个博客仓库
   - Permissions → Repository permissions → **Contents: Read and write**
3. 生成后复制（只显示一次）
4. 打开你的博客 → 右上角 **登录** → 粘贴 → 勾选「记住我」→ 验证登录

登录成功后右上角会出现 **「创作台」**，点进去：

- **新建文章** → 填标题、标签、摘要 → 正文写 Markdown（右侧实时预览）→ **保存到 GitHub**
- 保存后：你的浏览器里**立刻**能看到新文章；GitHub Pages 会在 **1–2 分钟**后把新版本发布给所有人
- 想确认线上是否更新了，点创作台的 **「检查部署」**

> 判断是不是"你"：登录后前端会比对 GitHub 用户名是否等于 `config.js` 里的 `owner`。
> 一致 = 作者，可写；不一致 = 访客，只能浏览和评论。

### 方式 B：OAuth 登录（点一下就登录，可选）

Token 会过期、要手抄。想更顺手就配一个 Cloudflare Worker（免费）：

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Homepage URL：`https://<用户名>.github.io/<仓库名>/`
   - Authorization callback URL：`https://<用户名>.github.io/<仓库名>/oauth.html`
2. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create Worker → 把 `workers/oauth-proxy.js` 的内容粘进去 → Deploy
   - Settings → Variables，加两个 **Encrypt** 变量：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`
3. 把 Client ID 和 Worker 域名填进 `config.js`：

```js
oauth: {
  clientId: 'Iv1.xxxxxxxxxx',
  workerUrl: 'https://bedrock-oauth.你的名字.workers.dev'
}
```

之后在登录弹窗里点「OAuth 登录」即可一键授权。

### 方式 C：完全不想登录
直接在 GitHub 网页上编辑 `content/posts.json`（JSON 格式），保存即生效。创作台的「导出」按钮会给你一份可以直接覆盖上去的文件。

---

## 三、访客评论怎么开

默认评论存在访客自己的浏览器里（页面上有明确标注）。想让评论**公开、永久、可互相回复**，用 Giscus（基于 GitHub Discussions，免费）：

1. 仓库 → **Settings → General → Features** → 勾选 **Discussions**
2. 打开 [giscus.app/zh-CN](https://giscus.app/zh-CN)，填你的仓库，页面会生成一段配置
3. 把里面的 `data-repo-id` 和 `data-category-id` 抄进 `config.js`：

```js
giscus: {
  enabled: true,
  repoId: 'R_kgDOxxxxxx',
  categoryId: 'DIC_kwDOxxxxxx',
  ...
}
```

访客用 GitHub 账号就能评论，评论存在你的仓库 Discussions 里，你还能在 GitHub 上直接管理/删除。

---

## 四、本地预览

GitHub API 不允许从 `file://` 调用，所以别直接双击 `index.html`，起个本地服务：

```bash
cd bedrock-blog
python -m http.server 8000
# 打开 http://localhost:8000
```

本地预览时文章读的是 `content/posts.json`（仓库文件），改它刷新即可。

---

## 五、文件结构

```
bedrock-blog/
├── index.html              # 单页应用外壳（导航 / 弹窗 / 页脚）
├── 404.html                # SPA 兜底
├── oauth.html              # OAuth 回调页
├── feed.json               # JSON Feed 订阅源（tools/gen-posts.js 生成）
├── assets/
│   ├── css/style.css       # 新丑风设计系统：硬边框/硬投影/波点/贴纸/按压
│   └── js/
│       ├── config.js       # ★ 唯一需要你改的配置文件
│       ├── github.js       # GitHub 认证 + Contents API 读写
│       ├── store.js        # 文章/评论/留言数据层 + 本地覆盖层
│       ├── ui.js           # 各板块视图渲染
│       ├── editor.js       # 创作台 + Markdown 编辑器
│       └── app.js          # 路由 / 事件 / 初始化
├── content/
│   ├── posts.json          # ★ 文章数据库（作者保存时会 commit 这个文件）
│   └── site.json           # 站点资料（昵称、简介、项目、友链）
├── tools/gen-posts.js      # 重新生成 posts.json / feed.json
└── workers/oauth-proxy.js  # Cloudflare Worker（OAuth 用，可选）
```

---

## 六、设计规格（已实现）

| 要求 | 实现 |
| --- | --- |
| Tailwind CSS + Remix Icon | CDN 引入，Tailwind 配置内联扩展了碰撞色板 |
| Space Grotesk / Archivo Black | Google Fonts 引入；中文标题自动 fallback 到 Noto Sans SC 900，`font-black` |
| #FFFDF0 底色 + 20px 纯黑波点 | `radial-gradient` 波点，20px 网格，`background-attachment: fixed` |
| 2–3px 纯黑硬边框 | `.nb-card` / `.nb-btn` / `.nb-input` 统一 3px |
| 硬投影（零模糊） | `box-shadow: 6px 6px 0 0 #000`，hover 加深到 9px |
| 碰撞色 | 薄荷绿 #A3E635 / 活力紫 #C084FC / 亮黄 #FDE047 / 天空蓝 #38BDF8 |
| 贴纸徽章随机旋转 | `.sticker` 用 `--r` 变量，-2deg ~ 2.5deg 随机，hover 回正放大 |
| 按压交互 | hover 右下移 2px + 阴影缩到 2px；active 移 4px + 阴影归 0 |
| 卡片 hover 反向位移 | `translate(-2px,-2px)` + 阴影加深 |
| 移动端不溢出 | `body{overflow-x:hidden}`，≤640px 时阴影降到 3–4px，位移同步缩小 |

---

## 七、常见问题

**Q：保存后别人看不到新文章？**
A：GitHub Pages 有 1–2 分钟构建延迟。你自己的浏览器里因为有"本地覆盖层"会立刻显示。点创作台的「检查部署」可以确认线上是否就绪。

**Q：提交失败：409 Conflict / sha 不对？**
A：说明仓库里的文件被别处改过（比如你在 GitHub 网页上编辑过）。点创作台的「从 GitHub 重新拉取」，再保存一次。

**Q：Token 安全吗？**
A：Token 只存在你自己的浏览器 localStorage 里，不会上传到任何第三方。建议用 **fine-grained token 且只授权这一个仓库**，勾选"记住我"时有效期 30 天。在公用电脑上别勾。

**Q：能换头像吗？**
A：`config.js` 里 `site.avatar` 改成图片路径（比如放一张 `assets/avatar.png`）。

**Q：想改配色？**
A：`assets/css/style.css` 顶部的 `:root` 变量，和 `index.html` 里 Tailwind 的 `colors` 配置，改这两处即可。

**Q：文章支持什么格式？**
A：正文是 Markdown，支持代码块高亮、表格、引用、任务列表。图片用 `![](/assets/xxx.png)` 即可。
