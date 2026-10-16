/* 从 content/posts.json 重新生成 feed.json（RSS/JSON 订阅源）
   用法：node tools/gen-posts.js
   说明：本工具只读 posts.json、只写 feed.json。
   早期版本会把内置的演示文章写回 posts.json——那会覆盖你真实文章，
   该行为已移除。文章请用博客创作台保存，或直接编辑 content/posts.json。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const postsPath = path.join(root, 'content', 'posts.json');
const feedPath = path.join(root, 'feed.json');

if (!fs.existsSync(postsPath)) {
  console.error('× 找不到 content/posts.json，先确认你在博客项目目录里运行。');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
} catch (e) {
  console.error('× content/posts.json 不是合法 JSON：' + e.message);
  process.exit(1);
}

const SITE_URL = 'https://bedrockbeibei.github.io/Bedrock/';

const posts = (Array.isArray(data.posts) ? data.posts : []).filter(p => p && p.title);

// 同一标题只保留 updatedAt 最新的一条。
// 旧版编辑器在 slug 为空时会用标题当中文网址存一份，用户改用英文网址后又存一份，
// 导致同一篇文章在 posts.json 里留两份（站点首页和订阅源都会出现重复文章）。
const latest = new Map();
for (const p of posts) {
  const key = String(p.title).trim();
  const prev = latest.get(key);
  if (!prev || new Date(p.updatedAt || p.createdAt || 0) > new Date(prev.updatedAt || prev.createdAt || 0)) {
    latest.set(key, p);
  }
}
const deduped = [...latest.values()];

const published = deduped
  .filter(p => p.status !== 'draft')   // 草稿不进公开订阅源
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const feed = {
  version: 'https://jsonfeed.org/version/1.1',
  title: '沉潜·Bedrock 个人博客',
  description: '记录一个信息科学技术类大一学生的硬核成长路径。',
  language: 'zh-CN',
  home_page_url: SITE_URL,
  feed_url: SITE_URL + 'feed.json',
  items: published.map(p => ({
    id: SITE_URL + '#/post/' + p.slug,
    url: SITE_URL + '#/post/' + p.slug,
    title: p.title,
    summary: p.excerpt || '',
    tags: p.tags || [],
    date_published: p.createdAt || p.updatedAt,
    date_modified: p.updatedAt || p.createdAt
  }))
};

fs.writeFileSync(feedPath, JSON.stringify(feed, null, 2) + '\n', 'utf8');
const dupCount = posts.length - deduped.length;
console.log('OK: feed.json（' + feed.items.length + ' 篇，来自 content/posts.json；草稿 ' + (deduped.length - published.length) + ' 篇未计入' + (dupCount ? '；去除重复文章 ' + dupCount + ' 篇' : '') + '）');
