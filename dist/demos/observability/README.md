# OpenTelemetry：真实 Trace、错误与异步上下文

显式创建 SDK、Provider、Exporter 与 Tracer；从本地 Span 日志开始，再将 Agent 流程通过 OTLP HTTP 导出到已有后端。

## 场景

给知识助手的检索、模型和工具三个步骤建 Trace。步骤内容是固定教学实现，不调用真实模型；Span 创建、上下文传播与导出使用真实 OTel SDK。

## 运行前提

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- OpenTelemetry API、SDK、Logging Exporter、OTLP Exporter 均锁定 1.44.0。只引入 API 不会自动得到可查看的链路。
- 接入/核心阶段无需外部服务，LoggingSpanExporter 输出实际 Span；场景阶段要求已有 Collector 或支持 OTLP HTTP 的后端。
- DEMO_OTLP_ENDPOINT 填完整 traces URL，例如 http://localhost:4318/v1/traces；这是 HTTP/protobuf，不是 gRPC 4317。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 场景阶段必填；核心阶段可不设，只看日志。
export DEMO_OTLP_ENDPOINT='http://localhost:4318/v1/traces'
# 可选完整 Authorization 头值；用服务端颁发的凭据，不打印。
export DEMO_OTLP_AUTHORIZATION='Bearer <后端凭据>'
# 场景工具默认模拟异常，让工具 Span 和根 Span 标记 ERROR；false 观察正常路径。
export DEMO_TOOL_FAIL='true'
```

## 01 基础接入 · SDK 与一个真实 Span

构造 SDK/provider/exporter 并结束 Span，关闭前 flush；默认在控制台看到导出日志。

- API 与 SDK 的区别
- Span 必须 end 才完成
- flush 后正常 shutdown

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Telemetry.java](src/main/java/demo/Telemetry.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印有效 traceId 和 connect Span 的日志记录。

排障：

- 看不到 Span：确认不是只初始化 API、Span 已 end、SDK 实例被实际使用；这里不依赖全局自动探针。

## 02 核心功能 · 父子 Span 与异常记录

建立父 Span，再创建成功和失败的子 Span。recordException 记录异常事件，setStatus(ERROR) 标记状态。

- makeCurrent 传递父上下文
- try/finally 确保结束
- 异常记录与错误状态是两个动作

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Telemetry.java](src/main/java/demo/Telemetry.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 同一 traceId 下出现 core-parent、core-success 和 core-failure，失败子 Span 为 ERROR。

排障：

- 子 Span 变成不同 Trace 时查 Scope 是否覆盖实际工作；不在日志中记录密钥和用户原文。

## 03 场景应用 · 检索→模型→异步工具 Trace

配置实际 OTLP HTTP 接收端；检索和模型在当前线程，工具在线程池中用 Context.wrap 传播父上下文。

- 模型/Prompt/片段 ID 使用自定义 app.* 属性
- 线程池不自动继承 OTel 上下文
- 导出成功以 exporter 和后端双方证据判断

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Telemetry.java](src/main/java/demo/Telemetry.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 控制台打印 taskId、traceId；后端应看到 agent.request 的 retrieval、generation、tool 子 Span。默认工具失败是预期演示。

排障：

- HTTP 404 查 /v1/traces 路径；401/403 查凭据；协议错误查是否错用了 gRPC 地址。
- 日志有 Span 但后端没有：查 exporter 报错、Collector pipeline 与采样；flush 超时不等于后端已收到。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。本地 CoreDemo Trace 已运行；OTLP 未联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [OpenTelemetry Java：SDK、Provider 与 Exporter](https://opentelemetry.io/docs/languages/java/sdk/)
- [OpenTelemetry Java：手动埋点与上下文](https://opentelemetry.io/docs/languages/java/instrumentation/)
