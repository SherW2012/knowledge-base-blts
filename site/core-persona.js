/* 本部人格中枢：座右铭、行动准则、人格调度、五忌三议、潜龙模式与金鸡湖协定。
   作为独立应用注册到 BLTS Workspace，不进入 Markdown 独立文章列表。 */
(() => {
  "use strict";

  const DATA_URL = "./core-persona-data.json";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  function numberedCards(items, className = "cp-rule-grid") {
    return `<ol class="${className}">${items.map((item, index) => `
      <li class="cp-rule-card">
        <span class="cp-rule-no">${String(index + 1).padStart(2, "0")}</span>
        <div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div>
      </li>`).join("")}</ol>`;
  }

  function motto(data) {
    return `
      <section class="cp-motto-block">
        <div class="cp-section-label">MOTTO / 座右铭</div>
        <div class="cp-motto-grid">${data.motto.map((word, index) => `
          <div class="cp-motto-word"><small>0${index + 1}</small><strong>${esc(word)}</strong></div>`).join("")}</div>
      </section>`;
  }

  function dashboard(data) {
    return `
      <div class="cp-dashboard">
        ${motto(data)}
        <section class="cp-command-card">
          <div class="cp-section-label">DISPATCH / 人格调度</div>
          <h3>真正的自己，是调度者。</h3>
          <p>${esc(data.dispatch.closing[2])}</p>
          <div class="cp-persona-mini-grid">${data.personas.map((item) => `
            <div class="cp-persona-mini"><span>0${esc(item.id)}</span><strong>${esc(item.name.replace(/。$/, ""))}</strong><p>${esc(item.role)}</p></div>`).join("")}</div>
        </section>
        <section class="cp-fast-grid">
          <article><span>五忌</span><strong>5</strong><p>${data.fiveTaboos.map(esc).join(" · ")}</p></article>
          <article><span>三议</span><strong>3</strong><p>${data.threeProposals.items.map(esc).join(" · ")}</p></article>
          <article><span>潜龙模式</span><strong>FLOW</strong><p>高效率 · 低功耗 · 轻盈 · 安静</p></article>
          <article><span>金鸡湖协定</span><strong>7</strong><p>原文锁定 · 不改一字</p></article>
        </section>
      </div>`;
  }

  function principles(data) {
    return `
      <section class="cp-page-head"><span>01</span><div><small>ACTION PRINCIPLES</small><h3>我的行动准则</h3><p>完整保留主清单与补丁清单，不再压缩成摘要。</p></div></section>
      <section class="cp-content-section"><div class="cp-section-title"><span>MAIN</span><h4>主清单</h4><b>${data.principles.main.length}</b></div>${numberedCards(data.principles.main)}</section>
      <section class="cp-content-section"><div class="cp-section-title"><span>PATCHES</span><h4>补丁清单</h4><b>${data.principles.patches.length}</b></div>${numberedCards(data.principles.patches)}</section>`;
  }

  function persona(data) {
    return `
      <section class="cp-page-head"><span>02</span><div><small>PERSONA DISPATCH</small><h3>四重人格调度原则</h3><p>${esc(data.dispatch.intro.join(" "))}</p></div></section>
      <div class="cp-persona-grid">${data.personas.map((item) => `
        <article class="cp-persona-card cp-persona-${esc(item.id)}">
          <div class="cp-persona-index">0${esc(item.id)}</div>
          <h4>${esc(item.name)}</h4>
          <p class="cp-persona-role">${esc(item.role)}</p>
          <p>${esc(item.instruction)}</p>
        </article>`).join("")}</div>
      <section class="cp-dispatch-matrix">
        <div class="cp-section-title"><span>SWITCHING</span><h4>场景切换</h4></div>
        ${data.dispatch.pairs.map((pair) => `<div class="cp-dispatch-row"><p>${esc(pair[0])}</p><i>↔</i><p>${esc(pair[1])}</p></div>`).join("")}
      </section>
      <section class="cp-core-quote">
        <p>${esc(data.dispatch.closing[0])}</p>
        <p>${esc(data.dispatch.closing[1])}</p>
        <strong>${esc(data.dispatch.closing[2])}</strong>
      </section>`;
  }

  function focus(data) {
    return `
      <section class="cp-page-head"><span>03</span><div><small>FOCUS PROTOCOL</small><h3>五忌三议 · 潜龙模式</h3><p>把注意力保护、行为禁区与低功耗心流放到一个操作面板里。</p></div></section>
      <div class="cp-focus-layout">
        <section class="cp-taboo-panel">
          <div class="cp-section-title"><span>FIVE TABOOS</span><h4>五忌</h4><b>5</b></div>
          <div class="cp-taboo-list">${data.fiveTaboos.map((item, index) => `<div><span>0${index + 1}</span><strong>${esc(item)}</strong></div>`).join("")}</div>
        </section>
        <section class="cp-proposal-panel">
          <div class="cp-section-title"><span>THREE PROPOSALS</span><h4>三议</h4><b>3</b></div>
          <p class="cp-source">${esc(data.threeProposals.source)}</p>
          <ol>${data.threeProposals.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>
        </section>
      </div>
      <section class="cp-dragon-panel">
        <div class="cp-dragon-orbit" aria-hidden="true"><span>潜</span><i></i><b>龙</b></div>
        <div><small>HIDDEN DRAGON MODE</small><h4>潜龙模式</h4><p>${esc(data.hiddenDragon)}</p><div class="cp-mode-tags"><span>高效率</span><span>低功耗</span><span>轻盈</span><span>安静心流</span></div></div>
      </section>`;
  }

  function agreement(data) {
    return `
      <section class="cp-page-head"><span>04</span><div><small>JINJI LAKE AGREEMENT</small><h3>金鸡湖协定</h3><p>历史原文锁定。以下正文按原文呈现。</p></div></section>
      <section class="cp-agreement">
        <header><div class="cp-lock">LOCKED ORIGINAL</div><div class="cp-signatures">${data.jinjiLake.names.map((name) => `<span>${esc(name)}</span>`).join("")}</div></header>
        <ol>${data.jinjiLake.items.map((item) => `<li><span>${esc(item)}</span></li>`).join("")}</ol>
      </section>`;
  }

  /* 生辰八字：只排盘，不写断语。四柱、十神、藏干、纳音、星运都是按规则推出来的。 */
  /* 解读：按传统命理的路子推演，末尾附「该怎么看」的说明。 */
  function reading(b) {
    const r = b.reading;
    if (!r) return "";
    const chip = (g) => `<div class="cp-yong-chip"><small>${esc(g.tag)}</small>`
      + `<b class="cp-wx" data-wx="${esc(g.wx)}">${esc(g.wx)}</b>`
      + `<strong>${esc(g.name)}</strong><span>${esc(g.why)}</span></div>`;
    const g = r.useGod;
    return `
      <section class="cp-read-lead">
        <div class="cp-section-label">READING / 解读</div>
        <p>${esc(r.intro)}</p>
      </section>

      ${g ? `<section class="cp-content-section">
        <div class="cp-section-title"><span>YONG SHEN</span><h4>用神取舍</h4></div>
        <div class="cp-yong-grid">
          ${chip(g.yong)}${chip(g.xi)}${g.ji.map(chip).join("")}${chip(g.half)}
        </div>
        <p class="cp-source">${esc(g.note)}</p>
      </section>` : ""}

      ${r.sections.map((sec) => `
        <section class="cp-content-section">
          <div class="cp-section-title"><span>${esc(sec.no)} · ${esc(sec.en)}</span><h4>${esc(sec.title)}</h4></div>
          <div class="cp-read-blocks">${sec.blocks.map((blk) => `
            <article><h5>${esc(blk.h)}</h5>${blk.p.map((t) => `<p>${esc(t)}</p>`).join("")}</article>`).join("")}</div>
        </section>`).join("")}

      <section class="cp-content-section">
        <div class="cp-section-title"><span>NOW</span><h4>${esc(r.nowTitle)}</h4></div>
        <div class="cp-read-blocks"><article>${r.now.map((t) => `<p>${esc(t)}</p>`).join("")}</article></div>
      </section>

      <section class="cp-content-section">
        <div class="cp-section-title"><span>IN PRACTICE</span><h4>${esc(r.applyTitle)}</h4></div>
        <dl class="cp-method-list">${r.apply.map(([k, v]) => `
          <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      </section>

      <section class="cp-verdict">
        <div class="cp-section-label">${esc(r.verdictTitle)}</div>
        <ol>${r.verdict.map(([k, v]) => `<li><strong>${esc(k)}</strong><p>${esc(v)}</p></li>`).join("")}</ol>
      </section>

      <section class="cp-disclaimer">
        <div class="cp-section-label">${esc(r.disclaimerTitle)}</div>
        ${r.disclaimer.map((t) => `<p>${esc(t)}</p>`).join("")}
      </section>`;
  }

  function bazi(data) {
    const b = data.bazi;
    if (!b) return "";
    const col = (p) => `
      <article class="cp-pillar${p.self ? " is-self" : ""}">
        <header><small>${esc(p.en)}</small><span>${esc(p.label)}</span></header>
        <p class="cp-pillar-god">${esc(p.god)}</p>
        <div class="cp-pillar-chars">
          <b class="cp-wx" data-wx="${esc(p.ganWx)}">${esc(p.gan)}</b>
          <b class="cp-wx" data-wx="${esc(p.zhiWx)}">${esc(p.zhi)}</b>
        </div>
        <ul class="cp-pillar-hide">${p.hide.map(([gan, god]) =>
          `<li><b>${esc(gan)}</b><span>${esc(god)}</span></li>`).join("")}</ul>
        <dl class="cp-pillar-meta">
          <div><dt>纳音</dt><dd>${esc(p.nayin)}</dd></div>
          <div><dt>星运</dt><dd>${esc(p.star)}</dd></div>
        </dl>
      </article>`;
    const most = Math.max(...b.elements.map((e) => e.full)) || 1;
    return `
      <section class="cp-page-head"><span>05</span><div><small>FOUR PILLARS</small><h3>生辰八字</h3><p>${esc(b.birth.solar)} · ${esc(b.birth.place)} · ${esc(b.gender)}</p></div></section>

      <section class="cp-bazi-card">
        <div class="cp-section-title"><span>CHART</span><h4>排盘</h4><b>日主 ${esc(b.dayMaster)}</b></div>
        <p class="cp-bazi-chart">${esc(b.chart)}</p>
        <div class="cp-pillar-grid">${b.pillars.map(col).join("")}</div>
      </section>

      <div class="cp-bazi-split">
        <section class="cp-content-section">
          <div class="cp-section-title"><span>ELEMENTS</span><h4>五行分布</h4></div>
          <div class="cp-wx-bars">
            <div class="cp-wx-head"><span></span><i>条长按含藏干计</i><em>本气 / 藏干</em></div>
            ${b.elements.map((e) => `
            <div class="cp-wx-bar">
              <span class="cp-wx" data-wx="${esc(e.name)}">${esc(e.name)}</span>
              <i><u style="width:${Math.round((e.full / most) * 100)}%" data-wx="${esc(e.name)}"></u></i>
              <em>${e.main} <small>/ ${e.full}</small></em>
            </div>`).join("")}</div>
          <p class="cp-source">${esc(b.elementNote)}</p>
        </section>
        <section class="cp-content-section">
          <div class="cp-section-title"><span>RELATIONS</span><h4>支间关系</h4><b>旬空 ${esc(b.empty)}</b></div>
          <ul class="cp-relation-list">${b.relations.map(([name, text]) => `
            <li><strong>${esc(name)}</strong><p>${esc(text)}</p></li>`).join("")}</ul>
          <p class="cp-source">${esc(b.emptyNote)}</p>
        </section>
      </div>

      ${luck(b)}
      ${reading(b)}

      <section class="cp-content-section">
        <div class="cp-section-title"><span>METHOD</span><h4>起算口径</h4></div>
        <dl class="cp-method-list">${b.method.map(([name, text]) => `
          <div><dt>${esc(name)}</dt><dd>${esc(text)}</dd></div>`).join("")}</dl>
        <p class="cp-source">${esc(b.birth.hourNote)}</p>
        <p class="cp-source">${esc(b.scope)}</p>
      </section>`;
  }

  const GAN = "甲乙丙丁戊己庚辛壬癸";
  const ZHI = "子丑寅卯辰巳午未申酉戌亥";
  /* 1984 甲子起算。流年以立春分界，1 月到 2 月初仍算上一年。 */
  const yearGz = (year) => {
    const n = (((year - 1984) % 60) + 60) % 60;
    return GAN[n % 10] + ZHI[n % 12];
  };

  function luck(b) {
    if (!b.luck) return "";
    const now = new Date();
    // 立春前仍属上一年，2 月 5 日之前一律按上一年取，宁可保守
    const solarYear = (now.getMonth() === 0 || (now.getMonth() === 1 && now.getDate() < 5))
      ? now.getFullYear() - 1 : now.getFullYear();
    const gz = yearGz(solarYear);
    const list = b.luck.pillars;
    let at = -1;
    list.forEach((p, i) => { if (solarYear >= p.startYear) at = i; });
    const live = at >= 0 ? list[at] : null;
    return `
      <section class="cp-content-section">
        <div class="cp-section-title"><span>LUCK PILLARS</span><h4>大运</h4><b>${esc(b.luck.startAge)}起运</b></div>
        <p class="cp-source cp-luck-rule">${esc(b.luck.rule)}${live ? "" : ""}</p>
        <div class="cp-now">
          <div><small>本年流年</small><strong>${esc(solarYear)} · ${esc(gz)}</strong><span>${esc(b.godMap[gz[0]] || "")}</span></div>
          ${live ? `<div><small>现行大运</small><strong>${esc(live.gz)}</strong><span>${esc(live.god)} · ${esc(live.age)}</span></div>` : ""}
          <div><small>交运</small><strong>${esc(b.luck.startDate)}</strong><span>${esc(b.luck.startAge)}</span></div>
        </div>
        <div class="cp-luck-strip">${list.map((p, i) => `
          <article class="cp-luck${i === at ? " is-now" : ""}">
            ${i === at ? '<em class="cp-luck-flag">当前</em>' : ""}
            <span class="cp-luck-god">${esc(p.god)}</span>
            <b class="cp-luck-gz">${esc(p.gz)}</b>
            <span class="cp-luck-star">${esc(p.star)}</span>
            <span class="cp-luck-age">${esc(p.age)}</span>
            <span class="cp-luck-year">${esc(p.startYear)} 起</span>
          </article>`).join("")}</div>
        ${list.some((x) => x.note) ? `<ol class="cp-luck-notes">${list.map((x, i) => `
          <li class="${i === at ? "is-now" : ""}"><b>${esc(x.gz)}</b><span>${esc(x.god)} · ${esc(x.age)}</span><p>${esc(x.note || "")}</p></li>`).join("")}</ol>` : ""}
        ${b.reading?.luckSummary ? `<p class="cp-luck-sum">${esc(b.reading.luckSummary)}</p>` : ""}
        <p class="cp-source">${esc(b.luck.startNote)}</p>
        <p class="cp-source">${esc(b.nowNote || "")}</p>
      </section>`;
  }

  function mount(host, app, data, view, department) {
    const tabs = [
      { id: "dashboard", label: "人格中枢", render: () => dashboard(data) },
      { id: "principles", label: "行动准则", render: () => principles(data) },
      { id: "persona", label: "四重人格", render: () => persona(data) },
      { id: "focus", label: "五忌三议 · 潜龙", render: () => focus(data) },
      { id: "agreement", label: "金鸡湖协定", render: () => agreement(data) },
      { id: "bazi", label: "生辰八字", render: () => bazi(data) }
    ];
    // 支持 #/app/本部/core-persona/<页签> 直接落到某一页
    let active = tabs.find((tab) => tab.id === view) || tabs[0];
    const hashFor = (id) =>
      `#/app/${encodeURIComponent(department?.name || "本部")}/${encodeURIComponent(app?.id || "core-persona")}`
      + (id === tabs[0].id ? "" : `/${encodeURIComponent(id)}`);

    host.innerHTML = `
      <section class="core-persona">
        <header class="cp-hero">
          <div><span class="cp-kicker">${esc(data.eyebrow || app?.eyebrow || "CORE PERSONA SYSTEM")}</span><h2>${esc(data.title || app?.title || "本部人格中枢")}</h2><p>不是文章集合，而是一套用于日常判断、行动与人格调度的核心操作系统。</p></div>
          <div class="cp-state"><i></i><span>CORE ONLINE</span></div>
        </header>
        <nav class="cp-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" data-cp-tab="${tab.id}" class="${tab === active ? "active" : ""}" aria-selected="${tab === active ? "true" : "false"}">${esc(tab.label)}</button>`).join("")}</nav>
        <div class="cp-stage" data-cp-stage></div>
      </section>`;

    const stage = host.querySelector("[data-cp-stage]");
    const render = () => {
      stage.innerHTML = active.render();
      stage.animate?.([{ opacity: .45, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "ease-out" });
    };
    host.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cp-tab]");
      if (!button) return;
      const next = tabs.find((tab) => tab.id === button.dataset.cpTab);
      if (!next || next === active) return;
      active = next;
      host.querySelectorAll("[data-cp-tab]").forEach((tabButton) => {
        const on = tabButton.dataset.cpTab === active.id;
        tabButton.classList.toggle("active", on);
        tabButton.setAttribute("aria-selected", on ? "true" : "false");
      });
      render();
      // replaceState 不触发 hashchange，应用不会被工作台重建
      history.replaceState(null, "", hashFor(active.id));
      host.closest(".reading-scroll")?.scrollTo?.({ top: 0, behavior: "smooth" });
    });
    render();
  }

  function render({ host, app, view, department }) {
    host.innerHTML = '<div class="cp-loading">正在启动人格中枢…</div>';
    fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`core-persona-data ${response.status}`); return response.json(); })
      .then((data) => mount(host, app, data, view, department))
      .catch((error) => { host.innerHTML = `<div class="cp-error"><strong>人格中枢数据读取失败</strong><p>${esc(error.message)}</p></div>`; });
  }

  const register = () => window.BLTSWorkspace?.registerRenderer("core-persona", render);
  if (window.BLTSWorkspace) register();
  else window.addEventListener("DOMContentLoaded", register);
})();
