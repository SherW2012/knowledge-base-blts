# AI交易员第一步，用 DeepSeek 跑通量化交易

今天我们教大家如何用 DeepSeek 来进行量化交易。

今天需要用到四样东西。第一是 DeepSeek V4 Pro，第二是 Pi Agent，第三是 OKX Agent Skills 和 OKX CLI，第四是 OKX 模拟盘。我们会把行情读取、数据整理、策略代码、回测分析和模拟订单准备，都交给 Pi Agent 来完成。

具体流程是这样。先在本机安装 Pi，给它配置 DeepSeek V4 Pro。接着让 Pi 用 bash 安装 OKX Skills 和 CLI，再让它读取 BTC-USDT 的已收盘 K 线。然后我们用提示词把均线、RSI、ATR、手续费和风险条件讲清楚，让 Pi 保存数据、创建 Python 环境、编写回测脚本并执行。回测结果看完以后，再让它创建 dry-run 脚本，只输出信号和订单计划。最后由 Pi 准备一笔 OKX 模拟盘订单，等我们人工确认以后才允许执行。

从架构上看，这件事分成四个角色。

DeepSeek V4 Pro 负责理解策略要求、解释数据和生成 Python 代码。Pi Agent 负责接收提示词，调用 bash、OKX CLI 和 Python，管理文件并把结果返回给我们。OKX Agent Skills 是写给 Pi 的操作手册，告诉它应该怎样查询行情、检查账户和准备交易。OKX CLI 是实际执行本地请求的工具，凭证留在本机配置里，Pi 只读取命令结果。

这篇教程采用的就是这种真实交互方式。下面代码块里的命令，是让 Pi 去执行的内容，不是让读者在自己的终端里逐条照抄。读者需要做的人工操作只有安装 Pi、启动 Pi、创建 DeepSeek API Key、用 `/login` 配置 DeepSeek V4 Pro、创建 OKX 模拟盘 API Key，以及在本机运行 `okx config init` 填入 OKX 凭证。读取行情和执行 Python 脚本都由 Pi 完成。

## 为什么用数字货币做这个实验

这里选数字货币，有两个很实际的原因。

第一个原因是可以先用 OKX 模拟盘。行情、账户和订单流程都能用虚拟资金验证，策略还没有经过检查以前，不需要碰真实资金。

第二个原因是数字货币市场全天运行。你可以在不同时间查看新 K 线，观察脚本是否能正常处理数据，也能更早发现重复信号、日志中断和停止条件失效的问题。

全天运行同时意味着风险更高。价格不会因为你睡觉就停下来，点差、手续费和滑点会持续影响成交结果。合约还会增加杠杆、资金费率和强平风险，所以本文只使用 BTC-USDT 现货模拟盘，不使用杠杆，也不连接真实账户。

这篇文章不构成投资建议，只用于学习模型调用、数据处理、策略回测和模拟盘操作。任何回测数字都不代表未来收益，任何模拟订单也不能证明策略可以用于真实资金。

## 先准备 Pi 和 DeepSeek V4 Pro

### 安装并启动 Pi

如果电脑已经装好 Node.js 和 npm，在本机终端安装 Pi。

```shell
curl -fsSL https://pi.dev/install.sh | sh
pi
```

Pi 启动以后，先不要让它读取账户，也不要让它执行交易。先在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建一把专门用于这个实验的 API Key。回到 Pi 对话框，输入 `/login`，选择 DeepSeek provider，粘贴 API Key。随后输入 `/model`，选择 `deepseek-v4-pro`。

这里的 DeepSeek API Key 只负责模型调用。它和 OKX API Key 没有关系，也不能查询 OKX 账户。Key 不要出现在文章、截图、聊天记录和代码文件里。如果怀疑泄露，先在 DeepSeek 控制台撤销，再创建新的 Key。

### 让 Pi 安装 OKX Skills 和 CLI

Pi 已经可以工作以后，把下面整段提示词复制到 Pi。这里仍然不需要读者自己运行 Skills 和 CLI 的安装命令。

```markdown
请在当前目录准备一个名为 okx-quant-lab 的实验目录，并完成本项目的本地依赖安装。

请执行以下动作。
1. 检查 node、npm、python3 是否可用，并报告版本。
2. 创建 okx-quant-lab 目录，并在其中创建 data、logs、reports 三个目录。
3. 在 okx-quant-lab 中创建 Python 虚拟环境 .venv，并安装 pandas、numpy、matplotlib。
4. 用 bash 执行 npx skills add okx/agent-skills -g --agent pi。
5. 用 bash 执行 npm install -g @okx_ai/okx-trade-cli。
6. 检查 okx --help 和已安装的 OKX Skills，只确认安装状态。
7. 把安装命令、版本、目录和检查结果写入 logs/setup-check.json。

禁止执行以下动作。
1. 不读取任何 OKX API Key、Secret Key 或 Passphrase。
2. 不创建或修改 OKX 账户配置。
3. 不调用 account、trade、withdraw、transfer 或任何下单相关命令。
4. 不要求我在终端里手动执行命令。

完成后请展示。
1. 当前工作目录。
2. node、npm、python3 和 okx 的版本。
3. .venv、data、logs、reports 是否存在。
4. logs/setup-check.json 是否成功写入。
如果任何安装失败，请停止，不要猜测成功。
```

看到 Pi 报告 `logs/setup-check.json` 已写入，且 Python、OKX CLI 和 Skills 都能被发现以后，在 Pi 里输入 `/reload`。这样 Pi 才会重新读取刚刚安装的 Skills。

## 手动配置 OKX 模拟盘

这一步需要人工完成，因为 OKX 的 Secret Key 和 Passphrase 不应该进入 Pi 对话。

先在 [OKX 模拟盘 API 页面](https://www.okx.com/account/my-api?go-demo-trading=1) 创建一组模拟盘凭证。

只打开读取和交易权限，关闭提币权限，能设置 IP 白名单就设置。最好使用专门的子账号，不要把主要账户的凭证交给这次实验。

如果没有账号的话。可以通过这个链接注册一下：[注册链接](https://www.topzhjdgxcb.com/join/30343076)

创建完成以后，在本机的另一个终端运行下面这条命令。

```plaintext
okx config init
```

按照向导填入 API Key、Secret Key 和 Passphrase，选择 demo profile，并确认使用模拟盘。这个过程发生在本机终端，凭证不会经过 Pi 对话框，也不会写进提示词。

配置时要分清两种 Key。

- DeepSeek API Key 给 Pi 使用，用来调用 DeepSeek V4 Pro。
- OKX 模拟盘 API Key、Secret Key 和 Passphrase 给本地 OKX CLI 使用，用来访问虚拟账户。

如果 `okx config init` 的选项和文章中的描述略有不同，让 Pi 只查看 `okx config --help` 并解释选项，不要把凭证复制给 Pi。配置结束以后，再回到 Pi 做只读检查。

## 第一步，让 Pi 读取行情

现在让 Pi 读取行情。读者不需要自己执行 `okx market`，也不需要自己保存 JSON。把下面的提示词完整发给 Pi。

```markdown
请在当前 okx-quant-lab 目录中完成一次只读行情采集。

请执行以下动作。
1. 只使用 OKX market skill 和 OKX CLI 查询 BTC-USDT 现货行情。
2. 读取最近 300 根 1H K 线，并在需要时读取 ticker 和 orderbook 作为行情检查。
3. 把原始返回值保存到 data/raw-btc-usdt-1h.json，不要覆盖已有文件。若文件已存在，请生成带时间的副本。
4. 按时间升序整理一份供回测使用的数据文件 data/btc-usdt-1h.csv。
5. 检查时间戳重复、缺失值、时间缺口、排序方向和 K 线是否已经收盘。
6. 把查询时间、数据起止时间、样本数、品种、周期、最后一根 K 线状态和异常写入 logs/market-check.json。

禁止执行以下动作。
1. 不读取账户余额和持仓。
2. 不调用 place、cancel、amend、algo、transfer、withdraw 或任何交易写入命令。
3. 不把未收盘 K 线交给回测。
4. 不要求我复制命令，也不要求我手动下载行情。
5. 如果数据缺失、时间不连续或无法确认 BTC-USDT 现货环境，请停止后续动作。

可见验收结果必须包括。
1. 实际使用的市场查询命令和返回状态。
2. data/raw-btc-usdt-1h.json 和 data/btc-usdt-1h.csv 是否存在。
3. 有效样本数、数据起止时间和最后一根 K 线是否已收盘。
4. logs/market-check.json 是否写入。
```

Pi 的回复里应该能看到数据区间和样本数。最后一根 K 线如果还在形成，回测数据必须排除它。这里由 Pi 做行情读取和检查，人工只看它报告的验收结果。

## 第二步，把策略交给 Pi 做回测

第一轮策略不用写得太复杂。我们用 BTC-USDT 现货 1H K 线，加入 MA5、MA20、RSI14 和 ATR14。它们各自负责一件事。

MA5 和 MA20 用来观察短期趋势和中期趋势。MA5 从下方穿过 MA20 时，产生候选买入信号。MA5 从上方跌破 MA20 时，产生退出信号。RSI14 用来过滤过热状态，例如只接受 RSI 在 50 到 70 之间的入场信号。

ATR14 用来估计近期波动。入场价减去两倍 ATR14，可以得到一个待评估的保护价位。单次仓位设置成账户权益的小比例，不使用杠杆。这个比例只是代码里的实验参数，不是资金建议。

把下面的提示词交给 Pi，让它从数据文件、代码生成到回测执行一次完成。

```markdown
请在 okx-quant-lab 中完成一次可复查的本地回测。

请执行以下动作。
1. 读取 data/btc-usdt-1h.csv，并再次检查时间升序、重复时间戳、缺失值、时间缺口和未收盘 K 线。
2. 计算 MA5、MA20、RSI14、ATR14、单根收益率和滚动波动率。
3. MA5 上穿 MA20 且 RSI14 在 50 到 70 之间时，产生候选买入信号。
4. MA5 下穿 MA20 或 RSI14 低于 45 时，产生候选退出信号。
5. 入场后的保护价位使用 entry_price - 2 * ATR14。
6. 把单次仓位上限、手续费率、买卖点差和滑点都写成可调整参数。
7. 用 shift(1) 把信号推迟到下一根 K 线执行。禁止使用当前 K 线收盘后才知道的信息成交当前 K 线。
8. 生成 backtest.py，并先检查代码再执行 Python。
9. 执行回测并把每次运行的参数、数据区间、交易次数、胜率、累计收益、最大回撤、波动率、夏普值和总费用写入 reports/backtest-report.json。
10. 把策略假设、指标解释、结果限制和可能的失真来源写入 reports/backtest-analysis.md。
11. 把完整执行命令和返回状态追加到 logs/backtest.log。

费用参数先使用可修改的示例值。不要把示例费率当成我的真实费率，也不要写收益承诺。

禁止执行以下动作。
1. 只允许读取本地数据和执行 Python 回测。
2. 不调用账户、下单、改单、撤单、提币、转账或任何交易写入工具。
3. 不使用未收盘 K 线。
4. 不省略手续费、点差、滑点和仓位上限。
5. 不把回测结果描述成未来收益预测。
6. 不要求我手动创建目录、编写代码或运行 Python。

可见验收结果必须包括。
1. backtest.py 是否生成，核心信号逻辑和 shift(1) 是否存在。
2. reports/backtest-report.json 和 reports/backtest-analysis.md 是否生成。
3. 实际使用的数据区间、有效样本数、交易次数和总费用。
4. 最大回撤、波动率和夏普值的计算结果。
5. 如果数据太短、交易次数太少或指标无法计算，请明确标记结果不足以判断策略。
```

这里最容易被忽略的是 `shift(1)`。如果模型用当前 K 线的收盘结果决定当前 K 线成交，回测就偷看了未来。已收盘 K 线和下一根 K 线执行这两个条件必须同时满足。

手续费、点差和滑点也不能省略。回测只按收盘价成交，曲线通常会比现实好看。手续费要按照你的账户费率调整，点差可以用买入价和卖出价的差估计，滑点则表示实际成交价偏离信号价格的成本。

## 第三步，让 Pi 创建 dry-run

回测报告能解释过去的数据以后，先不要直接准备订单。先让 Pi 创建一个 dry-run 脚本。它只根据最新的已收盘 K 线计算信号，打印计划中的方向、数量、价格和停止原因，不调用任何写入接口。

```markdown
请在 okx-quant-lab 中创建 dry_run.py，并执行一次 dry-run。

请执行以下动作。
1. 通过 OKX market skill 和 OKX CLI 读取最新 BTC-USDT 现货 1H K 线。
2. 只使用已经收盘的 K 线，重新计算 MA5、MA20、RSI14 和 ATR14。
3. 读取 backtest.py 中的手续费、点差、滑点和仓位上限参数。
4. 输出当前信号、触发原因、计划方向、计划数量、参考价格、估算手续费、预计滑点、数据时间和 profile 状态。
5. 把每次结果追加到 logs/dry-run.jsonl，并把当前结果写入 reports/dry-run-latest.json。
6. 如果出现过期行情、K 线缺口、指标为空、仓位超限、profile 不是 demo 或连续三次调用失败，输出 STOP 并停止。
7. 检查最近的 backtest.log 和 market-check.json，指出数据或参数不一致的地方。

禁止执行以下动作。
1. 禁止调用 spot place、cancel、amend、algo、transfer、withdraw 或其他写操作。
2. 禁止创建真实订单。
3. 禁止把信号直接转换成交易动作。
4. 不要求我手动运行脚本或查看原始日志。

可见验收结果必须包括。
1. dry_run.py 是否生成并成功运行。
2. 当前使用的最后收盘时间和 profile 状态。
3. 当前信号、触发原因、计划数量、费用和滑点估算。
4. reports/dry-run-latest.json 和 logs/dry-run.jsonl 是否写入。
5. 是否触发 STOP 条件。
```

dry-run 至少要观察几次新 K 线。你要看的是信号是否只在新 K 线收盘后变化，同一个信号是否被重复输出，日志里的 profile 是否一直是 demo。这一步的目标是检查执行过程，不是追求交易次数。

## 第四步，让 Pi 准备模拟订单

当回测逻辑、dry-run 输出和 demo profile 都检查过以后，再让 Pi 准备一笔小额现货模拟订单。准备和执行要分开，Pi 先展示订单参数，等人工确认。

```markdown
请在 okx-quant-lab 中准备一笔 BTC-USDT 现货模拟订单，但暂时不要执行。

请执行以下动作。
1. 重新确认当前 OKX profile 是 demo，交易模式是 Demo Trading。
2. 读取最新已收盘 K 线，并运行 dry_run.py。
3. 检查当前信号是否仍然有效，检查最小下单量、数量精度、价格精度和账户可用余额。
4. 生成 reports/order-preview.json，写入 instId、side、ordType、sz、估算金额、参考价格、手续费、滑点、保护价位和停止条件。
5. 把准备过程写入 logs/order-preview.log。
6. 在对话中展示订单参数、数据时间、profile、风险检查和所有停止条件。

禁止执行以下动作。
1. 在我明确回复“确认执行模拟订单”之前，不得调用任何下单、改单、撤单或算法订单工具。
2. 如果 profile、权限、余额、最小数量、精度、行情时间或信号有一项无法确认，停止准备并输出 STOP。
3. 不允许使用真实账户，不允许切换到 live profile。
4. 不允许把 API Key、Secret Key 或 Passphrase 写入报告和日志。
5. 不要求我手动拼接订单命令。

可见验收结果必须包括。
1. reports/order-preview.json 是否生成。
2. 当前 profile 是否为 demo。
3. 订单方向、类型、数量、参考价格、估算金额、费用和保护价位。
4. 最小下单量、价格精度和数量精度检查结果。
5. 是否等待人工确认。
```

如果参数没有问题，你只需要在 Pi 对话框里明确回复一句“确认执行模拟订单”。Pi 才可以调用 OKX CLI 的模拟盘写入操作。执行以后，再让它查询订单状态，把订单 ID、请求时间、成交结果、费用、错误信息和账户余额写入 `logs/order-result.json`。如果你不确认，Pi 必须停在预览状态。

## 让 Pi 保持在安全边界内

运行这种实验前，先把停止条件写进提示词和脚本。下面这些情况都应该停止。

- profile 不是 demo
- 行情超过允许的延迟
- K 线出现缺口或最后一根没有收盘
- 指标计算为空
- 下单数量不符合最小数量或精度
- 余额和本地记录不一致
- 连续三次调用失败
- 同一个信号重复准备订单
- 日志无法写入
- dry-run 和回测参数不一致

终端关闭、日志缺失、账户状态无法确认时，任务也要停下来。恢复以前，重新查 profile，重新查余额，重新读取行情，再跑一次 dry-run。模型说可以继续，不足以替代这些检查。

## 最后

这套流程真正值得学习的地方，是你可以清楚看到一条策略怎样经过数据读取、指标计算、回测、dry-run 和人工确认，最后才到模拟订单。每一步都有文件、日志和可见结果，出问题时知道该回到哪一步检查。

它不会自动制造收益，也不会替你承担数字资产的波动风险。先把模拟盘流程跑通，再决定是否继续研究策略。真实资金、杠杆和自动化常驻运行，都应该留在更严格的测试之后。
