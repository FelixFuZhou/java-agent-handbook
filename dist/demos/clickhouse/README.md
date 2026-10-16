# ClickHouse：批量调用事件与用量分析

使用 Java 17 HttpClient 和参数化 HTTP 查询接入 ClickHouse，将模型调用事件批量写入 MergeTree，再按租户和批次聚合 Token 与延迟。

## 场景

分析知识助手的模型使用量，严格区分调用事件与任务成功。用独立演示批次避免历史运行影响本次结果。

## 运行前提

- JDK 17+、Maven 3.6.3+；仅依赖 Jackson 2.18.2，HTTP 客户端来自 JDK。
- 准备 ClickHouse 24.8+ 学习实例的 HTTP 端口（通常8123，TLS可为8443）；账号能在 default 库创建、写入和读取 demo_agent_usage。
- 只操作 default.demo_agent_usage。学习账号必须设置密码，项目不使用空密码自动登录；HTTPS 远端服务保持正常证书验证。
- MergeTree 排序键不保证唯一，本例不自动重试未知结果的 INSERT；每次场景使用新 batch_id，并只查询本批数据。真实重复事件需另建去重与对账策略。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# HTTP 服务入口，不是原生 TCP 9000端口；不包含查询参数。
export DEMO_CLICKHOUSE_URL='http://localhost:8123'
# 仅有教学表所需权限的账号。
export DEMO_CLICKHOUSE_USER='demo_user'
# 通过请求头传递，不放在 URL 中。
export DEMO_CLICKHOUSE_PASSWORD='<学习账号密码>'
```

## 01 基础接入 · HTTP 与版本查询

发送 SELECT version()，确认 HTTP 入口与认证，再建教学 MergeTree 表。

- HTTP端口与原生协议端口不同
- 检查非2xx响应
- 只使用固定教学表名

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/ClickSupport.java](src/main/java/demo/ClickSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 输出 ClickHouse 版本和 demo table ready。

排障：

- 连接9000报错：改用 HTTP 8123或配置的TLS端口。
- 401/403/516：检查学习账号与密码；表权限不足需管理员授权。

## 02 核心功能 · JSONEachRow 批量写入

一次请求插入两条调用事件，按 UUID 批次统计。

- 批量写入降低小数据片段开销
- 参数化查询避免拼接租户值
- ORDER BY不等于唯一约束

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/ClickSupport.java](src/main/java/demo/ClickSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 当前批次 calls=2，input_tokens=300，output_tokens=70。

排障：

- UNKNOWN_TABLE：先运行 connect或检查 default库权限；代码也会自动建表。
- 写入超时不能直接判断未写入，先按 batch_id核对再决定如何补发。

## 03 场景应用 · 多租户用量隔离

批量写入两个租户的模拟模型调用，只聚合当前租户本次批次，按模型显示调用量、Token与P95。

- 供应商usage与本地估算应区分
- 调用成功不等于业务任务成功
- tenant与batch均参数绑定

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/ClickSupport.java](src/main/java/demo/ClickSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- demo_alpha 的 model-a 有2次调用、input=800、output=150。
- model-b 有1次调用、input=200、output=40；另一租户9999 Token不会计入。

排障：

- 成本偏高：先查重复采集、重试和口径，不能把调用数量直接当用户任务数。
- P95为近似聚合，三条教学数据仅用于理解SQL，不代表稳定性能结论。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [ClickHouse HTTP接口与参数化查询](https://clickhouse.com/docs/interfaces/http)
- [ClickHouse MergeTree](https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree)
