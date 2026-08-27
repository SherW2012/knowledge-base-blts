import process from "node:process";

// GitHub Search API has a very small anonymous rate limit. In Actions, use the
// repository-scoped GITHUB_TOKEN automatically supplied by the workflow.
const nativeFetch = globalThis.fetch;

globalThis.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  let nextInit = init;

  if (url.includes("/chat/completions") && typeof init.body === "string") {
    try {
      const payload = JSON.parse(init.body);
      if (Array.isArray(payload.messages)) {
        payload.messages = payload.messages.map((message) => {
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
        nextInit = { ...init, body: JSON.stringify(payload) };
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

await import("./radar.mjs");
console.log("[radar] application runtime data stored in radar-data; knowledge tree remains clean");
