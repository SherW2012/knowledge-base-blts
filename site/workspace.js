(() => {
  const renderers = new Map();
  let indexPromise = null;
  let scheduled = false;

  const el = {
    article: document.querySelector("#article"),
    layout: document.querySelector("#readingLayout"),
    toc: document.querySelector("#pageToc"),
    breadcrumbs: document.querySelector("#breadcrumbs"),
    meta: document.querySelector("#documentMeta"),
    tree: document.querySelector("#tree"),
    navContext: document.querySelector("#navContext"),
    navCaption: document.querySelector("#navCaption"),
    docCount: document.querySelector("#docCount"),
    scroll: document.querySelector("#readingScroll"),
    progress: document.querySelector("#readingProgress"),
    footer: document.querySelector(".page-footer")
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);

  const route = () => {
    const raw = location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/");
    try {
      if (parts[0] === "app" && parts[1] && parts[2]) {
        // 第四段是应用内部视图（页签），可省略；应用 id 本身不含斜杠
        return {
          kind: "app",
          department: decodeURIComponent(parts[1]),
          appId: decodeURIComponent(parts[2]),
          view: parts[3] ? decodeURIComponent(parts.slice(3).join("/")) : ""
        };
      }
      if (parts[0] === "department" && parts[1]) return { kind: "department", department: decodeURIComponent(parts[1]) };
    } catch {}
    return { kind: "other" };
  };

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(`./content-index.json?v=${Date.now()}`, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`content-index ${response.status}`);
          return response.json();
        });
    }
    return indexPromise;
  }

  function department(index, name) {
    return index.departments?.find((item) => item.name === name) || null;
  }

  function appRoute(departmentName, appId) {
    return `#/app/${encodeURIComponent(departmentName)}/${encodeURIComponent(appId)}`;
  }

  function departmentRoute(name) {
    return `#/department/${encodeURIComponent(name)}`;
  }

  function statusLabel(status) {
    if (status === "live") return "运行中";
    if (status === "beta") return "Beta";
    if (status === "planned") return "规划中";
    return status || "应用";
  }

  function appCard(app, dep) {
    const chips = (app.capabilities || []).slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    return `
      <button class="workspace-app-card" data-workspace-open="${escapeHtml(app.id)}">
        <span class="workspace-app-icon">${escapeHtml(app.mark || "APP")}</span>
        <span class="workspace-app-copy">
          <span class="workspace-app-kicker"><b class="workspace-status workspace-status-${escapeHtml(app.status || "live")}"></b>${escapeHtml(statusLabel(app.status))} · ${escapeHtml(app.eyebrow || "APPLICATION")}</span>
          <strong>${escapeHtml(app.title)}</strong>
          <small>${escapeHtml(app.description || "")}</small>
          ${chips ? `<span class="workspace-app-chips">${chips}</span>` : ""}
        </span>
        <span class="workspace-app-enter">进入工作台 <i>→</i></span>
      </button>`;
  }

  function bindAppCards(container, dep) {
    container.querySelectorAll("[data-workspace-open]").forEach((button) => {
      button.addEventListener("click", () => { location.hash = appRoute(dep.name, button.dataset.workspaceOpen); });
    });
  }

  function restoreKnowledgeLayout() {
    el.article?.classList.remove("workspace-article");
    el.layout?.classList.remove("workspace-layout");
    if (el.footer) el.footer.textContent = "知识与应用由 GitHub 自动构建";
  }

  function injectDepartmentApps(index, name) {
    const dep = department(index, name);
    if (!dep || !el.article) return;
    restoreKnowledgeLayout();
    delete el.article.dataset.workspaceRoute;

    const apps = Array.isArray(dep.apps) ? dep.apps : [];
    const existing = el.article.querySelector("[data-department-apps]");
    if (!apps.length) { existing?.remove(); return; }
    if (existing) return;

    const section = document.createElement("section");
    section.className = "portal-section workspace-app-section";
    section.dataset.departmentApps = name;
    section.innerHTML = `
      <div class="section-heading workspace-section-heading">
        <div><span>APPLICATIONS</span><h2>应用与工作台</h2></div>
        <p>这里是可交互的软件模块。知识文档在下方单独管理。</p>
      </div>
      <div class="workspace-app-grid">${apps.map((app) => appCard(app, dep)).join("")}</div>`;

    const hero = el.article.querySelector(".department-hero");
    if (hero) hero.after(section); else el.article.prepend(section);
    bindAppCards(section, dep);

    el.article.querySelectorAll(".portal-section .section-heading").forEach((heading) => {
      const label = heading.querySelector("span")?.textContent?.trim();
      if (label === "KNOWLEDGE AREAS") {
        const title = heading.querySelector("h2");
        const note = heading.querySelector("p");
        if (title) title.textContent = "知识与资料";
        if (note) note.textContent = "长期沉淀的 Markdown 文档、主题与参考资料。";
      }
    });
  }

  function appSidebar(dep, currentApp) {
    if (!el.tree) return;
    const apps = Array.isArray(dep.apps) ? dep.apps : [];
    if (el.navContext) { el.navContext.hidden = true; el.navContext.innerHTML = ""; }
    if (el.navCaption) el.navCaption.textContent = `${dep.name}应用`;
    if (el.docCount) el.docCount.textContent = `${apps.length} 个`;
    el.tree.innerHTML = `
      <button class="workspace-side-back" data-workspace-back>← 返回${escapeHtml(dep.name)}首页</button>
      <div class="workspace-side-apps">
        ${apps.map((app) => `<button class="workspace-side-app ${app.id === currentApp.id ? "active" : ""}" data-workspace-side-app="${escapeHtml(app.id)}"><span>${escapeHtml(app.mark || "APP")}</span><strong>${escapeHtml(app.title)}</strong></button>`).join("")}
      </div>`;
    el.tree.querySelector("[data-workspace-back]")?.addEventListener("click", () => { location.hash = departmentRoute(dep.name); });
    el.tree.querySelectorAll("[data-workspace-side-app]").forEach((button) => {
      button.addEventListener("click", () => { location.hash = appRoute(dep.name, button.dataset.workspaceSideApp); });
    });
  }

  function appChrome(dep, app) {
    if (el.layout) el.layout.classList.add("portal-layout", "workspace-layout");
    if (el.article) el.article.classList.add("workspace-article");
    if (el.toc) { el.toc.hidden = true; el.toc.innerHTML = ""; }
    if (el.meta) { el.meta.hidden = false; el.meta.textContent = "交互应用 · 非 Markdown 文档"; }
    if (el.progress) el.progress.style.width = "0";
    if (el.scroll) el.scroll.scrollTop = 0;
    if (el.footer) el.footer.textContent = "BLTS Personal OS · 知识与应用由 GitHub 自动构建";
    if (el.breadcrumbs) {
      el.breadcrumbs.innerHTML = `<button class="breadcrumb-link" data-workspace-department>${escapeHtml(dep.name)}</button><span class="breadcrumb-separator">/</span><span class="breadcrumb-current">${escapeHtml(app.title)}</span>`;
      el.breadcrumbs.querySelector("[data-workspace-department]")?.addEventListener("click", () => { location.hash = departmentRoute(dep.name); });
    }
    document.title = `${app.title} · ${dep.name} · BLTS`;
    appSidebar(dep, app);
  }

  function renderApp(index, name, appId, view) {
    const dep = department(index, name);
    const app = dep?.apps?.find((item) => item.id === appId);
    if (!dep || !app || !el.article) return;
    const key = `${name}/${appId}`;
    if (el.article.dataset.workspaceRoute === key && el.article.querySelector("[data-workspace-app-root]")) return;

    appChrome(dep, app);
    el.article.dataset.workspaceRoute = key;
    el.article.innerHTML = `
      <section class="workspace-app-shell" data-workspace-app-root="${escapeHtml(key)}">
        <header class="workspace-app-header">
          <div>
            <div class="workspace-app-header-kicker">${escapeHtml(dep.name.toUpperCase())} / ${escapeHtml(app.eyebrow || "APPLICATION")}</div>
            <h1>${escapeHtml(app.title)}</h1>
            <p>${escapeHtml(app.description || "")}</p>
          </div>
          <button class="workspace-close-app" data-workspace-close>返回${escapeHtml(dep.name)} <span>↗</span></button>
        </header>
        <div class="workspace-app-stage" data-workspace-host></div>
      </section>`;
    el.article.querySelector("[data-workspace-close]")?.addEventListener("click", () => { location.hash = departmentRoute(dep.name); });

    const host = el.article.querySelector("[data-workspace-host]");
    const renderer = renderers.get(app.renderer || app.id);
    if (renderer) renderer({ host, app, department: dep, index, view });
    else host.innerHTML = `<div class="workspace-missing-app"><strong>应用渲染器未注册</strong><p>${escapeHtml(app.renderer || app.id)}</p></div>`;
  }

  function registerRenderer(id, renderer) {
    if (id && typeof renderer === "function") renderers.set(id, renderer);
    schedule();
  }

  async function sync() {
    scheduled = false;
    const current = route();
    let index;
    try { index = await loadIndex(); } catch { return; }
    const latest = route();
    if (JSON.stringify(current) !== JSON.stringify(latest)) return schedule();
    if (latest.kind === "app") renderApp(index, latest.department, latest.appId, latest.view);
    else if (latest.kind === "department") injectDepartmentApps(index, latest.department);
    else restoreKnowledgeLayout();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(sync);
  }

  registerRenderer("ai-radar", ({ host }) => {
    host.innerHTML = '<div class="ai-radar" data-ai-radar></div>';
  });

  window.BLTSWorkspace = { registerRenderer, refresh: schedule };
  new MutationObserver(schedule).observe(el.article || document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule); else schedule();
})();
