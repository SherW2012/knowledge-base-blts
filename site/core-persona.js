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

  function mount(host, app, data) {
    const tabs = [
      { id: "dashboard", label: "人格中枢", render: () => dashboard(data) },
      { id: "principles", label: "行动准则", render: () => principles(data) },
      { id: "persona", label: "四重人格", render: () => persona(data) },
      { id: "focus", label: "五忌三议 · 潜龙", render: () => focus(data) },
      { id: "agreement", label: "金鸡湖协定", render: () => agreement(data) }
    ];
    let active = tabs[0];

    host.innerHTML = `
      <section class="core-persona">
        <header class="cp-hero">
          <div><span class="cp-kicker">${esc(data.eyebrow || app?.eyebrow || "CORE PERSONA SYSTEM")}</span><h2>${esc(data.title || app?.title || "本部人格中枢")}</h2><p>不是文章集合，而是一套用于日常判断、行动与人格调度的核心操作系统。</p></div>
          <div class="cp-state"><i></i><span>CORE ONLINE</span></div>
        </header>
        <nav class="cp-tabs" role="tablist">${tabs.map((tab, index) => `<button type="button" role="tab" data-cp-tab="${tab.id}" class="${index === 0 ? "active" : ""}" aria-selected="${index === 0 ? "true" : "false"}">${esc(tab.label)}</button>`).join("")}</nav>
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
      host.closest(".reading-scroll")?.scrollTo?.({ top: 0, behavior: "smooth" });
    });
    render();
  }

  function render({ host, app }) {
    host.innerHTML = '<div class="cp-loading">正在启动人格中枢…</div>';
    fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`core-persona-data ${response.status}`); return response.json(); })
      .then((data) => mount(host, app, data))
      .catch((error) => { host.innerHTML = `<div class="cp-error"><strong>人格中枢数据读取失败</strong><p>${esc(error.message)}</p></div>`; });
  }

  const register = () => window.BLTSWorkspace?.registerRenderer("core-persona", render);
  if (window.BLTSWorkspace) register();
  else window.addEventListener("DOMContentLoaded", register);
})();
