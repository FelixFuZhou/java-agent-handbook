# RabbitMQ：发布确认、手动确认与死信

连接真实 AMQP Broker，声明独立教学拓扑，观察 publisher confirm、consumer ack 和 nack 的不同职责。

## 场景

Agent 把文档解析任务交给 Worker；正常任务确认，损坏输入拒绝并路由到死信队列。业务解析是固定教学逻辑。

## 运行前提

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 com.rabbitmq:amqp-client 5.23.0；准备已有 RabbitMQ AMQP 0-9-1 服务。
- 使用专用学习 vhost 和具有 configure/write/read 权限的账号。默认 guest URI 仅供本机；远程连接应使用专用账号并按部署启用 TLS。
- 示例创建 demo.agent.rabbit 前缀 durable 队列和交换机，不清空现有队列；重复运行的历史任务也可能被读取。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# AMQP URI；不要把真实凭据写入源码或提交 Git。
export RABBITMQ_URI='amqp://guest:guest@localhost:5672/%2f'
# 教学交换机、工作队列和死信对象的独立前缀。
export DEMO_RABBIT_PREFIX='demo.agent.rabbit'
```

## 01 基础接入 · 建立 AMQP 连接

建立 Connection 和 Channel，再主动关闭。

- 连接与 Channel 生命周期
- 应用账号与 vhost 权限

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/RabbitSupport.java](src/main/java/demo/RabbitSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 connected=true 和 channel 编号。

排障：

- ACCESS_REFUSED：核对账号、vhost 和权限；5672 是 AMQP，不是管理页面端口。

## 02 核心功能 · Confirm、Ack 与 Nack

发布正常和坏消息，等待生产确认；手动拉取后分别 ack 与 nack(false)，验证坏消息进入已绑定的 DLQ。

- 发布确认不等于业务完成
- nack requeue=false 依赖已配置 DLX
- 读取 DLQ 后同样需要确认

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/RabbitSupport.java](src/main/java/demo/RabbitSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 出现 CONFIRMED、ACK、NACK to DLQ 和 DEAD；坏消息的死信头包含 x-death。

排障：

- PRECONDITION_FAILED 表示同名队列参数与现有定义不一致，换新的 demo 前缀或由管理员核对；不要删除生产队列。

## 03 场景应用 · 解析 Worker 与背压

真实队列传输两项任务；消费者 prefetch=1，完成后确认，坏文档进入死信。

- 手动 ack 在 toy 工作结束后
- prefetch 控制未确认消息
- 失败不立即反复 requeue

阅读源码：

- [pom.xml](pom.xml)
- [src/main/java/demo/Env.java](src/main/java/demo/Env.java)
- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/RabbitSupport.java](src/main/java/demo/RabbitSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印 INDEX toy、ACK 或 NACK；DLQ 里可以看到坏文档。

排障：

- unacked 很多时查阻塞与漏 ack；ready 增长查消费者与处理速度。
- 示例无持久幂等，连接在业务完成后、ack 前断开仍会重投，生产需用 taskId 持久去重。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [RabbitMQ：Java 客户端 API](https://www.rabbitmq.com/client-libraries/java-api-guide)
- [RabbitMQ：生产确认与消费者确认](https://www.rabbitmq.com/docs/confirms)
- [RabbitMQ：死信交换机](https://www.rabbitmq.com/docs/dlx)
