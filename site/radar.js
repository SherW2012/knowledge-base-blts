(() => {
  const STORAGE_KEY = "blts-radar-topic-pool-v1";
  const DATA_URL = "./content/radar-data/latest.json";
  const ARCHIVE_BASE = "./content/radar-data/archive";
  const HISTORY_LOOKBACK_DAYS = 14;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function cleanText(value) {
    let text = String(value ?? "").trim();
    if (!text) return "";
    try {
      for (let i = 0; i < 2; i++) {
        const doc = new DOMParser().parseFromString(`<body>${text}</body>`, "text/html");
        text = doc.body.textContent || text;
      }
    } catch {}
    return text.replace(/\s+/g, " ").trim();
  }

  function loadPool() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function savePool(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

  function formatDate(value) {
    if (!value) return "未知时间";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(date);
  }

  function formatDay(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[2])}月${Number(match[3])}日` : value;
  }

  function previousDateKeys(value, count) {
    const base = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(base.getTime())) return [value].filter(Boolean);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(base.getTime() - index * 86400_000);
      return date.toISOString().slice(0, 10);
    });
  }

  function tierLabel(tier) {
    return tier === "S" ? "一手" : tier === "A" ? "高价值" : tier === "B" ? "观察" : tier;
  }

  function scoreClass(score) {
    if (score >= 90) return "radar-score-hot";
    if (score >= 80) return "radar-score-strong";
    return "radar-score-normal";
  }

  function itemCard(item, inPool = false) {
    const related = (item.relatedSources || []).filter((source) => source.id !== item.source?.id);
    const summary = cleanText(item.summary || item.description || "暂时没有可读摘要");
    const originalTitle = cleanText(item.title || "未命名情报");
    const why = cleanText(item.whyItMatters || "");
    const angles = (item.angles || []).map(cleanText).filter(Boolean);
    return `
      <article class="radar-card" data-item-id="${escapeHtml(item.id)}">
        <div class="radar-card-top">
          <div class="radar-card-badges">
            <span class="radar-category">${escapeHtml(item.category || "AI 综合")}</span>
            <span class="radar-tier radar-tier-${escapeHtml((item.source?.tier || "B").toLowerCase())}">${escapeHtml(tierLabel(item.source?.tier || "B"))}</span>
          </div>
          <div class="radar-score ${scoreClass(item.radarScore || 0)}" title="推荐指数综合考虑实用性、重要性、新颖度、传播潜力和信源质量">
            <span class="radar-score-label">推荐指数</span><strong>${escapeHtml(item.radarScore ?? "—")}</strong><span>/100</span>
          </div>
        </div>

        <div class="radar-ai-summary">
          <span>AI 摘要</span>
          <p>${escapeHtml(summary)}</p>
        </div>

        <div class="radar-original">
          <span class="radar-original-label">原始情报</span>
          <strong>${escapeHtml(originalTitle)}</strong>
          <div class="radar-source-line">
            <span>${escapeHtml(item.source?.name || "未知来源")}</span><span>·</span>
            <time>${escapeHtml(formatDate(item.publishedAt))}</time>
            ${related.length ? `<span>· ${related.length} 个关联信源</span>` : ""}
          </div>
        </div>

        ${(why || angles.length) ? `
          <details class="radar-detail">
            <summary>展开分析</summary>
            ${why ? `<div class="radar-why"><span>为什么值得看</span><p>${escapeHtml(why)}</p></div>` : ""}
            ${angles.length ? `<div class="radar-angles"><span>可做选题</span><ul>${angles.map((angle) => `<li>${escapeHtml(angle)}</li>`).join("")}</ul></div>` : ""}
            <div class="radar-metrics">
              <span>实用 ${escapeHtml(item.practicality ?? "—")}</span>
              <span>重要 ${escapeHtml(item.importance ?? "—")}</span>
              <span>新颖 ${escapeHtml(item.novelty ?? "—")}</span>
              <span>传播 ${escapeHtml(item.socialPotential ?? "—")}</span>
            </div>
          </details>` : ""}

        <div class="radar-actions">
          ${item.url ? `<a class="radar-button radar-button-primary" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看原文 ↗</a>` : ""}
          <button class="radar-button" data-radar-action="${inPool ? "remove" : "add"}" data-item-id="${escapeHtml(item.id)}">${inPool ? "移出选题池" : "加入选题池"}</button>
          <button class="radar-button" data-radar-action="copy" data-item-id="${escapeHtml(item.id)}">复制选题卡</button>
        </div>
      </article>`;
  }

  function sourceCard(source, run) {
    const isX = (source.tags || []).includes("x-watchlist");
    const status = run?.status || (source.kind === "manual" ? "manual" : "unknown");
    const label = status === "ok" ? `已抓取 ${run.items} 条` : status === "error" ? "本次抓取失败" : isX ? "X 观察名单" : status === "manual" ? "人工关注" : "等待运行";
    return `
      <div class="radar-source-card">
        <div><span class="radar-tier radar-tier-${escapeHtml((source.tier || "B").toLowerCase())}">${escapeHtml(source.tier || "B")}</span><strong>${escapeHtml(source.name)}</strong></div>
        <small class="radar-source-status radar-source-status-${escapeHtml(status)}">${escapeHtml(label)}</small>
        ${(source.tags || []).length ? `<p>${source.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ")}</p>` : ""}
        ${source.note ? `<p class="radar-source-note">${escapeHtml(source.note)}</p>` : ""}
        ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">打开来源 ↗</a>` : ""}
      </div>`;
  }

  function copyText(item) {
    return [
      `# ${cleanText(item.title)}`, "",
      `分类：${item.category || "AI 综合"}`,
      `推荐指数：${item.radarScore ?? ""}/100`,
      `来源：${item.source?.name || ""}`,
      `原文：${item.url || ""}`,
      "", `AI 摘要：${cleanText(item.summary || item.description || "")}`,
      "", `为什么值得看：${cleanText(item.whyItMatters || "")}`,
      "", "可做选题：", ...(item.angles || []).map((angle) => `- ${cleanText(angle)}`),
      "", "我的观点："
    ].join("\n");
  }

  async function loadHistory(latest) {
    const keys = previousDateKeys(latest.date, HISTORY_LOOKBACK_DAYS);
    const payloads = await Promise.all(keys.map(async (key) => {
      if (key === latest.date) return latest;
      try {
        const response = await fetch(`${ARCHIVE_BASE}/${key}.json?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.items ? data : null;
      } catch { return null; }
    }));
    return payloads.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  async function mount(root) {
    if (root.dataset.radarMounted === "1") return;
    root.dataset.radarMounted = "1";
    root.innerHTML = `<div class="radar-loading">正在读取情报雷达…</div>`;

    let latest;
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      latest = await response.json();
    } catch (error) {
      root.innerHTML = `<div class="radar-empty"><strong>雷达数据暂时不可用</strong><p>${escapeHtml(error.message)}</p></div>`;
      return;
    }

    const history = await loadHistory(latest);
    const historyMap = new Map(history.map((day) => [day.date, day]));
    const itemMap = new Map(history.flatMap((day) => (day.items || []).map((item) => [item.id, item])));
    let activeTab = "today";
    let activeDate = latest.date;
    let activeCategory = "全部";

    function currentData() { return historyMap.get(activeDate) || latest; }

    function render() {
      const data = currentData();
      const pool = loadPool();
      const poolMap = new Map(pool.map((item) => [item.id, item]));
      const runs = new Map((latest.sourceRuns || []).map((run) => [run.id, run]));
      const categories = [...new Set((data.items || []).map((item) => item.category || "AI 综合"))];
      if (activeCategory !== "全部" && !categories.includes(activeCategory)) activeCategory = "全部";
      const visibleItems = (data.items || []).filter((item) => activeCategory === "全部" || (item.category || "AI 综合") === activeCategory);

      const dayContent = visibleItems.length
        ? `<div class="radar-list">${visibleItems.map((item) => itemCard(item, poolMap.has(item.id))).join("")}</div>`
        : `<div class="radar-empty"><strong>这个分类今天没有情报</strong><p>换一个分类，或者切到其他日期看看。</p></div>`;
      const poolContent = pool.length
        ? `<div class="radar-list">${pool.map((item) => itemCard(item, true)).join("")}</div>`
        : `<div class="radar-empty"><strong>选题池还是空的</strong><p>在情报卡片里点击“加入选题池”，候选选题会保存在当前浏览器。</p></div>`;
      const sourceContent = `<div class="radar-source-grid">${(latest.sources || []).map((source) => sourceCard(source, runs.get(source.id))).join("")}</div>`;

      const dateNav = history.length > 1 ? `
        <div class="radar-history-bar">
          <span>日期</span>
          <div class="radar-history-days">
            ${history.map((day, index) => `<button class="${day.date === activeDate ? "active" : ""}" data-radar-date="${escapeHtml(day.date)}">${index === 0 ? "最新" : escapeHtml(formatDay(day.date))}<small>${escapeHtml(day.items?.length || 0)}</small></button>`).join("")}
          </div>
        </div>` : "";

      const categoryNav = `
        <div class="radar-filter-bar">
          <span>分类筛选</span>
          <div class="radar-filter-chips">
            ${["全部", ...categories].map((category) => {
              const count = category === "全部" ? (data.items || []).length : (data.items || []).filter((item) => (item.category || "AI 综合") === category).length;
              return `<button class="${category === activeCategory ? "active" : ""}" data-radar-category="${escapeHtml(category)}">${escapeHtml(category)} <small>${count}</small></button>`;
            }).join("")}
          </div>
        </div>`;

      root.innerHTML = `
        <section class="radar-shell">
          <header class="radar-hero">
            <div><div class="radar-kicker">AI INTELLIGENCE RADAR</div><h2>${escapeHtml(data.date || "等待运行")}</h2><p>先告诉你“这是什么、值不值得看”，再决定要不要展开分析。历史情报按日期保留，所有情报都可以按分类筛选。</p></div>
            <div class="radar-run-state"><span>${latest.llm?.enabled ? "LLM ON" : "RULE MODE"}</span><small>${latest.llm?.enabled ? escapeHtml(latest.llm.model || "LLM") : "未配置大模型 API"}</small></div>
          </header>
          <div class="radar-stat-grid">
            <div><strong>${escapeHtml(latest.stats?.configuredSources ?? 0)}</strong><span>信息源</span></div>
            <div><strong>${escapeHtml(data.stats?.scannedItems ?? latest.stats?.scannedItems ?? 0)}</strong><span>当日抓取</span></div>
            <div><strong>${escapeHtml(data.stats?.eventClusters ?? latest.stats?.eventClusters ?? 0)}</strong><span>当日事件</span></div>
            <div><strong>${escapeHtml(data.items?.length || 0)}</strong><span>当日精选</span></div>
          </div>
          <nav class="radar-tabs">
            <button class="${activeTab === "today" ? "active" : ""}" data-radar-tab="today">情报 <span>${escapeHtml(data.items?.length || 0)}</span></button>
            <button class="${activeTab === "pool" ? "active" : ""}" data-radar-tab="pool">选题池 <span>${pool.length}</span></button>
            <button class="${activeTab === "sources" ? "active" : ""}" data-radar-tab="sources">信息源 <span>${escapeHtml(latest.sources?.length || 0)}</span></button>
          </nav>
          ${activeTab === "today" ? `${dateNav}${categoryNav}` : ""}
          <div class="radar-panel">${activeTab === "today" ? dayContent : activeTab === "pool" ? poolContent : sourceContent}</div>
          <footer class="radar-footer-note">最近生成：${escapeHtml(formatDate(latest.generatedAt))} · 自动源成功 ${escapeHtml(latest.stats?.successfulSources ?? 0)} / ${escapeHtml(latest.stats?.automatedSources ?? 0)}${latest.stats?.failedSources ? ` · <span>${escapeHtml(latest.stats.failedSources)} 个源失败，已隔离</span>` : ""}</footer>
        </section>`;

      root.querySelectorAll("[data-radar-tab]").forEach((button) => button.addEventListener("click", () => {
        activeTab = button.dataset.radarTab;
        render();
      }));
      root.querySelectorAll("[data-radar-date]").forEach((button) => button.addEventListener("click", () => {
        activeDate = button.dataset.radarDate;
        activeCategory = "全部";
        render();
      }));
      root.querySelectorAll("[data-radar-category]").forEach((button) => button.addEventListener("click", () => {
        activeCategory = button.dataset.radarCategory;
        render();
      }));
      root.querySelectorAll("[data-radar-action]").forEach((button) => button.addEventListener("click", async () => {
        const id = button.dataset.itemId, action = button.dataset.radarAction;
        const current = loadPool();
        const latestItem = itemMap.get(id) || current.find((item) => item.id === id);
        if (!latestItem) return;
        if (action === "add") { savePool([latestItem, ...current.filter((item) => item.id !== id)].slice(0, 80)); render(); }
        else if (action === "remove") { savePool(current.filter((item) => item.id !== id)); render(); }
        else if (action === "copy") {
          try {
            await navigator.clipboard.writeText(copyText(latestItem));
            const old = button.textContent; button.textContent = "已复制";
            setTimeout(() => { if (button.isConnected) button.textContent = old; }, 1200);
          } catch { window.prompt("复制下面的选题卡：", copyText(latestItem)); }
        }
      }));
    }
    render();
  }

  function scan() { document.querySelectorAll("[data-ai-radar], .ai-radar").forEach((root) => mount(root)); }
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
})();