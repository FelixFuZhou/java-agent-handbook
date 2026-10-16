# Reranker：候选重排、TopN 与引用对齐

真实调用 DashScope gte-rerank-v2；把服务返回的 index 映射回文档 ID，并与本地 RRF 融合清楚区分。

## 场景

知识助手先融合关键词和向量两路候选，再用真实模型选择最相关的 2 条证据，保留引用。

## 运行前提

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 已开通 gte-rerank-v2，准备相同地域的 Key 与原生 Rerank URL。API 调用会产生实际用量；示例只有固定短文本。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 只通过本地环境变量提供；调用会产生实际模型用量。
export DASHSCOPE_API_KEY='<你所在地域的百炼 API Key>'
# 从百炼控制台确认完整原生地址与地域。
export RERANK_URL='https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank'
# 示例按照该模型的 query/documents/top_n 契约编写。
export RERANK_MODEL='gte-rerank-v2'
```

## 01 基础接入 · 获得真实相关性分数

用两条候选验证原生 API。

- input 和 parameters 分层
- 错误状态不当成空结果

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Rerank.java](src/main/java/demo/Rerank.java)
- [src/main/java/demo/Http.java](src/main/java/demo/Http.java)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 输出 request_id、usage 和 2 个 Hit；分数不是固定常量。

排障：

- 401/403 查地域和模型权限；404 查 endpoint；400 查模型和参数组合。

## 02 核心功能 · TopN 与 index 映射

3 个文档只返回 2 个结果，通过原始 index 找回稳定文档 ID。

- 返回下标指向输入列表
- 排序分数不表示事实正确概率

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Rerank.java](src/main/java/demo/Rerank.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 打印 2 行 docId、score 与文本，文档编号始终跟随原文。

排障：

- 候选原文/引用错位通常是将结果顺序误当输入顺序；不要跨模型复用分数阈值。

## 03 场景应用 · RRF 后做模型重排

用固定排名模拟两路检索，Java 做 RRF，再真实调用重排服务。

- 固定召回用于展示融合，不伪装真实检索
- 融合与模型重排分阶段
- 输出带来源的上下文

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Rerank.java](src/main/java/demo/Rerank.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 先打印 RRF 的候选 ID，再打印 reranked context 的 2 条证据。

排障：

- 未进入候选的证据无法靠重排找回；本示例没有调用生成模型。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [DashScope Rerank 原生 API](https://help.aliyun.com/zh/model-studio/text-rerank-api)
- [RRF 融合公式](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
