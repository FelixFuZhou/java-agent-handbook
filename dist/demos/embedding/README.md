# Embedding：真实向量、批处理与知识召回

用 JDK HttpClient 调用 DashScope 原生接口，明确 document/query、批量索引映射和 1024 维契约。

## 场景

把企业报销、账号和运维知识向量化，为口语问题选出带文档编号的候选证据。只做召回，不伪造 LLM 回答。

## 运行前提

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已开通百炼 text-embedding-v3 或兼容该原生契约的模型；API Key 与端点地域一致。示例运行会将页面中的演示文本发送到该服务并计费。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 只通过本地环境变量提供；调用会产生实际模型用量。
export DASHSCOPE_API_KEY='<你所在地域的百炼 API Key>'
# 完整 DashScope 原生 HTTP 地址；从控制台确认地域/API Host，旧账号可按官方文档填对应入口。不是 /compatible-mode/v1/embeddings。
export EMBED_URL='https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
# 已开通的模型；示例固定 1024 维，切模型需要独立索引和重新入库。
export EMBED_MODEL='text-embedding-v3'
```

## 01 基础接入 · 读取真实向量

发送一条短文本，确认鉴权、模型、向量长度与用量。

- POST 原生接口
- 检查返回数量与维度

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Embeddings.java](src/main/java/demo/Embeddings.java)
- [src/main/java/demo/Http.java](src/main/java/demo/Http.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 request_id、usage、dimensions=1024 和前 5 个数；具体数值由模型决定。

排障：

- 401 查 Key 和地域；404 查完整原生路径；模型未开通或配额不足按响应错误处理。

## 02 核心功能 · 分批与文档/查询编码

一次处理 12 条文档，按 10+2 拆分，再编码 query。

- 按 text_index 恢复顺序
- document 和 query 分开调用
- 计算余弦而非直接比较数组

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Embeddings.java](src/main/java/demo/Embeddings.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 文档请求显示 batch=10 和 batch=2，另有一个 query 请求；打印 12 个分数。

排障：

- 数量或维度异常会直接失败；不要给原生接口使用 dimensions 或 input 字符串数组等兼容协议字段。

## 03 场景应用 · 小型知识助手召回

对固定知识片段生成真实向量，按相似度返回 Top 2 和稳定 ID。

- 同一模型编码两端
- 原文与向量下标一致
- 这是内存精确检索，不是向量数据库

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Embeddings.java](src/main/java/demo/Embeddings.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印 query、排名、docId、score、证据原文；不保证不同模型的分数相同。

排障：

- 若相关证据排名不佳，先检查文本与 query 类型，再比较模型；分数不是正确概率。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [阿里云 DashScope 原生 Embedding：text_type / dimension / text_index](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)
