/* 生成 content/posts.json 与 feed.json（内容改动后重新运行：node tools/gen-posts.js） */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const posts = [
  {
    id: 'demo-1',
    slug: 'why-bedrock-on-github',
    title: '为什么我把博客建在 GitHub 上，而不是买服务器',
    excerpt: '零成本、零运维、文章就是数据文件。这篇讲清楚这套「静态站 + GitHub 当后端」的思路是怎么跑通的。',
    tags: ['折腾', 'GitHub Pages', '前端'],
    color: '#A3E635',
    status: 'published',
    pinned: true,
    createdAt: '2026-09-20T10:00:00+08:00',
    updatedAt: '2026-09-22T21:30:00+08:00',
    body: `# 结论先说

博客 = 一堆**纯静态文件** + 一个 **JSON 数据文件**。GitHub Pages 负责渲染，GitHub API 负责写入。中间没有任何服务器。

## 这套方案解决什么

- **不用重装环境**：手机上打开网页，登录后就能写文章
- **不用改代码**：文章存在 \`content/posts.json\`，我只改数据，不改 HTML
- **不花钱**：Pages 免费，CDN 免费，API 免费
- **别人评论**：走 Giscus，评论落在仓库的 Discussions 里，永久保存

## 写入是怎么发生的

1. 我在网页上用 GitHub 身份登录（Token 或 OAuth）
2. 写完点「保存到 GitHub」
3. 前端调用 Contents API，把新的 posts.json 提交成一个 commit
4. Pages 检测到仓库变化，1–2 分钟后自动重新部署

\`\`\`js
PUT /repos/{owner}/{repo}/contents/content/posts.json
{ message: "post: 文章标题", content: base64(json), sha: 上一个版本的sha }
\`\`\`

> 关键点：\`sha\` 不能错。它代表你要覆盖的文件版本，错了会 409 冲突——这是 GitHub 防止多人同时改同一个文件的机制。

## 代价是什么

诚实地说：**部署有延迟**。写完不是立刻全网可见，要等 Pages 构建。所以本站做了「本地覆盖层」——保存后你自己的浏览器立刻能看到新文章，其他人等 1–2 分钟。

下一篇打算写：怎么给这个站接上真实的访问统计。`
  },
  {
    id: 'demo-2',
    slug: '51-mcu-first-led',
    title: '51 单片机第一课：点亮一个 LED 的完整清单',
    excerpt: '不谈寄存器原理，只给能跑的东西：接线、烧录、预期现象、失败排查。普中 HC6800-ES V2.0 + STC89C52 实测。',
    tags: ['嵌入式', '51 单片机', '硬件'],
    color: '#38BDF8',
    status: 'published',
    pinned: false,
    createdAt: '2026-09-15T14:00:00+08:00',
    updatedAt: '2026-09-18T09:10:00+08:00',
    body: `# 先看结果

目标：让板子上的 **LED 模块**以大约 0.5 秒的节奏闪烁。做完这一步，你就验证了「这套工具链是通的」。

## 你需要的三样东西

| 东西 | 说明 |
| --- | --- |
| Keil uVision | 写代码 + 生成 \`.hex\` |
| STC-ISP | 把 \`.hex\` 烧进芯片 |
| 开发板 + USB 线 | 普中 HC6800-ES V2.0 |

## 接线

- 用**排线**把 LED 模块（\`JP\`）接到单片机的 \`P2\` 口，注意 \`VCC\` 对 \`VCC\`、\`GND\` 对 \`GND\`
- 如果手里只有杜邦线，就一根一根接：\`P2.0 → D1\`

## 最小可跑的代码

\`\`\`c
#include <REGX52.H>
#include <INTRINS.H>

void Delay500ms(void){
    unsigned char i, j, k;
    _nop_();
    i = 4; j = 129; k = 119;
    do { do { while (--k); } while (--j); } while (--i);
}

void main(void){
    while (1) {
        P2 = 0xFE;   // 1111 1110 → 只点亮 D1
        Delay500ms();
        P2 = 0xFF;   // 全灭
        Delay500ms();
    }
}
\`\`\`

## 烧录步骤（照做即可）

1. Keil 里 \`Options for Target → Output → 勾选 Create HEX File\`，然后 Rebuild
2. 打开 STC-ISP，芯片型号选 **STC89C52RC**
3. 串口号选带 \`USB-SERIAL CH340\` 的那个
4. 打开程序文件，选刚生成的 \`.hex\`
5. **先点下载，再给板子上电**（这一步顺序不能反）

## 预期现象

最左边那颗 LED 开始以约 0.5 秒的节奏闪烁。

## 不亮怎么办

- 排线方向反了 → 换一头试试
- 跳线帽没接 → LED 模块的使能跳线要短接
- 串口识别不到 → 换 USB 口，或装 CH340 驱动
- 一直提示「正在检测目标单片机」→ 断电后重新点下载再上电

> 一句话总结：嵌入式入门最大的坑不是代码，是**接线和烧录顺序**。`
  },
  {
    id: 'demo-3',
    slug: 'freshman-roadmap-ai',
    title: '大一选方向：AI / 数据科学要打的地基清单',
    excerpt: '信息科学技术类大一，想往 AI 走，到底先学什么？一份按优先级排序的地基清单，附带我自己的进度。',
    tags: ['成长', 'AI', '学习方法'],
    color: '#FDE047',
    status: 'published',
    pinned: false,
    createdAt: '2026-09-08T20:00:00+08:00',
    updatedAt: '2026-09-12T17:45:00+08:00',
    body: `# 先把话说狠一点

大部分人不是倒在「模型看不懂」，是倒在**数学基础 + 代码能力**这两块地基上。

## 优先级排序

### 1. Python（先到能写项目的程度）

不要再看语法教程了。直接拿一个数据集做清洗、画图、跑统计。

\`\`\`python
import pandas as pd
df = pd.read_csv("grades.csv")
print(df.describe())
print(df.groupby("class")["score"].mean().sort_values())
\`\`\`

### 2. 线性代数 + 概率统计

- 矩阵乘法、特征值：理解「模型在做什么」的最小集
- 概率分布、期望方差：理解「模型为什么这么评估」

### 3. 机器学习基础

从线性回归、逻辑回归开始，**手推一遍公式**，再用 sklearn 复现。

### 4. 才是深度学习

### 5. 工程能力

Git、Linux 基础、能把自己的东西部署出去让人看到（比如这个博客）。

## 我的当前进度

- [x] 阿里巴巴达摩院「人工智能训练师（初级）」认证
- [x] Python 基础 → Pandas 数据处理
- [ ] 线性代数系统复习
- [ ] 第一个完整的 ML 项目

## 一条建议

> 每学一样东西，就**产出一个能给别人看的东西**。

这个博客就是我的「产出」。它逼着我把学的东西讲清楚——讲不清楚，就是没学懂。`
  }
];

const payload = {
  version: 1,
  updatedAt: new Date().toISOString(),
  posts
};

fs.mkdirSync(path.join(root, 'content'), { recursive: true });
fs.writeFileSync(path.join(root, 'content', 'posts.json'), JSON.stringify(payload, null, 2), 'utf8');

const feed = {
  version: 'https://jsonfeed.org/version/1.1',
  title: '沉潜·Bedrock 个人博客',
  description: '记录一个信息科学技术类大一学生的硬核成长路径。',
  language: 'zh-CN',
  items: posts.map(p => ({
    id: p.id,
    title: p.title,
    summary: p.excerpt,
    tags: p.tags,
    date_modified: p.updatedAt,
    url: '#/post/' + p.slug
  }))
};
fs.writeFileSync(path.join(root, 'feed.json'), JSON.stringify(feed, null, 2), 'utf8');

console.log('OK: content/posts.json (' + posts.length + ' posts), feed.json');
