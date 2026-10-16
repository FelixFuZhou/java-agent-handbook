# Temporal：Workflow、Activity 与恢复

完整的 Java Worker 与客户端，使用真实 Temporal 服务调度工作流，设置 Activity 超时和有限重试。

## 场景

研究 Agent 先检索资料，再生成报告。检索与生成用明确的固定业务字符串模拟；工作流历史、任务调度和重试由真实 Temporal 服务完成。

## 运行前提

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 temporal-sdk 1.27.0；已有可访问的 Temporal Server，命名空间默认 default。这里不部署服务端。
- 服务端命名空间必须存在，连接使用本地无 TLS 环境；生产按服务端要求增加 TLS 与认证。
- 必须保持 Worker 终端运行，再从另一个终端启动客户端；服务器持久化执行历史，Worker 提供 Java 代码，两者缺一不可。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# Temporal gRPC 服务地址。
export TEMPORAL_TARGET='localhost:7233'
# 服务端已存在的 Namespace。
export TEMPORAL_NAMESPACE='default'
# Worker 与客户端必须使用相同 Task Queue。
export DEMO_TEMPORAL_QUEUE='demo-agent-research'
# 场景固定 Workflow ID；重跑复用已有执行，换 ID 才启动新任务。
export DEMO_WORKFLOW_ID='demo-agent-research-001'
# 检索 Activity 首次 attempt 失败；后续 attempt 返回固定教学证据。
export DEMO_ACTIVITY_FAIL_ONCE='true'
```

## 01 基础接入 · 检查 Temporal 服务

通过 gRPC 获取服务端能力；只证明服务连通，命名空间在启动任务时继续校验。

- gRPC 目标地址
- SDK 客户端主动释放连接

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/TemporalSupport.java](src/main/java/demo/TemporalSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 systemInfo；无法连接时抛出服务错误。

排障：

- 检查 7233 端口而不是 Web UI 端口；此例未配置云服务认证。

## 02 核心功能 · 启动 Worker 并运行工作流

终端 A 运行 worker 保持进程；终端 B 运行 start，观察检索 Activity 第一次失败后由服务端安排重试。

- Workflow 代码不执行普通网络 I/O
- Activity 设置 StartToClose 和 RetryOptions
- Workflow.sleep 由服务端定时器管理

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/TemporalSupport.java](src/main/java/demo/TemporalSupport.java)
- [src/main/java/demo/DemoWorkflow.java](src/main/java/demo/DemoWorkflow.java)
- [src/main/java/demo/DemoActivities.java](src/main/java/demo/DemoActivities.java)
- [src/main/java/demo/DemoWorkflowImpl.java](src/main/java/demo/DemoWorkflowImpl.java)
- [src/main/java/demo/ToyActivities.java](src/main/java/demo/ToyActivities.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo -Dexec.args=worker

mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo -Dexec.args=start
```

预期：

- Worker 输出 READY；第二终端打印最终 report，Worker 可看到 attempt=1 和 attempt=2。

排障：

- 任务一直等待通常是 Task Queue 不匹配或 Worker 未运行；确认两个终端使用同一环境变量。

## 03 场景应用 · 稳定任务 ID 与恢复

保持核心阶段 Worker 运行，客户端用固定 ID 启动或获取已有执行，并等待结果。可在 Activity 等待期间重启 Worker，随后查看同一执行。

- 拒绝重复 Workflow ID
- 执行历史恢复不等于外部业务恰好一次
- 真实工具写操作必须带幂等键

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/TemporalSupport.java](src/main/java/demo/TemporalSupport.java)
- [src/main/java/demo/DemoWorkflowImpl.java](src/main/java/demo/DemoWorkflowImpl.java)
- [src/main/java/demo/ToyActivities.java](src/main/java/demo/ToyActivities.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 首次打印 START；再次运行打印 EXISTING，然后获得同一执行的结果。

排障：

- 客户端等待最多 90 秒；超时不会自动取消服务端工作流，使用同一 ID 查询。
- 示例任务执行上限 2 分钟；不要在 Workflow 内调用 Thread.sleep、读取环境或直接发 HTTP。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Temporal Java：客户端启动工作流](https://docs.temporal.io/develop/java/temporal-client)
- [Temporal Java：Activity 超时与重试](https://docs.temporal.io/develop/java/failure-detection)
- [Temporal Java SDK](https://github.com/temporalio/sdk-java)
