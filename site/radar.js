(() => {
  const STORAGE_KEY = "blts-radar-topic-pool-v1";
  const DATA_URL = "./content/radar-data/latest.json";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
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

  function tierLabel(tier) {
    return tier === "S" ? "一手" : tier === "A" ? "解释者" : tier === "B" ? "异常信号" : tier;
  }

  function scoreClass(score) {
    if (score >= 90) return "radar-score-hot";
    if (score >= 80) return "radar-score-strong";
    return "radar-score-normal";
  }

  function itemCard(item, inPool = false) {
    const related = (item.relatedSources || []).filter((source) => source.id !== item.source?.id);
    return `
      <article class="radar-card" data-item-id="${escapeHtml(item.id)}">
        <div class="radar-card-top">
          <div class="radar-card-badges">
            <span class="radar-tier radar-tier-${escapeHtml((item.source?.tier || "B").toLowerCase())}">${escapeHtml(tierLabel(item.source?.tier || "B"))}</span>
            <span class="radar-category">${escapeHtml(item.category || "AI 综合")}</span>
          </div>
          <div class="radar-score ${scoreClass(item.radarScore || 0)}"><strong>${escapeHtml(item.radarScore ?? "—")}</strong><span>/100</span></div>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="radar-source-line">
          <span>${escapeHtml(item.source?.name || "未知来源")}</span><span>·</span>
          <time>${escapeHtml(formatDate(item.publishedAt))}</time>
          ${related.length ? `<span>· ${related.length} 个关联信源</span>` : ""}
        </div>
        <p class="radar-summary">${escapeHtml(item.summary || item.description || "")}</p>
        <div class="radar-why"><span>WHY IT MATTERS</span><p>${escapeHtml(item.whyItMatters || "等待分析")}</p></div>
        ${(item.angles || []).length ? `
          <div class="radar-angles"><span>可做选题</span><ul>${item.angles.map((angle) => `<li>${escapeHtml(angle)}</li>`).join("")}</ul></div>` : ""}
        <div class="radar-metrics">
          <span>重要 ${escapeHtml(item.importance ?? "—")}</span><span>新颖 ${escapeHtml(item.novelty ?? "—")}</span>
          <span>相关 ${escapeHtml(item.relevance ?? "—")}</span><span>传播 ${escapeHtml(item.socialPotential ?? "—")}</span>
        </div>
        <div class="radar-actions">
          ${item.url ? `<a class="radar-button radar-button-primary" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看原文 ↗</a>` : ""}
          <button class="radar-button" data-radar-action="${inPool ? "remove" : "add"}" data-item-id="${escapeHtml(item.id)}">${inPool ? "移出选题池" : "加入选题池"}</button>
          <button class="radar-button" data-radar-action="copy" data-item-id="${escapeHtml(item.id)}">复制选题卡</button>
        </div>
      </article>`;
  }

  function sourceCard(source, run) {
    const status = run?.status || (source.kind === "manual" ? "manual" : "unknown");
    const label = status === "ok" ? `已抓取 ${run.items} 条` : status === "error" ? "本次抓取失败" : status === "manual" ? "人工关注" : "等待运行";
    return `
      <div class="radar-source-card">
        <div><span class="radar-tier radar-tier-${escapeHtml((source.tier || "B").toLowerCase())}">${escapeHtml(source.tier || "B")}</span><strong>${escapeHtml(source.name)}</strong></div>
        <small class="radar-source-status radar-source-status-${escapeHtml(status)}">${escapeHtml(label)}</small>
        ${(source.tags || []).length ? `<p>${source.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ")}</p>` : ""}
        ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">打开来源 ↗</a>` : ""}
      </div>`;
  }

  function copyText(item) {
    return [
      `# ${item.title}`, "", `来源：${item.source?.name || ""}`, `原文：${item.url || ""}`, `Radar Score：${item.radarScore ?? ""}`,
      "", `事实：${item.summary || item.description || ""}`, "", `为什么值得看：${item.whyItMatters || ""}`, "", "可做选题：",
      ...(item.angles || []).map((angle) => `- ${angle}`), "", "我的观点："
    ].join("\n");
  }

  async function mount(root) {
    if (root.dataset.radarMounted === "1") return;
    root.dataset.radarMounted = "1";
    root.innerHTML = `<div class="radar-loading">正在读取今日情报雷达…</div>`;

    let data;
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      root.innerHTML = `<div class="radar-empty"><strong>雷达数据暂时不可用</strong><p>${escapeHtml(error.message)}</p></div>`;
      return;
    }

    const itemMap = new Map((data.items || []).map((item) => [item.id, item]));
    let activeTab = "today";

    function render() {
      const pool = loadPool();
      const poolMap = new Map(pool.map((item) => [item.id, item]));
      const runs = new Map((data.sourceRuns || []).map((run) => [run.id, run]));
      const todayContent = (data.items || []).length
        ? `<div class="radar-list">${data.items.map((item) => itemCard(item, poolMap.has(item.id))).join("")}</div>`
        : `<div class="radar-empty"><strong>等待第一次自动扫描</strong><p>工作流运行后，这里会显示每日 Top 情报。</p></div>`;
      const poolContent = pool.length
        ? `<div class="radar-list">${pool.map((item) => itemCard(item, true)).join("")}</div>`
        : `<div class="radar-empty"><strong>选题池还是空的</strong><p>在今日雷达里点击“加入选题池”，候选选题会先保存在当前浏览器。</p></div>`;
      const sourceContent = `<div class="radar-source-grid">${(data.sources || []).map((source) => sourceCard(source, runs.get(source.id))).join("")}</div>`;

      root.innerHTML = `
        <section class="radar-shell">
          <header class="radar-hero">
            <div><div class="radar-kicker">AI INTELLIGENCE RADAR</div><h2>${escapeHtml(data.date || "等待运行")}</h2><p>互联网信息 → 去重聚类 → 情报评分 → 选题。正式知识库仍由人工决定是否沉淀。</p></div>
            <div class="radar-run-state"><span>${data.llm?.enabled ? "LLM ON" : "RULE MODE"}</span><small>${data.llm?.enabled ? escapeHtml(data.llm.model || "LLM") : "未配置大模型 API"}</small></div>
          </header>
          <div class="radar-stat-grid">
            <div><strong>${escapeHtml(data.stats?.configuredSources ?? 0)}</strong><span>信息源</span></div>
            <div><strong>${escapeHtml(data.stats?.scannedItems ?? 0)}</strong><span>抓取</span></div>
            <div><strong>${escapeHtml(data.stats?.eventClusters ?? 0)}</strong><span>事件</span></div>
            <div><strong>${escapeHtml(data.stats?.publishedItems ?? 0)}</strong><span>今日精选</span></div>
          </div>
          <nav class="radar-tabs">
            <button class="${activeTab === "today" ? "active" : ""}" data-radar-tab="today">今日雷达 <span>${escapeHtml(data.items?.length || 0)}</span></button>
            <button class="${activeTab === "pool" ? "active" : ""}" data-radar-tab="pool">选题池 <span>${pool.length}</span></button>
            <button class="${activeTab === "sources" ? "active" : ""}" data-radar-tab="sources">信息源 <span>${escapeHtml(data.sources?.length || 0)}</span></button>
          </nav>
          <div class="radar-panel">${activeTab === "today" ? todayContent : activeTab === "pool" ? poolContent : sourceContent}</div>
          <footer class="radar-footer-note">最近生成：${escapeHtml(formatDate(data.generatedAt))} · 自动源成功 ${escapeHtml(data.stats?.successfulSources ?? 0)} / ${escapeHtml(data.stats?.automatedSources ?? 0)}${data.stats?.failedSources ? ` · <span>${escapeHtml(data.stats.failedSources)} 个源失败，已隔离</span>` : ""}</footer>
        </section>`;

      root.querySelectorAll("[data-radar-tab]").forEach((button) => button.addEventListener("click", () => { activeTab = button.dataset.radarTab; render(); }));
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
