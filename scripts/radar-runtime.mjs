import process from "node:process";

// GitHub Search API has a very small anonymous rate limit. In Actions, use the
// repository-scoped GITHUB_TOKEN automatically supplied by the workflow.
//
// The radar core currently speaks OpenAI Chat Completions. DragonCode's Codex
// configuration exposes an OpenAI-compatible Responses API instead, so this
// runtime layer adapts the request/response without coupling radar.mjs to one
// relay provider.
const nativeFetch = globalThis.fetch;

function enrichRadarMessages(messages = []) {
  return messages.map((message) => {
    if (message.role === "system") {
      return {
        ...message,
        content: `${message.content}\n你输出给普通用户看的情报摘要必须是你基于输入重新分析后的中文解释，不得复制RSS正文、Release Notes、README片段或原始HTML。先判断“这到底是什么东西/哪个公司或项目发生了什么”，再用1到2句话讲清楚。遇到类似“Desktop v0.0.17”这种只有版本号的Release标题，必须结合来源名称和描述指出真正的项目及核心变化，不得把版本名误写成一个新项目。任何HTML标签、转义后的HTML标签、Markdown残片、列表符号都不能出现在summary里。`
      };
    }
    if (message.role === "user" && String(message.content).includes("summary")) {
      return {
        ...message,
        content: `${message.content}\n额外要求：summary不是原文摘要，而是分析员写给用户的“这是什么”简介。控制在45-100个中文字符左右，优先包含主体名称、产品/项目类型、这次发生的关键变化以及它解决什么问题；不要用“值得关注”“发生了什么”这类空话开头，不要逐字复述title，不要输出任何HTML或Markdown标签。`
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

async function logDragonModels() {
  const base = String(process.env.LLM_BASE_URL || "").replace(/\/$/, "");
  const key = process.env.LLM_API_KEY;
  if (!base.toLowerCase().includes("dragoncode.codes") || !key) return;
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  for (const endpoint of [`${base}/models`, `${base}/v1/models`]) {
    try {
      const response = await nativeFetch(endpoint, { headers });
      if (!response.ok) continue;
      const body = await response.json();
      const ids = (Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [])
        .map((item) => typeof item === "string" ? item : item?.id || item?.name)
        .filter(Boolean)
        .slice(0, 40);
      if (ids.length) {
        console.log(`[radar] DragonCode available models: ${ids.join(", ")}`);
        return;
      }
    } catch {}
  }
  console.warn("[radar] DragonCode model list endpoint unavailable; using configured model directly");
}

async function dragonResponses(url, init, payload) {
  const base = String(process.env.LLM_BASE_URL || "https://dragoncode.codes").replace(/\/$/, "");
  const requestPayload = {
    model: payload.model,
    input: enrichRadarMessages(payload.messages || []).map(({ role, content }) => ({ role, content })),
    store: false
  };
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json");

  // Codex appends the Responses path directly to model_providers.*.base_url.
  // DragonCode's generated config uses base_url=https://dragoncode.codes, so
  // /responses is the primary endpoint. /v1/responses is kept as a fallback
  // for other OpenAI-compatible relays.
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
    // radar.mjs expects Chat Completions shape; translate the successful
    // Responses payload back into that tiny interface.
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

await logDragonModels();
await import("./radar.mjs");
console.log("[radar] application runtime data stored in radar-data; knowledge tree remains clean");
