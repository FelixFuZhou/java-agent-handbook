# 依赖与验证状态

此表由 `npm run build` 从项目源码和验证记录生成，请勿直接修改。依赖版本是当前示例锁定值，不代表最新版本。Java 编译目标为 17；编译环境与真实服务运行分开记录。

每个项目的服务端版本、模型/地域、权限与运行前提见下方项目说明。完整项目由内容源生成，克隆后运行 `npm run build`，或在在线站点“实战代码库”中下载。

| 项目说明 | 锁定的直接依赖 | 当前源码编译 | 运行验证范围 |
| --- | --- | --- | --- |
| [PostgreSQL：事务、幂等与任务状态](#postgres) | postgresql@42.7.5 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [MySQL：事务、幂等与任务状态](#mysql) | mysql-connector-j@8.4.0 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Redis：租户缓存与 Lua 限流](#redis) | jedis@5.2.0 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [对象存储：上传、校验与私有下载](#object-storage) | s3@2.30.31 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [MongoDB：会话查询、版本与 TTL](#mongodb) | mongodb-driver-sync@5.3.1 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Neo4j：受控图遍历与来源边界](#neo4j) | neo4j-java-driver@5.26.0 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [ClickHouse：批量调用事件与用量分析](#clickhouse) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [pgvector：JDBC 入库、HNSW 与租户 TopK](#pgvector) | jackson-databind@2.18.2；postgresql@42.7.5 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Milvus：REST Collection、Upsert 与过滤搜索](#milvus) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Elasticsearch：BM25、真实向量与 Java RRF](#elasticsearch) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Embedding：真实向量、批处理与知识召回](#embedding) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Reranker：候选重排、TopN 与引用对齐](#reranker) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [文档解析：Tika 提取、分块与可追溯元数据](#document-parsing) | jackson-databind@2.18.2；tika-core@3.2.3；tika-parsers-standard-package@3.2.3 | 通过：JDK 21.0.5 / release 17 | TXT → JSONL 三阶段通过；PDF/OCR 未验证 |
| [Kafka：分区键、手动提交与索引事件](#kafka) | kafka-clients@3.9.0 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [RocketMQ：发送确认、消费重试与业务 Key](#rocketmq) | rocketmq-client@4.9.8 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [RabbitMQ：发布确认、手动确认与死信](#rabbitmq) | amqp-client@5.23.0 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Temporal：Workflow、Activity 与恢复](#temporal) | temporal-sdk@1.27.0 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [Nacos：配置读取、监听与安全生效](#nacos) | nacos-client@2.4.3 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [OpenTelemetry：真实 Trace、错误与异步上下文](#observability) | opentelemetry-api@1.44.0；opentelemetry-sdk@1.44.0；opentelemetry-exporter-logging@1.44.0；opentelemetry-exporter-otlp@1.44.0 | 通过：JDK 21.0.5 / release 17 | 本地接入/核心 Trace 通过；OTLP 未联调 |
| [AI 网关：统一调用、错误分类与降级](#ai-gateway) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [执行沙箱：受限容器、超时与结果回收](#sandbox) | jackson-databind@2.18.2 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |
| [效果评测：检索指标与版本回归](#evaluation) | JDK 标准库 | 通过：JDK 21.0.5 / release 17 | 三阶段已本地运行（固定评测样本） |
| [容器工程：Java Worker 的构建、限制与配置](#docker) | JDK 标准库 | 通过：JDK 21.0.5 / release 17 | 外部服务待按前提联调 |

<a id="postgres"></a>

## PostgreSQL：事务、幂等与任务状态

- JDK 17+、Maven 3.6.3+；在下载目录中运行命令。
- PostgreSQL 16 或 17 服务已可访问；由管理员预先创建 demo_agent 数据库，授予学习账号该库内建表、读写权限。
- 只操作 demo_agent_task 与 demo_outbox；数据库名必须以 demo_ 开头。示例保留记录，不自动删除数据。
- 本例展示事务边界，不实现生产级租约、超时回收或真实消息发布器；RUNNING 进程崩溃恢复需另加租约与幂等执行策略。

<a id="mysql"></a>

## MySQL：事务、幂等与任务状态

- JDK 17+、Maven 3.6.3+；在下载目录中运行命令。
- MySQL 8.4 服务已可访问；由管理员预先创建 demo_agent 数据库，授予学习账号该库内建表、读写权限。
- 只操作 demo_agent_task 与 demo_outbox；数据库名必须以 demo_ 开头。示例保留记录，不自动删除数据。
- 本例展示事务边界，不实现生产级租约、超时回收或真实消息发布器；RUNNING 进程崩溃恢复需另加租约与幂等执行策略。

<a id="redis"></a>

## Redis：租户缓存与 Lua 限流

- JDK 17+、Maven 3.6.3+；锁定 Jedis 5.2.0。
- 已运行 Redis 7.2+；账号需允许 demo_agent:* 键的 GET、SET/SETEX、TTL、DEL、INCR、EXPIRE、EVAL，以及 PING。
- 示例限流是单 key 固定窗口，Redis Lua 原子执行；不等同于滑动窗口或分布式并发信号量。没有使用 FLUSHDB。

<a id="object-storage"></a>

## 对象存储：上传、校验与私有下载

- JDK 17+、Maven 3.6.3+；AWS SDK for Java 2.30.31。
- 准备可访问的 S3 兼容服务（例如已有 Ceph RGW）或 S3，预先创建私有 demo-agent-learning 桶；不使用公开读策略。该项目不创建桶、不启动存储服务。
- 凭据仅需演示桶的 HeadBucket/ListBucket 及 demo_agent/* 的 PutObject、GetObject 权限。下载签名和上传必须使用相同 endpoint 与 region。
- 所有 Object Key 限定 demo_agent/；S3 桶不能含下划线，故桶名前缀使用 demo-。不删除用户对象；演示文本大小仅几十字节。

<a id="mongodb"></a>

## MongoDB：会话查询、版本与 TTL

- JDK 17+、Maven 3.6.3+；MongoDB Java Sync Driver 5.3.1。
- MongoDB 7.0 或 8.0 已可访问；账号拥有 demo_agent 数据库的读写与创建索引权限。示例仅操作 demo_messages 集合。
- TTL 后台清理是异步的，不承诺到点立即删除。此例没有跨文档事务，因此单机 MongoDB 也可学习。

<a id="neo4j"></a>

## Neo4j：受控图遍历与来源边界

- JDK 17+、Maven 3.6.3+；Neo4j Java Driver 5.26.0，建议已有 Neo4j 5.26 LTS 学习实例。
- 账号需在选定数据库创建 demo_Service 节点、demo_DEPENDS_ON 关系和 demo_service_unique 约束，并具备读取权限。只使用这些教学标签、关系和约束。
- 先运行 connect/core 或让 scenario 自动建约束；代码不删除任何现有节点。图的演示租户来自固定可信变量，实际应用必须从登录身份注入。

<a id="clickhouse"></a>

## ClickHouse：批量调用事件与用量分析

- JDK 17+、Maven 3.6.3+；仅依赖 Jackson 2.18.2，HTTP 客户端来自 JDK。
- 准备 ClickHouse 24.8+ 学习实例的 HTTP 端口（通常8123，TLS可为8443）；账号能在 default 库创建、写入和读取 demo_agent_usage。
- 只操作 default.demo_agent_usage。学习账号必须设置密码，项目不使用空密码自动登录；HTTPS 远端服务保持正常证书验证。
- MergeTree 排序键不保证唯一，本例不自动重试未知结果的 INSERT；每次场景使用新 batch_id，并只查询本批数据。真实重复事件需另建去重与对账策略。

<a id="pgvector"></a>

## pgvector：JDBC 入库、HNSW 与租户 TopK

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已有 PostgreSQL 15+，服务器安装 pgvector 0.8.x。PG_USER 对教学数据库有 CREATE EXTENSION、建表和索引权限；正式环境由 DBA 预置扩展。
- 依赖 PostgreSQL JDBC 42.7.5、Jackson 2.18.2。前两阶段不调用云模型；场景阶段需要百炼 Embedding。运行会创建/更新 lesson_chunks_toy 和 lesson_chunks_real 教学表，不自动删除。

<a id="milvus"></a>

## Milvus：REST Collection、Upsert 与过滤搜索

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已有可访问的 Milvus 2.6.x，开放 REST v2；不在本例启动服务。示例在默认数据库创建 lesson_toy_3、lesson_real_1024 集合，持久化保留供观察。
- 前两阶段使用三维教学向量；场景阶段调用百炼真实 Embedding。依赖仅 Jackson 2.18.2，无 Milvus SDK 版本绑定。

<a id="elasticsearch"></a>

## Elasticsearch：BM25、真实向量与 Java RRF

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已有 Elasticsearch 8.15+ 或 9.x，账号可创建 lesson_agent_chunks_v1 索引和执行读写；按部署许可确认基础搜索/向量脚本可用。示例不使用 Elasticsearch 服务端 RRF retriever，不依赖其订阅能力。
- 向量使用 index:false + script_score 精确扫描，适合教学小数据，不宣称大规模性能。核心阶段不调用云模型；场景阶段需要真实 Embedding。
- 开启 HTTPS 时配置 JVM 信任的 CA，不关闭证书校验；ES_API_KEY 填创建 API Key 时返回的 encoded 值。

<a id="embedding"></a>

## Embedding：真实向量、批处理与知识召回

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已开通百炼 text-embedding-v3 或兼容该原生契约的模型；API Key 与端点地域一致。示例运行会将页面中的演示文本发送到该服务并计费。

<a id="reranker"></a>

## Reranker：候选重排、TopN 与引用对齐

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已开通 gte-rerank-v2，准备相同地域的 Key 与原生 Rerank URL。API 调用会产生实际用量；示例只有固定短文本。

<a id="document-parsing"></a>

## 文档解析：Tika 提取、分块与可追溯元数据

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 锁定 Apache Tika 3.2.3 core + standard parsers、Jackson 2.18.2；首次 Maven 下载依赖可能较多。升级解析库前重新核验安全公告与解析差异。
- 默认 sample.txt 随项目下载，可直接运行；也可以设置 DOCUMENT_PATH 指向文本型 PDF、DOCX 等本地文件。限制输入20MiB、输出20万字符，超限报错。
- 此示例展示 Tika 基础文本抽取，不承诺扫描 OCR、版面顺序、表格结构或页码精度。复杂文档请按课程使用 MinerU/PaddleOCR 等解析服务并保留结构。

<a id="kafka"></a>

## Kafka：分区键、手动提交与索引事件

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 kafka-clients 3.9.0；准备可连接的 Kafka Broker，本例使用无认证的本地 PLAINTEXT 环境。
- 账号需要读取集群元数据、创建 demo 前缀 Topic、发送与消费权限；示例创建 3 分区、1 副本的教学 Topic，不用于生产。Broker advertised.listeners 必须能从 Java 进程访问。

<a id="rocketmq"></a>

## RocketMQ：发送确认、消费重试与业务 Key

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 rocketmq-client 4.9.8，使用兼容的 4.x/5.x Broker Remoting 接口；这里不是 5.x gRPC Proxy 客户端。
- 管理员提前创建 demo-agent-rocketmq Topic（例如 mqadmin updateTopic -n localhost:9876 -c DefaultCluster -t demo-agent-rocketmq，集群名按实际修改）。需允许 demo 生产组/消费组访问；示例是无 ACL 的隔离学习环境。
- NameServer 与 Broker 对外注册地址都必须可达；重试演示最长等待 90 秒，Broker 需允许消费重试。

<a id="rabbitmq"></a>

## RabbitMQ：发布确认、手动确认与死信

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 com.rabbitmq:amqp-client 5.23.0；准备已有 RabbitMQ AMQP 0-9-1 服务。
- 使用专用学习 vhost 和具有 configure/write/read 权限的账号。默认 guest URI 仅供本机；远程连接应使用专用账号并按部署启用 TLS。
- 示例创建 demo.agent.rabbit 前缀 durable 队列和交换机，不清空现有队列；重复运行的历史任务也可能被读取。

<a id="temporal"></a>

## Temporal：Workflow、Activity 与恢复

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 temporal-sdk 1.27.0；已有可访问的 Temporal Server，命名空间默认 default。这里不部署服务端。
- 服务端命名空间必须存在，连接使用本地无 TLS 环境；生产按服务端要求增加 TLS 与认证。
- 必须保持 Worker 终端运行，再从另一个终端启动客户端；服务器持久化执行历史，Worker 提供 Java 代码，两者缺一不可。

<a id="nacos"></a>

## Nacos：配置读取、监听与安全生效

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- 依赖 nacos-client 2.4.3；准备兼容的 Nacos 服务端与专用学习 Namespace。需读取、发布和监听 demo 配置的权限。
- 本地默认 HTTP 端口 8848；Nacos 2.x 客户端还需要 gRPC 端口可达，默认相对主端口偏移 +1000，即 9848。按实际部署核对。
- 示例会创建或更新 DEMO_AGENT 组内 demo-agent-retrieval-core.properties 与 scenario.properties；不要用生产配置标识。

<a id="observability"></a>

## OpenTelemetry：真实 Trace、错误与异步上下文

- JDK 17+、Maven 3.6.3+。从项目根目录运行命令；先用 mvn -version 确认 Maven 使用 JDK 17 或更高版本。
- OpenTelemetry API、SDK、Logging Exporter、OTLP Exporter 均锁定 1.44.0。只引入 API 不会自动得到可查看的链路。
- 接入/核心阶段无需外部服务，LoggingSpanExporter 输出实际 Span；场景阶段要求已有 Collector 或支持 OTLP HTTP 的后端。
- DEMO_OTLP_ENDPOINT 填完整 traces URL，例如 http://localhost:4318/v1/traces；这是 HTTP/protobuf，不是 gRPC 4317。

<a id="ai-gateway"></a>

## AI 网关：统一调用、错误分类与降级

- JDK 17+、Maven 3.6.3+；依赖 Jackson 2.18.2。
- 准备已有 Higress AI 网关及可用模型供应商凭据。在控制台“AI 服务提供者”配置凭据，再在“AI 路由”映射主模型和备用模型。
- 为网关入口配置认证，AI_GATEWAY_KEY 填入口调用凭据，供应商 Key 留在网关；URL 指向网关，不是本站。例子使用非流式文本生成。

<a id="sandbox"></a>

## 执行沙箱：受限容器、超时与结果回收

- JDK 17+、Maven 3.6.3+；Docker Engine 或 Desktop 已启动，当前用户有 CLI 使用权限。
- 先运行 docker pull python:3.12-slim，示例使用 --pull=never 防止任务中途下载镜像；生产固定镜像 digest。
- 这是单机隔离机制教学。Docker 共享宿主机内核，不足以直接承载敌对多租户代码；实际开放执行应选择专门沙箱服务并增加访问策略。

<a id="evaluation"></a>

## 效果评测：检索指标与版本回归

- JDK 17+、Maven 3.6.3+；不需要模型 Key 和中间件。
- 项目自带三行 CSV，内容是教学样本，不代表任何模型/供应商的真实效果。实际使用时替换为脱敏请求、人工标注和真实检索日志。
- 这是软件效果回归示例，不是学习者考试。指标只评价检索排序与 ACL，不能替代回答事实性、工具安全和成本评估。

<a id="docker"></a>

## 容器工程：Java Worker 的构建、限制与配置

- JDK 17+、Maven 3.6.3+；Docker Engine 或 Desktop 已启动。
- 项目使用 eclipse-temurin:17-jre，首次构建需可访问镜像仓库；生产应固定经过验证的镜像 digest。
- Worker 只读 JSON 任务文件并演示处理边界，不包含完整 Embedding 或消息消费；对应调用见检索和队列 Demo。

## 如何理解结果

- 编译通过验证 Java 语法与依赖 API，不代表外部数据库、消息系统或模型服务已经联调。
- 离线运行只使用随项目提供的 TXT、CSV 和本地 OTel 日志，不调用外部服务；运行明细写入 `artifacts/demo-checks/`。
- 源码哈希变化后，旧编译/运行记录会显示为待验证；历史记录保留用于追溯。
- `npm run verify:demos` 写入实际 JDK、Maven、OS、时间、源码哈希与 Git/Actions 上下文，不覆盖运行记录。
- `npm run verify:runtime` 只更新运行记录；第三方服务的真实联调需在项目内按前提执行。
