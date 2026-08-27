/* Virtual Gear Room：艺术部的 3D 摄影器材库。
   注册成部门应用（#/app/艺术部/gear-room）。一次只展示一台设备：
   顶部一排图标切换机型，中间是可自由旋转的展台，右侧是参数、参考价与样片外链。
   3D 部分按需动态载入，不支持 WebGL 或加载失败时降级为清单视图，不会白屏。 */
(() => {
  "use strict";

  const DATA_URL = "./gear-data.json";
  const CATEGORY_LABEL = { camera: "相机", phone: "手机", video: "视频", lens: "镜头", accessory: "配件" };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");

  /* 筛选口径：category 只管物理类别，CCD 这类传感器特征走 tag / sensor，
     所以以后加胶片机、加镜头都不用动这套逻辑。 */
  const FILTERS = [
    { id: "all", label: "ALL", match: () => true },
    { id: "camera", label: "CAMERA", match: (g) => g.category === "camera" },
    { id: "ccd", label: "CCD", match: (g) => /CCD/i.test(g.sensor || "") || (g.tags || []).includes("CCD") },
    { id: "phone", label: "PHONE", match: (g) => g.category === "phone" },
    { id: "video", label: "VIDEO", match: (g) => g.category === "video" },
    { id: "favorite", label: "FAVORITE", match: (g) => !!g.favorite }
  ];

  /* 顶部图标：按机身形态画的单线剪影，不用外部图标库 */
  const ICONS = {
    compact: '<rect x="2.5" y="7" width="19" height="11" rx="2"/><circle cx="12" cy="12.5" r="3.6"/><path d="M6 7V5.6h4V7"/><circle cx="18.4" cy="9.6" r=".8"/>',
    "compact-zoom": '<rect x="2.5" y="7" width="19" height="11" rx="2"/><circle cx="11.5" cy="12.5" r="4.3"/><circle cx="11.5" cy="12.5" r="2.1"/><path d="M5.5 7V5.4h4.6V7"/>',
    mirrorless: '<path d="M2.5 9.2h4l1.4-2h5.2l1.4 2h4a1.6 1.6 0 0 1 1.6 1.6v6.6a1.6 1.6 0 0 1-1.6 1.6h-16A1.6 1.6 0 0 1 .9 17.4v-6.6A1.6 1.6 0 0 1 2.5 9.2Z"/><circle cx="11" cy="13.8" r="4"/><circle cx="11" cy="13.8" r="1.8"/>',
    "pocket-gimbal": '<rect x="8.5" y="9" width="7" height="12.2" rx="1.8"/><path d="M9.6 9V6.2a2.4 2.4 0 0 1 4.8 0V9"/><circle cx="12" cy="4.6" r="2.4"/><path d="M10 12.4h4M10 15h4"/>',
    phone: '<rect x="6" y="2.4" width="12" height="19.2" rx="2.4"/><circle cx="9.6" cy="6.4" r="1.5"/><circle cx="9.6" cy="10.2" r="1.5"/><circle cx="13.4" cy="8.3" r="1.5"/><path d="M10.4 19.4h3.2"/>',
    generic: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3.2"/>'
  };
  const iconFor = (gear) => ICONS[gear.form] || ICONS[gear.category] || ICONS.generic;

  function specRows(gear) {
    const rows = [
      ["品牌", gear.brand],
      ["类别", CATEGORY_LABEL[gear.category] || gear.category],
      ["年份", gear.year],
      ["传感器", gear.sensor],
      ["焦段", gear.focalLength],
      ["光圈", gear.aperture],
      ["三围", gear.dimensions ? `${gear.dimensions.join(" × ")} mm` : null],
      ["重量", gear.weight ? `${gear.weight} g` : null]
    ].filter(([, value]) => value != null && value !== "");
    return rows.map(([key, value]) =>
      `<div class="gr-spec"><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("");
  }

  /* 参考价只显示查到出处的，写清日期与来源；查不到就直说，不猜数字 */
  function priceBlock(gear) {
    const price = gear.price;
    if (!price) return "";
    if (!price.text) {
      return `<div class="gr-price"><span class="gr-label">参考价</span>
        <p class="gr-price-none">${esc(price.note || "暂未查到可引用的价格")}</p></div>`;
    }
    const meta = [
      price.asOf ? `口径 ${esc(price.asOf)}` : null,
      price.source ? `<a href="${esc(price.source)}" target="_blank" rel="noreferrer">${esc(price.sourceLabel || "来源")} ↗</a>` : null
    ].filter(Boolean).join(" · ");
    return `<div class="gr-price">
        <span class="gr-label">参考价</span>
        <p class="gr-price-text">${esc(price.text)}</p>
        ${meta ? `<p class="gr-price-meta">${meta}</p>` : ""}
      </div>`;
  }

  /* 样片一律走外链，不把别人的照片下载进仓库 */
  function samplesBlock(gear) {
    const samples = gear.samples || [];
    if (!samples.length) {
      return `<div class="gr-samples"><span class="gr-label">出片范例</span>
        <p class="gr-price-none">还没找到能引用的公开样片库</p></div>`;
    }
    return `<div class="gr-samples">
        <span class="gr-label">出片范例</span>
        <ul>${samples.map((s) =>
          `<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label)} ↗</a></li>`).join("")}</ul>
      </div>`;
  }

  function allDocPaths(index) {
    const paths = new Set();
    const walk = (nodes) => {
      for (const node of nodes || []) {
        if (node.type === "document") paths.add(node.path);
        else walk(node.children);
      }
    };
    (index?.departments || []).forEach((dep) => walk(dep.tree));
    return paths;
  }

  function render({ host, app, index }) {
    host.innerHTML = '<div class="gr-loading">正在打开器材室…</div>';

    fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`gear-data ${response.status}`);
        return response.json();
      })
      .then((data) => mount(host, app, index, data))
      .catch((error) => {
        host.innerHTML = `<div class="gr-error"><strong>器材数据读取失败</strong><p>${esc(error.message)}</p></div>`;
      });
  }

  function mount(host, app, index, data) {
    const gear = (data.gear || []).slice();
    const docPaths = allDocPaths(index);
    const notesDir = data.notesDir || "";
    const noteRoute = (item) => {
      if (!item.note || !notesDir) return null;
      const path = `${notesDir}/${item.note}`;
      return docPaths.has(path) ? `#/doc/${encodePath(path)}` : null;
    };

    host.innerHTML = `
      <section class="gear-room" data-view="stage">
        <header class="gr-head">
          <div class="gr-title">
            <span class="gr-eyebrow">${esc(app?.eyebrow || "VIRTUAL GEAR ROOM")}</span>
            <h2>${esc(data.title || "Virtual Gear Room")}</h2>
          </div>
          <nav class="gr-filters" role="tablist" aria-label="设备筛选">
            ${FILTERS.map((f) => `<button type="button" role="tab" data-filter="${f.id}"${f.id === "all" ? ' aria-selected="true" class="on"' : ""}>${f.label}</button>`).join("")}
          </nav>
          <div class="gr-tools">
            <button type="button" data-act="spin" title="暂停 / 继续自转">⟳</button>
            <button type="button" data-act="reset" title="回到默认视角">复位</button>
            <button type="button" data-act="view" title="切换清单 / 展台">清单</button>
            <button type="button" data-act="full" title="全屏">⛶</button>
          </div>
        </header>

        <nav class="gr-rail" aria-label="切换设备"></nav>

        <div class="gr-body">
          <div class="gr-stage">
            <div class="gr-canvas"></div>
            <div class="gr-plate" aria-hidden="true"></div>
            <p class="gr-hint">拖动自由旋转 · 滚轮或双指缩放 · ← → 换设备</p>
          </div>
          <aside class="gr-panel" aria-live="polite"></aside>
        </div>

        <ol class="gr-list"></ol>
        <p class="gr-note">${esc(data.note || "")}</p>
      </section>`;

    const root = host.querySelector(".gear-room");
    const canvasHost = host.querySelector(".gr-canvas");
    const plate = host.querySelector(".gr-plate");
    const rail = host.querySelector(".gr-rail");
    const panel = host.querySelector(".gr-panel");
    const list = host.querySelector(".gr-list");

    let filter = FILTERS[0];
    let selected = gear[0] || null;
    let studio = null;

    const visible = () => gear.filter((item) => filter.match(item));

    function renderRail() {
      const shown = visible();
      rail.innerHTML = shown.map((item) => `
        <button type="button" class="gr-chip${selected && selected.id === item.id ? " on" : ""}"
                data-gear="${esc(item.id)}" title="${esc(item.name)}"
                aria-pressed="${selected && selected.id === item.id ? "true" : "false"}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${iconFor(item)}</svg>
          <span>${esc(item.shortName || item.name)}</span>
        </button>`).join("") || '<p class="gr-rail-empty">这个筛选下没有设备</p>';
    }

    function renderPlate() {
      if (!selected) { plate.innerHTML = ""; return; }
      plate.innerHTML = `<strong>${esc(selected.name)}</strong>`
        + `<span>${esc([selected.focalLength, selected.sensor].filter(Boolean).join(" · ")
            || CATEGORY_LABEL[selected.category] || "")}</span>`;
    }

    function renderPanel() {
      const item = selected;
      if (!item) {
        panel.innerHTML = '<div class="gr-idle"><p class="gr-idle-hint">当前筛选下没有设备，换个筛选看看。</p></div>';
        return;
      }
      const route = noteRoute(item);
      panel.innerHTML = `
        <div class="gr-detail">
          <p class="gr-brand">${esc(item.brand || "")}</p>
          <h3>${esc(item.name)}</h3>
          ${item.status === "pending" ? '<p class="gr-pending">尚未发布，参数与模型待补。</p>' : ""}
          <dl class="gr-specs">${specRows(item)}</dl>
          ${(item.tags || []).length ? `<div class="gr-tags">${item.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
          ${priceBlock(item)}
          ${samplesBlock(item)}
          ${(item.usage || []).length ? `<div class="gr-usage"><span class="gr-label">常用于</span><ul>${item.usage.map((u) => `<li>${esc(u)}</li>`).join("")}</ul></div>` : ""}
          <div class="gr-actions">
            ${route ? `<a class="gr-link" href="${route}">使用经验 →</a>` : '<span class="gr-link muted">使用经验待写</span>'}
          </div>
          <div class="gr-step">
            <button type="button" data-act="prev" aria-label="上一台">← 上一台</button>
            <button type="button" data-act="next" aria-label="下一台">下一台 →</button>
          </div>
        </div>`;
    }

    function renderList() {
      const shown = visible();
      list.innerHTML = shown.map((item) => `
        <li>
          <button type="button" class="gr-row${selected && selected.id === item.id ? " on" : ""}" data-gear="${esc(item.id)}">
            <span class="gr-row-name"><strong>${esc(item.name)}</strong><small>${esc(item.brand || "")}</small></span>
            <span class="gr-row-spec">${esc(item.sensor || CATEGORY_LABEL[item.category] || "")}</span>
            <span class="gr-row-size">${item.dimensions ? `${item.dimensions[0]} × ${item.dimensions[1]} × ${item.dimensions[2]} mm` : "待补"}</span>
          </button>
        </li>`).join("");
    }

    function select(item) {
      if (!item) return;
      selected = item;
      renderRail();
      renderPlate();
      renderPanel();
      renderList();
      if (studio) studio.show(item);
      const chip = rail.querySelector(".gr-chip.on");
      chip?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    function applyFilter(next) {
      filter = next;
      host.querySelectorAll("[data-filter]").forEach((button) => {
        const on = button.dataset.filter === next.id;
        button.classList.toggle("on", on);
        button.setAttribute("aria-selected", on ? "true" : "false");
      });
      const shown = visible();
      if (!shown.length) {
        selected = null;
        renderRail(); renderPlate(); renderPanel(); renderList();
        return;
      }
      if (!selected || !next.match(selected)) select(shown[0]);
      else { renderRail(); renderList(); }
    }

    function step(delta) {
      const shown = visible();
      if (!shown.length) return;
      const at = selected ? shown.findIndex((g) => g.id === selected.id) : -1;
      select(shown[(at + delta + shown.length) % shown.length]);
    }

    host.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-filter]");
      if (filterButton) {
        applyFilter(FILTERS.find((f) => f.id === filterButton.dataset.filter) || FILTERS[0]);
        return;
      }
      const pick = event.target.closest("[data-gear]");
      if (pick) { select(gear.find((g) => g.id === pick.dataset.gear)); return; }
      const action = event.target.closest("[data-act]");
      if (!action) return;
      const act = action.dataset.act;
      if (act === "prev") step(-1);
      else if (act === "next") step(1);
      else if (act === "reset") studio?.resetView();
      else if (act === "spin") {
        if (!studio) return;
        action.classList.toggle("off", !studio.toggleSpin());
      } else if (act === "view") {
        const listView = root.dataset.view === "list";
        root.dataset.view = listView ? "stage" : "list";
        action.textContent = listView ? "清单" : "展台";
        if (!listView && studio) requestAnimationFrame(() => studio.resize());
      } else if (act === "full") {
        if (document.fullscreenElement === root) document.exitFullscreen?.();
        else root.requestFullscreen?.().catch(() => {});
      }
    });

    const keys = (event) => {
      if (!host.isConnected) { document.removeEventListener("keydown", keys); return; }
      if (event.target.matches("input, textarea")) return;
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      else if (event.key === "r" || event.key === "R") studio?.resetView();
    };
    document.addEventListener("keydown", keys);

    document.addEventListener("fullscreenchange", () => {
      if (!host.isConnected) return;
      root.classList.toggle("is-full", document.fullscreenElement === root);
      if (studio) requestAnimationFrame(() => studio.resize());
    });

    renderRail();
    renderPlate();
    renderPanel();
    renderList();

    /* 3D 按需载入；不支持或失败就停在清单视图 */
    const fallback = (reason) => {
      root.dataset.view = "list";
      root.classList.add("no-3d");
      const button = host.querySelector('[data-act="view"]');
      if (button) { button.textContent = "展台"; button.disabled = true; }
      host.querySelectorAll('[data-act="spin"], [data-act="reset"], [data-act="full"]')
        .forEach((b) => { b.disabled = true; });
      canvasHost.innerHTML = `<div class="gr-fallback"><strong>3D 展台不可用</strong><p>${esc(reason)}</p><p>下面的清单包含全部设备资料。</p></div>`;
    };

    import("./gear-scene.js?v=20260827-gear2")
      .then((module) => {
        if (!host.isConnected) return;
        if (!module.isSupported()) { fallback("这台设备的浏览器没有可用的 WebGL。"); return; }
        const spinButton = host.querySelector('[data-act="spin"]');
        studio = module.createGearStudio(canvasHost, {
          dark: document.documentElement.dataset.theme === "dark",
          // 一上手拖动自转就停了，按钮状态得跟着变，否则显示的和实际不符
          onSpin(on) { spinButton?.classList.toggle("off", !on); }
        });
        if (selected) studio.show(selected);
        if (spinButton) spinButton.classList.toggle("off", !studio.spinning);
        const observer = new ResizeObserver(() => studio && studio.resize());
        observer.observe(canvasHost);
        const teardown = setInterval(() => {
          if (host.isConnected) return;
          clearInterval(teardown);
          observer.disconnect();
          studio.dispose();
          studio = null;
        }, 1500);
      })
      .catch((error) => fallback(`展台模块加载失败：${error.message}`));
  }

  const register = () => window.BLTSWorkspace?.registerRenderer("gear-room", render);
  if (window.BLTSWorkspace) register();
  else window.addEventListener("DOMContentLoaded", register);
})();
