/* 诗词：古风书架与竖排翻页书。无外部依赖。
   数据源：Markdown 中的 ```poetry（一集）与 ```poetry-shelf（书架）代码块。
   竖排用 writing-mode: vertical-rl，落在普通 div 上，不放在 button 上。 */
(function () {
  "use strict";

  const TURN_MS = 820;
  const SINGLE_WIDTH = 760;

  /* 封面配色：石青、赭石、松烟、绛红 */
  const INKS = {
    "青": { deep: "#33544c", mid: "#456c62", light: "#7fa093", paper: "#eef3ef" },
    "赭": { deep: "#7a4f2c", mid: "#96683d", light: "#c39a6f", paper: "#f6efe4" },
    "墨": { deep: "#2f3134", mid: "#464a4f", light: "#8d9296", paper: "#eeefef" },
    "绛": { deep: "#6f2b2f", mid: "#8c3b3c", light: "#bd7d78", paper: "#f6ebe8" },
    "苍": { deep: "#3d4f66", mid: "#516782", light: "#8fa2ba", paper: "#eceff4" }
  };
  const inkOf = (name) => INKS[name] || INKS["青"];

  const esc = (value) => String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  /* 元信息键：短、不含中文标点，且必须出现在正文之前 */
  const META = /^([^\s，。、；：！？「」（）]{1,8})[:：]\s*(.+)$/;

  function parseBook(source) {
    const book = { title: "诗集", subtitle: "", ink: "青", seal: "", intro: "", layout: "竖排", pieces: [] };
    const HEAD = {
      "集名": "title", "标题": "title", "title": "title",
      "副题": "subtitle", "副标题": "subtitle",
      "色": "ink", "印": "seal", "说明": "intro", "简介": "intro", "排版": "layout"
    };
    let piece = null;

    for (const raw of source.replace(/\r/g, "").split("\n")) {
      const line = raw.trim();
      if (line.startsWith("#") || line.startsWith("//")) continue;

      if (line.startsWith("@")) {
        piece = { title: line.slice(1).trim() || "无题", fields: new Map(), blocks: [], body: false };
        book.pieces.push(piece);
        continue;
      }

      if (!line) {
        // 正文里的空行是段落分隔，正文之前的空行忽略
        if (piece && piece.body && piece.blocks.length && piece.blocks.at(-1).length) piece.blocks.push([]);
        continue;
      }

      if (!piece) {
        const pair = line.match(META);
        const key = pair && (HEAD[pair[1]] || HEAD[pair[1].toLowerCase()]);
        if (key) book[key] = pair[2].trim();
        continue;
      }

      if (line.startsWith("|")) {            // 强制当正文，绕开元信息判断
        pushLine(piece, line.slice(1).trim());
        continue;
      }
      const pair = piece.body ? null : line.match(META);
      if (pair) { piece.fields.set(pair[1].trim(), pair[2].trim()); continue; }
      pushLine(piece, line);
    }

    book.layout = /横/.test(book.layout) ? "横排" : "竖排";
    book.seal = book.seal || book.title.slice(0, 1);
    book.pieces.forEach((item, index) => {
      item.order = index + 1;
      item.genre = item.fields.get("体裁") || item.fields.get("词牌") || "";
      item.blocks = item.blocks.filter((block) => block.length);
      item.prose = /散文|随笔|散记|杂记|赋|记|序|铭|论|说/.test(item.genre);
      item.lines = item.blocks.flat().length;
    });
    return book;
  }

  function pushLine(piece, text) {
    piece.body = true;
    if (!piece.blocks.length) piece.blocks.push([]);
    piece.blocks.at(-1).push(text);
  }

  function parseShelf(source) {
    const shelf = { title: "诗词", intro: "", books: [] };
    let book = null;
    for (const raw of source.replace(/\r/g, "").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) continue;
      if (line.startsWith("@")) {
        book = { title: line.slice(1).trim(), subtitle: "", ink: "青", seal: "", doc: "", intro: "", count: "" };
        shelf.books.push(book);
        continue;
      }
      const pair = line.match(META);
      if (!pair) continue;
      const key = pair[1].trim();
      const value = pair[2].trim();
      if (!book) {
        if (key === "标题" || key === "题") shelf.title = value;
        if (key === "说明" || key === "简介") shelf.intro = value;
        continue;
      }
      if (key === "副题" || key === "副标题") book.subtitle = value;
      else if (key === "色") book.ink = value;
      else if (key === "印") book.seal = value;
      else if (key === "文档" || key === "doc") book.doc = value;
      else if (key === "简介" || key === "说明") book.intro = value;
      else if (key === "篇数") book.count = value;
    }
    shelf.books.forEach((item) => { item.seal = item.seal || item.title.slice(0, 1); });
    return shelf;
  }

  /* 封面：底色 + 双线框 + 回纹角 + 折枝纹样，纯 SVG，可随尺寸缩放 */
  function coverArt(inkName, motif) {
    const ink = inkOf(inkName);
    const corner = (x, y, sx, sy) =>
      `<path d="M0 26 L0 0 L26 0 M6 20 L6 6 L20 6" transform="translate(${x} ${y}) scale(${sx} ${sy})"
         fill="none" stroke="${ink.light}" stroke-width="2.4" opacity=".55"/>`;
    const leaves = `
      <g opacity=".22" stroke="${ink.light}" fill="none" stroke-width="1.6">
        <path d="M150 250 C120 220 118 176 150 150 C182 176 180 220 150 250 Z"/>
        <path d="M150 250 L150 150"/>
        <path d="M112 322 C92 300 92 272 112 252 C132 272 132 300 112 322 Z"/>
        <path d="M112 322 L112 252"/>
        <path d="M188 322 C168 300 168 272 188 252 C208 272 208 300 188 322 Z"/>
        <path d="M188 322 L188 252"/>
        <path d="M150 250 L112 288 M150 250 L188 288"/>
      </g>`;
    const grass = `
      <g opacity=".24" stroke="${ink.light}" fill="none" stroke-width="1.6" stroke-linecap="round">
        <path d="M104 336 C112 292 128 262 150 240"/>
        <path d="M126 336 C130 296 142 268 158 250"/>
        <path d="M150 336 C150 292 154 260 162 232"/>
        <path d="M174 336 C170 298 178 268 196 246"/>
        <path d="M196 336 C190 300 204 274 224 256"/>
        <path d="M86 336 C94 306 102 288 116 272"/>
      </g>`;
    return `
      <svg class="gu-cover-art" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="gu-${inkName}-${motif}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${ink.mid}"/><stop offset="1" stop-color="${ink.deep}"/>
          </linearGradient>
        </defs>
        <rect width="300" height="420" fill="url(#gu-${inkName}-${motif})"/>
        <rect x="16" y="16" width="268" height="388" fill="none" stroke="${ink.light}" stroke-width="1.6" opacity=".62"/>
        <rect x="23" y="23" width="254" height="374" fill="none" stroke="${ink.light}" stroke-width="0.9" opacity=".4"/>
        ${corner(16, 16, 1, 1)}${corner(284, 16, -1, 1)}${corner(16, 404, 1, -1)}${corner(284, 404, -1, -1)}
        ${motif === "grass" ? grass : leaves}
      </svg>`;
  }

  const coverMotif = (title) => /绒|草/.test(title) ? "grass" : "leaf";

  function coverMarkup(book, extraClass) {
    const ink = inkOf(book.ink);
    return `
      <div class="gu-cover ${extraClass || ""}" style="--gu-ink-deep:${ink.deep};--gu-ink-mid:${ink.mid};--gu-ink-light:${ink.light};--gu-ink-paper:${ink.paper}">
        ${coverArt(book.ink, coverMotif(book.title))}
        <div class="gu-cover-face">
          <div class="gu-cover-title">${esc(book.title)}</div>
          ${book.subtitle ? `<div class="gu-cover-sub">${esc(book.subtitle)}</div>` : ""}
          <div class="gu-seal" aria-hidden="true">${esc(book.seal)}</div>
        </div>
      </div>`;
  }

  /* ---------------- 书架 ---------------- */
  class PoetryShelf {
    constructor(host, source, opts) {
      this.host = host;
      this.opts = opts || {};
      this.data = parseShelf(source);
      host.innerHTML = `
        ${this.data.intro ? `<p class="gu-shelf-intro">${esc(this.data.intro)}</p>` : ""}
        <div class="gu-shelf">
          ${this.data.books.map((book) => `
            <button type="button" class="gu-shelf-item" data-doc="${esc(book.doc)}">
              ${coverMarkup(book, "small")}
              <span class="gu-shelf-copy">
                <strong>${esc(book.title)}</strong>
                ${book.subtitle ? `<em>${esc(book.subtitle)}</em>` : ""}
                ${book.intro ? `<small>${esc(book.intro)}</small>` : ""}
              </span>
            </button>`).join("")}
        </div>`;
      host.addEventListener("click", (event) => {
        const item = event.target.closest(".gu-shelf-item");
        if (item && item.dataset.doc && this.opts.onOpenDoc) this.opts.onOpenDoc(item.dataset.doc);
      });
    }
  }

  /* ---------------- 一集 ---------------- */
  class PoetryBook {
    constructor(host, source, opts) {
      this.host = host;
      this.opts = opts || {};
      this.book = parseBook(source);
      this.vertical = this.book.layout === "竖排";
      this.pages = [];
      this.page = 0;
      this.turning = false;
      this.storeKey = `gu:${this.book.title}`;
      this.render();
      this.relayout();
      this.restore();
      this.paint();
      // 字体没到位时量出来的行长是错的，字体就绪或有新字体载入后都要重排
      this.refit = () => {
        if (!this.host.isConnected) { document.fonts?.removeEventListener?.("loadingdone", this.refit); return; }
        const before = this.pages.length;
        this.relayout();
        if (this.pages.length !== before) this.paint();
      };
      document.fonts?.ready?.then(this.refit).catch(() => {});
      document.fonts?.addEventListener?.("loadingdone", this.refit);
    }

    buildPages() {
      const pages = [{ type: "cover" }, { type: "title" }];
      for (const piece of this.book.pieces) {
        piece.page = pages.length;
        const parts = piece.prose ? this.measureParts(piece) : 1;
        for (let i = 0; i < parts; i += 1) pages.push({ type: "piece", piece, part: i, parts });
      }
      if (!this.book.pieces.length) pages.push({ type: "empty" });
      if (pages.length % 2) pages.push({ type: "blank" });
      return pages;
    }

    /* 长文竖排一页放不下：在离屏探针里让它按自然尺寸铺开，量出总长度再决定占几页。
       探针与真实页面同尺寸同样式，量到的就是实际排版结果。 */
    measureParts(piece) {
      if (!this.inner) return 1;
      const box = this.inner.getBoundingClientRect();
      if (!box.width || !box.height) return 1;
      const probe = document.createElement("div");
      probe.className = "gu-page gu-probe";
      probe.style.cssText = `position:absolute;left:0;top:0;width:${this.single ? box.width : box.width / 2}px;`
        + `height:${box.height}px;visibility:hidden;pointer-events:none;z-index:-1`;
      probe.innerHTML = `<div class="gu-sheet gu-sheet-piece prose measure">${this.pieceInner(piece)}</div>`;
      this.inner.appendChild(probe);

      const sheet = probe.querySelector(".gu-sheet-piece");
      const body = probe.querySelector(".gu-piece");
      const style = getComputedStyle(sheet);
      const avail = this.vertical
        ? sheet.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        : sheet.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const rect = body.getBoundingClientRect();
      const natural = this.vertical ? rect.width : rect.height;
      probe.remove();
      if (!(avail > 0) || !(natural > 0)) return 1;
      return Math.max(1, Math.min(24, Math.ceil((natural - 2) / avail)));
    }

    /* 版面或书写方向变了要重排，尽量停在原来那一段上 */
    relayout() {
      const current = this.pages[this.page];
      this.measuredWidth = this.inner ? Math.round(this.inner.getBoundingClientRect().width) : 0;
      this.pages = this.buildPages();
      if (current && current.type === "piece") {
        const found = this.pages.findIndex((page) => page.type === "piece"
          && page.piece === current.piece && (page.part || 0) === (current.part || 0));
        if (found >= 0) this.page = found;
      }
    }

    get single() { return this.host.clientWidth < SINGLE_WIDTH; }
    get step() { return this.single ? 1 : 2; }
    get lastPage() { return this.single ? this.pages.length - 1 : this.pages.length - 2; }

    render() {
      const ink = inkOf(this.book.ink);
      this.host.style.setProperty("--gu-ink-deep", ink.deep);
      this.host.style.setProperty("--gu-ink-mid", ink.mid);
      this.host.style.setProperty("--gu-ink-light", ink.light);
      this.host.innerHTML = `
        <div class="gu-bar">
          <span class="gu-bar-title">${esc(this.book.title)}</span>
          <span class="gu-bar-meta">${this.book.pieces.length} 篇</span>
          <div class="gu-tools">
            <button type="button" data-act="toc">目次</button>
            <button type="button" data-act="layout">${this.vertical ? "横排" : "竖排"}</button>
            <button type="button" data-act="full" title="全屏">⛶</button>
            <button type="button" data-act="prev" aria-label="上一页">‹</button>
            <button type="button" data-act="next" aria-label="下一页">›</button>
          </div>
        </div>
        <div class="gu-stage">
          <div class="gu-book" tabindex="0" aria-label="${esc(this.book.title)}">
            <div class="gu-book-inner">
              <div class="gu-page gu-page-left"></div>
              <div class="gu-page gu-page-right"></div>
              <div class="gu-spine" aria-hidden="true"></div>
              <div class="gu-leaf" hidden aria-hidden="true">
                <div class="gu-leaf-face gu-leaf-front"></div>
                <div class="gu-leaf-face gu-leaf-back"></div>
                <div class="gu-leaf-shade"></div>
              </div>
            </div>
          </div>
          <nav class="gu-toc" hidden aria-label="目次">
            <div class="gu-toc-head">目次</div>
            <div class="gu-toc-list">
              ${this.book.pieces.length
                ? this.book.pieces.map((piece) => `
                    <button type="button" class="gu-toc-item" data-page="${piece.page}">
                      <i>${piece.order}</i><span>${esc(piece.title)}</span>
                      ${piece.genre ? `<em>${esc(piece.genre)}</em>` : ""}
                    </button>`).join("")
                : '<p class="gu-toc-empty">此集待添稿</p>'}
            </div>
          </nav>
        </div>
        <div class="gu-foot">
          <button type="button" class="gu-turn" data-act="prev">‹ 前页</button>
          <div class="gu-progress"><span></span></div>
          <span class="gu-counter"></span>
          <button type="button" class="gu-turn" data-act="next">后页 ›</button>
        </div>`;

      this.book_ = this.host.querySelector(".gu-book");
      this.inner = this.host.querySelector(".gu-book-inner");
      this.left = this.host.querySelector(".gu-page-left");
      this.right = this.host.querySelector(".gu-page-right");
      this.leaf = this.host.querySelector(".gu-leaf");
      this.leafFront = this.host.querySelector(".gu-leaf-front");
      this.leafBack = this.host.querySelector(".gu-leaf-back");
      this.toc = this.host.querySelector(".gu-toc");
      this.counter = this.host.querySelector(".gu-counter");
      this.progress = this.host.querySelector(".gu-progress span");
      this.bind();
    }

    pieceInner(piece) {
      const rows = [...piece.fields.entries()]
        .filter(([key]) => key !== "小序")
        .map(([key, value]) => `<span class="gu-tag">${esc(key)}·${esc(value)}</span>`).join("");
      const preface = piece.fields.get("小序");
      const body = piece.blocks.map((block) => `
        <div class="gu-block">${block.map((line) => `<p class="gu-line">${esc(line)}</p>`).join("")}</div>`).join("");
      return `
        <div class="gu-piece">
          <div class="gu-piece-title">${esc(piece.title)}</div>
          ${preface ? `<div class="gu-preface">${esc(preface)}</div>` : ""}
          <div class="gu-body">${body || '<p class="gu-line">（待录）</p>'}</div>
          <div class="gu-piece-foot">
            <span class="gu-seal small" aria-hidden="true">${esc(this.book.seal)}</span>
            ${rows}
          </div>
        </div>`;
    }

    pieceHtml(piece, part = 0, parts = 1) {
      const inner = this.pieceInner(piece);
      if (!piece.prose) return `<div class="gu-sheet gu-sheet-piece">${inner}</div>`;
      // 竖排内容向左溢出，右移露出下一段；横排向下溢出，上移露出下一段
      const axis = this.vertical ? "translateX" : "translateY";
      const sign = this.vertical ? "" : "-";
      const shift = part ? ` style="transform:${axis}(calc(${sign}100% * ${part}))"` : "";
      const folio = parts > 1 ? `<div class="gu-part">${part + 1} / ${parts}</div>` : "";
      return `
        <div class="gu-sheet gu-sheet-piece prose">
          <div class="gu-flow"><div class="gu-shift"${shift}>${inner}</div></div>
          ${folio}
        </div>`;
    }

    pageHtml(index) {
      const page = this.pages[index];
      if (!page) return '<div class="gu-sheet gu-sheet-blank"></div>';
      if (page.type === "cover") return `<div class="gu-sheet gu-sheet-cover">${coverMarkup(this.book)}</div>`;
      if (page.type === "title") {
        return `
          <div class="gu-sheet gu-sheet-title">
            <div class="gu-title-block">
              <div class="gu-title-name">${esc(this.book.title)}</div>
              ${this.book.subtitle ? `<div class="gu-title-sub">${esc(this.book.subtitle)}</div>` : ""}
              ${this.book.intro ? `<div class="gu-title-intro">${esc(this.book.intro)}</div>` : ""}
              <div class="gu-seal" aria-hidden="true">${esc(this.book.seal)}</div>
            </div>
          </div>`;
      }
      if (page.type === "empty") {
        return `
          <div class="gu-sheet gu-sheet-empty">
            <div class="gu-empty-mark">〇</div>
            <p>此集待添稿</p>
            <small>在文档的 poetry 代码块里以 <code>@ 题名</code> 起一篇，下面直接写正文</small>
          </div>`;
      }
      if (page.type === "piece") return this.pieceHtml(page.piece, page.part || 0, page.parts || 1);
      return '<div class="gu-sheet gu-sheet-blank"></div>';
    }

    fill(node, index) { node.innerHTML = this.pageHtml(index); }

    paint() {
      this.inner.classList.toggle("single", this.single);
      this.host.classList.toggle("horizontal", !this.vertical);
      if (!this.single && this.page % 2) this.page -= 1;
      this.page = Math.max(0, Math.min(this.page, this.lastPage));
      this.fill(this.left, this.page);
      if (this.single) this.right.innerHTML = "";
      else this.fill(this.right, this.page + 1);
      this.updateChrome();
    }

    updateChrome() {
      const total = this.single ? this.pages.length : Math.ceil(this.pages.length / 2);
      const current = this.single ? this.page + 1 : Math.floor(this.page / 2) + 1;
      this.counter.textContent = `${current} / ${total}`;
      this.progress.style.width = `${total > 1 ? ((current - 1) / (total - 1)) * 100 : 100}%`;
      const shown = new Set([this.page, this.single ? this.page : this.page + 1]);
      this.host.querySelectorAll(".gu-toc-item").forEach((item) => {
        item.classList.toggle("active", shown.has(+item.dataset.page));
      });
      this.host.querySelectorAll('[data-act="prev"]').forEach((b) => { b.disabled = this.page <= 0; });
      this.host.querySelectorAll('[data-act="next"]').forEach((b) => { b.disabled = this.page >= this.lastPage; });
      try { localStorage.setItem(this.storeKey, String(this.page)); } catch (error) { /* 隐私模式 */ }
    }

    restore() {
      try {
        const stored = Number(localStorage.getItem(this.storeKey));
        if (Number.isFinite(stored) && stored > 0) this.page = Math.min(stored, this.lastPage);
      } catch (error) { /* 隐私模式 */ }
    }

    goTo(target) {
      let next = Math.max(0, Math.min(target, this.pages.length - 1));
      if (!this.single) next -= next % 2;
      next = Math.min(next, this.lastPage);
      if (next === this.page) return;
      this.turn(next, next > this.page ? 1 : -1);
    }

    turn(next, direction) {
      if (this.turning) return;
      if (this.single) {
        this.page = next;
        this.left.classList.remove("slide-next", "slide-prev");
        void this.left.offsetWidth;
        this.left.classList.add(direction > 0 ? "slide-next" : "slide-prev");
        this.paint();
        return;
      }
      this.turning = true;
      const from = this.page;
      this.fill(this.leafFront, direction > 0 ? from + 1 : next + 1);
      this.fill(this.leafBack, direction > 0 ? next : from);
      this.fill(this.left, direction > 0 ? from : next);
      this.fill(this.right, direction > 0 ? next + 1 : from + 1);

      this.leaf.hidden = false;
      this.leaf.classList.remove("turning", "forward", "backward");
      this.leaf.style.transform = direction > 0 ? "rotateY(0deg)" : "rotateY(-180deg)";
      void this.leaf.offsetWidth;
      this.leaf.classList.add("turning", direction > 0 ? "forward" : "backward");
      this.leaf.style.transform = direction > 0 ? "rotateY(-180deg)" : "rotateY(0deg)";

      const settle = (event) => {
        if (event && event.target !== this.leaf) return;
        clearTimeout(this.timer);
        this.leaf.removeEventListener("transitionend", settle);
        this.leaf.classList.remove("turning", "forward", "backward");
        this.leaf.hidden = true;
        this.leaf.style.transform = "";
        this.page = next;
        this.turning = false;
        this.paint();
      };
      this.leaf.addEventListener("transitionend", settle);
      this.timer = setTimeout(settle, TURN_MS + 160);
    }

    toggleFullscreen() {
      if (document.fullscreenElement === this.host) document.exitFullscreen?.();
      else this.host.requestFullscreen?.().catch(() => {});
    }

    bind() {
      this.host.addEventListener("click", (event) => {
        const action = event.target.closest("[data-act]");
        if (action) {
          const act = action.dataset.act;
          if (act === "next") this.goTo(this.page + this.step);
          else if (act === "prev") this.goTo(this.page - this.step);
          else if (act === "full") this.toggleFullscreen();
          else if (act === "toc") {
            this.toc.hidden = !this.toc.hidden;
            action.classList.toggle("on", !this.toc.hidden);
          } else if (act === "layout") {
            this.vertical = !this.vertical;
            action.textContent = this.vertical ? "横排" : "竖排";
            this.host.classList.toggle("horizontal", !this.vertical);
            this.relayout();
            this.paint();
          }
          return;
        }
        const item = event.target.closest(".gu-toc-item");
        if (item) { this.goTo(+item.dataset.page); if (this.single) this.toc.hidden = true; }
      });

      this.book_.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); this.goTo(this.page + this.step); }
        if (event.key === "ArrowLeft") { event.preventDefault(); this.goTo(this.page - this.step); }
      });

      let swipe = null;
      this.book_.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse") swipe = { x: event.clientX, y: event.clientY };
      });
      this.book_.addEventListener("pointerup", (event) => {
        if (!swipe) return;
        const dx = event.clientX - swipe.x;
        if (Math.abs(dx) > 55 && Math.abs(event.clientY - swipe.y) < 60) {
          this.goTo(this.page + (dx < 0 ? this.step : -this.step));
        }
        swipe = null;
      });

      let frame = null;
      this.resize = () => {
        if (!this.host.isConnected) { window.removeEventListener("resize", this.resize); return; }
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          const width = Math.round(this.inner.getBoundingClientRect().width);
          if (this.inner.classList.contains("single") !== this.single
            || Math.abs(width - this.measuredWidth) > 16) { this.relayout(); this.paint(); }
        });
      };
      window.addEventListener("resize", this.resize);
      document.addEventListener("fullscreenchange", () => {
        if (!this.host.isConnected) return;
        this.host.classList.toggle("is-full", document.fullscreenElement === this.host);
      });
    }
  }

  function mount(container, selector, Klass, opts) {
    container.querySelectorAll(selector).forEach((host) => {
      if (host.dataset.mounted) return;
      const holder = host.querySelector(".gu-source");
      const source = (holder ? holder.textContent : host.textContent).trim();
      if (!source) return;
      try {
        host.dataset.mounted = "1";
        new Klass(host, source, opts);
      } catch (error) {
        host.innerHTML = `<div class="gu-error">诗集解析失败：${esc(error.message)}</div>`;
        console.warn(error);
      }
    });
  }

  window.Poetry = {
    mountAll(container, opts) {
      mount(container, ".poetry-shelf", PoetryShelf, opts);
      mount(container, ".poetry", PoetryBook, opts);
    }
  };
})();
