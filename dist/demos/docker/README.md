# 容器工程：Java Worker 的构建、限制与配置

这里的 Docker 用于学习如何运行 Agent Worker。学习网站本身仍是纯静态文件，无需 Docker。

## 场景

把知识入库 Worker 的运行环境固定下来，通过环境变量和只读任务文件传参，观察退出码与日志。

## 运行前提

- JDK 17+、Maven 3.6.3+；Docker Engine 或 Desktop 已启动。
- 项目使用 eclipse-temurin:17-jre，首次构建需可访问镜像仓库；生产应固定经过验证的镜像 digest。
- Worker 只读 JSON 任务文件并演示处理边界，不包含完整 Embedding 或消息消费；对应调用见检索和队列 Demo。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 容器内通过 -e 设置；真实租户身份应来自已经鉴权的任务记录。
export WORKER_TENANT='demo-tenant-a'
# 容器内只读挂载文件路径。
export JOB_FILE='/data/job.json'
```

## 01 基础接入 · 打包并运行 Java 镜像

Maven 编译产物复制进 JRE 镜像，显式指定非 root 用户与默认入口。

- 构建上下文只包含这个 Demo
- 编译 JDK 与运行 JRE 的版本相容

阅读源码：

- [Dockerfile](Dockerfile)
- [.dockerignore](.dockerignore)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile

docker build -t demo-agent-worker:1 .

docker run --rm demo-agent-worker:1
```

预期：

- 打印 runtime=17… 和 worker ready。

排障：

- class file version 不匹配：检查编译 release 与镜像 JRE；镜像拉取失败先处理 registry 网络。

## 02 核心功能 · 资源、环境变量与退出状态

使用同一镜像运行另一入口类；展示容器中能看到的内存上限和配置，不把 JVM 默认值误当宿主机全部内存。

- --memory 限制进程，MaxRAMPercentage 控制堆比例
- -e 注入非机密配置；日志输出到 stdout

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [Dockerfile](Dockerfile)

运行：

```bash
docker run --rm --memory=256m --cpus=1 --read-only --tmpfs=/tmp:rw,size=16m -e WORKER_TENANT=demo-tenant-a --entrypoint java demo-agent-worker:1 -XX:MaxRAMPercentage=60 -cp /app/classes demo.CoreDemo
```

预期：

- 打印 tenant 和 maxHeapMiB；堆应小于 256 MiB，具体值随 JDK 变动。

排障：

- exit 137 可能是 OOM 或 SIGKILL，需结合 docker inspect / daemon 事件判断，不能只看数字。

## 03 场景应用 · 只读任务文件的 Worker

挂载单个小任务文件，用健康的退出码向调度方反馈执行状态；容器失败后的重试/幂等应由任务系统管理。

- 容器内路径和宿主机路径不同
- 只读挂载输入；不把凭据写入镜像
- 真实外部副作用成功后才能 ack 消息

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [data/job.json](data/job.json)
- [Dockerfile](Dockerfile)

运行：

```bash
docker run --rm --memory=256m --cpus=1 --read-only --network=none --cap-drop=ALL --security-opt=no-new-privileges --tmpfs=/tmp:rw,size=16m -e WORKER_TENANT=demo-tenant-a -e JOB_FILE=/data/job.json --mount "type=bind,src=$PWD/data/job.json,dst=/data/job.json,readonly" --entrypoint java demo-agent-worker:1 -cp /app/classes demo.ScenarioDemo
```

预期：

- 打印任务内容、租户与“输入已读取”；此示例不进行真实入库，不能把它当成 ingestion 成功。

排障：

- 在项目根目录执行，确保 data/job.json 可被容器用户读取；Docker Desktop 可能需要允许共享项目目录。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Dockerfile COPY / USER / ENTRYPOINT](https://docs.docker.com/reference/dockerfile/)
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Docker 资源限制](https://docs.docker.com/engine/containers/resource_constraints/)
