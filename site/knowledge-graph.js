/* 全局知识网络图：力导向布局，节点可拖动、可缩放平移，章节成簇、跨章节连线高亮。
   无外部依赖。数据源：Markdown 中的 ```knowledge-graph 代码块。 */
(function () {
  "use strict";

  const CAT_LIGHT = [
    { fill: "#8a9a6f", ring: "#6f7d56", text: "#3f4a30" }, // 橄榄
    { fill: "#6f93a3", ring: "#557785", text: "#324650" }, // 灰蓝
    { fill: "#c08f5f", ring: "#a2723f", text: "#5e4327" }, // 赭黄
    { fill: "#9d7f9e", ring: "#7f6280", text: "#4c3b4d" }, // 灰紫
    { fill: "#cf8560", ring: "#b1633c", text: "#653a24" }, // 赤陶
    { fill: "#7aa397", ring: "#5c8579", text: "#334b43" }, // 青瓷
    { fill: "#b57f88", ring: "#95616a", text: "#573940" }, // 灰玫
    { fill: "#9d9a6c", ring: "#7f7c50", text: "#4b4930" }, // 卡其
  ];
  const CAT_DARK = [
    { fill: "#9fb083", ring: "#c3d3a5", text: "#0f130a" },
    { fill: "#84a9bb", ring: "#a9cbdb", text: "#0c1319" },
    { fill: "#d6a877", ring: "#e9c79a", text: "#1a1206" },
    { fill: "#b596b6", ring: "#d3b8d4", text: "#150f16" },
    { fill: "#e2977", ring: "#f0b399", text: "#1a0f08" },
    { fill: "#8fbcae", ring: "#b0d8ca", text: "#0b1512" },
    { fill: "#cc96a0", ring: "#e6b8c0", text: "#170a0e" },
    { fill: "#b8b483", ring: "#d6d2a5", text: "#12110a" },
  ];
  CAT_DARK[4].fill = "#e29777";
  const EDGE_LIGHT = "#cabfae", EDGE_DARK = "#4d4840";
  const CROSS_LIGHT = "#c96a44", CROSS_DARK = "#e0997a";

  function parseGraph(src) {
    const lines = src.replace(/\r/g, "").split("\n");
    const cats = [], nodes = [], edges = [];
    let cur = -1, mode = "nodes", title = "知识网络";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^title\s*:/i.test(line)) { title = line.replace(/^title\s*:/i, "").trim(); continue; }
      if (/^links\s*:/i.test(line)) { mode = "links"; continue; }
      const cat = line.match(/^(?:分类|cat|#)\s*[:：]?\s*(.+)$/i);
      if (cat && mode === "nodes") { cats.push(cat[1].trim()); cur = cats.length - 1; continue; }
      if (mode === "links") {
        const m = line.replace(/^-\s*/, "").split(/\s+[-–—]+\s+/);
        if (m.length >= 2) {
          const right = m[1].split(/\s*[:：]\s*/);
          edges.push({ a: m[0].trim(), b: right[0].trim(), label: (right[1] || "").trim() });
        }
        continue;
      }
      // 节点行：用 ; 分隔多个节点
      for (let seg of line.split(/\s*[;；]\s*/)) {
        seg = seg.trim(); if (!seg) continue;
        let doc = null;
        const arrow = seg.split(/\s*->\s*/);
        if (arrow.length > 1) { seg = arrow[0].trim(); doc = arrow[1].trim(); }
        nodes.push({ label: seg, cat: Math.max(0, cur), doc });
      }
    }
    return { title, cats, nodes, edges };
  }

  class ForceGraph {
    constructor(host, src, opts) {
      this.host = host; this.opts = opts || {};
      const g = parseGraph(src);
      this.title = g.title; this.cats = g.cats;
      this.nodes = g.nodes; this.edges = [];
      this.byLabel = new Map();
      this.nodes.forEach((n, i) => { n.id = i; if (!this.byLabel.has(n.label)) this.byLabel.set(n.label, n); });
      for (const e of g.edges) {
        const a = this.byLabel.get(e.a), b = this.byLabel.get(e.b);
        if (a && b && a !== b) this.edges.push({ a, b, label: e.label, cross: a.cat !== b.cat });
      }
      this.nodes.forEach((n) => n.deg = 0);
      this.edges.forEach((e) => { e.a.deg++; e.b.deg++; });
      this.adj = new Map(this.nodes.map((n) => [n, new Set()]));
      this.edges.forEach((e) => { this.adj.get(e.a).add(e.b); this.adj.get(e.b).add(e.a); });

      this.t = { x: 0, y: 0, k: 1 };
      this.alpha = 1; this.raf = null;
      this.storeKey = "kgraph:" + this.title + ":" + this.nodes.length;
      this._dom();
      this._initPositions();
      this._bind();
      this._render();
      this._start();
      if (!this._hasSavedView) this._fitWhenReady(0);
    }

    _fitWhenReady(tries) {
      const r = this.stage.getBoundingClientRect();
      if (r.width < 40 && tries < 40) { requestAnimationFrame(() => this._fitWhenReady(tries + 1)); return; }
      this.fit();
    }

    _cat(i) { return (this.opts.dark ? CAT_DARK : CAT_LIGHT)[i % CAT_LIGHT.length]; }

    _dom() {
      this.host.classList.add("kgraph");
      const legend = this.cats.map((c, i) => {
        const p = this._cat(i);
        return `<span class="kg-leg"><i style="background:${p.fill}"></i>${escape(c)}</span>`;
      }).join("");
      this.host.innerHTML = `
        <div class="kg-bar">
          <span class="kg-title">${escape(this.title)}</span>
          <span class="kg-legend">${legend}</span>
          <span class="kg-tools">
            <button data-act="relayout" title="重新布局">重排</button>
            <button data-act="out" title="缩小">−</button>
            <button data-act="in" title="放大">＋</button>
            <button data-act="fit" title="适应视图">复位</button>
            <button data-act="full" title="全屏" class="kg-full">⛶</button>
          </span>
        </div>
        <div class="kg-stage"><svg class="kg-svg"><g class="kg-view"><g class="kg-edges"></g><g class="kg-nodes"></g></g></svg></div>`;
      this.svg = this.host.querySelector(".kg-svg");
      this.view = this.host.querySelector(".kg-view");
      this.stage = this.host.querySelector(".kg-stage");
      const eg = this.host.querySelector(".kg-edges"), ng = this.host.querySelector(".kg-nodes");
      const dark = this.opts.dark;

      this.edges.forEach((e) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "kg-link" + (e.cross ? " cross" : ""));
        line.setAttribute("stroke", e.cross ? (dark ? CROSS_DARK : CROSS_LIGHT) : (dark ? EDGE_DARK : EDGE_LIGHT));
        eg.appendChild(line); e.el = line;
        if (e.label) {
          const tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
          tx.setAttribute("class", "kg-link-label");
          tx.setAttribute("fill", dark ? CROSS_DARK : CROSS_LIGHT);
          tx.textContent = e.label;
          eg.appendChild(tx); e.labelEl = tx;
        }
      });

      this.nodes.forEach((n) => {
        const p = this._cat(n.cat);
        n.r = 6 + Math.min(n.deg, 9) * 1.25;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "kg-node" + (n.doc ? " has-doc" : ""));
        g.dataset.id = n.id;
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("r", n.r); c.setAttribute("fill", p.fill); c.setAttribute("stroke", p.ring);
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("y", n.r + 12); t.setAttribute("text-anchor", "middle");
        t.setAttribute("fill", this.opts.dark ? "#e9e6da" : "#33302a");
        t.textContent = n.label;
        g.appendChild(c); g.appendChild(t);
        ng.appendChild(g); n.el = g;
      });
    }

    _initPositions() {
      const saved = this._load();
      if (saved && saved.pos && saved.pos.length === this.nodes.length) {
        this.nodes.forEach((n, i) => { n.x = saved.pos[i].x; n.y = saved.pos[i].y; n.vx = 0; n.vy = 0; });
        if (saved.t) { this.t = saved.t; this._hasSavedView = true; }
        this.alpha = 0.02; this._settled = true;
        return;
      }
      const C = Math.max(1, this.cats.length), R = 260;
      this.nodes.forEach((n) => {
        const a = (2 * Math.PI * n.cat) / C;
        n.x = Math.cos(a) * R + (Math.random() - 0.5) * 120;
        n.y = Math.sin(a) * R + (Math.random() - 0.5) * 120;
        n.vx = 0; n.vy = 0;
      });
    }

    _tick() {
      const nodes = this.nodes, alpha = this.alpha;
      const K_REP = 5200, K_SPRING = 0.045, LEN = 96, GRAV = 0.025, CENTER = 0.012, DAMP = 0.86;

      // 章节质心（成簇）
      const cen = {};
      for (const n of nodes) { const c = cen[n.cat] || (cen[n.cat] = { x: 0, y: 0, m: 0 }); c.x += n.x; c.y += n.y; c.m++; }
      for (const k in cen) { cen[k].x /= cen[k].m; cen[k].y /= cen[k].m; }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]; if (a.fixed) continue;
        let fx = 0, fy = 0;
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2), f = K_REP / d2;
          fx += (dx / d) * f; fy += (dy / d) * f;
        }
        const cc = cen[a.cat];
        fx += (cc.x - a.x) * GRAV; fy += (cc.y - a.y) * GRAV;
        fx += -a.x * CENTER; fy += -a.y * CENTER;
        a._fx = fx; a._fy = fy;
      }
      for (const e of this.edges) {
        const a = e.a, b = e.b;
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = K_SPRING * (d - LEN), ux = dx / d, uy = dy / d;
        if (!a.fixed) { a._fx += ux * f; a._fy += uy * f; }
        if (!b.fixed) { b._fx -= ux * f; b._fy -= uy * f; }
      }
      for (const n of nodes) {
        if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
        n.vx = (n.vx + n._fx * alpha) * DAMP;
        n.vy = (n.vy + n._fy * alpha) * DAMP;
        n.x += n.vx; n.y += n.vy;
      }
      this.alpha *= 0.985;
    }

    _start() {
      if (this.raf) return;
      const loop = () => {
        this._tick();
        this._render();
        if (this.alpha > 0.02) { this.raf = requestAnimationFrame(loop); }
        else { this.raf = null; this._save(); }
      };
      this.raf = requestAnimationFrame(loop);
    }
    _stop() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }
    _reheat(a) { this.alpha = Math.max(this.alpha, a || 0.5); this._start(); }

    _render() {
      this.view.setAttribute("transform", `translate(${this.t.x} ${this.t.y}) scale(${this.t.k})`);
      for (const e of this.edges) {
        e.el.setAttribute("x1", e.a.x); e.el.setAttribute("y1", e.a.y);
        e.el.setAttribute("x2", e.b.x); e.el.setAttribute("y2", e.b.y);
        if (e.labelEl) { e.labelEl.setAttribute("x", (e.a.x + e.b.x) / 2); e.labelEl.setAttribute("y", (e.a.y + e.b.y) / 2 - 3); }
      }
      for (const n of this.nodes) n.el.setAttribute("transform", `translate(${n.x} ${n.y})`);
    }

    _bounds() {
      const xs = this.nodes.map((n) => n.x), ys = this.nodes.map((n) => n.y);
      const pad = 60;
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }
    fit() {
      const r = this.stage.getBoundingClientRect();
      if (r.width < 40) return;
      const b = this._bounds();
      this.t.k = Math.max(0.2, Math.min(1.5, Math.min(r.width / b.w, r.height / b.h)));
      this.t.x = (r.width - b.w * this.t.k) / 2 - b.x * this.t.k;
      this.t.y = (r.height - b.h * this.t.k) / 2 - b.y * this.t.k;
      this._render(); this._save();
    }
    _zoom(f, cx, cy) {
      const r = this.stage.getBoundingClientRect();
      cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy;
      const k2 = Math.max(0.15, Math.min(3, this.t.k * f)), ratio = k2 / this.t.k;
      this.t.x = cx - (cx - this.t.x) * ratio; this.t.y = cy - (cy - this.t.y) * ratio; this.t.k = k2;
      this._render(); this._save();
    }
    _toGraph(clientX, clientY) {
      const r = this.stage.getBoundingClientRect();
      return { x: (clientX - r.left - this.t.x) / this.t.k, y: (clientY - r.top - this.t.y) / this.t.k };
    }

    _highlight(node) {
      if (node) {
        const nb = this.adj.get(node);
        this.host.classList.add("kg-focus");
        this.nodes.forEach((n) => n.el.classList.toggle("hot", n === node || nb.has(n)));
        this.edges.forEach((e) => e.el.classList.toggle("hot", e.a === node || e.b === node));
      } else {
        this.host.classList.remove("kg-focus");
        this.nodes.forEach((n) => n.el.classList.remove("hot"));
        this.edges.forEach((e) => e.el.classList.remove("hot"));
      }
    }

    _bind() {
      this.host.querySelector(".kg-tools").addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act; if (!act) return;
        if (act === "in") this._zoom(1.2); else if (act === "out") this._zoom(1 / 1.2);
        else if (act === "fit") this.fit();
        else if (act === "full") this._toggleFull();
        else if (act === "relayout") { this._initPositionsFresh(); this._reheat(1); }
      });
      document.addEventListener("fullscreenchange", () => {
        const on = document.fullscreenElement === this.host;
        this.host.classList.toggle("kg-fs", on);
        const btn = this.host.querySelector(".kg-full");
        if (btn) { btn.textContent = on ? "⤡" : "⛶"; btn.title = on ? "退出全屏" : "全屏"; }
        requestAnimationFrame(() => this.fit());
      });
      this.stage.addEventListener("wheel", (e) => {
        e.preventDefault(); const r = this.stage.getBoundingClientRect();
        this._zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });

      let mode = null, dragNode = null, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
      this.stage.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return; // 仅左键
        e.preventDefault(); // 阻止拖动时选中文字
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
        const g = e.target.closest(".kg-node");
        moved = false; sx = e.clientX; sy = e.clientY;
        try { this.stage.setPointerCapture(e.pointerId); } catch (err) {}
        if (g) {
          dragNode = this.nodes[+g.dataset.id]; dragNode.fixed = true; mode = "node";
          this._reheat(0.4);
        } else { mode = "pan"; ox = this.t.x; oy = this.t.y; }
      });
      this.stage.addEventListener("pointermove", (e) => {
        if (!mode) {
          const g = e.target.closest(".kg-node");
          this._highlight(g ? this.nodes[+g.dataset.id] : null);
          return;
        }
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) { moved = true; this.host.classList.add("grabbing"); }
        if (mode === "pan") { this.t.x = ox + (e.clientX - sx); this.t.y = oy + (e.clientY - sy); this._render(); }
        else if (mode === "node") { const p = this._toGraph(e.clientX, e.clientY); dragNode.x = p.x; dragNode.y = p.y; dragNode.vx = 0; dragNode.vy = 0; this._reheat(0.3); }
      });
      const end = (e) => {
        this.host.classList.remove("grabbing");
        if (mode === "node" && dragNode) {
          dragNode.fixed = false;
          if (!moved && dragNode.doc && this.opts.onOpenDoc) this.opts.onOpenDoc(dragNode.doc);
          dragNode = null;
        }
        if (mode) this._save();
        mode = null;
      };
      this.stage.addEventListener("pointerup", end);
      this.stage.addEventListener("pointercancel", end);
      this.stage.addEventListener("pointerleave", () => this._highlight(null));
    }

    _toggleFull() {
      if (document.fullscreenElement === this.host) { document.exitFullscreen?.(); }
      else if (this.host.requestFullscreen) { this.host.requestFullscreen().catch(() => {}); }
    }

    _initPositionsFresh() {
      const C = Math.max(1, this.cats.length), R = 260;
      this.nodes.forEach((n) => { const a = (2 * Math.PI * n.cat) / C; n.x = Math.cos(a) * R + (Math.random() - 0.5) * 120; n.y = Math.sin(a) * R + (Math.random() - 0.5) * 120; n.vx = 0; n.vy = 0; n.fixed = false; });
    }

    _save() { try { localStorage.setItem(this.storeKey, JSON.stringify({ pos: this.nodes.map((n) => ({ x: Math.round(n.x), y: Math.round(n.y) })), t: this.t })); } catch (e) {} }
    _load() { try { return JSON.parse(localStorage.getItem(this.storeKey) || "null"); } catch (e) { return null; } }
  }

  function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  window.KnowledgeGraph = {
    mountAll(container, opts) {
      container.querySelectorAll(".knowledge-graph").forEach((host) => {
        const src = host.querySelector(".kg-source"); if (!src) return;
        try { new ForceGraph(host, src.textContent, opts); }
        catch (err) { host.innerHTML = `<div class="kg-error">知识图谱解析失败：${escape(err.message)}</div>`; console.warn(err); }
      });
    },
  };
})();
