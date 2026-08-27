import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const departments = ["本部", "外交部", "技术部", "前沿部", "商务部", "艺术部"];
const ignored = new Set([".git", ".github", ".claude", "dist", "node_modules", "scripts", "site"]);
const files = [];
const problems = [];
const noHeadingRequired = new Set(["前沿部/X产品部/泊舟风格改写Prompt.md"]);

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else files.push(target);
  }
}

async function exists(target) {
  try { return (await stat(target)).isFile(); } catch { return false; }
}

for (const department of departments) {
  try { await stat(path.join(root, department)); }
  catch { problems.push(`缺少一级目录：${department}/`); }
}

await walk(root);
const markdownFiles = files.filter((file) => file.toLowerCase().endsWith(".md"));

for (const file of markdownFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  const normalizedRelative = relative.split(path.sep).join("/");
  if (!noHeadingRequired.has(normalizedRelative) && !/^\uFEFF?#\s+\S/m.test(source)) {
    problems.push(`${relative}：缺少一级标题`);
  }
  if (/先回答我的问题|不公布答案|不要告诉我选什么/.test(source)) {
    problems.push(`${relative}：包含不应进入产品内容的对话式说明`);
  }
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, "").split(/[?#]/)[0];
    if (!raw || /^(https?:|mailto:|#|data:)/i.test(raw)) continue;
    const decoded = decodeURIComponent(raw);
    const target = path.resolve(path.dirname(file), decoded);
    if (!(await exists(target))) problems.push(`${relative}：相对链接不存在 → ${raw}`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${markdownFiles.length} Markdown documents.`);
}
