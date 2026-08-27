/* Virtual Gear Room 的 3D 场景。ES 模块，由 gear-room.js 按需动态载入。
   设备形体按各机型公布的标称三围参数化生成，1 场景单位 = 1 米。
   gear.modelPath 填了真实 GLB 时优先用 GLB，并自动缩放到同一组三围。 */
import * as THREE from "./vendor/three.module.min.js";

const MM = 0.001;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- 材质 ----------------
   克制的中性色，靠粗糙度和金属度拉开质感，不用高饱和色。 */
const SURFACES = {
  graphite: { color: 0x2b2d30, roughness: 0.56, metalness: 0.24 },
  black: { color: 0x1d1e20, roughness: 0.48, metalness: 0.18 },
  silver: { color: 0xb4b8bd, roughness: 0.34, metalness: 0.82 },
  titanium: { color: 0x74787c, roughness: 0.36, metalness: 0.86 },
  steel: { color: 0x9aa0a6, roughness: 0.26, metalness: 0.9 },
  aluminium: { color: 0xc6c9cd, roughness: 0.32, metalness: 0.78 }
};

function makeMaterials(styleName) {
  const base = SURFACES[styleName] || SURFACES.graphite;
  const mk = (spec) => new THREE.MeshStandardMaterial({ ...spec, emissive: 0x8a8f94, emissiveIntensity: 0 });
  return {
    body: mk(base),
    dark: mk({ color: 0x17181a, roughness: 0.52, metalness: 0.2 }),
    grip: mk({ color: 0x1b1c1e, roughness: 0.92, metalness: 0.02 }),
    metal: mk({ color: 0x8f9498, roughness: 0.28, metalness: 0.92 }),
    screen: mk({ color: 0x0a0b0c, roughness: 0.08, metalness: 0.1 }),
    glass: mk({ color: 0x0d141a, roughness: 0.05, metalness: 0.45 }),
    accent: mk({ color: 0xd4d7da, roughness: 0.4, metalness: 0.5 })
  };
}

/* ---------------- 几何helper ---------------- */

// 圆角板：相机机身、手机、屏幕都是这个形状，倒角让边缘有实体感
function roundedSlab(w, h, d, radius, material, bevel) {
  const r = Math.min(radius, w / 2 - 0.0005, h / 2 - 0.0005);
  const b = Math.min(bevel == null ? Math.min(d * 0.18, 0.0018) : bevel, d / 2 - 0.0002);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d - b * 2, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 12
  });
  geometry.translate(0, 0, -(d - b * 2) / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(rTop, rBottom, height, material, segments = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material);
  mesh.castShadow = true;
  return mesh;
}

// 镜头筒：外圈、内圈、镜片，朝 +Z
function lensBarrel(diameter, length, materials, { ring = true } = {}) {
  const group = new THREE.Group();
  const r = diameter / 2;
  const outer = cylinder(r, r * 1.02, length, materials.dark, 36);
  outer.rotation.x = Math.PI / 2;
  outer.position.z = length / 2;
  group.add(outer);
  if (ring) {
    const trim = cylinder(r * 0.94, r * 0.94, length * 0.16, materials.metal, 36);
    trim.rotation.x = Math.PI / 2;
    trim.position.z = length * 0.9;
    group.add(trim);
  }
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 36), materials.glass);
  glass.position.z = length * 0.995;
  group.add(glass);
  const inner = cylinder(r * 0.82, r * 0.86, length * 0.5, materials.dark, 32);
  inner.rotation.x = Math.PI / 2;
  inner.position.z = length * 0.72;
  group.add(inner);
  return group;
}

function dial(radius, height, materials) {
  const group = new THREE.Group();
  const body = cylinder(radius, radius * 0.96, height, materials.metal, 24);
  group.add(body);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.82, 24), materials.dark);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = height / 2 + 0.0002;
  group.add(cap);
  return group;
}

function hotShoe(width, materials) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, 0.0016, width * 0.72), materials.dark);
  group.add(base);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.0022, width * 0.14), materials.metal);
  rail.position.set(0, 0.0018, width * 0.3);
  group.add(rail);
  const rail2 = rail.clone();
  rail2.position.z = -width * 0.3;
  group.add(rail2);
  return group;
}

function screenPanel(w, h, materials) {
  const group = new THREE.Group();
  const frame = roundedSlab(w, h, 0.0016, Math.min(w, h) * 0.06, materials.dark, 0.0003);
  group.add(frame);
  const glass = roundedSlab(w * 0.94, h * 0.9, 0.0006, Math.min(w, h) * 0.05, materials.screen, 0.0002);
  glass.position.z = 0.0011;
  group.add(glass);
  return group;
}

/* ---------------- 形体 ----------------
   都以「底面贴桌（y=0）、镜头朝 +Z」为统一朝向，方便摆放与聚焦。 */

function buildCompact(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const style = gear.style || {};
  const group = new THREE.Group();

  const body = roundedSlab(W, H, D, Math.min(W, H) * 0.075, materials.body);
  body.position.set(0, H / 2, 0);
  group.add(body);

  const lensD = (style.lens || 32) * MM;
  const barrelL = (style.barrel || 8) * MM;
  const lens = lensBarrel(lensD, barrelL, materials);
  lens.position.set(-W * 0.17, H * 0.54, D / 2);
  group.add(lens);

  // 镜头座：让镜头筒和机身之间有个台阶，不是直接插进去
  const seat = cylinder(lensD * 0.62, lensD * 0.62, 0.0016, materials.dark, 32);
  seat.rotation.x = Math.PI / 2;
  seat.position.set(-W * 0.17, H * 0.54, D / 2 + 0.0008);
  group.add(seat);

  if (style.grip) {
    const grip = roundedSlab(W * 0.13, H * 0.86, D * 0.34, W * 0.03, materials.grip);
    grip.position.set(W * 0.4, H / 2, D / 2 + D * 0.13);
    group.add(grip);
  }

  const shutter = cylinder(W * 0.032, W * 0.032, 0.0022, materials.metal, 20);
  shutter.position.set(W * 0.3, H + 0.0011, -D * 0.1);
  group.add(shutter);

  const modeDial = dial(W * 0.055, 0.0035, materials);
  modeDial.position.set(W * 0.13, H + 0.0017, -D * 0.08);
  group.add(modeDial);

  const flash = new THREE.Mesh(new THREE.BoxGeometry(W * 0.14, H * 0.055, 0.0012), materials.screen);
  flash.position.set(W * 0.24, H * 0.84, D / 2 + 0.0006);
  group.add(flash);

  const screen = screenPanel(W * 0.62, H * 0.66, materials);
  screen.rotation.y = Math.PI;
  screen.position.set(-W * 0.12, H * 0.5, -D / 2 - 0.0009);
  group.add(screen);

  const pad = roundedSlab(W * 0.2, H * 0.5, 0.0012, W * 0.02, materials.dark, 0.0003);
  pad.rotation.y = Math.PI;
  pad.position.set(W * 0.32, H * 0.46, -D / 2 - 0.0008);
  group.add(pad);

  return group;
}

function buildCompactZoom(gear, materials) {
  const group = buildCompact(gear, materials);
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const style = gear.style || {};
  if (style.hotshoe) {
    const shoe = hotShoe(W * 0.15, materials);
    shoe.position.set(-W * 0.02, H + 0.0012, -D * 0.02);
    group.add(shoe);
  }
  // 顶部第二个转盘：G12 的曝光补偿盘
  const extra = dial(W * 0.075, 0.004, materials);
  extra.position.set(-W * 0.3, H + 0.002, -D * 0.06);
  group.add(extra);
  // 侧翻屏的转轴
  const hinge = cylinder(H * 0.02, H * 0.02, H * 0.6, materials.dark, 16);
  hinge.position.set(-W * 0.44, H * 0.5, -D / 2 - 0.001);
  group.add(hinge);
  return group;
}

function buildMirrorless(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const style = gear.style || {};
  const group = new THREE.Group();
  const bodyD = D * 0.42;

  const body = roundedSlab(W, H, bodyD, Math.min(W, H) * 0.07, materials.body);
  body.position.set(0, H / 2, -D / 2 + bodyD / 2);
  group.add(body);

  const grip = roundedSlab(W * 0.24, H * 0.94, D * 0.42, W * 0.055, materials.grip);
  grip.position.set(W * 0.36, H / 2, -D / 2 + bodyD * 0.9);
  group.add(grip);

  const hump = roundedSlab(W * 0.3, H * 0.19, bodyD * 0.82, W * 0.03, materials.body);
  hump.position.set(-W * 0.06, H + H * 0.075, -D / 2 + bodyD / 2);
  group.add(hump);

  if (style.hotshoe) {
    const shoe = hotShoe(W * 0.14, materials);
    shoe.position.set(-W * 0.06, H + H * 0.17, -D / 2 + bodyD / 2);
    group.add(shoe);
  }
  if (style.evf) {
    const eye = roundedSlab(W * 0.16, H * 0.1, 0.004, W * 0.02, materials.dark, 0.001);
    eye.rotation.y = Math.PI;
    eye.position.set(-W * 0.06, H + H * 0.06, -D / 2 - 0.002);
    group.add(eye);
  }

  const lensD = (style.lens || 60) * MM;
  const barrelL = (style.barrel || 44) * MM;
  const mount = cylinder(lensD * 0.58, lensD * 0.58, 0.003, materials.metal, 40);
  mount.rotation.x = Math.PI / 2;
  mount.position.set(-W * 0.06, H * 0.5, -D / 2 + bodyD + 0.0014);
  group.add(mount);
  const lens = lensBarrel(lensD, barrelL, materials);
  lens.position.set(-W * 0.06, H * 0.5, -D / 2 + bodyD + 0.003);
  group.add(lens);
  // 对焦环与变焦环
  for (const t of [0.3, 0.62]) {
    const ring = cylinder(lensD * 0.53, lensD * 0.53, barrelL * 0.16, materials.grip, 40);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-W * 0.06, H * 0.5, -D / 2 + bodyD + 0.003 + barrelL * t);
    group.add(ring);
  }

  const dials = style.dials || 3;
  for (let i = 0; i < dials; i += 1) {
    const d = dial(W * 0.058, 0.0042, materials);
    d.position.set(W * 0.32 - i * W * 0.17, H + 0.002, -D / 2 + bodyD * (0.3 + i * 0.2));
    group.add(d);
  }

  const screen = screenPanel(W * 0.66, H * 0.6, materials);
  screen.rotation.y = Math.PI;
  screen.position.set(0, H * 0.46, -D / 2 - 0.0012);
  group.add(screen);

  return group;
}

function buildPhone(gear, materials) {
  // 手机平放，背面朝上，看得见摄像头模组
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const style = gear.style || {};
  const group = new THREE.Group();

  const body = roundedSlab(W, H, D, W * 0.11, materials.body, D * 0.3);
  body.rotation.x = -Math.PI / 2;
  body.position.set(0, D / 2, 0);
  group.add(body);

  const count = style.cameras || 2;
  const layout = style.cameraLayout || (count >= 3 ? "triangle" : "vertical");
  const islandW = count >= 3 ? W * 0.36 : W * 0.2;
  const islandH = count >= 3 ? W * 0.36 : (layout === "horizontal" ? W * 0.2 : W * 0.32);
  const island = roundedSlab(islandW, islandH, D * 0.55, islandW * 0.28, materials.body, D * 0.12);
  island.rotation.x = -Math.PI / 2;
  island.position.set(-W * 0.26, D + D * 0.26, -H * 0.34);
  group.add(island);

  const spots = count >= 3
    ? [[-0.24, 0.2], [0.22, 0.2], [-0.02, -0.24]]
    : layout === "horizontal" ? [[-0.22, 0], [0.22, 0]] : [[0, 0.22], [0, -0.22]];
  for (const [ox, oz] of spots) {
    const r = (count >= 3 ? W * 0.075 : W * 0.062);
    const housing = cylinder(r, r, D * 0.5, materials.dark, 28);
    housing.position.set(-W * 0.26 + ox * islandW, D + D * 0.62, -H * 0.34 - oz * islandH);
    group.add(housing);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.68, 28), materials.glass);
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(housing.position.x, D + D * 0.88, housing.position.z);
    group.add(glass);
  }
  const flash = cylinder(W * 0.028, W * 0.028, D * 0.4, materials.accent, 18);
  flash.position.set(-W * 0.26 + islandW * 0.3, D + D * 0.56, -H * 0.34 + islandH * 0.28);
  group.add(flash);

  return group;
}

function buildPocketGimbal(gear, materials) {
  const [W, H, D] = gear.dimensions.map((v) => v * MM);
  const group = new THREE.Group();
  const stickH = H * 0.62;

  const body = roundedSlab(W, stickH, D, W * 0.22, materials.body);
  body.position.set(0, stickH / 2, 0);
  group.add(body);

  const screen = screenPanel(W * 0.72, stickH * 0.6, materials);
  screen.position.set(0, stickH * 0.52, D / 2 + 0.0008);
  group.add(screen);

  // 云台：两根轴臂托着相机头
  const armH = H * 0.16;
  for (const side of [-1, 1]) {
    const arm = roundedSlab(W * 0.16, armH, D * 0.34, W * 0.05, materials.dark);
    arm.position.set(side * W * 0.3, stickH + armH / 2, 0);
    group.add(arm);
  }
  const yoke = cylinder(W * 0.1, W * 0.1, W * 0.62, materials.dark, 20);
  yoke.rotation.z = Math.PI / 2;
  yoke.position.set(0, stickH + armH * 0.86, 0);
  group.add(yoke);

  const headW = W * 0.52;
  const head = roundedSlab(headW, H * 0.2, D * 0.62, headW * 0.2, materials.body);
  head.position.set(0, stickH + armH * 0.86, 0);
  group.add(head);

  const lens = lensBarrel(D * 0.42, D * 0.16, materials);
  lens.position.set(0, stickH + armH * 0.86, D * 0.31);
  group.add(lens);

  return group;
}

const BUILDERS = {
  compact: buildCompact,
  "compact-zoom": buildCompactZoom,
  mirrorless: buildMirrorless,
  phone: buildPhone,
  "pocket-gimbal": buildPocketGimbal
};

// 参数未知的设备：给一个明确的「待补」体块，不假装成真设备
function buildPending(materials) {
  const group = new THREE.Group();
  const w = 0.075, h = 0.15, d = 0.009;
  const slab = roundedSlab(w, h, d, w * 0.11, materials.dark, d * 0.3);
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, d / 2, 0);
  slab.material = new THREE.MeshStandardMaterial({
    color: 0x3a3d40, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.5,
    emissive: 0x8a8f94, emissiveIntensity: 0
  });
  group.add(slab);
  return group;
}

export function buildGearObject(gear) {
  const materials = makeMaterials((gear.style && gear.style.body) || "graphite");
  const builder = BUILDERS[gear.form];
  const group = (!gear.dimensions || gear.status === "pending" || !builder)
    ? buildPending(materials)
    : builder(gear, materials);
  group.traverse((node) => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  return group;
}

/* ---------------- 场景 ---------------- */

/* 真实 GLB：按 dimensions 归一化到真实尺寸并重新居中，
   所以模型自带什么单位、原点在哪都不影响摆放。加载失败保留参数化形体。 */
let loaderPromise = null;
function gltfLoader() {
  if (!loaderPromise) {
    loaderPromise = import("./vendor/GLTFLoader.js").then((m) => new m.GLTFLoader());
  }
  return loaderPromise;
}

export async function loadGearModel(gear) {
  if (!gear.modelPath) return null;
  const loader = await gltfLoader();
  const gltf = await loader.loadAsync(gear.modelPath);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (gear.dimensions && size.x > 0 && size.y > 0 && size.z > 0) {
    const want = new THREE.Vector3(...gear.dimensions.map((v) => v * MM));
    // 等比缩放，以三个轴里最保守的比例为准，避免把模型拉变形
    const factor = Math.min(want.x / size.x, want.y / size.y, want.z / size.z);
    if (Number.isFinite(factor) && factor > 0) model.scale.setScalar(factor);
  }
  const scaled = new THREE.Box3().setFromObject(model);
  const center = scaled.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaled.min.y, -center.z);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  return wrap;
}

export function isSupported() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext
      && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch (error) {
    return false;
  }
}

// 摄影棚环境：一块渐变加两条柔光带，够 PBR 反射用，不需要外部 HDR 文件
function studioEnvironment(renderer, dark) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  if (dark) {
    sky.addColorStop(0, "#3c4045"); sky.addColorStop(0.5, "#202326"); sky.addColorStop(1, "#0d0e10");
  } else {
    sky.addColorStop(0, "#e9ecef"); sky.addColorStop(0.5, "#9ba0a6"); sky.addColorStop(1, "#3a3d41");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 256);
  const box = (x, w, alpha) => {
    const g = ctx.createRadialGradient(x, 58, 4, x, 58, w);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w, 0, w * 2, 160);
  };
  box(150, 120, dark ? 0.55 : 0.95);
  box(370, 90, dark ? 0.3 : 0.5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return target.texture;
}

function contactShadow(width, depth) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.5)");
  g.addColorStop(0.55, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.0006;
  return mesh;
}

/* 自动排布：按类别分排，按真实占地宽度依次排开。
   有 gear.position 时以它为准，所以个别设备仍可手工摆位。 */
function layout(items) {
  const rows = [
    items.filter((g) => g.category === "camera"),
    items.filter((g) => g.category !== "camera")
  ].filter((row) => row.length);
  const gap = 0.032;
  const placements = new Map();
  const rowDepth = rows.length > 1 ? 0.19 : 0;
  rows.forEach((row, rowIndex) => {
    const widths = row.map((g) => (g.dimensions ? g.dimensions[0] : 78) * MM);
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (row.length - 1);
    let cursor = -total / 2;
    const z = rows.length > 1 ? (rowIndex === 0 ? -rowDepth / 2 : rowDepth / 2) : 0;
    row.forEach((g, i) => {
      const w = widths[i];
      placements.set(g.id, g.position || [cursor + w / 2, 0, z]);
      cursor += w + gap;
    });
  });
  return placements;
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createGearScene(container, options) {
  const opts = options || {};
  const items = opts.gear || [];
  const dark = !!opts.dark;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = dark ? 1.05 : 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer, dark);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 40);

  const key = new THREE.DirectionalLight(0xffffff, dark ? 1.5 : 2.1);
  key.position.set(0.6, 1.15, 0.75);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.2;
  key.shadow.camera.far = 4;
  key.shadow.camera.left = -0.9; key.shadow.camera.right = 0.9;
  key.shadow.camera.top = 0.9; key.shadow.camera.bottom = -0.9;
  key.shadow.bias = -0.0012;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, dark ? 0.35 : 0.5);
  fill.position.set(-0.9, 0.5, -0.6);
  scene.add(fill);

  // 桌面
  const tableMat = new THREE.MeshStandardMaterial({
    color: dark ? 0x1a1b1d : 0x35383c, roughness: 0.94, metalness: 0.04
  });
  const table = roundedSlab(1.9, 1.05, 0.03, 0.05, tableMat, 0.004);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.015;
  table.castShadow = false;
  table.receiveShadow = true;
  scene.add(table);

  const gearRoot = new THREE.Group();
  scene.add(gearRoot);

  const placements = layout(items);
  const entries = [];
  for (const gear of items) {
    const holder = new THREE.Group();
    const object = buildGearObject(gear);
    holder.add(object);
    const [x, y, z] = placements.get(gear.id) || [0, 0, 0];
    holder.position.set(x, y, z);
    if (gear.rotation) holder.rotation.set(gear.rotation[0], gear.rotation[1], gear.rotation[2]);
    else holder.rotation.y = (gear.category === "phone" ? 0.06 : -0.08);
    holder.userData.gearId = gear.id;

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    holder.add(contactShadow(Math.max(size.x, 0.03) * 1.9, Math.max(size.z, 0.03) * 1.9));

    const materials = [];
    object.traverse((node) => { if (node.isMesh && node.material) materials.push(node.material); });

    gearRoot.add(holder);
    const entry = {
      gear, holder, object, materials,
      focus: new THREE.Vector3(x + center.x, center.y, z + center.z),
      radius: Math.max(size.x, size.y, size.z),
      dim: 1, hover: 0, hoverTarget: 0, pickable: true, shown: true
    };
    entries.push(entry);

    if (gear.modelPath) {
      loadGearModel(gear).then((model) => {
        if (!model) return;
        holder.remove(entry.object);
        entry.object.traverse((node) => { if (node.isMesh) node.geometry?.dispose?.(); });
        holder.add(model);
        entry.object = model;
        entry.materials = [];
        model.traverse((node) => { if (node.isMesh && node.material) entry.materials.push(node.material); });
        const nextBox = new THREE.Box3().setFromObject(model);
        const nextSize = nextBox.getSize(new THREE.Vector3());
        const nextCenter = nextBox.getCenter(new THREE.Vector3());
        entry.focus.set(x + nextCenter.x, nextCenter.y, z + nextCenter.z);
        entry.radius = Math.max(nextSize.x, nextSize.y, nextSize.z);
      }).catch((error) => {
        console.warn(`[gear-room] ${gear.id} 的模型加载失败，继续用参数化形体`, error);
      });
    }
  }

  /* 相机：球坐标 + 阻尼，聚焦时插值到目标机位 */
  let selectedId = null;
  const contentBox = new THREE.Box3().setFromObject(gearRoot);
  const contentSize = contentBox.getSize(new THREE.Vector3());
  const contentCenter = contentBox.getCenter(new THREE.Vector3());
  const home = {
    target: new THREE.Vector3(contentCenter.x, contentSize.y * 0.45, contentCenter.z),
    radius: 1, phi: 0.92, theta: 0.1
  };

  /* 按视口比例把整张桌子收进画面：宽度和高度各算一次，取大的那个 */
  function fitRadius(aspect) {
    const vFov = (camera.fov * Math.PI) / 180;
    const forHeight = (contentSize.y * 2.6) / (2 * Math.tan(vFov / 2));
    const forWidth = (contentSize.x * 1.16) / (2 * Math.tan(vFov / 2) * Math.max(aspect, 0.35));
    const forDepth = (contentSize.z * 1.6) / (2 * Math.tan(vFov / 2));
    return Math.max(forHeight, forWidth, forDepth) + contentSize.z * 0.6;
  }
  const view = { target: home.target.clone(), radius: home.radius, phi: home.phi, theta: home.theta };
  const desired = { target: home.target.clone(), radius: home.radius, phi: home.phi, theta: home.theta };
  let flight = null;

  function applyCamera() {
    const r = view.radius;
    const sinPhi = Math.sin(view.phi);
    camera.position.set(
      view.target.x + r * sinPhi * Math.sin(view.theta),
      view.target.y + r * Math.cos(view.phi),
      view.target.z + r * sinPhi * Math.cos(view.theta)
    );
    camera.lookAt(view.target);
  }

  function flyTo(next, duration) {
    if (REDUCED || duration === 0) {
      Object.assign(desired, next, { target: next.target.clone() });
      view.target.copy(desired.target);
      view.radius = desired.radius; view.phi = desired.phi; view.theta = desired.theta;
      flight = null;
      return;
    }
    flight = {
      from: { target: view.target.clone(), radius: view.radius, phi: view.phi, theta: view.theta },
      to: { target: next.target.clone(), radius: next.radius, phi: next.phi, theta: next.theta },
      start: performance.now(), duration: duration || 900
    };
    Object.assign(desired, { radius: next.radius, phi: next.phi, theta: next.theta });
    desired.target.copy(next.target);
  }

  function focusGear(id) {
    selectedId = id;
    const entry = entries.find((e) => e.gear.id === id);
    if (!entry) { flyTo(home, 900); return; }
    flyTo({
      target: entry.focus.clone(),
      radius: Math.max(entry.radius * 3.1, 0.16),
      phi: 1.06,
      theta: entry.holder.position.x * 0.5 + 0.34
    }, 900);
  }

  /* 交互 */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredId = null;
  let down = null;

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = entries.filter((e) => e.pickable).map((e) => e.object);
    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    let node = hits[0].object;
    while (node && !node.userData.gearId) node = node.parent;
    return node ? entries.find((e) => e.holder === node) || null : null;
  }

  const el = renderer.domElement;
  el.style.touchAction = "none";

  el.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY, t: performance.now(), moved: false, id: event.pointerId };
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener("pointermove", (event) => {
    if (down) {
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
      desired.theta -= dx * 0.006;
      desired.phi = Math.min(1.42, Math.max(0.16, desired.phi - dy * 0.005));
      down.x = event.clientX; down.y = event.clientY;
      flight = null;
      return;
    }
    const entry = pick(event);
    const id = entry ? entry.gear.id : null;
    if (id !== hoveredId) {
      hoveredId = id;
      el.style.cursor = id ? "pointer" : "grab";
      if (opts.onHover) opts.onHover(entry ? entry.gear : null);
    }
  });

  const endPointer = (event) => {
    if (!down) return;
    const quick = performance.now() - down.t < 500;
    if (!down.moved && quick) {
      const entry = pick(event);
      if (opts.onSelect) opts.onSelect(entry ? entry.gear : null);
    }
    try { el.releasePointerCapture(down.id); } catch (error) { /* 指针已释放 */ }
    down = null;
  };
  el.addEventListener("pointerup", endPointer);
  el.addEventListener("pointercancel", () => { down = null; });
  el.addEventListener("pointerleave", () => {
    if (hoveredId && opts.onHover) { hoveredId = null; opts.onHover(null); }
  });

  el.addEventListener("wheel", (event) => {
    event.preventDefault();
    desired.radius = Math.min(1.9, Math.max(0.1, desired.radius * (1 + event.deltaY * 0.0011)));
    flight = null;
  }, { passive: false });

  /* 循环 */
  const projected = new THREE.Vector3();
  let running = true;
  let lastSize = { w: 0, h: 0 };

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h || (w === lastSize.w && h === lastSize.h)) return;
    lastSize = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const fitted = fitRadius(camera.aspect);
    if (Math.abs(fitted - home.radius) > 0.004) {
      home.radius = fitted;
      if (!selectedId) { desired.radius = fitted; if (!flight) view.radius = fitted; }
    }
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    resize();

    if (flight) {
      const t = Math.min(1, (performance.now() - flight.start) / flight.duration);
      const k = easeInOut(t);
      view.target.lerpVectors(flight.from.target, flight.to.target, k);
      view.radius = flight.from.radius + (flight.to.radius - flight.from.radius) * k;
      view.phi = flight.from.phi + (flight.to.phi - flight.from.phi) * k;
      let dTheta = flight.to.theta - flight.from.theta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      view.theta = flight.from.theta + dTheta * k;
      if (t >= 1) flight = null;
    } else {
      view.target.lerp(desired.target, 0.12);
      view.radius += (desired.radius - view.radius) * 0.12;
      view.phi += (desired.phi - view.phi) * 0.16;
      view.theta += (desired.theta - view.theta) * 0.16;
    }
    applyCamera();

    for (const entry of entries) {
      entry.hoverTarget = (entry.gear.id === hoveredId && entry.pickable) ? 1 : 0;
      entry.hover += (entry.hoverTarget - entry.hover) * 0.18;
      // 被筛掉的淡出；聚焦某台时，其余的退到背景，但仍看得见
      const target = !entry.shown ? 0
        : (selectedId && entry.gear.id !== selectedId) ? 0.42 : 1;
      entry.dim += (target - entry.dim) * 0.1;
      const lift = 1 + entry.hover * 0.03;
      entry.object.scale.setScalar(lift);
      for (const material of entry.materials) {
        material.emissiveIntensity = entry.hover * 0.24;
        const opacity = 0.14 + entry.dim * 0.86;
        material.opacity = opacity;
        material.transparent = opacity < 0.995;
        material.depthWrite = opacity > 0.6;
      }
    }

    if (opts.tooltip) {
      const entry = hoveredId && entries.find((e) => e.gear.id === hoveredId);
      if (entry) {
        projected.copy(entry.focus).project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        opts.tooltip.style.transform =
          `translate(-50%, -130%) translate(${(projected.x * 0.5 + 0.5) * rect.width}px, ${(-projected.y * 0.5 + 0.5) * rect.height}px)`;
      }
    }

    renderer.render(scene, camera);
  }

  resize();
  applyCamera();
  requestAnimationFrame(frame);

  return {
    focus: focusGear,
    reset() { selectedId = null; flyTo(home, 900); },
    setVisible(predicate) {
      for (const entry of entries) {
        const on = predicate(entry.gear);
        entry.pickable = on;
        entry.shown = on;
      }
      if (selectedId && !entries.find((e) => e.gear.id === selectedId && e.pickable)) {
        selectedId = null;
        flyTo(home, 700);
      }
    },
    get selected() { return selectedId; },
    resize,
    dispose() {
      running = false;
      renderer.dispose();
      scene.traverse((node) => {
        if (node.isMesh) {
          node.geometry?.dispose?.();
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); });
        }
      });
      renderer.domElement.remove();
    }
  };
}
