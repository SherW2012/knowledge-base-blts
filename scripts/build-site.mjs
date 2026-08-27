import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const outRoot = path.join(root, "dist");
const contentRoot = path.join(outRoot, "content");
const rawRoot = path.join(contentRoot, "_raw");
const config = JSON.parse(await readFile(path.join(siteRoot, "site-config.json"), "utf8"));
const excluded = new Set([".git", ".github", ".claude", "dist", "node_modules", "scripts", "site"]);
const documentExtensions = new Set([".md", ".html", ".htm", ".txt", ".pdf", ".csv", ".json", ".yaml", ".yml"]);
const textDocumentExtensions = new Set([".html", ".htm", ".txt", ".csv", ".json", ".yaml", ".yml"]);
const copiedAssetPattern = /\.(md|svg|png|jpe?g|webp|gif|json)$/i;

const natural = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const cleanName = (name) => name.replace(/\.(md|html?|txt|pdf|csv|json|ya?ml)$/i, "").replace(/^\d{2}-/, "");
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
    .filter((entry) => !entry.name.startsWith(".") && entry.name !== "_nav.json" && !excluded.has(entry.name));
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

function fileKind(extension) {
  if (extension === ".md") return "markdown";
  if (extension === ".html" || extension === ".htm") return "html";
  if (extension === ".pdf") return "pdf";
  return "text";
}

async function buildNode(absolute, relative) {
  const info = await stat(absolute);
  if (info.isFile()) {
    const extension = path.extname(absolute).toLowerCase();
    if (!documentExtensions.has(extension)) return null;

    if (extension === ".md") {
      const markdown = await readFile(absolute, "utf8");
      const pageHeadings = headings(markdown);
      const title = pageHeadings.find((item) => item.level === 1)?.text || cleanName(path.basename(relative));
      return {
        type: "document",
        kind: "markdown",
        name: cleanName(path.basename(relative)),
        title,
        path: slash(relative),
        words: summarize(markdown).replace(/\s/g, "").length,
        excerpt: summarize(markdown).slice(0, 150),
        headings: pageHeadings.map((item) => item.text)
      };
    }

    let source = "";
    if (textDocumentExtensions.has(extension)) {
      source = await readFile(absolute, "utf8");
    }
    const kind = fileKind(extension);
    const label = kind === "html" ? "HTML" : kind === "pdf" ? "PDF" : extension.slice(1).toUpperCase();
    return {
      type: "document",
      kind,
      name: path.basename(relative),
      title: path.basename(relative),
      path: slash(relative),
      words: source.replace(/\s/g, "").length,
      excerpt: source ? source.replace(/\s+/g, " ").slice(0, 150) : `${label} 文件`,
      headings: []
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

function rawRelativeLink(relative) {
  const normalized = slash(relative);
  const depth = Math.max(0, normalized.split("/").length - 1);
  return `${"../".repeat(depth)}_raw/${normalized}`;
}

function wrapperFor(relative, source = "") {
  const extension = path.extname(relative).toLowerCase();
  const name = path.basename(relative);
  const rawLink = rawRelativeLink(relative);
  const label = extension === ".html" || extension === ".htm" ? "HTML" : extension === ".pdf" ? "PDF" : extension.slice(1).toUpperCase();
  const intro = extension === ".html" || extension === ".htm"
    ? "这是一个 HTML 文件。可以直接打开原页面预览，也可以在下面查看源码。"
    : extension === ".pdf"
      ? "这是一个 PDF 文件。点击下面的链接直接在浏览器中打开。"
      : `这是一个 ${label} 文件。知识库会保留原文件，并在这里提供内容预览。`;
  const sourceBlock = source
    ? `\n\n## 文件内容\n\n\`\`\`${extension.slice(1) || "text"}\n${source.replace(/```/g, "``\\`")}\n\`\`\``
    : "";
  return `# ${name}\n\n${intro}\n\n[打开原文件 →](${rawLink})${sourceBlock}\n`;
}

async function copyRawContent(source, relative = "") {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || excluded.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const next = path.join(relative, entry.name);
    const to = path.join(rawRoot, next);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyRawContent(from, next);
    } else {
      await mkdir(path.dirname(to), { recursive: true });
      await cp(from, to);
    }
  }
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
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension === ".md" || copiedAssetPattern.test(entry.name)) {
      await mkdir(path.dirname(to), { recursive: true });
      await cp(from, to);
      continue;
    }

    if (documentExtensions.has(extension)) {
      const sourceText = textDocumentExtensions.has(extension) ? await readFile(from, "utf8") : "";
      await mkdir(path.dirname(to), { recursive: true });
      await writeFile(to, wrapperFor(next, sourceText), "utf8");
    }
  }
}

await rm(outRoot, { recursive: true, force: true });
await mkdir(contentRoot, { recursive: true });
await mkdir(rawRoot, { recursive: true });
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

await copyRawContent(root);
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
console.log(`Built ${departments.length} departments, ${appTotal} applications and ${total} viewable documents into dist/.`);
