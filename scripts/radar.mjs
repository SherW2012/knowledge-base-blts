import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const cfg = JSON.parse(await readFile(path.join(root, "radar/config.json"), "utf8"));
const sources = JSON.parse(await readFile(path.join(root, "radar/sources.json"), "utf8"));
const now = new Date();
const day = dateKey(now);
const dirs = {
  data: path.join(root, "radar-data"),
  archive: path.join(root, "radar-data/archive"),
  daily: path.join(root, "前沿部/AI情报雷达/日报"),
  weekly: path.join(root, "前沿部/AI情报雷达/周报")
};
await Promise.all(Object.values(dirs).map((dir) => mkdir(dir, { recursive: true })));

const active = sources.filter((s) => s.enabled !== false);
const automated = active.filter((s) => s.kind !== "manual");
const manual = active.filter((s) => s.kind === "manual");
console.log(`[radar] ${day}: ${automated.length} automated + ${manual.length} manual sources`);

const scans = await mapLimit(automated, 6, async (source) => {
  try {
    const items = await collect(source);
    console.log(`[radar] ✓ ${source.name}: ${items.length}`);
    return { run: run(source, "ok", items.length), items };
  } catch (error) {
    console.warn(`[radar] ✗ ${source.name}: ${error.message}`);
    return { run: { ...run(source, "error", 0), error: String(error.message).slice(0, 220) }, items: [] };
  }
});

const sourceRuns = scans.map((x) => x.run).concat(manual.map((s) => run(s, "manual", 0)));
const collected = scans.flatMap((x) => x.items);
const cutoff = now.getTime() - cfg.lookbackHours * 3600_000;
const recent = collected.filter((x) => !Date.parse(x.publishedAt) || Date.parse(x.publishedAt) >= cutoff);
const deduped = dedupe(recent);
const clustered = cluster(deduped);
const analyzed = await analyze(clustered);
const items = analyzed
  .map((x) => ({ ...x, radarScore: score(x) }))
  .sort((a, b) => b.radarScore - a.radarScore)
  .slice(0, cfg.topK);

const payload = {
  schemaVersion: 1,
  status: items.length ? "ok" : "empty",
  generatedAt: now.toISOString(),
  date: day,
  timezone: cfg.timezone,
  llm: {
    enabled: Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL),
    provider: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || null
  },
  stats: {
    configuredSources: active.length,
    automatedSources: automated.length,
    manualSources: manual.length,
    successfulSources: sourceRuns.filter((x) => x.status === "ok").length,
    failedSources: sourceRuns.filter((x) => x.status === "error").length,
    scannedItems: collected.length,
    recentItems: recent.length,
    dedupedItems: deduped.length,
    eventClusters: clustered.length,
    publishedItems: items.length
  },
  sourceRuns,
  sources: active.map(({ id, name, tier, kind, url, tags }) => ({ id, name, tier, kind, url: url || null, tags: tags || [] })),
  items
};

const latest = path.join(dirs.data, "latest.json");
if (items.length >= cfg.minimumItemsToPublish || !(await exists(latest))) {
  await writeJson(latest, payload);
  await writeJson(path.join(dirs.archive, `${day}.json`), payload);
  await writeFile(path.join(dirs.daily, `${day}.md`), dailyMarkdown(payload), "utf8");
  console.log(`[radar] published ${items.length} items`);
} else {
  await writeJson(path.join(dirs.data, "last-run.json"), payload);
  console.warn(`[radar] only ${items.length} items; previous latest.json kept`);
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: cfg.timezone }).format(now);
if (process.argv.includes("--weekly") || weekday === "Mon") await writeWeekly();

function run(source, status, count) {
  return { id: source.id, name: source.name, tier: source.tier, kind: source.kind, status, items: count };
}

async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function writeJson(file, data) { await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8"); }

function dateKey(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: cfg.timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function mapLimit(values, limit, worker) {
  const out = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= values.length) return;
      out[i] = await worker(values[i], i);
    }
  }));
  return out;
}

async function request(url, json = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "BLTS-AI-Radar/1.0", accept: "application/rss+xml, application/atom+xml, application/json, */*" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return json ? res.json() : res.text();
  } finally { clearTimeout(timer); }
}

async function collect(source) {
  if (source.kind === "feed") return feed(source, source.url);
  if (source.kind === "arxiv") {
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", source.query);
    url.searchParams.set("max_results", String(cfg.arxivMaxResults));
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");
    return feed(source, url.toString());
  }
  if (source.kind === "hackernews") return hackerNews(source);
  return [];
}

async function feed(source, url) {
  const xml = await request(url);
  const rss = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const atom = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  const blocks = rss.length ? rss : atom;
  if (!blocks.length) throw new Error("feed parsed 0 entries");
  return blocks.slice(0, cfg.maxPerSource).map((block) => normalize({
    title: tag(block, "title"),
    url: canonical(tag(block, "link") || atomLink(block) || tag(block, "guid") || tag(block, "id")),
    publishedAt: tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"),
    description: rawTag(block, "content:encoded") || rawTag(block, "content") || rawTag(block, "description") || rawTag(block, "summary"),
    source
  })).filter((x) => x.title && x.url);
}

async function hackerNews(source) {
  const ids = await request(source.url, true);
  const top = Array.isArray(ids) ? ids.slice(0, cfg.hackerNewsTopN) : [];
  const stories = [];
  for (let i = 0; i < top.length; i += 10) {
    const batch = await Promise.all(top.slice(i, i + 10).map((id) =>
      request(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, true).catch(() => null)
    ));
    for (const x of batch) {
      if (!x?.title || x.type !== "story" || !aiRelevant(`${x.title} ${x.text || ""}`)) continue;
      stories.push(normalize({
        title: x.title,
        url: canonical(x.url || `https://news.ycombinator.com/item?id=${x.id}`),
        publishedAt: new Date((x.time || 0) * 1000).toISOString(),
        description: `Hacker News: ${x.score || 0} points · ${x.descendants || 0} comments`,
        engagement: { score: x.score || 0, comments: x.descendants || 0 },
        source
      }));
    }
  }
  return stories.slice(0, cfg.maxPerSource);
}

function decode(value = "") {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== "#") return named[e.toLowerCase()] ?? m;
    const hex = e[1]?.toLowerCase() === "x";
    const n = parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}
function strip(value = "") {
  return decode(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function tag(block, name) {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return strip(block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, "i"))?.[1] || "");
}
function rawTag(block, name) {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, "i"))?.[1] || "";
}
function atomLink(block) {
  for (const m of block.matchAll(/<link\b([^>]*)\/?>/gi)) {
    const attrs = m[1] || "";
    if (!/rel=/i.test(attrs) || /rel=["']alternate["']/i.test(attrs)) {
      const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) return decode(href);
    }
  }
  return "";
}
function canonical(value) {
  try {
    const u = new URL(value);
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|campaign$)/i.test(key)) u.searchParams.delete(key);
    u.hash = "";
    return u.toString();
  } catch { return value || ""; }
}
function normalize({ title, url, publishedAt, description, source, engagement = null }) {
  const date = new Date(publishedAt || now);
  return {
    id: hash(`${source.id}|${url || title}`),
    title: strip(title),
    url,
    publishedAt: Number.isNaN(date.getTime()) ? now.toISOString() : date.toISOString(),
    description: strip(description).slice(0, 1600),
    source: { id: source.id, name: source.name, tier: source.tier, kind: source.kind, tags: source.tags || [] },
    engagement
  };
}
function hash(value) {
  let h = 2166136261;
  for (const c of value) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return `r${(h >>> 0).toString(36)}`;
}
function normTitle(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(the|a|an|and|or|to|for|of|in|on|with|from|by|new|release|releases|introducing)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
function dedupe(items) {
  const urls = new Set(), titles = new Set(), out = [];
  for (const x of items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const u = canonical(x.url), t = normTitle(x.title);
    if ((u && urls.has(u)) || (t && titles.has(t))) continue;
    if (u) urls.add(u); if (t) titles.add(t); out.push(x);
  }
  return out;
}
function similarity(a, b) {
  const A = new Set(normTitle(a).split(" ").filter((x) => x.length > 2));
  const B = new Set(normTitle(b).split(" ").filter((x) => x.length > 2));
  if (!A.size || !B.size) return 0;
  let shared = 0; for (const x of A) if (B.has(x)) shared++;
  return shared / (A.size + B.size - shared);
}
function tier(t) { return cfg.tierBaseScore[t] || 55; }
function cluster(items) {
  const groups = [];
  for (const item of items) {
    const group = groups.find((g) => g.some((x) => similarity(x.title, item.title) >= .52));
    group ? group.push(item) : groups.push([item]);
  }
  return groups.map((g) => {
    g.sort((a, b) => tier(b.source.tier) - tier(a.source.tier));
    return { ...g[0], relatedSources: [...new Map(g.map((x) => [x.source.id, x.source])).values()] };
  });
}
function aiRelevant(value) {
  const text = String(value).toLowerCase();
  return /\bai\b/i.test(text) || [...cfg.keywords.high, ...cfg.keywords.medium].some((k) => text.includes(k.toLowerCase()));
}
function category(item) {
  const t = `${item.title} ${item.description} ${(item.source.tags || []).join(" ")}`.toLowerCase();
  const rules = [
    ["AI Coding", ["codex","claude code","gemini cli","coding","developer","sdk","vibe"]],
    ["Agent", ["agent","agents","mcp","browser-use","workflow","automation"]],
    ["模型 / 研究", ["model","llm","reasoning","benchmark","research","arxiv","multimodal"]],
    ["开源 / 基础设施", ["open source","open-source","inference","ollama","vllm","llama.cpp","transformers","gpu","infra"]],
    ["商业 / 产品", ["funding","acquisition","startup","product","pricing","enterprise","revenue"]],
    ["具身智能", ["robot","robotics","embodied","physical ai"]]
  ];
  return rules.find(([, keys]) => keys.some((k) => t.includes(k)))?.[0] || "AI 综合";
}
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
function fallback(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const high = cfg.keywords.high.filter((k) => text.includes(k.toLowerCase())).length;
  const medium = cfg.keywords.medium.filter((k) => text.includes(k.toLowerCase())).length;
  const age = Math.max(0, (now - new Date(item.publishedAt)) / 3600_000);
  const recency = Math.max(45, 100 - age * 1.4);
  const engagement = item.engagement ? Math.min(15, Math.log2(1 + (item.engagement.score || 0)) * 2) : 0;
  const c = category(item);
  return {
    ...item, category: c,
    summary: item.description ? item.description.slice(0, 240) : `${item.source.name} 发布了与 ${c} 相关的新信息。`,
    importance: clamp(45 + high * 8 + medium * 3 + (item.source.tier === "S" ? 12 : 0)),
    novelty: clamp(42 + recency * .35 + high * 5),
    relevance: clamp(50 + high * 7 + medium * 2),
    socialPotential: clamp(42 + high * 5 + medium * 3 + engagement),
    sourceQuality: tier(item.source.tier),
    confidence: 62,
    whyItMatters: c === "AI Coding" ? "可能影响 AI 编程工具链和开发者工作流，适合继续观察真实使用反馈。"
      : c === "Agent" ? "可能改变 Agent 的执行边界、工具调用或落地成本，值得跟踪是否形成新的开发范式。"
      : c === "商业 / 产品" ? "它提供了 AI 商业化、产品方向或资本流向的新信号。"
      : "这条信息具有较强的新鲜度或行业相关性，值得作为后续判断的事实输入。",
    whatChanged: item.title,
    angles: [`发生了什么：用最短篇幅解释「${item.title}」`, "为什么值得注意：它改变的是能力、成本还是工作流", "个人判断：这件事接下来最可能影响谁"]
  };
}
async function analyze(items) {
  const out = new Map(items.map((x) => { const f = fallback(x); return [x.id, f]; }));
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) return [...out.values()];
  for (let i = 0; i < items.length; i += 8) {
    const chunk = items.slice(i, i + 8);
    try {
      const result = await llm(chunk);
      for (const x of result) {
        const b = out.get(x.id); if (!b) continue;
        out.set(x.id, {
          ...b,
          category: String(x.category || b.category),
          summary: String(x.summary || b.summary),
          importance: num(x.importance, b.importance),
          novelty: num(x.novelty, b.novelty),
          relevance: num(x.relevance, b.relevance),
          socialPotential: num(x.socialPotential, b.socialPotential),
          sourceQuality: num(x.sourceQuality, b.sourceQuality),
          confidence: num(x.confidence, 75),
          whyItMatters: String(x.whyItMatters || b.whyItMatters),
          whatChanged: String(x.whatChanged || b.whatChanged),
          angles: Array.isArray(x.angles) ? x.angles.map(String).slice(0, 4) : b.angles
        });
      }
    } catch (error) { console.warn(`[radar] LLM fallback: ${error.message}`); }
  }
  return [...out.values()];
}
function num(value, fallbackValue) { const n = Number(value); return Number.isFinite(n) ? clamp(n) : fallbackValue; }
async function llm(items) {
  const url = `${(process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const input = items.map((x) => ({ id: x.id, title: x.title, source: x.source, publishedAt: x.publishedAt, description: x.description.slice(0, 900) }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL, temperature: .2,
        messages: [
          { role: "system", content: "你是个人 AI 情报机构分析员，只基于输入判断，不编造。只返回 JSON 数组。" },
          { role: "user", content: `为每条信息输出 id,category,summary,importance,novelty,relevance,socialPotential,sourceQuality,confidence,whyItMatters,whatChanged,angles。评分0-100；summary只写事实；angles给2-4个X/小红书选题角度。输入：${JSON.stringify(input)}` }
        ]
      })
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const body = await res.json();
    return jsonArray(body.choices?.[0]?.message?.content || "");
  } finally { clearTimeout(timer); }
}
function jsonArray(text) {
  const s = String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { const x = JSON.parse(s); if (Array.isArray(x)) return x; } catch {}
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a >= 0 && b > a) { const x = JSON.parse(s.slice(a, b + 1)); if (Array.isArray(x)) return x; }
  throw new Error("LLM returned non-JSON");
}
function score(x) {
  const w = cfg.weights;
  return clamp(x.importance*w.importance + x.novelty*w.novelty + x.relevance*w.relevance + x.socialPotential*w.socialPotential + x.sourceQuality*w.sourceQuality);
}
function esc(value = "") { return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim(); }
function dailyMarkdown(data) {
  const lines = [
    `# AI 情报雷达日报 · ${data.date}`, "",
    `> 自动扫描 ${data.stats.configuredSources} 个信息源；抓取 ${data.stats.scannedItems} 条，去重聚类后 ${data.stats.eventClusters} 个事件，展示 Top ${data.items.length}。`,
    "", "## 今日雷达", ""
  ];
  data.items.forEach((x, i) => lines.push(
    `### ${i+1}. ${esc(x.title)}`, "",
    `- Radar Score：${x.radarScore}/100`, `- 分类：${x.category}`, `- 来源：${x.source.name}（${x.source.tier} 级）`,
    `- 发布时间：${x.publishedAt}`, `- 原文：${x.url}`, "", x.summary, "",
    `为什么值得看：${x.whyItMatters}`, "", "可做选题：", ...x.angles.map((a) => `- ${esc(a)}`), ""
  ));
  lines.push("## 运行状态", "", `- 自动信息源：${data.stats.automatedSources}`, `- 成功：${data.stats.successfulSources}`,
    `- 失败：${data.stats.failedSources}`, `- 大模型分析：${data.llm.enabled ? `已启用（${data.llm.model}）` : "未启用，当前使用规则评分"}`,
    "", "> 日报是情报层，不自动进入永久知识库。");
  return lines.join("\n") + "\n";
}
function isoWeek(value) {
  const d = new Date(`${value}T12:00:00Z`), n = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((((d-y)/86400000)+1)/7)).padStart(2,"0")}`;
}
async function writeWeekly() {
  const days = [], all = [];
  for (let i = 0; i < 7; i++) {
    const d = dateKey(new Date(now.getTime() - i*86400_000));
    const f = path.join(dirs.archive, `${d}.json`);
    if (!(await exists(f))) continue;
    const data = JSON.parse(await readFile(f, "utf8"));
    days.push(data.date); all.push(...(data.items || []));
  }
  const evidence = dedupe(all).sort((a,b) => (b.radarScore||0)-(a.radarScore||0)).slice(0,40);
  if (!evidence.length) return;
  const groups = new Map();
  for (const x of evidence) { const k=x.category||"AI 综合"; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(x); }
  const trends = [...groups.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,5);
  const week = isoWeek(day), lines = [`# AI 情报雷达周报 · ${week}`,"",`> 覆盖日期：${days.sort().join("、")}。周报关注连续信号。`,"","## 本周趋势",""];
  trends.forEach(([name, list], i) => lines.push(`### ${i+1}. ${name}：本周持续出现的新信号}`,"",
    `${list.length} 条高分情报集中在这个方向，需要继续判断它是短期发布潮还是持续变化。`,"","证据：",
    ...list.slice(0,4).map((x)=>`- [${esc(x.title)}](${x.url}) · ${x.source.name} · ${x.radarScore}/100`),""));
  await writeFile(path.join(dirs.weekly, `${week}.md`), lines.join("\n")+"\n", "utf8");
  await writeJson(path.join(dirs.data, "weekly-latest.json"), { schemaVersion:1, generatedAt:now.toISOString(), week, timezone:cfg.timezone, days:days.sort(), items:evidence });
  console.log(`[radar] weekly report ${week}`);
}
