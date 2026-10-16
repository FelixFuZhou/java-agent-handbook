# Neo4j：受控图遍历与来源边界

通过真实 Neo4j Java Driver 建立教学服务依赖图，使用参数化 Cypher 查询两跳依赖，并过滤路径中的全部节点和关系。

## 场景

运维 Agent 回答订单服务依赖哪些组件，只能访问当前租户的服务图，不能因中间节点连接而泄漏其他租户信息。

## 运行前提

- JDK 17+、Maven 3.6.3+；Neo4j Java Driver 5.26.0，建议已有 Neo4j 5.26 LTS 学习实例。
- 账号需在选定数据库创建 demo_Service 节点、demo_DEPENDS_ON 关系和 demo_service_unique 约束，并具备读取权限。只使用这些教学标签、关系和约束。
- 先运行 connect/core 或让 scenario 自动建约束；代码不删除任何现有节点。图的演示租户来自固定可信变量，实际应用必须从登录身份注入。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 学习实例 Bolt 地址；集群按实际路由与 TLS 要求配置 neo4j(s)://。
export DEMO_NEO4J_URI='bolt://localhost:7687'
# 教学账号；只授予所需数据库权限。
export DEMO_NEO4J_USER='demo_user'
# 环境注入，不写入 URI 或日志。
export DEMO_NEO4J_PASSWORD='<学习账号密码>'
# 实例中已存在的数据库；所有变更仍限定 demo_ 标签。
export DEMO_NEO4J_DATABASE='neo4j'
```

## 01 基础接入 · 驱动与约束

验证连接，创建复合唯一约束，查询服务器是否可以执行 Cypher。

- Driver 长期复用、Session 短期使用
- 参数化查询与复合业务 ID

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/GraphSupport.java](src/main/java/demo/GraphSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 输出 connected=true 与 ping=1。

排障：

- Unauthorized：检查用户与密码；DatabaseNotFound：检查数据库名称。
- 创建约束被拒绝：请管理员只为教学标签建立相同约束，再使用最小权限账号。

## 02 核心功能 · MERGE 与租户业务键

同一租户、同一服务 ID 写两次，查询并确认只有一个节点。

- MERGE 的标识要有唯一约束
- 写事务函数可能重试，内部只做幂等数据库操作

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/GraphSupport.java](src/main/java/demo/GraphSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 输出 count=1。

排障：

- ConstraintValidationFailed：已有教学节点重复，需要管理员核对重复数据，不能绕过约束继续。
- 不要在 executeWrite 回调里发邮件或调用支付；驱动可能重试回调。

## 03 场景应用 · 两跳依赖与权限

种入教学图及一条跨租户边，查询时对整条路径过滤，避免只检查起点。

- 限制关系类型与最大跳数
- 所有节点与边都进行租户过滤
- 图关系来自教学 CMDB，不代表模型抽取事实

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/GraphSupport.java](src/main/java/demo/GraphSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 仅返回 demo_cache 和 demo_billing，依赖数量为2。
- 不输出 demo_private；跨租户边不能进入答案上下文。

排障：

- 结果意外扩大：检查是否遗漏中间节点或关系权限、是否放开了跳数。
- 无结果：核对边方向、tenant_id 和 active 字段，不要先换模型。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Neo4j Java 事务函数](https://neo4j.com/docs/java-manual/current/transactions/)
- [Neo4j Cypher 变长路径](https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/)
