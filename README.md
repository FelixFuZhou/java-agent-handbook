# Agent 工程手册

面向 Java 研发的纯静态学习网站，重点是 **架构设计、接入与排障**。采用说明、流程图、配置和 Java/SQL/HTTP 示例学习，没有考试、答题或积分。

网站由 HTML、CSS 和 JavaScript 文件组成，内容随静态文件一起提供。搜索、筛选、组件对比和学习记录均在浏览器完成，无需业务服务端、数据库或模型 API Key。

## 静态部署

直接将 **`dist/` 目录中的全部内容**上传到现有静态网站托管空间即可，无需安装依赖或执行构建。

```text
静态站点根目录/
  index.html
  app.js
  styles.css
  favicon.svg
  data/
    curriculum.js
    middleware.js
    ai-infra.js
```

入口是 `index.html`。网站使用 Hash 路由（例如 `#/lesson/redis`），无需配置服务端路由重写；资源使用相对路径，也可以部署到站点子目录。

## 本地预览

可使用任意静态 HTTP 文件服务。项目附带一个零依赖的预览工具，需要 Node.js 18+，**无需 npm install**：

```bash
npm start
```

打开 http://127.0.0.1:8080。按 Ctrl+C 停止。端口冲突可用 `PORT=8081 npm start`。

这个工具只提供 `dist/` 中的静态文件，不包含业务接口。部署到静态托管平台时，无需上传 `scripts/` 或 `package.json`，也无需 Node.js 运行环境。

这是静态网站，通过 HTTP 提供 ES Modules；不要直接双击 `index.html` 以 `file://` 打开。

## 网站包含什么

- **学习总览与六阶段路线**：33 篇完整文章，逐步连接 Java 后端、模型、检索和任务执行。
- **中间件图鉴**：23 篇，覆盖存储、检索、执行、治理与工程能力。
- **实战代码库**：23 个独立 Maven 项目、69 个分层 Demo。每个组件都有基础接入、核心功能和场景应用，附完整源码、依赖、环境变量、命令、预期输出及排障。
- **四个场景架构**：知识助手、业务操作 Agent、研究 Agent、生产架构；直接展开各步骤对应的中间件核心代码。
- **工程问答**：按关键词和类别查询真实设计、接入与故障排查问题；展开直接阅读解释。
- **组件对比**：并排比较职责、适用需求、关键机制和常见问题。
- **全文搜索**：Ctrl/Cmd + K 搜索文章内容与问答。
- **我的学习**：收藏、已读进度、本地笔记、JSON 导出和合并导入。
- **术语速查**：RAG、Embedding、RRF、MCP、Checkpoint、ACL、Outbox 等工程解释。

每篇包含：概念解释、使用条件、链路位置、接入示例、选型取舍、误区、工程问答和官方来源。

## 如何使用代码示例

1. 在侧栏打开“实战代码库”，或从中间件文章顶部点击“查看三层 Demo”。
2. 先展开“运行前先看”，准备 JDK 17+、Maven 与该组件所需服务，配置环境变量。
3. 下载项目，解压后在项目根目录按“基础接入 → 核心功能 → 场景应用”运行。每阶段都有预期行为和排障方向。
4. 场景页展示组件在业务流程中的接入位置，引用同一份源码。各模块是独立示例，需要在实际项目中装配。

代码和 ZIP 位于 `dist/demos/`。阅读网站本身不需要 Java、Docker、模型 Key 或中间件。Docker 章节的镜像仅用于学习 Worker 部署，与网站部署无关。

“Java 编译通过”表示已验证语法和依赖 API；运行联调的验证范围会在页面单独显示。

## 建议学习顺序

1. 先读 Agent / Workflow / RAG、Java 技术栈、工具调用。
2. 复习关系型数据库、Redis、对象存储的职责边界。
3. 沿文档解析 → Embedding → 检索 → 重排理解完整 RAG 链路。
4. 学习状态恢复、消息队列、幂等和代码执行沙箱。
5. 理解网关、可观测性、配置、部署和效果验证。
6. 选择最接近实际工作的场景，反向查阅组件与排障问题。

“评测”文章讲的是生产系统质量保障，不是给学习者设置考试。

## 本地数据与隐私

网站没有后端账号、分析埋点或模型调用，不收集学习记录。笔记、收藏和进度保存于浏览器 `localStorage`，按协议、域名和端口隔离。

- `localhost:8080` 和 `127.0.0.1:8080` 的记录相互独立，请固定一个访问地址。
- 更新同一站点的静态文件不会直接删除浏览器记录；清理浏览器站点数据会删除记录。
- 更换浏览器或端口前，在“我的学习”导出备份，再在新地址导入。
- 导入合并收藏与已读；同篇笔记以导入文件为准。
- 仅文章中的“官方资料”链接需要联网。

## 内容维护

```text
dist/
  index.html          网站入口
  app.js              路由、页面、搜索和本地记录
  styles.css          响应式样式
  data/
    curriculum.js     6 篇基础 + 4 个场景
    middleware.js     15 篇基础中间件
    ai-infra.js       8 篇 AI 与工程能力
    demos-*.js        示例源码、运行说明与验证记录
    demos.js          Demo 集合与四个场景代码映射
  demo-view.js        Demo 阅读器、代码目录与交互
  demo-styles.css     Demo 页面样式
  demos/              生成的完整源码与 ZIP 下载包
scripts/
  serve.mjs           可选的本地静态预览工具
  check-content.mjs   内容完整性校验
  check-demos.mjs     Demo 覆盖、源码一致性与下载检查
  export-demos.mjs    将内容数据导出为静态源码与 ZIP
  verify-demos.mjs    使用 Maven 编译示例（可选维护检查）
package.json          本地预览与校验命令
```

内容字段包括 `summary`、`when`、`notFor`、`concepts`、`flow`、`sections`、`decisions`、`pitfalls`、`qa`、`sources`、`related`。编辑对应数据文件即可，不需要构建工具。

```bash
npm run check
```

编辑 Demo 数据后，运行 `npm run export:demos` 同步下载文件，再执行 `npm run check`。导出与检查工具需要系统的 `zip` / `unzip` 命令。若改动 Java 源码，在 JDK 17+ 环境运行 `npm run verify:demos`（需要 Maven 和依赖下载网络），再导出一次以更新 README 验证状态。Maven 日志在 `artifacts/demo-checks/`；这只是维护校验，不是学习测验。

课程说明核验于 2026-10-14，实战示例补充于 2026-10-16。示例注明部署前提、依赖或教学简化；本站不会自动启动 PostgreSQL、Milvus、模型或其他中间件。跨版本接入请核对实际服务版本的官方文档。

## 常见启动问题

- 端口已占用：修改 `PORT`，记得浏览器记录按端口隔离。
- 页面只有加载提示：检查是否以 HTTP 打开，及浏览器是否允许 JavaScript。
- 托管后模块加载失败：确认 `data/` 已完整上传，且 `.js` 文件以 JavaScript MIME 类型提供。
