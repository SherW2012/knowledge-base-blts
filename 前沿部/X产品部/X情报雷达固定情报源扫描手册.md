# X 情报雷达固定情报源扫描手册

> **文档级别：X 产品部强制执行文档 / Mandatory Pre-read**
>
> 本文档专门解决一个问题：**每天到底应该去哪里找 X 选题，以及每一个信息源应该怎么扫。**
>
> 以后只要执行“今天 X 情报”“过去一天 X 情报”“补充 X 情报源”“更新 X 雷达”“扫一下今天有什么值得发”等任务，**执行者必须在开始检索前完整阅读本文档，不允许只凭记忆复述渠道名称。**
>
> 本文档与 `X情报雷达与选题来源.md` 配套使用：前者规定“每个源怎么扫”，后者规定“发现信号后怎么验证、筛选、进入选题池”。
>
> **本体系仅服务 X。小红书另建独立信息源与选题体系，不得直接套用。**

---

## 0. 执行前必须先做的事

每次扫描开始前，先完成下面 5 件事：

1. **读取本文档。** 不得跳过。
2. **读取 `X情报雷达与选题来源.md`。** 确认当天仍按最新规则执行。
3. **确定精确北京时间 24 小时窗口。** 默认 `[当前时间 - 24h, 当前时间]`，不是“昨天自然日”。
4. **建立 Source Run 清单。** 本文规定的必扫源，每一个都必须最终标记为 `ok / partial / error / no-signal`，不能扫漏后假装完成。
5. **先扫信号，再写内容。** 在固定渠道还没扫完之前，不允许先凭几篇媒体文章凑出“今日 10 条”。

### 执行结果的最低要求

最终日报中必须能回答：

- 今天到底扫描了哪些源？
- 哪些源成功？
- 哪些源访问受限或失败？
- 每条候选最早是从哪里发现的？
- 最终确认事实的一手源是什么？
- 事件原始时间是否真的落在 24 小时窗口内？
- 为什么这条值得做 X，而不是普通新闻摘抄？

**如果以上问题回答不出来，本轮扫描视为不完整。**

---

# 一、固定扫描顺序

默认扫描顺序不是随机的，按下面顺序执行：

**X 原生信号 → GitHub → Linux DO → V2EX → Hacker News → Reddit → AI HOT → Product Hunt → Hugging Face → Papers / arXiv → 官方一手源回查 → 专业媒体补上下文 → 中文 X 对标账号复核传播角度**

这个顺序背后的原则是：

- 先找**圈内刚冒头的信号**；
- 再找**开发者真实反馈和开源异常**；
- 再用聚合源补漏；
- 最后回到**官方 / 原作者 / 原项目**确认；
- 媒体只负责补商业背景、融资金额、人物关系、公司口径等，不负责代替前面的扫描。

不要求每个源每天都必须产出候选，但要求**每个必扫源都被真实检查过**。

---

# 二、X 原生情报网｜S 级必扫

## 2.1 为什么 X 必须排第一

对于 AI、Agent、AI Coding、独立开发和模型研究，很多信息的最早出现位置不是新闻网站，而是：

- 公司官方账号先发一条短帖；
- 创始人随口公布一个数据；
- 工程师展示尚未正式写进 Changelog 的能力；
- 研究员先贴论文、Demo 或 benchmark；
- 高信号开发者先发现版本变化；
- 用户先开始讨论定价、配额、API、Bug 或隐藏功能。

因此 X 的目标不是“看热搜”，而是**找到原始圈内信号和正在形成的叙事。**

## 2.2 每次必须扫描的 X 账户类型

不要只刷 Home Timeline。按主题分组扫：

### A. 模型公司 / 官方账号

至少覆盖这些公司的官方产品与研究账号：

- OpenAI
- Anthropic
- Google / Google DeepMind / Gemini
- xAI / Grok
- Meta AI
- Microsoft AI
- NVIDIA AI
- Hugging Face
- Mistral
- Cohere
- Perplexity
- 其他当天正在快速增长的新模型公司

重点看：

- 新模型
- 模型能力变化
- API / SDK / Responses / Tool Use 更新
- 定价、额度、上下文、速率限制
- 模型下线或替换
- 新合作 / 新渠道
- 产品灰度能力

### B. AI Coding / Vibe Coding

重点覆盖：

- Cursor
- Claude Code 相关官方与核心成员
- OpenAI Codex
- Windsurf
- Cline
- OpenCode
- Replit
- Vercel / v0
- GitHub Copilot
- Lovable / Bolt 等快速开发产品
- 新出现的 Coding Agent / Harness 项目

重点找：

- Agent loop 变化
- MCP / Skill / Subagent / Memory
- Browser / Computer Use
- Context management
- Coding benchmark 之外的真实体验
- Token / credits / pricing
- 用户从一个工具迁移到另一个工具的原因
- 新工作流与可复用方法

### C. Agent / MCP / Memory / Harness

重点关注：

- Agent 框架作者
- MCP 生态建设者
- Memory / RAG / Context 工程开发者
- Multi-Agent 项目作者
- Computer Use / Browser Agent 开发者
- Agent 基础设施、可观测性、安全、权限、支付方向创业者

重点不是“又一个 Agent Demo”，而是找：

- Agent 开始能完成过去不能完成的闭环
- Agent 从一次性任务变成长期运行
- Agent 开始有支付、身份、权限、记忆、审计、注册表
- 多 Agent 从概念变成产品形态
- Agent Harness 出现工程范式变化

### D. AI 创始人 / 研究员 / 高信号个人账号

优先查看：

- AI 公司创始人、CEO
- 核心研究员
- 核心工程师
- 知名独立开发者
- 长期做 AI 产品实测的人
- 能稳定提前发现新趋势的人

关注的不只是“发了什么”，还要看：

- 连续几条帖是否在强调同一个方向；
- 是否突然开始讨论过去很少谈的主题；
- 是否公布用户量、ARR、Token、调用量、成本等数字；
- 是否在评论区透露产品路线；
- 是否转发一个此前不起眼的新项目。

### E. AI Money / 一人公司 / 商业化

重点人物：

- AI SaaS 创业者
- 独立开发者
- Growth / GTM 从业者
- AI 自动化服务商
- AI 内容产品创业者
- 投资人、孵化器、YC / a16z 等高信号账号

重点找：

- ARR / MRR / 人均收入
- 小团队高人效案例
- 新获客渠道
- AI SaaS 定价变化
- Agent 商业化
- Skill / Template / Workflow 售卖
- 新的 API / 数据 / Distribution 生意

## 2.3 X 每次具体怎么扫

至少执行四种动作：

1. **扫 Lists / 账户时间线**：找最近 24h 原帖。
2. **关键词搜索**：围绕 `agent / MCP / skill / memory / codex / claude code / cursor / launch / shipped / release / open source / pricing / API / benchmark / ARR / revenue` 等主题组合检索。
3. **看高信号帖评论区和引用帖**：很多实测、反驳、补充信息只在回复里。
4. **回看被多个高信号账号同时提到的对象**：如果 3 个互不相关的开发者同时开始讲一个新 Repo / 产品，它就是异常信号。

## 2.4 X 访问受限时怎么办

X 页面可能出现登录墙、403、搜索索引不完整、只能读到摘要等情况。

此时必须：

- 把该源记为 `partial` 或 `error`；
- 不得写成“已完整扫描 X”；
- 可以通过原作者官网、GitHub、产品页、公开镜像、搜索索引找到同一事件；
- 但替代来源只能用于**验证该事件**，不能冒充 X 原生扫描已经成功。

---

# 三、GitHub 雷达｜S 级必扫

GitHub 是 X 产品部最重要的非 X 情报源之一。

## 3.1 每天必须看什么

### A. Releases

重点看过去 24h 的 Release：

- Agent 框架
- Coding Agent
- CLI Agent
- MCP Server / Client
- RAG / Memory
- Browser / Computer Use
- 推理框架
- 本地模型工具
- AI 基础设施

不能只读版本号，要读 Release Notes，寻找：

- 新能力
- 架构变化
- 默认行为变化
- 安全机制
- Tool / MCP / Subagent
- Memory / Cron / Background task
- Provider / Model 支持

### B. Trending / Star 增速

总 Star 不重要，**变化速度更重要**。

重点标记：

- 新 Repo 短时间进入 Trending；
- 1～3 天 Star 快速上升；
- Fork / Contributor 同步上涨；
- 中文圈还没有大量讨论。

如果无法可靠获得“24h 新增 Star”，不要编数字；可以用 Trending、近期讨论量、commit 活跃度作为异常信号。

### C. Commits

不是每个项目都需要逐 commit 读。

优先看：

- 大版本发布前后；
- 官方未发公告但仓库明显新增重要模块；
- README / docs 突然加入新模型、新 provider、新协议；
- pricing / model catalog / context window / feature flag 等配置改变。

### D. Issues

Issues 是发现“官方宣传之外真实问题”的黄金位置。

重点看：

- 短时间大量用户报告同一问题；
- 配额、收费、性能、模型降级；
- API breaking change；
- 安全问题；
- 某功能突然不可用；
- 官方成员确认正在改；
- 用户给出高价值 workaround。

Issue 中的用户结论只能按用户反馈表述；官方 maintainer 回复可以提高可信度。

### E. Discussions / PR

重点找：

- Roadmap；
- 设计决策；
- 新接口讨论；
- 重大 PR；
- 社区围绕一个功能的争论；
- Maintainer 对下一步方向的说明。

## 3.2 GitHub 候选进入雷达的典型条件

满足任一即可进入候选池：

- 新项目突然增长；
- Release 出现范式级能力；
- 一个看似小的改动解决了 Agent 生态的基础问题；
- Issue 暴露官方宣传没提到的真实体验；
- 开源实现首次让某种能力变得可复制；
- 代码或文档显示产品路线正在发生变化。

---

# 四、Linux DO｜A 级必扫

Linux DO 的价值不是权威，而是**中文开发者真实使用现场**。

## 4.1 每天重点找

- 新模型首批体验
- Claude Code / Codex / Cursor / OpenCode 等真实工作流
- API 中转、Provider、额度、限流变化
- MCP / Skill / Agent 新玩法
- 新开源项目
- 模型降智 / 变强的主观反馈
- Prompt / Harness 实践
- 新产品邀请码、灰度功能
- 开发者踩坑和 workaround

## 4.2 怎么判断帖子有没有价值

高价值：

- 有截图、日志、Prompt、代码、可复现过程；
- 多个用户给出相似反馈；
- 发帖人说明模型版本、工具版本、测试任务；
- 评论区出现明显分歧，值得继续实测；
- 帖子提到了一个尚未被中文 X 大量讨论的新东西。

低价值：

- 单纯情绪化“变笨了 / 无敌了”；
- 没版本、没场景、没证据；
- 纯转载；
- 已经传播多天的旧闻。

## 4.3 使用原则

Linux DO 负责发现“真实体验信号”，**不能单独承担重大事实确认**。

例如：

“某用户认为 Qwen 前端能力更强”可以写；

“Qwen 已经全面超过某模型”不能仅凭一个社区帖子下结论。

---

# 五、V2EX｜A 级必扫

V2EX 更适合找：

- 独立开发者产品
- AI 工具真实付费体验
- Coding 工具迁移
- API / 额度 / 定价
- AI 创业与小产品
- 新网站、新插件、新客户端
- 工作流与生产力变化

## 5.1 每次怎么扫

重点检查最近主题，并围绕：

`AI / ChatGPT / Claude / Gemini / Cursor / Codex / Agent / MCP / OpenAI / API / 独立开发 / SaaS`

寻找最近 24h 新帖。

尤其关注：

- “我做了一个……”
- “用了 X 天之后……”
- “从 A 换到 B……”
- “这个月花了多少钱……”
- “某产品突然改了……”

这些比纯新闻转发更适合形成 X 观点。

---

# 六、Hacker News｜A 级必扫

HN 不是只看首页标题。

## 6.1 每次至少扫

- Top / Front Page
- New
- Show HN
- Launch HN
- 高热 AI 帖的评论区

## 6.2 HN 特别适合发现

- 刚发布的开发者工具
- 开源 Agent
- 新架构、新论文
- 技术圈对某产品的反驳
- 创始人亲自下场解释
- Show HN 小项目突然爆发
- 大模型之外的工程创新

## 6.3 评论区是重要信息源

重点找：

- 原作者回复；
- 竞品开发者补充；
- 用户给出 benchmark / 代码 / 成本数据；
- 有经验工程师指出隐藏问题；
- 同一观点出现大量赞同或强烈反驳。

HN 热度不等于事实正确。发现观点后仍要回原文、GitHub、论文或官方文档。

---

# 七、Reddit｜A 级必扫

重点不是泛刷 Reddit，而是扫 AI 高相关社区。

优先：

- LocalLLaMA
- MachineLearning
- Claude / ChatGPT / OpenAI 等产品社区
- Cursor / AI Coding 等相关社区（如当日有高信号）
- 其他与具体候选工具对应的官方或用户社区

## 7.1 Reddit 最适合找

- 开源模型真实表现
- 本地推理适配
- 量化版本
- GPU / 显存 / 推理速度
- 模型横评
- 新模型翻车点
- 产品配额和使用限制
- 官方宣传之外的真实体验

## 7.2 处理 Reddit 结论

Reddit 是“社区证据”，不是“官方事实”。

必须区分：

- `官方已确认`
- `多个用户一致反馈`
- `单个用户主观体验`
- `未经证实传闻`

最后一种原则上不得进入主雷达，除非明确标成待验证线索而不是事实。

---

# 八、AI HOT｜B 级必扫聚合源

AI HOT 的角色非常明确：**发现，不背书。**

每次扫描重点看：

- 过去一天新增条目
- 小时级更新
- 同一主题是否突然出现多次
- 自己其他渠道漏掉的公司 / 项目 / 人物

看到有价值的条目后：

**AI HOT → 找原链接 → 找官方 / 原作者 → 确认时间 → 再决定是否入选。**

如果 AI HOT 当次无法访问、页面解析失败、无法确认目标站点：

- 明确记 `error`；
- 不允许用 TechCrunch / Google News 等替代，然后声称“AI HOT 已扫”。

---

# 九、Product Hunt｜B 级必扫

Product Hunt 主要承担“新产品雷达”。

## 9.1 每天关注

- Daily leaderboard
- 当日新 launch
- AI / Developer Tools / Productivity 类新品
- 短时间评论和 Upvote 增长明显的产品
- Maker 本人回复

## 9.2 什么值得进一步挖

- 产品把一个复杂 Agent 能力做成普通人能懂的形态；
- 新交互范式；
- 新的 AI 商业模式；
- 极小团队做出增长明显的产品；
- 产品背后有开源 Repo 或独特技术；
- 评论区出现大量真实需求或争议。

Product Hunt 排名本身不是新闻。必须继续看产品官网、团队、Demo、定价和真实能力。

---

# 十、Hugging Face｜A 级必扫

至少关注：

- Trending Models
- 新模型页
- Model Card
- Downloads / Likes 的异常增长
- Spaces
- 新量化 / 新推理适配

## 10.1 重点找什么

- 新模型刚上传就快速获得下载；
- 某模型突然出现大量量化和衍生版本；
- 新 benchmark / evaluation；
- 一个官方模型尚未大规模宣传但生态已经开始适配；
- 模型卡披露重要许可证、训练、上下文、推理要求。

不要只凭模型名称和排行榜判断能力，必要时继续回技术报告 / GitHub / 官方说明。

---

# 十一、Papers with Code / arXiv / 研究论文｜B→S，按事件升级

论文不是每天都要强行选一条，但必须作为研究方向补漏源。

重点找：

- Agent
- Long Context
- Memory
- Tool Use
- Computer Use
- Coding
- Reasoning
- Multimodal
- RAG
- Efficient inference
- 新 benchmark / 新 eval 方法

## 11.1 什么论文值得 X 产品部做

不是“论文很专业”就值得做。

优先选择：

- 结果反常识；
- 能影响产品设计；
- 直接解释最近某个热门现象；
- 有开源代码 / Demo；
- 能转换成开发者马上能用的结论；
- 被多个研究员 / 工程师同时讨论。

如果只有论文摘要、没有理解清楚，不要为了显得前沿强行入选。

---

# 十二、官方一手源回查｜S 级确认层

固定渠道扫描发现候选后，必须尽量回到原始来源。

包括：

- 官方博客
- 官方 X
- 官方 Docs
- 官方 Changelog
- GitHub Release / Repo
- 原作者文章
- 论文
- 产品官网
- 创始人 / 核心成员原帖

## 12.1 高频官方源类别

### 模型公司

OpenAI、Anthropic、Google DeepMind / Gemini、xAI、Meta AI、Mistral、Cohere 等。

### AI Coding / Agent 产品

Cursor、OpenAI Codex、Claude Code、Replit、Vercel、GitHub、Windsurf、Cline、OpenCode 及当天出现的新项目。

### 基础设施

AWS、Microsoft、Google Cloud、Cloudflare、NVIDIA、Stripe、Vercel 等涉及 Agent、AI 推理、支付、身份和云基础设施的官方来源。

## 12.2 一手源确认至少核对

- 原始发布时间
- 功能准确名称
- 是否 GA / Beta / Preview
- 适用用户
- 定价 / 限制
- 是否官方真的这么说
- 媒体标题有没有夸张

---

# 十三、专业媒体｜只做补充，不得代替扫描

可使用 Reuters、TechCrunch、Axios、Bloomberg、The Information、The Verge 等高质量媒体补充：

- 融资
- 收购
- 人事变动
- 商业合作
- 估值
- 公司内部变化
- 监管 / 政府采购
- 官方未披露但有可靠记者信源的信息

### 硬规则

**如果最终候选大多数来自科技媒体，说明雷达已经退化成新闻聚合，本轮扫描应当返工。**

媒体文章可以是：

- `relatedSources`
- 商业背景
- 第二信源

但对于产品发布、模型更新、开源项目，优先把官方 / Repo / 原作者设为主来源。

---

# 十四、中文 X 对标账号｜传播雷达，不是事实源

中文 X 大 V、泊舟等对标账号的职责是告诉我们：

- 中文圈现在开始关心什么；
- 哪个角度更容易传播；
- 哪句话能让人停下来；
- 评论区有什么真实疑问；
- 原帖有哪些没讲透的地方。

正确使用方式：

**看到爆款 → 找英文 / 官方原始信源 → 验证 → 找新增量 → 形成自己的判断。**

不允许：

- 换词搬运；
- 把别人观点写成自己的发现；
- 不查原始来源就跟发；
- 因为对标账号发了，就把旧闻当成今日新情报。

---

# 十五、跨源异常信号：比单一热门更重要

每天扫描过程中，要主动寻找“多个不同源同时出现同一对象”的情况。

例如：

- GitHub Trending 出现一个项目；
- HN 同时有人讨论；
- Linux DO 出现实测；
- X 上两个开发者转发；

这说明信号正在从“小圈层”向外扩散。

这种候选优先级通常高于“某媒体单独报道了一条大公司公关稿”。

### 建议记录 Discovery Chain

例如：

`GitHub Release（发现） → HN（讨论） → 官方 Docs（确认） → X 开发者（传播）`

或者：

`Linux DO（用户反馈） → GitHub Issue（多人复现） → 官方 maintainer 回复（确认）`

这条链本身就能帮助判断可信度和传播阶段。

---

# 十六、每个源的状态必须显式记录

每次日报都维护 sourceRuns。

统一状态：

- `ok`：成功扫描，发现了候选
- `no-signal`：成功扫描，但没有值得入选的候选
- `partial`：只完成部分读取，存在登录墙 / 索引 / 页面限制
- `error`：无法可靠访问或解析

### 禁止行为

- 没扫写 `ok`
- 访问失败却不记录
- A 源失败后用 B 源替代，并继续把 A 写成功
- 为了让数字好看，把 `no-signal` 伪装成发现候选

**“今天这个源没有好东西”是正常结果。雷达不是 KPI。**

---

# 十七、每条候选必须记录的字段

进入候选池时，至少记录：

- `title`
- `discoveredFrom`：最初发现渠道
- `primarySource`：最终确认的一手来源
- `relatedSources`
- `publishedAt`
- `category`
- `summary`
- `whyItMatters`
- `angles`
- `evidenceType`：官方 / Repo / 论文 / 社区实测 / 媒体信源
- `freshnessStatus`：严格 24h / 边界待确认 / 旧闻新进展
- `practicality`
- `importance`
- `novelty`
- `socialPotential`
- `radarScore`

如果事件发布时间不能可靠确认，不能悄悄省略，应明确标成“待确认”。

---

# 十八、每天扫描结束后的强制审计

正式发布雷达前，用下面问题逐项检查：

## 覆盖度

- [ ] X 原生信号是否真实尝试？
- [ ] GitHub 是否看了 Release / Repo 异常，而不只是普通搜索？
- [ ] Linux DO 是否扫了？
- [ ] V2EX 是否扫了？
- [ ] HN 是否看了 New / Show / Launch / 评论？
- [ ] Reddit 是否扫了相关高信号社区？
- [ ] AI HOT 是否扫了，失败是否如实记录？
- [ ] Product Hunt 是否扫了？
- [ ] Hugging Face 是否扫了？
- [ ] 论文 / 研究源是否做了补漏？
- [ ] 候选是否回到官方一手源确认？

## 新鲜度

- [ ] 每条核心事件都落在精确 24h 窗口吗？
- [ ] 有没有把“今天报道的旧闻”当成“今天发生的事”？
- [ ] 有没有只知道日期、不知道时间却强行卡进窗口的边界事件？

## 信源质量

- [ ] 主来源是不是尽量靠近官方 / 原作者？
- [ ] 社区主观体验有没有被误写成客观事实？
- [ ] 有没有未经证实的 X / Reddit 传闻？
- [ ] 是否出现媒体来源占主导的退化？

## X 价值

- [ ] 这条只是新闻，还是有信息差？
- [ ] 有没有明显的“为什么重要”？
- [ ] 有没有观点 / 冲突 / 反常识 / 可实测点？
- [ ] X 上的人为什么会回复或引用？
- [ ] 中文圈是不是已经讲烂了？

## 发布完整性

- [ ] 生成当天 `archive/YYYY-MM-DD.json`
- [ ] 生成当天 `reports/YYYY-MM-DD.md`
- [ ] 更新 `radar-data/latest.json`
- [ ] `latest.json.date` 是当天日期
- [ ] GitHub Actions 构建成功
- [ ] Pages deploy 成功
- [ ] 最后打开线上网页确认显示当天日期和当天内容

**任何关键项未完成，不得对用户声称“雷达已经更新完成”。**

---

# 十九、默认输出逻辑

用户说：

- “9 月 1 日情报源补一下”
- “过去一天的 X 情报”
- “雷达更新下”
- “前沿部今天扫一下”

默认理解为：

> **完整读取本手册 → 建立 24h 窗口 → 逐源扫描 → 如实记录状态 → 发现候选 → 一手核验 → 去重聚类 → X 价值筛选 → 更新 radar-data 三套产物 → 部署 → 线上验收。**

不是：

> 搜十条科技媒体新闻 → 排个星级 → 在聊天中发出来 → 结束。

---

# 二十、这套雷达真正要建立的资产

长期来看，前沿部 X 产品部真正积累的不是“每天 10 条新闻”，而是四类资产：

1. **Source Graph**：哪些人、哪些 Repo、哪些社区最早发现某类趋势。
2. **Signal Pattern**：什么变化通常意味着一件事要开始爆。
3. **Verification Habit**：看到异常后自动回到原始信源确认。
4. **Taste**：知道什么只是行业噪声，什么值得变成自己的 X 内容。

最终目标是：

**别人看到的是新闻，我们更早看到信号；别人复述发生了什么，我们能解释它为什么重要。**
