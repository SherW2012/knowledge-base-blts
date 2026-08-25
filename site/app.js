const state = {
  index: null,
  route: { kind: "home" },
  selectedPath: null,
  currentMarkdown: "",
  headingFrame: null
};

const elements = {
  sidebar: document.querySelector("#sidebar"),
  tree: document.querySelector("#tree"),
  search: document.querySelector("#searchInput"),
  navContext: document.querySelector("#navContext"),
  navCaption: document.querySelector("#navCaption"),
  docCount: document.querySelector("#docCount"),
  syncDot: document.querySelector("#syncDot"),
  syncText: document.querySelector("#syncText"),
  breadcrumbs: document.querySelector("#breadcrumbs"),
  meta: document.querySelector("#documentMeta"),
  article: document.querySelector("#article"),
  toc: document.querySelector("#pageToc"),
  layout: document.querySelector("#readingLayout"),
  scroll: document.querySelector("#readingScroll"),
  progress: document.querySelector("#readingProgress"),
  menu: document.querySelector("#menuButton"),
  overlay: document.querySelector("#overlay"),
  theme: document.querySelector("#themeButton"),
  home: document.querySelector("#homeButton")
};

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const displayName = (value) => value.replace(/\.md$/i, "").replace(/^\d{2}-/, "");
const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");
const decodePath = (value) => value.split("/").map((part) => decodeURIComponent(part)).join("/");

function flattenDocuments(nodes, output = []) {
  for (const node of nodes || []) {
    if (node.type === "document") output.push(node);
    else flattenDocuments(node.children, output);
  }
  return output;
}

function department(name) {
  return state.index.departments.find((item) => item.name === name);
}

function allDocuments() {
  return state.index.departments.flatMap((item) => flattenDocuments(item.tree));
}

function findDocument(path) {
  return allDocuments().find((item) => item.path === path);
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw) return { kind: "home" };
  const [kind, ...parts] = raw.split("/");
  try {
    if (kind === "department" && parts[0]) return { kind, department: decodeURIComponent(parts[0]) };
    if (kind === "topic" && parts.length) return { kind, path: decodePath(parts.join("/")) };
    if (kind === "doc" && parts.length) return { kind, path: decodePath(parts.join("/")) };
  } catch {}
  return { kind: "home" };
}

function go(hash) {
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

function bindRoutes(container = document) {
  container.querySelectorAll("[data-route]").forEach((node) => {
    node.addEventListener("click", () => go(node.dataset.route));
  });
}

function renderBreadcrumb(items) {
  const normalized = Array.isArray(items) ? items : [{ label: items }];
  elements.breadcrumbs.innerHTML = normalized.map((item, index) => {
    const separator = index ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : "";
    const label = escapeHtml(item.label);
    const crumb = item.route
      ? `<button class="breadcrumb-link" data-route="${escapeHtml(item.route)}">${label}</button>`
      : `<span class="breadcrumb-current">${label}</span>`;
    return `${separator}${crumb}`;
  }).join("");
  bindRoutes(elements.breadcrumbs);
}

function setChrome({ breadcrumb, meta, toc = false, wide = false }) {
  renderBreadcrumb(breadcrumb);
  elements.meta.textContent = meta || "";
  elements.meta.hidden = !meta;
  elements.toc.hidden = !toc;
  elements.layout.classList.toggle("portal-layout", wide);
  elements.scroll.scrollTop = 0;
  elements.progress.style.width = "0";
}

function cardIcon(mark) {
  return `<span class="portal-card-mark">${escapeHtml(mark)}</span>`;
}

function directDocuments(nodes, readmePath) {
  return (nodes || []).filter((node) => node.type === "document" && node.path !== readmePath);
}

function directFolders(nodes) {
  return (nodes || []).filter((node) => node.type === "folder");
}

function renderFolderCards(folders) {
  return folders.map((folder, index) => `
    <button class="portal-card topic-card" data-route="#/topic/${encodePath(folder.path)}">
      <span class="topic-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="portal-card-body"><strong>${escapeHtml(folder.name)}</strong><small>${countDocuments([folder])} 篇文档</small></span><i>→</i>
    </button>`).join("");
}

function renderArticleList(documents) {
  return `
    <div class="chapter-list article-list">
      ${documents.map((doc) => `
        <button class="chapter-row article-row" data-route="#/doc/${encodePath(doc.path)}">
          <span aria-hidden="true">◆</span>
          <span class="article-row-copy"><strong>${escapeHtml(doc.name)}</strong><small>${doc.words.toLocaleString()} 字</small></span>
          <i>→</i>
        </button>`).join("")}
    </div>`;
}

function renderHome() {
  const total = state.index.departments.reduce((sum, item) => sum + item.documents, 0);
  setChrome({ breadcrumb: [{ label: "知识库总入口", route: "#/" }], meta: `${state.index.departments.length} 个部门 · ${total} 篇文档`, wide: true });
  elements.article.innerHTML = `
    <section class="portal-hero">
      <div class="welcome-kicker">BLTS KNOWLEDGE SYSTEM</div>
      <h1>${escapeHtml(state.index.title)}</h1>
      <p>${escapeHtml(state.index.subtitle)}</p>
      <div class="portal-stats"><span><strong>${state.index.departments.length}</strong> 个部门</span><span><strong>${total}</strong> 篇文档</span><span><strong>1</strong> 个统一入口</span></div>
    </section>
    <section class="portal-section">
      <div class="section-heading"><div><span>DEPARTMENTS</span><h2>按部门进入知识体系</h2></div><p>目录直接来自仓库，内容调整后无需手工维护网页菜单。</p></div>
      <div class="portal-grid departments-grid">
        ${state.index.departments.map((item) => `
          <button class="portal-card department-card" data-route="#/department/${encodeURIComponent(item.name)}">
            ${cardIcon(item.mark)}
            <span class="portal-card-body"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></span>
            <span class="portal-card-foot"><b>${item.documents}</b> 篇文档 <i>→</i></span>
          </button>`).join("")}
      </div>
    </section>`;
  document.title = state.index.title;
  bindRoutes(elements.article);
}

function renderDepartment(name) {
  const item = department(name);
  if (!item) return renderNotFound();
  const readmePath = `${item.name}/README.md`;
  const readme = item.tree.find((node) => node.type === "document" && node.path === readmePath);
  const standaloneDocuments = directDocuments(item.tree, readmePath);
  setChrome({
    breadcrumb: [
      { label: "知识库", route: "#/" },
      { label: item.name, route: `#/department/${encodeURIComponent(item.name)}` }
    ],
    meta: `${item.documents} 篇文档 · ${item.topics.length} 个主题`,
    wide: true
  });
  elements.article.innerHTML = `
    <section class="department-hero">
      ${cardIcon(item.mark)}
      <div><div class="welcome-kicker">DEPARTMENT</div><h1>${escapeHtml(item.name)}</h1><p>${escapeHtml(item.description)}</p></div>
    </section>
    ${item.topics.length ? `<section class="portal-section">
      <div class="section-heading"><div><span>KNOWLEDGE AREAS</span><h2>主题与知识库</h2></div><p>选择一个主题进入完整目录。</p></div>
      <div class="portal-grid topics-grid">
        ${item.topics.map((topic, index) => `
          <button class="portal-card topic-card" data-route="#/topic/${encodePath(topic.path)}">
            <span class="topic-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="portal-card-body"><strong>${escapeHtml(topic.name)}</strong><small>${topic.documents} 篇文档</small></span><i>→</i>
          </button>`).join("")}
      </div>
    </section>` : ""}
    ${standaloneDocuments.length ? `<section class="portal-section">
      <div class="section-heading"><div><span>ARTICLES</span><h2>独立文章</h2></div><p>直接归属于${escapeHtml(item.name)}的内容。</p></div>
      ${renderArticleList(standaloneDocuments)}
    </section>` : ""}
    ${!item.topics.length && !standaloneDocuments.length ? `<div class="empty-state department-empty">这个部门暂时只有说明页。</div>` : ""}
    ${readme ? `<button class="quiet-link" data-route="#/doc/${encodePath(readme.path)}">查看部门说明 →</button>` : ""}`;
  document.title = `${item.name} · ${state.index.title}`;
  bindRoutes(elements.article);
}

function findFolder(nodes, path) {
  for (const node of nodes || []) {
    if (node.type !== "folder") continue;
    if (node.path === path) return node;
    const nested = findFolder(node.children, path);
    if (nested) return nested;
  }
  return null;
}

function findTopic(topicPath) {
  const [departmentName] = topicPath.split("/");
  const item = department(departmentName);
  const topic = findFolder(item?.tree, topicPath);
  return topic ? { department: item, topic } : null;
}

function folderBreadcrumb(path) {
  const rawParts = path.split("/");
  return rawParts.map((part, index) => ({
    label: displayName(part),
    route: index === 0
      ? `#/department/${encodeURIComponent(rawParts[0])}`
      : `#/topic/${encodePath(rawParts.slice(0, index + 1).join("/"))}`
  }));
}

function renderTopic(topicPath) {
  const found = findTopic(topicPath);
  if (!found) return renderNotFound();
  const docs = flattenDocuments([found.topic]);
  const readmePath = `${topicPath}/README.md`;
  const readme = found.topic.children.find((node) => node.type === "document" && node.path === readmePath);
  const folders = directFolders(found.topic.children);
  const standaloneDocuments = directDocuments(found.topic.children, readmePath);
  const startDocument = readme || standaloneDocuments[0] || docs[0];
  setChrome({ breadcrumb: folderBreadcrumb(topicPath), meta: `${docs.length} 篇文档`, wide: true });
  elements.article.innerHTML = `
    <section class="topic-hero">
      <button class="back-label" data-route="#/department/${encodeURIComponent(found.department.name)}">${escapeHtml(found.department.name)}</button>
      <div class="welcome-kicker">KNOWLEDGE AREA</div>
      <h1>${escapeHtml(found.topic.name)}</h1>
      <p>从目录进入各章节，或从主题首页开始阅读。</p>
      ${startDocument ? `<button class="primary-button" data-route="#/doc/${encodePath(startDocument.path)}">开始阅读 <span>→</span></button>` : ""}
    </section>
    ${folders.length ? `<section class="portal-section topic-overview">
      <div class="section-heading"><div><span>SUBTOPICS</span><h2>子主题</h2></div><p>进入下一层目录继续浏览。</p></div>
      <div class="portal-grid topics-grid">
        ${renderFolderCards(folders)}
      </div>
    </section>` : ""}
    ${standaloneDocuments.length ? `<section class="portal-section topic-overview">
      <div class="section-heading"><div><span>ARTICLES</span><h2>独立文章</h2></div><p>当前目录下可直接阅读的内容。</p></div>
      ${renderArticleList(standaloneDocuments)}
    </section>` : ""}
    ${!folders.length && !standaloneDocuments.length && readme ? `<div class="empty-state topic-empty">这个主题暂时只有说明页。</div>` : ""}
    ${readme ? `<button class="quiet-link" data-route="#/doc/${encodePath(readme.path)}">查看主题说明 →</button>` : ""}`;
  document.title = `${found.topic.name} · ${state.index.title}`;
  bindRoutes(elements.article);
}

function resolveRelative(basePath, raw) {
  const clean = decodeURIComponent(raw.split(/[?#]/)[0]);
  const parts = basePath.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function enhanceDocumentLinks(docPath) {
  elements.article.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src") || "";
    if (src && !/^(https?:|data:|\/)/i.test(src)) image.src = `./content/${encodePath(resolveRelative(docPath, src))}`;
    image.loading = "lazy";
    if (!image.closest(".knowledge-figure")) {
      const figure = document.createElement("figure");
      figure.className = "knowledge-figure";
      image.replaceWith(figure);
      figure.appendChild(image);
      if (image.alt) {
        const caption = document.createElement("figcaption");
        caption.textContent = image.alt;
        figure.appendChild(caption);
      }
    }
  });
  elements.article.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return;
    if (/^(https?:|mailto:)/i.test(href)) { link.target = "_blank"; link.rel = "noreferrer"; return; }
    const target = resolveRelative(docPath, href);
    if (/\.md$/i.test(target)) {
      link.href = `#/doc/${encodePath(target)}`;
    } else {
      link.href = `./content/${encodePath(target)}`;
    }
  });
}

function convertSpecialCodeBlocks() {
  elements.article.querySelectorAll("pre code").forEach((code) => {
    const language = [...code.classList].find((name) => name.startsWith("language-"))?.slice(9);
    if (!["mermaid", "knowledge-map", "knowledge-graph"].includes(language)) return;
    const host = document.createElement("div");
    host.className = language;
    if (language === "mermaid") {
      host.textContent = code.textContent;
    } else {
      const source = document.createElement("div");
      source.className = language === "knowledge-map" ? "kmap-source" : "kg-source";
      source.hidden = true;
      source.textContent = code.textContent;
      host.appendChild(source);
    }
    code.parentElement.replaceWith(host);
  });
}

async function renderDiagrams(docPath) {
  const dark = document.documentElement.dataset.theme === "dark";
  if (window.mermaid && elements.article.querySelector(".mermaid")) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: dark ? {
        background: "#262623", primaryColor: "#31352f", primaryTextColor: "#dfe6de", primaryBorderColor: "#889a8b",
        secondaryColor: "#35302d", secondaryTextColor: "#ecd9d1", secondaryBorderColor: "#b0968f", lineColor: "#aca79d", textColor: "#f0efe7"
      } : {
        background: "#faf9f5", primaryColor: "#e4ebe5", primaryTextColor: "#536363", primaryBorderColor: "#96a498",
        secondaryColor: "#eee6e3", secondaryTextColor: "#6f5c54", secondaryBorderColor: "#b39b95", lineColor: "#7c7a74", textColor: "#292724"
      },
      flowchart: { curve: "basis", htmlLabels: true, nodeSpacing: 36, rankSpacing: 46 },
      sequence: { mirrorActors: false, messageMargin: 32, actorMargin: 70 }
    });
    try { await mermaid.run({ nodes: elements.article.querySelectorAll(".mermaid") }); } catch (error) { console.warn("Mermaid render failed", error); }
  }
  const onOpenDoc = (relative) => {
    const target = resolveRelative(docPath, relative);
    if (findDocument(target)) go(`#/doc/${encodePath(target)}`);
  };
  window.KnowledgeMap?.mountAll(elements.article, { dark, onOpenDoc });
  window.KnowledgeGraph?.mountAll(elements.article, { dark, onOpenDoc });
}

function slugHeading(text, index) {
  return `section-${index}-${text.trim().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fff-]/g, "").slice(0, 28)}`;
}

function buildToc() {
  const headings = [...elements.article.querySelectorAll("h2, h3")];
  elements.toc.innerHTML = "";
  if (!headings.length) { elements.toc.hidden = true; return; }
  elements.toc.hidden = false;
  elements.toc.innerHTML = '<div class="toc-title">本文目录</div>';
  headings.forEach((heading, index) => {
    heading.id = slugHeading(heading.textContent, index);
    const link = document.createElement("a");
    link.className = `toc-link level-${heading.tagName === "H2" ? 2 : 3}`;
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.addEventListener("click", (event) => { event.preventDefault(); heading.scrollIntoView({ behavior: "smooth", block: "start" }); });
    elements.toc.appendChild(link);
  });
}

async function renderDocument(path) {
  const doc = findDocument(path);
  if (!doc) return renderNotFound();
  state.selectedPath = path;
  const rawParts = path.split("/");
  const breadcrumb = rawParts.map((part, index) => {
    if (index === 0) return { label: displayName(part), route: `#/department/${encodeURIComponent(part)}` };
    if (index === rawParts.length - 1) return { label: displayName(part), route: `#/doc/${encodePath(path)}` };
    return { label: displayName(part), route: `#/topic/${encodePath(rawParts.slice(0, index + 1).join("/"))}` };
  });
  setChrome({ breadcrumb, meta: "", toc: true });
  elements.article.classList.add("loading");
  try {
    const response = await fetch(`./content/${encodePath(path)}`);
    if (!response.ok) throw new Error(`无法读取文档（${response.status}）`);
    state.currentMarkdown = await response.text();
    const html = window.marked ? marked.parse(state.currentMarkdown) : `<pre>${escapeHtml(state.currentMarkdown)}</pre>`;
    elements.article.innerHTML = window.DOMPurify ? DOMPurify.sanitize(html, { ADD_TAGS: ["foreignObject"], ADD_ATTR: ["target"] }) : html;
    convertSpecialCodeBlocks();
    enhanceDocumentLinks(path);
    buildToc();
    await renderDiagrams(path);
    document.title = `${doc.title} · ${state.index.title}`;
  } catch (error) {
    elements.article.innerHTML = `<div class="error-card"><h2>暂时无法显示内容</h2><p>${escapeHtml(error.message)}</p></div>`;
    elements.toc.hidden = true;
  } finally {
    elements.article.classList.remove("loading");
  }
}

function renderNotFound() {
  setChrome({ breadcrumb: [{ label: "知识库", route: "#/" }], meta: "路径不存在", wide: true });
  elements.article.innerHTML = '<div class="error-card"><h2>没有找到这个页面</h2><p>目录可能已经调整，请从总入口重新进入。</p><button class="primary-button" data-route="#/">返回总入口</button></div>';
  bindRoutes(elements.article);
}

function treeContext() {
  if (state.route.kind === "topic") return findTopic(state.route.path)?.topic.children || [];
  if (state.route.kind === "doc") {
    const [dep, topic] = state.route.path.split("/");
    return findTopic(`${dep}/${topic}`)?.topic.children || department(dep)?.tree || [];
  }
  if (state.route.kind === "department") return department(state.route.department)?.tree || [];
  return state.index.departments.map((item) => ({ type: "department", name: item.name, mark: item.mark, documents: item.documents }));
}

function routeForDirectory(parts) {
  if (!parts.length) return "#/";
  if (parts.length === 1) return `#/department/${encodeURIComponent(parts[0])}`;
  return `#/topic/${encodePath(parts.join("/"))}`;
}

function sidebarLocation() {
  if (state.route.kind === "department") {
    return { parts: [state.route.department], parentParts: [] };
  }
  if (state.route.kind === "topic") {
    const parts = state.route.path.split("/");
    return { parts, parentParts: parts.slice(0, -1) };
  }
  if (state.route.kind === "doc") {
    const parts = state.route.path.split("/").slice(0, -1);
    return { parts, parentParts: parts };
  }
  return null;
}

function renderSidebarContext(hidden = false) {
  const location = hidden ? null : sidebarLocation();
  if (!location?.parts.length) {
    elements.navContext.hidden = true;
    elements.navContext.innerHTML = "";
    return;
  }

  const parentLabel = location.parentParts.length
    ? displayName(location.parentParts.at(-1))
    : "知识库总览";
  const pathItems = [
    { label: "知识库", route: "#/" },
    ...location.parts.map((part, index) => ({
      label: displayName(part),
      route: index < location.parts.length - 1
        ? routeForDirectory(location.parts.slice(0, index + 1))
        : null
    }))
  ];

  elements.navContext.hidden = false;
  elements.navContext.innerHTML = `
    <button class="nav-back" data-route="${escapeHtml(routeForDirectory(location.parentParts))}" aria-label="返回${escapeHtml(parentLabel)}">
      <span class="nav-back-icon" aria-hidden="true">←</span>
      <span class="nav-back-copy"><small>返回上一级</small><strong>${escapeHtml(parentLabel)}</strong></span>
    </button>
    <div class="nav-path" aria-label="当前位置">
      ${pathItems.map((item, index) => {
        const separator = index ? '<span class="nav-path-separator" aria-hidden="true">›</span>' : "";
        const label = escapeHtml(item.label);
        const crumb = item.route
          ? `<button class="nav-path-link" data-route="${escapeHtml(item.route)}">${label}</button>`
          : `<span class="nav-path-current" aria-current="page">${label}</span>`;
        return `${separator}${crumb}`;
      }).join("")}
    </div>`;
  bindRoutes(elements.navContext);
}

function countDocuments(nodes) {
  return flattenDocuments(nodes).length;
}

function buildTreeNode(node) {
  if (node.type === "department") {
    const button = document.createElement("button");
    button.className = "tree-document department-tree-item";
    button.innerHTML = `<span class="mini-mark">${escapeHtml(node.mark)}</span><span class="tree-label">${escapeHtml(node.name)}</span><span class="folder-count">${node.documents}</span>`;
    button.addEventListener("click", () => go(`#/department/${encodeURIComponent(node.name)}`));
    return button;
  }
  if (node.type === "document") {
    const button = document.createElement("button");
    button.className = `tree-document${node.path === state.selectedPath ? " active" : ""}`;
    button.innerHTML = '<span class="doc-icon">◆</span><span class="tree-label"></span>';
    button.querySelector(".tree-label").textContent = node.name;
    button.addEventListener("click", () => go(`#/doc/${encodePath(node.path)}`));
    return button;
  }
  const group = document.createElement("div");
  group.className = "tree-group";
  const folder = document.createElement("button");
  folder.className = "tree-folder";
  folder.innerHTML = '<span class="chevron">▾</span><span class="tree-label"></span><span class="folder-count"></span>';
  folder.querySelector(".tree-label").textContent = node.name;
  folder.querySelector(".folder-count").textContent = countDocuments([node]);
  folder.addEventListener("click", () => group.classList.toggle("closed"));
  const children = document.createElement("div");
  children.className = "tree-children";
  (node.children || []).forEach((child) => children.appendChild(buildTreeNode(child)));
  group.append(folder, children);
  return group;
}

function renderTree() {
  const query = elements.search.value.trim().toLowerCase();
  elements.tree.innerHTML = "";
  if (query) {
    renderSidebarContext(true);
    const results = allDocuments().filter((doc) => [doc.title, doc.name, doc.path, doc.excerpt, ...(doc.headings || [])].join(" ").toLowerCase().includes(query));
    elements.navCaption.textContent = "搜索结果";
    elements.docCount.textContent = `${results.length} 篇`;
    if (!results.length) elements.tree.innerHTML = '<div class="tree-empty">没有匹配的内容</div>';
    results.slice(0, 80).forEach((doc) => elements.tree.appendChild(buildTreeNode(doc)));
    return;
  }
  renderSidebarContext();
  const nodes = treeContext();
  elements.navCaption.textContent = state.route.kind === "home" ? "知识部门" : "知识目录";
  elements.docCount.textContent = state.route.kind === "home" ? `${state.index.departments.length} 个` : `${countDocuments(nodes)} 篇`;
  nodes.forEach((node) => elements.tree.appendChild(buildTreeNode(node)));
}

function updateReadingPosition() {
  const max = elements.scroll.scrollHeight - elements.scroll.clientHeight;
  const percent = max > 0 ? Math.min(100, Math.max(0, elements.scroll.scrollTop / max * 100)) : 0;
  elements.progress.style.width = `${percent}%`;
  const headings = [...elements.article.querySelectorAll("h2, h3")];
  let active = null;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= 125) active = heading;
    else break;
  }
  elements.toc.querySelectorAll(".toc-link").forEach((link) => link.classList.toggle("active", active && link.hash === `#${active.id}`));
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.overlay.classList.remove("visible");
}

async function renderRoute() {
  state.route = parseRoute();
  state.selectedPath = state.route.kind === "doc" ? state.route.path : null;
  renderTree();
  if (state.route.kind === "department") renderDepartment(state.route.department);
  else if (state.route.kind === "topic") renderTopic(state.route.path);
  else if (state.route.kind === "doc") await renderDocument(state.route.path);
  else renderHome();
  closeSidebar();
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("kb-theme", theme);
  if (state.route.kind === "doc" && state.currentMarkdown) renderDocument(state.route.path);
}

async function boot() {
  try {
    const response = await fetch("./content-index.json");
    if (!response.ok) throw new Error("知识索引读取失败");
    state.index = await response.json();
    elements.syncText.textContent = "内容由 GitHub 自动构建";
    bindRoutes(document);
    await renderRoute();
  } catch (error) {
    elements.syncDot.classList.add("error");
    elements.syncText.textContent = "知识索引不可用";
    elements.article.innerHTML = `<div class="error-card"><h2>无法启动知识库</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

const storedTheme = localStorage.getItem("kb-theme");
setTheme(storedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"), false);
elements.search.addEventListener("input", renderTree);
elements.home.addEventListener("click", () => go("#/"));
elements.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
elements.menu.addEventListener("click", () => { elements.sidebar.classList.add("open"); elements.overlay.classList.add("visible"); });
elements.overlay.addEventListener("click", closeSidebar);
elements.scroll.addEventListener("scroll", () => {
  if (state.headingFrame) return;
  state.headingFrame = requestAnimationFrame(() => { updateReadingPosition(); state.headingFrame = null; });
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); elements.search.focus(); }
  if (event.key === "Escape") closeSidebar();
});

boot();
