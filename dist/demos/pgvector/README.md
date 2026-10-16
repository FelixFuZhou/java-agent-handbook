# pgvector：JDBC 入库、HNSW 与租户 TopK

从三维教学数据理解余弦距离，再接真实 1024 维模型完成知识片段召回；不依赖额外向量 SDK。

## 场景

知识助手以服务端已确认的租户身份查询报销资料，确保候选阶段就带 tenant 和 model_id 过滤。

## 运行前提

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已有 PostgreSQL 15+，服务器安装 pgvector 0.8.x。PG_USER 对教学数据库有 CREATE EXTENSION、建表和索引权限；正式环境由 DBA 预置扩展。
- 依赖 PostgreSQL JDBC 42.7.5、Jackson 2.18.2。前两阶段不调用云模型；场景阶段需要百炼 Embedding。运行会创建/更新 lesson_chunks_toy 和 lesson_chunks_real 教学表，不自动删除。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 已有教学数据库 JDBC URL，可按需要加 sslmode。
export PG_URL='jdbc:postgresql://localhost:5432/agent_demo'
# 仅用于教学库的数据库账号。
export PG_USER='learner'
# 通过环境变量传入。
export PG_PASSWORD='<数据库密码>'
# 只通过本地环境变量提供；调用会产生实际模型用量。
export DASHSCOPE_API_KEY='<你所在地域的百炼 API Key>'
# 完整 DashScope 原生 HTTP 地址；从控制台确认地域/API Host，旧账号可按官方文档填对应入口。不是 /compatible-mode/v1/embeddings。
export EMBED_URL='https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
# 已开通的模型；示例固定 1024 维，切模型需要独立索引和重新入库。
export EMBED_MODEL='text-embedding-v3'
```

## 01 基础接入 · JDBC 与扩展检查

连接数据库并读取 PostgreSQL 版本、已安装 vector 扩展版本。

- 连接与结果集关闭
- 不输出数据库密码

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/PgStore.java](src/main/java/demo/PgStore.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 PostgreSQL 版本；若扩展尚未启用，显示 vector not enabled，下一阶段尝试启用。

排障：

- connection refused 查端口/网络；extension not available 表示服务器缺少扩展包，不能靠 Maven 修复。

## 02 核心功能 · 教学向量入库与索引

创建 vector(3)、HNSW 与带租户过滤的 SQL TopK。数字向量只是距离演示，没有真实语义。

- SQL 参数绑定
- ON CONFLICT 幂等写入
- 过滤先于返回候选

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/PgStore.java](src/main/java/demo/PgStore.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 只打印 tenant=team-a 的 2 条记录；team-b 的相同方向向量不会出现。

排障：

- vector dimensions 不匹配检查表结构；小表优化器可能选择顺序扫描，这不表示索引失效。

## 03 场景应用 · 真实 Embedding + 权限过滤

用 document 编码入库，用 query 编码问题并查询同一模型和租户。

- 不同维度使用独立表
- 模型标识随向量持久化
- 输出证据 ID，供后续生成引用

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Embeddings.java](src/main/java/demo/Embeddings.java)
- [src/main/java/demo/PgStore.java](src/main/java/demo/PgStore.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印真实模型用量和 team-a 的候选证据；不调用生成模型。

排障：

- 模型切换后要重建全量索引；ANN 加过滤返回不足时比较精确搜索、迭代扫描和索引参数，不在应用里去掉权限条件。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [pgvector 官方 SQL、HNSW 与过滤](https://github.com/pgvector/pgvector)
- [阿里云 DashScope 原生 Embedding：text_type / dimension / text_index](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)
