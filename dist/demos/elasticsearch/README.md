# Elasticsearch：BM25、真实向量与 Java RRF

创建 text/keyword/dense_vector Mapping，检查 Bulk 子结果，再将 BM25 和精确向量搜索在 Java 中融合。

## 场景

运维知识助手同时理解“E1042”错误码与“连不上数据库”的口语描述，返回有租户过滤的证据。

## 运行前提

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已有 Elasticsearch 8.15+ 或 9.x，账号可创建 lesson_agent_chunks_v1 索引和执行读写；按部署许可确认基础搜索/向量脚本可用。示例不使用 Elasticsearch 服务端 RRF retriever，不依赖其订阅能力。
- 向量使用 index:false + script_score 精确扫描，适合教学小数据，不宣称大规模性能。核心阶段不调用云模型；场景阶段需要真实 Embedding。
- 开启 HTTPS 时配置 JVM 信任的 CA，不关闭证书校验；ES_API_KEY 填创建 API Key 时返回的 encoded 值。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 已有 Elasticsearch 地址；无认证的本机教学实例可使用 http。
export ES_URL='https://localhost:9200'
# 有认证时必填；无认证本机实例留空。
export ES_API_KEY='<encoded API Key>'
# 只通过本地环境变量提供；调用会产生实际模型用量。
export DASHSCOPE_API_KEY='<你所在地域的百炼 API Key>'
# 完整 DashScope 原生 HTTP 地址；从控制台确认地域/API Host，旧账号可按官方文档填对应入口。不是 /compatible-mode/v1/embeddings。
export EMBED_URL='https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
# 已开通的模型；示例固定 1024 维，切模型需要独立索引和重新入库。
export EMBED_MODEL='text-embedding-v3'
```

## 01 基础接入 · 版本与权限

调用根端点，验证 TLS、API Key 和 HTTP 通路。

- 鉴权与证书
- 依赖仅 JDK HttpClient/Jackson

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/ElasticStore.java](src/main/java/demo/ElasticStore.java)
- [src/main/java/demo/Http.java](src/main/java/demo/Http.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 cluster_name 与 version.number。

排障：

- PKIX 错误导入可信 CA；401 检查 encoded Key；403 检查集群监控/根端点访问权限。

## 02 核心功能 · Mapping、Bulk 与 BM25

建立明确映射，批量写入三条教学知识，用 E1042 搜索。

- Bulk HTTP 200 仍要检查 errors
- keyword 负责租户过滤
- refresh=wait_for 仅便于本例立即观察

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/ElasticStore.java](src/main/java/demo/ElasticStore.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- indexed=3；BM25 只返回 team-a 的 E1042 知识，team-b 被排除。

排障：

- 已有同名不兼容 Mapping 不能原地改类型；请换新的教学索引名，勿直接删除业务索引。中文实际分词需用 _analyze 检查。

## 03 场景应用 · 关键词与语义融合

真实 document/query 向量 + BM25 各搜一路，Java 按排名做 RRF。

- 两路都带相同租户/模型过滤
- 不直接加原始分数
- 应用 RRF 不使用服务端付费 retriever

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Embeddings.java](src/main/java/demo/Embeddings.java)
- [src/main/java/demo/ElasticStore.java](src/main/java/demo/ElasticStore.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印 indexed=3、两路 hits 与融合后 Top 2 证据；分数由索引/模型计算。

排障：

- script_score 被禁用时检查 search.allow_expensive_queries；大数据请改 ANN 方案并验证版本许可；本例不会自动放宽集群配置。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Elasticsearch Bulk API](https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk)
- [script_score 向量函数与精确搜索](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-script-score-query)
- [RRF 公式及服务端功能说明](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
- [阿里云 DashScope 原生 Embedding：text_type / dimension / text_index](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)
