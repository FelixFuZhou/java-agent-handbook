# Kafka：分区键、手动提交与索引事件

完整 Java 客户端项目：检查集群，观察相同 key 的分区，再演示处理失败不提交 offset。

## 场景

知识文档发布事件驱动索引 Worker。Kafka 真正传输消息，索引器使用进程内 Map 演示版本写入，不代表持久幂等。

## 运行前提

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 kafka-clients 3.9.0；准备可连接的 Kafka Broker，本例使用无认证的本地 PLAINTEXT 环境。
- 账号需要读取集群元数据、创建 demo 前缀 Topic、发送与消费权限；示例创建 3 分区、1 副本的教学 Topic，不用于生产。Broker advertised.listeners 必须能从 Java 进程访问。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# Broker 地址，容器中运行 Java 时改为可访问的服务地址。
export KAFKA_BOOTSTRAP='localhost:9092'
# 只使用 demo 前缀；代码为 core/scenario 创建独立 Topic。
export DEMO_KAFKA_PREFIX='demo-agent-kafka'
# 场景消费组；重启复用此值即可读取已提交位置。
export DEMO_KAFKA_GROUP='demo-agent-kafka-indexer'
# 每个演示进程第一次处理时模拟失败，再 seek 重读；false 关闭。
export DEMO_FAIL_ONCE='true'
```

## 01 基础接入 · 检查集群元数据

读取真实集群 ID 与节点，不发送业务消息。

- Bootstrap 只用于发现集群
- 有限请求超时

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/KafkaSupport.java](src/main/java/demo/KafkaSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 clusterId 和 brokers。

排障：

- 连接 bootstrap 成功但后续超时，检查 advertised.listeners 返回的地址；本例未配置 SASL/TLS。

## 02 核心功能 · 用 key 维持分区内顺序

同一文档 key 发送两个版本，等待生产确认并打印分区和 offset。

- acks=all 与幂等生产
- 相同 key 在分区数不变时进入同一分区

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/KafkaSupport.java](src/main/java/demo/KafkaSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 两条 doc-101 消息 partition 一致，offset 递增；创建已存在的 Topic 会复用。

排障：

- 没有 Topic 创建权限时由管理员按相同名称预建；1 副本只用于本地学习，不能据此推断生产可用性。

## 03 场景应用 · 失败不提交，成功再推进

发送文档事件并使用固定消费组；首次失败后不提交，seek 到原 offset，完成 toy 索引后显式提交 offset+1。

- 关闭自动提交
- 失败必须同时控制当前 position
- Map 只演示版本判断，重启后不保留

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/KafkaSupport.java](src/main/java/demo/KafkaSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 依次出现 RETRY without commit、INDEX、COMMIT nextOffset；第二次进程启动从消费组已提交位置继续。

排障：

- 没有有效提交位置时 earliest 才生效；重跑会再发布一条事件。
- 业务写入成功、offset 提交前崩溃仍会重复；生产用持久操作流水或幂等 upsert。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Kafka 3.9 Consumer：手动 offset 与至少一次](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html)
- [Kafka Producer API](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html)
