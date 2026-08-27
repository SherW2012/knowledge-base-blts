/* Virtual Gear Room 的 3D 展台。一次只展示一台设备，可自由旋转、缩放。
   形体按各机型公布的标称三围参数化生成，1 场景单位 = 1 米。
   gear.modelPath 填了真实 GLB 时改用 GLB，并等比归一化到同一组三围。 */
import * as THREE from "./vendor/three.module.min.js";

const MM = 0.001;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const SURFACES = {
  graphite: { color: 0x2e3134, roughness: 0.52, metalness: 0.32 },
  black: { color: 0x202224, roughness: 0.46, metalness: 0.24 },
  silver: { color: 0xb7bbc0, roughness: 0.3, metalness: 0.86 },
  titanium: { color: 0x787c81, roughness: 0.33, metalness: 0.88 },
  steel: { color: 0x9ba1a7, roughness: 0.24, metalness: 0.92 },
  aluminium: { color: 0xc8cbcf, roughness: 0.3, metalness: 0.82 }
};

function makeMaterials(styleName) {
  const base = SURFACES[styleName] || SURFACES.graphite;
  const mk = (spec) => new THREE.MeshStandardMaterial({ ...spec, emissive: 0x8d9298, emissiveIntensity: 0 });
  return {
    body: mk(base),
    plate: mk({ ...base, color: new THREE.Color(base.color).multiplyScalar(0.88).getHex(), roughness: base.roughness + 0.06 }),
    dark: mk({ color: 0x16181a, roughness: 0.44, metalness: 0.3 }),
    deep: mk({ color: 0x0c0d0e, roughness: 0.36, metalness: 0.2 }),
    grip: mk({ color: 0x1a1b1d, roughness: 0.95, metalness: 0.01 }),
    metal: mk({ color: 0x9aa0a5, roughness: 0.22, metalness: 0.95 }),
    darkMetal: mk({ color: 0x54595e, roughness: 0.3, metalness: 0.9 }),
    screen: mk({ color: 0x08090a, roughness: 0.06, metalness: 0.12 }),
    glass: mk({ color: 0x0a1016, roughness: 0.04, metalness: 0.5 }),
    coating: mk({ color: 0x1d3a3a, roughness: 0.06, metalness: 0.65 }),
    accent: mk({ color: 0xd7dade, roughness: 0.36, metalness: 0.55 }),
    red: mk({ color: 0x8c2f2a, roughness: 0.5, metalness: 0.1 })
  };
}

/* ---------------- 基础几何 ---------------- */

function roundedShape(w, h, r) {
  const rad = Math.max(0.0002, Math.min(r, w / 2 - 0.0002, h / 2 - 0.0002));
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rad, -h / 2);
  s.lineTo(w / 2 - rad, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad);
  s.lineTo(w / 2, h / 2 - rad);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2);
  s.lineTo(-w / 2 + rad, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad);
  s.lineTo(-w / 2, -h / 2 + rad);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2);
  return s;
}

function slab(w, h, d, r, material, bevel) {
  const b = Math.max(0.00012, Math.min(bevel == null ? Math.min(d * 0.16, 0.0016) : bevel, d / 2 - 0.00012));
  const geometry = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth: d - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 18
  });
  geometry.translate(0, 0, -(d - b * 2) / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

const tube = (rTop, rBottom, h, material, seg = 40, open = false) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open), material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
};

const disc = (r, material, seg = 40) => new THREE.Mesh(new THREE.CircleGeometry(r, seg), material);

// 滚花：转盘边缘一圈细齿，是相机上最能看出「做工」的细节
function knurl(radius, height, count, material, depth = 0.0006) {
  const group = new THREE.Group();
  // 齿的切向宽度铺满大半个齿距、径向只凸出一点点，才像滚花；
  // 反过来（径向长、切向窄）会变成齿轮，一眼假。
  const pitch = (Math.PI * 2 * radius) / count;
  const geometry = new THREE.BoxGeometry(depth * 1.3, height, pitch * 0.56);
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const tooth = new THREE.Mesh(geometry, material);
    tooth.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    tooth.rotation.y = -a;
    group.add(tooth);
  }
  return group;
}

// 相机转盘：底座 + 滚花 + 顶面 + 刻度点
function commandDial(radius, height, materials, { ticks = 10, top = true } = {}) {
  const group = new THREE.Group();
  group.add(tube(radius, radius * 0.99, height, materials.darkMetal));
  const teeth = knurl(radius, height * 0.72, Math.max(24, Math.round(radius * 900)), materials.metal, radius * 0.045);
  group.add(teeth);
  if (top) {
    const cap = disc(radius * 0.9, materials.dark);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = height / 2 + 0.00012;
    group.add(cap);
    for (let i = 0; i < ticks; i += 1) {
      const a = (i / ticks) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.06, 0.0002, radius * 0.22), materials.accent);
      tick.position.set(Math.cos(a) * radius * 0.62, height / 2 + 0.0002, Math.sin(a) * radius * 0.62);
      tick.rotation.y = -a;
      group.add(tick);
    }
  }
  return group;
}

function button(radius, height, materials, mat) {
  const group = new THREE.Group();
  const well = tube(radius * 1.22, radius * 1.22, height * 0.4, materials.deep, 20);
  group.add(well);
  const cap = tube(radius, radius * 0.94, height, mat || materials.darkMetal, 20);
  cap.position.y = height * 0.4;
  group.add(cap);
  return group;
}

// 镜头：多级镜筒 + 滤镜螺纹环 + 镀膜前组，朝 +Z
function lensAssembly(diameter, length, materials, opt = {}) {
  const group = new THREE.Group();
  const r = diameter / 2;
  const steps = opt.steps || 2;
  let z = 0;
  let rr = r;
  for (let i = 0; i < steps; i += 1) {
    const segLen = length / steps;
    const next = rr * (i === steps - 1 ? 0.94 : 0.97);
    const seg = tube(next, rr, segLen, i % 2 ? materials.dark : materials.plate);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = z + segLen / 2;
    group.add(seg);
    // 段与段之间的接缝
    const ring = tube(rr * 1.005, rr * 1.005, segLen * 0.07, materials.deep);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = z + segLen;
    group.add(ring);
    z += segLen; rr = next;
  }
  // 滤镜螺纹环
  const thread = tube(rr * 0.99, rr * 0.99, length * 0.1, materials.darkMetal);
  thread.rotation.x = Math.PI / 2;
  thread.position.z = z - length * 0.04;
  group.add(thread);
  group.add((() => {
    const t = knurl(rr * 0.995, length * 0.08, Math.max(48, Math.round(rr * 2200)), materials.darkMetal, rr * 0.01);
    t.rotation.x = Math.PI / 2;
    t.position.z = z - length * 0.04;
    return t;
  })());
  // 内壁与镀膜前组
  const inner = tube(rr * 0.86, rr * 0.9, length * 0.5, materials.deep, 40, true);
  inner.rotation.x = Math.PI / 2;
  inner.position.z = z - length * 0.24;
  group.add(inner);
  const front = disc(rr * 0.82, materials.coating);
  front.position.z = z - length * 0.02;
  group.add(front);
  const highlight = disc(rr * 0.5, materials.glass);
  highlight.position.z = z - length * 0.015;
  group.add(highlight);
  if (opt.ring !== false) {
    const base = tube(r * 1.004, r * 1.004, length * 0.2, materials.grip);
    base.rotation.x = Math.PI / 2;
    base.position.z = length * 0.34;
    group.add(base);
    const focus = knurl(r * 1.008, length * 0.2, Math.max(56, Math.round(r * 2400)), materials.grip, r * 0.012);
    focus.rotation.x = Math.PI / 2;
    focus.position.z = length * 0.34;
    group.add(focus);
  }
  return group;
}

// 背屏：外框、玻璃、下方一条极窄的高光
function screenPanel(w, h, materials, thickness = 0.0018) {
  const group = new THREE.Group();
  group.add(slab(w, h, thickness, Math.min(w, h) * 0.05, materials.dark, 0.0003));
  const glass = slab(w * 0.955, h * 0.93, 0.0007, Math.min(w, h) * 0.04, materials.screen, 0.0002);
  glass.position.z = thickness * 0.62;
  group.add(glass);
  return group;
}

// 十字键 + 中央确认键
function dpad(radius, materials) {
  const group = new THREE.Group();
  group.add(tube(radius, radius, 0.0014, materials.dark, 28));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const key = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.5, 0.0011, radius * 0.34), materials.darkMetal);
    key.position.set(Math.cos(a) * radius * 0.58, 0.0011, Math.sin(a) * radius * 0.58);
    key.rotation.y = -a;
    group.add(key);
  }
  const center = tube(radius * 0.36, radius * 0.36, 0.0013, materials.darkMetal, 24);
  center.position.y = 0.0011;
  group.add(center);
  return group;
}

function hotShoe(width, materials) {
  const group = new THREE.Group();
  group.add(slab(width, width * 0.78, 0.0018, width * 0.06, materials.dark, 0.0004));
  const inner = new THREE.Mesh(new THREE.BoxGeometry(width * 0.62, 0.0009, width * 0.5), materials.deep);
  inner.position.y = 0.0011;
  group.add(inner);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.06, 0.0016, width * 0.72), materials.metal);
    rail.position.set(side * width * 0.44, 0.0013, 0);
    group.add(rail);
  }
  for (let i = 0; i < 3; i += 1) {
    const pin = tube(width * 0.035, width * 0.035, 0.0004, materials.accent, 12);
    pin.position.set((i - 1) * width * 0.16, 0.0013, -width * 0.1);
    group.add(pin);
  }
  return group;
}

const seam = (w, h, d, materials) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.deep);

/* ---------------- 机型形体 ----------------
   统一朝向：底面贴台（y=0）、镜头朝 +Z。 */

function buildCompact(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const st = gear.style || {};
  const g = new THREE.Group();

  const body = slab(W, H, D, Math.min(W, H) * 0.085, materials.body);
  body.position.set(0, H / 2, 0);
  g.add(body);

  // 前脸另做一层薄板，和机身之间留一道缝，看起来像两片壳合起来的
  const face = slab(W * 0.985, H * 0.97, D * 0.1, Math.min(W, H) * 0.08, materials.plate, 0.0005);
  face.position.set(0, H / 2, D / 2 - D * 0.03);
  g.add(face);
  const gap = seam(W * 0.99, 0.0004, 0.0006, materials);
  gap.position.set(0, H * 0.02, D / 2 - 0.0002);
  g.add(gap);

  const lensD = (st.lens || 32) * MM;
  const barrelL = (st.barrel || 9) * MM;
  const lx = -W * 0.19;
  const ly = H * 0.55;
  const collar = tube(lensD * 0.66, lensD * 0.7, 0.0022, materials.plate, 44);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(lx, ly, D / 2 + 0.0006);
  g.add(collar);
  const lens = lensAssembly(lensD, barrelL, materials, { steps: 2, ring: false });
  lens.position.set(lx, ly, D / 2 + 0.0016);
  g.add(lens);

  if (st.grip) {
    // 手柄要往机身里埋深一点，只露 7mm 上下；埋太浅会看成一块贴上去的板
    const grip = slab(W * 0.13, H * 0.88, D * 0.34, W * 0.035, materials.grip, 0.0008);
    grip.position.set(W * 0.4, H / 2, D / 2 + D * 0.05);
    g.add(grip);
    for (let i = 0; i < 7; i += 1) {
      const rib = seam(W * 0.11, H * 0.006, 0.0004, materials);
      rib.position.set(W * 0.4, H * 0.24 + i * H * 0.085, D / 2 + D * 0.215);
      g.add(rib);
    }
  }

  // 顶面
  const shutter = button(W * 0.036, 0.0022, materials, materials.metal);
  shutter.position.set(W * 0.29, H, -D * 0.06);
  g.add(shutter);
  const power = button(W * 0.02, 0.0014, materials);
  power.position.set(W * 0.185, H, -D * 0.08);
  g.add(power);
  const mode = commandDial(W * 0.062, 0.0042, materials, { ticks: 12 });
  mode.position.set(W * 0.09, H + 0.0021, -D * 0.04);
  g.add(mode);

  // 前脸细节：闪光灯、AF 辅助灯、麦克风孔
  const flash = slab(W * 0.13, H * 0.05, 0.001, 0.0006, materials.screen, 0.0002);
  flash.position.set(W * 0.26, H * 0.86, D / 2 + 0.0008);
  g.add(flash);
  const af = tube(W * 0.018, W * 0.018, 0.0008, materials.red, 16);
  af.rotation.x = Math.PI / 2;
  af.position.set(W * 0.11, H * 0.86, D / 2 + 0.0008);
  g.add(af);
  for (let i = 0; i < 2; i += 1) {
    const mic = tube(W * 0.008, W * 0.008, 0.0006, materials.deep, 10);
    mic.rotation.x = Math.PI / 2;
    mic.position.set(-W * 0.36 + i * W * 0.03, H * 0.9, D / 2 + 0.0006);
    g.add(mic);
  }

  // 背面：屏幕、拇指位、十字键、按钮列
  const screen = screenPanel(W * 0.6, H * 0.7, materials);
  screen.rotation.y = Math.PI;
  screen.position.set(-W * 0.16, H * 0.5, -D / 2 - 0.0009);
  g.add(screen);
  const thumb = slab(W * 0.14, H * 0.3, 0.0016, W * 0.03, materials.grip, 0.0004);
  thumb.rotation.y = Math.PI;
  thumb.position.set(W * 0.36, H * 0.72, -D / 2 - 0.0008);
  g.add(thumb);
  const pad = dpad(W * 0.075, materials);
  pad.rotation.x = Math.PI / 2;
  pad.rotation.z = Math.PI;
  pad.position.set(W * 0.32, H * 0.36, -D / 2 - 0.0009);
  g.add(pad);
  for (let i = 0; i < 3; i += 1) {
    const b = button(W * 0.019, 0.0012, materials);
    b.rotation.x = -Math.PI / 2;
    b.position.set(W * 0.32 - i * W * 0.001, H * 0.86 - i * H * 0.1, -D / 2 - 0.0009);
    g.add(b);
  }

  // 侧面：吊带环与端口盖
  for (const side of [-1, 1]) {
    const lug = tube(H * 0.022, H * 0.022, 0.0016, materials.darkMetal, 12);
    lug.rotation.z = Math.PI / 2;
    lug.position.set(side * W * 0.5, H * 0.86, 0);
    g.add(lug);
  }
  const port = slab(D * 0.55, H * 0.4, 0.0009, 0.0008, materials.plate, 0.0003);
  port.rotation.y = -Math.PI / 2;
  port.position.set(-W / 2 - 0.0004, H * 0.5, 0);
  g.add(port);
  // 底部三脚架孔与电池盖
  const tripod = tube(W * 0.03, W * 0.03, 0.0008, materials.deep, 18);
  tripod.position.set(-W * 0.1, 0.0004, 0);
  g.add(tripod);
  const battery = seam(W * 0.5, 0.0005, D * 0.7, materials);
  battery.position.set(W * 0.16, 0.0006, 0);
  g.add(battery);

  return g;
}

function buildCompactZoom(gear, materials) {
  const g = buildCompact(gear, materials);
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const st = gear.style || {};
  if (st.hotshoe) {
    const shoe = hotShoe(W * 0.16, materials);
    shoe.position.set(-W * 0.03, H + 0.0012, -D * 0.02);
    g.add(shoe);
  }
  // 曝光补偿盘叠在模式盘上，是 G12 最认得出的特征
  const exp = commandDial(W * 0.085, 0.0044, materials, { ticks: 13 });
  exp.position.set(-W * 0.3, H + 0.0022, -D * 0.04);
  g.add(exp);
  const iso = commandDial(W * 0.055, 0.0028, materials, { ticks: 8 });
  iso.position.set(-W * 0.3, H + 0.0064, -D * 0.04);
  g.add(iso);
  // 光学取景器
  const vf = slab(W * 0.13, H * 0.075, 0.0012, 0.0006, materials.glass, 0.0003);
  vf.position.set(-W * 0.1, H * 0.88, D / 2 + 0.0007);
  g.add(vf);
  const vfBack = slab(W * 0.075, H * 0.05, 0.0012, 0.0004, materials.glass, 0.0003);
  vfBack.rotation.y = Math.PI;
  vfBack.position.set(-W * 0.1, H * 0.86, -D / 2 - 0.0008);
  g.add(vfBack);
  // 侧翻屏转轴
  for (let i = 0; i < 3; i += 1) {
    const hinge = tube(H * 0.018, H * 0.018, H * 0.17, materials.darkMetal, 16);
    hinge.position.set(-W * 0.455, H * 0.28 + i * H * 0.2, -D / 2 - 0.001);
    g.add(hinge);
  }
  return g;
}

function buildMirrorless(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const st = gear.style || {};
  const g = new THREE.Group();
  const bodyD = D * 0.4;
  const bz = -D / 2 + bodyD / 2;

  const body = slab(W, H, bodyD, Math.min(W, H) * 0.08, materials.body);
  body.position.set(0, H / 2, bz);
  g.add(body);
  const back = slab(W * 0.99, H * 0.98, bodyD * 0.14, Math.min(W, H) * 0.075, materials.plate, 0.0006);
  back.position.set(0, H / 2, bz - bodyD * 0.44);
  g.add(back);

  // 深手柄：外形 + 蒙皮 + 指槽
  const grip = slab(W * 0.26, H * 0.95, D * 0.46, W * 0.07, materials.body, 0.0016);
  grip.position.set(W * 0.35, H / 2, -D / 2 + bodyD * 0.95);
  g.add(grip);
  const skin = slab(W * 0.2, H * 0.8, D * 0.4, W * 0.05, materials.grip, 0.0012);
  skin.position.set(W * 0.395, H * 0.48, -D / 2 + bodyD * 1.02);
  g.add(skin);
  const rest = tube(H * 0.09, H * 0.09, W * 0.12, materials.grip, 24);
  rest.rotation.z = Math.PI / 2;
  rest.position.set(W * 0.28, H * 0.34, -D / 2 + bodyD * 1.08);
  g.add(rest);

  // 军舰部
  const hump = slab(W * 0.32, H * 0.2, bodyD * 0.88, W * 0.035, materials.body, 0.0012);
  hump.position.set(-W * 0.05, H + H * 0.08, bz);
  g.add(hump);
  if (st.hotshoe) {
    const shoe = hotShoe(W * 0.15, materials);
    shoe.position.set(-W * 0.05, H + H * 0.18, bz);
    g.add(shoe);
  }
  if (st.evf) {
    const cup = slab(W * 0.17, H * 0.105, 0.005, W * 0.022, materials.grip, 0.0012);
    cup.rotation.y = Math.PI;
    cup.position.set(-W * 0.05, H + H * 0.06, bz - bodyD * 0.5 - 0.0022);
    g.add(cup);
    const eye = slab(W * 0.1, H * 0.055, 0.001, W * 0.012, materials.glass, 0.0003);
    eye.rotation.y = Math.PI;
    eye.position.set(-W * 0.05, H + H * 0.06, bz - bodyD * 0.5 - 0.005);
    g.add(eye);
  }

  // 镜头卡口与镜头
  const lensD = (st.lens || 60) * MM;
  const barrelL = (st.barrel || 44) * MM;
  const lz = -D / 2 + bodyD;
  const mountRing = tube(lensD * 0.6, lensD * 0.6, 0.0026, materials.metal, 48);
  mountRing.rotation.x = Math.PI / 2;
  mountRing.position.set(-W * 0.05, H * 0.5, lz + 0.0012);
  g.add(mountRing);
  for (let i = 0; i < 4; i += 1) {
    const screw = tube(0.0011, 0.0011, 0.0004, materials.darkMetal, 8);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    screw.rotation.x = Math.PI / 2;
    screw.position.set(-W * 0.05 + Math.cos(a) * lensD * 0.52, H * 0.5 + Math.sin(a) * lensD * 0.52, lz + 0.0026);
    g.add(screw);
  }
  const release = tube(0.0028, 0.0028, 0.0022, materials.darkMetal, 16);
  release.rotation.x = Math.PI / 2;
  release.position.set(-W * 0.05 - lensD * 0.62, H * 0.5, lz + 0.0006);
  g.add(release);
  const lens = lensAssembly(lensD, barrelL, materials, { steps: 3, ring: true });
  lens.position.set(-W * 0.05, H * 0.5, lz + 0.0026);
  g.add(lens);
  const zoomBase = tube(lensD * 0.505, lensD * 0.505, barrelL * 0.24, materials.grip);
  zoomBase.rotation.x = Math.PI / 2;
  zoomBase.position.set(-W * 0.05, H * 0.5, lz + 0.0026 + barrelL * 0.66);
  g.add(zoomBase);
  const zoomRing = knurl(lensD * 0.509, barrelL * 0.24, 104, materials.grip, lensD * 0.006);
  zoomRing.rotation.x = Math.PI / 2;
  zoomRing.position.set(-W * 0.05, H * 0.5, lz + 0.0026 + barrelL * 0.66);
  g.add(zoomRing);

  // 顶面三个拨盘 + 快门 + 录制键
  const dials = st.dials || 3;
  for (let i = 0; i < dials; i += 1) {
    const d = commandDial(W * 0.062 - i * W * 0.004, 0.0046, materials, { ticks: 12 });
    d.position.set(W * 0.3 - i * W * 0.155, H + 0.0023, bz + bodyD * (0.24 - i * 0.1));
    g.add(d);
  }
  const shutter = button(W * 0.032, 0.0024, materials, materials.metal);
  shutter.position.set(W * 0.3, H, bz + bodyD * 0.44);
  g.add(shutter);
  const rec = button(W * 0.018, 0.0016, materials, materials.red);
  rec.position.set(W * 0.16, H, bz + bodyD * 0.4);
  g.add(rec);

  // 背面
  const screen = screenPanel(W * 0.62, H * 0.62, materials, 0.0022);
  screen.rotation.y = Math.PI;
  screen.position.set(-W * 0.08, H * 0.46, bz - bodyD * 0.5 - 0.0013);
  g.add(screen);
  const hinge = tube(H * 0.02, H * 0.02, H * 0.5, materials.darkMetal, 16);
  hinge.position.set(-W * 0.42, H * 0.46, bz - bodyD * 0.5 - 0.0014);
  g.add(hinge);
  const joystick = tube(W * 0.014, W * 0.02, 0.0022, materials.darkMetal, 14);
  joystick.rotation.x = Math.PI / 2;
  joystick.position.set(W * 0.24, H * 0.66, bz - bodyD * 0.5 - 0.0016);
  g.add(joystick);
  for (let i = 0; i < 4; i += 1) {
    const b = button(W * 0.018, 0.0012, materials);
    b.rotation.x = -Math.PI / 2;
    b.position.set(W * 0.24, H * 0.5 - i * H * 0.1, bz - bodyD * 0.5 - 0.0012);
    g.add(b);
  }

  for (const side of [-1, 1]) {
    const lug = tube(H * 0.024, H * 0.024, 0.0018, materials.darkMetal, 12);
    lug.rotation.z = Math.PI / 2;
    lug.position.set(side * W * 0.5, H * 0.88, bz);
    g.add(lug);
  }
  const tripod = tube(W * 0.026, W * 0.026, 0.0008, materials.deep, 18);
  tripod.position.set(-W * 0.05, 0.0004, bz);
  g.add(tripod);
  return g;
}

function buildPhone(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const st = gear.style || {};
  const g = new THREE.Group();

  // 中框比玻璃背板稍窄，做出「三明治」的层次
  const frame = slab(W, H, D, W * 0.13, materials.body, D * 0.34);
  frame.rotation.x = -Math.PI / 2;
  frame.position.set(0, D / 2, 0);
  g.add(frame);
  const backGlass = slab(W * 0.985, H * 0.992, D * 0.1, W * 0.125, materials.plate, D * 0.03);
  backGlass.rotation.x = -Math.PI / 2;
  backGlass.position.set(0, D * 0.97, 0);
  g.add(backGlass);

  // 天线断点
  for (const z of [-H * 0.36, H * 0.36]) {
    for (const x of [-W / 2, W / 2]) {
      const cut = seam(0.0007, D * 0.9, 0.0016, materials);
      cut.position.set(x, D / 2, z);
      g.add(cut);
    }
  }
  // 侧键
  const power = slab(D * 0.5, H * 0.075, 0.0009, 0.0003, materials.body, 0.0002);
  power.rotation.y = Math.PI / 2;
  power.position.set(W / 2 + 0.0003, D / 2, -H * 0.06);
  g.add(power);
  for (let i = 0; i < 2; i += 1) {
    const vol = slab(D * 0.5, H * 0.05, 0.0009, 0.0003, materials.body, 0.0002);
    vol.rotation.y = Math.PI / 2;
    vol.position.set(-W / 2 - 0.0003, D / 2, -H * 0.02 - i * H * 0.07);
    g.add(vol);
  }

  const count = st.cameras || 2;
  const layout = st.cameraLayout || (count >= 3 ? "triangle" : "vertical");
  const islandW = count >= 3 ? W * 0.38 : W * 0.21;
  const islandH = count >= 3 ? W * 0.38 : (layout === "horizontal" ? W * 0.21 : W * 0.34);
  const ix = -W * 0.25;
  const iz = -H * 0.33;
  const island = slab(islandW, islandH, D * 0.62, islandW * 0.3, materials.plate, D * 0.14);
  island.rotation.x = -Math.PI / 2;
  island.position.set(ix, D + D * 0.3, iz);
  g.add(island);

  const spots = count >= 3
    ? [[-0.25, 0.21], [0.23, 0.21], [-0.01, -0.25]]
    : layout === "horizontal" ? [[-0.23, 0], [0.23, 0]] : [[0, 0.23], [0, -0.23]];
  const lensR = count >= 3 ? W * 0.082 : W * 0.068;
  for (const [ox, oz] of spots) {
    const cx = ix + ox * islandW;
    const cz = iz - oz * islandH;
    // 金属环 + 黑色内壁 + 镀膜镜片，手机镜头最出效果的就是这三层
    const ring = tube(lensR, lensR, D * 0.5, materials.metal, 32);
    ring.position.set(cx, D + D * 0.62, cz);
    g.add(ring);
    const well = tube(lensR * 0.84, lensR * 0.84, D * 0.46, materials.deep, 32);
    well.position.set(cx, D + D * 0.66, cz);
    g.add(well);
    const el = disc(lensR * 0.62, materials.coating, 32);
    el.rotation.x = -Math.PI / 2;
    el.position.set(cx, D + D * 0.86, cz);
    g.add(el);
    const spec = disc(lensR * 0.3, materials.glass, 24);
    spec.rotation.x = -Math.PI / 2;
    spec.position.set(cx, D + D * 0.87, cz);
    g.add(spec);
  }
  if (count >= 3) {
    const flash = tube(W * 0.032, W * 0.032, D * 0.44, materials.accent, 20);
    flash.position.set(ix + islandW * 0.3, D + D * 0.6, iz + islandH * 0.28);
    g.add(flash);
    const lidar = tube(W * 0.022, W * 0.022, D * 0.44, materials.deep, 16);
    lidar.position.set(ix + islandW * 0.3, D + D * 0.6, iz - islandH * 0.02);
    g.add(lidar);
  } else {
    const flash = tube(W * 0.026, W * 0.026, D * 0.42, materials.accent, 18);
    flash.position.set(ix + islandW * 0.75, D + D * 0.56, iz);
    g.add(flash);
  }
  // 背面中央的一枚圆形标识（不放品牌 logo）
  const badge = tube(W * 0.075, W * 0.075, D * 0.06, materials.metal, 32);
  badge.position.set(0, D * 1.02, 0);
  g.add(badge);
  return g;
}

function buildPocketGimbal(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const g = new THREE.Group();
  const stickH = H * 0.6;

  const body = slab(W, stickH, D, W * 0.24, materials.body);
  body.position.set(0, stickH / 2, 0);
  g.add(body);
  const screen = screenPanel(W * 0.76, stickH * 0.62, materials, 0.0014);
  screen.position.set(0, stickH * 0.5, D / 2 + 0.0007);
  g.add(screen);
  // 背面的触控条与电源键
  const strip = slab(W * 0.5, stickH * 0.06, 0.0008, 0.0006, materials.dark, 0.0002);
  strip.rotation.y = Math.PI;
  strip.position.set(0, stickH * 0.16, -D / 2 - 0.0005);
  g.add(strip);
  const pwr = button(W * 0.05, 0.0014, materials);
  pwr.rotation.x = Math.PI / 2;
  pwr.position.set(0, stickH * 0.78, -D / 2 - 0.0006);
  g.add(pwr);
  // 底部接口
  const usb = slab(W * 0.34, D * 0.3, 0.0006, 0.0004, materials.deep, 0.0002);
  usb.rotation.x = Math.PI / 2;
  usb.position.set(0, 0.0004, 0);
  g.add(usb);

  // 三轴云台：横轴臂 + 竖轴 + 相机头
  const armH = H * 0.17;
  for (const side of [-1, 1]) {
    const arm = slab(W * 0.17, armH, D * 0.36, W * 0.06, materials.body, 0.0008);
    arm.position.set(side * W * 0.3, stickH + armH / 2, 0);
    g.add(arm);
    const joint = tube(W * 0.09, W * 0.09, W * 0.05, materials.darkMetal, 24);
    joint.rotation.z = Math.PI / 2;
    joint.position.set(side * W * 0.3, stickH + armH * 0.88, 0);
    g.add(joint);
  }
  const yoke = tube(W * 0.075, W * 0.075, W * 0.6, materials.dark, 24);
  yoke.rotation.z = Math.PI / 2;
  yoke.position.set(0, stickH + armH * 0.88, 0);
  g.add(yoke);

  const headW = W * 0.56;
  const head = slab(headW, H * 0.21, D * 0.66, headW * 0.22, materials.body, 0.0008);
  head.position.set(0, stickH + armH * 0.88, 0);
  g.add(head);
  const lens = lensAssembly(D * 0.46, D * 0.2, materials, { steps: 2, ring: false });
  lens.position.set(0, stickH + armH * 0.88, D * 0.33);
  g.add(lens);
  const status = tube(W * 0.02, W * 0.02, 0.0006, materials.accent, 12);
  status.rotation.x = Math.PI / 2;
  status.position.set(headW * 0.34, stickH + armH * 1.02, D * 0.33);
  g.add(status);
  return g;
}

const BUILDERS = {
  compact: buildCompact,
  "compact-zoom": buildCompactZoom,
  mirrorless: buildMirrorless,
  phone: buildPhone,
  "pocket-gimbal": buildPocketGimbal
};

function buildPending(materials) {
  const g = new THREE.Group();
  const w = 0.078, h = 0.16, d = 0.009;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3d4145, roughness: 0.9, metalness: 0.05,
    transparent: true, opacity: 0.42, emissive: 0x8d9298, emissiveIntensity: 0
  });
  const s = slab(w, h, d, w * 0.13, mat, d * 0.3);
  s.rotation.x = -Math.PI / 2;
  s.position.set(0, d / 2, 0);
  g.add(s);
  return g;
}

export function buildGearObject(gear) {
  const materials = makeMaterials((gear.style && gear.style.body) || "graphite");
  const builder = BUILDERS[gear.form];
  const g = (!gear.dimensions || gear.status === "pending" || !builder)
    ? buildPending(materials)
    : builder(gear, materials);
  g.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  return g;
}

/* ---------------- 真实 GLB ---------------- */
let loaderPromise = null;
export async function loadGearModel(gear) {
  if (!gear.modelPath) return null;
  if (!loaderPromise) loaderPromise = import("./vendor/GLTFLoader.js").then((m) => new m.GLTFLoader());
  const loader = await loaderPromise;
  const gltf = await loader.loadAsync(gear.modelPath);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (gear.dimensions && size.x > 0 && size.y > 0 && size.z > 0) {
    const want = new THREE.Vector3(...gear.dimensions.map((v) => v * MM));
    const factor = Math.min(want.x / size.x, want.y / size.y, want.z / size.z);
    if (Number.isFinite(factor) && factor > 0) model.scale.setScalar(factor);
  }
  const scaled = new THREE.Box3().setFromObject(model);
  const center = scaled.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaled.min.y, -center.z);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  return wrap;
}

export function isSupported() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch (error) { return false; }
}

/* ---------------- 展台 ---------------- */

function studioEnvironment(renderer, dark) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  if (dark) { sky.addColorStop(0, "#3f444a"); sky.addColorStop(0.52, "#22262a"); sky.addColorStop(1, "#0c0d0f"); }
  else { sky.addColorStop(0, "#eef0f2"); sky.addColorStop(0.52, "#a2a7ad"); sky.addColorStop(1, "#3c4045"); }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  const box = (x, y, w, h, alpha) => {
    const grd = ctx.createRadialGradient(x, y, 3, x, y, w);
    grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd; ctx.fillRect(x - w, y - h, w * 2, h * 2);
  };
  box(140, 52, 130, 110, dark ? 0.6 : 1);
  box(360, 70, 96, 90, dark ? 0.34 : 0.58);
  box(255, 150, 150, 80, dark ? 0.16 : 0.24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose(); pmrem.dispose();
  return target.texture;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createGearStudio(container, options) {
  const opts = options || {};
  const dark = !!opts.dark;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = dark ? 1.02 : 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer, dark);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 12);

  const key = new THREE.DirectionalLight(0xffffff, dark ? 1.6 : 2.2);
  key.position.set(0.24, 0.42, 0.3);
  key.castShadow = true;
  // 阴影视锥要盖住整块转台，不然锥外的地面会去采样边缘像素，
  // 在地上拖出一圈扇形的假影
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.02; key.shadow.camera.far = 1.6;
  key.shadow.camera.left = -0.34; key.shadow.camera.right = 0.34;
  key.shadow.camera.top = 0.34; key.shadow.camera.bottom = -0.34;
  key.shadow.bias = -0.00006;
  key.shadow.normalBias = 0.0035;
  key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, dark ? 0.7 : 0.85);
  rim.position.set(-0.3, 0.2, -0.34);
  scene.add(rim);

  // 无缝背景幕：一块弯上去的地面，产品摄影里的 cyclorama
  const sweep = new THREE.Shape();
  sweep.moveTo(-0.5, 0);
  sweep.lineTo(0.16, 0);
  sweep.quadraticCurveTo(0.42, 0, 0.42, 0.26);
  sweep.lineTo(0.42, 0.72);
  sweep.lineTo(-0.5, 0.72);
  const backdropGeo = new THREE.ExtrudeGeometry(sweep, { depth: 1.6, bevelEnabled: false, curveSegments: 24 });
  backdropGeo.rotateY(-Math.PI / 2);
  backdropGeo.translate(0.8, 0, 0);
  const backdrop = new THREE.Mesh(backdropGeo, new THREE.MeshStandardMaterial({
    color: dark ? 0x191b1d : 0x53585d, roughness: 0.97, metalness: 0.02, side: THREE.DoubleSide
  }));
  // 背景幕大而斜，接阴影必然长一身 shadow acne；影子只落在转台上就够了
  backdrop.receiveShadow = false;
  backdrop.rotation.y = -Math.PI / 2;
  scene.add(backdrop);

  // 转台
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.176, 0.006, 96),
    new THREE.MeshStandardMaterial({ color: dark ? 0x232629 : 0x40454a, roughness: 0.6, metalness: 0.3 })
  );
  // 台面要抬出地面一点点，和背景幕的地面共面会 z-fighting，
  // 在台面上拉出一圈跟着三角扇走的条纹
  stage.position.y = -0.0026;
  stage.receiveShadow = true;
  scene.add(stage);

  const turntable = new THREE.Group();
  scene.add(turntable);

  const view = { radius: 0.34, phi: 1.16, theta: 0.6, target: new THREE.Vector3(0, 0.03, 0) };
  const want = { radius: 0.34, phi: 1.16, theta: 0.6, target: new THREE.Vector3(0, 0.03, 0) };
  let flight = null;
  let spin = !REDUCED;
  const setSpin = (next) => { if (spin === next) return spin; spin = next; opts.onSpin?.(spin); return spin; };
  let current = null;
  const cache = new Map();

  function frameObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = Math.max(camera.aspect, 0.4);
    const fit = Math.max(
      (size.y * 1.5) / (2 * Math.tan(vFov / 2)),
      (size.x * 1.5) / (2 * Math.tan(vFov / 2) * aspect),
      (size.z * 1.5) / (2 * Math.tan(vFov / 2))
    );
    return { radius: Math.max(fit + maxDim * 0.5, 0.055), target: new THREE.Vector3(0, center.y, 0) };
  }

  function show(gear) {
    if (!gear) return;
    if (current) { turntable.remove(current.node); }
    let entry = cache.get(gear.id);
    if (!entry) {
      const node = buildGearObject(gear);
      entry = { gear, node, materials: [] };
      node.traverse((n) => { if (n.isMesh && n.material) entry.materials.push(n.material); });
      cache.set(gear.id, entry);
      if (gear.modelPath) {
        loadGearModel(gear).then((model) => {
          if (!model) return;
          const live = cache.get(gear.id);
          const wasCurrent = current && current.gear.id === gear.id;
          if (wasCurrent) turntable.remove(live.node);
          live.node.traverse((n) => { if (n.isMesh) n.geometry?.dispose?.(); });
          live.node = model;
          live.materials = [];
          model.traverse((n) => { if (n.isMesh && n.material) live.materials.push(n.material); });
          if (wasCurrent) { turntable.add(model); applyFrame(model); }
        }).catch((error) => console.warn(`[gear-room] ${gear.id} 模型加载失败，保留参数化形体`, error));
      }
    }
    current = entry;
    turntable.add(entry.node);
    turntable.rotation.y = 0;
    entry.node.scale.setScalar(0.9);
    entry.enter = performance.now();
    applyFrame(entry.node);
  }

  function applyFrame(object) {
    const fit = frameObject(object);
    const next = { radius: fit.radius, phi: want.phi, theta: want.theta, target: fit.target };
    if (REDUCED) {
      Object.assign(want, { radius: next.radius, phi: next.phi, theta: next.theta });
      want.target.copy(next.target); view.target.copy(next.target);
      view.radius = next.radius; flight = null;
      return;
    }
    flight = {
      from: { radius: view.radius, phi: view.phi, theta: view.theta, target: view.target.clone() },
      to: next, start: performance.now(), duration: 620
    };
    Object.assign(want, { radius: next.radius, phi: next.phi, theta: next.theta });
    want.target.copy(next.target);
  }

  function applyCamera() {
    const sinPhi = Math.sin(view.phi);
    camera.position.set(
      view.target.x + view.radius * sinPhi * Math.sin(view.theta),
      view.target.y + view.radius * Math.cos(view.phi),
      view.target.z + view.radius * sinPhi * Math.cos(view.theta)
    );
    camera.lookAt(view.target);
  }

  /* 自由旋转 */
  const el = renderer.domElement;
  el.style.touchAction = "none";
  let drag = null;
  let pinch = null;

  el.addEventListener("pointerdown", (event) => {
    setSpin(false);
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
    el.setPointerCapture(event.pointerId);
    el.style.cursor = "grabbing";
  });
  el.addEventListener("pointermove", (event) => {
    if (!drag) return;
    want.theta -= (event.clientX - drag.x) * 0.0072;
    want.phi = Math.min(1.5, Math.max(0.12, want.phi - (event.clientY - drag.y) * 0.006));
    drag.x = event.clientX; drag.y = event.clientY;
    flight = null;
  });
  const release = (event) => {
    if (!drag) return;
    try { el.releasePointerCapture(drag.id); } catch (error) { /* 已释放 */ }
    drag = null;
    el.style.cursor = "grab";
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("wheel", (event) => {
    event.preventDefault();
    setSpin(false);
    want.radius = Math.min(0.9, Math.max(0.03, want.radius * (1 + event.deltaY * 0.0012)));
    flight = null;
  }, { passive: false });
  el.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches;
      pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  }, { passive: true });
  el.addEventListener("touchmove", (event) => {
    if (event.touches.length !== 2 || !pinch) return;
    const [a, b] = event.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    want.radius = Math.min(0.9, Math.max(0.03, want.radius * (pinch / d)));
    pinch = d; flight = null;
  }, { passive: true });
  el.addEventListener("touchend", () => { pinch = null; });
  el.style.cursor = "grab";

  let running = true;
  let last = { w: 0, h: 0 };
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h || (w === last.w && h === last.h)) return;
    last = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (current) {
      const fit = frameObject(current.node);
      want.radius = fit.radius;
      want.target.copy(fit.target);
    }
  }

  let prev = performance.now();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    resize();
    const now = performance.now();
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    if (flight) {
      const t = Math.min(1, (now - flight.start) / flight.duration);
      const k = easeInOut(t);
      view.radius = flight.from.radius + (flight.to.radius - flight.from.radius) * k;
      view.phi = flight.from.phi + (flight.to.phi - flight.from.phi) * k;
      view.theta = flight.from.theta + (flight.to.theta - flight.from.theta) * k;
      view.target.lerpVectors(flight.from.target, flight.to.target, k);
      if (t >= 1) flight = null;
    } else {
      view.radius += (want.radius - view.radius) * 0.14;
      view.phi += (want.phi - view.phi) * 0.18;
      view.theta += (want.theta - view.theta) * 0.18;
      view.target.lerp(want.target, 0.14);
    }
    if (spin) turntable.rotation.y += dt * 0.16;
    if (current && current.enter) {
      const t = Math.min(1, (now - current.enter) / 420);
      current.node.scale.setScalar(0.9 + 0.1 * easeInOut(t));
      if (t >= 1) current.enter = 0;
    }
    applyCamera();
    renderer.render(scene, camera);
  }

  resize();
  applyCamera();
  requestAnimationFrame(frame);

  return {
    show,
    resetView() { Object.assign(want, { phi: 1.16, theta: 0.6 }); setSpin(!REDUCED); if (current) applyFrame(current.node); },
    get spinning() { return spin; },
    toggleSpin() { return setSpin(!spin); },
    resize,
    stats() {
      let tris = 0, meshes = 0;
      if (current) current.node.traverse((n) => {
        if (!n.isMesh) return;
        meshes += 1;
        const idx = n.geometry.index;
        tris += idx ? idx.count / 3 : n.geometry.attributes.position.count / 3;
      });
      return { meshes, triangles: Math.round(tris) };
    },
    dispose() {
      running = false;
      cache.forEach((entry) => entry.node.traverse((n) => {
        if (n.isMesh) { n.geometry?.dispose?.(); const m = Array.isArray(n.material) ? n.material : [n.material]; m.forEach((x) => x?.dispose?.()); }
      }));
      cache.clear();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
