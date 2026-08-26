/* 人像素材库：地图 + 翻页相册。无外部依赖。
   数据源：Markdown 中的 ```portrait-gallery 代码块。
   两种模式：
     模式: 地点 —— 顶部杭州示意地图，标记按地点类型着色，地图下方是按地点分章的相册。
     模式: 风格 —— 没有地图，直接按风格分章，用于收藏不知道地点的客片。 */
(function () {
  "use strict";

  const TURN_MS = 760;
  const PER_PAGE = 4;
  const SINGLE_WIDTH = 720;

  /* ---------------- 分类配色 ----------------
     已知分类给定色相，未知分类由名称散列出稳定色相，
     所以以后新增地点类型或风格不需要改代码。 */
  const HUES = {
    "自然景观": 128, "山野": 118, "江河湖泊": 194, "公园": 138, "湿地": 165,
    "咖啡店": 28, "餐厅": 20, "书店": 45, "民宿": 34,
    "城市街区": 212, "老街": 36, "地铁": 224, "商场": 250,
    "建筑空间": 268, "美术馆": 282, "校园": 96, "工业遗址": 14, "废墟": 8,
    "森系": 148, "梦核": 288, "废土风": 18, "赛博": 200, "胶片": 40,
    "港风": 344, "中式": 6, "日系": 176, "情绪": 236, "极简": 218, "复古": 32
  };

  function hueFor(name) {
    if (HUES[name] != null) return HUES[name];
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
    return hash;
  }

  function palette(name, dark) {
    const h = hueFor(name);
    return dark
      ? { fill: `hsl(${h} 17% 23%)`, border: `hsl(${h} 24% 48%)`, text: `hsl(${h} 34% 82%)`, dot: `hsl(${h} 46% 62%)`, ink: "#1d1b18" }
      : { fill: `hsl(${h} 38% 93%)`, border: `hsl(${h} 28% 63%)`, text: `hsl(${h} 34% 32%)`, dot: `hsl(${h} 44% 50%)`, ink: "#fffaf6" };
  }

  /* ---------------- 杭州示意底图 ----------------
     所有底图要素都用真实经纬度描述，和标记走同一套投影，
     所以标记落点和底图始终对齐。形状为示意简化，不是测绘数据。 */
  const HANGZHOU = {
    bounds: { minLat: 30.10, minLng: 119.98, maxLat: 30.45, maxLng: 120.42 },
    rivers: [
      {
        name: "钱塘江", width: 15,
        line: [[30.030, 119.900], [30.055, 119.960], [30.085, 120.010], [30.125, 120.045], [30.160, 120.070],
          [30.180, 120.100], [30.195, 120.135], [30.205, 120.165], [30.215, 120.190], [30.230, 120.215],
          [30.245, 120.235], [30.265, 120.265], [30.285, 120.300], [30.305, 120.335], [30.325, 120.375],
          [30.345, 120.420], [30.360, 120.470]]
      },
      {
        name: "京杭大运河", width: 6,
        line: [[30.400, 120.100], [30.375, 120.115], [30.350, 120.128], [30.325, 120.142], [30.300, 120.152],
          [30.283, 120.160], [30.270, 120.168], [30.258, 120.178], [30.245, 120.195], [30.235, 120.212]]
      }
    ],
    lakes: [
      {
        name: "西湖",
        ring: [[30.2680, 120.1470], [30.2620, 120.1395], [30.2530, 120.1350], [30.2440, 120.1340], [30.2350, 120.1385],
          [30.2295, 120.1465], [30.2320, 120.1555], [30.2405, 120.1600], [30.2510, 120.1612], [30.2600, 120.1580], [30.2660, 120.1530]]
      },
      {
        name: "湘湖",
        ring: [[30.1640, 120.1920], [30.1670, 120.2040], [30.1580, 120.2110], [30.1480, 120.2070], [30.1465, 120.1955], [30.1550, 120.1895]]
      }
    ],
    greens: [
      {
        name: "西溪湿地", wetland: true, labelAt: [30.2860, 120.0690],
        ring: [[30.2790, 120.0610], [30.2810, 120.0790], [30.2720, 120.0900], [30.2620, 120.0870], [30.2585, 120.0700], [30.2680, 120.0580]]
      },
      {
        name: "西湖群山",
        ring: [[30.2380, 120.0980], [30.2470, 120.1230], [30.2330, 120.1400], [30.2060, 120.1360], [30.1930, 120.1150], [30.2080, 120.0930], [30.2230, 120.0880]]
      },
      {
        name: "良渚", labelAt: [30.4160, 120.0120],
        ring: [[30.4020, 119.9950], [30.4120, 120.0280], [30.3930, 120.0470], [30.3760, 120.0330], [30.3800, 120.0020]]
      },
      {
        name: "半山",
        ring: [[30.3500, 120.1550], [30.3580, 120.1780], [30.3420, 120.1880], [30.3350, 120.1650]]
      },
      {
        name: "超山", labelAt: [30.4300, 120.2900],
        ring: [[30.4250, 120.2750], [30.4350, 120.3100], [30.4150, 120.3250], [30.4020, 120.2950], [30.4100, 120.2720]]
      }
    ],
    places: [
      { name: "余杭", at: [30.360, 120.008] }, { name: "临平", at: [30.398, 120.335] },
      { name: "拱墅", at: [30.336, 120.150] }, { name: "武林", at: [30.281, 120.168] },
      { name: "城西", at: [30.272, 120.098] }, { name: "上城", at: [30.248, 120.192] },
      { name: "之江", at: [30.176, 120.094] }, { name: "滨江", at: [30.202, 120.208] },
      { name: "萧山", at: [30.168, 120.272] }, { name: "下沙", at: [30.318, 120.352] }
    ]
  };

  /* ---------------- 解析 ---------------- */
  const HEADER_KEYS = {
    "标题": "title", "title": "title",
    "模式": "mode", "mode": "mode",
    "城市": "city", "city": "city",
    "说明": "intro", "intro": "intro",
    "范围": "bounds", "bounds": "bounds"
  };

  const isUrl = (value) => /^(https?:\/\/|data:|\.{0,2}\/)/i.test(value);

  function parseGallery(source) {
    const data = {
      title: "人像素材库", mode: "地点", city: "杭州", intro: "",
      bounds: null, groups: []
    };
    let group = null;
    let photoIndex = 0;

    for (const raw of source.replace(/\r/g, "").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) continue;

      const head = line.match(/^@\s*(地点|风格|location|style)?\s*(.*)$/i);
      if (head) {
        const kind = (head[1] || "").toLowerCase();
        const name = head[2].trim();
        if (!name) continue;
        group = {
          name,
          kind: kind === "风格" || kind === "style" ? "风格" : kind === "地点" || kind === "location" ? "地点" : data.mode,
          fields: new Map(),
          photos: []
        };
        data.groups.push(group);
        continue;
      }

      if (line.startsWith("-")) {
        const parts = line.slice(1).split("|").map((part) => part.trim());
        const src = parts[0] && isUrl(parts[0]) ? parts[0] : "";
        const rest = src ? parts.slice(1) : parts;
        const photo = {
          src,
          caption: rest[0] || "",
          note: rest.slice(1).filter(Boolean).join(" · "),
          index: photoIndex,
          group: group ? group.name : ""
        };
        photoIndex += 1;
        if (group) group.photos.push(photo);
        continue;
      }

      const pair = line.match(/^([^:：]+)[:：]\s*(.*)$/);
      if (!pair) continue;
      const key = pair[1].trim();
      const value = pair[2].trim();
      if (!group) {
        const mapped = HEADER_KEYS[key] || HEADER_KEYS[key.toLowerCase()];
        if (mapped === "bounds") {
          const nums = value.split(/[,，\s]+/).map(Number).filter((n) => !Number.isNaN(n));
          if (nums.length === 4) data.bounds = { minLat: nums[0], minLng: nums[1], maxLat: nums[2], maxLng: nums[3] };
        } else if (mapped) {
          data[mapped] = value;
        }
        continue;
      }
      if (/^(坐标|coord|经纬度)$/i.test(key)) {
        const nums = value.split(/[,，\s]+/).map(Number).filter((n) => !Number.isNaN(n));
        if (nums.length >= 2) group.coord = { lat: nums[0], lng: nums[1] };
        group.fields.set("坐标", value);
        continue;
      }
      group.fields.set(key, value);
    }

    data.mode = /风格|style/i.test(data.mode) ? "风格" : "地点";
    data.bounds = data.bounds || HANGZHOU.bounds;
    data.groups.forEach((item, index) => {
      item.order = index + 1;
      item.type = item.fields.get("类型") || item.fields.get("type") || "";
      item.styles = (item.fields.get("风格") || item.fields.get("style") || "")
        .split(/[,，、\/]+/).map((part) => part.trim()).filter(Boolean);
      item.tab = data.mode === "风格" ? item.name : (item.type || "其他");
    });
    return data;
  }

  /* ---------------- 工具 ---------------- */
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  const svgEl = (name, attrs) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
    return node;
  };

  /* ---------------- 组件 ---------------- */
  class PortraitGallery {
    constructor(host, source, opts) {
      this.host = host;
      this.opts = opts || {};
      this.dark = !!this.opts.dark;
      this.data = parseGallery(source);
      this.pages = this.buildPages();
      this.photos = this.data.groups.flatMap((group) => group.photos);
      this.page = 0;
      this.turning = false;
      this.mapActive = false;
      this.mapView = { k: 1, x: 0, y: 0 };
      this.storeKey = `pg:${this.data.title}`;

      this.hasMap = this.data.mode === "地点" && this.data.groups.some((group) => group.coord);
      this.render();
      this.restore();
      this.paint();
    }

    /* 每个章节独占偶数页，翻页永远不会出现半个地点跨在书缝两侧 */
    buildPages() {
      const pages = [];
      for (const group of this.data.groups) {
        const start = pages.length;
        pages.push({ type: "cover", group });
        for (let i = 0; i < group.photos.length; i += PER_PAGE) {
          pages.push({ type: "photos", group, photos: group.photos.slice(i, i + PER_PAGE), from: i });
        }
        if (!group.photos.length) pages.push({ type: "empty", group });
        if ((pages.length - start) % 2) pages.push({ type: "blank", group });
        group.pageStart = start;
      }
      if (!pages.length) pages.push({ type: "blank" }, { type: "blank" });
      return pages;
    }

    get single() { return this.host.clientWidth < SINGLE_WIDTH; }
    get step() { return this.single ? 1 : 2; }
    get lastPage() { return this.single ? this.pages.length - 1 : this.pages.length - 2; }

    tabs() {
      const seen = new Map();
      for (const group of this.data.groups) {
        if (!seen.has(group.tab)) seen.set(group.tab, { name: group.tab, page: group.pageStart, count: 0, photos: 0 });
        const tab = seen.get(group.tab);
        tab.count += 1;
        tab.photos += group.photos.length;
      }
      return [...seen.values()];
    }

    /* ---------------- 骨架 ---------------- */
    render() {
      const totalPhotos = this.photos.length;
      const unit = this.data.mode === "风格" ? "个风格" : "个地点";
      this.host.innerHTML = `
        <div class="pg-bar">
          <span class="pg-title">${esc(this.data.title)}</span>
          <span class="pg-meta">${this.data.groups.length} ${unit} · ${totalPhotos} 张素材</span>
          <div class="pg-tools">
            ${this.hasMap ? '<button type="button" data-act="toggle-map">收起地图</button>' : ""}
            <button type="button" data-act="full" title="全屏">⛶</button>
            <button type="button" data-act="prev" aria-label="上一页">‹</button>
            <button type="button" data-act="next" aria-label="下一页">›</button>
          </div>
        </div>
        ${this.data.intro ? `<p class="pg-intro">${esc(this.data.intro)}</p>` : ""}
        ${this.hasMap ? this.mapMarkup() : ""}
        <div class="pg-album">
          <div class="pg-book" tabindex="0" aria-label="素材相册">
            <div class="pg-book-inner">
              <div class="pg-page pg-page-left"></div>
              <div class="pg-page pg-page-right"></div>
              <div class="pg-spine" aria-hidden="true"></div>
              <div class="pg-leaf" hidden aria-hidden="true">
                <div class="pg-leaf-face pg-leaf-front"></div>
                <div class="pg-leaf-face pg-leaf-back"></div>
                <div class="pg-leaf-shade"></div>
              </div>
            </div>
            <div class="pg-bookmarks" role="tablist" aria-label="书签"></div>
          </div>
          <div class="pg-footer">
            <button type="button" class="pg-turn" data-act="prev">‹ 上一页</button>
            <div class="pg-progress"><span></span></div>
            <span class="pg-counter"></span>
            <button type="button" class="pg-turn" data-act="next">下一页 ›</button>
          </div>
        </div>`;

      this.book = this.host.querySelector(".pg-book");
      this.inner = this.host.querySelector(".pg-book-inner");
      this.left = this.host.querySelector(".pg-page-left");
      this.right = this.host.querySelector(".pg-page-right");
      this.leaf = this.host.querySelector(".pg-leaf");
      this.leafFront = this.host.querySelector(".pg-leaf-front");
      this.leafBack = this.host.querySelector(".pg-leaf-back");
      this.marks = this.host.querySelector(".pg-bookmarks");
      this.counter = this.host.querySelector(".pg-counter");
      this.progress = this.host.querySelector(".pg-progress span");

      this.renderBookmarks();
      if (this.hasMap) this.buildMap();
      this.bind();
    }

    renderBookmarks() {
      this.marks.innerHTML = this.tabs().map((tab) => {
        const color = palette(tab.name, this.dark);
        return `<button type="button" class="pg-mark" role="tab" data-page="${tab.page}"
          style="--pg-fill:${color.fill};--pg-border:${color.border};--pg-text:${color.text}">
          <span>${esc(tab.name)}</span><b>${tab.photos}</b></button>`;
      }).join("");
    }

    /* ---------------- 地图 ---------------- */
    mapMarkup() {
      const groups = this.data.groups.filter((group) => group.coord);
      const legend = [...new Set(groups.map((group) => group.type || "其他"))].map((name) => {
        const color = palette(name, this.dark);
        return `<span class="pg-leg"><i style="background:${color.dot}"></i>${esc(name)}</span>`;
      }).join("");
      return `
        <div class="pg-map">
          <div class="pg-map-stage">
            <svg class="pg-map-svg" role="img" aria-label="${esc(this.data.city)}拍摄地点示意地图"></svg>
            <div class="pg-map-hint">点击地图后可滚轮缩放 · 拖动平移</div>
            <div class="pg-map-zoom">
              <button type="button" data-act="zoom-in" aria-label="放大">＋</button>
              <button type="button" data-act="zoom-out" aria-label="缩小">－</button>
              <button type="button" data-act="zoom-reset" aria-label="复位">◎</button>
            </div>
          </div>
          <aside class="pg-map-side">
            <div class="pg-map-legend">${legend}</div>
            <div class="pg-map-list">
              ${groups.map((group) => {
                const color = palette(group.type || "其他", this.dark);
                return `<button type="button" class="pg-place" data-page="${group.pageStart}" data-group="${esc(group.name)}"
                  style="--pg-fill:${color.fill};--pg-border:${color.border};--pg-text:${color.text};--pg-dot:${color.dot}">
                  <i>${group.order}</i>
                  <span><strong>${esc(group.name)}</strong><small>${esc(group.type || "未分类")} · ${group.photos.length} 张</small></span>
                </button>`;
              }).join("")}
            </div>
          </aside>
        </div>`;
    }

    buildMap() {
      const svg = this.host.querySelector(".pg-map-svg");
      const bounds = this.data.bounds;
      const mid = (bounds.minLat + bounds.maxLat) / 2;
      const cos = Math.cos((mid * Math.PI) / 180);
      const worldW = (bounds.maxLng - bounds.minLng) * cos;
      const worldH = bounds.maxLat - bounds.minLat;
      const H = 1000;
      const W = Math.round((H * worldW) / worldH);
      this.mapSize = { W, H };
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      const project = (lat, lng) => ({
        x: ((lng - bounds.minLng) * cos / worldW) * W,
        y: ((bounds.maxLat - lat) / worldH) * H
      });
      const path = (points, close) => points
        .map((point, index) => {
          const p = project(point[0], point[1]);
          return `${index ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(" ") + (close ? " Z" : "");

      const view = svgEl("g", { class: "pg-map-view" });
      const land = svgEl("rect", { class: "pg-land", x: 0, y: 0, width: W, height: H });
      view.appendChild(land);

      // 经纬网格
      const grid = svgEl("g", { class: "pg-grid" });
      for (let lat = Math.ceil(bounds.minLat * 10) / 10; lat < bounds.maxLat; lat += 0.1) {
        const p = project(lat, bounds.minLng);
        grid.appendChild(svgEl("line", { x1: 0, y1: p.y.toFixed(1), x2: W, y2: p.y.toFixed(1) }));
        const label = svgEl("text", { x: 8, y: (p.y - 6).toFixed(1), class: "pg-grid-label" });
        label.textContent = `${lat.toFixed(1)}°N`;
        grid.appendChild(label);
      }
      for (let lng = Math.ceil(bounds.minLng * 10) / 10; lng < bounds.maxLng; lng += 0.1) {
        const p = project(bounds.minLat, lng);
        grid.appendChild(svgEl("line", { x1: p.x.toFixed(1), y1: 0, x2: p.x.toFixed(1), y2: H }));
        const label = svgEl("text", { x: (p.x + 6).toFixed(1), y: 20, class: "pg-grid-label" });
        label.textContent = `${lng.toFixed(1)}°E`;
        grid.appendChild(label);
      }
      view.appendChild(grid);

      for (const green of HANGZHOU.greens) {
        view.appendChild(svgEl("path", { class: `pg-green${green.wetland ? " wetland" : ""}`, d: path(green.ring, true) }));
      }
      for (const lake of HANGZHOU.lakes) {
        view.appendChild(svgEl("path", { class: "pg-water", d: path(lake.ring, true) }));
      }
      for (const river of HANGZHOU.rivers) {
        view.appendChild(svgEl("path", { class: "pg-river", d: path(river.line, false), "stroke-width": river.width }));
      }

      const labels = svgEl("g", { class: "pg-map-labels" });
      for (const feature of [...HANGZHOU.lakes, ...HANGZHOU.greens]) {
        const anchor = feature.labelAt || feature.ring
          .reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
          .map((value) => value / feature.ring.length);
        const p = project(anchor[0], anchor[1]);
        const text = svgEl("text", { x: p.x.toFixed(1), y: p.y.toFixed(1), class: "pg-feature-label" });
        text.textContent = feature.name;
        labels.appendChild(text);
      }
      for (const place of HANGZHOU.places) {
        const p = project(place.at[0], place.at[1]);
        const text = svgEl("text", { x: p.x.toFixed(1), y: p.y.toFixed(1), class: "pg-place-label" });
        text.textContent = place.name;
        labels.appendChild(text);
      }
      view.appendChild(labels);

      const pins = svgEl("g", { class: "pg-pins" });
      for (const group of this.data.groups) {
        if (!group.coord) continue;
        const p = project(group.coord.lat, group.coord.lng);
        const color = palette(group.type || "其他", this.dark);
        const pin = svgEl("g", { class: "pg-pin", "data-page": group.pageStart, "data-group": group.name });
        pin.dataset.x = p.x;
        pin.dataset.y = p.y;
        pin.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
        pin.appendChild(svgEl("ellipse", { class: "pg-pin-shadow", cx: 0, cy: 2, rx: 8, ry: 3 }));
        pin.appendChild(svgEl("path", {
          class: "pg-pin-body",
          d: "M0,0 C-8,-12 -12,-17 -12,-23 A12,12 0 1,1 12,-23 C12,-17 8,-12 0,0 Z",
          fill: color.dot, stroke: color.border
        }));
        const number = svgEl("text", { class: "pg-pin-number", x: 0, y: -19, fill: color.ink });
        number.textContent = group.order;
        pin.appendChild(number);
        const label = svgEl("text", { class: "pg-pin-label", x: 0, y: 16 });
        label.textContent = group.name;
        pin.appendChild(label);
        pins.appendChild(pin);
      }
      view.appendChild(pins);
      svg.appendChild(view);
      this.mapSvg = svg;
      this.mapViewNode = view;
      this.applyMapView();
      this.bindMap();
    }

    applyMapView() {
      const { k, x, y } = this.mapView;
      this.mapViewNode.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
      this.mapViewNode.classList.toggle("zoomed", k >= 1.55);
      // 反向缩放，保证标记大小恒定
      this.mapViewNode.querySelectorAll(".pg-pin").forEach((pin) => {
        pin.setAttribute("transform", `translate(${(+pin.dataset.x).toFixed(1)},${(+pin.dataset.y).toFixed(1)}) scale(${(1 / k).toFixed(3)})`);
      });
    }

    zoomBy(factor, cx, cy) {
      const next = Math.min(6, Math.max(0.75, this.mapView.k * factor));
      const ratio = next / this.mapView.k;
      const px = cx == null ? this.mapSize.W / 2 : cx;
      const py = cy == null ? this.mapSize.H / 2 : cy;
      this.mapView.x = px - (px - this.mapView.x) * ratio;
      this.mapView.y = py - (py - this.mapView.y) * ratio;
      this.mapView.k = next;
      this.applyMapView();
    }

    svgPoint(event) {
      const rect = this.mapSvg.getBoundingClientRect();
      const scale = Math.min(rect.width / this.mapSize.W, rect.height / this.mapSize.H);
      const offsetX = (rect.width - this.mapSize.W * scale) / 2;
      const offsetY = (rect.height - this.mapSize.H * scale) / 2;
      return {
        x: (event.clientX - rect.left - offsetX) / scale,
        y: (event.clientY - rect.top - offsetY) / scale
      };
    }

    bindMap() {
      const stage = this.host.querySelector(".pg-map-stage");
      let drag = null;

      stage.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".pg-map-zoom")) return;
        this.mapActive = true;
        stage.classList.add("dragging");
        // 指针捕获会把后续事件的 target 改成 stage，所以按下时就记住命中的标记
        drag = {
          x: event.clientX, y: event.clientY,
          ox: this.mapView.x, oy: this.mapView.y,
          pin: event.target.closest(".pg-pin"), moved: false
        };
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const rect = this.mapSvg.getBoundingClientRect();
        const scale = Math.min(rect.width / this.mapSize.W, rect.height / this.mapSize.H) || 1;
        const dx = (event.clientX - drag.x) / scale;
        const dy = (event.clientY - drag.y) / scale;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        this.mapView.x = drag.ox + dx;
        this.mapView.y = drag.oy + dy;
        this.applyMapView();
      });
      const endDrag = () => {
        if (drag && !drag.moved && drag.pin) this.goToPage(+drag.pin.dataset.page, true);
        drag = null;
        stage.classList.remove("dragging");
      };
      stage.addEventListener("pointerup", endDrag);
      stage.addEventListener("pointercancel", () => { drag = null; stage.classList.remove("dragging"); });

      stage.addEventListener("wheel", (event) => {
        if (!this.mapActive && !event.ctrlKey) return;
        event.preventDefault();
        const point = this.svgPoint(event);
        this.zoomBy(event.deltaY < 0 ? 1.16 : 1 / 1.16, point.x, point.y);
      }, { passive: false });

      const outside = (event) => {
        if (!this.host.isConnected) { document.removeEventListener("pointerdown", outside); return; }
        if (!stage.contains(event.target)) this.mapActive = false;
      };
      document.addEventListener("pointerdown", outside);
    }

    /* ---------------- 页面内容 ---------------- */
    pageHtml(index) {
      const page = this.pages[index];
      if (!page) return '<div class="pg-sheet pg-sheet-blank"></div>';
      const folio = `<div class="pg-folio">${index + 1}</div>`;

      if (page.type === "blank") {
        return `<div class="pg-sheet pg-sheet-blank"><span>${esc(page.group ? page.group.name : "")}</span>${folio}</div>`;
      }

      if (page.type === "cover") {
        const group = page.group;
        const color = palette(group.tab, this.dark);
        const chips = [
          group.type ? `<span class="pg-chip primary">${esc(group.type)}</span>` : "",
          ...group.styles.map((style) => {
            const styleColor = palette(style, this.dark);
            return `<span class="pg-chip" style="--pg-fill:${styleColor.fill};--pg-border:${styleColor.border};--pg-text:${styleColor.text}">${esc(style)}</span>`;
          })
        ].join("");
        const skip = new Set(["类型", "type", "风格", "style"]);
        const rows = [...group.fields.entries()]
          .filter(([key]) => !skip.has(key))
          .map(([key, value]) => `<div class="pg-field"><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`)
          .join("");
        return `
          <div class="pg-sheet pg-sheet-cover" style="--pg-fill:${color.fill};--pg-border:${color.border};--pg-text:${color.text};--pg-dot:${color.dot}">
            <div class="pg-cover-index">${String(group.order).padStart(2, "0")}</div>
            <h3 class="pg-cover-name">${esc(group.name)}</h3>
            <div class="pg-chips">${chips}</div>
            ${rows ? `<dl class="pg-fields">${rows}</dl>` : ""}
            <div class="pg-cover-foot">
              <span>${group.photos.length} 张出片素材</span>
              ${group.coord ? '<button type="button" class="pg-locate" data-locate="1">在地图上定位</button>' : ""}
            </div>
            ${folio}
          </div>`;
      }

      if (page.type === "empty") {
        return `
          <div class="pg-sheet pg-sheet-empty">
            <div class="pg-empty-mark">◍</div>
            <p>还没有放入素材</p>
            <small>把照片传到 R2，然后在这一章下面加一行<br><code>- 图片链接 | 说明</code></small>
            ${folio}
          </div>`;
      }

      const cells = [];
      for (let i = 0; i < PER_PAGE; i += 1) {
        const photo = page.photos[i];
        if (!photo) { cells.push('<div class="pg-frame pg-frame-void"></div>'); continue; }
        const inner = photo.src
          ? `<img src="${esc(photo.src)}" alt="${esc(photo.caption || photo.group)}" loading="lazy">`
          : '<div class="pg-frame-empty"><span>＋</span><small>待补充</small></div>';
        cells.push(`
          <figure class="pg-frame${photo.src ? " has-photo" : ""}" data-photo="${photo.index}">
            <div class="pg-frame-inner">${inner}</div>
            <figcaption>
              <strong>${esc(photo.caption || "未命名")}</strong>
              ${photo.note ? `<small>${esc(photo.note)}</small>` : ""}
            </figcaption>
          </figure>`);
      }
      const to = page.from + page.photos.length;
      return `
        <div class="pg-sheet pg-sheet-photos">
          <div class="pg-sheet-head"><span>${esc(page.group.name)}</span><small>${page.from + 1}–${to} / ${page.group.photos.length}</small></div>
          <div class="pg-grid">${cells.join("")}</div>
          ${folio}
        </div>`;
    }

    fillPage(node, index) {
      node.innerHTML = this.pageHtml(index);
      node.querySelectorAll("img").forEach((image) => {
        if (this.opts.resolveSrc && !/^(https?:|data:)/i.test(image.getAttribute("src") || "")) {
          image.src = this.opts.resolveSrc(image.getAttribute("src"));
        }
        image.addEventListener("error", () => {
          const frame = image.closest(".pg-frame");
          if (!frame) return;
          frame.classList.remove("has-photo");
          frame.classList.add("broken");
          image.replaceWith(Object.assign(document.createElement("div"), {
            className: "pg-frame-empty",
            innerHTML: "<span>⃠</span><small>图片打不开</small>"
          }));
        }, { once: true });
      });
    }

    /* ---------------- 翻页 ---------------- */
    paint() {
      this.inner.classList.toggle("single", this.single);
      if (!this.single && this.page % 2) this.page -= 1;
      this.page = Math.max(0, Math.min(this.page, this.lastPage));
      this.fillPage(this.left, this.page);
      if (this.single) this.right.innerHTML = "";
      else this.fillPage(this.right, this.page + 1);
      this.updateChrome();
    }

    updateChrome() {
      const total = this.single ? this.pages.length : Math.ceil(this.pages.length / 2);
      const current = this.single ? this.page + 1 : Math.floor(this.page / 2) + 1;
      this.counter.textContent = this.single ? `第 ${current} / ${total} 页` : `第 ${current} / ${total} 跨页`;
      this.progress.style.width = `${total > 1 ? ((current - 1) / (total - 1)) * 100 : 100}%`;
      const active = this.pages[this.page]?.group;
      this.marks.querySelectorAll(".pg-mark").forEach((mark) => {
        mark.classList.toggle("active", !!active && this.pages[+mark.dataset.page]?.group?.tab === active.tab);
      });
      this.host.querySelectorAll(".pg-place").forEach((place) => {
        place.classList.toggle("active", !!active && place.dataset.group === active.name);
      });
      this.host.querySelectorAll(".pg-pin").forEach((pin) => {
        pin.classList.toggle("active", !!active && pin.dataset.group === active.name);
      });
      this.host.querySelectorAll('[data-act="prev"]').forEach((button) => { button.disabled = this.page <= 0; });
      this.host.querySelectorAll('[data-act="next"]').forEach((button) => { button.disabled = this.page >= this.lastPage; });
      this.save();
    }

    goToPage(target, fromMap) {
      let next = Math.max(0, Math.min(target, this.pages.length - 1));
      if (!this.single && next % 2) next -= 1;
      next = Math.min(next, this.lastPage);
      if (next === this.page) {
        if (fromMap) this.book.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      const direction = next > this.page ? 1 : -1;
      this.turn(next, direction);
      if (fromMap) this.book.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    turn(next, direction) {
      if (this.turning) return;
      if (this.single || !this.leaf) {
        this.page = next;
        this.left.classList.remove("slide-next", "slide-prev");
        void this.left.offsetWidth;
        this.left.classList.add(direction > 0 ? "slide-next" : "slide-prev");
        this.paint();
        return;
      }

      this.turning = true;
      const from = this.page;
      const target = next;
      // 正向：翻动的那一页正面是当前右页，背面是目标左页。
      const frontIndex = direction > 0 ? from + 1 : target + 1;
      const backIndex = direction > 0 ? target : from;
      this.fillPage(this.leafFront, frontIndex);
      this.fillPage(this.leafBack, backIndex);
      this.fillPage(this.left, direction > 0 ? from : target);
      this.fillPage(this.right, direction > 0 ? target + 1 : from + 1);

      this.leaf.hidden = false;
      this.leaf.classList.remove("turning");
      this.leaf.style.transform = direction > 0 ? "rotateY(0deg)" : "rotateY(-180deg)";
      void this.leaf.offsetWidth;
      this.leaf.classList.add("turning", direction > 0 ? "forward" : "backward");
      this.leaf.style.transform = direction > 0 ? "rotateY(-180deg)" : "rotateY(0deg)";

      const settle = (event) => {
        if (event && event.target !== this.leaf) return;
        clearTimeout(this.turnTimer);
        this.leaf.removeEventListener("transitionend", settle);
        this.leaf.classList.remove("turning", "forward", "backward");
        this.leaf.hidden = true;
        this.leaf.style.transform = "";
        this.page = target;
        this.turning = false;
        this.paint();
      };
      this.leaf.addEventListener("transitionend", settle);
      this.turnTimer = setTimeout(settle, TURN_MS + 160);
    }

    next() { this.goToPage(this.page + this.step); }
    prev() { this.goToPage(this.page - this.step); }

    /* ---------------- 灯箱 ---------------- */
    openLightbox(index) {
      this.closeLightbox();
      const box = document.createElement("div");
      box.className = "pg-lightbox";
      box.innerHTML = `
        <button type="button" class="pg-lb-close" aria-label="关闭">×</button>
        <button type="button" class="pg-lb-nav prev" aria-label="上一张">‹</button>
        <figure class="pg-lb-stage"><img alt=""><figcaption></figcaption></figure>
        <button type="button" class="pg-lb-nav next" aria-label="下一张">›</button>`;
      document.body.appendChild(box);
      this.lightbox = box;
      this.lbIndex = index;

      const show = () => {
        const photo = this.photos[this.lbIndex];
        if (!photo) return;
        const image = box.querySelector("img");
        let src = photo.src;
        if (src && this.opts.resolveSrc && !/^(https?:|data:)/i.test(src)) src = this.opts.resolveSrc(src);
        image.src = src || "";
        image.alt = photo.caption || photo.group;
        box.querySelector("figcaption").innerHTML =
          `<strong>${esc(photo.caption || "未命名")}</strong><span>${esc(photo.group)}${photo.note ? ` · ${esc(photo.note)}` : ""}</span>
           <small>${this.lbIndex + 1} / ${this.photos.length}</small>`;
      };
      const move = (delta) => {
        let cursor = this.lbIndex;
        for (let i = 0; i < this.photos.length; i += 1) {
          cursor = (cursor + delta + this.photos.length) % this.photos.length;
          if (this.photos[cursor].src) break;
        }
        this.lbIndex = cursor;
        show();
      };
      show();

      box.addEventListener("click", (event) => {
        if (event.target.closest(".pg-lb-close") || event.target === box) this.closeLightbox();
        else if (event.target.closest(".prev")) move(-1);
        else if (event.target.closest(".next")) move(1);
      });
      this.lbKeys = (event) => {
        if (event.key === "Escape") this.closeLightbox();
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      };
      document.addEventListener("keydown", this.lbKeys);
    }

    closeLightbox() {
      if (this.lbKeys) document.removeEventListener("keydown", this.lbKeys);
      this.lbKeys = null;
      if (this.lightbox) this.lightbox.remove();
      this.lightbox = null;
    }

    /* ---------------- 事件 ---------------- */
    bind() {
      this.host.addEventListener("click", (event) => {
        const action = event.target.closest("[data-act]");
        if (action) {
          const act = action.dataset.act;
          if (act === "next") this.next();
          else if (act === "prev") this.prev();
          else if (act === "zoom-in") this.zoomBy(1.3);
          else if (act === "zoom-out") this.zoomBy(1 / 1.3);
          else if (act === "zoom-reset") { this.mapView = { k: 1, x: 0, y: 0 }; this.applyMapView(); }
          else if (act === "full") {
            if (document.fullscreenElement === this.host) document.exitFullscreen?.();
            else this.host.requestFullscreen?.().catch(() => {});
          }
          else if (act === "toggle-map") {
            const hidden = this.host.classList.toggle("map-hidden");
            action.textContent = hidden ? "展开地图" : "收起地图";
          }
          return;
        }
        const mark = event.target.closest(".pg-mark, .pg-place");
        if (mark) { this.goToPage(+mark.dataset.page, mark.classList.contains("pg-place")); return; }
        if (event.target.closest("[data-locate]")) {
          const group = this.pages[this.page]?.group;
          const pin = group && this.host.querySelector(`.pg-pin[data-group="${CSS.escape(group.name)}"]`);
          if (pin) {
            this.host.classList.remove("map-hidden");
            const button = this.host.querySelector('[data-act="toggle-map"]');
            if (button) button.textContent = "收起地图";
            const stage = this.host.querySelector(".pg-map-stage");
            this.mapView.k = 2.4;
            this.mapView.x = this.mapSize.W / 2 - +pin.dataset.x * this.mapView.k;
            this.mapView.y = this.mapSize.H / 2 - +pin.dataset.y * this.mapView.k;
            this.applyMapView();
            pin.classList.add("ping");
            setTimeout(() => pin.classList.remove("ping"), 1400);
            stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
          return;
        }
        const frame = event.target.closest(".pg-frame.has-photo");
        if (frame) this.openLightbox(+frame.dataset.photo);
      });

      this.book.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); this.next(); }
        if (event.key === "ArrowLeft") { event.preventDefault(); this.prev(); }
      });

      let swipe = null;
      this.book.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;
        swipe = { x: event.clientX, y: event.clientY };
      });
      this.book.addEventListener("pointerup", (event) => {
        if (!swipe) return;
        const dx = event.clientX - swipe.x;
        if (Math.abs(dx) > 55 && Math.abs(event.clientY - swipe.y) < 60) {
          if (dx < 0) this.next(); else this.prev();
        }
        swipe = null;
      });

      let frame = null;
      this.resize = () => {
        // 切换文档后旧实例已经脱离 DOM，顺手把监听摘掉
        if (!this.host.isConnected) { window.removeEventListener("resize", this.resize); return; }
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          const wasSingle = this.inner.classList.contains("single");
          if (wasSingle !== this.single) this.paint();
        });
      };
      window.addEventListener("resize", this.resize);
      document.addEventListener("fullscreenchange", () => {
        if (!this.host.isConnected) return;
        this.host.classList.toggle("is-full", document.fullscreenElement === this.host);
        this.resize();
      });
    }

    save() {
      try { localStorage.setItem(this.storeKey, String(this.page)); } catch (error) { /* 忽略隐私模式 */ }
    }

    restore() {
      try {
        const stored = Number(localStorage.getItem(this.storeKey));
        if (Number.isFinite(stored) && stored > 0) this.page = Math.min(stored, this.lastPage);
      } catch (error) { /* 忽略隐私模式 */ }
    }
  }

  window.PortraitGallery = {
    mountAll(container, opts) {
      container.querySelectorAll(".portrait-gallery").forEach((host) => {
        if (host.dataset.mounted) return;
        const holder = host.querySelector(".pg-source");
        const source = (holder ? holder.textContent : host.textContent).trim();
        if (!source) return;
        try {
          host.dataset.mounted = "1";
          new PortraitGallery(host, source, opts);
        } catch (error) {
          host.innerHTML = `<div class="pg-error">素材库解析失败：${esc(error.message)}</div>`;
          console.warn(error);
        }
      });
    }
  };
})();
