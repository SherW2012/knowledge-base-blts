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
  daily: path.join(root, "radar-data/reports/daily"),
  weekly: path.join(root, "radar-data/reports/weekly")
};
await Promise.all(Object.values(dirs).map((dir) => mkdir(dir, { recursive: true })));

const active = sources.filter((s) => s.enabled !== false);
const automated = active.filter((s) => s.kind !== "manual");
const manual = active.filter((s) => s.kind === "manual");
console.log(`[radar] ${day}: ${automated.length} automated + ${manual.length} X/manual sources`);

const scans = await mapLimit(automated, 5, async (source) => {
  try {
    const items = (await collect(source)).filter((item) => sourceFilter(source, item));
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
const recent = collected.filter((x) => x.isCurrentSignal || !Date.parse(x.publishedAt) || Date.parse(x.publishedAt) >= cutoff);
const deduped = dedupe(recent);
const clustered = cluster(deduped);
const ruleScored = clustered
  .map((x) => fallback(x))
  .map((x) => ({ ...x, radarScore: score(x) }))
  .sort((a, b) => b.radarScore - a.radarScore);
const llmCandidateLimit = Math.min(ruleScored.length, Math.max(cfg.topK * 2, 36));
const llmCandidates = chooseAnalysisCandidates(ruleScored, llmCandidateLimit);
console.log(`[radar] LLM candidate pool: ${llmCandidates.length}/${clustered.length}`);
const analyzed = await analyze(llmCandidates);
const scored = analyzed.map((x) => ({ ...x, radarScore: score(x) })).sort((a, b) => b.radarScore - a.radarScore);
const items = selectBalanced(scored);

const payload = {
  schemaVersion: 2,
  status: items.length ? "ok" : "empty",
  generatedAt: now.toISOString(),
  date: day,
  timezone: cfg.timezone,
  focus: "launches-tools-skills-productivity-markets",
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
    publishedItems: items.length,
    researchItems: items.filter((x) => x.category === "技术研究").length
  },
  sourceRuns,
  sources: active.map(({ id, name, tier, kind, url, tags, note }) => ({ id, name, tier, kind, url: url || null, tags: tags || [], note: note || null })),
  items
};

const latest = path.join(dirs.data, "latest.json");
if (items.length >= cfg.minimumItemsToPublish || !(await exists(latest))) {
  await writeJson(latest, payload);
  await writeJson(path.join(dirs.archive, `${day}.json`), payload);
  await writeFile(path.join(dirs.daily, `${day}.md`), dailyMarkdown(payload), "utf8");
  console.log(`[radar] published ${items.length} balanced items; research=${payload.stats.researchItems}`);
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
function isoDateUTC(date) { return date.toISOString().slice(0, 10); }
async function mapLimit(values, limit, worker) {
  const out = new Array(values.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) { const i = cursor++; if (i >= values.length) return; out[i] = await worker(values[i], i); }
  }));
  return out;
}

async function request(url, json = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "BLTS-AI-Radar/2.0", accept: "application/rss+xml, application/atom+xml, application/json, text/html, */*" }
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
  if (source.kind === "github_trending") return githubTrending(source);
  if (source.kind === "github_search") return githubSearch(source);
  if (source.kind === "huggingface_trending") return huggingFaceTrending(source);
  if (source.kind === "coingecko_trending") return coinGeckoTrending(source);
  if (source.kind === "fear_greed") return fearGreed(source);
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
    const batch = await Promise.all(top.slice(i, i + 10).map((id) => request(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, true).catch(() => null)));
    for (const x of batch) {
      if (!x?.title || x.type !== "story" || !practicalRelevant(`${x.title} ${x.text || ""}`)) continue;
      stories.push(normalize({
        title: x.title,
        url: canonical(x.url || `https://news.ycombinator.com/item?id=${x.id}`),
        publishedAt: new Date((x.time || 0) * 1000).toISOString(),
        description: `Hacker News · ${x.score || 0} points · ${x.descendants || 0} comments`,
        engagement: { score: x.score || 0, comments: x.descendants || 0 }, source
      }));
    }
  }
  return stories.slice(0, cfg.maxPerSource);
}

async function githubTrending(source) {
  const html = await request(source.url);
  const blocks = [...html.matchAll(/<article[^>]*class=["'][^"']*Box-row[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]);
  if (!blocks.length) throw new Error("GitHub Trending parsed 0 repos");
  const out = [];
  for (const block of blocks) {
    const repo = block.match(/<h2[\s\S]*?<a[^>]+href=["']\/([^"'#?]+\/[^"'#?]+)["']/i)?.[1];
    if (!repo) continue;
    const desc = strip(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
    const todayStars = Number((strip(block).match(/([\d,]+)\s+stars today/i)?.[1] || "0").replace(/,/g, ""));
    const text = `${repo} ${desc}`;
    if (!practicalRelevant(text)) continue;
    out.push(normalize({
      title: `${repo}${desc ? ` — ${desc.slice(0, 120)}` : ""}`,
      url: `https://github.com/${repo}`,
      publishedAt: now.toISOString(),
      description: `GitHub Trending${todayStars ? ` · ${todayStars} stars today` : ""}${desc ? ` · ${desc}` : ""}`,
      engagement: { score: todayStars }, source, isCurrentSignal: true
    }));
  }
  return out.slice(0, cfg.maxPerSource);
}

async function githubSearch(source) {
  const since = isoDateUTC(new Date(now.getTime() - (source.windowDays || 30) * 86400_000));
  const field = source.dateField || "created";
  const q = `${source.query} ${field}:>=${since}`;
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", q);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(cfg.maxPerSource, 20)));
  const data = await request(url.toString(), true);
  const repos = Array.isArray(data.items) ? data.items : [];
  return repos.map((repo) => normalize({
    title: `${repo.full_name}${repo.description ? ` — ${repo.description}` : ""}`,
    url: repo.html_url,
    publishedAt: repo.created_at || repo.updated_at || now.toISOString(),
    description: `GitHub discovery · ★${repo.stargazers_count || 0} · ${repo.language || "unknown"}${repo.description ? ` · ${repo.description}` : ""}`,
    engagement: { score: Math.log2(1 + (repo.stargazers_count || 0)) * 10 }, source
  })).filter((x) => practicalRelevant(`${x.title} ${x.description}`));
}

async function huggingFaceTrending(source) {
  const url = new URL("https://huggingface.co/api/models");
  url.searchParams.set("sort", "trendingScore");
  url.searchParams.set("limit", String(Math.min(cfg.maxPerSource, 20)));
  const data = await request(url.toString(), true);
  if (!Array.isArray(data)) throw new Error("Hugging Face trending returned invalid data");
  return data.map((m) => normalize({
    title: `${m.modelId || m.id} · Hugging Face trending model`,
    url: `https://huggingface.co/${m.modelId || m.id}`,
    publishedAt: now.toISOString(),
    description: `Trending model · ${m.pipeline_tag || "model"} · ♥ ${m.likes || 0} · downloads ${m.downloads || 0}`,
    engagement: { score: (m.likes || 0) + Math.log10(1 + (m.downloads || 0)) * 10 }, source, isCurrentSignal: true
  })).slice(0, cfg.maxPerSource);
}

async function coinGeckoTrending(source) {
  const data = await request(source.url, true);
  const coins = Array.isArray(data?.coins) ? data.coins : [];
  return coins.slice(0, 8).map(({ item }) => normalize({
    title: `${item.name} (${String(item.symbol || "").toUpperCase()}) enters CoinGecko trending`,
    url: `https://www.coingecko.com/en/coins/${item.id}`,
    publishedAt: now.toISOString(),
    description: `CoinGecko trending · market cap rank ${item.market_cap_rank ?? "—"} · signal only, not investment advice`,
    engagement: { score: Math.max(0, 100 - (item.score || 0) * 8) }, source, isCurrentSignal: true
  }));
}

async function fearGreed(source) {
  const body = await request(source.url, true);
  const current = body?.data?.[0];
  if (!current) return [];
  return [normalize({
    title: `Crypto Fear & Greed: ${current.value} · ${current.value_classification}`,
    url: "https://alternative.me/crypto/fear-and-greed-index/",
    publishedAt: now.toISOString(),
    description: `Market sentiment signal · current ${current.value} (${current.value_classification}); use as context, not a trading signal`,
    source, isCurrentSignal: true
  })];
}

function sourceFilter(source, item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (source.filter === "finance") return financeRelevant(text);
  if (source.filter === "practical") return practicalRelevant(text);
  return true;
}
function containsAny(text, values = []) { return values.some((k) => text.includes(String(k).toLowerCase())); }
function practicalRelevant(value) {
  const text = String(value).toLowerCase();
  return /\bai\b/i.test(text) || containsAny(text, [...cfg.keywords.high, ...cfg.keywords.practical, ...cfg.keywords.medium]);
}
function financeRelevant(value) { return containsAny(String(value).toLowerCase(), cfg.keywords.finance); }

function decode(value = "") {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== "#") return named[e.toLowerCase()] ?? m;
    const hex = e[1]?.toLowerCase() === "x"; const n = parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}
function strip(value = "") {
  let text = String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 3; i++) { const next = decode(text); if (next === text) break; text = next; }
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
      const href = attrs.match(/href=["']([^"']+)["']/i)?.[1]; if (href) return decode(href);
    }
  }
  return "";
}
function canonical(value) {
  try {
    const u = new URL(value);
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|campaign$)/i.test(key)) u.searchParams.delete(key);
    u.hash = ""; return u.toString();
  } catch { return value || ""; }
}
function normalize({ title, url, publishedAt, description, source, engagement = null, isCurrentSignal = false }) {
  const date = new Date(publishedAt || now);
  return {
    id: hash(`${source.id}|${url || title}`), title: strip(title), url,
    publishedAt: Number.isNaN(date.getTime()) ? now.toISOString() : date.toISOString(),
    description: strip(description).slice(0, 1600),
    source: { id: source.id, name: source.name, tier: source.tier, kind: source.kind, tags: source.tags || [] },
    engagement, isCurrentSignal
  };
}
function hash(value) { let h = 2166136261; for (const c of value) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return `r${(h >>> 0).toString(36)}`; }
function normTitle(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(the|a|an|and|or|to|for|of|in|on|with|from|by|new|release|releases|introducing|update|updated)\b/g, " ")
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
  if (!A.size || !B.size) return 0; let shared = 0; for (const x of A) if (B.has(x)) shared++;
  return shared / (A.size + B.size - shared);
}
function tier(t) { return cfg.tierBaseScore[t] || 55; }
function cluster(items) {
  const groups = [];
  for (const item of items) {
    const group = groups.find((g) => g.some((x) => similarity(x.title, item.title) >= .55));
    group ? group.push(item) : groups.push([item]);
  }
  return groups.map((g) => {
    g.sort((a, b) => tier(b.source.tier) - tier(a.source.tier));
    return { ...g[0], relatedSources: [...new Map(g.map((x) => [x.source.id, x.source])).values()] };
  });
}

function category(item) {
  const tags = item.source.tags || [];
  const t = `${item.title} ${item.description} ${tags.join(" ")}`.toLowerCase();
  if (tags.some((x) => ["finance","crypto","stocks","market"].includes(x)) || financeRelevant(t)) return "美股 / 币圈";
  if (tags.some((x) => ["skill","github","mcp","trending"].includes(x)) || /\b(skill|skills|mcp|plugin|extension|github trending)\b/.test(t)) return "Skill / GitHub";
  if (tags.some((x) => ["productivity","workflow","automation"].includes(x)) || containsAny(t, ["productivity","workflow","automation","shortcut","notetaker"])) return "效率 / 工作流";
  if (tags.some((x) => ["tool","website","product","discovery"].includes(x)) || containsAny(t, ["tool","app","website","product hunt","browser","code review"])) return "工具 / 网站";
  const launchish = tags.some((x) => ["launch","model","agent"].includes(x)) || containsAny(t, ["new model","model release","introducing","released","agent","agents","gpt","claude","gemini","deepseek","qwen","kimi","glm","grok"]);
  if (launchish && !containsAny(t, cfg.keywords.research)) return "模型 / Agent 上新";
  if (tags.includes("research") || containsAny(t, cfg.keywords.research)) return "技术研究";
  return "AI 综合";
}
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
function fallbackSummary(item) {
  const desc = strip(item.description || "").slice(0, 220);
  const releaseProject = String(item.source?.name || "").replace(/\s+Releases$/i, "");
  if (releaseProject && /^v?\d+(?:\.\d+){1,3}/i.test(String(item.title || ""))) {
    return `${releaseProject} 发布 ${item.title} 更新${desc ? `：${desc}` : "。"}`;
  }
  if (desc) return `${item.title}：${desc}`.slice(0, 260);
  return `${item.source.name} 出现了一个值得进一步确认的新信号。`;
}
function fallback(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const high = cfg.keywords.high.filter((k) => text.includes(k.toLowerCase())).length;
  const practical = cfg.keywords.practical.filter((k) => text.includes(k.toLowerCase())).length;
  const medium = cfg.keywords.medium.filter((k) => text.includes(k.toLowerCase())).length;
  const research = cfg.keywords.research.filter((k) => text.includes(k.toLowerCase())).length;
  const age = Math.max(0, (now - new Date(item.publishedAt)) / 3600_000);
  const recency = item.isCurrentSignal ? 100 : Math.max(45, 100 - age * 1.25);
  const engagement = item.engagement ? Math.min(18, Math.log2(1 + (item.engagement.score || 0)) * 2.2) : 0;
  const c = category(item);
  const practicalScore = clamp(48 + practical * 9 + high * 5 + (c === "Skill / GitHub" ? 16 : 0) + (c === "工具 / 网站" ? 14 : 0) + (c === "效率 / 工作流" ? 14 : 0) - research * 13);
  return {
    ...item, category: c,
    summary: fallbackSummary(item),
    importance: clamp(46 + high * 7 + medium * 3 + (item.source.tier === "S" ? 10 : 0) - research * 5),
    novelty: clamp(45 + recency * .38 + high * 4 + engagement * .5),
    relevance: clamp(48 + high * 6 + practical * 5 + medium * 2 - research * 6),
    socialPotential: clamp(42 + high * 5 + practical * 6 + engagement - research * 4),
    sourceQuality: tier(item.source.tier), practicality: practicalScore,
    researchIntensity: clamp(research * 24 + (c === "技术研究" ? 45 : 0)), confidence: 64,
    whyItMatters: why(c), whatChanged: item.title, angles: angles(c, item.title)
  };
}
function why(c) {
  if (c === "模型 / Agent 上新") return "这是能力边界或 Agent 使用方式的直接变化，优先判断它能不能马上改变现有工作流。";
  if (c === "Skill / GitHub") return "这是可直接试用、复用或二次开发的信号，优先看 star 增长、真实场景和安装成本。";
  if (c === "工具 / 网站") return "它可能直接降低某个任务的时间或门槛，适合快速试用后决定是否进入工具箱。";
  if (c === "效率 / 工作流") return "重点不是技术原理，而是它能否减少重复操作、缩短流程或提升个人产出。";
  if (c === "美股 / 币圈") return "作为市场观察和工具线索使用，关注数据、情绪与结构变化，不把单条信息当作交易建议。";
  if (c === "技术研究") return "保留少量真正可能改变能力边界的技术信号，不追求论文覆盖率。";
  return "这条信息可能形成新的工具、内容或商业机会，值得快速判断是否继续跟进。";
}
function angles(c, title) {
  if (c === "Skill / GitHub") return [`今天 GitHub 上冒出来一个值得试的项目：${title}`, "它解决的具体麻烦是什么，5 分钟能不能跑通", "有没有可能变成自己的 Skill / 自动化工作流"];
  if (c === "工具 / 网站") return [`发现一个可能真能省时间的新工具：${title}`, "它替代了原来哪一步手工操作", "免费版够不够用，值不值得长期留在工具箱"];
  if (c === "效率 / 工作流") return [`我又找到一个能少做几步的工作流：${title}`, "把它放进自己的日常流程，能省下多少时间", "哪些人最适合直接抄这个用法"];
  if (c === "美股 / 币圈") return [`今天市场里一个容易被忽略的小信号：${title}`, "这个数据应该怎么看，什么情况下容易误判", "只做观察：它接下来值得盯哪个指标"];
  if (c === "技术研究") return [`这篇技术内容只看一个问题：它有没有机会变成产品能力？${title}`, "如果落地，它最先改变哪个工具或 Agent", "普通用户现在需不需要关心"];
  return [`发生了什么：${title}`, "这次变化最值得普通用户注意的是什么", "我会不会把它加入自己的 AI 工作流"];
}

function chooseAnalysisCandidates(sorted, limit) {
  const chosen = [], ids = new Set();
  const add = (x) => {
    if (!x || ids.has(x.id) || chosen.length >= limit) return false;
    ids.add(x.id); chosen.push(x); return true;
  };
  for (const [cat, minimum] of Object.entries(cfg.categoryMinimums || {})) {
    let n = 0;
    const target = Math.max(minimum, Math.min(6, minimum * 2));
    for (const x of sorted) {
      if (x.category !== cat) continue;
      if (add(x)) n++;
      if (n >= target || chosen.length >= limit) break;
    }
  }
  for (const x of sorted) {
    if (chosen.length >= limit) break;
    add(x);
  }
  return chosen;
}

async function analyze(items) {
  const out = new Map(items.map((x) => [x.id, fallback(x)]));
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) return [...out.values()];
  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5);
    try {
      let result = await llm(chunk);
      const returnedIds = new Set(result.map((x) => String(x?.id || "")));
      const missing = chunk.filter((x) => !returnedIds.has(String(x.id)));
      if (missing.length) {
        console.warn(`[radar] LLM omitted ${missing.length}/${chunk.length} items; retrying missing ids`);
        try { result = result.concat(await llm(missing)); } catch (retryError) { console.warn(`[radar] LLM missing-item retry failed: ${retryError.message}`); }
      }
      for (const x of result) {
        const b = out.get(x.id); if (!b) continue;
        out.set(x.id, {
          ...b,
          category: allowedCategory(x.category) ? x.category : b.category,
          summary: String(x.summary || b.summary),
          importance: num(x.importance, b.importance), novelty: num(x.novelty, b.novelty),
          relevance: num(x.relevance, b.relevance), socialPotential: num(x.socialPotential, b.socialPotential),
          sourceQuality: num(x.sourceQuality, b.sourceQuality), practicality: num(x.practicality, b.practicality),
          researchIntensity: num(x.researchIntensity, b.researchIntensity), confidence: num(x.confidence, 75),
          whyItMatters: String(x.whyItMatters || b.whyItMatters), whatChanged: String(x.whatChanged || b.whatChanged),
          angles: Array.isArray(x.angles) ? x.angles.map(String).slice(0, 4) : b.angles
        });
      }
    } catch (error) { console.warn(`[radar] LLM fallback: ${error.message}`); }
  }
  return [...out.values()];
}
function allowedCategory(v) { return Object.keys(cfg.categoryCaps || {}).includes(String(v)); }
function num(value, fallbackValue) { const n = Number(value); return Number.isFinite(n) ? clamp(n) : fallbackValue; }
async function llm(items) {
  const url = `${(process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const input = items.map((x) => ({ id: x.id, title: x.title, source: x.source, publishedAt: x.publishedAt, description: x.description.slice(0, 900) }));
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL, temperature: .15,
        messages: [
          { role: "system", content: "你是个人前沿情报分析员。优先发现新模型/Agent上线、GitHub Trending里的Skill和项目、好用工具网站、效率工作流，其次是美股/币圈可验证的小信号；纯学术论文只保留极少数可能很快改变产品能力的内容。不要因为技术深就给高分，只基于输入，不编造，只返回JSON数组。" },
          { role: "user", content: `分类只能是：模型 / Agent 上新、Skill / GitHub、工具 / 网站、效率 / 工作流、美股 / 币圈、技术研究、AI 综合。为每条输出 id,category,summary,importance,novelty,relevance,socialPotential,sourceQuality,practicality,researchIntensity,confidence,whyItMatters,whatChanged,angles。评分0-100。practicality重点衡量能否马上试用/省时间/形成内容或商业机会；researchIntensity衡量学术生涩程度。summary只写事实；angles给2-4个适合X/小红书的角度。输入：${JSON.stringify(input)}` }
        ]
      })
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const body = await res.json(); return jsonArray(body.choices?.[0]?.message?.content || "");
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
  const base = x.importance*w.importance + x.novelty*w.novelty + x.relevance*w.relevance + x.socialPotential*w.socialPotential + x.sourceQuality*w.sourceQuality + x.practicality*w.practicality;
  const boost = cfg.categoryBoost?.[x.category] || 0;
  return clamp(base + boost - (x.category === "技术研究" ? x.researchIntensity * .08 : 0));
}

function selectBalanced(sorted) {
  const chosen = [], ids = new Set(), catCount = new Map(), sourceCount = new Map();
  const add = (x, enforceCaps = true) => {
    if (ids.has(x.id) || chosen.length >= cfg.topK) return false;
    const cat = x.category || "AI 综合", source = x.source.id;
    const cap = cfg.categoryCaps?.[cat] ?? cfg.topK;
    if (enforceCaps && (catCount.get(cat) || 0) >= cap) return false;
    if ((sourceCount.get(source) || 0) >= (cfg.maxPerSingleSourceTopK || 3)) return false;
    ids.add(x.id); chosen.push(x); catCount.set(cat, (catCount.get(cat) || 0) + 1); sourceCount.set(source, (sourceCount.get(source) || 0) + 1); return true;
  };
  for (const [cat, minimum] of Object.entries(cfg.categoryMinimums || {})) {
    let n = 0; for (const x of sorted) { if (x.category === cat && add(x, true)) n++; if (n >= minimum) break; }
  }
  for (const x of sorted) add(x, true);
  if (chosen.length < cfg.topK) for (const x of sorted) { if (x.category !== "技术研究") add(x, false); }
  return chosen.sort((a, b) => b.radarScore - a.radarScore).slice(0, cfg.topK);
}

function esc(value = "") { return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim(); }
function dailyMarkdown(data) {
  const mix = Object.entries(data.items.reduce((m, x) => (m[x.category] = (m[x.category] || 0) + 1, m), {})).map(([k,v]) => `${k} ${v}`).join(" · ");
  const lines = [
    `# AI 情报雷达日报 · ${data.date}`, "",
    `> 产品与机会导向。自动扫描 ${data.stats.configuredSources} 个信息源；抓取 ${data.stats.scannedItems} 条，聚类后 ${data.stats.eventClusters} 个事件，展示 Top ${data.items.length}。`,
    `> 今日结构：${mix || "暂无"}。技术研究最多保留 ${cfg.categoryCaps?.["技术研究"] || 2} 条。`,
    "", "## 今日雷达", ""
  ];
  data.items.forEach((x, i) => lines.push(
    `### ${i+1}. ${esc(x.title)}`, "",
    `- Radar Score：${x.radarScore}/100`, `- 分类：${x.category}`, `- 实用度：${x.practicality}/100`, `- 来源：${x.source.name}（${x.source.tier} 级）`,
    `- 发布时间：${x.publishedAt}`, `- 原文：${x.url}`, "", x.summary, "", `为什么值得看：${x.whyItMatters}`, "", "可做选题：", ...x.angles.map((a) => `- ${esc(a)}`), ""
  ));
  lines.push("## 运行状态", "", `- 自动信息源：${data.stats.automatedSources}`, `- X / 手动观察源：${data.stats.manualSources}`, `- 成功：${data.stats.successfulSources}`, `- 失败：${data.stats.failedSources}`, `- 大模型分析：${data.llm.enabled ? `已启用（${data.llm.model}）` : "未启用，当前使用规则评分"}`, "", "> 日报属于情报层，不自动进入永久知识库。X 指定博主目前只维护观察名单，自动读取需要单独接入 X 官方 API。");
  return lines.join("\n") + "\n";
}
function isoWeek(value) {
  const d = new Date(`${value}T12:00:00Z`), n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return `${d.getUTCFullYear()}-W${String(Math.ceil((((d-y)/86400000)+1)/7)).padStart(2,"0")}`;
}
async function writeWeekly() {
  const days = [], all = [];
  for (let i = 0; i < 7; i++) {
    const d = dateKey(new Date(now.getTime() - i*86400_000)), f = path.join(dirs.archive, `${d}.json`);
    if (!(await exists(f))) continue; const data = JSON.parse(await readFile(f, "utf8")); days.push(data.date); all.push(...(data.items || []));
  }
  const evidence = dedupe(all).sort((a,b) => (b.radarScore||0)-(a.radarScore||0)).slice(0,50); if (!evidence.length) return;
  const groups = new Map(); for (const x of evidence) { const k=x.category||"AI 综合"; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(x); }
  const trends = [...groups.entries()].filter(([name]) => name !== "技术研究").sort((a,b)=>b[1].length-a[1].length).slice(0,6);
  const week = isoWeek(day), lines = [`# AI 情报雷达周报 · ${week}`,"",`> 覆盖日期：${days.sort().join("、")}。周报优先看上新、工具、Skill、效率与市场信号，不按论文数量排名。`,"","## 本周趋势",""];
  trends.forEach(([name, list], i) => lines.push(`### ${i+1}. ${name}`,"",`${list.length} 条高分情报集中在这个方向。`,"","证据：",...list.slice(0,5).map((x)=>`- [${esc(x.title)}](${x.url}) · ${x.source.name} · ${x.radarScore}/100`),""));
  await writeFile(path.join(dirs.weekly, `${week}.md`), lines.join("\n")+"\n", "utf8");
  await writeJson(path.join(dirs.data, "weekly-latest.json"), { schemaVersion:2, generatedAt:now.toISOString(), week, timezone:cfg.timezone, days:days.sort(), items:evidence });
  console.log(`[radar] weekly report ${week}`);
}
