# RocketMQ：发送确认、消费重试与业务 Key

使用锁定版本的传统 Remoting Java SDK，连接真实 NameServer/Broker，完整演示生产与消费失败重试。

## 场景

文档发布后触发 Agent 索引任务。消息系统实际执行发送与重投；进程内集合只示范同一运行期的去重，不承诺持久幂等。

## 运行前提

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 rocketmq-client 4.9.8，使用兼容的 4.x/5.x Broker Remoting 接口；这里不是 5.x gRPC Proxy 客户端。
- 管理员提前创建 demo-agent-rocketmq Topic（例如 mqadmin updateTopic -n localhost:9876 -c DefaultCluster -t demo-agent-rocketmq，集群名按实际修改）。需允许 demo 生产组/消费组访问；示例是无 ACL 的隔离学习环境。
- NameServer 与 Broker 对外注册地址都必须可达；重试演示最长等待 90 秒，Broker 需允许消费重试。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# NameServer Remoting 地址，不是 gRPC Proxy 地址。
export ROCKETMQ_NAMESRV='localhost:9876'
# 已创建的 demo 前缀 Topic。
export DEMO_ROCKETMQ_TOPIC='demo-agent-rocketmq'
```

## 01 基础接入 · 查询 Topic 路由

启动生产客户端，获取 Topic 可发布队列并关闭资源。

- NameServer 与 Broker 路由
- Topic 需要预先存在

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/RocketSupport.java](src/main/java/demo/RocketSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 输出真实 MessageQueue 列表。

排障：

- No route info：检查 Topic、集群与 NameServer；连接 Broker 超时检查 Broker 对外地址，不能只检查 9876 端口。

## 02 核心功能 · 发送并消费确认

在一个进程里启动消费者，再发送唯一 Key 消息，等待消费回调。

- SEND_OK 才视为生产确认
- 消费成功返回 CONSUME_SUCCESS

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/RocketSupport.java](src/main/java/demo/RocketSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 看到 SEND_OK 与 DONE；正常返回前消费者已处理该运行的事件。

排障：

- 此处每次生成运行 Key；消费者订阅固定 core Tag，历史事件会被读取但忽略。无消费检查组名、订阅和权限。

## 03 场景应用 · 首次失败重试与重复事件

发送两条相同业务 Key 的消息；首次收到分别返回 RECONSUME_LATER，再次收到后处理或跳过进程内重复。

- 重试次数来自 getReconsumeTimes
- setKeys 是追踪标识，不是 Broker 去重
- 真实业务必须持久化幂等结果

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/RocketSupport.java](src/main/java/demo/RocketSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印 RETRY、随后 INDEX、SKIP duplicate；重试通常有等待时间。

排障：

- 90 秒内不完成：查 Broker 重试策略和失败队列；不要改成无限快速重发。
- 进程重启后集合会清空；生产用稳定事件 ID、数据库唯一约束及事务提交。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [RocketMQ 4.x：普通消息发送](https://rocketmq.apache.org/docs/4.x/producer/02message1/)
- [RocketMQ 4.x：Push Consumer 与重试状态](https://rocketmq.apache.org/docs/4.x/consumer/02push/)
