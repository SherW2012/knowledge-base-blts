import process from "node:process";

// GitHub Search API has a very small anonymous rate limit. In Actions, use the
// repository-scoped GITHUB_TOKEN automatically supplied by the workflow.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (!url.startsWith("https://api.github.com/") || !process.env.GITHUB_TOKEN) return nativeFetch(input, init);
  const headers = new Headers(init.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined));
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  headers.set("x-github-api-version", "2022-11-28");
  headers.set("accept", "application/vnd.github+json");
  return nativeFetch(input, { ...init, headers });
};

await import("./radar.mjs");
console.log("[radar] application runtime data stored in radar-data; knowledge tree remains clean");
