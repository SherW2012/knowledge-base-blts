# AI 情报雷达

每天自动扫描官方博客、GitHub Release、研究论文、Hacker News 与高质量解释者，把原始信息压缩成少量值得判断的情报。

<div class="ai-radar" data-ai-radar></div>

## 工作原则

- 原始信息不等于情报，情报也不等于永久知识。
- S 级是一手信源，A 级是高质量解释者，B 级用于捕捉异常信号。
- 自动流程只负责抓取、去重、聚类、评分和生成候选选题。
- “加入选题池”目前保存在浏览器本地，不会自动写入正式知识库。
- 真正需要长期保留的内容，由人工判断后再沉淀到前沿部对应主题。

## 自动化

每日工作流读取 `radar/sources.json`，执行 `npm run radar`。如果配置了大模型环境变量，则调用模型做情报分析；没有配置时使用规则评分，不影响雷达运行。

大模型环境变量：

```text
LLM_API_KEY
LLM_BASE_URL
LLM_MODEL
```

接口采用 OpenAI-compatible `POST /chat/completions` 形式。
