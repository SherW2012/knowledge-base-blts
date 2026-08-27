/* 水墨背景：用 SVG 现画山水，供诗词书页作底。无外部依赖、无图片资源。
   画布 600×800，与单页比例一致；一页一幅，相邻两页靠书脊侧淡出衔接。
   墨色走 CSS 变量，深浅主题各一套；浓淡只用透明度分层，保证正文始终压得住。 */
(function () {
  "use strict";

  const R = (n, d = 1) => Number(n.toFixed(d));

  /* 伪随机：同一个种子每次画出来一样，避免翻页时山形乱跳 */
  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  /* ---------------- 图元 ---------------- */

  // 远山：山脊由若干峰连成，越远越淡，底部用渐变化开
  function ridge({ y, height, seed, opacity, wash = true, x0 = -40, x1 = 640 }) {
    const rand = rng(seed);
    const peaks = [];
    let x = x0;
    while (x < x1) {
      const w = 90 + rand() * 240;
      peaks.push({ x: x + w / 2, w, h: height * (0.3 + rand() * 1.05) });
      x += w * (0.5 + rand() * 0.36);
    }
    let d = `M${x0},${R(y + height)}`;
    for (const peak of peaks) {
      const left = peak.x - peak.w / 2;
      const right = peak.x + peak.w / 2;
      const top = R(y + height - peak.h);
      d += ` L${R(left)},${R(y + height - peak.h * 0.18)}`
        + ` Q${R(peak.x - peak.w * 0.16)},${top} ${R(peak.x)},${R(top + peak.h * 0.06)}`
        + ` Q${R(peak.x + peak.w * 0.2)},${R(top + peak.h * 0.1)} ${R(right)},${R(y + height - peak.h * 0.2)}`;
    }
    d += ` L${x1},${R(y + height)} Z`;
    return `<path class="ink-ridge${wash ? " wash" : ""}" d="${d}" opacity="${opacity}"/>`;
  }

  // 水面：几道长短不一的横向皴笔
  function water({ y, rows = 7, seed = 5, opacity = 0.3, x0 = 40, x1 = 560 }) {
    const rand = rng(seed);
    let out = "";
    for (let i = 0; i < rows; i += 1) {
      const yy = y + i * (16 + rand() * 14);
      const strokes = 1 + Math.floor(rand() * 3);
      let cursor = x0 + rand() * (x1 - x0) * 0.35;
      for (let k = 0; k < strokes && cursor < x1 - 60; k += 1) {
        const w = 70 + rand() * 260;
        const dip = 2.2 + rand() * 5.2;
        const jitter = (rand() - 0.5) * 7;
        out += `<path class="ink-wave" fill="none" stroke-width="${R(1 + rand() * 1.5)}"`
          + ` d="M${R(cursor)},${R(yy + jitter)} q${R(w * 0.3)},${R(-dip)} ${R(w * 0.55)},${R(dip * 0.3)}`
          + ` t${R(w * 0.45)},${R(-dip * 0.5)}"`
          + ` opacity="${R(opacity * (0.35 + rand() * 0.75), 2)}"/>`;
        cursor += w + 24 + rand() * 80;
      }
    }
    return `<g class="ink-water">${out}</g>`;
  }

  // 孤舟：一道船身、一顶篷、可选立着的人
  function boat({ x, y, s = 1, figure = true, opacity = 0.55 }) {
    const g = (v) => R(v * s);
    return `<g class="ink-boat" transform="translate(${R(x)},${R(y)})" opacity="${opacity}">
      <path d="M${g(-64)},0 Q${g(-30)},${g(16)} 0,${g(17)} Q${g(34)},${g(16)} ${g(66)},${g(-2)}
               L${g(56)},${g(4)} Q${g(30)},${g(11)} 0,${g(11)} Q${g(-28)},${g(11)} ${g(-56)},${g(-3)} Z"/>
      <path d="M${g(-26)},${g(-2)} q${g(24)},${g(-20)} ${g(48)},0" fill="none" stroke-width="${g(2.4)}"/>
      ${figure ? `<path d="M${g(-38)},${g(-1)} l${g(2)},${g(-17)}" fill="none" stroke-width="${g(2.6)}"/>
      <circle cx="${g(-35.6)}" cy="${g(-21)}" r="${g(3.4)}"/>` : ""}
    </g>`;
  }

  // 月：留白的圆，只在边上罩一层淡墨
  function moon({ x, y, r = 52, opacity = 0.5 }) {
    return `<g class="ink-moon">
      <circle cx="${x}" cy="${y}" r="${R(r * 2.1)}" class="ink-halo" opacity="${R(opacity * 0.85, 2)}"/>
      <circle cx="${x}" cy="${y}" r="${R(r * 1.45)}" class="ink-halo" opacity="${R(opacity * 0.6, 2)}"/>
      <circle cx="${x}" cy="${y}" r="${r}" class="ink-disc"/>
      <circle cx="${x}" cy="${y}" r="${r}" class="ink-rim" fill="none" stroke-width="1.4" opacity="${R(opacity * 0.5, 2)}"/>
    </g>`;
  }

  // 云带：横向的淡墨晕，最容易做出「气」，动效也挂在这里
  function clouds({ y, bands = 3, seed = 11, opacity = 0.26, drift = true }) {
    const rand = rng(seed);
    let out = "";
    for (let i = 0; i < bands; i += 1) {
      const yy = y + i * (46 + rand() * 34);
      const w = 210 + rand() * 300;
      const sx = 10 + rand() * Math.max(30, 580 - w);
      const h = 32 + rand() * 34;
      out += `<path class="ink-cloud${drift ? " drift" : ""}" style="--d:${R(18 + i * 9)}s;--o:${R(i * -6)}s"
        d="M${R(sx)},${R(yy)} q${R(w * 0.18)},${R(-h)} ${R(w * 0.42)},${R(-h * 0.36)}
           q${R(w * 0.2)},${R(h * 0.5)} ${R(w * 0.58)},${R(-h * 0.14)}
           q${R(-w * 0.24)},${R(h * 0.9)} ${R(-w * 0.5)},${R(h * 0.42)}
           q${R(-w * 0.26)},${R(-h * 0.2)} ${R(-w * 0.5)},${R(h * 0.08)} Z"
        opacity="${R(opacity * (0.6 + rand() * 0.5), 2)}"/>`;
    }
    return `<g class="ink-clouds">${out}</g>`;
  }

  // 雾：贴着山脚的一条横雾，缓慢左右漂
  function mist({ y, h = 60, opacity = 0.9, seed = 3 }) {
    const rand = rng(seed);
    let out = "";
    for (let i = 0; i < 3; i += 1) {
      const yy = y + i * h * 0.5;
      out += `<rect class="ink-mist drift" style="--d:${R(34 + i * 11)}s;--o:${R(i * -8)}s"
        x="-80" y="${R(yy)}" width="760" height="${R(h * (0.7 + rand() * 0.6))}"
        opacity="${R(opacity * (0.5 + rand() * 0.4), 2)}"/>`;
    }
    return `<g class="ink-mists">${out}</g>`;
  }

  // 竹：竿分节，叶取「个」字与「介」字的叠法，叶片有肚子才像墨竹
  function bamboo({ x, y, h = 340, stalks = 3, seed = 9, opacity = 0.5 }) {
    const rand = rng(seed);
    // 一片叶：自节点起笔，中段鼓、末端收尖
    const leaf = (nx, ny, len, ang, dir) => {
      const ex = nx + dir * len * Math.cos(ang);
      const ey = ny + len * Math.sin(ang);
      const belly = len * 0.19;
      const mx = nx + dir * len * 0.45 * Math.cos(ang);
      const my = ny + len * 0.45 * Math.sin(ang);
      return `<path d="M${R(nx)},${R(ny)} Q${R(mx - belly * Math.sin(ang) * dir)},${R(my - belly)} ${R(ex)},${R(ey)}`
        + ` Q${R(mx + belly * 0.5 * Math.sin(ang) * dir)},${R(my + belly * 0.55)} ${R(nx)},${R(ny)} Z"/>`;
    };
    let out = "";
    for (let i = 0; i < stalks; i += 1) {
      const sx = x + i * (34 + rand() * 32);
      const sh = h * (0.72 + rand() * 0.42);
      const lean = (rand() - 0.5) * 30;
      const width = 3.6 + rand() * 2.6;
      out += `<path d="M${R(sx)},${R(y)} q${R(lean * 0.35)},${R(-sh * 0.5)} ${R(lean)},${R(-sh)}"
        fill="none" stroke-width="${R(width)}" opacity="${R(opacity, 2)}"/>`;
      const nodes = 5;
      for (let k = 1; k <= nodes; k += 1) {
        const t = k / (nodes + 0.4);
        const ny = y - sh * t;
        const nx = sx + lean * t * 0.85;
        out += `<path d="M${R(nx - width * 0.9)},${R(ny)} h${R(width * 1.8)}"
          fill="none" stroke-width="${R(width * 0.5)}" opacity="${R(opacity * 0.85, 2)}"/>`;
        if (k < 2) continue;                       // 下半竿只留竿，上半竿才生叶
        const dir = k % 2 ? 1 : -1;
        const blades = 2 + Math.floor(rand() * 2);
        for (let l = 0; l < blades; l += 1) {
          const len = 30 + rand() * 26;
          const ang = -0.62 + l * (0.5 + rand() * 0.22);
          out += `<g opacity="${R(opacity * (0.55 + rand() * 0.45), 2)}">${leaf(nx, ny, len, ang, dir)}</g>`;
        }
      }
    }
    return `<g class="ink-bamboo">${out}</g>`;
  }

  // 芦苇：浅滩边的细穗
  function reeds({ x, y, n = 9, seed = 13, opacity = 0.42 }) {
    const rand = rng(seed);
    let out = "";
    for (let i = 0; i < n; i += 1) {
      const sx = x + i * (16 + rand() * 20);
      const h = 60 + rand() * 90;
      const lean = (rand() - 0.4) * 34;
      out += `<path class="ink-reed sway" style="--o:${R(i * -1.7)}s"
        d="M${R(sx)},${R(y)} q${R(lean * 0.3)},${R(-h * 0.55)} ${R(lean)},${R(-h)}"
        fill="none" stroke-width="1.7" opacity="${R(opacity * (0.5 + rand() * 0.6), 2)}"/>`;
      out += `<path d="M${R(sx + lean)},${R(y - h)} q${R(lean * 0.5)},${R(-9)} ${R(lean * 0.7)},${R(-19)}"
        fill="none" stroke-width="3.4" opacity="${R(opacity * 0.65, 2)}"/>`;
    }
    return `<g class="ink-reeds">${out}</g>`;
  }

  // 楼阁：云上的瑶台，只取一角屋檐
  function pavilion({ x, y, s = 1, opacity = 0.4 }) {
    const g = (v) => R(v * s);
    // 一层屋顶：中间平缓、两端翘起的檐口
    const roof = (w, yy, lift) =>
      `<path d="M${g(-w)},${g(yy)} q${g(w * 0.16)},${g(-lift)} ${g(w * 0.34)},${g(-lift * 0.34)}
                Q0,${g(yy - lift * 1.5)} ${g(w * 0.66)},${g(yy - lift * 0.34)}
                q${g(w * 0.18)},${g(lift * 0.66)} ${g(w * 0.34)},${g(lift)}
                Q0,${g(yy - lift * 0.5)} ${g(-w)},${g(yy)} Z"/>`;
    return `<g class="ink-pavilion" transform="translate(${R(x)},${R(y)})" opacity="${opacity}">
      ${roof(96, 0, 26)}
      <path d="M${g(-58)},${g(6)} v${g(30)} M${g(58)},${g(6)} v${g(30)} M${g(-20)},${g(8)} v${g(28)} M${g(20)},${g(8)} v${g(28)}"
        fill="none" stroke-width="${g(2.2)}"/>
      ${roof(74, 42, 20)}
      <path d="M${g(-46)},${g(48)} v${g(34)} M${g(46)},${g(48)} v${g(34)} M${g(-16)},${g(50)} v${g(32)} M${g(16)},${g(50)} v${g(32)}"
        fill="none" stroke-width="${g(2.2)}"/>
      <path d="M${g(-58)},${g(70)} h${g(116)}" fill="none" stroke-width="${g(1.6)}" opacity=".75"/>
      <path d="M${g(-66)},${g(84)} h${g(132)}" fill="none" stroke-width="${g(3.4)}"/>
      <path d="M0,${g(-30)} v${g(-22)}" fill="none" stroke-width="${g(2.6)}"/>
    </g>`;
  }

  // 飞鸟：两笔一只
  function birds({ x, y, n = 4, seed = 21, opacity = 0.5, fly = true }) {
    const rand = rng(seed);
    let out = "";
    for (let i = 0; i < n; i += 1) {
      const bx = x + i * (44 + rand() * 40);
      const by = y + (rand() - 0.5) * 56;
      const w = 13 + rand() * 8;
      out += `<path d="M${R(bx - w)},${R(by)} q${R(w * 0.55)},${R(-w * 0.62)} ${R(w)},0
                       q${R(w * 0.45)},${R(-w * 0.62)} ${R(w)},0" fill="none"
        stroke-width="1.9" opacity="${R(opacity * (0.55 + rand() * 0.5), 2)}"/>`;
    }
    return `<g class="ink-birds${fly ? " fly" : ""}">${out}</g>`;
  }

  // 雪：疏落的点，缓慢下落
  function snow({ n = 26, seed = 31, opacity = 0.5 }) {
    const rand = rng(seed);
    let out = "";
    for (let i = 0; i < n; i += 1) {
      out += `<circle class="ink-flake fall" style="--d:${R(16 + rand() * 20)}s;--o:${R(rand() * -30)}s"
        cx="${R(20 + rand() * 560)}" cy="${R(rand() * 700)}" r="${R(1.4 + rand() * 2.4)}"
        opacity="${R(opacity * (0.4 + rand() * 0.6), 2)}"/>`;
    }
    return `<g class="ink-snow">${out}</g>`;
  }

  // 远去的水纹：一圈圈往外散
  function wake({ x, y, n = 4, opacity = 0.34 }) {
    let out = "";
    for (let i = 0; i < n; i += 1) {
      const rx = 40 + i * 46;
      out += `<ellipse class="ink-wake" cx="${x}" cy="${y}" rx="${rx}" ry="${R(rx * 0.17)}"
        fill="none" stroke-width="1.6" opacity="${R(opacity * (1 - i * 0.2), 2)}"/>`;
    }
    return `<g>${out}</g>`;
  }

  /* ---------------- 场景 ----------------
     每个场景按「远—中—近」分层，正文压在上半部，所以重墨都落在下半张。 */
  const SCENES = {
    "江舟": () => ridge({ y: 336, height: 168, seed: 41, opacity: 0.2 })
      + ridge({ y: 404, height: 124, seed: 77, opacity: 0.3 })
      + mist({ y: 480, h: 56, opacity: 0.88, seed: 4 })
      + water({ y: 584, rows: 7, seed: 12, opacity: 0.34 })
      + boat({ x: 402, y: 664, s: 0.95, figure: true, opacity: 0.55 })
      + reeds({ x: 48, y: 726, n: 7, seed: 6, opacity: 0.4 }),

    "瑶台": () => ridge({ y: 396, height: 208, seed: 101, opacity: 0.2, x0: 320, x1: 660 })
      + moon({ x: 186, y: 452, r: 58, opacity: 0.5 })
      + clouds({ y: 528, bands: 3, seed: 23, opacity: 0.44 })
      + pavilion({ x: 438, y: 516, s: 0.92, opacity: 0.44 })
      + clouds({ y: 626, bands: 3, seed: 57, opacity: 0.4 })
      + clouds({ y: 726, bands: 2, seed: 91, opacity: 0.3 })
      + birds({ x: 232, y: 372, n: 3, seed: 8, opacity: 0.32 }),

    "空江": () => ridge({ y: 424, height: 104, seed: 19, opacity: 0.16 })
      + mist({ y: 484, h: 68, opacity: 0.92, seed: 15 })
      + water({ y: 612, rows: 4, seed: 33, opacity: 0.24 })
      + boat({ x: 318, y: 680, s: 0.82, figure: false, opacity: 0.44 })
      + birds({ x: 108, y: 404, n: 3, seed: 27, opacity: 0.3 }),

    "对饮": () => ridge({ y: 388, height: 118, seed: 63, opacity: 0.17 })
      + mist({ y: 462, h: 54, opacity: 0.85, seed: 9 })
      + water({ y: 572, rows: 6, seed: 45, opacity: 0.3 })
      + wake({ x: 246, y: 690, n: 4, opacity: 0.32 })
      + boat({ x: 246, y: 660, s: 1, figure: true, opacity: 0.55 })
      + reeds({ x: 452, y: 730, n: 6, seed: 51, opacity: 0.36 }),

    "竹林": () => ridge({ y: 366, height: 132, seed: 29, opacity: 0.15 })
      + mist({ y: 444, h: 50, opacity: 0.85, seed: 22 })
      + water({ y: 664, rows: 4, seed: 61, opacity: 0.2 })
      + bamboo({ x: 42, y: 792, h: 424, stalks: 3, seed: 5, opacity: 0.46 })
      + bamboo({ x: 470, y: 800, h: 348, stalks: 3, seed: 18, opacity: 0.38 }),

    "飞雪": () => ridge({ y: 348, height: 160, seed: 37, opacity: 0.16 })
      + ridge({ y: 414, height: 112, seed: 71, opacity: 0.22 })
      + mist({ y: 486, h: 58, opacity: 0.9, seed: 13 })
      + snow({ n: 24, seed: 3, opacity: 0.42 })
      + reeds({ x: 404, y: 718, n: 6, seed: 44, opacity: 0.32 }),

    "远山": () => ridge({ y: 348, height: 156, seed: 53, opacity: 0.16 })
      + ridge({ y: 416, height: 116, seed: 11, opacity: 0.24 })
      + mist({ y: 484, h: 56, opacity: 0.85, seed: 7 })
      + water({ y: 596, rows: 6, seed: 25, opacity: 0.26 }),

    "月夜": () => moon({ x: 398, y: 396, r: 54, opacity: 0.48 })
      + clouds({ y: 448, bands: 2, seed: 35, opacity: 0.34 })
      + ridge({ y: 486, height: 124, seed: 47, opacity: 0.22 })
      + mist({ y: 552, h: 52, opacity: 0.85, seed: 17 })
      + water({ y: 650, rows: 5, seed: 59, opacity: 0.26 }),

    "烟渚": () => ridge({ y: 420, height: 96, seed: 67, opacity: 0.13 })
      + mist({ y: 474, h: 72, opacity: 0.95, seed: 21 })
      + water({ y: 596, rows: 5, seed: 39, opacity: 0.2 })
      + reeds({ x: 56, y: 716, n: 9, seed: 2, opacity: 0.38 })
      + boat({ x: 442, y: 668, s: 0.76, figure: false, opacity: 0.36 }),

    "春山": () => ridge({ y: 352, height: 146, seed: 83, opacity: 0.15 })
      + ridge({ y: 418, height: 108, seed: 31, opacity: 0.22 })
      + mist({ y: 486, h: 54, opacity: 0.8, seed: 26 })
      + water({ y: 604, rows: 6, seed: 73, opacity: 0.24 })
      + bamboo({ x: 492, y: 788, h: 316, stalks: 3, seed: 12, opacity: 0.32 })
      + birds({ x: 132, y: 372, n: 3, seed: 55, opacity: 0.3 })
  };

  const NAMES = Object.keys(SCENES);

  /* 没写「景」时按用词猜一个，猜不到就用远山 */
  const HINTS = [
    [/雪|寒|冬|霜/, "飞雪"],
    [/仙|瑶台|天阙|霞|羽衣|太虚|广寒|琼/, "瑶台"],
    [/酒|饮|歌|笑|同舟|沧浪/, "对饮"],
    [/竹|林|青林/, "竹林"],
    [/月|夜/, "月夜"],
    [/渚|苇|雾|烟/, "烟渚"],
    [/舟|江|川|浪|水/, "江舟"],
    [/春|柳|花/, "春山"]
  ];

  function guess(text) {
    for (const [re, name] of HINTS) if (re.test(text)) return name;
    return "远山";
  }

  const DEFS = `
    <svg class="ink-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ink-rough" x="-12%" y="-24%" width="124%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.013 0.03" numOctaves="3" seed="6" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/>
          <feGaussianBlur stdDeviation="1.1"/>
        </filter>
        <filter id="ink-soft" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="14"/>
        </filter>
        <linearGradient id="ink-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="1"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
    </svg>`;

  window.InkScenes = {
    names: NAMES,
    defs: () => DEFS,
    has: (name) => Object.prototype.hasOwnProperty.call(SCENES, name),
    guess,
    /* 返回一整幅跨页画面；单页时由 CSS 取中段 */
    svg(name, text) {
      const key = SCENES[name] ? name : guess(text || name || "");
      return `<svg class="ink-canvas" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice"
        aria-hidden="true" focusable="false">${SCENES[key]()}</svg>`;
    }
  };
})();
