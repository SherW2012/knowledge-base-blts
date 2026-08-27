import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// GitHub Search API has a very small anonymous rate limit. In Actions, use the
// repository-scoped GITHUB_TOKEN automatically supplied by the workflow.
//
// The radar core speaks OpenAI Chat Completions. DragonCode's Codex route uses
// OpenAI Responses, so this runtime layer adapts the transport while keeping
// the radar core provider-agnostic.
const nativeFetch = globalThis.fetch;
let dragonSuccessLogged = false;

function enrichRadarMessages(messages = []) {
  return messages.map((message) => {
    if (message.role === "system") {
      return {
        ...message,
        content: `${message.content}\n你输出给普通用户看的情报摘要必须是你基于输入重新分析后的中文解释，不得复制RSS正文、Release Notes、README片段或原始HTML。先判断“这到底是什么东西/哪个公司或项目发生了什么”，再用1到2句话讲清楚。遇到类似“Desktop v0.0.17”或“v4.1.16”这种只有版本号的Release标题，必须结合source.name和description指出真正的项目及核心变化，不得把版本名误写成一个新项目。任何HTML标签、转义后的HTML标签、Markdown残片、列表符号都不能出现在summary里。`
      };
    }
    if (message.role === "user" && String(message.content).includes("summary")) {
      return {
        ...message,
        content: `${message.content}\n额外硬性要求：summary不是原文摘要，而是分析员写给用户的“这是什么”简介，控制在45-100个中文字符左右，优先包含主体名称、产品/项目类型、这次发生的关键变化以及它解决什么问题；不要用“值得关注”“发生了什么”这类空话开头，不要逐字复述title，不要输出任何HTML或Markdown标签。输入有几条就必须输出几条，所有输入id必须原样且各出现一次，禁止漏项、合并或新增id。`
      };
    }
    return message;
  });
}

function responsesText(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  if (typeof body?.choices?.[0]?.message?.content === "string") return body.choices[0].message.content.trim();
  const parts = [];
  for (const item of body?.output || []) {
    for (const content of item?.content || []) {
      if ((content?.type === "output_text" || content?.type === "text") && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

async function dragonResponses(url, init, payload) {
  const base = String(process.env.LLM_BASE_URL || "https://dragoncode.codes").replace(/\/$/, "");
  const requestPayload = {
    model: payload.model,
    input: payload.messages.map(({ role, content }) => ({ role, content })),
    store: false
  };
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");

  const endpoints = [`${base}/responses`, `${base}/v1/responses`];
  let lastResponse = null;
  for (const endpoint of endpoints) {
    const response = await nativeFetch(endpoint, { ...init, headers, body: JSON.stringify(requestPayload) });
    lastResponse = response;
    if (!response.ok) {
      const detail = (await response.clone().text().catch(() => "")).replace(/\s+/g, " ").slice(0, 240);
      console.warn(`[radar] DragonCode ${endpoint.replace(base, "<base>")} -> HTTP ${response.status}${detail ? ` · ${detail}` : ""}`);
      if ([400, 401, 403, 404, 405].includes(response.status)) continue;
      return response;
    }
    const body = await response.json();
    const text = responsesText(body);
    if (!text) {
      return new Response(JSON.stringify({ error: { message: "Responses API returned no output text" } }), {
        status: 502,
        headers: { "content-type": "application/json" }
      });
    }
    if (!dragonSuccessLogged) {
      console.log(`[radar] DragonCode Responses connected · model=${payload.model}`);
      dragonSuccessLogged = true;
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
  return lastResponse || new Response("Responses endpoint unavailable", { status: 502 });
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  let nextInit = init;

  if (url.includes("/chat/completions") && typeof init.body === "string") {
    try {
      const payload = JSON.parse(init.body);
      if (Array.isArray(payload.messages)) {
        payload.messages = enrichRadarMessages(payload.messages);
        nextInit = { ...init, body: JSON.stringify(payload) };

        const base = String(process.env.LLM_BASE_URL || "").toLowerCase();
        if (base.includes("dragoncode.codes")) return dragonResponses(url, init, payload);
      }
    } catch {}
  }

  if (!url.startsWith("https://api.github.com/") || !process.env.GITHUB_TOKEN) return nativeFetch(input, nextInit);
  const headers = new Headers(nextInit.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  headers.set("x-github-api-version", "2022-11-28");
  headers.set("accept", "application/vnd.github+json");
  return nativeFetch(input, { ...nextInit, headers });
};

async function patchRadarCore() {
  const file = path.join(process.cwd(), "scripts/radar.mjs");
  let source = await readFile(file, "utf8");
  let changed = false;

  const oldFlow = `const deduped = dedupe(recent);\nconst clustered = cluster(deduped);\nconst analyzed = await analyze(clustered);\nconst scored = analyzed.map((x) => ({ ...x, radarScore: score(x) })).sort((a, b) => b.radarScore - a.radarScore);\nconst items = selectBalanced(scored);`;
  const newFlow = `const deduped = dedupe(recent);\nconst clustered = cluster(deduped);\nconst ruleScored = clustered\n  .map((x) => fallback(x))\n  .map((x) => ({ ...x, radarScore: score(x) }))\n  .sort((a, b) => b.radarScore - a.radarScore);\nconst llmCandidateLimit = Math.min(ruleScored.length, Math.max(cfg.topK * 2, 36));\nconst llmCandidates = chooseAnalysisCandidates(ruleScored, llmCandidateLimit);\nconsole.log(\`[radar] LLM candidate pool: \${llmCandidates.length}/\${clustered.length}\`);\nconst analyzed = await analyze(llmCandidates);\nconst scored = analyzed.map((x) => ({ ...x, radarScore: score(x) })).sort((a, b) => b.radarScore - a.radarScore);\nconst items = selectBalanced(scored);`;

  if (source.includes(oldFlow)) {
    source = source.replace(oldFlow, newFlow);
    changed = true;
  }

  if (!source.includes("function chooseAnalysisCandidates(")) {
    const marker = "async function analyze(items) {";
    const helper = `function chooseAnalysisCandidates(sorted, limit) {\n  const chosen = [], ids = new Set();\n  const add = (x) => {\n    if (!x || ids.has(x.id) || chosen.length >= limit) return false;\n    ids.add(x.id); chosen.push(x); return true;\n  };\n  for (const [cat, minimum] of Object.entries(cfg.categoryMinimums || {})) {\n    let n = 0;\n    const target = Math.max(minimum, Math.min(6, minimum * 2));\n    for (const x of sorted) {\n      if (x.category !== cat) continue;\n      if (add(x)) n++;\n      if (n >= target || chosen.length >= limit) break;\n    }\n  }\n  for (const x of sorted) {\n    if (chosen.length >= limit) break;\n    add(x);\n  }\n  return chosen;\n}\n\n`;
    if (source.includes(marker)) {
      source = source.replace(marker, helper + marker);
      changed = true;
    }
  }

  const oldStrip = `function strip(value = "") { return decode(String(value).replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim()); }`;
  const newStrip = `function strip(value = "") {\n  let text = String(value).replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1");\n  for (let i = 0; i < 3; i++) { const next = decode(text); if (next === text) break; text = next; }\n  return text.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();\n}`;
  if (source.includes(oldStrip)) {
    source = source.replace(oldStrip, newStrip);
    changed = true;
  }

  const oldFallbackSummary = `summary: item.description ? item.description.slice(0, 260) : \`${'${item.source.name}'} 出现了一个值得进一步确认的新信号。\`,`;
  const newFallbackSummary = `summary: fallbackSummary(item),`;
  if (source.includes(oldFallbackSummary)) {
    source = source.replace(oldFallbackSummary, newFallbackSummary);
    changed = true;
  }

  if (!source.includes("function fallbackSummary(item)")) {
    const marker = "function fallback(item) {";
    const helper = `function fallbackSummary(item) {\n  const desc = strip(item.description || "").slice(0, 220);\n  const releaseProject = String(item.source?.name || "").replace(/\\s+Releases$/i, "");\n  if (releaseProject && /^v?\\d+(?:\\.\\d+){1,3}/i.test(String(item.title || ""))) {\n    return \`${'${releaseProject}'} 发布 ${'${item.title}'} 更新${'${desc ? `：${desc}` : "。"}'}\`;\n  }\n  if (desc) return \`${'${item.title}'}：${'${desc}'}\`.slice(0, 260);\n  return \`${'${item.source.name}'} 出现了一个值得进一步确认的新信号。\`;\n}\n`;
    if (source.includes(marker)) {
      source = source.replace(marker, helper + marker);
      changed = true;
    }
  }

  const oldBatch = `for (let i = 0; i < items.length; i += 8) {\n    const chunk = items.slice(i, i + 8);`;
  const newBatch = `for (let i = 0; i < items.length; i += 5) {\n    const chunk = items.slice(i, i + 5);`;
  if (source.includes(oldBatch)) {
    source = source.replace(oldBatch, newBatch);
    changed = true;
  }

  const oldResult = `      const result = await llm(chunk);\n      for (const x of result) {`;
  const newResult = `      let result = await llm(chunk);\n      const returnedIds = new Set(result.map((x) => String(x?.id || "")));\n      const missing = chunk.filter((x) => !returnedIds.has(String(x.id)));\n      if (missing.length) {\n        console.warn(\`[radar] LLM omitted \${missing.length}/\${chunk.length} items; retrying missing ids\`);\n        try { result = result.concat(await llm(missing)); } catch (retryError) { console.warn(\`[radar] LLM missing-item retry failed: \${retryError.message}\`); }\n      }\n      for (const x of result) {`;
  if (source.includes(oldResult)) {
    source = source.replace(oldResult, newResult);
    changed = true;
  }

  const oldTimeout = "const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);";
  const newTimeout = "const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90000);";
  if (source.includes(oldTimeout)) {
    source = source.replace(oldTimeout, newTimeout);
    changed = true;
  }

  if (changed) {
    await writeFile(file, source, "utf8");
    console.log("[radar] hardened LLM pipeline: clean HTML, 5-item batches, missing-item retry, timeout=90s");
  }
}

await patchRadarCore();
await import("./radar.mjs");
console.log("[radar] application runtime data stored in radar-data; knowledge tree remains clean");
