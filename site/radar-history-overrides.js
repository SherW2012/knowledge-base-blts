(() => {
  const originalFetch = window.fetch.bind(window);

  const summaryRules = [
    ["awesome-gpt-image-2", "awesome-gpt-image-2 是一个面向 GPT-Image2 的提示词工程库，把 530 多个案例整理成 20 多套模板和可复用 Skills，方便直接用于商业图片和内容生产。"],
    ["awesome-llm-apps", "awesome-llm-apps 是一个开源 AI 应用案例库，集中收录 100 多个 AI Agent、Agent Skills 和 RAG 应用，适合直接参考现成架构和实现方式。"],
    ["GitHub Copilot app Customize tab", "GitHub Copilot 正式上线 Customize 标签页，把 MCP Server、插件、Skills 和 Canvas 收到同一个入口里，开始把 AI Coding 的扩展能力统一管理。"],
    ["Desktop v0.0.17", "Cline Desktop v0.0.17 把 Plugins、MCP、Skills、Rules、Hooks 和 Tools 合并进统一的 Customize Hub，并加入分类标签和已安装数量展示。"],
    ["Andrew Ng gets into AI Engineering", "Andrew Ng 正在把 DeepLearning.AI 的重点进一步转向 AI Engineering，说明行业关注点正在从单纯理解模型，转向真正把模型做成可运行的软件和工作流。"],
    ["andrej-karpathy-skills", "andrej-karpathy-skills 用一份 CLAUDE.md 把 Andrej Karpathy 对 AI 编程常见问题的观察整理成 Claude Code 行为规则，用来减少过度复杂、盲目修改等编码问题。"],
    ["CLI v3.0.58", "Cline CLI v3.0.58 主要修复本地运行细节，并把事件日志限制在 64 MiB，避免包含完整会话快照的日志长期累积到几十 GB。"],
    ["SDK v0.0.79", "Cline SDK v0.0.79 给持久化事件日志增加 64 MiB 上限，重点解决完整 Session 快照不断写入后导致 SQLite 日志文件异常膨胀的问题。"],
    ["v0.11.1", "Open WebUI v0.11.1 加入人工审批式工具调用：模型准备调用工具时可以先停下来等用户确认，让本地或私有 Agent 的执行过程更可控。"],
    ["5 ways to upgrade your home decor", "Google 把搜索、视觉发现和购物能力组合到家居装修场景里，用户可以用 Search 找装修灵感、挑家具并辅助 DIY 项目。"],
    ["session-indexer", "session-indexer 是一个 Claude Code 历史会话检索工具，会给过去的编码 Session 建索引，让用户能用语义搜索重新找到之前讨论过的代码、问题和结论。"],
    ["Students prefer Gemini over ChatGPT", "一项针对大学论文的盲测显示，参与学生更偏好 Gemini 生成的文章而不是 ChatGPT 和 Claude；这更适合作为不同模型写作风格差异的观察信号。"],
    ["v1.16.1 - Bug Fixes and Security Enhancements", "Dify v1.16.1 在修复 Bug 和安全问题之外，还给 Workflow 工具节点加入多选输入，方便一个参数直接配置多个预设值。"],
    ["Release v0.59.0-nightly", "Gemini CLI 发布新的 nightly 开发版本，继续合入预览版之后的最新改动。这类版本更适合跟踪功能演进，不代表稳定版已经正式更新。"],
    ["Qwen-Fixed-Chat-Templates", "Qwen-Fixed-Chat-Templates 是社区整理的 Qwen 对话模板修正版，目标是修正聊天格式和模板兼容问题，目前进入 Hugging Face 热门模型榜。"],
    ["Qwen/Qwen3.8-27B", "Qwen3.8-27B 是 Qwen 系列的 27B 级图文理解模型，进入 Hugging Face 热门榜，页面累计下载量已接近 300 万，说明实际试用规模较大。"],
    ["How to evaluate LLMs before production", "GitHub 这篇文章讨论如何在上线前评估 LLM：不能只看干净 Benchmark，还要用真实业务里的边界情况、失败案例和生产数据来验证模型。"],
    ["Ornith-1.5-35B-A3B", "Ornith-1.5-35B-A3B 是一个开源文本生成模型，进入 Hugging Face 热门榜并积累了数万次下载，可作为新一批开放模型的观察对象。"]
  ];

  function applyChineseSummaries(data) {
    if (!data || data.date !== "2026-08-26" || !Array.isArray(data.items)) return data;
    data.items = data.items.map((item) => {
      const title = String(item?.title || "");
      const matched = summaryRules.find(([needle]) => title.includes(needle));
      return matched ? { ...item, summary: matched[1] } : item;
    });
    return data;
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input?.url || "";
    if (!String(url).includes("radar-data/archive/2026-08-26.json")) return response;
    try {
      const data = applyChineseSummaries(await response.clone().json());
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    } catch {
      return response;
    }
  };
})();
