import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

// Application runtime output belongs to radar-data, never to a department's
// knowledge tree. The engine may create temporary readable reports first; this
// wrapper moves them into the machine-data layer before the workflow commits.
await import("./radar.mjs");

const legacyRoot = path.join(root, "前沿部", "AI情报雷达");
const reportRoot = path.join(root, "radar-data", "reports");

for (const [legacyName, targetName] of [["日报", "daily"], ["周报", "weekly"]]) {
  const sourceDir = path.join(legacyRoot, legacyName);
  const targetDir = path.join(reportRoot, targetName);
  await mkdir(targetDir, { recursive: true });
  let entries = [];
  try { entries = await readdir(sourceDir, { withFileTypes: true }); } catch {}
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
    await rename(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}

await rm(legacyRoot, { recursive: true, force: true });
console.log("[radar] application runtime reports stored in radar-data/reports; knowledge tree remains clean");
