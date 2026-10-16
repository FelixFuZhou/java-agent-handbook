# 效果评测：检索指标与版本回归

无外部依赖的 Java 离线评测小项目，读入标注与真实检索结果的相同结构，计算 Recall@K、MRR 和权限泄漏数。

## 场景

知识库更换分块、Embedding 或检索参数之前，在同一份固定样本上比较版本，并拦截越权文档。

## 运行前提

- JDK 17+、Maven 3.6.3+；不需要模型 Key 和中间件。
- 项目自带三行 CSV，内容是教学样本，不代表任何模型/供应商的真实效果。实际使用时替换为脱敏请求、人工标注和真实检索日志。
- 这是软件效果回归示例，不是学习者考试。指标只评价检索排序与 ACL，不能替代回答事实性、工具安全和成本评估。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# UTF-8 CSV；此简化格式不支持字段含逗号/引号；多值用 | 分隔。
export EVAL_FILE='data/retrieval.csv'
```

## 01 基础接入 · 载入检索样本

定义最小数据契约：问题 ID、相关文档、检索顺序、当前用户可读文档。先拒绝缺列或空标注。

- 同一问题与文档版本的稳定 ID
- 标注集合与权限集合分开存放

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Samples.java](src/main/java/demo/Samples.java)
- [data/retrieval.csv](data/retrieval.csv)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- loaded=3，并打印每条样本。

排障：

- 在项目根目录执行；改了样本格式时同时更新 Reader，不能静默把坏行计为正确。

## 02 核心功能 · 排序质量与 ACL 指标

Recall 衡量找回多少相关文档；MRR 只关心第一个相关结果的位置；ACL 检查与相关性独立。

- 文档去重后取 TopK
- 无相关标注不强行设为 100%
- 越权结果即使相关也要计入 denied

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Metrics.java](src/main/java/demo/Metrics.java)
- [data/retrieval.csv](data/retrieval.csv)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- baseline Recall@3=1.000 MRR@3=0.833 denied=0。

排障：

- 如果评估 chunk 级指标，需要改用 chunk 标注，不能混用文档 ID；TopK 外结果不参与此处 ACL 计数。

## 03 场景应用 · 检索变更的发布门槛

固定基线，构造含泄漏和漏召回的候选版本，输出每个问题的差异，并明确拒绝该候选。

- 比较同一组样本，不更换分母
- 质量阈值由业务决定；ACL 泄漏单独否决
- 即使同一文档命中，返回正文前仍需实时鉴权

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Metrics.java](src/main/java/demo/Metrics.java)
- [src/main/java/demo/Samples.java](src/main/java/demo/Samples.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 候选版 Recall@3=0.833、MRR@3=0.833、denied=1，打印 RELEASE_BLOCKED。这是故意准备的坏候选。

排障：

- 小样本通过不能证明生产有效；扩大长尾、空结果、权限撤销样本，并单独观察延迟和 token 成本。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。三阶段已本地运行（固定评测样本）

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Stanford IR：检索效果度量](https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html)
- [BEIR：可复用检索评测基准](https://github.com/beir-cellar/beir)
