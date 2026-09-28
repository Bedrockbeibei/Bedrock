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

## 三、访客评论怎么开（Giscus）

默认评论存在访客自己的浏览器里（页面上会明确标注）。想让评论**公开、永久、可互相回复**，用 Giscus——它把评论存在你仓库的 Discussions 里，免费，你还能在 GitHub 上直接删评论。

### 三个前置条件（缺一不可）

| 条件 | 在哪里弄 |
| --- | --- |
| 仓库是 **Public** | 私有仓库 Giscus 读不到 |
| 仓库开启了 **Discussions** | 仓库 → Settings → General → Features → 勾选 Discussions |
| 你的 Token 有 **Discussions** 权限 | Token 设置页 → Repository permissions → Discussions: Read and write |

### 推荐做法：在网页上点两下（不用改代码）

1. 打开你的博客 → 右上角 **登录**（作者身份）
2. 进入 **创作台** → 找到 **「评论设置」** 区块
3. 点 **「检测我的仓库并自动填 ID」**
   - 页面会自动调 GitHub API 检查上面三个条件
   - **缺哪一样，它会明确告诉你去哪里点**（比如"仓库还没开启 Discussions → Settings → Features → 勾选"）
   - 全部满足后，Repo ID 和 Category ID 会自动填进输入框
4. 确认分类（一般用 **Announcements**）→ 勾选「启用 Giscus 评论」
5. 点 **「保存并提交到 GitHub」** → 等 1–2 分钟 Pages 重建，评论区上线

> 配置写在 `content/site.json` 里，属于数据文件，所以全程不用碰代码。

### 手动做法（不想登录时）

1. 打开 [giscus.app/zh-CN](https://giscus.app/zh-CN)，填你的仓库（`<用户名>/<仓库名>`）
2. 页面底部会生成一段配置代码，抄里面的 `data-repo-id` 和 `data-category-id`
3. 粘进 `assets/js/config.js`：

```js
giscus: {
  enabled: true,
  repoId: 'R_kgDOxxxxxx',
  categoryId: 'DIC_kwDOxxxxxx',
  category: 'Announcements'
}
```

> 优先级：`content/site.json` 里的配置 > `config.js`。也就是说创作台里改完，会覆盖这里的值。

### 常见问题

- **点了检测提示"Token 权限不够"** → 去 Token 页面加 **Discussions: Read and write**，然后退出登录重新用新 Token 登录一次（旧 Token 的权限不会自动更新到已登录状态）。
- **评论区显示不出来** → 检查 Discussions 是否真的开启了；另外仓库刚开启 Discussions 时可能要等几分钟。
- **想换回本地评论** → 创作台里把「启用 Giscus 评论」的勾去掉，再提交一次。

---

## 四、访问统计怎么开（真实 PV，不是装饰）

本站的方案：**GoatCounter 采集 → GitHub Actions 定时拉回 → 写进 `content/stats.json` → 网页读它**。

选它的三个理由：免费且没有月活限制、不用挂 Cookie 同意横幅、**数据最终落在你自己的仓库里**而不是躺在别人服务器上。

几个常见选择的对比：

| 方案 | 优点 | 缺点 | 什么时候选 |
| --- | --- | --- | --- |
| **GoatCounter** | 免费、无 Cookie、可导出、数据回自己仓库 | 服务器在欧盟，偶尔慢一点 | **默认推荐** |
| 不蒜子 | 国内 CDN 快、不用注册 | 数据在对方服务器；单页应用下计数不准 | 只想看个热闹 |
| Google Analytics | 功能最强 | 国内加载常被卡住、必须挂 Cookie 同意 | 面向海外读者 |
| 百度统计 | 国内快、功能全 | 脚本重、要挂同意声明 | 已备案的商业站 |

### 为什么要绕这一圈，不直接在网页里读 API？

因为读统计数据的 API 必须带**密钥**，而网页上的任何东西按 F12 都能看见——那等于把家门钥匙插在锁孔上。所以分工是这样：

| 环节 | 在哪里跑 | 有没有密钥 |
| --- | --- | --- |
| 上报一次浏览 | 访客的浏览器 | 不需要，用的是公开的 count.js |
| 拉取汇总数据 | GitHub Actions（服务器） | 有，存在仓库 Secret 里 |
| 展示这些数据 | 访客的浏览器 | 没有，读的只是一个普通 JSON |

### 四步配好

**第 1 步：注册 GoatCounter，拿站点代号**

1. 打开 https://www.goatcounter.com → 右上角 `Sign up`，邮箱注册
2. 登录后点 `Add site`，网址填你的博客地址，一路下一步
3. **关键**：记下它给你的地址，形如 `https://bedrock.goatcounter.com` —— 中间那段 **`bedrock`** 就是站点代号

**第 2 步：拿 API 密钥**

站点左侧菜单 `Settings → API`（有的版本在右上角头像菜单里）→ `Create new API key`，
权限只勾 **`Read statistics`**（只读统计）就够，别多勾。复制那串字符，下一步马上要用。

**第 3 步：把密钥藏进仓库**

GitHub 仓库 → `Settings` → 左侧 `Secrets and variables` → `Actions` → `New repository secret`，加两条：

| Name | Secret |
| --- | --- |
| `GC_SITE` | `bedrock` ← 第 1 步的站点代号 |
| `GC_API_KEY` | 第 2 步复制的那串密钥 |

Secret 保存之后就再也看不到明文了，只能覆盖——这正说明它真的藏住了。

**第 4 步：上传定时任务，手动跑一次**

1. 把本项目的 `.github/workflows/stats.yml` 传到仓库。
   GitHub 网页上传时，在文件名框里**直接输入** `.github/workflows/stats.yml`，它会自动帮你建好两层目录。
2. 仓库 `Actions` 页面 → 左侧点 `同步访问统计` → 右侧 `Run workflow` → 绿色的 Run
3. 等半分钟左右，出现绿色对勾
4. 回博客 → 右上角登录 → 创作台 → 拉到「访问统计」→ 点「检查数据是否回流」

看到绿色区块「数据已回流」就通了。第一次通常是 0 次访问，因为还没人访问过。

### 配好之后能看到什么

- 首页最下方多一块「站点数据」：累计访问、最近 14 天柱状图、访客来自哪些地区、最受欢迎的文章
- 每篇文章卡片右下角出现眼睛图标 + 浏览量
- 首屏右侧「文章 / 标签 / 项目」三宫格下面，多一条累计访问

默认的同步频率是**每 6 小时一次**（UTC 的 0:23 / 6:23 / 12:23 / 18:23）。想立刻更新，去 Actions 手动 Run 一次。

### 常见问题

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| 一直显示「读不到统计文件」 | 定时任务还没跑成功 | Actions 页面看那条运行记录是不是红的 |
| 文件有了但显示 0 次访问 | 链路通了，只是没采到浏览 | **注意：你自己本地预览的刷新是故意不计数的**（代码里屏蔽了，免得虚高）。用手机流量打开网址点两个页面，再等下一次同步 |
| Actions 页面是空的 | workflow 没传上去，或 Actions 被关了 | Settings → Actions → General → 选 Allow all actions |
| 想换回本地/不蒜子 | — | 创作台「访问统计」里改「服务商」，`busuanzi` 是国内备选 |

---

## 五、本地预览

GitHub API 不允许从 `file://` 调用，所以别直接双击 `index.html`，起个本地服务：

```bash
cd bedrock-blog
python -m http.server 8000
# 打开 http://localhost:8000
```

本地预览时文章读的是 `content/posts.json`（仓库文件），改它刷新即可。

---

## 六、文件结构

```
bedrock-blog/
├── index.html              # 单页应用外壳（导航 / 弹窗 / 页脚）
├── 404.html                # SPA 兜底
├── oauth.html              # OAuth 回调页
├── feed.json               # JSON Feed 订阅源（tools/gen-posts.js 生成）
├── .github/workflows/
│   └── stats.yml           # 每 6 小时拉一次统计，写回 content/stats.json
├── assets/
│   ├── css/style.css       # 新丑风设计系统：硬边框/硬投影/波点/贴纸/按压
│   └── js/
│       ├── config.js       # ★ 唯一需要你改的配置文件
│       ├── github.js       # GitHub 认证 + Contents API 读写
│       ├── store.js        # 文章/评论/留言数据层 + 本地覆盖层
│       ├── analytics.js    # 访问统计：上报浏览 + 读 content/stats.json
│       ├── ui.js           # 各板块视图渲染
│       ├── editor.js       # 创作台 + Markdown 编辑器
│       └── app.js          # 路由 / 事件 / 初始化
├── content/
│   ├── posts.json          # ★ 文章数据库（作者保存时会 commit 这个文件）
│   ├── site.json           # 站点资料（昵称、简介、项目、友链，评论/统计配置也写在这）
│   └── stats.json          # 访问统计（由 Actions 定时写入，不用你管）
├── tools/
│   ├── gen-posts.js        # 重新生成 posts.json / feed.json
│   ├── fetch-stats.js      # 拉 GoatCounter 数据（Actions 里跑，也可本地跑）
│   └── smoke.js            # jsdom 冒烟测试
└── workers/oauth-proxy.js  # Cloudflare Worker（OAuth 用，可选）
```

---

## 七、设计规格（已实现）

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

## 八、常见问题

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
