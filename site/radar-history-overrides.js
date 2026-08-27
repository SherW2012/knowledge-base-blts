(() => {
  const originalFetch = window.fetch.bind(window);

  const rulesByDate = {
    "2026-08-26": [
      ["awesome-gpt-image-2", "awesome-gpt-image-2 是一个面向 GPT-Image2 的提示词工程库，把 530 多个案例整理成 20 多套模板和可复用 Skills，方便直接用于商业图片和内容生产。"],
      ["awesome-llm-apps", "awesome-llm-apps 是一个开源 AI 应用案例库，集中收录 100 多个 AI Agent、Agent Skills 和 RAG 应用，适合直接参考现成架构和实现方式。"],
      ["GitHub Copilot app Customize tab", "GitHub Copilot 正式上线 Customize 标签页，把 MCP Server、插件、Skills 和 Canvas 收到同一个入口里，开始把 AI Coding 的扩展能力统一管理。"],
      ["Desktop v0.0.17", "Cline Desktop v0.0.17 把 Plugins、MCP、Skills、Rules、Hooks 和 Tools 合并进统一的 Customize Hub，并加入分类标签和已安装数量展示。"],
      ["Andrew Ng gets into AI Engineering", "Andrew Ng 正在把 DeepLearning.AI 的重点进一步转向 AI Engineering，行业关注点也从单纯理解模型，继续向真正把模型做成软件和工作流迁移。"],
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
    ],
    "2026-08-27": [
      ["Lightricks/LTX-2.5", "Lightricks 的 LTX-2.5 图生视频模型登上 Hugging Face 热门榜，可以从单张图片生成动态视频内容，适合广告素材、产品展示和社媒短视频的批量制作。"],
      ["awesome-gpt-image-2", "freestylefly 的 awesome-gpt-image-2 是面向 GPT-Image2 的提示词工程项目，将 530 多个案例整理为 20 多套工业化模板和可复用 Skills，帮助团队更稳定地产出商业图片。"],
      ["v2.1.247", "Claude Code v2.1.247 新增 SendFeedback 工具：会话出问题时，Claude 可以先帮用户生成反馈报告，再由用户审核后提交，减少手工整理错误信息的成本。"],
      ["Lovable CTO: The Future of SaaS", "Lovable CTO 提出一个很明确的判断：SaaS 正从“给人点击的应用”转向“Agent 能直接使用的应用”，软件接口和工作流会越来越围绕 Agent 重构。"],
      ["NVIDIA buys HuggingFace for $13B", "Latent Space 的 AINews 汇总称 NVIDIA 将以约 130 亿美元收购 Hugging Face，并同时讨论 OpenAI 的 Hugging Face 事故复盘；核心信号是模型分发平台正在变成更重要的 AI 基础设施资产。"],
      ["v0.11.1", "Open WebUI v0.11.1 新增工具调用人工审批和模型主动提问能力，用户可以逐次允许或拒绝 Agent 操作，也能在模型继续执行前补充选择或自定义答案。"],
      ["v4.1.16", "Cline v4.1.16 继续修正 SDK 与订阅制模型的使用体验，其中包括不再给按固定订阅收费的模型显示误导性的成本估算，并处理一批运行细节问题。"],
      ["tinyhumansai/openhuman", "OpenHuman 是一个本地优先的个人 AI 系统，会围绕用户生活建立长期记忆，并协调多个 Agent 和工作流完成研究、信息整理和任务执行。"],
      ["v0.33.0", "Ollama v0.33.0 允许开发者把 Claude Desktop 更方便地接到 Ollama 作为第三方网关，同时改进缓存，并修复 Agent 客户端取消长时间预填充时可能卡住的问题。"],
      ["AgriciDaniel/claude-obsidian", "claude-obsidian 把 Claude Code 和 Obsidian 组合成一个自整理知识库助手，能把资料自动归档、关联，并继续保存在用户自己的 Markdown 知识图谱里。"],
      ["v1.17.0", "开源 Agent 平台 Dify v1.17.0 加入 E2B 云沙箱、构建时 Home 快照和工作区级 Skill 管理，重点是在补 Agent 生产环境的隔离、复现和能力复用。"],
      ["Gemini 3.5 Transcribe", "Google 推出 Gemini 3.5 Transcribe 语音转文字模型，会主动清理口头语和自我纠正，让语音输入更接近可以直接使用的成稿，而不是逐字听写。"],
      ["GitHub Copilot app Customize tab", "GitHub Copilot 正式上线 Customize 标签页，把 MCP Server、插件、Skills 和 Canvas 集中到同一个入口里，团队可以更统一地管理 Copilot 的扩展能力。"],
      ["Qwen/Qwen3.8-Flash-Next", "Qwen3.8-Flash-Next 是面向快速响应场景的多模态模型，支持图像和文本输入后生成文本，可用于视觉问答、截图理解、票据提取和商品图分析等工作流。"],
      ["Release v0.57.0", "Gemini CLI v0.57.0 加强评测和工具调用失败总结，并改进容量错误重试、请求取消回滚和云工作站 OAuth 兼容性，重点都在提升 Coding Agent 的稳定性。"],
      ["IBM's new Granite 4.2", "IBM 发布 Granite 4.2 开放权重大模型，提供 3B、8B 和 30B 等规格，主打可以下载后本地部署或自托管，继续押注企业和个人对本地 LLM 的需求。"],
      ["v1.16.1 - Bug Fixes and Security Enhancements", "Dify v1.16.1 主要补 Bug、安全和工作流可维护性，其中 Workflow 工具节点新增多选输入，让工具参数配置更灵活，也更适合复杂自动化流程。"],
      ["How to evaluate LLMs before production", "GitHub 这篇文章讲的是 LLM 上线前怎么做真实评估：Benchmark 只能做初筛，真正决定能不能进生产的是业务边界案例、失败样本和实际运行数据。"]
    ]
  };

  function applyChineseSummaries(data) {
    if (!data || !Array.isArray(data.items)) return data;
    const rules = rulesByDate[data.date];
    if (!rules) return data;
    data.items = data.items.map((item) => {
      const title = String(item?.title || "");
      const matched = rules.find(([needle]) => title.includes(needle));
      return matched ? { ...item, summary: matched[1] } : item;
    });
    return data;
  }

  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = String(typeof input === "string" ? input : input?.url || "");
    const isRadarData = url.includes("radar-data/latest.json") || url.includes("radar-data/archive/2026-08-26.json") || url.includes("radar-data/archive/2026-08-27.json");
    if (!isRadarData) return response;
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
