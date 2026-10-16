# 维护与发布

本项目没有前端打包依赖。静态网站源码位于 `dist/`，内容和示例通过 ES Modules 直接加载；`dist/demos/` 是从数据源生成的下载材料，不是第二份源码。

## 文件关系

```text
dist/
  index.html                 静态入口
  app.js / styles.css        页面、路由、搜索和本地记录
  demo-view.js               实战代码阅读器
  demo-styles.css            实战代码样式
  data/
    curriculum.js            基础与场景文章
    middleware.js            中间件文章
    ai-infra.js              AI 与工程能力文章
    demos-*.js               独立项目源码及运行说明
    demos.js                 项目汇总与场景映射
    demo-validation.js       实际编译和运行检查记录
  demos/                     生成的项目、README、许可证和 ZIP（Git 忽略）
scripts/                     导出、内容检查、验证和维护工具
docs/compatibility.md        自动生成的版本及验证表
docs/images/                README 使用的本地截图
.github/                     自动检查、部署、发布和协作模板
.cache/
  demo-builds/               Maven 验证目录（Git 忽略）
  site/                      白名单生成的站点发布目录（Git 忽略）
artifacts/                  本地验证日志（Git 忽略）
```

## 常用命令

| 命令 | 用途 | 环境 |
| --- | --- | --- |
| `npm start` | 自动构建后预览 `dist/` | Node.js 22+ |
| `npm run preview:site` | 预览 `.cache/site/`，需先执行 build | Node.js 22+ |
| `npm run export:demos` | 从清单生成项目、README、许可证和 ZIP | Node.js 22+ |
| `npm run build` | 导出下载文件、更新兼容表并生成 `.cache/site/` | 同上 |
| `npm run stage:site` | 从白名单生成 `.cache/site/`（需先有下载包） | Node.js 22+ |
| `npm run check` | 构建后检查内容、文件与下载一致性 | Node.js 22+ |
| `npm run verify:demos` | 独立编译 Maven 项目 | JDK 17+、Maven 3.6.3+、依赖下载网络 |
| `npm run verify:runtime` | 执行脚本指定的离线 fixture | JDK、Maven、依赖下载网络 |
| `npm run check:security` | 扫描 Git 已跟踪文件及全历史疑似密钥 | Node.js、Git |

无需执行 `npm install`，ZIP 使用 Node.js 内置能力生成，无需外部压缩工具。下载项目 README 中另有 PowerShell 环境变量说明。自定义 Maven 可使用 `MAVEN_CMD`，指定设置文件可使用 `MAVEN_SETTINGS`；脚本默认尊重 Maven 的现有仓库/镜像配置，不强制改用某个服务。切换 JDK 用当前终端的 `JAVA_HOME`，不要把个人机器路径写进仓库。

## 内容与源码更新

1. 修改 `dist/data/` 中的文章或示例数据，保证相关 ID、文件引用与官方来源完整。
2. 修改 Java 或依赖后执行 `npm run verify:demos -- --only=redis,postgres` 等受影响范围；需要时运行全部项目。
3. 改动离线 fixture 对应逻辑后执行 `npm run verify:runtime`；外部服务联调单独记录版本、前提与结果，不冒用离线结果。
4. 执行 `npm run build`、`npm run check`、`npm run check:security`，并查看浏览器中受影响的文章、代码和下载。
5. 提交数据源、必要验证记录及生成的兼容表；不提交 `dist/demos/`、缓存或本地日志。

编译在 `.cache/demo-builds/` 中进行，不在公开下载目录中构建。导出器只打包声明的源码和固定的生成文件；不要改为递归压缩已运行过的工作目录。

## 验证记录

`demo-validation.js` 保留旧字段以兼容页面，并分别记录：

- `compilation`：通过状态、源码哈希、时间、实际 Java/Maven/系统环境，以及可用的提交与 CI 运行地址。
- `runtimeCheck`：已执行 fixture、运行摘要、对应源码哈希与时间。

重新编译不能覆盖已有运行检查，运行检查也不能抹掉编译证据。源码变化时，应按哈希将旧证据标为不适用，再对实际改动重新验证。没有运行证据时应显示未联调，不能仅因代码编译成功就标记服务兼容。

自动工作流中的验证结果与仓库内持久记录各有用途：工作流用于检查当前提交，持久记录用于读者查看已执行的范围。发布前应将实际执行后更新的记录提交，或检查发布工作流输出中包含的新记录。

## GitHub Pages

本项目在线地址：[https://felixfuzhou.github.io/java-agent-handbook/](https://felixfuzhou.github.io/java-agent-handbook/)。读者可直接访问，无需运行本地预览服务。

仓库设为公开并推送后：

1. 在 Settings → Pages 将 Source 选为 GitHub Actions。
2. 到 Actions 查看 Pages 工作流；如未自动触发，可手动运行默认分支。
3. 成功后使用部署结果给出的地址，将其填写到仓库 About → Website。
4. 确认首页、Hash 路由、代码文件切换与 ZIP 下载正常。

工作流执行构建后发布 `.cache/site/`，所以 Pages 有下载包；Git 克隆中默认不保存 ZIP。手动部署同样上传 `.cache/site/` 内的全部文件，不直接发布个人工作目录。若工作流因仓库或组织策略被禁用，需要有仓库管理权限的维护者启用。Fork 后可复用部署流程，需将 README、本手册和仓库 About 中的在线地址更新为自己的实际部署地址。

## 发布源码与 ZIP

发布前检查更新记录、许可证、版本表、官方来源和验证边界。发布工作流负责从版本化数据生成 ZIP，附到 GitHub Release；不要手动上传来自个人运行目录的归档。

以 `.github/workflows/` 中的实际触发条件为准创建版本标签或手动触发发布。先查看 Actions 成功结果，再检查 Release 附件可以解压，含完整 POM、入口类、README 和 MIT 许可证。下载包不包含凭据、日志、`target/` 或第三方 JAR。

## 仓库卫生与安全

`.idea/`、`.env`、私钥、缓存、构建目录与日志只保留本地。忽略规则不会清除已被 Git 跟踪的文件，也不会清理历史；发现误提交时，要同时处理索引与适用历史。

启发式密钥扫描可能有漏报和误报。误报应先核实内容确为公开教学占位值，再调整具体匹配规则并附回归样例；不要通过大范围排除源码来让检查通过。真实凭据先撤销或轮换，再处理历史和已发布附件。

安全报告渠道与处理方式见 [SECURITY.md](../SECURITY.md)，贡献者协作要求见 [CONTRIBUTING.md](../CONTRIBUTING.md)。
