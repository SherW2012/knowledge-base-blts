import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const outRoot = path.join(root, "dist");
const contentRoot = path.join(outRoot, "content");
const config = JSON.parse(await readFile(path.join(siteRoot, "site-config.json"), "utf8"));
const excluded = new Set([".git", ".github", ".claude", "dist", "node_modules", "scripts", "site"]);

const natural = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const cleanName = (name) => name.replace(/\.md$/i, "").replace(/^\d{2}-/, "");
const slash = (value) => value.split(path.sep).join("/");

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}

async function navOrder(directory) {
  const target = path.join(directory, "_nav.json");
  if (!(await exists(target))) return [];
  try {
    const payload = JSON.parse(await readFile(target, "utf8"));
    return Array.isArray(payload.order) ? payload.order : [];
  } catch {
    return [];
  }
}

async function orderedEntries(directory) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => !entry.name.startsWith(".") && !excluded.has(entry.name));
  const order = await navOrder(directory);
  const rank = new Map(order.map((name, index) => [name, index]));
  return entries.sort((a, b) => {
    const ar = rank.has(a.name) ? rank.get(a.name) : Number.MAX_SAFE_INTEGER;
    const br = rank.has(b.name) ? rank.get(b.name) : Number.MAX_SAFE_INTEGER;
    return ar - br || natural.compare(a.name, b.name);
  });
}

function summarize(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headings(markdown) {
  return [...markdown.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].replace(/[`*_]/g, "").trim()
  }));
}

async function buildNode(absolute, relative) {
  const info = await stat(absolute);
  if (info.isFile()) {
    if (!absolute.toLowerCase().endsWith(".md")) return null;
    const markdown = await readFile(absolute, "utf8");
    const pageHeadings = headings(markdown);
    const title = pageHeadings.find((item) => item.level === 1)?.text || cleanName(path.basename(relative));
    return {
      type: "document",
      name: cleanName(path.basename(relative)),
      title,
      path: slash(relative),
      words: summarize(markdown).replace(/\s/g, "").length,
      excerpt: summarize(markdown).slice(0, 150),
      headings: pageHeadings.map((item) => item.text)
    };
  }

  const children = [];
  for (const entry of await orderedEntries(absolute)) {
    const child = await buildNode(path.join(absolute, entry.name), path.join(relative, entry.name));
    if (child) children.push(child);
  }
  if (!children.length) return null;
  return { type: "folder", name: cleanName(path.basename(relative)), path: slash(relative), children };
}

function flattenDocuments(nodes, output = []) {
  for (const node of nodes) {
    if (node.type === "document") output.push(node);
    else flattenDocuments(node.children || [], output);
  }
  return output;
}

function appContentPaths(department) {
  return new Set((department.apps || [])
    .map((app) => app.contentPath)
    .filter(Boolean)
    .map((contentPath) => slash(path.join(department.name, contentPath))));
}

async function copyContent(source, relative = "") {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || excluded.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const next = path.join(relative, entry.name);
    const to = path.join(contentRoot, next);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyContent(from, next);
    } else if (/\.(md|svg|png|jpe?g|webp|gif|json)$/i.test(entry.name)) {
      await mkdir(path.dirname(to), { recursive: true });
      await cp(from, to);
    }
  }
}

await rm(outRoot, { recursive: true, force: true });
await mkdir(contentRoot, { recursive: true });
await cp(siteRoot, outRoot, { recursive: true });
await rm(path.join(outRoot, "site-config.json"), { force: true });

const departments = [];
for (const department of config.departments) {
  const absolute = path.join(root, department.name);
  if (!(await exists(absolute))) continue;
  const tree = await buildNode(absolute, department.name);
  const hiddenAppPaths = appContentPaths(department);
  const children = (tree?.children || []).filter((node) => !hiddenAppPaths.has(node.path));
  const documents = flattenDocuments(children);
  const topics = children.filter((node) => node.type === "folder").map((node) => ({
    name: node.name,
    path: node.path,
    documents: flattenDocuments([node]).length,
    firstDocument: flattenDocuments([node])[0]?.path || null
  }));
  departments.push({ ...department, path: department.name, documents: documents.length, topics, tree: children });
}

await copyContent(root);
await writeFile(path.join(outRoot, "content-index.json"), JSON.stringify({
  title: config.title,
  subtitle: config.subtitle,
  generatedAt: new Date().toISOString(),
  departments
}, null, 2));
await writeFile(path.join(outRoot, ".nojekyll"), "");

const total = departments.reduce((sum, department) => sum + department.documents, 0);
const appTotal = departments.reduce((sum, department) => sum + (department.apps?.length || 0), 0);
console.log(`Built ${departments.length} departments, ${appTotal} applications and ${total} Markdown documents into dist/.`);
