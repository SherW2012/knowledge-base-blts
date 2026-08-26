import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

// The radar engine still writes human-readable reports to its legacy location.
// Run it first, then move those reports into the machine-data layer so department
// knowledge directories never become storage for application runtime output.
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
console.log("[radar] runtime reports moved to radar-data/reports; department knowledge tree kept clean");
