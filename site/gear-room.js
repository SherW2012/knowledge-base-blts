/* Virtual Gear Room：艺术部的 3D 摄影器材库。
   注册成部门应用（#/app/艺术部/gear-room），3D 部分按需动态载入，
   不支持 WebGL 或加载失败时降级为清单视图，不会白屏。 */
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
            <button type="button" data-act="view" title="切换清单 / 场景">清单</button>
            <button type="button" data-act="full" title="全屏">⛶</button>
          </div>
        </header>

        <div class="gr-body">
          <div class="gr-stage">
            <div class="gr-canvas"></div>
            <div class="gr-tip" hidden aria-hidden="true"></div>
            <p class="gr-hint">拖动旋转 · 滚轮缩放 · 点击设备聚焦 · Esc 退出聚焦</p>
          </div>
          <aside class="gr-panel" aria-live="polite"></aside>
        </div>

        <ol class="gr-list"></ol>
        <p class="gr-note">${esc(data.note || "")}</p>
      </section>`;

    const root = host.querySelector(".gear-room");
    const canvasHost = host.querySelector(".gr-canvas");
    const tooltip = host.querySelector(".gr-tip");
    const panel = host.querySelector(".gr-panel");
    const list = host.querySelector(".gr-list");

    let filter = FILTERS[0];
    let selected = null;
    let scene = null;

    const visible = () => gear.filter((item) => filter.match(item));

    function renderPanel() {
      const item = selected;
      if (!item) {
        const shown = visible().length;
        panel.innerHTML = `
          <div class="gr-idle">
            <p class="gr-idle-count">${shown} / ${gear.length}</p>
            <p class="gr-idle-hint">点击桌面上的任意一台设备，镜头会靠过去，这里显示它的资料与用途。</p>
            <div class="gr-step"><button type="button" data-act="next">从第一台看起 →</button></div>
          </div>`;
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
          ${(item.usage || []).length ? `<div class="gr-usage"><span class="gr-label">常用于</span><ul>${item.usage.map((u) => `<li>${esc(u)}</li>`).join("")}</ul></div>` : ""}
          <div class="gr-actions">
            ${route ? `<a class="gr-link" href="${route}">使用经验 →</a>` : '<span class="gr-link muted">使用经验待写</span>'}
            <button type="button" class="gr-back" data-act="reset">退出聚焦</button>
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
      selected = item || null;
      renderPanel();
      renderList();
      root.classList.toggle("focused", !!selected);
      if (scene) {
        if (selected) scene.focus(selected.id);
        else scene.reset();
      }
    }

    function applyFilter(next) {
      filter = next;
      host.querySelectorAll("[data-filter]").forEach((button) => {
        const on = button.dataset.filter === next.id;
        button.classList.toggle("on", on);
        button.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (selected && !next.match(selected)) selected = null;
      if (scene) scene.setVisible(next.match);
      renderPanel();
      renderList();
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
      const row = event.target.closest("[data-gear]");
      if (row) { select(gear.find((g) => g.id === row.dataset.gear)); return; }
      const action = event.target.closest("[data-act]");
      if (!action) return;
      if (action.dataset.act === "reset") select(null);
      else if (action.dataset.act === "prev") step(-1);
      else if (action.dataset.act === "next") step(1);
      else if (action.dataset.act === "view") {
        const listView = root.dataset.view === "list";
        root.dataset.view = listView ? "stage" : "list";
        action.textContent = listView ? "清单" : "场景";
        if (!listView && scene) scene.resize();
      } else if (action.dataset.act === "full") {
        if (document.fullscreenElement === root) document.exitFullscreen?.();
        else root.requestFullscreen?.().catch(() => {});
      }
    });

    const keys = (event) => {
      if (!host.isConnected) { document.removeEventListener("keydown", keys); return; }
      if (event.target.matches("input, textarea")) return;
      if (event.key === "Escape" && selected) { event.preventDefault(); select(null); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    };
    document.addEventListener("keydown", keys);

    document.addEventListener("fullscreenchange", () => {
      if (!host.isConnected) return;
      root.classList.toggle("is-full", document.fullscreenElement === root);
      if (scene) requestAnimationFrame(() => scene.resize());
    });

    renderPanel();
    renderList();

    /* 3D 按需载入；不支持或失败就停在清单视图 */
    const fallback = (reason) => {
      root.dataset.view = "list";
      root.classList.add("no-3d");
      const button = host.querySelector('[data-act="view"]');
      if (button) { button.textContent = "场景"; button.disabled = true; }
      canvasHost.innerHTML = `<div class="gr-fallback"><strong>3D 场景不可用</strong><p>${esc(reason)}</p><p>下面的清单包含全部设备资料。</p></div>`;
    };

    import("./gear-scene.js")
      .then((module) => {
        if (!host.isConnected) return;
        if (!module.isSupported()) { fallback("这台设备的浏览器没有可用的 WebGL。"); return; }
        scene = module.createGearScene(canvasHost, {
          gear,
          dark: document.documentElement.dataset.theme === "dark",
          tooltip,
          onHover(item) {
            if (!item) { tooltip.hidden = true; return; }
            tooltip.hidden = false;
            tooltip.innerHTML = `<strong>${esc(item.name)}</strong>`
              + `<span>${esc([item.focalLength, item.sensor].filter(Boolean).join(" · ") || CATEGORY_LABEL[item.category] || "")}</span>`;
          },
          onSelect(item) { select(item || null); }
        });
        scene.setVisible(filter.match);
        const observer = new ResizeObserver(() => scene && scene.resize());
        observer.observe(canvasHost);
        const teardown = setInterval(() => {
          if (host.isConnected) return;
          clearInterval(teardown);
          observer.disconnect();
          scene.dispose();
          scene = null;
        }, 1500);
      })
      .catch((error) => fallback(`场景模块加载失败：${error.message}`));
  }

  const register = () => window.BLTSWorkspace?.registerRenderer("gear-room", render);
  if (window.BLTSWorkspace) register();
  else window.addEventListener("DOMContentLoaded", register);
})();
