#!/usr/bin/env node
/* ------------------------------------------------------------------
 * 抓取 GoatCounter 的访问统计，生成 content/stats.json
 *
 * 为什么要绕这一圈？
 *   前端不能持有 GoatCounter 的 API key（等于把钥匙挂在门口）。
 *   所以：这里在 GitHub Actions 里跑，key 存在仓库 Secret 里，
 *   拉到的数据写回 content/stats.json —— 前端就像读 posts.json 一样读它。
 *   于是「真实统计」变成你仓库里的一个普通数据文件，永远是你的。
 *
 * 用法：
 *   node tools/fetch-stats.js
 *
 * 环境变量：
 *   GC_SITE     站点地址，如 bedrock.goatcounter.com（带不带 https:// 都行）
 *   GC_API_KEY  GoatCounter API key（需 read statistics 权限）
 *   GC_DAYS     趋势图取最近多少天，默认 14
 *   GC_OUT      输出文件路径，默认 content/stats.json
 * ------------------------------------------------------------------ */

'use strict';
const fs = require('fs');
const path = require('path');

const SITE = String(process.env.GC_SITE || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
const KEY = String(process.env.GC_API_KEY || '').trim();
const DAYS = Math.max(1, Math.min(60, parseInt(process.env.GC_DAYS || '14', 10) || 14));
const OUT = path.join(process.cwd(), String(process.env.GC_OUT || 'content/stats.json'));

if (!SITE || !KEY) {
  console.error('× 缺少环境变量。需要 GC_SITE 和 GC_API_KEY。');
  console.error('  例如：GC_SITE=bedrock.goatcounter.com GC_API_KEY=xxx node tools/fetch-stats.js');
  process.exit(1);
}

const BASE = 'https://' + SITE + '/api/v0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// GoatCounter 的时间格式：2026-01-02T15:04:05Z
function fmt(d) { return new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function dayStr(d) { return new Date(d).toISOString().slice(0, 10); }

/* 带重试的请求。官方限速是 4 次/秒，被限就退一秒再来。 */
async function api(p) {
  const url = BASE + p;
  let last = '';
  for (let i = 0; i < 5; i++) {
    let res;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: 'Bearer ' + KEY,
          'Content-Type': 'application/json',
          'User-Agent': 'bedrock-blog-stats/1.0'
        }
      });
    } catch (e) {
      last = e.message; await sleep(2000); continue;
    }
    if (res.status === 429) { await sleep(2000); continue; }
    const text = await res.text();
    if (!res.ok) throw new Error(url + ' → HTTP ' + res.status + ' ' + text.slice(0, 240));
    try { return JSON.parse(text); } catch (e) {
      throw new Error(url + ' 返回的不是 JSON：' + text.slice(0, 240));
    }
  }
  throw new Error(url + ' 连续失败（限速？）' + (last ? '：' + last : ''));
}

/* GoatCounter 不同版本的字段名不完全一致，这里做宽容取值。 */
function num(v) {
  if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
  const n = parseInt(v, 10);
  return isFinite(n) ? Math.max(0, n) : 0;
}
function pick(o, keys) {
  if (!o || typeof o !== 'object') return 0;
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) {
      const n = num(o[k]);
      if (n > 0) return n;
    }
  }
  return 0;
}
function pickStr(o, keys) {
  if (!o || typeof o !== 'object') return '';
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && String(o[k]).length) return String(o[k]);
  }
  return '';
}

/* 把 API 返回的明细列表转成 [ {name, pv} ] */
function toList(data, limit) {
  const raw = Array.isArray(data) ? data : (data && Array.isArray(data.stats) ? data.stats : []);
  return raw.slice(0, limit).map(function (it) {
    return { name: pickStr(it, ['name', 'Name', 'path', 'Path', 'title']) || '未知', pv: pick(it, ['count', 'Count', 'count_unique']) };
  }).filter(function (x) { return x.pv > 0; });
}

async function main() {
  const now = new Date();
  const end = fmt(now);
  const begin = fmt(new Date(Date.UTC(2000, 0, 1)));

  console.log('· 站点：' + SITE);

  // 1) 全站累计：hits 端点的 total 就是该区间全部 PV
  let totalPv = 0;
  let topRaw = null;
  try {
    topRaw = await api('/stats/hits?limit=100&start=' + begin + '&end=' + end);
    totalPv = pick(topRaw, ['total', 'Total']);
  } catch (e) {
    console.warn('! 取全站累计失败：' + e.message);
  }

  // 2) 每页浏览量 + 标题
  const paths = {};
  const rows = (topRaw && Array.isArray(topRaw.hits)) ? topRaw.hits : [];
  rows.forEach(function (r) {
    const p = pickStr(r, ['path', 'Path']);
    if (!p) return;
    paths[p] = { pv: pick(r, ['count', 'Count']), title: pickStr(r, ['title', 'Title']) };
  });
  console.log('· 页面数：' + Object.keys(paths).length + '，累计 PV：' + totalPv);

  // 3) 最近 N 天趋势（每天单独取一次，节流间隔 300ms）
  const daily = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const s = fmt(d);
    const e = fmt(new Date(d.getTime() + 86399999));
    let n = 0;
    try {
      const r = await api('/stats/hits?limit=1&start=' + s + '&end=' + e);
      n = pick(r, ['total', 'Total']);
    } catch (err) {
      console.warn('! ' + dayStr(d) + ' 取失败：' + err.message);
    }
    daily.push({ day: dayStr(d), pv: n });
    if (i > 0) await sleep(300);
  }
  console.log('· 趋势已取 ' + daily.length + ' 天');

  // 4) 来源 / 地区 / 浏览器
  const dims = {};
  for (const key of ['toprefs', 'locations', 'browsers']) {
    try {
      const r = await api('/stats/' + key + '?limit=8&start=' + begin + '&end=' + end);
      dims[key] = toList(r, 8);
    } catch (e) {
      console.warn('! ' + key + ' 取失败：' + e.message);
      dims[key] = [];
    }
    await sleep(300);
  }

  const out = {
    updatedAt: now.toISOString(),
    provider: 'goatcounter',
    site: SITE,
    dashboard: 'https://' + SITE,
    total: totalPv,
    days: DAYS,
    paths: paths,
    daily: daily,
    toprefs: dims.toprefs || [],
    locations: dims.locations || [],
    browsers: dims.browsers || []
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('✓ 已写入 ' + path.relative(process.cwd(), OUT) + '（累计 PV ' + totalPv + '）');
}

main().catch(function (e) {
  console.error('× 失败：' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
