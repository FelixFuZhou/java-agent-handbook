# Milvus：REST Collection、Upsert 与过滤搜索

通过 Milvus 2.6 REST v2 创建显式 Schema，等待集合加载，按稳定主键 Upsert 并执行 Strong 读。

## 场景

独立向量服务承载知识助手候选索引，Java 负责模型、租户、文档 ID 与引用内容。

## 运行前提

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已有可访问的 Milvus 2.6.x，开放 REST v2；不在本例启动服务。示例在默认数据库创建 lesson_toy_3、lesson_real_1024 集合，持久化保留供观察。
- 前两阶段使用三维教学向量；场景阶段调用百炼真实 Embedding。依赖仅 Jackson 2.18.2，无 Milvus SDK 版本绑定。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 已有 Milvus REST 基础地址，不包含 /v2/vectordb。
export MILVUS_URL='http://localhost:19530'
# 开启认证时填写；仅本机明确未开启认证的服务可以留空。
export MILVUS_TOKEN='<username:password 或服务 token>'
# 只通过本地环境变量提供；调用会产生实际模型用量。
export DASHSCOPE_API_KEY='<你所在地域的百炼 API Key>'
# 完整 DashScope 原生 HTTP 地址；从控制台确认地域/API Host，旧账号可按官方文档填对应入口。不是 /compatible-mode/v1/embeddings。
export EMBED_URL='https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
# 已开通的模型；示例固定 1024 维，切模型需要独立索引和重新入库。
export EMBED_MODEL='text-embedding-v3'
```

## 01 基础接入 · 列出已有集合

验证 HTTP 状态与 JSON 业务 code，不把 HTTP 200 自动当成成功。

- REST v2 路径
- 默认数据库的权限

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/MilvusStore.java](src/main/java/demo/MilvusStore.java)
- [src/main/java/demo/Http.java](src/main/java/demo/Http.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 data 中集合名称列表，空列表也是正常结果。

排障：

- 404 查服务版本/反向代理；code 非0读取 message；19530 必须可从运行 Java 的位置访问。

## 02 核心功能 · Schema、索引、Upsert 与 TopK

创建显式 tenant/content/model_id 字段，使用三维数字演示过滤。

- 区分写入成功与集合已加载
- Stable id + upsert
- Strong 读用于观察立即可见性

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/MilvusStore.java](src/main/java/demo/MilvusStore.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- upsert 显示写入数量；搜索仅返回 team-a，team-b 不会进入候选。

排障：

- 集合同名但 Schema 不同需换教学集合名或人工处理；加载超时检查 Milvus 资源与索引状态，勿无限重试。

## 03 场景应用 · 真实语义召回

真实模型编码文档与问题，用独立 1024 维集合执行租户过滤检索。

- 模型元数据随实体保存
- 输出证据与 ID
- 不会连接生成模型

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Embeddings.java](src/main/java/demo/Embeddings.java)
- [src/main/java/demo/MilvusStore.java](src/main/java/demo/MilvusStore.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印模型 request_id、upsert 结果与带 content 的 2 条候选。

排障：

- 维度错误检查 Embedding 和集合；结果不足先看 filter、租户分布和可见性，再改 topK。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Milvus REST v2 创建集合](https://milvus.io/api-reference/restful/v2.6.x/v2/Collection%20(v2)/Create.md)
- [Milvus REST v2 Upsert](https://milvus.io/api-reference/restful/v2.6.x/v2/Vector%20(v2)/Upsert.md)
- [Milvus REST v2 Search](https://milvus.io/api-reference/restful/v2.6.x/v2/Vector%20(v2)/Search.md)
- [阿里云 DashScope 原生 Embedding：text_type / dimension / text_index](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)
