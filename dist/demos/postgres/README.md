# PostgreSQL：事务、幂等与任务状态

用真实 JDBC 构建 Agent 任务账本，观察重复提交、事务回滚和状态条件更新，再把任务完成记录与 outbox 写入同一事务。

## 场景

文档索引任务被重复提交时只建立一次；Worker 只领取 PENDING 任务，完成时原子保存结果与待发布事件。示例不调用模型或 MQ。

## 运行前提

- JDK 17+、Maven 3.6.3+；在下载目录中运行命令。
- PostgreSQL 16 或 17 服务已可访问；由管理员预先创建 demo_agent 数据库，授予学习账号该库内建表、读写权限。
- 只操作 demo_agent_task 与 demo_outbox；数据库名必须以 demo_ 开头。示例保留记录，不自动删除数据。
- 本例展示事务边界，不实现生产级租约、超时回收或真实消息发布器；RUNNING 进程崩溃恢复需另加租约与幂等执行策略。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 学习库 JDBC 地址；可按实际认证、TLS和端口调整。
export DEMO_JDBC_URL='jdbc:postgresql://localhost:5432/demo_agent?connectTimeout=5&socketTimeout=10'
# 只拥有学习库权限的数据库账号。
export DEMO_DB_USER='demo_user'
# 通过终端环境变量提供，不写入源码。
export DEMO_DB_PASSWORD='<学习账号密码>'
```

## 01 基础接入 · 验证连接与权限

连接外部数据库，读取版本并创建两张教学表。

- JDBC 服务发现与 try-with-resources
- 数据库隔离与最小建表权限

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Db.java](src/main/java/demo/Db.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 输出数据库产品、版本和 demo tables ready。

排障：

- Connection refused：核对服务端口与容器端口映射。
- Access denied / authentication failed：检查账号、密码、库授权和 TLS 配置。

## 02 核心功能 · 唯一键与回滚

同一请求提交两次，再主动回滚一个新任务，观察数据库实际状态。

- 唯一约束承担并发幂等
- 失败事务整体回滚，包括 outbox

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Db.java](src/main/java/demo/Db.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 新 UUID 请求输出 created=true, duplicateCreated=false。
- 回滚后的任务状态为 ABSENT。

排障：

- 重复提交不是异常丢失：返回 false 表示已存在，应读取原任务。
- 非唯一键 SQL 错误会继续抛出，不能当成幂等成功。

## 03 场景应用 · 任务领取与 outbox

使用固定请求 demo_doc_v1；首次领取并完成，重跑读取既有结果；列出待发布事件。

- 条件更新避免并发重复领取
- 结果与完成事件同事务提交
- outbox 仍待真正发布，打印不等于发送成功

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Db.java](src/main/java/demo/Db.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 首次输出 claimed=true，随后 state=SUCCEEDED；重跑 claimed=false。
- 只打印当前租户的 INDEX_REQUESTED 与 INDEX_COMPLETED 待发布记录。

排障：

- RUNNING 卡住：检查 Worker 是否在领取后崩溃，生产需租约与恢复机制。
- 待发布事件不会自动清空；后续发布器需成功确认后更新 published，消费者仍需幂等。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [pgJDBC 连接与参数](https://jdbc.postgresql.org/documentation/use/)
- [PostgreSQL 事务](https://www.postgresql.org/docs/current/tutorial-transactions.html)
