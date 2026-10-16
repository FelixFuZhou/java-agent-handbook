# 执行沙箱：受限容器、超时与结果回收

以本地 Docker 作为隔离入门后端，Java 控制进程、资源、超时和输出。代码只执行本页的固定演示程序。

## 场景

研究 Agent 把一小份 CSV 交给独立进程汇总，拿到 JSON 结果后继续生成报告。

## 运行前提

- JDK 17+、Maven 3.6.3+；Docker Engine 或 Desktop 已启动，当前用户有 CLI 使用权限。
- 先运行 docker pull python:3.12-slim，示例使用 --pull=never 防止任务中途下载镜像；生产固定镜像 digest。
- 这是单机隔离机制教学。Docker 共享宿主机内核，不足以直接承载敌对多租户代码；实际开放执行应选择专门沙箱服务并增加访问策略。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 管理员预置的 Python 镜像；不能让模型任意修改此配置。
export SANDBOX_IMAGE='python:3.12-slim'
```

## 01 基础接入 · Java 启动并回收容器

读取 stdout 和退出码，并在 finally 回收唯一名称的任务容器。

- ProcessBuilder 参数数组
- stdout 与退出码都是执行结果的一部分

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/ContainerRunner.java](src/main/java/demo/ContainerRunner.java)
- [pom.xml](pom.xml)

运行：

```bash
docker pull python:3.12-slim

mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- exit=0，输出 sandbox ready。

排障：

- Cannot connect to Docker daemon：启动 Docker；镜像不存在：先 pull；当前用户无权限：检查 Docker CLI 的运行身份。

## 02 核心功能 · 隔离限制与硬超时

尝试写只读根目录，再执行一个超时任务，观察失败被限制在容器内。

- 只读根目录、非 root、禁网与资源配额
- 超时后 rm -f，不只关闭 Java 侧进程
- 输出最多保留 64 KiB

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/ContainerRunner.java](src/main/java/demo/ContainerRunner.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 写 /blocked.txt 失败，exit 非 0；休眠任务约 2 秒后抛出超时并被回收。

排障：

- 两次非成功是预期演示；若容器仍存在，运行 docker ps -a 检查对应 demo-sandbox 名称和 daemon 日志。

## 03 场景应用 · CSV 分析工具

通过 stdin 传 CSV，受限 Python 只计算总额，Java 对 JSON schema 和业务结果进行校验。

- 不挂载宿主机目录和 Docker socket
- 不用 shell 拼接业务数据
- 先校验 exitCode，再解析工具输出

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/ContainerRunner.java](src/main/java/demo/ContainerRunner.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 输出 {rows:3,total:650}，并打印“研究 Agent 可引用该汇总结果”。

排障：

- 不解析 stderr/异常信息为成功结果；输入过大时应提前限流、限制字节数，示例仅使用固定小样本。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Docker 执行参数与限制](https://docs.docker.com/engine/containers/run/)
- [Docker 安全边界](https://docs.docker.com/engine/security/)
- [Java Process API](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Process.html)
