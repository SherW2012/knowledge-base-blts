# 仓库约定

## 交付流程

默认直接合并到 `main` 并推送，不用开 PR、不用等确认。`main` 收到推送后 GitHub Actions 会自动构建并发布到 GitHub Pages，不合就看不到效果。

先在指定的工作分支上开发和提交，跑通 `npm run check` 之后再快进合并到 `main`。`main` 可能已经有别人的新提交，合并前先 `git fetch origin main`；不能快进时把 `main` 合进工作分支解决冲突，再合回去。

## 内容

- 知识内容是真实目录下的 Markdown，网页只扫描目录生成索引，不要引入数据库式的元数据层。
- 目录保持在「部门 → 主题 → 文档」三层左右，确有必要才加一层。
- 图片视频不进仓库，走 R2 外链；小型 SVG 可以随文档保存。
- `npm run check` 会校验一级目录、Markdown 标题、相对链接，并把站点构建到 `dist/`。`dist/` 不提交。

## 网页

站点是无框架的原生 JS，`site/` 下一个模块一个文件，样式统一写在 `site/styles.css`。

交互组件沿用「Markdown 特殊代码块 + 独立 JS 模块」的做法：在 `app.js` 的 `convertSpecialCodeBlocks` 里登记语言名，模块提供 `mountAll(container, opts)`，由 `renderDiagrams` 挂载。现有的有 `knowledge-map`、`knowledge-graph`、`portrait-gallery`、`poetry`、`poetry-shelf`。

改了 `site/` 下的文件要同步提升 `site/index.html` 里对应的 `?v=` 版本号，否则浏览器会读缓存。

两个踩过的坑：

- `.article p`、`.article code` 这类元素选择器优先级高于单个类名，模块内的对应规则要用 `.模块名 .类名` 提权，否则会被正文样式吃掉。
- Chromium 里给 `<button>` 自身设 `writing-mode` 会把文字压扁，竖排要写在内层普通元素上。竖排还依赖字体的竖排度量表，缺表时每字步进会塌成几像素。
