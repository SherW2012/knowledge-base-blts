/* 交互式知识图谱：可缩放 / 拖动 / 展开收起。无外部依赖。
   数据源：Markdown 中的 ```knowledge-map 代码块（缩进大纲 + links 跨连线）。 */
(function () {
  "use strict";

  const LIGHT_PALETTE = [
    { fill: "#e4ebe5", border: "#96a498", text: "#465447" }, // 鼠尾草绿
    { fill: "#eee6e3", border: "#b39b95", text: "#6a5750" }, // 灰玫瑰
    { fill: "#ebe8ed", border: "#a29aa8", text: "#5b5462" }, // 雾薰衣草
    { fill: "#e7ebeb", border: "#94a3a3", text: "#485656" }, // 灰青
    { fill: "#eee9df", border: "#b3a386", text: "#695f4d" }, // 暖沙
    { fill: "#e7ebe3", border: "#9da58b", text: "#545c4a" }, // 橄榄
  ];
  const DARK_PALETTE = [
    { fill: "#31352f", border: "#889a8b", text: "#dfe6de" },
    { fill: "#35302d", border: "#b0968f", text: "#ecd9d1" },
    { fill: "#322f37", border: "#9d95a4", text: "#e2dbe9" },
    { fill: "#2d3434", border: "#8ba0a0", text: "#d9e6e6" },
    { fill: "#35322a", border: "#b3a386", text: "#e8e0cf" },
    { fill: "#313528", border: "#9da58b", text: "#dfe6cf" },
  ];
  const ROOT_LIGHT = { fill: "#d97757", border: "#bd5d3a", text: "#fdf6f1" };
  const ROOT_DARK = { fill: "#d98b6a", border: "#e6a486", text: "#241a15" };
  const EDGE_LIGHT = "#cfc9bc", EDGE_DARK = "#4a463f";
  const CROSS_LIGHT = "#d97757", CROSS_DARK = "#d98b6a";

  const NODE_H = 34, PAD_X = 15, V_SLOT = 46, H_GAP = 54, FONT = 13;

  let _ctx = null;
  function textWidth(label) {
    if (!_ctx) {
      _ctx = document.createElement("canvas").getContext("2d");
      _ctx.font = `600 ${FONT}px Inter, "Microsoft YaHei", sans-serif`;
    }
    return _ctx.measureText(label).width;
  }

  // 大纲解析：2 空格 = 一级缩进。 " -> file.md" 关联文档。 links: 段用 "A ~ B : 说明"。
  function parseMap(src) {
    const lines = src.replace(/\r/g, "").split("\n");
    let title = "知识总图";
    const root = { label: title, doc: null, children: [], depth: 0 };
    const stack = [{ node: root, indent: -1 }];
    const links = [];
    let inLinks = false;

    for (const raw of lines) {
      if (!raw.trim()) continue;
      const trimmed = raw.trim();
      if (/^root\s*:/i.test(trimmed)) { root.label = trimmed.replace(/^root\s*:/i, "").trim() || title; continue; }
      if (/^links\s*:/i.test(trimmed)) { inLinks = true; continue; }

      if (inLinks) {
        const m = trimmed.replace(/^-\s*/, "").split(/\s*~\s*/);
        if (m.length >= 2) {
          const right = m[1].split(/\s*:\s*/);
          links.push({ from: m[0].trim(), to: right[0].trim(), label: (right[1] || "").trim() });
        }
        continue;
      }

      const indent = raw.match(/^\s*/)[0].replace(/\t/g, "  ").length;
      let label = trimmed.replace(/^-\s*/, "");
      let doc = null;
      const arrow = label.split(/\s*->\s*/);
      if (arrow.length > 1) { label = arrow[0].trim(); doc = arrow[1].trim(); }
      const node = { label, doc, children: [], depth: 0 };
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1].node;
      node.depth = parent.depth + 1;
      parent.children.push(node);
      stack.push({ node, indent });
    }
    return { root, links };
  }

  class KnowledgeMap {
    constructor(host, source, opts) {
      this.host = host;
      this.opts = opts || {};
      const parsed = parseMap(source);
      this.root = parsed.root;
      this.links = parsed.links;
      this.storeKey = "kmap:" + this.root.label;
      this.t = { x: 0, y: 0, k: 1 };
      this._id = 0;
      this._byLabel = new Map();
      this._initState();
      this._buildDom();
      this._bind();
      this.layout();
      this._restoreView();
      this.draw();
    }

    _initState() {
      const saved = this._load();
      const walk = (n, path) => {
        n.id = "n" + this._id++;
        n.path = path;
        if (!this._byLabel.has(n.label)) this._byLabel.set(n.label, n);
        const hasKids = n.children.length > 0;
        if (saved && saved.collapsed) n.collapsed = saved.collapsed.includes(path) && hasKids;
        else n.collapsed = hasKids && n.depth >= 2; // 默认展开到二级
        n.children.forEach((c) => walk(c, path + "/" + c.label));
      };
      walk(this.root, this.root.label);
      if (saved && saved.t) this.t = saved.t;
      this._hasSavedView = !!(saved && saved.t);
    }

    _buildDom() {
      this.host.classList.add("kmap");
      this.host.innerHTML = `
        <div class="kmap-bar">
          <span class="kmap-title">${escape(this.root.label)}</span>
          <span class="kmap-hint">滚轮缩放 · 拖动平移 · 点击展开/收起</span>
          <span class="kmap-tools">
            <button data-act="expand" title="全部展开">展开</button>
            <button data-act="collapse" title="全部收起">收起</button>
            <button data-act="out" title="缩小">−</button>
            <button data-act="in" title="放大">＋</button>
            <button data-act="fit" title="适应视图">复位</button>
          </span>
        </div>
        <div class="kmap-stage">
          <svg class="kmap-svg"><g class="kmap-view"></g></svg>
        </div>`;
      this.svg = this.host.querySelector(".kmap-svg");
      this.view = this.host.querySelector(".kmap-view");
      this.stage = this.host.querySelector(".kmap-stage");
    }

    _palette(node) {
      const dark = this.opts.dark;
      if (node === this.root) return dark ? ROOT_DARK : ROOT_LIGHT;
      const pal = dark ? DARK_PALETTE : LIGHT_PALETTE;
      return pal[(node.branch || 0) % pal.length];
    }

    layout() {
      // 记录每个节点所属主分支（用于配色），并计算列宽
      this.root.children.forEach((c, i) => { const b = i; const stamp = (n) => { n.branch = b; n.children.forEach(stamp); }; stamp(c); });

      const colW = {};
      const measure = (n) => {
        n._li = n.doc ? 20 : 0;            // 左侧“打开文档”图标让位
        n._ri = n.children.length ? 16 : 0; // 右侧展开/收起按钮让位
        n.w = Math.max(64, textWidth(n.label) + PAD_X * 2 + n._li + n._ri);
        colW[n.depth] = Math.max(colW[n.depth] || 0, n.w);
        if (!n.collapsed) n.children.forEach(measure);
      };
      measure(this.root);

      const colX = {}; let acc = 0;
      const depths = Object.keys(colW).map(Number).sort((a, b) => a - b);
      for (const d of depths) { colX[d] = acc; acc += colW[d] + H_GAP; }

      let leaf = 0;
      const assign = (n) => {
        n.x = colX[n.depth];
        const kids = n.collapsed ? [] : n.children;
        if (!kids.length) { n.y = leaf * V_SLOT; leaf += 1; return n.y; }
        let first, last;
        kids.forEach((k, i) => { const y = assign(k); if (i === 0) first = y; last = y; });
        n.y = (first + last) / 2;
        return n.y;
      };
      assign(this.root);

      this._visible = [];
      const collect = (n) => { this._visible.push(n); if (!n.collapsed) n.children.forEach(collect); };
      collect(this.root);

      const xs = this._visible.map((n) => n.x), rs = this._visible.map((n) => n.x + n.w);
      const ys = this._visible.map((n) => n.y);
      this.bbox = {
        x: Math.min(...xs), y: Math.min(...ys) - NODE_H / 2,
        w: Math.max(...rs) - Math.min(...xs), h: (Math.max(...ys) - Math.min(...ys)) + NODE_H,
      };
    }

    draw() {
      const dark = this.opts.dark;
      const edge = dark ? EDGE_DARK : EDGE_LIGHT, cross = dark ? CROSS_DARK : CROSS_LIGHT;
      const parts = [];

      // 层级连线
      const drawEdges = (n) => {
        if (n.collapsed) return;
        for (const c of n.children) {
          const x1 = n.x + n.w, y1 = n.y, x2 = c.x, y2 = c.y, mx = (x1 + x2) / 2;
          parts.push(`<path class="kmap-edge" d="M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" stroke="${edge}"/>`);
          drawEdges(c);
        }
      };
      drawEdges(this.root);

      // 跨模块连线（仅当两端可见）
      const vis = new Set(this._visible);
      for (const lk of this.links) {
        const a = this._byLabel.get(lk.from), b = this._byLabel.get(lk.to);
        if (!a || !b || !vis.has(a) || !vis.has(b)) continue;
        const ax = a.x + a.w / 2, ay = a.y + NODE_H / 2, bx = b.x + b.w / 2, by = b.y + NODE_H / 2;
        const cy = Math.max(ay, by) + 34 + Math.abs(ax - bx) * 0.06;
        parts.push(`<path class="kmap-cross" d="M${ax} ${ay} Q ${(ax + bx) / 2} ${cy}, ${bx} ${by}" stroke="${cross}"/>`);
        if (lk.label) parts.push(`<text class="kmap-cross-label" x="${(ax + bx) / 2}" y="${cy - 2}" fill="${cross}">${escape(lk.label)}</text>`);
      }

      // 节点
      for (const n of this._visible) {
        const p = this._palette(n);
        const y = n.y - NODE_H / 2;
        const canToggle = n.children.length > 0;
        parts.push(`<g class="kmap-node${canToggle ? " toggle" : ""}${n.doc ? " has-doc" : ""}" data-id="${n.id}" transform="translate(${n.x} ${y})">`);
        parts.push(`<rect width="${n.w}" height="${NODE_H}" rx="9" fill="${p.fill}" stroke="${p.border}"/>`);
        const tx = (n._li || 0) + (n.w - (n._li || 0) - (n._ri || 0)) / 2;
        parts.push(`<text x="${tx}" y="${NODE_H / 2 + 1}" fill="${p.text}" text-anchor="middle" dominant-baseline="middle">${escape(n.label)}</text>`);
        if (canToggle) {
          parts.push(`<g class="kmap-toggle" transform="translate(${n.w - 3} ${NODE_H / 2})">`);
          parts.push(`<circle r="8" fill="${p.border}"/>`);
          parts.push(`<text y="1" text-anchor="middle" dominant-baseline="middle" fill="${p.fill}">${n.collapsed ? "+" : "−"}</text></g>`);
        }
        if (n.doc) {
          parts.push(`<g class="kmap-open" transform="translate(11 ${NODE_H / 2})"><title>打开文档</title>`);
          parts.push(`<circle r="7.5" fill="none" stroke="${p.border}" stroke-width="1.3"/>`);
          parts.push(`<text y="1" text-anchor="middle" dominant-baseline="middle" fill="${p.border}" style="font-size:10px">↗</text></g>`);
        }
        parts.push(`</g>`);
      }

      this.view.innerHTML = parts.join("");
      this._applyTransform();
    }

    _applyTransform() {
      this.view.setAttribute("transform", `translate(${this.t.x} ${this.t.y}) scale(${this.t.k})`);
    }

    fit() {
      const r = this.stage.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return; // 舞台尚无尺寸，交给 _fitWhenReady 重试
      const pad = 46;
      const k = Math.min((r.width - pad) / this.bbox.w, (r.height - pad) / this.bbox.h, 1.15);
      this.t.k = Math.max(0.25, Math.min(1.6, k));
      this.t.x = (r.width - this.bbox.w * this.t.k) / 2 - this.bbox.x * this.t.k;
      this.t.y = (r.height - this.bbox.h * this.t.k) / 2 - this.bbox.y * this.t.k;
      this._applyTransform();
      this._save();
    }

    _restoreView() { if (this._hasSavedView) this._applyTransform(); else this._fitWhenReady(0); }

    _fitWhenReady(tries) {
      const r = this.stage.getBoundingClientRect();
      if ((r.width < 40 || r.height < 40) && tries < 40) {
        requestAnimationFrame(() => this._fitWhenReady(tries + 1));
        return;
      }
      this.fit();
    }

    _zoom(factor, cx, cy) {
      const r = this.stage.getBoundingClientRect();
      cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy;
      const k2 = Math.max(0.2, Math.min(2.4, this.t.k * factor));
      const ratio = k2 / this.t.k;
      this.t.x = cx - (cx - this.t.x) * ratio;
      this.t.y = cy - (cy - this.t.y) * ratio;
      this.t.k = k2;
      this._applyTransform();
      this._save();
    }

    _toggleNode(id) {
      const n = this._visible.find((v) => v.id === id) || this._find(this.root, id);
      if (!n || !n.children.length) return false;
      n.collapsed = !n.collapsed;
      this.layout();
      this.draw();
      this._save();
      return true;
    }

    _find(n, id) { if (n.id === id) return n; for (const c of n.children) { const r = this._find(c, id); if (r) return r; } return null; }

    _setAll(collapsed) {
      const walk = (n) => { if (n.children.length && n !== this.root) n.collapsed = collapsed; n.children.forEach(walk); };
      walk(this.root);
      this.layout(); this.draw(); this._save();
    }

    _bind() {
      this.host.querySelector(".kmap-tools").addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (!act) return;
        if (act === "in") this._zoom(1.2);
        else if (act === "out") this._zoom(1 / 1.2);
        else if (act === "fit") this.fit();
        else if (act === "expand") this._setAll(false);
        else if (act === "collapse") this._setAll(true);
      });

      this.stage.addEventListener("wheel", (e) => {
        e.preventDefault();
        const r = this.stage.getBoundingClientRect();
        this._zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });

      let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
      this.stage.addEventListener("pointerdown", (e) => {
        dragging = true; moved = false; sx = e.clientX; sy = e.clientY; ox = this.t.x; oy = this.t.y;
        this.stage.setPointerCapture(e.pointerId);
      });
      this.stage.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; this.host.classList.add("dragging"); }
        this.t.x = ox + dx; this.t.y = oy + dy; this._applyTransform();
      });
      const end = () => { if (dragging) { dragging = false; this.host.classList.remove("dragging"); this._save(); } };
      this.stage.addEventListener("pointerup", (e) => {
        if (!moved) this._onClick(e);
        end();
      });
      this.stage.addEventListener("pointerleave", end);
      this.stage.addEventListener("pointercancel", end);
    }

    _onClick(e) {
      const g = e.target.closest(".kmap-node");
      if (!g) return;
      const node = this._find(this.root, g.dataset.id);
      if (!node) return;
      // ↗ 图标：打开文档
      if (e.target.closest(".kmap-open") && node.doc && this.opts.onOpenDoc) { this.opts.onOpenDoc(node.doc); return; }
      // 有子节点：点击盒子或 ± 均为展开/收起（主操作）
      if (node.children.length) { this._toggleNode(node.id); return; }
      // 叶子节点：整体点击打开文档
      if (node.doc && this.opts.onOpenDoc) this.opts.onOpenDoc(node.doc);
    }

    _collapsedList() {
      const out = [];
      const walk = (n) => { if (n.collapsed && n.children.length) out.push(n.path); n.children.forEach(walk); };
      walk(this.root);
      return out;
    }
    _save() { try { localStorage.setItem(this.storeKey, JSON.stringify({ collapsed: this._collapsedList(), t: this.t })); } catch (e) {} }
    _load() { try { return JSON.parse(localStorage.getItem(this.storeKey) || "null"); } catch (e) { return null; } }
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.KnowledgeMap = {
    mountAll(container, opts) {
      container.querySelectorAll(".knowledge-map").forEach((host) => {
        const src = host.querySelector(".kmap-source");
        if (!src) return;
        const source = src.textContent;
        try { new KnowledgeMap(host, source, opts); }
        catch (err) { host.innerHTML = `<div class="kmap-error">知识图谱解析失败：${escape(err.message)}</div>`; console.warn(err); }
      });
    },
  };
})();
